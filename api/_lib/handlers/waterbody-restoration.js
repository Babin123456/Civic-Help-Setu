/* global process */
/**
 * api/_lib/handlers/waterbody-restoration.js
 *
 * Serverless API handler for Public Waterbody Restoration Milestone & Evidence Tracker (#1442):
 *   GET  /api/waterbody-restoration
 *   GET  /api/waterbody-restoration/waterbodies
 *   GET  /api/waterbody-restoration/waterbodies/:id
 *   GET  /api/waterbody-restoration/audit-log                  (Admin-gated)
 *   POST /api/waterbody-restoration/waterbodies/:id/observations (Authenticated)
 *   POST /api/waterbody-restoration/waterbodies/:id/corrections  (Admin-gated + jurisdiction check)
 */

import { createRateLimiter, clientKey } from '../abuseGuard.js';
import { bearerToken } from '../firebaseToken.js';
import { resolveRole } from '../../../src/services/roleService.js';
import {
  WATERBODY_SCHEMA_VERSION,
  addCommunityObservation,
  recordMilestoneCorrection,
  validateWaterbodyZeroPii,
} from '../../../src/services/waterbodyRestorationService.js';
import { getProductionWaterbodyStore } from '../waterbodyRestorationStore.js';

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

export async function defaultVerifyWaterbodyActor(req) {
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

export function createWaterbodyRestorationHandler({
  verifyActor = defaultVerifyWaterbodyActor,
  getStore = getProductionWaterbodyStore,
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
      return res.status(503).json({ error: 'Waterbody store unavailable.' });
    }

    if (method === 'GET' && rest.length === 0) {
      return res.status(200).json({
        schemaVersion: WATERBODY_SCHEMA_VERSION,
        service: 'waterbody-restoration',
        status: 'healthy',
      });
    }

    if (method === 'GET' && rest[0] === 'waterbodies' && rest.length === 1) {
      const waterbodies = await store.listWaterbodies({ jurisdiction: query.jurisdiction || null });
      return res.status(200).json({ schemaVersion: WATERBODY_SCHEMA_VERSION, waterbodies });
    }

    if (method === 'GET' && rest[0] === 'waterbodies' && rest.length === 2) {
      if (!ID_SEGMENT.test(rest[1])) return res.status(400).json({ error: 'Invalid waterbodyId.' });
      const wb = await store.getWaterbody(rest[1]);
      if (!wb) return res.status(404).json({ error: 'Waterbody project not found.' });
      return res.status(200).json({ schemaVersion: WATERBODY_SCHEMA_VERSION, waterbody: wb });
    }

    const auth = await verifyActor(req);
    if (!auth?.ok) {
      return res.status(auth?.status || 401).json({ error: auth?.error || 'Authentication required.' });
    }

    const role = auth.role === 'admin' ? 'admin' : 'citizen';

    if (method === 'GET' && rest[0] === 'audit-log' && rest.length === 1) {
      if (role !== 'admin') return res.status(403).json({ error: 'Admin role required for audit log.' });
      const entries = await store.listAuditLog({ limit: query.limit });
      return res.status(200).json({ schemaVersion: WATERBODY_SCHEMA_VERSION, entries });
    }

    const body = parseBody(req.body);
    if (!body) {
      return res.status(400).json({ error: 'Request body must be valid JSON.' });
    }

    const piiCheck = validateWaterbodyZeroPii(body, 'request');
    if (!piiCheck.valid) {
      return res.status(400).json({
        error: 'PII or sensitive credentials are strictly prohibited.',
        code: 'ERR_PII_PROHIBITED',
        details: piiCheck.violations,
      });
    }

    if (method === 'POST' && rest[0] === 'waterbodies' && rest.length === 3 && rest[2] === 'observations') {
      if (!ID_SEGMENT.test(rest[1])) return res.status(400).json({ error: 'Invalid waterbodyId.' });
      const existing = await store.getWaterbody(rest[1]);
      if (!existing) return res.status(404).json({ error: 'Waterbody project not found.' });

      try {
        const updated = addCommunityObservation(existing, body, auth.actorId);
        await store.saveWaterbody(updated);
        await store.appendAuditLog({
          action: 'ADD_WATERBODY_OBSERVATION',
          actorId: auth.actorId,
          role,
          jurisdiction: existing.jurisdiction,
          targetId: existing.waterbodyId,
          status: body.milestoneType,
          summary: `Added community observation for ${body.milestoneType}`,
        });
        return res.status(201).json({ schemaVersion: WATERBODY_SCHEMA_VERSION, waterbody: updated });
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }

    if (method === 'POST' && rest[0] === 'waterbodies' && rest.length === 3 && rest[2] === 'corrections') {
      if (role !== 'admin') return res.status(403).json({ error: 'Admin role required to record corrections.' });
      if (!ID_SEGMENT.test(rest[1])) return res.status(400).json({ error: 'Invalid waterbodyId.' });
      const existing = await store.getWaterbody(rest[1]);
      if (!existing) return res.status(404).json({ error: 'Waterbody project not found.' });

      const targetJur = body.officialSource?.jurisdiction || existing.jurisdiction;
      if (!isJurisdictionAuthorized(auth.jurisdiction, targetJur)) {
        return res.status(403).json({
          error: `Operator jurisdiction '${auth.jurisdiction}' cannot correct waterbody for '${targetJur}'.`,
        });
      }

      try {
        const updated = recordMilestoneCorrection(existing, {
          actorId: auth.actorId,
          role,
          milestoneType: body.milestoneType,
          correctedStatus: body.correctedStatus,
          reason: body.reason,
          officialSource: body.officialSource || {},
        });
        await store.saveWaterbody(updated);
        await store.appendAuditLog({
          action: 'RECORD_MILESTONE_CORRECTION',
          actorId: auth.actorId,
          role,
          jurisdiction: targetJur || 'UNSPECIFIED',
          targetId: existing.waterbodyId,
          status: body.milestoneType,
          summary: `Recorded preserved correction for ${body.milestoneType}`,
        });
        return res.status(200).json({ schemaVersion: WATERBODY_SCHEMA_VERSION, waterbody: updated });
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }

    return res.status(404).json({ error: 'Waterbody restoration endpoint not found.' });
  };
}

export default createWaterbodyRestorationHandler();
