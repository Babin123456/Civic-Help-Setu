import { describe, it, expect, beforeEach } from 'vitest';
import { createParkMaintenanceScheduleHandler } from '../api/_lib/handlers/park-maintenance-schedule.js';
import {
  InMemoryParkScheduleStore,
  resetDefaultParkScheduleStoreForTests,
} from '../api/_lib/parkMaintenanceScheduleStore.js';
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

describe('Park Maintenance Schedule API Handler (#1440)', () => {
  let store;

  beforeEach(() => {
    resetDefaultParkScheduleStoreForTests();
    store = new InMemoryParkScheduleStore();
  });

  it('lists parks and enforces auth, jurisdiction, maintenance publishing, and photo moderation', async () => {
    const handler = createParkMaintenanceScheduleHandler({
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
    await handler({ method: 'GET', url: '/api/park-maintenance-schedule/parks', headers: {} }, resGet);
    expect(resGet.statusCode).toBe(200);
    const parkId = resGet.body.parks[0].parkId;

    // 403 citizen cannot publish official maintenance window
    const res403Citizen = createMockRes();
    await handler(
      {
        method: 'POST',
        url: `/api/park-maintenance-schedule/parks/${parkId}/maintenance-windows`,
        headers: { authorization: 'Bearer citizen' },
        body: { amenityType: 'play_area', reason: 'Painting swings' },
      },
      res403Citizen
    );
    expect(res403Citizen.statusCode).toBe(403);

    // 403 wrong jurisdiction admin cannot publish
    const res403Jur = createMockRes();
    await handler(
      {
        method: 'POST',
        url: `/api/park-maintenance-schedule/parks/${parkId}/maintenance-windows`,
        headers: { authorization: 'Bearer admin-mh' },
        body: { amenityType: 'play_area', reason: 'Painting swings' },
      },
      res403Jur
    );
    expect(res403Jur.statusCode).toBe(403);

    // 201 IN-UP admin publishes temporary closure
    const res201Win = createMockRes();
    await handler(
      {
        method: 'POST',
        url: `/api/park-maintenance-schedule/parks/${parkId}/maintenance-windows`,
        headers: { authorization: 'Bearer admin-up' },
        body: {
          amenityType: 'play_area',
          reason: 'Resurfacing play mat.',
          isTemporaryClosure: true,
          officialSource: {
            source: 'LMC Parks Order #88',
            jurisdiction: 'IN-UP',
            effectiveDate: '2026-11-27',
            lastVerifiedAt: '2026-11-27T00:00:00.000Z',
          },
        },
      },
      res201Win
    );
    expect(res201Win.statusCode).toBe(201);

    // 400 photo with unstripped EXIF / faces blocked
    const resBlockedPhoto = createMockRes();
    await handler(
      {
        method: 'POST',
        url: `/api/park-maintenance-schedule/parks/${parkId}/observations`,
        headers: { authorization: 'Bearer citizen' },
        body: {
          amenityType: 'drinking_water',
          note: 'Water tap working.',
          photoRef: 'photo-raw-1',
          exifStripped: false,
        },
      },
      resBlockedPhoto
    );
    expect(resBlockedPhoto.statusCode).toBe(400);

    // 201 clean moderated observation accepted
    const resCleanObs = createMockRes();
    await handler(
      {
        method: 'POST',
        url: `/api/park-maintenance-schedule/parks/${parkId}/observations`,
        headers: { authorization: 'Bearer citizen' },
        body: {
          amenityType: 'drinking_water',
          note: 'Water tap working cleanly.',
          photoRef: 'photo-clean-1',
          exifStripped: true,
          containsFacesOrPlates: false,
        },
      },
      resCleanObs
    );
    expect(resCleanObs.statusCode).toBe(201);
  });
});
