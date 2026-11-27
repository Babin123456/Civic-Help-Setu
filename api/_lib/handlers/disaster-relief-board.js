/* global process */
/**
 * api/_lib/handlers/disaster-relief-board.js
 *
 * Serverless API handler for Public Disaster Relief Entitlement & Camp Information Board (#1435):
 *   GET  /api/disaster-relief-board
 *   GET  /api/disaster-relief-board/audit-log                (Admin-gated)
 *   POST /api/disaster-relief-board/camps                    (Admin-gated + jurisdiction)
 *   POST /api/disaster-relief-board/observations             (Public rate-limited + zero PII)
 *   POST /api/disaster-relief-board/observations/:id/moderate (Admin-gated + jurisdiction)
 */

import { createRateLimiter, clientKey } from '../abuseGuard.js';
import { bearerToken } from '../firebaseToken.js';
import { resolveRole } from '../../../src/services/roleService.js';
import {
  RELIEF_BOARD_SCHEMA_VERSION,
  RELIEF_BOARD_ORIGIN,
  publishOfficialReliefCamp,
  sanitizeBoardText,
  validateZeroPiiPayload,
} from '../../../src/services/disasterReliefBoardService.js';
import { getProductionDisasterReliefBoardStore } from '../disasterReliefBoardStore.js';

const ID_SEGMENT = /^[a-z0-9][a-z0-9_-]{1,127}$/i;
const defaultRateLimiter = createRateLimiter({ limit: 30, windowMs: 60 * 1000 });

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

export async function defaultVerifyReliefBoardActor(req) {
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

export function createDisasterReliefBoardHandler({
  verifyActor = defaultVerifyReliefBoardActor,
  getStore = getProductionDisasterReliefBoardStore,
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

    const store = getStore();

    // GET /audit-log (Admin-gated)
    if (method === 'GET' && rest[0] === 'audit-log') {
      const auth = await verifyActor(req);
      if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });
      if (auth.role !== 'admin') {
        return res.status(403).json({ ok: false, error: 'Admin role required to access audit logs.' });
      }
      return res.status(200).json({ ok: true, auditLog: store.getAuditLog() });
    }

    // GET / (Public board)
    if (method === 'GET' && rest.length === 0) {
      const includeExpired = query.includeExpired === 'true';
      const board = store.listBoard({ includeExpired });
      return res.status(200).json({
        ok: true,
        schemaVersion: RELIEF_BOARD_SCHEMA_VERSION,
        ...board,
      });
    }

    // Rate limit POST requests
    if (method === 'POST') {
      const { allowed, retryAfterSeconds } = rateLimiter.take(clientKey(req));
      if (!allowed) {
        res.setHeader('Retry-After', String(retryAfterSeconds));
        return res.status(429).json({
          ok: false,
          error: 'Rate limit exceeded. Please wait before submitting again.',
          retryAfterSeconds,
        });
      }
    }

    // POST /camps (Admin-gated + jurisdiction-checked)
    if (method === 'POST' && rest[0] === 'camps') {
      const auth = await verifyActor(req);
      if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });
      if (auth.role !== 'admin') {
        return res.status(403).json({ ok: false, error: 'Admin role required to publish official camps.' });
      }

      const body = parseBody(req.body);
      if (!body) return res.status(400).json({ ok: false, error: 'Invalid JSON request body.' });

      const targetJurisdiction = body.jurisdiction || body.city || 'UNSPECIFIED';
      if (!isJurisdictionAuthorized(auth.jurisdiction, targetJurisdiction)) {
        return res.status(403).json({
          ok: false,
          error: `Operator jurisdiction "${auth.jurisdiction}" cannot publish for "${targetJurisdiction}".`,
        });
      }

      const published = publishOfficialReliefCamp(body);
      if (!published.ok) {
        return res.status(400).json({ ok: false, error: 'Validation failed.', details: published.errors });
      }

      store.addCamp(published.camp, auth.actorId);
      return res.status(201).json({ ok: true, camp: published.camp });
    }

    // POST /observations (Public citizen camp status report with zero PII)
    if (method === 'POST' && rest[0] === 'observations' && rest.length === 1) {
      const body = parseBody(req.body);
      if (!body) return res.status(400).json({ ok: false, error: 'Invalid JSON request body.' });

      const piiCheck = validateZeroPiiPayload(body);
      if (!piiCheck.valid) {
        return res.status(400).json({ ok: false, error: 'Prohibited PII detected.', details: piiCheck.violations });
      }

      const campId = sanitizeBoardText(body.campId, 80);
      const note = sanitizeBoardText(body.note, 400);
      const observedStatus = sanitizeBoardText(body.observedStatus || 'OPEN', 40);
      if (!campId || note.length < 5) {
        return res.status(400).json({ ok: false, error: 'campId and a brief condition note (min 5 chars) are required.' });
      }

      const obs = {
        id: `camp_obs_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        campId,
        observedStatus,
        note,
        status: 'pending_review',
        originClassification: RELIEF_BOARD_ORIGIN.CITIZEN_OBSERVATION,
        submittedAt: new Date().toISOString(),
      };
      store.addObservation(obs);
      return res.status(201).json({ ok: true, observation: obs });
    }

    // POST /observations/:id/moderate (Admin-gated + jurisdiction-checked)
    if (method === 'POST' && rest[0] === 'observations' && ID_SEGMENT.test(rest[1] || '') && rest[2] === 'moderate') {
      const auth = await verifyActor(req);
      if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });
      if (auth.role !== 'admin') {
        return res.status(403).json({ ok: false, error: 'Admin role required to moderate observations.' });
      }

      const body = parseBody(req.body);
      if (!body || !['approve', 'reject'].includes(body.decision)) {
        return res.status(400).json({ ok: false, error: 'decision must be "approve" or "reject".' });
      }

      const targetObs = store.listBoard({ includeExpired: true }).observations.find((o) => o.id === rest[1]);
      if (!targetObs) return res.status(404).json({ ok: false, error: 'Observation not found.' });

      const camp = store.getCampById(targetObs.campId);
      const targetJurisdiction = camp?.jurisdiction || camp?.city || 'UNSPECIFIED';
      if (!isJurisdictionAuthorized(auth.jurisdiction, targetJurisdiction)) {
        return res.status(403).json({
          ok: false,
          error: `Operator jurisdiction "${auth.jurisdiction}" cannot moderate observations for "${targetJurisdiction}".`,
        });
      }

      const updated = store.moderateObservation(rest[1], body.decision, auth.actorId, sanitizeBoardText(body.note || '', 300));
      return res.status(200).json({ ok: true, observation: updated });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method or route not allowed.' });
  };
}

export default createDisasterReliefBoardHandler();
