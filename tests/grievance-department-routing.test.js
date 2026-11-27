import { describe, it, expect, beforeEach } from 'vitest';
import { createGrievanceDepartmentRoutingHandler } from '../api/_lib/handlers/grievance-department-routing.js';
import {
  InMemoryGrievanceRoutingStore,
  resetDefaultGrievanceRoutingStoreForTests,
} from '../api/_lib/grievanceDepartmentRoutingStore.js';
import { createRateLimiter } from '../api/_lib/abuseGuard.js';
import { GRIEVANCE_CATEGORIES } from '../src/services/grievanceClassificationService.js';

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

describe('Grievance Department Routing API Handler (#1445)', () => {
  let store;

  beforeEach(() => {
    resetDefaultGrievanceRoutingStoreForTests();
    store = new InMemoryGrievanceRoutingStore();
  });

  it('serves per-class metrics and enforces auth, jurisdiction, PII rejection, and human override', async () => {
    const handler = createGrievanceDepartmentRoutingHandler({
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

    const resMetrics = createMockRes();
    await handler({ method: 'GET', url: '/api/grievance-department-routing/metrics', headers: {} }, resMetrics);
    expect(resMetrics.statusCode).toBe(200);
    expect(resMetrics.body.metrics.totalExamples).toBe(10);

    // 401 unauthenticated classify
    const res401 = createMockRes();
    await handler(
      { method: 'POST', url: '/api/grievance-department-routing/classify', headers: {}, body: { description: 'Pothole' } },
      res401
    );
    expect(res401.statusCode).toBe(401);

    // 400 PII rejected
    const resPii = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/grievance-department-routing/classify',
        headers: { authorization: 'Bearer citizen' },
        body: { description: 'Aadhaar 2345 6789 0123 pothole' },
      },
      resPii
    );
    expect(resPii.statusCode).toBe(400);
    expect(resPii.body.code).toBe('ERR_PII_PROHIBITED');

    // 201 classify multi-department complaint
    const resClassify = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/grievance-department-routing/classify',
        headers: { authorization: 'Bearer citizen' },
        body: { description: 'Broken road pothole and sewer overflow in Ward 14.', jurisdiction: 'IN-UP' },
      },
      resClassify
    );
    expect(resClassify.statusCode).toBe(201);
    const caseId = resClassify.body.routing.caseId;

    // 403 citizen cannot override
    const res403Citizen = createMockRes();
    await handler(
      {
        method: 'POST',
        url: `/api/grievance-department-routing/cases/${caseId}/override`,
        headers: { authorization: 'Bearer citizen' },
        body: { selectedCategories: [GRIEVANCE_CATEGORIES.ROADS_AND_INFRASTRUCTURE] },
      },
      res403Citizen
    );
    expect(res403Citizen.statusCode).toBe(403);

    // 403 wrong jurisdiction admin cannot override
    const res403Jur = createMockRes();
    await handler(
      {
        method: 'POST',
        url: `/api/grievance-department-routing/cases/${caseId}/override`,
        headers: { authorization: 'Bearer admin-mh' },
        body: { selectedCategories: [GRIEVANCE_CATEGORIES.ROADS_AND_INFRASTRUCTURE] },
      },
      res403Jur
    );
    expect(res403Jur.statusCode).toBe(403);

    // 200 authorized IN-UP admin overrides & logs
    const res200 = createMockRes();
    await handler(
      {
        method: 'POST',
        url: `/api/grievance-department-routing/cases/${caseId}/override`,
        headers: { authorization: 'Bearer admin-up' },
        body: {
          selectedCategories: [GRIEVANCE_CATEGORIES.ROADS_AND_INFRASTRUCTURE, GRIEVANCE_CATEGORIES.WATER_AND_SEWERAGE],
          rationale: 'Joint inspection required.',
        },
      },
      res200
    );
    expect(res200.statusCode).toBe(200);
    expect(res200.body.routing.status).toBe('human_confirmed');
  });
});
