import { describe, it, expect } from 'vitest';
import handler from '../api/_lib/handlers/mgnrega-evidence-builder.js';

function mockRes() {
  const out = { statusCode: 200, body: null };
  return {
    status(code) {
      out.statusCode = code;
      return this;
    },
    json(payload) {
      out.body = payload;
      return out;
    },
  };
}

describe('mgnrega-evidence-builder API handler', () => {
  it('returns 401 when unauthenticated and 400 when PII is supplied', async () => {
    const unauth = await handler(
      { method: 'GET', url: '/', headers: {}, query: {} },
      mockRes()
    );
    expect(unauth.statusCode).toBe(401);

    const pii = await handler(
      {
        method: 'POST',
        url: '/cases',
        headers: { 'x-user-id': 'worker-api-1' },
        body: { demandReceiptRef: 'DR 1234 5678 9012', demandDate: '2026-10-01' },
      },
      mockRes()
    );
    expect(pii.statusCode).toBe(400);
    expect(pii.body.error).toBe('pii_rejected');
  });

  it('enforces worker ownership and exports privacy-safe dossier', async () => {
    const created = await handler(
      {
        method: 'POST',
        url: '/cases',
        headers: { 'x-user-id': 'worker-api-1' },
        body: { demandReceiptRef: 'DR-API-1', demandDate: '2026-10-01', daysDemanded: 14 },
      },
      mockRes()
    );
    expect(created.statusCode).toBe(201);
    const caseId = created.body.evidenceCase.caseId;

    const crossExport = await handler(
      {
        method: 'GET',
        url: '/export',
        headers: { 'x-user-id': 'intruder-worker' },
        query: { caseId },
      },
      mockRes()
    );
    expect(crossExport.statusCode).toBe(403);

    const ownerExport = await handler(
      {
        method: 'GET',
        url: '/export',
        headers: { 'x-user-id': 'worker-api-1' },
        query: { caseId },
      },
      mockRes()
    );
    expect(ownerExport.statusCode).toBe(200);
    expect(ownerExport.body.dossier.fabricatedEntitlementCalculations).toBe(false);
  });
});
