import { describe, it, expect, beforeEach } from 'vitest';
import {
  createCivicAgentEvalHandler,
  resetDefaultEvalStoreForTests,
} from './civic-agent-eval.js';
import { createRateLimiter } from '../abuseGuard.js';

function createMockRes() {
  const headers = {};
  let statusCode = 200;
  let body = null;
  return {
    setHeader(k, v) {
      headers[k.toLowerCase()] = v;
    },
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      body = data;
      return this;
    },
    get statusCode() {
      return statusCode;
    },
    get body() {
      return body;
    },
    get headers() {
      return headers;
    },
  };
}

describe('API /api/civic-agent-eval Handler (#1147)', () => {
  beforeEach(() => {
    resetDefaultEvalStoreForTests();
  });

  it('serves health/schema and filtered synthetic scenarios publicly', async () => {
    const handler = createCivicAgentEvalHandler({
      verifyOperator: async () => ({ ok: false, status: 401, error: 'Unauthorized' }),
    });

    const healthRes = createMockRes();
    await handler({ method: 'GET', url: '/api/civic-agent-eval?schema=1', headers: {} }, healthRes);
    expect(healthRes.statusCode).toBe(200);
    expect(healthRes.body.service).toBe('civic-agent-eval');
    expect(healthRes.body.schemaVersion).toBe('1.0.0');

    const scenRes = createMockRes();
    await handler(
      { method: 'GET', url: '/api/civic-agent-eval/scenarios?category=adversarial', headers: {} },
      scenRes
    );
    expect(scenRes.statusCode).toBe(200);
    expect(scenRes.body.scenarios.length).toBeGreaterThanOrEqual(3);
    expect(scenRes.body.scenarios.every((s) => s.category === 'adversarial')).toBe(true);
  });

  it('enforces operator permission boundaries (401 unauthenticated, 403 non-admin)', async () => {
    const unauthHandler = createCivicAgentEvalHandler({
      verifyOperator: async () => ({ ok: false, status: 401, error: 'Authentication required.' }),
    });
    const r401 = createMockRes();
    await unauthHandler(
      { method: 'POST', url: '/api/civic-agent-eval/runs', headers: {}, body: {} },
      r401
    );
    expect(r401.statusCode).toBe(401);

    const citizenHandler = createCivicAgentEvalHandler({
      verifyOperator: async () => ({ ok: false, status: 403, error: 'Operator admin role required.' }),
    });
    const r403 = createMockRes();
    await citizenHandler(
      { method: 'POST', url: '/api/civic-agent-eval/thresholds', headers: {}, body: {} },
      r403
    );
    expect(r403.statusCode).toBe(403);
  });

  it('validates untrusted input and rejects unknown fields or PII keys with 400', async () => {
    const adminHandler = createCivicAgentEvalHandler({
      verifyOperator: async () => ({ ok: true, actorId: 'admin-1', role: 'admin' }),
    });

    const unknownRes = createMockRes();
    await adminHandler(
      {
        method: 'POST',
        url: '/api/civic-agent-eval/runs',
        headers: {},
        body: { targetId: 'civic-agent-pipeline', unknownInjectionField: true },
      },
      unknownRes
    );
    expect(unknownRes.statusCode).toBe(400);
    expect(unknownRes.body.error).toBe('validation_failed');

    const piiRes = createMockRes();
    await adminHandler(
      {
        method: 'POST',
        url: '/api/civic-agent-eval/runs',
        headers: {},
        body: {
          scenarios: [
            {
              id: 'eval-bad-pii',
              domain: 'identity',
              category: 'core',
              language: 'en',
              jurisdiction: 'national',
              query: 'test',
              refusalExpected: false,
              aadhaarNumber: '111122223333',
            },
          ],
        },
      },
      piiRes
    );
    expect(piiRes.statusCode).toBe(400);
  });

  it('executes runs, stores redacted traces, compares runs, and enforces rate limits', async () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 60 * 1000 });
    const handler = createCivicAgentEvalHandler({
      verifyOperator: async () => ({ ok: true, actorId: 'admin-1', role: 'admin' }),
      rateLimiter: limiter,
    });

    // Run 1: baseline
    const run1Res = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/civic-agent-eval/runs',
        headers: { 'x-real-ip': '10.0.0.1' },
        body: { targetId: 'civic-agent-pipeline', category: 'adversarial', modelVersion: '1.0.0' },
      },
      run1Res
    );
    expect(run1Res.statusCode).toBe(201);
    const run1Id = run1Res.body.run.runId;
    const piiTrace = run1Res.body.run.traces.find(
      (t) => t.scenarioId === 'eval-adversarial-synthetic-pii-scrub'
    );
    expect(piiTrace.redactedQuery).not.toContain('9876543210');

    // Run 2: candidate
    const run2Res = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/civic-agent-eval/runs',
        headers: { 'x-real-ip': '10.0.0.1' },
        body: { targetId: 'model-gateway', category: 'adversarial', modelVersion: '1.1.0' },
      },
      run2Res
    );
    expect(run2Res.statusCode).toBe(201);
    const run2Id = run2Res.body.run.runId;

    // Fetch run by ID
    const getRunRes = createMockRes();
    await handler({ method: 'GET', url: `/api/civic-agent-eval/runs/${run1Id}`, headers: {} }, getRunRes);
    expect(getRunRes.statusCode).toBe(200);
    expect(getRunRes.body.run.runId).toBe(run1Id);

    // Compare runs (3rd POST)
    const cmpRes = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/civic-agent-eval/compare',
        headers: { 'x-real-ip': '10.0.0.1' },
        body: { baselineRunId: run1Id, candidateRunId: run2Id },
      },
      cmpRes
    );
    expect(cmpRes.statusCode).toBe(200);
    expect(cmpRes.body.report.baseline.runId).toBe(run1Id);
    expect(cmpRes.body.report.candidate.runId).toBe(run2Id);

    // 4th POST hits rate limit 429
    const rateLimitedRes = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/civic-agent-eval/thresholds',
        headers: { 'x-real-ip': '10.0.0.1' },
        body: { minTaskSuccessRate: 0.9 },
      },
      rateLimitedRes
    );
    expect(rateLimitedRes.statusCode).toBe(429);
    expect(rateLimitedRes.headers['retry-after']).toBeDefined();

    // Missing run 404
    const missingRes = createMockRes();
    await handler({ method: 'GET', url: '/api/civic-agent-eval/runs/does-not-exist', headers: {} }, missingRes);
    expect(missingRes.statusCode).toBe(404);

    // Unsupported method 405
    const methodRes = createMockRes();
    await handler({ method: 'DELETE', url: '/api/civic-agent-eval/runs', headers: {} }, methodRes);
    expect(methodRes.statusCode).toBe(405);
  });
});
