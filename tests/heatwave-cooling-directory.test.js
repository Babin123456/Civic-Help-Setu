import { describe, it, expect } from 'vitest';
import { createHeatReliefDirectoryHandler } from '../api/_lib/handlers/heat-relief-observations.js';
import { InMemoryHeatReliefDirectoryStore } from '../api/_lib/heatReliefDirectoryStore.js';
import { createRateLimiter } from '../api/_lib/abuseGuard.js';

function mockRes() {
  const headers = {};
  const res = {
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
  return res;
}

describe('Heatwave Cooling-Centre & Water-Point Directory API (#1436)', () => {
  it('serves verified facilities, enforces zero-PII on observations, and gates admin/jurisdiction mutations', async () => {
    const store = new InMemoryHeatReliefDirectoryStore();
    let actor = { ok: false, status: 401, error: 'Authentication required.' };

    const handler = createHeatReliefDirectoryHandler({
      verifyActor: async () => actor,
      getStore: () => store,
      rateLimiter: createRateLimiter({ limit: 50, windowMs: 60 * 1000 }),
    });

    // 1. Public GET returns verified facilities with Cache-Control: no-store
    const getRes = mockRes();
    await handler({ method: 'GET', url: '/api/heatwave-cooling-directory', headers: {} }, getRes);
    expect(getRes.statusCode).toBe(200);
    expect(getRes.headers['cache-control']).toBe('no-store');
    expect(getRes.body.facilitiesCount).toBeGreaterThan(0);

    // 2. Rejects citizen observation with Aadhaar / PII
    const piiRes = mockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/heatwave-cooling-directory',
        headers: {},
        body: {
          facilityId: 'lko-relief-001',
          observedStatus: 'open',
          feedbackNote: 'Call 9876543210 for gate key',
        },
      },
      piiRes
    );
    expect(piiRes.statusCode).toBe(400);

    // 3. Accepts clean citizen condition report as pending_review
    const obsRes = mockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/heatwave-cooling-directory',
        headers: {},
        body: {
          facilityId: 'lko-relief-001',
          observedStatus: 'open',
          currentCapacityStatus: 'available',
          feedbackNote: 'Water dispenser is chilled and working.',
        },
      },
      obsRes
    );
    expect(obsRes.statusCode).toBe(201);
    expect(obsRes.body.record.status).toBe('pending_review');
    expect(obsRes.body.record.originClassification).toBe('citizen_entered_fact');
    const obsId = obsRes.body.record.id;

    // 4. Unauthenticated admin facility creation -> 401
    const unauthRes = mockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/heatwave-cooling-directory/facilities',
        headers: {},
        body: {},
      },
      unauthRes
    );
    expect(unauthRes.statusCode).toBe(401);

    // 5. Non-admin -> 403
    actor = { ok: true, actorId: 'user_1', role: 'citizen', jurisdiction: 'Lucknow' };
    const forbiddenRes = mockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/heatwave-cooling-directory/facilities',
        headers: {},
        body: {},
      },
      forbiddenRes
    );
    expect(forbiddenRes.statusCode).toBe(403);

    // 6. Admin in wrong jurisdiction -> 403
    actor = { ok: true, actorId: 'admin_vns', role: 'admin', jurisdiction: 'Varanasi' };
    const wrongJurRes = mockRes();
    await handler(
      {
        method: 'POST',
        url: `/api/heatwave-cooling-directory/${obsId}/moderate`,
        headers: {},
        body: { decision: 'approve' },
      },
      wrongJurRes
    );
    expect(wrongJurRes.statusCode).toBe(403);

    // 7. Admin in matching jurisdiction -> 200 approve & audit log
    actor = { ok: true, actorId: 'admin_lko', role: 'admin', jurisdiction: 'Lucknow' };
    const modRes = mockRes();
    await handler(
      {
        method: 'POST',
        url: `/api/heatwave-cooling-directory/${obsId}/moderate`,
        headers: {},
        body: { decision: 'approve', note: 'Verified by LMC team' },
      },
      modRes
    );
    expect(modRes.statusCode).toBe(200);
    expect(modRes.body.observation.status).toBe('approved');

    const auditRes = mockRes();
    await handler({ method: 'GET', url: '/api/heatwave-cooling-directory/audit-log', headers: {} }, auditRes);
    expect(auditRes.statusCode).toBe(200);
    expect(auditRes.body.auditLog).toHaveLength(1);
    expect(auditRes.body.auditLog[0].action).toBe('APPROVE_CONDITION_REPORT');
  });
});
