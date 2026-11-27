/**
 * tests/explainable-service-ranker.test.js
 *
 * API integration & authorization tests for Explainable Service Ranker (#1430).
 */

import { describe, it, expect } from 'vitest';
import handler from '../api/_lib/handlers/explainable-service-ranker.js';

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

describe('explainable-service-ranker API (#1430)', () => {
  it('POST ranks services with explanation factors (200) and rejects PII (400)', async () => {
    const okRes = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/explainable-service-ranker',
        headers: { 'x-forwarded-for': '10.6.0.1' },
        body: { query: 'income certificate', jurisdiction: 'All', taskStage: 'discovery' },
      },
      okRes
    );
    expect(okRes.statusCode).toBe(200);
    expect(okRes.body.results.length).toBeGreaterThan(0);
    expect(okRes.body.results[0].explanationFactors).toHaveLength(4);

    const piiRes = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/explainable-service-ranker',
        headers: { 'x-forwarded-for': '10.6.0.2' },
        body: { query: '1234 5678 9012' },
      },
      piiRes
    );
    expect(piiRes.statusCode).toBe(400);
  });

  it('GET /eval enforces reviewer/admin auth (401/403) and returns evaluation metrics (200)', async () => {
    const unauthRes = createMockRes();
    await handler(
      { method: 'GET', url: '/api/explainable-service-ranker/eval', headers: { 'x-forwarded-for': '10.6.0.3' } },
      unauthRes
    );
    expect(unauthRes.statusCode).toBe(401);

    const citRes = createMockRes();
    await handler(
      { method: 'GET', url: '/api/explainable-service-ranker/eval', headers: { 'x-forwarded-for': '10.6.0.4' } },
      citRes,
      { authUserOverride: { userId: 'cit-1', role: 'citizen' } }
    );
    expect(citRes.statusCode).toBe(403);

    const adminRes = createMockRes();
    await handler(
      { method: 'GET', url: '/api/explainable-service-ranker/eval', headers: { 'x-forwarded-for': '10.6.0.5' } },
      adminRes,
      { authUserOverride: { userId: 'admin-1', role: 'admin' } }
    );
    expect(adminRes.statusCode).toBe(200);
    expect(adminRes.body.evaluation.fairnessInvariantPassed).toBe(true);
  });
});
