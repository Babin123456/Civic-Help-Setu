/* global process */
/**
 * api/_lib/handlers/ai-hallucination-reports.js
 *
 * Serverless API handler for Civic AI Hallucination & Unsupported-Claim Reporting (#1448):
 *   GET  /api/ai-hallucination-reports
 *   GET  /api/ai-hallucination-reports/regression-fixtures
 *   GET  /api/ai-hallucination-reports/reports                (Auth required: admin sees all; citizen sees own anonymized)
 *   GET  /api/ai-hallucination-reports/reports/:reportId      (Auth required: owner or admin)
 *   GET  /api/ai-hallucination-reports/audit-log              (Admin-gated)
 *   POST /api/ai-hallucination-reports/reports                (Auth required: citizen or admin)
 *   POST /api/ai-hallucination-reports/reports/:id/withdraw   (Owner or admin)
 *   POST /api/ai-hallucination-reports/reports/:id/resolve    (Admin-gated + jurisdiction check)
 */

import { createRateLimiter, createSingleFlight, clientKey } from '../abuseGuard.js';
import { bearerToken } from '../firebaseToken.js';
import { resolveRole } from '../../../src/services/roleService.js';
import {
  HALLUCINATION_REPORT_SCHEMA_VERSION,
  anonymizeReporterId,
  createHallucinationReport,
  withdrawHallucinationReport,
  resolveHallucinationReport,
  validateZeroPiiPayload,
} from '../../../src/services/aiHallucinationReportService.js';
import { getProductionHallucinationReportStore } from '../aiHallucinationReportStore.js';

const ID_SEGMENT = /^[a-z0-9][a-z0-9_-]{1,127}$/i;
const defaultRateLimiter = createRateLimiter({ limit: 30, windowMs: 60 * 1000 });
const defaultSingleFlight = createSingleFlight();

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
    if (eq === -1) {
      q[decodeURIComponent(pair)] = '';
    } else {
      q[decodeURIComponent(pair.slice(0, eq))] = decodeURIComponent(pair.slice(eq + 1));
    }
  }
  return q;
}

export async function defaultVerifyActor(req) {
  const token = bearerToken(req.headers || {});
  if (!token) return { ok: false, status: 401, error: 'Authentication required.' };

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    return { ok: false, status: 503, error: 'Authentication service is not configured.' };
  }

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
  if (!targetJurisdiction || targetJurisdiction === 'UNSPECIFIED') return true;
  return operatorJurisdiction.toLowerCase() === String(targetJurisdiction).trim().toLowerCase();
}

