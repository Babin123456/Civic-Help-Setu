/* global process */
/**
 * api/_lib/handlers/anganwadi-calendar.js
 *
 * Serverless API handler for Public Anganwadi Service Availability & Nutrition-Day Calendar (#1438):
 *   GET  /api/anganwadi-calendar
 *   GET  /api/anganwadi-calendar/centres?wardId=&jurisdiction=
 *   GET  /api/anganwadi-calendar/audit-log                      (Admin-gated)
 *   POST /api/anganwadi-calendar/centres/:id/schedule-changes   (Admin-gated + jurisdiction)
 *   POST /api/anganwadi-calendar/centres/:id/community-status   (Auth + zero child-health/PII)
 */

import { createRateLimiter, clientKey } from '../abuseGuard.js';
import { bearerToken } from '../firebaseToken.js';
import { resolveRole } from '../../../src/services/roleService.js';
import {
  ANGANWADI_CALENDAR_SCHEMA_VERSION,
  publishOfficialScheduleChange,
  submitCommunityCentreStatus,
  validateNoChildHealthDataOrPii,
} from '../../../src/services/anganwadiCalendarService.js';
import { getProductionAnganwadiCalendarStore } from '../anganwadiCalendarStore.js';

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

export async function defaultVerifyAnganwadiActor(req) {
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

export function createAnganwadiCalendarHandler({
  verifyActor = defaultVerifyAnganwadiActor,
  getStore = getProductionAnganwadiCalendarStore,
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
      return res.status(503).json({ error: 'Anganwadi calendar store unavailable.' });
    }

    if (method === 'GET' && rest.length === 0) {
      return res.status(200).json({
        schemaVersion: ANGANWADI_CALENDAR_SCHEMA_VERSION,
        service: 'anganwadi-calendar',
        status: 'healthy',
      });
    }

    if (method === 'GET' && rest[0] === 'centres' && rest.length === 1) {
      const centres = await store.listCentres({
        wardId: query.wardId || null,
        jurisdiction: query.jurisdiction || null,
      });
      return res.status(200).json({ schemaVersion: ANGANWADI_CALENDAR_SCHEMA_VERSION, centres });
    }

    const auth = await verifyActor(req);
    if (!auth?.ok) {
      return res.status(auth?.status || 401).json({ error: auth?.error || 'Authentication required.' });
    }

    const role = auth.role === 'admin' ? 'admin' : 'citizen';

    if (method === 'GET' && rest[0] === 'audit-log' && rest.length === 1) {
      if (role !== 'admin') return res.status(403).json({ error: 'Admin role required for audit log.' });
      const entries = await store.listAuditLog({ limit: query.limit });
      return res.status(200).json({ schemaVersion: ANGANWADI_CALENDAR_SCHEMA_VERSION, entries });
    }

    const body = parseBody(req.body);
    if (!body) {
      return res.status(400).json({ error: 'Request body must be valid JSON.' });
    }

    const safetyCheck = validateNoChildHealthDataOrPii(body, 'request');
    if (!safetyCheck.valid) {
      return res.status(400).json({
        error: 'Child-level health data or PII is strictly prohibited.',
        code: 'ERR_CHILD_PRIVACY_PROHIBITED',
        details: safetyCheck.violations,
      });
    }

    if (method === 'POST' && rest[0] === 'centres' && rest.length === 3 && rest[2] === 'schedule-changes') {
      if (role !== 'admin') return res.status(403).json({ error: 'Admin role required to publish schedule changes.' });
      if (!ID_SEGMENT.test(rest[1])) return res.status(400).json({ error: 'Invalid centreId.' });
      const existing = await store.getCentre(rest[1]);
      if (!existing) return res.status(404).json({ error: 'Anganwadi centre not found.' });

      const targetJur = body.officialProvenance?.jurisdiction || existing.jurisdiction;
      if (!isJurisdictionAuthorized(auth.jurisdiction, targetJur)) {
        return res.status(403).json({
          error: `Operator jurisdiction '${auth.jurisdiction}' cannot update centre for '${targetJur}'.`,
        });
      }

      try {
        const updated = publishOfficialScheduleChange(existing, {
          actorId: auth.actorId,
          role,
          effectiveDate: body.effectiveDate,
          openingHours: body.openingHours,
          nutritionDay: body.nutritionDay,
          reason: body.reason,
          officialProvenance: body.officialProvenance || {},
        });
        await store.saveCentre(updated);
        await store.appendAuditLog({
          action: 'PUBLISH_ANGANWADI_SCHEDULE',
          actorId: auth.actorId,
          role,
          jurisdiction: targetJur || 'UNSPECIFIED',
          targetId: existing.centreId,
          status: 'verified',
          summary: `Published schedule change for ${existing.centreId}`,
        });
        return res.status(201).json({ schemaVersion: ANGANWADI_CALENDAR_SCHEMA_VERSION, centre: updated });
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }

    if (method === 'POST' && rest[0] === 'centres' && rest.length === 3 && rest[2] === 'community-status') {
      if (!ID_SEGMENT.test(rest[1])) return res.status(400).json({ error: 'Invalid centreId.' });
      const existing = await store.getCentre(rest[1]);
      if (!existing) return res.status(404).json({ error: 'Anganwadi centre not found.' });

      try {
        const updated = submitCommunityCentreStatus(existing, body, auth.actorId);
        await store.saveCentre(updated);
        await store.appendAuditLog({
          action: 'SUBMIT_ANGANWADI_COMMUNITY_STATUS',
          actorId: auth.actorId,
          role,
          jurisdiction: existing.jurisdiction,
          targetId: existing.centreId,
          status: body.statusType || 'open_normal',
          summary: `Submitted community status for ${existing.centreId}`,
        });
        return res.status(201).json({ schemaVersion: ANGANWADI_CALENDAR_SCHEMA_VERSION, centre: updated });
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }

    return res.status(404).json({ error: 'Anganwadi calendar endpoint not found.' });
  };
}

export default createAnganwadiCalendarHandler();
