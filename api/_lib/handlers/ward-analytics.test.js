import { describe, it, expect, beforeEach } from 'vitest';
import handler from './ward-analytics.js';
import { resetBudgetLedger } from '../../../src/services/privacyBudgetService.js';
import { resetCivicReports } from '../../../src/services/wardIssueHeatmapStorage.js';

const createMockRes = () => {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(key, value) {
      this.headers[key.toLowerCase()] = value;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  return res;
};

describe('ward-analytics API handler', () => {
  beforeEach(() => {
    resetBudgetLedger();
    resetCivicReports();
  });

  it('handles GET requests and returns 200 with differentially private payload', async () => {
    const req = {
      method: 'GET',
      headers: { 'x-forwarded-for': '198.51.100.1' },
      query: { wardId: 'WARD-101', timeWindow: '30d', epsilon: '0.5' },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.schemaVersion).toBe('1.0.0');
    expect(res.body.privacyMetadata.appliedEpsilon).toBe(0.5);
    expect(res.headers['cache-control']).toBeDefined();
  });

  it('returns 400 for invalid query parameters', async () => {
    const req = {
      method: 'GET',
      headers: { 'x-forwarded-for': '198.51.100.2' },
      query: { timeWindow: '365d' }, // invalid window
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('INVALID_QUERY_PARAMS');
  });

  it('returns 429 when client exhausts privacy budget', async () => {
    const clientIp = '198.51.100.99';

    // Drain budget with 6 queries of 0.5 epsilon = 3.0
    for (let i = 0; i < 6; i++) {
      const req = {
        method: 'GET',
        headers: { 'x-forwarded-for': clientIp },
        query: { wardId: `WARD-${101 + i}`, epsilon: '0.5' },
      };
      const res = createMockRes();
      await handler(req, res);
      expect(res.statusCode).toBe(200);
    }

    // 7th query must receive 429
    const reqExhaust = {
      method: 'GET',
      headers: { 'x-forwarded-for': clientIp },
      query: { wardId: 'WARD-110', epsilon: '0.5' },
    };
    const resExhaust = createMockRes();
    await handler(reqExhaust, resExhaust);

    expect(resExhaust.statusCode).toBe(429);
    expect(resExhaust.body.error).toBe('BUDGET_EXHAUSTED');
    expect(resExhaust.headers['retry-after']).toBeDefined();
  });

  it('handles POST to submit a valid civic report', async () => {
    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '198.51.100.3' },
      body: {
        wardId: 'WARD-102',
        category: 'sanitation_garbage',
        timestamp: new Date().toISOString(),
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.reportId).toBeDefined();
  });

  it('rejects POST containing forbidden PII (Aadhaar/Phone)', async () => {
    const reqWithAadhaar = {
      method: 'POST',
      headers: { 'x-forwarded-for': '198.51.100.4' },
      body: {
        wardId: 'WARD-102',
        category: 'sanitation_garbage',
        notes: 'Complainant Aadhaar is 5544 3322 1100 please help',
      },
    };
    const res = createMockRes();

    await handler(reqWithAadhaar, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('PII_DETECTED');
  });

  it('rejects unsupported HTTP methods with 405', async () => {
    const req = {
      method: 'DELETE',
      headers: { 'x-forwarded-for': '198.51.100.5' },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(res.body.error).toBe('Method not allowed');
  });
});
