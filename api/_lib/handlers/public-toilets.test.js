import { describe, it, expect, beforeEach } from 'vitest';
import {
  createPublicToiletHandler,
  validateToiletSubmissionPayload,
  generateToiletReceiptSeal,
} from './public-toilets.js';
import { FirestoreToiletStore } from '../publicToiletStore.js';
import { ToiletFirestoreFixture } from '../../../tests/helpers/toiletFirestore.js';

let handler;
let db;

describe('Public Toilet Serverless API Handler (#758)', () => {
  beforeEach(() => {
    db = new ToiletFirestoreFixture();
    handler = createPublicToiletHandler({ getStore: async () => new FirestoreToiletStore(db) });
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
      headers: { 'x-forwarded-for': '127.0.0.1', 'idempotency-key': 'valid-test-key-123456' },
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
    expect(res.body.receiptSeal).toMatch(/^PT-[a-f0-9-]{36}$/);
    expect(db.records.size).toBe(1);
    expect([...db.records.values()][0].facilityId).toBe('pt-blr-ward150-001');
  });
});

