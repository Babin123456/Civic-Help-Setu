import { describe, it, expect, beforeEach } from 'vitest';
import apiRouter from '../api/[...path].js';
import handler, {
  validateToiletSubmissionPayload,
  generateToiletReceiptSeal,
  TOILET_SUBMISSION_QUEUE,
} from '../api/_lib/handlers/public-toilets.js';

describe('tests/public-toilets API endpoint (#758)', () => {
  beforeEach(() => {
    TOILET_SUBMISSION_QUEUE.length = 0;
  });

  const createMockRes = () => {
    const res = {
      statusCode: 200,
      headers: {},
      body: null,
      setHeader(k, v) {
        this.headers[k.toLowerCase()] = v;
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      },
    };
    return res;
  };

  it('generates consistent deterministic receipt seals', () => {
    const timestamp = '2026-05-18T10:00:00.000Z';
    const seal1 = generateToiletReceiptSeal('pt-blr-ward150-001', timestamp);
    const seal2 = generateToiletReceiptSeal('pt-blr-ward150-001', timestamp);
    expect(seal1).toBe(seal2);
    expect(seal1).toMatch(/^PT-SEAL-[0-9A-F]{4}-[0-9A-F]{4}$/);
  });

  it('validates compliant citizen incident reports', () => {
    const errors = validateToiletSubmissionPayload({
      facilityId: 'pt-blr-ward150-001',
      reportType: 'maintenance_issue',
      category: 'plumbing_leak',
      description: 'Flush valve leaking in cabin 2.',
    });
    expect(errors).toEqual([]);
  });

  it('rejects submissions with missing facilityId or invalid reportType', () => {
    const errors = validateToiletSubmissionPayload({
      description: 'Broken tap',
    });
    expect(errors.some((e) => e.includes('facilityId'))).toBe(true);
    expect(errors.some((e) => e.includes('reportType'))).toBe(true);
  });

  it('rejects submissions with sensitive PII (Aadhaar, PAN, phone numbers)', () => {
    const withPhone = {
      facilityId: 'pt-blr-ward150-001',
      reportType: 'maintenance_issue',
      description: 'Please call me on 9845012345 to inspect tap',
    };
    expect(validateToiletSubmissionPayload(withPhone).some((e) => e.includes('phone'))).toBe(true);

    const withAadhaar = {
      facilityId: 'pt-blr-ward150-001',
      reportType: 'maintenance_issue',
      description: 'Caretaker Aadhaar is 2345 6789 0123',
    };
    expect(validateToiletSubmissionPayload(withAadhaar).some((e) => e.includes('Aadhaar'))).toBe(true);
  });

  it('routes correctly through api/[...path].js entrypoint', async () => {
    const req = {
      method: 'GET',
      headers: {},
      query: { path: ['public-toilets'] },
    };
    const res = createMockRes();

    await apiRouter(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.service).toBe('public-toilet-service');
  });

  it('successfully handles valid POST submission and returns receipt seal', async () => {
    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      body: {
        facilityId: 'pt-blr-ward150-001',
        reportType: 'citizen_feedback',
        rating: 4,
        comment: 'Clean wheelchair ramp and operational hand soap dispenser.',
      },
    };
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.receiptSeal).toMatch(/^PT-SEAL-/);
    expect(TOILET_SUBMISSION_QUEUE.length).toBe(1);
  });
});
