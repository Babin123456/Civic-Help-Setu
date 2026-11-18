import { describe, it, expect, beforeEach } from 'vitest';
import handler, {
  validateToiletSubmissionPayload,
  generateToiletReceiptSeal,
  TOILET_SUBMISSION_QUEUE,
} from './public-toilets.js';

describe('Public Toilet Serverless API Handler (#758)', () => {
  beforeEach(() => {
    TOILET_SUBMISSION_QUEUE.length = 0;
  });

  const createMockRes = () => {
    const res = {
      statusCode: 200,
      headers: {},
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      },
      setHeader(k, v) {
        this.headers[k] = v;
      },
    };
    return res;
  };

  it('generates a stable cryptographic receipt seal', () => {
    const seal = generateToiletReceiptSeal('pt-001', '2026-05-18T10:00:00Z');
    expect(seal).toMatch(/^PT-SEAL-[A-F0-9]{4}-[A-F0-9]{4}$/);
  });

  it('returns health check status on GET', async () => {
    const req = { method: 'GET', headers: {} };
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.service).toBe('public-toilet-service');
  });

  it('rejects unsupported HTTP methods with 405', async () => {
    const req = { method: 'DELETE', headers: {} };
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it('rejects bot honeypot trap fields', () => {
    const errors = validateToiletSubmissionPayload({
      facilityId: 'pt-001',
      reportType: 'maintenance_issue',
      description: 'Broken tap',
      website_trap: 'http://spam.ru',
    });
    expect(errors.some((e) => e.includes('Automated submission'))).toBe(true);
  });

  it('rejects submissions with PII (phone number or Aadhaar)', () => {
    const errors = validateToiletSubmissionPayload({
      facilityId: 'pt-001',
      reportType: 'maintenance_issue',
      description: 'Please fix faucet or call me at 9876543210',
    });
    expect(errors.some((e) => e.includes('phone numbers'))).toBe(true);
  });

  it('successfully processes valid incident report and returns 201 with receipt seal', async () => {
    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      body: {
        facilityId: 'pt-blr-ward150-001',
        reportType: 'maintenance_issue',
        category: 'plumbing_leak',
        description: 'Flush button stuck in male cabin 2, water continuously running.',
      },
    };
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.receiptSeal).toMatch(/^PT-SEAL-/);
    expect(TOILET_SUBMISSION_QUEUE.length).toBe(1);
    expect(TOILET_SUBMISSION_QUEUE[0].facilityId).toBe('pt-blr-ward150-001');
  });
});

