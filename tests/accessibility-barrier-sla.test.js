import { describe, it, expect, beforeEach } from 'vitest';
import { createAccessibilityBarrierSlaHandler } from '../api/_lib/handlers/accessibility-barrier-sla.js';
import {
  InMemoryBarrierSlaStore,
  resetDefaultBarrierSlaStoreForTests,
} from '../api/_lib/accessibilityBarrierSlaStore.js';
import { createRateLimiter } from '../api/_lib/abuseGuard.js';
import { BARRIER_CATEGORIES } from '../src/services/accessibilityBarrierSlaService.js';

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

describe('Accessibility Barrier SLA API Handler (#1443)', () => {
  let store;

  beforeEach(() => {
    resetDefaultBarrierSlaStoreForTests();
    store = new InMemoryBarrierSlaStore();
  });

  it('serves aggregate SLA summary with small-group suppression and enforces auth, jurisdiction, and PII checks', async () => {
    const handler = createAccessibilityBarrierSlaHandler({
      getStore: async () => store,
      rateLimiter: createRateLimiter({ limit: 50, windowMs: 60000 }),
      verifyActor: async (req) => {
        const auth = req.headers?.authorization;
        if (!auth) return { ok: false, status: 401, error: 'Authentication required.' };
        if (auth === 'Bearer citizen') return { ok: true, actorId: 'c-1', role: 'citizen', jurisdiction: '*' };
        if (auth === 'Bearer admin-mh') return { ok: true, actorId: 'op-mh', role: 'admin', jurisdiction: 'IN-MH' };
        return { ok: true, actorId: 'op-up', role: 'admin', jurisdiction: 'IN-UP' };
      },
    });

    const resSummary = createMockRes();
    await handler({ method: 'GET', url: '/api/accessibility-barrier-sla/summary', headers: {} }, resSummary);
    expect(resSummary.statusCode).toBe(200);
    expect(resSummary.body.summary.suppressedGroupCount).toBe(1);

    // 401 unauthenticated POST
    const res401 = createMockRes();
    await handler(
      { method: 'POST', url: '/api/accessibility-barrier-sla/reports', headers: {}, body: {} },
      res401
    );
    expect(res401.statusCode).toBe(401);

    // 400 PII rejected
    const resPii = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/accessibility-barrier-sla/reports',
        headers: { authorization: 'Bearer citizen' },
        body: {
          category: BARRIER_CATEGORIES.RAMP_MISSING_OR_BLOCKED,
          wardId: 'ward-14',
          facilityId: 'gate-1',
          summary: 'Aadhaar 2345 6789 0123 ramp blocked.',
        },
      },
      resPii
    );
    expect(resPii.statusCode).toBe(400);
    expect(resPii.body.code).toBe('ERR_PII_PROHIBITED');

    // 201 citizen submits anonymized barrier report
    const resCreate = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/accessibility-barrier-sla/reports',
        headers: { authorization: 'Bearer citizen' },
        body: {
          category: BARRIER_CATEGORIES.RAMP_MISSING_OR_BLOCKED,
          wardId: 'ward-14',
          facilityId: 'tehsil-office-gate',
          jurisdiction: 'IN-UP',
          summary: 'Wheelchair ramp blocked by parked vehicles.',
        },
      },
      resCreate
    );
    expect(resCreate.statusCode).toBe(201);
    const reportId = resCreate.body.report.reportId;

    // 403 citizen cannot resolve
    const res403Citizen = createMockRes();
    await handler(
      {
        method: 'POST',
        url: `/api/accessibility-barrier-sla/reports/${reportId}/resolve`,
        headers: { authorization: 'Bearer citizen' },
        body: {},
      },
      res403Citizen
    );
    expect(res403Citizen.statusCode).toBe(403);

    // 403 wrong jurisdiction admin cannot resolve
    const res403Jur = createMockRes();
    await handler(
      {
        method: 'POST',
        url: `/api/accessibility-barrier-sla/reports/${reportId}/resolve`,
        headers: { authorization: 'Bearer admin-mh' },
        body: {},
      },
      res403Jur
    );
    expect(res403Jur.statusCode).toBe(403);

    // 200 IN-UP admin verifies & resolves
    const res200 = createMockRes();
    await handler(
      {
        method: 'POST',
        url: `/api/accessibility-barrier-sla/reports/${reportId}/resolve`,
        headers: { authorization: 'Bearer admin-up' },
        body: {
          officialRule: {
            source: 'UP PWD Accessibility Circular',
            jurisdiction: 'IN-UP',
            effectiveDate: '2026-01-01',
            lastVerifiedAt: '2026-11-20T00:00:00.000Z',
          },
        },
      },
      res200
    );
    expect(res200.statusCode).toBe(200);
    expect(res200.body.report.verificationState).toBe('verified');
  });
});
