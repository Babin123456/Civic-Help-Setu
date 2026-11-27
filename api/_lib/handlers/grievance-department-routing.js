/* global process */
/**
 * api/_lib/handlers/grievance-department-routing.js
 *
 * Serverless API handler for AI-Assisted Grievance Department Routing (#1445):
 *   GET  /api/grievance-department-routing
 *   GET  /api/grievance-department-routing/metrics
 *   GET  /api/grievance-department-routing/cases              (Admin-gated)
 *   GET  /api/grievance-department-routing/audit-log          (Admin-gated)
 *   POST /api/grievance-department-routing/classify           (Authenticated citizen or admin)
 *   POST /api/grievance-department-routing/cases/:id/override (Admin-gated + jurisdiction check)
 */

import { createRateLimiter, clientKey } from '../abuseGuard.js';
import { bearerToken } from '../firebaseToken.js';
import { resolveRole } from '../../../src/services/roleService.js';
import {
  ROUTING_SCHEMA_VERSION,
  applyHumanRoutingOverride,
  classifyGrievanceDepartments,
  evaluatePerClassRoutingMetrics,
  validateRoutingZeroPii,
} from '../../../src/services/grievanceDepartmentRoutingService.js';
import { getProductionGrievanceRoutingStore } from '../grievanceDepartmentRoutingStore.js';

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

export async function defaultVerifyRoutingActor(req) {
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

export function createGrievanceDepartmentRoutingHandler({
  verifyActor = defaultVerifyRoutingActor,
  getStore = getProductionGrievanceRoutingStore,
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
      return res.status(503).json({ error: 'Routing store unavailable.' });
    }

    if (method === 'GET' && rest.length === 0) {
      return res.status(200).json({
        schemaVersion: ROUTING_SCHEMA_VERSION,
        service: 'grievance-department-routing',
        status: 'healthy',
      });
    }

    if (method === 'GET' && rest[0] === 'metrics' && rest.length === 1) {
      const metrics = evaluatePerClassRoutingMetrics();
      return res.status(200).json({ schemaVersion: ROUTING_SCHEMA_VERSION, metrics });
    }

    const auth = await verifyActor(req);
    if (!auth?.ok) {
      return res.status(auth?.status || 401).json({ error: auth?.error || 'Authentication required.' });
    }

    const role = auth.role === 'admin' ? 'admin' : 'citizen';

    if (method === 'GET' && rest[0] === 'cases' && rest.length === 1) {
      if (role !== 'admin') return res.status(403).json({ error: 'Admin operator role required.' });
      const cases = await store.listCases({ status: query.status || null, limit: query.limit });
      return res.status(200).json({ schemaVersion: ROUTING_SCHEMA_VERSION, cases });
    }

    if (method === 'GET' && rest[0] === 'audit-log' && rest.length === 1) {
      if (role !== 'admin') return res.status(403).json({ error: 'Admin operator role required.' });
      const entries = await store.listAuditLog({ limit: query.limit });
      return res.status(200).json({ schemaVersion: ROUTING_SCHEMA_VERSION, entries });
    }

    const body = parseBody(req.body);
    if (!body) {
      return res.status(400).json({ error: 'Request body must be valid JSON.' });
    }

    const piiCheck = validateRoutingZeroPii(body, 'request');
    if (!piiCheck.valid) {
      return res.status(400).json({
        error: 'PII or sensitive credentials are strictly prohibited.',
        code: 'ERR_PII_PROHIBITED',
        details: piiCheck.violations,
      });
    }

    if (method === 'POST' && rest[0] === 'classify' && rest.length === 1) {
      try {
        const result = classifyGrievanceDepartments({
          description: body.description,
          jurisdiction: body.jurisdiction || 'IN-UP',
          confidenceThreshold: body.confidenceThreshold,
          forceDeterministicFallback: Boolean(body.forceDeterministicFallback),
        });
        await store.saveCase(result);
        return res.status(201).json({ schemaVersion: ROUTING_SCHEMA_VERSION, routing: result });
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }

    if (method === 'POST' && rest[0] === 'cases' && rest.length === 3 && rest[2] === 'override') {
      if (role !== 'admin') return res.status(403).json({ error: 'Admin operator role required.' });
      if (!ID_SEGMENT.test(rest[1])) return res.status(400).json({ error: 'Invalid caseId.' });
      const existing = await store.getCase(rest[1]);
      if (!existing) return res.status(404).json({ error: 'Routing case not found.' });

      const targetJur = existing.citizenComplaint?.jurisdiction;
      if (!isJurisdictionAuthorized(auth.jurisdiction, targetJur)) {
        return res.status(403).json({
          error: `Operator jurisdiction '${auth.jurisdiction}' cannot override case for '${targetJur}'.`,
        });
      }

      try {
        const updated = applyHumanRoutingOverride(existing, {
          actorId: auth.actorId,
          role,
          selectedCategories: body.selectedCategories,
          rationale: body.rationale,
        });
        await store.saveCase(updated);
        await store.appendAuditLog({
          action: 'HUMAN_ROUTING_OVERRIDE',
          actorId: auth.actorId,
          role,
          jurisdiction: targetJur || 'UNSPECIFIED',
          targetId: updated.caseId,
          status: updated.status,
          summary: `Confirmed routing to ${updated.humanDecision.selectedCategories.join(', ')}`,
        });
        return res.status(200).json({ schemaVersion: ROUTING_SCHEMA_VERSION, routing: updated });
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }

    return res.status(404).json({ error: 'Grievance department routing endpoint not found.' });
  };
}

export default createGrievanceDepartmentRoutingHandler();
