import { describe, it, expect } from 'vitest';
import handler from '../api/_lib/handlers/pm-kisan-exception-guide.js';

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

describe('pm-kisan-exception-guide API handler', () => {
  it('lists versioned mappings, enforces auth (401), and rejects credentials/PII (400)', async () => {
    const mappings = await handler(
      { method: 'GET', url: '/mappings', headers: {} },
      mockRes()
    );
    expect(mappings.statusCode).toBe(200);
    expect(mappings.body.version).toBe('2026.1');

    const unauth = await handler(
      { method: 'POST', url: '/diagnose', headers: {}, body: { statusCode: 'ekyc_pending' } },
      mockRes()
    );
    expect(unauth.statusCode).toBe(401);

    const pii = await handler(
      {
        method: 'POST',
        url: '/diagnose',
        headers: { 'x-user-id': 'farmer-api-1' },
        body: { statusCode: 'unknown', customPortalMessage: 'Aadhaar 1234 5678 9012' },
      },
      mockRes()
    );
    expect(pii.statusCode).toBe(400);
    expect(pii.body.error).toBe('pii_rejected');
  });

  it('enforces role authorization on governance routes and supports diagnosis', async () => {
    const diag = await handler(
      {
        method: 'POST',
        url: '/diagnose',
        headers: { 'x-user-id': 'farmer-api-1' },
        body: { statusCode: 'bank_aadhaar_seeding_pending' },
      },
      mockRes()
    );
    expect(diag.statusCode).toBe(201);
    expect(diag.body.session.diagnosis.verificationStatus).toBe('VERIFIED');

    const citizenGov = await handler(
      {
        method: 'POST',
        url: '/mappings',
        headers: { 'x-user-id': 'farmer-api-1', 'x-user-role': 'citizen' },
        body: { mappingCode: 'ekyc_pending', sourceUrl: 'https://pmkisan.gov.in/' },
      },
      mockRes()
    );
    expect(citizenGov.statusCode).toBe(403);

    const adminGov = await handler(
      {
        method: 'POST',
        url: '/mappings',
        headers: { 'x-user-id': 'admin-api-1', 'x-user-role': 'admin' },
        body: {
          mappingCode: 'ekyc_pending',
          sourceUrl: 'https://pmkisan.gov.in/',
          effectiveDate: '2026-01-01',
          lastVerifiedAt: '2026-02-20',
        },
      },
      mockRes()
    );
    expect(adminGov.statusCode).toBe(200);
  });
});
