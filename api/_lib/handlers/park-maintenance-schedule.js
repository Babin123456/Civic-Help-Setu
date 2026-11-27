/* global process */
/**
 * api/_lib/handlers/park-maintenance-schedule.js
 *
 * Serverless API handler for Public Park Maintenance & Amenity Inspection Schedule (#1440):
 *   GET  /api/park-maintenance-schedule
 *   GET  /api/park-maintenance-schedule/parks?wardId=&jurisdiction=
 *   GET  /api/park-maintenance-schedule/audit-log                    (Admin-gated)
 *   POST /api/park-maintenance-schedule/parks/:id/maintenance-windows (Admin-gated + jurisdiction)
 *   POST /api/park-maintenance-schedule/parks/:id/observations        (Auth + photo personal-data moderation)
 */

import { createRateLimiter, clientKey } from '../abuseGuard.js';
import { bearerToken } from '../firebaseToken.js';
import { resolveRole } from '../../../src/services/roleService.js';
import {
  PARK_SCHEDULE_SCHEMA_VERSION,
  publishMaintenanceWindow,
  submitResidentParkObservation,
  validateParkZeroPii,
} from '../../../src/services/parkMaintenanceScheduleService.js';
import { getProductionParkScheduleStore } from '../parkMaintenanceScheduleStore.js';

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

export async function defaultVerifyParkActor(req) {
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

export function createParkMaintenanceScheduleHandler({
  verifyActor = defaultVerifyParkActor,
  getStore = getProductionParkScheduleStore,
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
      return res.status(503).json({ error: 'Park schedule store unavailable.' });
    }

    if (method === 'GET' && rest.length === 0) {
      return res.status(200).json({
        schemaVersion: PARK_SCHEDULE_SCHEMA_VERSION,
        service: 'park-maintenance-schedule',
        status: 'healthy',
      });
    }

    if (method === 'GET' && rest[0] === 'parks' && rest.length === 1) {
      const parks = await store.listParks({
        wardId: query.wardId || null,
        jurisdiction: query.jurisdiction || null,
      });
      return res.status(200).json({ schemaVersion: PARK_SCHEDULE_SCHEMA_VERSION, parks });
    }

    const auth = await verifyActor(req);
    if (!auth?.ok) {
      return res.status(auth?.status || 401).json({ error: auth?.error || 'Authentication required.' });
    }

    const role = auth.role === 'admin' ? 'admin' : 'citizen';

    if (method === 'GET' && rest[0] === 'audit-log' && rest.length === 1) {
      if (role !== 'admin') return res.status(403).json({ error: 'Admin role required for audit log.' });
      const entries = await store.listAuditLog({ limit: query.limit });
      return res.status(200).json({ schemaVersion: PARK_SCHEDULE_SCHEMA_VERSION, entries });
    }

    const body = parseBody(req.body);
    if (!body) {
      return res.status(400).json({ error: 'Request body must be valid JSON.' });
    }

    const piiCheck = validateParkZeroPii(body, 'request');
    if (!piiCheck.valid) {
      return res.status(400).json({
        error: 'PII or sensitive credentials are strictly prohibited.',
        code: 'ERR_PII_PROHIBITED',
        details: piiCheck.violations,
      });
    }

    if (method === 'POST' && rest[0] === 'parks' && rest.length === 3 && rest[2] === 'maintenance-windows') {
      if (role !== 'admin') return res.status(403).json({ error: 'Admin role required to publish maintenance windows.' });
      if (!ID_SEGMENT.test(rest[1])) return res.status(400).json({ error: 'Invalid parkId.' });
      const existing = await store.getPark(rest[1]);
      if (!existing) return res.status(404).json({ error: 'Park not found.' });

      const targetJur = body.officialSource?.jurisdiction || existing.jurisdiction;
      if (!isJurisdictionAuthorized(auth.jurisdiction, targetJur)) {
        return res.status(403).json({
          error: `Operator jurisdiction '${auth.jurisdiction}' cannot publish schedule for '${targetJur}'.`,
        });
      }

      try {
        const updated = publishMaintenanceWindow(existing, {
          actorId: auth.actorId,
          role,
          amenityType: body.amenityType,
          startAt: body.startAt,
          endAt: body.endAt,
          reason: body.reason,
          isTemporaryClosure: body.isTemporaryClosure,
          officialSource: body.officialSource || {},
        });
        await store.savePark(updated);
        await store.appendAuditLog({
          action: 'PUBLISH_MAINTENANCE_WINDOW',
          actorId: auth.actorId,
          role,
          jurisdiction: targetJur || 'UNSPECIFIED',
          targetId: existing.parkId,
          status: body.isTemporaryClosure ? 'temporary_closure' : 'scheduled',
          summary: `Published ${body.amenityType} maintenance window`,
        });
        return res.status(201).json({ schemaVersion: PARK_SCHEDULE_SCHEMA_VERSION, park: updated });
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }

    if (method === 'POST' && rest[0] === 'parks' && rest.length === 3 && rest[2] === 'observations') {
      if (!ID_SEGMENT.test(rest[1])) return res.status(400).json({ error: 'Invalid parkId.' });
      const existing = await store.getPark(rest[1]);
      if (!existing) return res.status(404).json({ error: 'Park not found.' });

      try {
        const updated = submitResidentParkObservation(existing, body, auth.actorId);
        await store.savePark(updated);
        await store.appendAuditLog({
          action: 'SUBMIT_PARK_OBSERVATION',
          actorId: auth.actorId,
          role,
          jurisdiction: existing.jurisdiction,
          targetId: existing.parkId,
          status: body.amenityType,
          summary: `Submitted moderated observation for ${body.amenityType}`,
        });
        return res.status(201).json({ schemaVersion: PARK_SCHEDULE_SCHEMA_VERSION, park: updated });
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }

    return res.status(404).json({ error: 'Park maintenance schedule endpoint not found.' });
  };
}

export default createParkMaintenanceScheduleHandler();
