/* global process */
/**
 * api/_lib/handlers/accessibility-barrier-sla.js
 *
 * Serverless API handler for Accessibility Barrier Resolution SLA Dashboard (#1443):
 *   GET  /api/accessibility-barrier-sla
 *   GET  /api/accessibility-barrier-sla/summary?wardId=&facilityId=&category=&verificationState=
 *   GET  /api/accessibility-barrier-sla/audit-log              (Admin-gated)
 *   POST /api/accessibility-barrier-sla/reports                (Auth required: anonymized reporter)
 *   POST /api/accessibility-barrier-sla/reports/:id/resolve    (Admin-gated + jurisdiction check)
 */

import { createRateLimiter, clientKey } from '../abuseGuard.js';
import { bearerToken } from '../firebaseToken.js';
import { resolveRole } from '../../../src/services/roleService.js';
import {
  BARRIER_SLA_SCHEMA_VERSION,
  aggregateBarrierSlaMetrics,
  anonymizeBarrierReporter,
  createBarrierSlaReport,
  resolveBarrierSlaReport,
  validateBarrierSlaZeroPii,
} from '../../../src/services/accessibilityBarrierSlaService.js';
import { getProductionBarrierSlaStore } from '../accessibilityBarrierSlaStore.js';

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

export async function defaultVerifyBarrierActor(req) {
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

export function createAccessibilityBarrierSlaHandler({
  verifyActor = defaultVerifyBarrierActor,
  getStore = getProductionBarrierSlaStore,
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
      return res.status(503).json({ error: 'Barrier SLA store unavailable.' });
    }

    if (method === 'GET' && rest.length === 0) {
      return res.status(200).json({
        schemaVersion: BARRIER_SLA_SCHEMA_VERSION,
        service: 'accessibility-barrier-sla',
        status: 'healthy',
      });
    }

    if (method === 'GET' && rest[0] === 'summary' && rest.length === 1) {
      const reports = await store.listReports();
      const summary = aggregateBarrierSlaMetrics(reports, {
        wardId: query.wardId || 'all',
        facilityId: query.facilityId || 'all',
        category: query.category || 'all',
        verificationState: query.verificationState || 'all',
      });
      return res.status(200).json({ schemaVersion: BARRIER_SLA_SCHEMA_VERSION, summary });
    }

    const auth = await verifyActor(req);
    if (!auth?.ok) {
      return res.status(auth?.status || 401).json({ error: auth?.error || 'Authentication required.' });
    }

    const role = auth.role === 'admin' ? 'admin' : 'citizen';
    const actorRef = anonymizeBarrierReporter(auth.actorId);

    if (method === 'GET' && rest[0] === 'audit-log' && rest.length === 1) {
      if (role !== 'admin') return res.status(403).json({ error: 'Admin role required for audit log.' });
      const entries = await store.listAuditLog({ limit: query.limit });
      return res.status(200).json({ schemaVersion: BARRIER_SLA_SCHEMA_VERSION, entries });
    }

    const body = parseBody(req.body);
    if (!body) {
      return res.status(400).json({ error: 'Request body must be valid JSON.' });
    }

    const piiCheck = validateBarrierSlaZeroPii(body, 'request');
    if (!piiCheck.valid) {
      return res.status(400).json({
        error: 'PII or sensitive credentials are strictly prohibited.',
        code: 'ERR_PII_PROHIBITED',
        details: piiCheck.violations,
      });
    }

    if (method === 'POST' && rest[0] === 'reports' && rest.length === 1) {
      const created = createBarrierSlaReport(body, auth.actorId);
      if (!created.valid) {
        return res.status(400).json({ error: 'Invalid barrier SLA report.', details: created.errors });
      }
      await store.saveReport(created.report);
      await store.appendAuditLog({
        action: 'CREATE_BARRIER_SLA_REPORT',
        actorRef,
        role,
        jurisdiction: created.report.jurisdiction,
        targetId: created.report.reportId,
        status: created.report.verificationState,
        summary: `Recorded ${created.report.category} in ${created.report.wardId}`,
      });
      return res.status(201).json({ schemaVersion: BARRIER_SLA_SCHEMA_VERSION, report: created.report });
    }

    if (method === 'POST' && rest[0] === 'reports' && rest.length === 3 && rest[2] === 'resolve') {
      if (role !== 'admin') return res.status(403).json({ error: 'Admin role required to resolve reports.' });
      if (!ID_SEGMENT.test(rest[1])) return res.status(400).json({ error: 'Invalid reportId.' });
      const existing = await store.getReport(rest[1]);
      if (!existing) return res.status(404).json({ error: 'Barrier report not found.' });

      const targetJur = body.officialRule?.jurisdiction || existing.jurisdiction;
      if (!isJurisdictionAuthorized(auth.jurisdiction, targetJur)) {
        return res.status(403).json({
          error: `Operator jurisdiction '${auth.jurisdiction}' cannot resolve report for '${targetJur}'.`,
        });
      }

      try {
        const updated = resolveBarrierSlaReport(existing, {
          actorId: auth.actorId,
          role,
          officialRule: body.officialRule || {},
          resolvedAt: body.resolvedAt || new Date().toISOString(),
        });
        await store.saveReport(updated);
        await store.appendAuditLog({
          action: 'RESOLVE_BARRIER_SLA_REPORT',
          actorRef,
          role,
          jurisdiction: targetJur || 'UNSPECIFIED',
          targetId: updated.reportId,
          status: updated.verificationState,
          summary: `Resolved ${updated.reportId} (${updated.resolutionHours}h, slaMet=${updated.slaMet})`,
        });
        return res.status(200).json({ schemaVersion: BARRIER_SLA_SCHEMA_VERSION, report: updated });
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }

    return res.status(404).json({ error: 'Accessibility barrier SLA endpoint not found.' });
  };
}

export default createAccessibilityBarrierSlaHandler();