export function createAiHallucinationReportsHandler({
  verifyActor = defaultVerifyActor,
  getStore = getProductionHallucinationReportStore,
  rateLimiter = defaultRateLimiter,
  singleFlight = defaultSingleFlight,
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
      return res.status(429).json({
        error: 'Rate limit exceeded. Please retry later.',
        code: 'ERR_RATE_LIMIT',
      });
    }

    let store;
    try {
      store = await getStore();
    } catch {
      return res.status(503).json({ error: 'Hallucination report store unavailable.' });
    }

    if (method === 'GET' && rest.length === 0) {
      return res.status(200).json({
        schemaVersion: HALLUCINATION_REPORT_SCHEMA_VERSION,
        service: 'ai-hallucination-reports',
        status: 'healthy',
      });
    }

    if (method === 'GET' && rest[0] === 'regression-fixtures' && rest.length === 1) {
      const fixtures = await store.listRegressionFixtures({ limit: query.limit });
      return res.status(200).json({
        schemaVersion: HALLUCINATION_REPORT_SCHEMA_VERSION,
        fixtures,
      });
    }

    // All report and audit routes require verified authentication
    const auth = await verifyActor(req);
    if (!auth?.ok) {
      return res.status(auth?.status || 401).json({ error: auth?.error || 'Authentication required.' });
    }

    const actorRef = anonymizeReporterId(auth.actorId);
    const role = auth.role === 'admin' ? 'admin' : 'citizen';

    if (method === 'GET' && rest[0] === 'audit-log' && rest.length === 1) {
      if (role !== 'admin') {
        return res.status(403).json({ error: 'Admin reviewer role required for audit logs.' });
      }
      const entries = await store.listAuditLog({ limit: query.limit });
      return res.status(200).json({ schemaVersion: HALLUCINATION_REPORT_SCHEMA_VERSION, entries });
    }

    if (method === 'GET' && rest[0] === 'reports' && rest.length === 1) {
      const reports = await store.listReports({
        status: query.status || null,
        riskLevel: query.riskLevel || null,
        reporterRef: role === 'admin' ? null : actorRef,
        limit: query.limit,
      });
      return res.status(200).json({ schemaVersion: HALLUCINATION_REPORT_SCHEMA_VERSION, reports });
    }

    if (method === 'GET' && rest[0] === 'reports' && rest.length === 2) {
      if (!ID_SEGMENT.test(rest[1])) {
        return res.status(400).json({ error: 'Invalid reportId format.' });
      }
      const report = await store.getReport(rest[1]);
      if (!report) return res.status(404).json({ error: 'Report not found.' });
      if (role !== 'admin' && report.reporterRef !== actorRef) {
        return res.status(403).json({ error: 'Forbidden: cannot inspect another reporter receipt.' });
      }
      return res.status(200).json({ schemaVersion: HALLUCINATION_REPORT_SCHEMA_VERSION, report });
    }

    const body = parseBody(req.body);
    if (!body) {
      return res.status(400).json({ error: 'Request body must be valid JSON.' });
    }

    const piiCheck = validateZeroPiiPayload(body, 'request');
    if (!piiCheck.valid) {
      return res.status(400).json({
        error: 'PII or sensitive credentials are strictly prohibited.',
        code: 'ERR_PII_PROHIBITED',
        details: piiCheck.violations,
      });
    }

    if (method === 'POST' && rest[0] === 'reports' && rest.length === 1) {
      const created = createHallucinationReport(body, auth.actorId);
      if (!created.valid) {
        return res.status(400).json({
          error: 'Invalid hallucination report payload.',
          details: created.errors,
        });
      }

      const flightKey = `hal:${actorRef}:${created.report.telemetry.responseId}:${created.report.telemetry.claimId}`;
      const saved = await singleFlight.run(flightKey, async () => {
        await store.saveReport(created.report);
        await store.appendAuditLog({
          action: 'SUBMIT_HALLUCINATION_REPORT',
          actorRef,
          role,
          jurisdiction: created.report.sourceSnapshot.jurisdiction,
          targetId: created.report.reportId,
          status: created.report.riskLevel,
          summary: `Report ${created.report.reportId} routed to ${created.report.routedTo}`,
        });
        return created.report;
      });

      return res.status(201).json({ schemaVersion: HALLUCINATION_REPORT_SCHEMA_VERSION, report: saved });
    }

    if (method === 'POST' && rest[0] === 'reports' && rest.length === 3 && rest[2] === 'withdraw') {
      if (!ID_SEGMENT.test(rest[1])) {
        return res.status(400).json({ error: 'Invalid reportId format.' });
      }
      const existing = await store.getReport(rest[1]);
      if (!existing) return res.status(404).json({ error: 'Report not found.' });

      try {
        const updated = withdrawHallucinationReport(existing, {
          actorId: auth.actorId,
          role,
          reason: body.reason || '',
        });
        await store.saveReport(updated);
        await store.appendAuditLog({
          action: 'WITHDRAW_HALLUCINATION_REPORT',
          actorRef,
          role,
          jurisdiction: updated.sourceSnapshot.jurisdiction,
          targetId: updated.reportId,
          status: updated.status,
          summary: `Report ${updated.reportId} withdrawn`,
        });
        return res.status(200).json({ schemaVersion: HALLUCINATION_REPORT_SCHEMA_VERSION, report: updated });
      } catch (err) {
        const statusCode = /Forbidden/i.test(err.message) ? 403 : 400;
        return res.status(statusCode).json({ error: err.message });
      }
    }

    if (method === 'POST' && rest[0] === 'reports' && rest.length === 3 && rest[2] === 'resolve') {
      if (role !== 'admin') {
        return res.status(403).json({ error: 'Admin reviewer role required to resolve reports.' });
      }
      if (!ID_SEGMENT.test(rest[1])) {
        return res.status(400).json({ error: 'Invalid reportId format.' });
      }
      const existing = await store.getReport(rest[1]);
      if (!existing) return res.status(404).json({ error: 'Report not found.' });

      const targetJurisdiction =
        body.officialSource?.jurisdiction || existing.sourceSnapshot?.jurisdiction;
      if (!isJurisdictionAuthorized(auth.jurisdiction, targetJurisdiction)) {
        return res.status(403).json({
          error: `Reviewer jurisdiction '${auth.jurisdiction}' cannot resolve report for '${targetJurisdiction}'.`,
        });
      }

      try {
        const { report: updated, fixture } = resolveHallucinationReport(existing, {
          actorId: auth.actorId,
          outcome: body.outcome,
          correctionNote: body.correctionNote,
          officialSource: body.officialSource || {},
          exportFixture: body.exportFixture !== false,
        });
        await store.saveReport(updated);
        if (fixture) {
          await store.saveRegressionFixture(fixture);
        }
        await store.appendAuditLog({
          action: 'RESOLVE_HALLUCINATION_REPORT',
          actorRef,
          role,
          jurisdiction: targetJurisdiction || 'UNSPECIFIED',
          targetId: updated.reportId,
          status: updated.status,
          summary: `Report ${updated.reportId} resolved as ${updated.status}${fixture ? ` (fixture ${fixture.id})` : ''}`,
        });
        return res.status(200).json({
          schemaVersion: HALLUCINATION_REPORT_SCHEMA_VERSION,
          report: updated,
          regressionFixture: fixture,
        });
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }

    return res.status(404).json({ error: 'Hallucination reporting endpoint not found.' });
  };
}

export default createAiHallucinationReportsHandler();
