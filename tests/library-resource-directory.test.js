import { describe, it, expect, beforeEach } from 'vitest';
import { createLibraryResourceDirectoryHandler } from '../api/_lib/handlers/library-resource-directory.js';
import {
  InMemoryLibraryDirectoryStore,
  resetDefaultLibraryDirectoryStoreForTests,
} from '../api/_lib/libraryResourceDirectoryStore.js';
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

describe('Library Resource Directory API Handler (#1439)', () => {
  let store;

  beforeEach(() => {
    resetDefaultLibraryDirectoryStoreForTests();
    store = new InMemoryLibraryDirectoryStore();
  });

  it('serves filtered facilities and enforces auth, jurisdiction, PII rejection, and moderation', async () => {
    const handler = createLibraryResourceDirectoryHandler({
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
    await handler(
      { method: 'GET', url: '/api/library-resource-directory/facilities?brailleOnly=true', headers: {} },
      resGet
    );
    expect(resGet.statusCode).toBe(200);
    expect(resGet.body.facilities).toHaveLength(1);
    const facId = resGet.body.facilities[0].facilityId;

    // 400 PII rejected
    const resPii = createMockRes();
    await handler(
      {
        method: 'POST',
        url: `/api/library-resource-directory/facilities/${facId}/updates`,
        headers: { authorization: 'Bearer citizen' },
        body: { note: 'Aadhaar 2345 6789 0123 needed?' },
      },
      resPii
    );
    expect(resPii.statusCode).toBe(400);

    // 201 citizen submits update for moderation
    const resSub = createMockRes();
    await handler(
      {
        method: 'POST',
        url: `/api/library-resource-directory/facilities/${facId}/updates`,
        headers: { authorization: 'Bearer citizen' },
        body: { field: 'digitalLab', note: 'Two new Braille printers installed.' },
      },
      resSub
    );
    expect(resSub.statusCode).toBe(201);
    const updateId = resSub.body.facility.communityUpdates[0].updateId;

    // 403 citizen cannot moderate
    const res403Cit = createMockRes();
    await handler(
      {
        method: 'POST',
        url: `/api/library-resource-directory/facilities/${facId}/updates/${updateId}/moderate`,
        headers: { authorization: 'Bearer citizen' },
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
        url: `/api/library-resource-directory/facilities/${facId}/updates/${updateId}/moderate`,
        headers: { authorization: 'Bearer admin-mh' },
        body: { decision: 'approve' },
      },
      res403Jur
    );
    expect(res403Jur.statusCode).toBe(403);

    // 200 IN-UP admin approves update
    const res200 = createMockRes();
    await handler(
      {
        method: 'POST',
        url: `/api/library-resource-directory/facilities/${facId}/updates/${updateId}/moderate`,
        headers: { authorization: 'Bearer admin-up' },
        body: {
          decision: 'approve',
          officialProvenance: {
            source: 'Library Steward Verification',
            jurisdiction: 'IN-UP',
            effectiveDate: '2026-11-27',
            lastVerifiedAt: '2026-11-27T00:00:00.000Z',
          },
        },
      },
      res200
    );
    expect(res200.statusCode).toBe(200);
    expect(res200.body.facility.communityUpdates[0].moderationStatus).toBe('approved');
  });
});
