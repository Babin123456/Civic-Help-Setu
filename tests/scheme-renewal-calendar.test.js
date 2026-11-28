import { describe, it, expect } from 'vitest';
import handler from '../api/_lib/handlers/scheme-renewal-calendar.js';

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

describe('scheme-renewal-calendar API handler', () => {
  it('lists rules, enforces auth (401), and rejects PII (400)', async () => {
    const rules = await handler({ method: 'GET', url: '/rules', headers: {} }, mockRes());
    expect(rules.statusCode).toBe(200);
    expect(rules.body.rules.length).toBeGreaterThanOrEqual(4);

    const unauth = await handler({ method: 'GET', url: '/export-ics', headers: {} }, mockRes());
    expect(unauth.statusCode).toBe(401);

    const pii = await handler(
      {
        method: 'POST',
        url: '/save',
        headers: { 'x-user-id': 'citizen-api-1' },
        body: { schemeId: 'custom', customSchemeName: 'Aadhaar 1234 5678 9012', lastCertifiedDate: '2026-01-01' },
      },
      mockRes()
    );
    expect(pii.statusCode).toBe(400);
    expect(pii.body.error).toBe('pii_rejected');
  });

  it('saves scheme, exports .ics, and enforces role authorization on rule governance', async () => {
    const saved = await handler(
      {
        method: 'POST',
        url: '/save',
        headers: { 'x-user-id': 'citizen-api-1' },
        body: { schemeId: 'old_age_pension_life_cert', lastCertifiedDate: '2026-02-01', leadDays: 15 },
      },
      mockRes()
    );
    expect(saved.statusCode).toBe(201);
    expect(saved.body.entry.autoRenewalClaimed).toBe(false);

    const ics = await handler(
      { method: 'GET', url: '/export-ics', headers: { 'x-user-id': 'citizen-api-1' } },
      mockRes()
    );
    expect(ics.statusCode).toBe(200);
    expect(ics.body.icsContent).toContain('BEGIN:VCALENDAR');

    const citizenGov = await handler(
      {
        method: 'POST',
        url: '/rules',
        headers: { 'x-user-id': 'citizen-api-1', 'x-user-role': 'citizen' },
        body: { schemeId: 'old_age_pension_life_cert', gracePeriodDays: 45 },
      },
      mockRes()
    );
    expect(citizenGov.statusCode).toBe(403);
  });
});
