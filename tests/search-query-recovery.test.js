/**
 * tests/search-query-recovery.test.js
 *
 * API integration & authorization tests for Search Query Recovery (#1431).
 */

import { describe, it, expect } from 'vitest';
import handler from '../api/_lib/handlers/search-query-recovery.js';

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) { this.headers[k] = v; return this; },
    status(code) { this.statusCode = code; return this; },
    end(raw) { try { this.body = JSON.parse(raw); } catch { this.body = raw; } return res; },
  };
  return res;
}

describe('search-query-recovery API (#1431)', () => {
  it('POST recovers typos while preserving legal identifiers and originalQuery (200)', async () => {
    const req = {
      method: 'POST',
      url: '/api/search-query-recovery',
      headers: { 'x-forwarded-for': '10.5.0.1' },
      body: { query: 'incme certficate Form 16' },
    };
    const res = createMockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.recovery.originalQuery).toBe('incme certficate Form 16');
    expect(res.body.recovery.correctedQuery).toBe('income certificate Form 16');
  });

  it('POST rejects queries containing Aadhaar or PAN PII (400)', async () => {
    const req = {
      method: 'POST',
      url: '/api/search-query-recovery',
      headers: { 'x-forwarded-for': '10.5.0.2' },
      body: { query: 'status for 1234 5678 9012' },
    };
    const res = createMockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/personal identity numbers/i);
  });

  it('POST /evaluate enforces reviewer/admin auth (401/403) and records evaluation (201)', async () => {
    const unauthRes = createMockRes();
    await handler(
      { method: 'POST', url: '/api/search-query-recovery/evaluate', headers: { 'x-forwarded-for': '10.5.0.3' }, body: {} },
      unauthRes
    );
    expect(unauthRes.statusCode).toBe(401);

    const citRes = createMockRes();
    await handler(
      { method: 'POST', url: '/api/search-query-recovery/evaluate', headers: { 'x-forwarded-for': '10.5.0.4' }, body: { originalQuery: 'x', accepted: true } },
      citRes,
      { authUserOverride: { userId: 'cit-1', role: 'citizen' } }
    );
    expect(citRes.statusCode).toBe(403);

    const revRes = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/search-query-recovery/evaluate',
        headers: { 'x-forwarded-for': '10.5.0.5' },
        body: { originalQuery: 'incme certficate', correctedQuery: 'income certificate', accepted: true },
      },
      revRes,
      { authUserOverride: { userId: 'rev-1', role: 'reviewer' } }
    );
    expect(revRes.statusCode).toBe(201);
    expect(revRes.body.evaluation.accepted).toBe(true);
  });
});
