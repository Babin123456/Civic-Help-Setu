import { describe, it, expect, beforeEach } from 'vitest';
import { createAnganwadiCalendarHandler } from '../api/_lib/handlers/anganwadi-calendar.js';
import {
  InMemoryAnganwadiCalendarStore,
  resetDefaultAnganwadiCalendarStoreForTests,
} from '../api/_lib/anganwadiCalendarStore.js';
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

describe('Anganwadi Calendar API Handler (#1438)', () => {
  let store;

  beforeEach(() => {
    resetDefaultAnganwadiCalendarStoreForTests();
    store = new InMemoryAnganwadiCalendarStore();
  });

  it('serves centres and enforces auth, jurisdiction, child-health-data guard, and schedule publishing', async () => {
    const handler = createAnganwadiCalendarHandler({
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
    await handler({ method: 'GET', url: '/api/anganwadi-calendar/centres', headers: {} }, resGet);
    expect(resGet.statusCode).toBe(200);
    expect(resGet.body.centres.length).toBeGreaterThanOrEqual(2);
    const centreId = resGet.body.centres[0].centreId;

    // 400 child health data rejected
    const resChild = createMockRes();
    await handler(
      {
        method: 'POST',
        url: `/api/anganwadi-calendar/centres/${centreId}/community-status`,
        headers: { authorization: 'Bearer citizen' },
        body: { statusType: 'open_normal', note: 'Growth check done', childName: 'Baby X' },
      },
      resChild
    );
    expect(resChild.statusCode).toBe(400);
    expect(resChild.body.code).toBe('ERR_CHILD_PRIVACY_PROHIBITED');

    // 201 clean community status accepted
    const resCom = createMockRes();
    await handler(
      {
        method: 'POST',
        url: `/api/anganwadi-calendar/centres/${centreId}/community-status`,
        headers: { authorization: 'Bearer citizen' },
        body: { statusType: 'ration_available', note: 'Morning THR packets available.' },
      },
      resCom
    );
    expect(resCom.statusCode).toBe(201);

    // 403 citizen cannot publish official schedule change
    const res403Cit = createMockRes();
    await handler(
      {
        method: 'POST',
        url: `/api/anganwadi-calendar/centres/${centreId}/schedule-changes`,
        headers: { authorization: 'Bearer citizen' },
        body: { reason: 'Winter timing' },
      },
      res403Cit
    );
    expect(res403Cit.statusCode).toBe(403);

    // 403 wrong jurisdiction admin cannot publish
    const res403Jur = createMockRes();
    await handler(
      {
        method: 'POST',
        url: `/api/anganwadi-calendar/centres/${centreId}/schedule-changes`,
        headers: { authorization: 'Bearer admin-mh' },
        body: { reason: 'Winter timing' },
      },
      res403Jur
    );
    expect(res403Jur.statusCode).toBe(403);

    // 201 IN-UP admin publishes official schedule change
    const res201 = createMockRes();
    await handler(
      {
        method: 'POST',
        url: `/api/anganwadi-calendar/centres/${centreId}/schedule-changes`,
        headers: { authorization: 'Bearer admin-up' },
        body: {
          openingHours: '09:30 AM – 01:30 PM',
          reason: 'Winter hours per CDPO order.',
          officialProvenance: {
            source: 'UP ICDS CDPO Order #12',
            jurisdiction: 'IN-UP',
            effectiveDate: '2026-11-28',
            lastVerifiedAt: '2026-11-27T00:00:00.000Z',
          },
        },
      },
      res201
    );
    expect(res201.statusCode).toBe(201);
  });
});
