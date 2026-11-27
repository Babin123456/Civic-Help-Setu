import { describe, it, expect } from 'vitest';
import { createDisasterReliefBoardHandler } from '../api/_lib/handlers/disaster-relief-board.js';
import { InMemoryDisasterReliefBoardStore } from '../api/_lib/disasterReliefBoardStore.js';
import { createRateLimiter } from '../api/_lib/abuseGuard.js';

function mockRes() {
  const headers = {};
  return {
    statusCode: 200,
    headers,
    body: null,
    setHeader(k, v) {
      headers[k.toLowerCase()] = v;
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

describe('Disaster Relief Entitlement & Camp Board API (#1435)', () => {
  it('enforces public zero-PII observations, admin/jurisdiction auth, and Cache-Control: no-store', async () => {
    const store = new InMemoryDisasterReliefBoardStore();
    let actor = { ok: false, status: 401, error: 'Authentication required.' };

    const handler = createDisasterReliefBoardHandler({
      verifyActor: async () => actor,
      getStore: () => store,
      rateLimiter: createRateLimiter({ limit: 50, windowMs: 60 * 1000 }),
    });

    // 1. Public GET
    const getRes = mockRes();
    await handler({ method: 'GET', url: '/api/disaster-relief-board', headers: {} }, getRes);
    expect(getRes.statusCode).toBe(200);
    expect(getRes.headers['cache-control']).toBe('no-store');
    expect(getRes.body.camps.length).toBeGreaterThan(0);
    expect(getRes.body.entitlements.some((e) => e.freshness.isUnverified)).toBe(true);

    // 2. Reject PII in public observation
    const piiRes = mockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/disaster-relief-board/observations',
        headers: {},
        body: { campId: 'shelter-delhi-central', note: 'Contact 9876543210 for ration' },
      },
      piiRes
    );
    expect(piiRes.statusCode).toBe(400);

    // 3. Valid citizen observation
    const obsRes = mockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/disaster-relief-board/observations',
        headers: {},
        body: { campId: 'shelter-delhi-central', observedStatus: 'OPEN', note: 'Water tanker arrived at north gate.' },
      },
      obsRes
    );
    expect(obsRes.statusCode).toBe(201);
    expect(obsRes.body.observation.originClassification).toBe('citizen_entered_fact');
    const obsId = obsRes.body.observation.id;

    // 4. Unauthenticated camp publish -> 401
    const unauthRes = mockRes();
    await handler({ method: 'POST', url: '/api/disaster-relief-board/camps', headers: {}, body: {} }, unauthRes);
    expect(unauthRes.statusCode).toBe(401);

    // 5. Wrong jurisdiction -> 403
    actor = { ok: true, actorId: 'admin_lko', role: 'admin', jurisdiction: 'Lucknow' };
    const wrongJur = mockRes();
    await handler(
      {
        method: 'POST',
        url: `/api/disaster-relief-board/observations/${obsId}/moderate`,
        headers: {},
        body: { decision: 'approve' },
      },
      wrongJur
    );
    expect(wrongJur.statusCode).toBe(403);

    // 6. Matching jurisdiction -> 200 + audit log
    actor = { ok: true, actorId: 'admin_del', role: 'admin', jurisdiction: 'New Delhi' };
    const modRes = mockRes();
    await handler(
      {
        method: 'POST',
        url: `/api/disaster-relief-board/observations/${obsId}/moderate`,
        headers: {},
        body: { decision: 'approve' },
      },
      modRes
    );
    expect(modRes.statusCode).toBe(200);
    expect(modRes.body.observation.status).toBe('approved');

    const auditRes = mockRes();
    await handler({ method: 'GET', url: '/api/disaster-relief-board/audit-log', headers: {} }, auditRes);
    expect(auditRes.statusCode).toBe(200);
    expect(auditRes.body.auditLog).toHaveLength(1);
  });
});
