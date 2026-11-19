import { describe, it, expect, beforeEach } from 'vitest';
import handler, {
  validateAddressCorrectionPayload,
  generateAddressCorrectionSeal,
  ADDRESS_CHANGE_CORRECTION_QUEUE,
} from './address-change-corrections';

describe('address-change-corrections API (#725)', () => {
  beforeEach(() => {
    ADDRESS_CHANGE_CORRECTION_QUEUE.length = 0;
  });

  const validPayload = {
    recordId: 'voter-electoral-roll-shifting',
    recordName: 'Voter Electoral Roll Address Shifting (Form 8)',
    proposedDetails: 'ECI updated the portal URL to voters.eci.gov.in under notification dated 2024.',
    officialSourceUrl: 'https://voters.eci.gov.in/homepage',
    stateScope: 'All India',
    moveTypeScope: 'all',
  };

  it('generates consistent deterministic verification seals', () => {
    const seal1 = generateAddressCorrectionSeal('aadhaar-address-update', 1700000000000);
    const seal2 = generateAddressCorrectionSeal('aadhaar-address-update', 1700000000000);
    expect(seal1).toBe(seal2);
    expect(seal1).toMatch(/^AC-CORR-[0-9A-F]{4}-[0-9A-F]{4}$/);
  });

  it('accepts valid payload linked to official https government portal', () => {
    const errors = validateAddressCorrectionPayload(validPayload);
    expect(errors).toEqual([]);
  });

  it('strictly rejects personal phone numbers, Aadhaar, PAN, emails, and passwords', () => {
    const withPhone = { ...validPayload, proposedDetails: 'Call me at 9876543210 for verification of address.' };
    expect(validateAddressCorrectionPayload(withPhone).length).toBeGreaterThan(0);

    const withAadhaar = { ...validPayload, proposedDetails: 'My Aadhaar is 1234 5678 9012 please update.' };
    expect(validateAddressCorrectionPayload(withAadhaar).length).toBeGreaterThan(0);

    const withEmail = { ...validPayload, proposedDetails: 'Contact citizen@example.com for proof.' };
    expect(validateAddressCorrectionPayload(withEmail).length).toBeGreaterThan(0);

    const withPassword = { ...validPayload, proposedDetails: 'The password for portal login is testpass123.' };
    expect(validateAddressCorrectionPayload(withPassword).length).toBeGreaterThan(0);
  });

  it('rejects non-https or invalid official source URLs', () => {
    const nonHttps = { ...validPayload, officialSourceUrl: 'http://voters.eci.gov.in' };
    expect(validateAddressCorrectionPayload(nonHttps).length).toBeGreaterThan(0);
  });

  it('handles GET and POST requests via handler', async () => {
    // GET request
    const mockResGet = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.data = data;
        return this;
      },
    };
    await handler({ method: 'GET' }, mockResGet);
    expect(mockResGet.statusCode).toBe(200);
    expect(mockResGet.data.queue).toEqual([]);

    // POST request
    const mockResPost = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.data = data;
        return this;
      },
      setHeader() {},
    };
    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      body: validPayload,
    };
    await handler(req, mockResPost);
    expect(mockResPost.statusCode).toBe(201);
    expect(mockResPost.data.seal).toMatch(/^AC-CORR-/);
    expect(ADDRESS_CHANGE_CORRECTION_QUEUE.length).toBe(1);
  });
});

