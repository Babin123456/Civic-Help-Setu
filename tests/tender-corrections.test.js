import { describe, it, expect } from 'vitest';
import handler, {
  validateTenderCorrectionPayload,
  generateTenderCorrectionSeal,
} from '../api/tender-corrections.js';

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

describe('tender-corrections API (#722)', () => {
  it('generates consistent deterministic verification seals', () => {
    const seal1 = generateTenderCorrectionSeal('gem-2026-b-581902', '2026-11-14T10:00:00Z');
    const seal2 = generateTenderCorrectionSeal('gem-2026-b-581902', '2026-11-14T10:00:00Z');
    expect(seal1).toBe(seal2);
    expect(seal1).toMatch(/^TR-CORR-[0-9A-F]{4}-[0-9A-F]{4}$/);
  });

  it('accepts valid payload linked to official https procurement portal', () => {
    const errors = validateTenderCorrectionPayload({
      tenderId: 'gem-2026-b-581902',
      tenderRefNumber: 'GEM/2026/B/581902',
      correctionType: 'corrigendum_update',
      proposedDetails: 'Corrigendum 2 published extending closing date to 2026-12-05.',
      officialSourceUrl: 'https://gem.gov.in/tenders/corrigendum/GEM-2026-B-581902-C2',
      contributorRole: 'small_vendor',
    });
    expect(errors).toEqual([]);
  });

  it('strictly rejects personal phone, Aadhaar, PAN, and bidding pricing numbers', () => {
    const withPhone = validateTenderCorrectionPayload({
      tenderId: 'gem-2026-b-581902',
      proposedDetails: 'Please call me on 9876543210 regarding the tender date.',
      officialSourceUrl: 'https://gem.gov.in/tenders',
    });
    expect(withPhone.some((e) => e.includes('phone numbers are strictly forbidden'))).toBe(true);

    const withAadhaar = validateTenderCorrectionPayload({
      tenderId: 'gem-2026-b-581902',
      proposedDetails: 'My Aadhaar is 1234 5678 9012 for the tender registration.',
      officialSourceUrl: 'https://gem.gov.in/tenders',
    });
    expect(withAadhaar.some((e) => e.includes('Aadhaar'))).toBe(true);

    const withBidAmount = validateTenderCorrectionPayload({
      tenderId: 'gem-2026-b-581902',
      proposedDetails: 'Submitting our bidAmount of ₹40,00,000 for consideration.',
      officialSourceUrl: 'https://gem.gov.in/tenders',
    });
    expect(withBidAmount.some((e) => e.includes('Proprietary bidding terms'))).toBe(true);
  });

  it('rejects non-https source URLs', () => {
    const errors = validateTenderCorrectionPayload({
      tenderId: 'gem-2026-b-581902',
      proposedDetails: 'Valid proposed corrigendum text for testing.',
      officialSourceUrl: 'http://insecure-gem-portal.com',
    });
    expect(errors.some((e) => e.includes('officialSourceUrl must be a valid https URL'))).toBe(true);
  });

  it('handles GET and POST requests via handler', async () => {
    const getReq = { method: 'GET', headers: {} };
    const getRes = createMockRes();
    await handler(getReq, getRes);
    expect(getRes.statusCode).toBe(200);
    expect(Array.isArray(getRes.body.items)).toBe(true);

    const postReq = {
      method: 'POST',
      headers: { 'x-vercel-forwarded-for': '127.0.0.99' },
      body: {
        tenderId: 'gem-2026-b-581902',
        tenderRefNumber: 'GEM/2026/B/581902',
        proposedDetails: 'Pre-bid meeting link updated on GeM portal to Webex room.',
        officialSourceUrl: 'https://gem.gov.in/tenders/GEM-2026-B-581902',
      },
    };
    const postRes = createMockRes();
    await handler(postReq, postRes);
    expect(postRes.statusCode).toBe(201);
    expect(postRes.body.ok).toBe(true);
    expect(postRes.body.verificationSeal).toMatch(/^TR-CORR-/);
  });
});

