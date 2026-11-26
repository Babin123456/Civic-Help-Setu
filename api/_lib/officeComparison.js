/**
 * Deterministic civic-office comparison endpoint (#824).
 *
 * Public:
 *   GET  /api/office-comparison?serviceId=birth-certificate&state=Delhi&page=1
 *   POST /api/office-comparison              — report an outdated office record
 *
 * Administrator only (Clerk bearer session with the admin role):
 *   GET  /api/office-comparison?review=pending
 *   PATCH /api/office-comparison             — resolve or reject a report
 *
 * The ranking is the same pure function the browser uses. This module exports a
 * factory so authorization and clock behaviour can be tested without Clerk,
 * Firebase or a running server.
 */

import { CIVIC_OFFICES } from '../../src/data/locationOffices.js';
import {
  OFFICE_COMPARISON_DATA_VERSION,
  getCatalogService,
  getOfficeComparisonRecord,
  rankOfficeComparisonRecords,
  validateComparisonQuery,
} from '../../src/services/officeComparisonService.js';
import { validateOfficeReport } from '../../src/services/officeComparisonReportService.js';
import { bearerToken } from './firebaseToken.js';
import { clientKey, createRateLimiter } from './abuseGuard.js';

export const OFFICE_REPORT_QUEUE = [];
export const OFFICE_REVIEW_AUDIT = [];

const reportLimiter = createRateLimiter({ limit: 20, windowMs: 60_000 });

const json = (status, body, extra = {}) => ({
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
  body,
});

const toIso = (now) => new Date(now).toISOString();

