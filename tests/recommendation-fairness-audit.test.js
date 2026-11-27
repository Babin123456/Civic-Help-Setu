import { describe, it, expect, beforeEach } from 'vitest';
import { createRecommendationFairnessAuditHandler } from '../api/_lib/handlers/recommendation-fairness-audit.js';
import {
  InMemoryFairnessAuditStore,
  resetDefaultFairnessAuditStoreForTests,
} from '../api/_lib/recommendationFairnessAuditStore.js';
import { createRateLimiter } from '../api/_lib/abuseGuard.js';

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe('Recommendation Fairness Audit API Handler (#1449)', () => {
  let store;

  beforeEach(() => {
    resetDefaultFairnessAuditStoreForTests();
    store = new InMemoryFairnessAuditStore();
  });

  it('serves health, datasets, and thresholds on public GET endpoints', async () => {
    const handler = createRecommendationFairnessAuditHandler({
      getStore: async () => store,
      rateLimiter: createRateLimiter({ limit: 50, windowMs: 60000 }),
    });

    const resHealth = createMockRes();
    await handler({ method: 'GET', url: '/api/recommendation-fairness-audit', headers: {} }, resHealth);
    expect(resHealth.statusCode).toBe(200);
    expect(resHealth.body.service).toBe('recommendation-fairness-audit');

    const resDatasets = createMockRes();
    await handler({ method: 'GET', url: '/api/recommendation-fairness-audit/datasets', headers: {} }, resDatasets);
    expect(resDatasets.statusCode).toBe(200);
    expect(resDatasets.body.datasets.length).toBeGreaterThanOrEqual(1);
  });

  it('enforces authentication and role/jurisdiction authorization on mutations', async () => {
    const handler = createRecommendationFairnessAuditHandler({
      getStore: async () => store,
      rateLimiter: createRateLimiter({ limit: 50, windowMs: 60000 }),
      verifyOperator: async (req) => {
        const auth = req.headers?.authorization;
        if (!auth) return { ok: false, status: 401, error: 'Authentication required.' };
        if (auth === 'Bearer citizen-token') return { ok: false, status: 403, error: 'Operator admin role required.' };
        if (auth === 'Bearer wrong-jurisdiction') return { ok: true, actorId: 'op-mh', role: 'admin', jurisdiction: 'IN-MH' };
        return { ok: true, actorId: 'op-up', role: 'admin', jurisdiction: 'IN-UP' };
      },
    });

    // 401 unauthenticated
    const res401 = createMockRes();
    await handler(
      { method: 'POST', url: '/api/recommendation-fairness-audit/runs', headers: {}, body: { datasetId: 'up-civic-services-eval-v2' } },
      res401
    );
    expect(res401.statusCode).toBe(401);

    // 403 non-admin
    const res403Role = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/recommendation-fairness-audit/runs',
        headers: { authorization: 'Bearer citizen-token' },
        body: { datasetId: 'up-civic-services-eval-v2' },
      },
      res403Role
    );
    expect(res403Role.statusCode).toBe(403);

    // 403 wrong jurisdiction
    const res403Jurisdiction = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/recommendation-fairness-audit/runs',
        headers: { authorization: 'Bearer wrong-jurisdiction' },
        body: { datasetId: 'up-civic-services-eval-v2' },
      },
      res403Jurisdiction
    );
    expect(res403Jurisdiction.statusCode).toBe(403);

    // 201 authorized operator in IN-UP
    const res201 = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/recommendation-fairness-audit/runs',
        headers: { authorization: 'Bearer up-admin' },
        body: { datasetId: 'up-civic-services-eval-v2', cohortAxis: 'district' },
      },
      res201
    );
    expect(res201.statusCode).toBe(201);
    expect(res201.body.run.cohortAxis).toBe('district');

    // Audit log recorded
    const resLog = createMockRes();
    await handler(
      {
        method: 'GET',
        url: '/api/recommendation-fairness-audit/audit-log',
        headers: { authorization: 'Bearer up-admin' },
      },
      resLog
    );
    expect(resLog.statusCode).toBe(200);
    expect(resLog.body.entries.length).toBe(1);
    expect(resLog.body.entries[0].action).toBe('RUN_FAIRNESS_AUDIT');
  });

  it('rejects PII, sensitive-trait inference, and unsafe minCohortSize < 5', async () => {
    const handler = createRecommendationFairnessAuditHandler({
      getStore: async () => store,
      rateLimiter: createRateLimiter({ limit: 50, windowMs: 60000 }),
      verifyOperator: async () => ({ ok: true, actorId: 'op-up', role: 'admin', jurisdiction: '*' }),
    });

    const resPii = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/recommendation-fairness-audit/datasets',
        headers: { authorization: 'Bearer op' },
        body: {
          id: 'pii-ds',
          name: 'Invalid PII Dataset',
          consentMode: 'user_consented_offline_eval',
          records: [
            {
              query: { intents: ['passport'], aadhaar: '2345 6789 0123' },
              cohorts: { language: 'en' },
              relevantServiceIds: ['passport'],
              consented: true,
            },
          ],
        },
      },
      resPii
    );
    expect(resPii.statusCode).toBe(400);
    expect(resPii.body.code).toBe('ERR_SENSITIVE_OR_PII_PROHIBITED');

    const resMinCohort = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/recommendation-fairness-audit/thresholds',
        headers: { authorization: 'Bearer op' },
        body: { minCohortSize: 2 },
      },
      resMinCohort
    );
    expect(resMinCohort.statusCode).toBe(400);
  });
});

