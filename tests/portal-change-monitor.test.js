/**
 * tests/portal-change-monitor.test.js
 *
 * API integration & access control tests for Portal Change Monitor (#1428).
 */

import { describe, it, expect } from 'vitest';
import handler from '../api/_lib/handlers/portal-change-monitor.js';

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) { this.headers[k] = v; return this; },
    status(code) { this.statusCode = code; return this; },
    end(raw) { try { this.body = JSON.parse(raw); } catch { this.body = raw; } return res; },
  };
  return res;
}

describe('portal-change-monitor API (#1428)', () => {
  it('GET returns monitored portals with sourceOwner and lastCheckedAt (200)', async () => {
    const res = createMockRes();
    await handler({ method: 'GET', url: '/api/portal-change-monitor', headers: { 'x-forwarded-for': '10.8.0.1' } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.portals.length).toBeGreaterThan(0);
    expect(res.body.portals[0].sourceOwner).toBeTruthy();
    expect(res.body.portals[0].lastCheckedAt).toBeTruthy();
  });

  it('POST /check & /review enforce auth (401/403) and complete review lifecycle (200)', async () => {
    const unauth = createMockRes();
    await handler(
      { method: 'POST', url: '/api/portal-change-monitor/check', headers: { 'x-forwarded-for': '10.8.0.2' }, body: {} },
      unauth
    );
    expect(unauth.statusCode).toBe(401);

    const cit = createMockRes();
    await handler(
      { method: 'POST', url: '/api/portal-change-monitor/check', headers: { 'x-forwarded-for': '10.8.0.3' }, body: {} },
      cit,
      { authUserOverride: { userId: 'cit-1', role: 'citizen' } }
    );
    expect(cit.statusCode).toBe(403);

    const chk = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/portal-change-monitor/check',
        headers: { 'x-forwarded-for': '10.8.0.4' },
        body: {
          sourceId: 'portal-edistrict-delhi',
          url: 'https://edistrict.delhigovt.nic.in',
          httpStatus: 404,
        },
      },
      chk,
      { authUserOverride: { userId: 'mon-1', role: 'admin' } }
    );
    expect(chk.statusCode).toBe(200);
    expect(chk.body.isBroken).toBe(true);
    const changeId = chk.body.reviewItem.changeId;

    const rev = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/portal-change-monitor/review',
        headers: { 'x-forwarded-for': '10.8.0.5' },
        body: { changeId, decision: 'APPROVE', rationale: 'Verified 404' },
      },
      rev,
      { authUserOverride: { userId: 'rev-1', role: 'reviewer' } }
    );
    expect(rev.statusCode).toBe(200);
    expect(rev.body.item.status).toBe('APPROVED');
  });
});
