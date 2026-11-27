/* global process */
/**
 * api/_lib/handlers/library-resource-directory.js
 *
 * Serverless API handler for Public Library & Community Learning Resource Directory (#1439):
 *   GET  /api/library-resource-directory
 *   GET  /api/library-resource-directory/facilities?query=&wardId=&wheelchairOnly=&brailleOnly=&screenReaderOnly=&digitalLabOnly=
 *   GET  /api/library-resource-directory/audit-log                         (Admin-gated)
 *   POST /api/library-resource-directory/facilities/:id/updates            (Auth required)
 *   POST /api/library-resource-directory/facilities/:id/updates/:uid/moderate (Admin-gated + jurisdiction)
 *   POST /api/library-resource-directory/facilities/:id/exceptions         (Admin-gated + jurisdiction)
 */

import { createRateLimiter, clientKey } from '../abuseGuard.js';
import { bearerToken } from '../firebaseToken.js';
import { resolveRole } from '../../../src/services/roleService.js';
import {
  LIBRARY_DIR_SCHEMA_VERSION,
  addOpeningHourException,
  moderateCommunityLibraryUpdate,
  searchLearningFacilities,
  submitCommunityLibraryUpdate,
  validateLibraryZeroPii,
} from '../../../src/services/libraryResourceDirectoryService.js';
import { getProductionLibraryDirectoryStore } from '../libraryResourceDirectoryStore.js';

const ID_SEGMENT = /^[a-z0-9][a-z0-9_-]{1,127}$/i;
const defaultRateLimiter = createRateLimiter({ limit: 40, windowMs: 60 * 1000 });

function parseBody(body) {
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }
  return body && typeof body === 'object' ? body : null;
}

function parseUrlQuery(url) {
  const q = {};
  const idx = (url || '').indexOf('?');
  if (idx === -1) return q;
  const search = url.slice(idx + 1);
  for (const pair of search.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    if (eq === -1) q[decodeURIComponent(pair)] = '';
    else q[decodeURIComponent(pair.slice(0, eq))] = decodeURIComponent(pair.slice(eq + 1));
  }
  return q;
}

export async function defaultVerifyLibraryActor(req) {
  const token = bearerToken(req.headers || {});
  if (!token) return { ok: false, status: 401, error: 'Authentication required.' };

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) return { ok: false, status: 503, error: 'Authentication service is not configured.' };

  try {
    const { verifyToken, createClerkClient } = await import('@clerk/backend');
    const claims = await verifyToken(token, { secretKey });
    const clerk = createClerkClient({ secretKey });
    const user = await clerk.users.getUser(claims.sub);
    const role = resolveRole(user?.publicMetadata);
    const jurisdiction =
      typeof user?.publicMetadata?.jurisdiction === 'string' && user.publicMetadata.jurisdiction.trim()
        ? user.publicMetadata.jurisdiction.trim()
        : '*';
    return { ok: true, actorId: claims.sub, role, jurisdiction };
  } catch {
    return { ok: false, status: 401, error: 'Invalid or expired authentication token.' };
  }
}

function isJurisdictionAuthorized(operatorJurisdiction, targetJurisdiction) {
  if (!operatorJurisdiction || operatorJurisdiction === '*') return true;
  if (!targetJurisdiction || targetJurisdiction === 'UNSPECIFIED') return false;
  return operatorJurisdiction.toLowerCase() === String(targetJurisdiction).trim().toLowerCase();
}