const generateReportSeal = (officeId, timestamp) => {
  const seed = `${officeId}|${timestamp}|CIVIC_OFFICE_COMPARISON_v1`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  const unsigned = hash >>> 0;
  const first = (unsigned & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  const second = ((unsigned >>> 16) & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  return `OFFICE-SEAL-${first}-${second}`;
};

const toPublicRecord = (record) => {
  if (!record) return null;
  const publicRecord = { ...record };
  delete publicRecord.raw;
  return publicRecord;
};

const authorizeAdmin = async (headers, verifySession) => {
  if (typeof verifySession !== 'function') {
    return { ok: false, status: 503, body: { error: 'auth_not_configured' } };
  }
  const token = bearerToken(headers || {});
  if (!token) return { ok: false, status: 401, body: { error: 'missing_token' } };

  try {
    const session = await verifySession(token);
    if (!session || typeof session.userId !== 'string' || !session.userId) {
      return { ok: false, status: 401, body: { error: 'invalid_token' } };
    }
    if (session.role !== 'admin') {
      return { ok: false, status: 403, body: { error: 'admin_role_required' } };
    }
    return { ok: true, userId: session.userId };
  } catch {
    return { ok: false, status: 401, body: { error: 'invalid_token' } };
  }
};

const publicReviewQueue = () =>
  OFFICE_REPORT_QUEUE.filter((report) => report.status === 'pending_review').slice(-50);

export const createOfficeComparisonHandler = ({
  verifySession = null,
  now = () => Date.now(),
} = {}) => {
  return async function handle({ method = 'GET', query = {}, body = {}, headers = {} } = {}) {
    if (method === 'GET') {
      if (query.review === 'pending') {
        const authorization = await authorizeAdmin(headers, verifySession);
        if (!authorization.ok) return json(authorization.status, authorization.body);
        return json(200, {
          ok: true,
          dataVersion: OFFICE_COMPARISON_DATA_VERSION,
          pendingCount: publicReviewQueue().length,
          items: publicReviewQueue(),
        });
      }

      const validation = validateComparisonQuery({
        ...query,
        serviceId: query.serviceId || query.service,
      });
      if (!validation.valid) {
        return json(400, { error: 'validation_failed', details: validation.errors });
      }

      const service = getCatalogService(validation.value.serviceId);
      if (!service) {
        return json(400, { error: 'unknown_service', serviceId: validation.value.serviceId });
      }

      try {
        const ranked = rankOfficeComparisonRecords({
          service,
          offices: CIVIC_OFFICES,
          ...validation.value,
          now: now(),
        });

        return json(200, {
          ok: true,
          dataVersion: ranked.dataVersion,
          generatedAt: ranked.generatedAt,
          service: ranked.service,
          page: ranked.page,
          pageSize: ranked.pageSize,
          total: ranked.total,
          totalPages: ranked.totalPages,
          aggregation: ranked.aggregation,
          results: ranked.results.map(toPublicRecord),
        });
      } catch {
        return json(500, { error: 'ranking_failed' });
      }
    }

    if (method === 'POST') {
      const address = clientKey(headers);
      if (address) {
        const verdict = reportLimiter.take(address);
        if (!verdict.allowed) {
          return json(
            429,
            { error: 'rate_limited', retryAfterSeconds: verdict.retryAfterSeconds },
            { 'Retry-After': String(verdict.retryAfterSeconds) }
          );
        }
      }

      const validation = validateOfficeReport(body);
      if (!validation.valid) {
        return json(400, { error: 'validation_failed', details: validation.errors });
      }

      if (!getOfficeComparisonRecord(validation.value.officeId)) {
        return json(404, { error: 'office_not_found', officeId: validation.value.officeId });
      }

      const timestamp = toIso(now());
      const reportId = `office_report_${now()}_${Math.random().toString(36).slice(2, 8)}`;
      const verificationSeal = generateReportSeal(validation.value.officeId, timestamp);
      const entry = {
        id: reportId,
        officeId: validation.value.officeId,
        reason: validation.value.reason,
        note: validation.value.note,
        sourceUrl: validation.value.sourceUrl,
        status: 'pending_review',
        submittedAt: timestamp,
        verificationSeal,
      };
      OFFICE_REPORT_QUEUE.push(entry);
      if (OFFICE_REPORT_QUEUE.length > 200) OFFICE_REPORT_QUEUE.splice(0, OFFICE_REPORT_QUEUE.length - 200);

      return json(201, {
        ok: true,
        reportId,
        verificationSeal,
        status: 'pending_review',
        submittedAt: timestamp,
        message: 'Outdated-record report received for administrator review.',
      });
    }

    if (method === 'PATCH') {
      const authorization = await authorizeAdmin(headers, verifySession);
      if (!authorization.ok) return json(authorization.status, authorization.body);

      const reportId = typeof body.reportId === 'string' ? body.reportId.trim() : '';
      const status = typeof body.status === 'string' ? body.status.trim() : '';
      if (!reportId) return json(400, { error: 'validation_failed', details: ['reportId is required.'] });
      if (!['resolved', 'rejected'].includes(status)) {
        return json(400, {
          error: 'validation_failed',
          details: ['status must be resolved or rejected.'],
        });
      }

      const report = OFFICE_REPORT_QUEUE.find((entry) => entry.id === reportId);
      if (!report) return json(404, { error: 'report_not_found' });

      const reviewedAt = toIso(now());
      report.status = status;
      report.reviewedBy = authorization.userId;
      report.reviewedAt = reviewedAt;
      report.reviewNote =
        typeof body.reviewNote === 'string' ? body.reviewNote.trim().slice(0, 500) : '';

      OFFICE_REVIEW_AUDIT.push({
        action: 'office_report_reviewed',
        reportId,
        officeId: report.officeId,
        actorId: authorization.userId,
        status,
        reviewedAt,
        dataVersion: OFFICE_COMPARISON_DATA_VERSION,
      });

      return json(200, {
        ok: true,
        reportId,
        status,
        reviewedAt,
        message: 'Report review recorded in the audit trail.',
      });
    }

    return json(405, { error: 'method_not_allowed' }, { Allow: 'GET, POST, PATCH' });
  };
};
