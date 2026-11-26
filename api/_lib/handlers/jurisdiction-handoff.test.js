import { describe, it, expect } from 'vitest';
import handler, {
  validateJurisdictionPayload,
  generateJurisdictionReceiptSeal,
} from './jurisdiction-handoff.js';

describe('Jurisdiction Hand-off API Handler (#815)', () => {
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
    const seal = generateJurisdictionReceiptSeal('birth-certificate', 'chennai', '2026-11-20T12:00:00Z');
    expect(seal).toMatch(/^JH-SEAL-[A-F0-9]{4}-[A-F0-9]{4}$/);
  });

  it('returns health check and paginated services on GET', async () => {
    const req = { method: 'GET', url: '/api/jurisdiction-handoff?page=1&limit=5', headers: {} };
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.service).toBe('jurisdiction-handoff-service');
    expect(res.body.status).toBe('healthy');
    expect(Array.isArray(res.body.services)).toBe(true);
    expect(res.body.services.length).toBeLessThanOrEqual(5);
  });

  it('rejects unsupported HTTP methods with 405', async () => {
    const req = { method: 'DELETE', url: '/api/jurisdiction-handoff', headers: {} };
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(405);
    expect(res.body.error).toBe('method_not_allowed');
  });

  it('rejects bot honeypot trap fields', () => {
    const errors = validateJurisdictionPayload({
      serviceId: 'birth-certificate',
      locality: 'chennai',
      website_trap: 'http://spam-bot.xyz',
    });
    expect(errors.some((e) => e.includes('Automated submission'))).toBe(true);
  });

  it('rejects submissions with PII (Aadhaar, phone, PAN)', () => {
    const errorsAadhaar = validateJurisdictionPayload({
      serviceId: 'birth-certificate',
      locality: 'My house 1234 5678 9012',
    });
    expect(errorsAadhaar.some((e) => e.includes('Aadhaar'))).toBe(true);

    const errorsPhone = validateJurisdictionPayload({
      serviceId: 'birth-certificate',
      locality: 'Sector 42 9876543210',
    });
    expect(errorsPhone.some((e) => e.includes('phone numbers'))).toBe(true);
  });

  it('resolves valid jurisdiction on POST and returns 200 with receipt seal', async () => {
    const req = {
      method: 'POST',
      url: '/api/jurisdiction-handoff',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      body: {
        serviceId: 'birth-certificate',
        locality: 'chennai',
        state: 'Tamil Nadu',
      },
    };
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.receiptSeal).toMatch(/^JH-SEAL-/);
    expect(res.body.resolution.success).toBe(true);
    expect(res.body.graph.stages.length).toBeGreaterThan(0);
  });

  it('detects ambiguity and returns confirmation flag on ambiguous locality', async () => {
    const req = {
      method: 'POST',
      url: '/api/jurisdiction-handoff',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      body: {
        serviceId: 'birth-certificate',
        locality: 'north delhi',
        state: 'Delhi',
      },
    };
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.resolution.ambiguity).toBe(true);
    expect(res.body.resolution.requiresConfirmation).toBe(true);
  });

  it('returns 404 when service is not in supported catalogue', async () => {
    const req = {
      method: 'POST',
      url: '/api/jurisdiction-handoff',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      body: {
        serviceId: 'non-existent-service-12345',
        locality: 'chennai',
      },
    };
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('service_not_found');
  });

  it('rejects malformed pagination input with 400', async () => {
    const req = {
      method: 'GET',
      url: '/api/jurisdiction-handoff?page=invalid&limit=-5',
      headers: {},
    };
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('invalid_pagination');
  });

  it('returns empty results when page exceeds catalogue size', async () => {
    const req = {
      method: 'GET',
      url: '/api/jurisdiction-handoff?page=999&limit=10',
      headers: {},
    };
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.services).toEqual([]);
  });

  it('enforces role-based authorization: denies non-admin PUT mutation with 403', async () => {
    const req = {
      method: 'PUT',
      url: '/api/jurisdiction-handoff',
      headers: { 'x-user-role': 'citizen' },
      body: { locality: 'chennai' },
    };
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('permission_denied');
  });

  it('allows authorized administrative PUT mutations with 200 and audit log', async () => {
    const req = {
      method: 'PUT',
      url: '/api/jurisdiction-handoff',
      headers: {
        'x-user-role': 'admin',
        'x-user-id': 'officer-42',
      },
      body: { locality: 'chennai' },
    };
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.audited).toBe(true);
    expect(res.body.auditId).toMatch(/^AUDIT-JH-/);
  });
});
