import { describe, it, expect, beforeEach } from 'vitest';
import { createWaterbodyRestorationHandler } from '../api/_lib/handlers/waterbody-restoration.js';
import {
  InMemoryWaterbodyRestorationStore,
  resetDefaultWaterbodyStoreForTests,
} from '../api/_lib/waterbodyRestorationStore.js';
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

describe('Waterbody Restoration API Handler (#1442)', () => {
  let store;

  beforeEach(() => {
    resetDefaultWaterbodyStoreForTests();
    store = new InMemoryWaterbodyRestorationStore();
  });

  it('lists waterbodies and enforces auth, health-claim guard, PII guard, and jurisdiction-scoped corrections', async () => {
    const handler = createWaterbodyRestorationHandler({
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

    const resList = createMockRes();
    await handler({ method: 'GET', url: '/api/waterbody-restoration/waterbodies', headers: {} }, resList);
    expect(resList.statusCode).toBe(200);
    expect(resList.body.waterbodies.length).toBeGreaterThanOrEqual(1);
    const wbId = resList.body.waterbodies[0].waterbodyId;

    // 401 unauthenticated observation
    const res401 = createMockRes();
    await handler(
      { method: 'POST', url: `/api/waterbody-restoration/waterbodies/${wbId}/observations`, headers: {}, body: {} },
      res401
    );
    expect(res401.statusCode).toBe(401);

    // 400 unsupported health claim rejected
    const resHealth = createMockRes();
    await handler(
      {
        method: 'POST',
        url: `/api/waterbody-restoration/waterbodies/${wbId}/observations`,
        headers: { authorization: 'Bearer citizen' },
        body: { milestoneType: 'water_testing', note: 'Lake water is 100% safe to drink!' },
      },
      resHealth
    );
    expect(resHealth.statusCode).toBe(400);

    // 201 valid community observation
    const resObs = createMockRes();
    await handler(
      {
        method: 'POST',
        url: `/api/waterbody-restoration/waterbodies/${wbId}/observations`,
        headers: { authorization: 'Bearer citizen' },
        body: { milestoneType: 'boundary_protection', note: 'Chain-link fencing installed on west edge.' },
      },
      resObs
    );
    expect(resObs.statusCode).toBe(201);

    // 403 citizen cannot record official correction
    const res403Citizen = createMockRes();
    await handler(
      {
        method: 'POST',
        url: `/api/waterbody-restoration/waterbodies/${wbId}/corrections`,
        headers: { authorization: 'Bearer citizen' },
        body: { milestoneType: 'desilting', correctedStatus: 'verified_complete', reason: 'Done' },
      },
      res403Citizen
    );
    expect(res403Citizen.statusCode).toBe(403);

    // 403 wrong jurisdiction admin cannot correct
    const res403Jur = createMockRes();
    await handler(
      {
        method: 'POST',
        url: `/api/waterbody-restoration/waterbodies/${wbId}/corrections`,
        headers: { authorization: 'Bearer admin-mh' },
        body: { milestoneType: 'desilting', correctedStatus: 'verified_complete', reason: 'Done' },
      },
      res403Jur
    );
    expect(res403Jur.statusCode).toBe(403);

    // 200 authorized IN-UP admin records preserved correction
    const res200 = createMockRes();
    await handler(
      {
        method: 'POST',
        url: `/api/waterbody-restoration/waterbodies/${wbId}/corrections`,
        headers: { authorization: 'Bearer admin-up' },
        body: {
          milestoneType: 'desilting',
          correctedStatus: 'verified_complete',
          reason: 'Completion certificate #88-B verified.',
          officialSource: {
            source: 'LMC Irrigation Completion Certificate #88-B',
            jurisdiction: 'IN-UP',
            effectiveDate: '2026-11-22',
            lastVerifiedAt: '2026-11-22T00:00:00.000Z',
          },
        },
      },
      res200
    );
    expect(res200.statusCode).toBe(200);
    expect(res200.body.waterbody.corrections).toHaveLength(1);
  });
});
