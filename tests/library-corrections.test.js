import { describe, it, expect, beforeEach } from 'vitest';
import handler, {
  generateLibraryCorrectionSeal,
  validateLibraryCorrectionPayload,
  LIBRARY_CORRECTION_QUEUE,
} from './library-corrections';

describe('library-corrections API (#727)', () => {
  beforeEach(() => {
    LIBRARY_CORRECTION_QUEUE.length = 0;
  });

  it('generates a consistent deterministic seal', () => {
    const seal1 = generateLibraryCorrectionSeal('delhi-central', '2026-11-14T10:00:00Z');
    const seal2 = generateLibraryCorrectionSeal('delhi-central', '2026-11-14T10:00:00Z');
    expect(seal1).toBe(seal2);
    expect(seal1).toMatch(/^LIB-CORR-[0-9A-F]{4}-[0-9A-F]{4}$/);
  });

  it('validates correct payload and accepts official government source', () => {
    const valid = {
      libraryId: 'delhi-central',
      proposedChange: 'Reading room hours on Sundays are now 09:00 AM to 05:00 PM per latest circular.',
      officialSourceUrl: 'https://dpl.gov.in/notices/hours-update',
      contributorRole: 'librarian',
    };
    const errors = validateLibraryCorrectionPayload(valid);
    expect(errors).toEqual([]);
  });

  it('rejects forbidden personal identifiers (Aadhaar, PAN, phone)', () => {
    const piiPayload = {
      libraryId: 'delhi-central',
      proposedChange: 'My Aadhaar is 2345 6789 0123 and phone is 9876543210. Please update my membership card.',
      officialSourceUrl: 'https://dpl.gov.in/rules',
    };
    const errors = validateLibraryCorrectionPayload(piiPayload);
    expect(errors.some((e) => e.includes('Aadhaar'))).toBe(true);
    expect(errors.some((e) => e.includes('phone'))).toBe(true);
  });

  it('rejects non-https or invalid officialSourceUrl', () => {
    const badUrl = {
      libraryId: 'delhi-central',
      proposedChange: 'Updated membership caution deposit to 300 rupees.',
      officialSourceUrl: 'http://insecure-blog.com/post',
    };
    const errors = validateLibraryCorrectionPayload(badUrl);
    expect(errors.some((e) => e.includes('https URL'))).toBe(true);
  });

  it('handles HTTP POST successfully and emits 201 with seal', async () => {
    const req = {
      method: 'POST',
      headers: { 'x-vercel-forwarded-for': '192.168.1.100' },
      body: {
        libraryId: 'delhi-central',
        libraryName: 'Delhi Central Library',
        proposedChange: 'Annual student concession fee revised to 60 rupees.',
        officialSourceUrl: 'https://dpl.gov.in/gazette/fees-2026',
      },
    };

    let statusCode;
    let jsonBody;
    const res = {
      setHeader: () => {},
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => {
            jsonBody = data;
          },
        };
      },
    };

    await handler(req, res);

    expect(statusCode).toBe(201);
    expect(jsonBody.ok).toBe(true);
    expect(jsonBody.verificationSeal).toMatch(/^LIB-CORR-/);
    expect(LIBRARY_CORRECTION_QUEUE.length).toBe(1);
  });

  it('handles GET to return pending queue count', async () => {
    LIBRARY_CORRECTION_QUEUE.push({ id: 'sub_1', libraryId: 'delhi-central' });

    const req = {
      method: 'GET',
      headers: {},
    };

    let statusCode;
    let jsonBody;
    const res = {
      setHeader: () => {},
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => {
            jsonBody = data;
          },
        };
      },
    };

    await handler(req, res);

    expect(statusCode).toBe(200);
    expect(jsonBody.pendingCount).toBe(1);
    expect(jsonBody.items.length).toBe(1);
  });
});

