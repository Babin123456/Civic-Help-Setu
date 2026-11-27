import { describe, it, expect, beforeEach } from 'vitest';
import { createTreePlantationSurvivalHandler } from '../api/_lib/handlers/tree-plantation-survival.js';
import {
  InMemoryTreePlantationStore,
  resetDefaultTreePlantationStoreForTests,
} from '../api/_lib/treePlantationSurvivalStore.js';
import { createRateLimiter } from '../api/_lib/abuseGuard.js';
import { SURVIVAL_STATUS } from '../src/services/treePlantationSurvivalService.js';

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

describe('Tree Plantation Survival API Handler (#1441)', () => {
  let store;

  beforeEach(() => {
    resetDefaultTreePlantationStoreForTests();
    store = new InMemoryTreePlantationStore();
  });

  it('serves aggregate assets and enforces auth, jurisdiction, duplicate prevention, and verification', async () => {
    const handler = createTreePlantationSurvivalHandler({
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

    const resGet = createMockRes();
    await handler({ method: 'GET', url: '/api/tree-plantation-survival/assets', headers: {} }, resGet);
    expect(resGet.statusCode).toBe(200);
    expect(resGet.body.summary.totalPlantedCount).toBe(2);

    // 403 citizen cannot register official asset
    const res403Citizen = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/tree-plantation-survival/assets',
        headers: { authorization: 'Bearer citizen' },
        body: { batchId: 'B1', species: 'Neem', steward: 'Club', wardId: 'ward-14', lat: 26.85, lng: 80.95 },
      },
      res403Citizen
    );
    expect(res403Citizen.statusCode).toBe(403);

    // 409 duplicate prevented for IN-UP admin
    const res409 = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/tree-plantation-survival/assets',
        headers: { authorization: 'Bearer admin-up' },
        body: {
          batchId: 'MONSOON-2026-W14',
          species: 'Azadirachta indica (Neem)',
          steward: 'Municipal Horticulture Wing',
          wardId: 'ward-14',
          jurisdiction: 'IN-UP',
          lat: 26.847,
          lng: 80.946,
        },
      },
      res409
    );
    expect(res409.statusCode).toBe(409);
    expect(res409.body.code).toBe('ERR_DUPLICATE_GREEN_ASSET');

    // 201 register new geotagged asset
    const res201 = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/tree-plantation-survival/assets',
        headers: { authorization: 'Bearer admin-up' },
        body: {
          batchId: 'WINTER-2026-W14',
          species: 'Mangifera indica (Mango)',
          steward: 'Municipal Horticulture Wing',
          wardId: 'ward-14',
          jurisdiction: 'IN-UP',
          lat: 26.852,
          lng: 80.951,
        },
      },
      res201
    );
    expect(res201.statusCode).toBe(201);
    const assetId = res201.body.asset.assetId;

    // 201 citizen appends evidence
    const resEv = createMockRes();
    await handler(
      {
        method: 'POST',
        url: `/api/tree-plantation-survival/assets/${assetId}/evidence`,
        headers: { authorization: 'Bearer citizen' },
        body: { note: 'Sapling thriving with tree guard.' },
      },
      resEv
    );
    expect(resEv.statusCode).toBe(201);

    // 403 wrong jurisdiction admin cannot verify
    const res403Jur = createMockRes();
    await handler(
      {
        method: 'POST',
        url: `/api/tree-plantation-survival/assets/${assetId}/verify`,
        headers: { authorization: 'Bearer admin-mh' },
        body: { survivalStatus: SURVIVAL_STATUS.VERIFIED_SURVIVING },
      },
      res403Jur
    );
    expect(res403Jur.statusCode).toBe(403);

    // 200 IN-UP admin verifies survival
    const resVerify = createMockRes();
    await handler(
      {
        method: 'POST',
        url: `/api/tree-plantation-survival/assets/${assetId}/verify`,
        headers: { authorization: 'Bearer admin-up' },
        body: {
          survivalStatus: SURVIVAL_STATUS.VERIFIED_SURVIVING,
          officialSource: {
            source: 'LMC Horticulture Audit #22',
            jurisdiction: 'IN-UP',
            effectiveDate: '2026-11-22',
            lastVerifiedAt: '2026-11-22T00:00:00.000Z',
          },
        },
      },
      resVerify
    );
    expect(resVerify.statusCode).toBe(200);
    expect(resVerify.body.asset.survivalStatus).toBe(SURVIVAL_STATUS.VERIFIED_SURVIVING);
  });
});
