/* global process */
/**
 * api/_lib/handlers/school-defect-register.js
 *
 * Serverless API handler for Public School Infrastructure Defect & Follow-Up Register (#1437):
 *   GET  /api/school-defect-register
 *   GET  /api/school-defect-register/aggregates?wardId=&schoolId=
 *   GET  /api/school-defect-register/audit-log              (Admin-gated)
 *   POST /api/school-defect-register/reports                (Auth + zero student PII / no faces)
 *   POST /api/school-defect-register/reports/:id/moderate   (Admin-gated + jurisdiction)
 *   POST /api/school-defect-register/reports/:id/status     (Admin-gated + jurisdiction)
 */

import { createRateLimiter, clientKey } from '../abuseGuard.js';
import { bearerToken } from '../firebaseToken.js';
import { resolveRole } from '../../../src/services/roleService.js';
import {
  SCHOOL_DEFECT_SCHEMA_VERSION,
  aggregateSchoolAndWardDefects,
  createSchoolDefectReport,
  moderateSchoolDefectEvidence,
  updateSchoolDefectStatus,
  validateNoStudentPiiOrFaces,
} from '../../../src/services/schoolDefectRegisterService.js';
import { getProductionSchoolDefectStore } from '../schoolDefectRegisterStore.js';

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

export async function defaultVerifySchoolActor(req) {
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

export function createSchoolDefectRegisterHandler({
  verifyActor = defaultVerifySchoolActor,
  getStore = getProductionSchoolDefectStore,
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
      return res.status(503).json({ error: 'School defect store unavailable.' });
    }

    if (method === 'GET' && rest.length === 0) {
      return res.status(200).json({
        schemaVersion: SCHOOL_DEFECT_SCHEMA_VERSION,
        service: 'school-defect-register',
        status: 'healthy',
      });
    }

    if (method === 'GET' && rest[0] === 'aggregates' && rest.length === 1) {
      const reports = await store.listReports();
      const summary = aggregateSchoolAndWardDefects(reports, {
        wardId: query.wardId || 'all',
        schoolId: query.schoolId || 'all',
      });
      return res.status(200).json({ schemaVersion: SCHOOL_DEFECT_SCHEMA_VERSION, summary });
    }

    const auth = await verifyActor(req);
    if (!auth?.ok) {
      return res.status(auth?.status || 401).json({ error: auth?.error || 'Authentication required.' });
    }

    const role = auth.role === 'admin' ? 'admin' : 'citizen';

    if (method === 'GET' && rest[0] === 'audit-log' && rest.length === 1) {
      if (role !== 'admin') return res.status(403).json({ error: 'Admin role required for audit log.' });
      const entries = await store.listAuditLog({ limit: query.limit });
      return res.status(200).json({ schemaVersion: SCHOOL_DEFECT_SCHEMA_VERSION, entries });
    }

    const body = parseBody(req.body);
    if (!body) {
      return res.status(400).json({ error: 'Request body must be valid JSON.' });
    }

    const privacyCheck = validateNoStudentPiiOrFaces(body, 'request');
    if (!privacyCheck.valid) {
      return res.status(400).json({
        error: 'Student names, faces, minor identifiers, or PII are strictly prohibited.',
        code: 'ERR_CHILD_PRIVACY_PROHIBITED',
        details: privacyCheck.violations,
      });
    }

    if (method === 'POST' && rest[0] === 'reports' && rest.length === 1) {
      const created = createSchoolDefectReport(body, auth.actorId);
      if (!created.valid) {
        return res.status(400).json({ error: created.errors[0], details: created.errors });
      }
      await store.saveReport(created.report);
      await store.appendAuditLog({
        action: 'CREATE_SCHOOL_DEFECT_REPORT',
        actorId: auth.actorId,
        role,
        jurisdiction: created.report.jurisdiction,
        targetId: created.report.defectId,
        status: created.report.moderationStatus,
        summary: `Submitted non-identifying defect for ${created.report.schoolId}`,
      });
      return res.status(201).json({ schemaVersion: SCHOOL_DEFECT_SCHEMA_VERSION, report: created.report });
    }

    if (method === 'POST' && rest[0] === 'reports' && rest.length === 3 && rest[2] === 'moderate') {
      if (role !== 'admin') return res.status(403).json({ error: 'Admin role required to moderate evidence.' });
      if (!ID_SEGMENT.test(rest[1])) return res.status(400).json({ error: 'Invalid defectId.' });
      const existing = await store.getReport(rest[1]);
      if (!existing) return res.status(404).json({ error: 'Defect report not found.' });

      const targetJur = body.officialProvenance?.jurisdiction || existing.jurisdiction;
      if (!isJurisdictionAuthorized(auth.jurisdiction, targetJur)) {
        return res.status(403).json({
          error: `Operator jurisdiction '${auth.jurisdiction}' cannot moderate defect for '${targetJur}'.`,
        });
      }

      try {
        const updated = moderateSchoolDefectEvidence(existing, {
          decision: body.decision,
          actorId: auth.actorId,
          role,
          note: body.note,
          officialProvenance: body.officialProvenance || {},
        });
        await store.saveReport(updated);
        await store.appendAuditLog({
          action: 'MODERATE_SCHOOL_DEFECT',
          actorId: auth.actorId,
          role,
          jurisdiction: targetJur || 'UNSPECIFIED',
          targetId: updated.defectId,
          status: updated.moderationStatus,
          summary: `Moderated defect ${updated.defectId} (${body.decision})`,
        });
        return res.status(200).json({ schemaVersion: SCHOOL_DEFECT_SCHEMA_VERSION, report: updated });
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }

    if (method === 'POST' && rest[0] === 'reports' && rest.length === 3 && rest[2] === 'status') {
      if (role !== 'admin') return res.status(403).json({ error: 'Admin role required to update status.' });
      if (!ID_SEGMENT.test(rest[1])) return res.status(400).json({ error: 'Invalid defectId.' });
      const existing = await store.getReport(rest[1]);
      if (!existing) return res.status(404).json({ error: 'Defect report not found.' });

      const targetJur = body.officialProvenance?.jurisdiction || existing.jurisdiction;
      if (!isJurisdictionAuthorized(auth.jurisdiction, targetJur)) {
        return res.status(403).json({
          error: `Operator jurisdiction '${auth.jurisdiction}' cannot update defect for '${targetJur}'.`,
        });
      }

      try {
        const updated = updateSchoolDefectStatus(existing, {
          defectStatus: body.defectStatus,
          actorId: auth.actorId,
          role,
          note: body.note,
          officialProvenance: body.officialProvenance || {},
        });
        await store.saveReport(updated);
        await store.appendAuditLog({
          action: 'UPDATE_SCHOOL_DEFECT_STATUS',
          actorId: auth.actorId,
          role,
          jurisdiction: targetJur || 'UNSPECIFIED',
          targetId: updated.defectId,
          status: updated.defectStatus,
          summary: `Updated defect ${updated.defectId} status to ${updated.defectStatus}`,
        });
        return res.status(200).json({ schemaVersion: SCHOOL_DEFECT_SCHEMA_VERSION, report: updated });
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }

    return res.status(404).json({ error: 'School defect register endpoint not found.' });
  };
}

export default createSchoolDefectRegisterHandler();
