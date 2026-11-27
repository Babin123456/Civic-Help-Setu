import { describe, it, expect } from 'vitest';

import handler, { validateCorrectionPayload, generateCorrectionSeal } from '../api/community-facility-corrections.js';

import handler, { validateCorrectionPayload, generateCorrectionSeal } from '../api/_lib/handlers/community-facility-corrections.js';

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(key, val) {
      this.headers[key.toLowerCase()] = val;
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

describe('community-facility-corrections API', () => {
  it('generates a consistent deterministic seal', () => {
    const seal1 = generateCorrectionSeal('facility-1', '2026-02-15T12:00:00Z');
    const seal2 = generateCorrectionSeal('facility-1', '2026-02-15T12:00:00Z');
    expect(seal1).toBe(seal2);
    expect(seal1).toMatch(/^CF-CORR-[0-9A-F]{4}-[0-9A-F]{4}$/);
  });

  it('validates correct payload and accepts official government source', () => {
    const errors = validateCorrectionPayload({
      facilityId: 'delhi-mcd-civic-centre-auditorium',
      proposedChange: 'MCD has revised the security deposit tariff schedule under circular 402/2026.',
      officialSourceUrl: 'https://mcdonline.nic.in/notices/circular402',
      contributorRole: 'citizen',
    });
    expect(errors).toEqual([]);
  });

  it('rejects forbidden personal identifiers (Aadhaar, applicant names)', () => {
    const errorsWithAadhaar = validateCorrectionPayload({
      facilityId: 'delhi-mcd-civic-centre-auditorium',
      proposedChange: 'My Aadhaar is 1234 5678 9012 please update booking',
      officialSourceUrl: 'https://mcdonline.nic.in',
    });
    expect(errorsWithAadhaar.some((e) => e.includes('Aadhaar'))).toBe(true);

    const errorsWithName = validateCorrectionPayload({
      facilityId: 'delhi-mcd-civic-centre-auditorium',
      proposedChange: 'Valid change description here',
      officialSourceUrl: 'https://mcdonline.nic.in',
      applicantName: 'Citizen Doe',
    });
    expect(errorsWithName.some((e) => e.includes('personal names are not accepted'))).toBe(true);
  });

  it('rejects non-https or invalid officialSourceUrl', () => {
    const errors = validateCorrectionPayload({
      facilityId: 'delhi-mcd-civic-centre-auditorium',
      proposedChange: 'Updated operating hours',
      officialSourceUrl: 'http://insecure-site.com/notice',
    });
    expect(errors.some((e) => e.includes('officialSourceUrl'))).toBe(true);
  });

  it('handles HTTP POST successfully and emits 201 with seal', async () => {
    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '192.168.1.101' },
      body: {
        facilityId: 'bengaluru-bbmp-sir-puttanna-chettiar-town-hall',
        facilityName: 'Sir Puttanna Chettiar Town Hall',
        proposedChange: 'BBMP standing committee resolved new cultural subsidy rules.',
        officialSourceUrl: 'https://bbmp.gov.in/notifications/subsidy-rules',
        contributorRole: 'official_staff',
      },
    };
    const res = createMockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.verificationSeal).toMatch(/^CF-CORR-/);
  });

  it('handles GET to return pending queue count', async () => {
    const req = { method: 'GET', headers: {} };
    const res = createMockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.pendingCount).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(res.body.items)).toBe(true);
  });
});

