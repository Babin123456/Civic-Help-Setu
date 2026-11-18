/**
 * tests/ward-issue-heatmap.test.js
 * Integration tests for api/_lib/handlers/ward-issue-heatmap.js (#763).
 */
import { describe, it, expect } from 'vitest';
import handler from '../api/_lib/handlers/ward-issue-heatmap.js';

describe('api/ward-issue-heatmap endpoint (#763)', () => {
  const createMockRes = () => {
    const res = {
      statusCode: 200,
      headers: {},
      body: null,
      writableEnded: false,
      setHeader(k, v) {
        this.headers[k] = v;
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        this.writableEnded = true;
        return this;
      },
    };
    return res;
  };

  it('handles GET requests and returns privacy rules', async () => {
    const req = { method: 'GET', query: { action: 'privacy-rules' }, headers: {} };
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.minCohortThreshold).toBe(5);
    expect(res.body.suppressSparseCells).toBe(true);
    expect(res.body.rulesetVersion).toBe('v1.0.0-k5');
  });

  it('handles GET requests for trend series', async () => {
    const req = { method: 'GET', query: { action: 'trends', wardId: 'ward-150' }, headers: {} };
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.wardId).toBe('ward-150');
    expect(res.body.datapoints.length).toBeGreaterThan(0);
    expect(res.body.velocity).toBe('rising');
  });

  it('handles GET summary requests', async () => {
    const req = { method: 'GET', query: {}, headers: {} };
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.title).toContain('Anonymized Ward-Level Civic Issue Heatmap');
    expect(res.body.kAnonymityThreshold).toBe(5);
  });

  it('ingests valid civic reports with anonymized receipt', async () => {
    const req = {
      method: 'POST',
      headers: {},
      body: {
        action: 'ingest',
        wardId: 'ward-101',
        category: 'potholes_road_damage',
        severity: 'high',
        idempotencyKey: `IDEM-TEST-${Date.now()}`,
      },
    };
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.receipt.wardId).toBe('ward-101');
    expect(res.body.receipt.privacyNotice).toContain('No complainant identity retained');
  });

  it('strictly rejects reports containing citizen PII (Aadhaar/PAN/phone)', async () => {
    const req = {
      method: 'POST',
      headers: {},
      body: {
        action: 'ingest',
        wardId: 'ward-101',
        category: 'potholes_road_damage',
        notes: 'Contact citizen at 9876543210 Aadhaar 1234 5678 9012',
      },
    };
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('ERR_PII_PROHIBITED');
  });

  it('allows authorized operator or admin to review recommendations', async () => {
    const req = {
      method: 'POST',
      headers: { 'x-user-role': 'operator' },
      body: {
        action: 'review-recommendation',
        recommendationId: 'REC-2026-001',
        status: 'accepted',
      },
    };
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('accepted');
  });

  it('denies recommendation review to unprivileged public users', async () => {
    const req = {
      method: 'POST',
      headers: { 'x-user-role': 'public' },
      body: {
        action: 'review-recommendation',
        recommendationId: 'REC-2026-001',
        status: 'accepted',
      },
    };
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('ERR_UNAUTHORIZED');
  });

  it('returns 405 Method Not Allowed for unsupported methods', async () => {
    const req = { method: 'DELETE', headers: {} };
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(405);
    expect(res.body.error).toBe('Method Not Allowed');
  });
});

