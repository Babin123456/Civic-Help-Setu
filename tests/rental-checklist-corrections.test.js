import { describe, it, expect, beforeEach } from 'vitest';
import handler, {
  validateRentalCorrectionPayload,
  generateRentalCorrectionSeal,
  RENTAL_CORRECTION_QUEUE,
} from '../api/rental-checklist-corrections.js';

describe('api/rental-checklist-corrections (#726)', () => {
  beforeEach(() => {
    RENTAL_CORRECTION_QUEUE.length = 0;
  });

  it('validates a correct payload without errors', () => {
    const payload = {
      transitionId: 'bescom-move-in-meter-recording',
      proposedDetails: 'BESCOM has updated their Form-6 online submission URL for tenant occupancy verification.',
      officialSourceUrl: 'https://bescom.karnataka.gov.in/page/form6',
    };

    const errors = validateRentalCorrectionPayload(payload);
    expect(errors).toEqual([]);
  });

  it('rejects submissions containing citizen PII (Aadhaar, PAN, phone)', () => {
    const payloadWithAadhaar = {
      transitionId: 'bescom-move-in-meter-recording',
      proposedDetails: 'Tenant Aadhaar number 2345 6789 0123 has been updated on meter.',
      officialSourceUrl: 'https://bescom.karnataka.gov.in',
    };
    const errors = validateRentalCorrectionPayload(payloadWithAadhaar);
    expect(errors.some((e) => e.includes('Aadhaar'))).toBe(true);

    const payloadWithPhone = {
      transitionId: 'bescom-move-in-meter-recording',
      proposedDetails: 'Call landlord directly on +91 9876543210 for meter keys.',
      officialSourceUrl: 'https://bescom.karnataka.gov.in',
    };
    const phoneErrors = validateRentalCorrectionPayload(payloadWithPhone);
    expect(phoneErrors.some((e) => e.includes('phone numbers'))).toBe(true);
  });

  it('strictly rejects private lease disputes and deposit arbitration claims', () => {
    const disputePayload = {
      transitionId: 'bescom-move-in-meter-recording',
      proposedDetails: 'Landlord wrongfully withheld depositamount of Rs 50000 for paint damages.',
      officialSourceUrl: 'https://bescom.karnataka.gov.in',
    };
    const errors = validateRentalCorrectionPayload(disputePayload);
    expect(errors.some((e) => e.includes('Contractual lease disputes'))).toBe(true);
  });

  it('rejects non-HTTPS official source URLs', () => {
    const insecurePayload = {
      transitionId: 'bescom-move-in-meter-recording',
      proposedDetails: 'Updated electricity meter reading circular.',
      officialSourceUrl: 'http://insecure-bescom.karnataka.gov.in',
    };
    const errors = validateRentalCorrectionPayload(insecurePayload);
    expect(errors.some((e) => e.includes('officialSourceUrl'))).toBe(true);
  });

  it('generates deterministic verification seals', () => {
    const seal = generateRentalCorrectionSeal('bescom-move-in', '2026-02-14T10:00:00Z');
    expect(seal).toMatch(/^RC-CORR-[A-F0-9]{4}-[A-F0-9]{4}$/);
  });

  it('executes handler and queues correction entry', async () => {
    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      body: {
        transitionId: 'bescom-move-in-meter-recording',
        proposedDetails: 'BESCOM has moved intermediate pro-rata billing to the Mithra web portal.',
        officialSourceUrl: 'https://bescom.karnataka.gov.in/mithra',
      },
    };

    let statusCode = null;
    let jsonBody = null;
    const res = {
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => {
            jsonBody = data;
          },
        };
      },
      setHeader: () => {},
    };

    await handler(req, res);

    expect(statusCode).toBe(201);
    expect(jsonBody.success).toBe(true);
    expect(jsonBody.seal).toBeDefined();
    expect(RENTAL_CORRECTION_QUEUE.length).toBe(1);
    expect(RENTAL_CORRECTION_QUEUE[0].seal).toBe(jsonBody.seal);
  });
});

