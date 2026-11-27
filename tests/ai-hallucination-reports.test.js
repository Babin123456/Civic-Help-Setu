import { describe, it, expect, beforeEach } from 'vitest';
import { createAiHallucinationReportsHandler } from '../api/_lib/handlers/ai-hallucination-reports.js';
import {
  InMemoryHallucinationReportStore,
  resetDefaultHallucinationReportStoreForTests,
} from '../api/_lib/aiHallucinationReportStore.js';
import { createRateLimiter } from '../api/_lib/abuseGuard.js';
import { REPORT_REASON_CODES, REPORT_STATUS } from '../src/services/aiHallucinationReportService.js';

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe('AI Hallucination Reports API Handler (#1448)', () => {
  let store;

  beforeEach(() => {
    resetDefaultHallucinationReportStoreForTests();
    store = new InMemoryHallucinationReportStore();
  });

  it('enforces authentication, reporter isolation, and admin/jurisdiction authorization', async () => {
    const handler = createAiHallucinationReportsHandler({
      getStore: async () => store,
      rateLimiter: createRateLimiter({ limit: 50, windowMs: 60000 }),
      verifyActor: async (req) => {
        const auth = req.headers?.authorization;
        if (!auth) return { ok: false, status: 401, error: 'Authentication required.' };
        if (auth === 'Bearer citizen-1') return { ok: true, actorId: 'citizen-1', role: 'citizen', jurisdiction: '*' };
        if (auth === 'Bearer citizen-2') return { ok: true, actorId: 'citizen-2', role: 'citizen', jurisdiction: '*' };
        if (auth === 'Bearer admin-mh') return { ok: true, actorId: 'admin-mh', role: 'admin', jurisdiction: 'IN-MH' };
        return { ok: true, actorId: 'admin-up', role: 'admin', jurisdiction: 'IN-UP' };
      },
    });

    // 401 unauthenticated POST
    const res401 = createMockRes();
    await handler(
      { method: 'POST', url: '/api/ai-hallucination-reports/reports', headers: {}, body: {} },
      res401
    );
    expect(res401.statusCode).toBe(401);

    // 201 citizen-1 submits report
    const resCreate = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/ai-hallucination-reports/reports',
        headers: { authorization: 'Bearer citizen-1' },
        body: {
          responseId: 'resp-900',
          claimId: 'claim-900',
          serviceId: 'ration-card',
          reasonCode: REPORT_REASON_CODES.NO_SOURCE_CITED,
          claimText: 'Ration card renewal requires Rs 5000 fee.',
          sourceSnapshot: { jurisdiction: 'IN-UP' },
        },
      },
      resCreate
    );
    expect(resCreate.statusCode).toBe(201);
    const reportId = resCreate.body.report.reportId;

    // 403 citizen-2 cannot inspect citizen-1's report
    const res403Get = createMockRes();
    await handler(
      {
        method: 'GET',
        url: `/api/ai-hallucination-reports/reports/${reportId}`,
        headers: { authorization: 'Bearer citizen-2' },
      },
      res403Get
    );
    expect(res403Get.statusCode).toBe(403);

    // 403 citizen-1 cannot resolve report
    const res403Resolve = createMockRes();
    await handler(
      {
        method: 'POST',
        url: `/api/ai-hallucination-reports/reports/${reportId}/resolve`,
        headers: { authorization: 'Bearer citizen-1' },
        body: { outcome: REPORT_STATUS.CORRECTION_ISSUED, correctionNote: 'Fixed' },
      },
      res403Resolve
    );
    expect(res403Resolve.statusCode).toBe(403);

    // 403 wrong jurisdiction admin cannot resolve IN-UP report
    const res403Jurisdiction = createMockRes();
    await handler(
      {
        method: 'POST',
        url: `/api/ai-hallucination-reports/reports/${reportId}/resolve`,
        headers: { authorization: 'Bearer admin-mh' },
        body: {
          outcome: REPORT_STATUS.CORRECTION_ISSUED,
          correctionNote: 'Official UP circular confirms Rs 0 renewal fee.',
          officialSource: {
            source: 'https://fcs.up.gov.in',
            jurisdiction: 'IN-UP',
            effectiveDate: '2026-01-01',
            lastVerifiedAt: '2026-11-20T00:00:00.000Z',
          },
        },
      },
      res403Jurisdiction
    );
    expect(res403Jurisdiction.statusCode).toBe(403);

    // 200 authorized IN-UP admin resolves & exports regression fixture
    const res200Resolve = createMockRes();
    await handler(
      {
        method: 'POST',
        url: `/api/ai-hallucination-reports/reports/${reportId}/resolve`,
        headers: { authorization: 'Bearer admin-up' },
        body: {
          outcome: REPORT_STATUS.CORRECTION_ISSUED,
          correctionNote: 'Official UP circular confirms Rs 0 renewal fee.',
          officialSource: {
            source: 'https://fcs.up.gov.in',
            jurisdiction: 'IN-UP',
            effectiveDate: '2026-01-01',
            lastVerifiedAt: '2026-11-20T00:00:00.000Z',
          },
        },
      },
      res200Resolve
    );
    expect(res200Resolve.statusCode).toBe(200);
    expect(res200Resolve.body.report.status).toBe(REPORT_STATUS.CORRECTION_ISSUED);
    expect(res200Resolve.body.regressionFixture.sourceReportId).toBe(reportId);

    // Audit log check
    const resAudit = createMockRes();
    await handler(
      {
        method: 'GET',
        url: '/api/ai-hallucination-reports/audit-log',
        headers: { authorization: 'Bearer admin-up' },
      },
      resAudit
    );
    expect(resAudit.statusCode).toBe(200);
    expect(resAudit.body.entries.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects PII in report submissions', async () => {
    const handler = createAiHallucinationReportsHandler({
      getStore: async () => store,
      rateLimiter: createRateLimiter({ limit: 50, windowMs: 60000 }),
      verifyActor: async () => ({ ok: true, actorId: 'citizen-1', role: 'citizen', jurisdiction: '*' }),
    });

    const resPii = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/ai-hallucination-reports/reports',
        headers: { authorization: 'Bearer citizen-1' },
        body: {
          responseId: 'resp-1',
          claimId: 'claim-1',
          reasonCode: REPORT_REASON_CODES.NO_SOURCE_CITED,
          claimText: 'Contact 9876543210 or Aadhaar 2345 6789 0123.',
        },
      },
      resPii
    );
    expect(resPii.statusCode).toBe(400);
    expect(resPii.body.code).toBe('ERR_PII_PROHIBITED');
  });
});
