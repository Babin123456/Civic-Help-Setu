import { describe, it, expect } from 'vitest';

import handler, { validateCorrectionPayload, generateCorrectionSeal } from '../api/crematorium-corrections.js';

import handler, { validateCorrectionPayload, generateCorrectionSeal } from '../api/_lib/handlers/crematorium-corrections.js';


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

describe('crematorium-corrections API', () => {
  it('generates a consistent deterministic seal', () => {
    const seal1 = generateCorrectionSeal('facility-1', '2026-02-15T12:00:00Z');
    const seal2 = generateCorrectionSeal('facility-1', '2026-02-15T12:00:00Z');
    expect(seal1).toBe(seal2);
    expect(seal1).toMatch(/^CB-CORR-[0-9A-F]{4}-[0-9A-F]{4}$/);
  });

  it('validates correct payload and accepts official government source', () => {
    const errors = validateCorrectionPayload({
      facilityId: 'delhi-nigambodh-ghat',
      proposedChange: 'Electric furnace 2 under scheduled maintenance until Friday as per MCD notice.',
      officialSourceUrl: 'https://mcdonline.nic.in/public-notices/maintenance',
      contributorRole: 'citizen',
    });
    expect(errors).toEqual([]);
  });

  it('rejects forbidden personal identifiers (Aadhaar, deceased names)', () => {
    const errorsWithAadhaar = validateCorrectionPayload({
      facilityId: 'delhi-nigambodh-ghat',
      proposedChange: 'My Aadhaar is 1234 5678 9012 please update contact',
      officialSourceUrl: 'https://mcdonline.nic.in',
    });
    expect(errorsWithAadhaar.some((e) => e.includes('Aadhaar'))).toBe(true);

    const errorsWithName = validateCorrectionPayload({
      facilityId: 'delhi-nigambodh-ghat',
      proposedChange: 'Valid description here',
      officialSourceUrl: 'https://mcdonline.nic.in',
      deceasedName: 'John Doe',
    });
    expect(errorsWithName.some((e) => e.includes('personal names are not accepted'))).toBe(true);
  });

  it('rejects non-https or invalid officialSourceUrl', () => {
    const errors = validateCorrectionPayload({
      facilityId: 'delhi-nigambodh-ghat',
      proposedChange: 'Updated operating hours',
      officialSourceUrl: 'http://insecure-site.com/notice',
    });
    expect(errors.some((e) => e.includes('officialSourceUrl'))).toBe(true);
  });

  it('handles HTTP POST successfully and emits 201 with seal', async () => {
    const req = {
      method: 'POST',
      headers: { 'x-vercel-forwarded-for': '192.168.1.100' },
      body: {
        facilityId: 'bengaluru-wilson-garden-electric',
        facilityName: 'Wilson Garden Electric Crematorium',
        proposedChange: 'BBMP has extended night intake hours by council resolution.',
        officialSourceUrl: 'https://bbmp.gov.in/notifications/crematorium-hours',
        contributorRole: 'official_staff',
      },
    };
    const res = createMockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.verificationSeal).toMatch(/^CB-CORR-/);
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

