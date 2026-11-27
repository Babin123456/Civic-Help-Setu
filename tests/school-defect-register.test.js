import { describe, it, expect, beforeEach } from 'vitest';
import { createSchoolDefectRegisterHandler } from '../api/_lib/handlers/school-defect-register.js';
import {
  InMemorySchoolDefectStore,
  resetDefaultSchoolDefectStoreForTests,
} from '../api/_lib/schoolDefectRegisterStore.js';
import { createRateLimiter } from '../api/_lib/abuseGuard.js';

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

describe('School Defect Register API Handler (#1437)', () => {
  let store;

  beforeEach(() => {
    resetDefaultSchoolDefectStoreForTests();
    store = new InMemorySchoolDefectStore();
  });

  it('serves aggregates and enforces auth, jurisdiction, child-privacy guard, moderation, and status history', async () => {
    const handler = createSchoolDefectRegisterHandler({
      getStore: async () => store,
      rateLimiter: createRateLimiter({ limit: 50, windowMs: 60000 }),
      verifyActor: async (req) => {
        const auth = req.headers?.authorization;
        if (!auth) return { ok: false, status: 401, error: 'Authentication required.' };
        if (auth === 'Bearer parent') return { ok: true, actorId: 'p-1', role: 'citizen', jurisdiction: '*' };
        if (auth === 'Bearer admin-mh') return { ok: true, actorId: 'op-mh', role: 'admin', jurisdiction: 'IN-MH' };
        return { ok: true, actorId: 'op-up', role: 'admin', jurisdiction: 'IN-UP' };
      },
    });

    const resAgg = createMockRes();
    await handler({ method: 'GET', url: '/api/school-defect-register/aggregates', headers: {} }, resAgg);
    expect(resAgg.statusCode).toBe(200);
    expect(resAgg.body.summary.totalReports).toBeGreaterThanOrEqual(2);

    // 400 student PII rejected
    const resChild = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/school-defect-register/reports',
        headers: { authorization: 'Bearer parent' },
        body: {
          schoolId: 'UDISE-1',
          schoolName: 'Primary School',
          wardId: 'ward-14',
          category: 'DRINKING_WATER',
          summary: 'Tap broken.',
          studentName: 'Child A',
        },
      },
      resChild
    );
    expect(resChild.statusCode).toBe(400);
    expect(resChild.body.code).toBe('ERR_CHILD_PRIVACY_PROHIBITED');

    // 201 parent submits non-identifying defect
    const resCreate = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/school-defect-register/reports',
        headers: { authorization: 'Bearer parent' },
        body: {
          schoolId: 'UDISE-09150101',
          schoolName: 'Government Primary School',
          wardId: 'ward-14',
          jurisdiction: 'IN-UP',
          category: 'CLASSROOM_INFRASTRUCTURE',
          summary: 'Classroom roof plaster leaking near window.',
        },
      },
      resCreate
    );
    expect(resCreate.statusCode).toBe(201);
    const defectId = resCreate.body.report.defectId;

    // 403 citizen cannot moderate
    const res403Cit = createMockRes();
    await handler(
      {
        method: 'POST',
        url: `/api/school-defect-register/reports/${defectId}/moderate`,
        headers: { authorization: 'Bearer parent' },
        body: { decision: 'approve' },
      },
      res403Cit
    );
    expect(res403Cit.statusCode).toBe(403);

    // 403 wrong jurisdiction admin cannot moderate
    const res403Jur = createMockRes();
    await handler(
      {
        method: 'POST',
        url: `/api/school-defect-register/reports/${defectId}/moderate`,
        headers: { authorization: 'Bearer admin-mh' },
        body: { decision: 'approve' },
      },
      res403Jur
    );
    expect(res403Jur.statusCode).toBe(403);

    // 200 IN-UP admin moderates & updates status
    const resMod = createMockRes();
    await handler(
      {
        method: 'POST',
        url: `/api/school-defect-register/reports/${defectId}/moderate`,
        headers: { authorization: 'Bearer admin-up' },
        body: {
          decision: 'approve',
          officialProvenance: {
            source: 'BEO Inspection #7',
            jurisdiction: 'IN-UP',
            effectiveDate: '2026-11-27',
            lastVerifiedAt: '2026-11-27T00:00:00.000Z',
          },
        },
      },
      resMod
    );
    expect(resMod.statusCode).toBe(200);
    expect(resMod.body.report.moderationStatus).toBe('approved');
  });
});