export function createLibraryResourceDirectoryHandler({
  verifyActor = defaultVerifyLibraryActor,
  getStore = getProductionLibraryDirectoryStore,
  rateLimiter = defaultRateLimiter,
} = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json');

    const method = (req.method || 'GET').toUpperCase();
    const url = req.url || '';
    const query = { ...parseUrlQuery(url), ...(req.query || {}) };
    const pathname = url.split('?')[0];
    const segments = pathname.split('/').filter(Boolean);
    const rest = segments[0] === 'api' ? segments.slice(2) : segments.slice(1);

    const ipKey = clientKey(req);
    const rate = rateLimiter.take(ipKey);
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
      return res.status(429).json({ error: 'Rate limit exceeded.', code: 'ERR_RATE_LIMIT' });
    }

    let store;
    try {
      store = await getStore();
    } catch {
      return res.status(503).json({ error: 'Library directory store unavailable.' });
    }

    if (method === 'GET' && rest.length === 0) {
      return res.status(200).json({
        schemaVersion: LIBRARY_DIR_SCHEMA_VERSION,
        service: 'library-resource-directory',
        status: 'healthy',
      });
    }

    if (method === 'GET' && rest[0] === 'facilities' && rest.length === 1) {
      const all = await store.listFacilities();
      const facilities = searchLearningFacilities(all, {
        query: query.query || '',
        wardId: query.wardId || 'all',
        wheelchairOnly: query.wheelchairOnly === 'true',
        brailleOnly: query.brailleOnly === 'true',
        screenReaderOnly: query.screenReaderOnly === 'true',
        digitalLabOnly: query.digitalLabOnly === 'true',
      });
      return res.status(200).json({ schemaVersion: LIBRARY_DIR_SCHEMA_VERSION, facilities });
    }

    const auth = await verifyActor(req);
    if (!auth?.ok) {
      return res.status(auth?.status || 401).json({ error: auth?.error || 'Authentication required.' });
    }

    const role = auth.role === 'admin' ? 'admin' : 'citizen';

    if (method === 'GET' && rest[0] === 'audit-log' && rest.length === 1) {
      if (role !== 'admin') return res.status(403).json({ error: 'Admin role required for audit log.' });
      const entries = await store.listAuditLog({ limit: query.limit });
      return res.status(200).json({ schemaVersion: LIBRARY_DIR_SCHEMA_VERSION, entries });
    }

    const body = parseBody(req.body);
    if (!body) {
      return res.status(400).json({ error: 'Request body must be valid JSON.' });
    }

    const piiCheck = validateLibraryZeroPii(body, 'request');
    if (!piiCheck.valid) {
      return res.status(400).json({
        error: 'PII or sensitive credentials are strictly prohibited.',
        code: 'ERR_PII_PROHIBITED',
        details: piiCheck.violations,
      });
    }

    if (method === 'POST' && rest[0] === 'facilities' && rest.length === 3 && rest[2] === 'updates') {
      if (!ID_SEGMENT.test(rest[1])) return res.status(400).json({ error: 'Invalid facilityId.' });
      const existing = await store.getFacility(rest[1]);
      if (!existing) return res.status(404).json({ error: 'Facility not found.' });

      try {
        const updated = submitCommunityLibraryUpdate(existing, body, auth.actorId);
        await store.saveFacility(updated);
        await store.appendAuditLog({
          action: 'SUBMIT_LIBRARY_UPDATE',
          actorId: auth.actorId,
          role,
          jurisdiction: existing.jurisdiction,
          targetId: existing.facilityId,
          status: 'pending_moderation',
          summary: `Submitted community update for ${existing.facilityId}`,
        });
        return res.status(201).json({ schemaVersion: LIBRARY_DIR_SCHEMA_VERSION, facility: updated });
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }

    if (
      method === 'POST' &&
      rest[0] === 'facilities' &&
      rest.length === 5 &&
      rest[2] === 'updates' &&
      rest[4] === 'moderate'
    ) {
      if (role !== 'admin') return res.status(403).json({ error: 'Admin role required to moderate updates.' });
      if (!ID_SEGMENT.test(rest[1]) || !ID_SEGMENT.test(rest[3])) {
        return res.status(400).json({ error: 'Invalid facilityId or updateId.' });
      }
      const existing = await store.getFacility(rest[1]);
      if (!existing) return res.status(404).json({ error: 'Facility not found.' });

      const targetJur = body.officialProvenance?.jurisdiction || existing.jurisdiction;
      if (!isJurisdictionAuthorized(auth.jurisdiction, targetJur)) {
        return res.status(403).json({
          error: `Operator jurisdiction '${auth.jurisdiction}' cannot moderate facility for '${targetJur}'.`,
        });
      }

      try {
        const updated = moderateCommunityLibraryUpdate(existing, {
          updateId: rest[3],
          decision: body.decision,
          actorId: auth.actorId,
          role,
          officialProvenance: body.officialProvenance || {},
        });
        await store.saveFacility(updated);
        await store.appendAuditLog({
          action: 'MODERATE_LIBRARY_UPDATE',
          actorId: auth.actorId,
          role,
          jurisdiction: targetJur || 'UNSPECIFIED',
          targetId: rest[3],
          status: body.decision,
          summary: `Moderated library update ${rest[3]} (${body.decision})`,
        });
        return res.status(200).json({ schemaVersion: LIBRARY_DIR_SCHEMA_VERSION, facility: updated });
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }

    if (method === 'POST' && rest[0] === 'facilities' && rest.length === 3 && rest[2] === 'exceptions') {
      if (role !== 'admin') return res.status(403).json({ error: 'Admin role required to publish exceptions.' });
      if (!ID_SEGMENT.test(rest[1])) return res.status(400).json({ error: 'Invalid facilityId.' });
      const existing = await store.getFacility(rest[1]);
      if (!existing) return res.status(404).json({ error: 'Facility not found.' });

      const targetJur = body.officialProvenance?.jurisdiction || existing.jurisdiction;
      if (!isJurisdictionAuthorized(auth.jurisdiction, targetJur)) {
        return res.status(403).json({
          error: `Operator jurisdiction '${auth.jurisdiction}' cannot publish exception for '${targetJur}'.`,
        });
      }

      try {
        const updated = addOpeningHourException(existing, {
          actorId: auth.actorId,
          role,
          dateRange: body.dateRange,
          adjustedHours: body.adjustedHours,
          reason: body.reason,
          isClosed: body.isClosed,
          officialProvenance: body.officialProvenance || {},
        });
        await store.saveFacility(updated);
        await store.appendAuditLog({
          action: 'PUBLISH_HOUR_EXCEPTION',
          actorId: auth.actorId,
          role,
          jurisdiction: targetJur || 'UNSPECIFIED',
          targetId: existing.facilityId,
          status: body.isClosed ? 'closed' : 'adjusted',
          summary: `Published opening-hour exception for ${existing.facilityId}`,
        });
        return res.status(201).json({ schemaVersion: LIBRARY_DIR_SCHEMA_VERSION, facility: updated });
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }

    return res.status(404).json({ error: 'Library resource directory endpoint not found.' });
  };
}

export default createLibraryResourceDirectoryHandler();
