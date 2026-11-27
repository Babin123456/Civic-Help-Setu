/**
 * tests/jurisdiction-boundary-conflict.test.js
 *
 * API integration & authorization tests for Jurisdiction Boundary Conflict Resolver (#1434).
 */

import { describe, it, expect } from 'vitest';
import handler from '../api/_lib/handlers/jurisdiction-handoff.js';

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) {
      this.headers[k] = v;
      return this;
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

describe('jurisdiction-handoff API with Boundary Conflict Resolver (#1434)', () => {
  it('GET ?action=boundary-versions returns versioned datasets with provenance metadata', async () => {
    const req = { method: 'GET', url: '/api/jurisdiction-handoff?action=boundary-versions', headers: {} };
    const res = createMockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.versions[0].version).toBe('2026.2');
    expect(res.body.versions[0].effectiveDate).toBeTruthy();
  });

  it('GET ?action=provenance-logs rejects non-admin requests with 403', async () => {
    const req = {
      method: 'GET',
      url: '/api/jurisdiction-handoff?action=provenance-logs',
      headers: { 'x-user-role': 'citizen' },
    };
    const res = createMockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(403);
  });

  it('GET ?action=provenance-logs allows admin role (200)', async () => {
    const req = {
      method: 'GET',
      url: '/api/jurisdiction-handoff?action=provenance-logs',
      headers: { 'x-user-role': 'admin' },
    };
    const res = createMockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.logs)).toBe(true);
  });

  it('POST action=resolve-conflict returns AMBIGUOUS_BORDER with alternatives for Wakad 411057', async () => {
    const req = {
      method: 'POST',
      url: '/api/jurisdiction-handoff',
      headers: { 'x-forwarded-for': '10.2.0.1' },
      body: {
        action: 'resolve-conflict',
        locality: 'Wakad 411057',
        boundaryVersion: '2026.2',
      },
    };
    const res = createMockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.conflictResolution.status).toBe('AMBIGUOUS_BORDER');
    expect(res.body.conflictResolution.alternatives.length).toBeGreaterThan(0);
  });

  it('POST action=manual-override requires authentication (401) and succeeds when authenticated (200)', async () => {
    const resolveReq = {
      method: 'POST',
      url: '/api/jurisdiction-handoff',
      headers: { 'x-forwarded-for': '10.2.0.2' },
      body: { action: 'resolve-conflict', locality: 'Wakad 411057' },
    };
    const resolveRes = createMockRes();
    await handler(resolveReq, resolveRes);
    const resolution = resolveRes.body.conflictResolution;

    // Unauthenticated override -> 401
    const unauthReq = {
      method: 'POST',
      url: '/api/jurisdiction-handoff',
      headers: { 'x-forwarded-for': '10.2.0.3' },
      body: {
        action: 'manual-override',
        resolution,
        selectedAuthorityId: 'pmrda-hinjawadi-gp',
      },
    };
    const unauthRes = createMockRes();
    await handler(unauthReq, unauthRes);
    expect(unauthRes.statusCode).toBe(401);

    // Authenticated override -> 200
    const authReq = {
      method: 'POST',
      url: '/api/jurisdiction-handoff',
      headers: { 'x-forwarded-for': '10.2.0.4', 'x-user-id': 'citizen-99' },
      body: {
        action: 'manual-override',
        resolution,
        selectedAuthorityId: 'pmrda-hinjawadi-gp',
        reason: 'Confirmed via municipal tax bill',
      },
    };
    const authRes = createMockRes();
    await handler(authReq, authRes);
    expect(authRes.statusCode).toBe(200);
    expect(authRes.body.conflictResolution.status).toBe('MANUAL_OVERRIDE');
    expect(authRes.body.conflictResolution.provenanceKind).toBe('citizen_confirmed');
  });
});

