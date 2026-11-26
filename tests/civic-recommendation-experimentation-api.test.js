/**
 * tests/civic-recommendation-experimentation-api.test.js
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createCivicRecommendationExperimentationHandler
} from '../api/civic-recommendation-experimentation.js';
import {
  InMemoryExperimentationStore
} from '../api/_lib/civicRecommendationExperimentationStore.js';
import {
  createRecommendationExperimentationEngine
} from '../src/services/civicRecommendationExperimentationEngine.js';
import {
  SYNTHETIC_EXPERIMENTS,
  SYNTHETIC_SAFE_CONTEXTS,
  SYNTHETIC_PROHIBITED_CONTEXTS
} from './fixtures/civicRecommendationExperimentationSyntheticFixtures.js';

function mockRes() {
  const headers = {};
  const res = {
    statusCode: null,
    headers,
    setHeader(k, v) { headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    getHeader(k) { return headers[k]; }
  };
  return res;
}

function makeHandler(overrides = {}) {
  const store = new InMemoryExperimentationStore();

  const engine = createRecommendationExperimentationEngine({
    loadStore: () => ({
      schemaVersion: 1,
      experiments: store.listExperiments(),
      metricsLog: store.metricsLog,
      auditLog: store.auditLog,
      meta: {}
    }),
    persistStore: (draft) => {
      for (const exp of draft.experiments) store.setExperiment(exp.id, exp);
      store.auditLog = draft.auditLog || [];
      store.metricsLog = draft.metricsLog || [];
      return draft;
    }
  });

  const verifySession = vi.fn(async (token) => {
    if (token === 'op-token') return { userId: 'operator-1' };
    if (token === 'user-token') return { userId: 'citizen-1' };
    throw new Error('invalid token');
  });

  const authorizeOperator = vi.fn(async (req) => {
    const auth = req.headers?.authorization;
    if (auth === 'Bearer op-token') return { userId: 'operator-1', role: 'admin' };
    return { status: 403, error: 'operator_access_denied' };
  });

  const handler = createCivicRecommendationExperimentationHandler({
    verifySession,
    authorizeOperator,
    getStore: async () => store,
    engine,
    ...overrides
  });

  return { handler, store, verifySession, authorizeOperator, engine };
}

describe('civic-recommendation-experimentation API', () => {
  let ctx;

  beforeEach(() => {
    ctx = makeHandler();
  });

  it('returns schema version and health on GET /?health', async () => {
    const req = { method: 'GET', url: '/api/civic-recommendation-experimentation?health' };
    const res = mockRes();
    await ctx.handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.schemaVersion).toBe(1);
    expect(res.body.status).toBe('healthy');
  });

  it('rejects operator-gated POST /experiments without token', async () => {
    const req = {
      method: 'POST',
      url: '/api/civic-recommendation-experimentation/experiments',
      body: SYNTHETIC_EXPERIMENTS[0]
    };
    const res = mockRes();
    await ctx.handler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('missing_token');
  });

  it('rejects non-operator tokens for POST /experiments', async () => {
    const req = {
      method: 'POST',
      url: '/api/civic-recommendation-experimentation/experiments',
      headers: { authorization: 'Bearer user-token' },
      body: SYNTHETIC_EXPERIMENTS[0]
    };
    const res = mockRes();
    await ctx.handler(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('operator_access_denied');
  });

  it('accepts valid experiment registration by operator', async () => {
    const req = {
      method: 'POST',
      url: '/api/civic-recommendation-experimentation/experiments',
      headers: { authorization: 'Bearer op-token' },
      body: SYNTHETIC_EXPERIMENTS[0]
    };
    const res = mockRes();
    await ctx.handler(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.experiment.id).toBe(SYNTHETIC_EXPERIMENTS[0].id);
  });

  it('rejects experiment registration with prohibited sensitive attributes', async () => {
    const req = {
      method: 'POST',
      url: '/api/civic-recommendation-experimentation/experiments',
      headers: { authorization: 'Bearer op-token' },
      body: {
        id: 'exp-prohibited',
        name: 'Prohibited Test',
        audienceCriteria: { religion: 'minority' }
      }
    };
    const res = mockRes();
    await ctx.handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  it('lists registered experiments on GET /experiments', async () => {
    ctx.store.setExperiment(SYNTHETIC_EXPERIMENTS[0].id, SYNTHETIC_EXPERIMENTS[0]);

    const req = { method: 'GET', url: '/api/civic-recommendation-experimentation/experiments' };
    const res = mockRes();
    await ctx.handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.experiments.length).toBe(1);
    expect(res.body.experiments[0].id).toBe(SYNTHETIC_EXPERIMENTS[0].id);
  });

  it('gets a single experiment by id on GET /experiments/:id', async () => {
    ctx.store.setExperiment(SYNTHETIC_EXPERIMENTS[0].id, SYNTHETIC_EXPERIMENTS[0]);

    const req = { method: 'GET', url: `/api/civic-recommendation-experimentation/experiments/${SYNTHETIC_EXPERIMENTS[0].id}` };
    const res = mockRes();
    await ctx.handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.experiment.name).toBe(SYNTHETIC_EXPERIMENTS[0].name);
  });

  it('returns 404 for non-existent experiment', async () => {
    const req = { method: 'GET', url: '/api/civic-recommendation-experimentation/experiments/non-existent-exp' };
    const res = mockRes();
    await ctx.handler(req, res);

    expect(res.statusCode).toBe(404);
  });

  it('deterministically assigns variants on POST /assignments', async () => {
    ctx.store.setExperiment(SYNTHETIC_EXPERIMENTS[0].id, SYNTHETIC_EXPERIMENTS[0]);

    const req = {
      method: 'POST',
      url: '/api/civic-recommendation-experimentation/assignments',
      body: {
        experimentId: SYNTHETIC_EXPERIMENTS[0].id,
        citizenId: 'citizen-999',
        context: SYNTHETIC_SAFE_CONTEXTS[0],
        optIn: true
      }
    };
    const res = mockRes();
    await ctx.handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.assigned).toBe(true);
    expect(res.body.variant).toBeDefined();
    expect(res.body.disclaimer).toContain('deterministic');
  });

  it('rejects prohibited attribute context in POST /assignments', async () => {
    ctx.store.setExperiment(SYNTHETIC_EXPERIMENTS[0].id, SYNTHETIC_EXPERIMENTS[0]);

    const req = {
      method: 'POST',
      url: '/api/civic-recommendation-experimentation/assignments',
      body: {
        experimentId: SYNTHETIC_EXPERIMENTS[0].id,
        citizenId: 'citizen-999',
        context: SYNTHETIC_PROHIBITED_CONTEXTS[0],
        optIn: true
      }
    };
    const res = mockRes();
    await ctx.handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  it('records metrics and checks guardrails on POST /metrics', async () => {
    ctx.store.setExperiment(SYNTHETIC_EXPERIMENTS[0].id, {
      ...SYNTHETIC_EXPERIMENTS[0],
      metrics: {
        control: { assignments: 0, relevanceSum: 0, languageCoverageSum: 0, errorCount: 0 }
      },
      guardrailBreaches: []
    });

    const req = {
      method: 'POST',
      url: '/api/civic-recommendation-experimentation/metrics',
      body: {
        experimentId: SYNTHETIC_EXPERIMENTS[0].id,
        variantId: 'control',
        relevanceScore: 0.90,
        hasLanguageCoverage: true,
        isError: false
      }
    };
    const res = mockRes();
    await ctx.handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.metrics.assignments).toBe(1);
  });

  it('triggers immediate rollback by operator on POST /rollback', async () => {
    ctx.store.setExperiment(SYNTHETIC_EXPERIMENTS[0].id, SYNTHETIC_EXPERIMENTS[0]);

    const req = {
      method: 'POST',
      url: '/api/civic-recommendation-experimentation/rollback',
      headers: { authorization: 'Bearer op-token' },
      body: {
        experimentId: SYNTHETIC_EXPERIMENTS[0].id,
        reason: 'Guardrail breach detected in canary group'
      }
    };
    const res = mockRes();
    await ctx.handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.experiment.status).toBe('rolled_back');
  });

  it('gets comparative metrics on GET /metrics/:id', async () => {
    ctx.store.setExperiment(SYNTHETIC_EXPERIMENTS[0].id, SYNTHETIC_EXPERIMENTS[0]);

    const req = { method: 'GET', url: `/api/civic-recommendation-experimentation/metrics/${SYNTHETIC_EXPERIMENTS[0].id}` };
    const res = mockRes();
    await ctx.handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.metrics.experimentId).toBe(SYNTHETIC_EXPERIMENTS[0].id);
    expect(res.body.metrics.minCohortSize).toBe(25);
  });

  it('returns 405 Method Not Allowed for unsupported methods', async () => {
    const req = { method: 'DELETE', url: '/api/civic-recommendation-experimentation/experiments' };
    const res = mockRes();
    await ctx.handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(res.body.error).toBe('method_not_allowed');
  });
});
