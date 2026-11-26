/**
 * tests/civic-source-freshness-prediction-api.test.js
 *
 * Integration tests for the Civic Information Freshness Prediction and Review
 * Prioritization Engine API route (#1189). The handler is dependency-injected,
 * so no Clerk, Firebase or network access is required.
 *
 * Synthetic fixtures only: no citizen records, credentials, raw documents or
 * sensitive prompts.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createCivicSourceFreshnessPredictionHandler } from '../api/civic-source-freshness-prediction.js';
import { resetProductionFreshnessStoreCacheForTests } from '../api/_lib/civicSourceFreshnessPredictionStore.js';
import { InMemoryFreshnessStore } from '../api/_lib/civicSourceFreshnessPredictionStore.js';
import {
  validatePredict,
  validateReviewPrediction,
  validateListQuery,
  validateDriftEvent
} from '../api/_lib/civicSourceFreshnessPredictionSchemas.js';
import { createFreshnessPredictionEngine } from '../src/services/civicSourceFreshnessPredictionEngine.js';

const FIXED_NOW = new Date('2026-11-24T10:00:00Z');

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
  const store = new InMemoryFreshnessStore();

  const engine = createFreshnessPredictionEngine({
    loadStore: () => ({
      schemaVersion: 1,
      predictions: Array.from(store.predictions.values()),
      predictionHistory: [],
      reviewAudit: [],
      driftEvents: [],
      meta: {}
    }),
    runTransaction: (mutator) => {
      const draft = {
        schemaVersion: 1,
        predictions: Array.from(store.predictions.values()),
        predictionHistory: [],
        reviewAudit: [],
        driftEvents: [],
        meta: {}
      };
      const result = mutator(draft);
      for (const prediction of draft.predictions) store.predictions.set(prediction.serviceId, prediction);
      return { data: {}, result };
    },
    now: () => FIXED_NOW.getTime()
  });

  const verifySession = vi.fn(overrides.verifySession || (async () => ({ userId: 'user-1' })));
  const handler = createCivicSourceFreshnessPredictionHandler({
    verifySession,
    getStore: async () => store,
    engine,
    now: () => FIXED_NOW.getTime()
  });
  return { handler, verifySession, store, engine };
}

describe('civic-source-freshness-prediction API', () => {
  beforeEach(() => {
    resetProductionFreshnessStoreCacheForTests();
    vi.restoreAllMocks();
  });

  it('returns schema version and health', async () => {
    const { handler } = makeHandler();
    const req = { method: 'GET', url: '/api/civic-source-freshness-prediction?schema=1', headers: {}, query: { schema: '1' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.schemaVersion).toBe(1);
    expect(res.body.service).toBe('civic-source-freshness-prediction');
  });

  it('predicts a service (no auth required for reads)', async () => {
    const { handler } = makeHandler();
    const req = {
      method: 'POST',
      url: '/api/civic-source-freshness-prediction/predict',
      headers: {},
      body: {
        serviceId: 'service-1',
        service: {
          id: 'service-1',
          name: 'Service One',
          officialSources: [{ name: 'Portal', url: 'https://example.gov.in/service' }],
          lastVerified: '2025-01-01'
        },
        linkHealthRecords: {},
        verificationHistory: []
      }
    };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.prediction.serviceId).toBe('service-1');
    expect(res.body.prediction.priorityScore).toBeGreaterThanOrEqual(0);
    expect(res.body.prediction.priorityScore).toBeLessThanOrEqual(100);
  });

  it('rejects invalid predict input', async () => {
    const { handler } = makeHandler();
    const req = {
      method: 'POST',
      url: '/api/civic-source-freshness-prediction/predict',
      headers: {},
      body: { serviceId: 'Bad Id' }
    };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  it('lists predictions', async () => {
    const { handler, engine } = makeHandler();
    await engine.predict({
      serviceId: 'service-list',
      service: { id: 'service-list', name: 'List', officialSources: [], lastVerified: null },
      nowIso: FIXED_NOW
    });
    const req = { method: 'GET', url: '/api/civic-source-freshness-prediction/predictions', headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.predictions)).toBe(true);
  });

  it('gets a prediction by service id', async () => {
    const { handler, engine } = makeHandler();
    await engine.predict({
      serviceId: 'service-get',
      service: { id: 'service-get', name: 'Get', officialSources: [], lastVerified: null },
      nowIso: FIXED_NOW
    });
    const req = { method: 'GET', url: '/api/civic-source-freshness-prediction/predictions/service-get', headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.prediction.serviceId).toBe('service-get');
  });

  it('reviews a prediction (review-gated)', async () => {
    const { handler, engine, verifySession } = makeHandler();
    await engine.predict({
      serviceId: 'service-review',
      service: { id: 'service-review', name: 'Review', officialSources: [], lastVerified: null },
      nowIso: FIXED_NOW
    });
    const req = {
      method: 'POST',
      url: '/api/civic-source-freshness-prediction/predictions/service-review/review',
      headers: { authorization: 'Bearer valid-token-12345' },
      body: { serviceId: 'service-review', reviewerNote: 'Confirmed stale.', reviewedBy: 'maintainer', decision: 'reviewed' }
    };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(verifySession).toHaveBeenCalled();
  });

  it('rejects review without a token', async () => {
    const { handler } = makeHandler();
    const req = {
      method: 'POST',
      url: '/api/civic-source-freshness-prediction/predictions/service-review/review',
      headers: {},
      body: { serviceId: 'service-review' }
    };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('missing_token');
  });

  it('records a drift event (review-gated)', async () => {
    const { handler, verifySession } = makeHandler();
    const req = {
      method: 'POST',
      url: '/api/civic-source-freshness-prediction/drift-events',
      headers: { authorization: 'Bearer valid-token-12345' },
      body: { serviceId: 'service-drift', previousScore: 0.4, currentScore: 0.75, reason: 'Link health deteriorated.' }
    };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(verifySession).toHaveBeenCalled();
  });

  it('lists feature weights', async () => {
    const { handler } = makeHandler();
    const req = { method: 'GET', url: '/api/civic-source-freshness-prediction/feature-weights', headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(typeof res.body.weights).toBe('object');
  });

  it('schema validation functions reject bad input', () => {
    expect(validatePredict({ serviceId: 'Bad Id' }).valid).toBe(false);
    expect(validateReviewPrediction({ serviceId: 'Bad Id' }).valid).toBe(false);
    expect(validateListQuery({ band: 'invalid' }).valid).toBe(false);
    expect(validateDriftEvent({ serviceId: 'Bad Id' }).valid).toBe(false);
  });

  it('returns 405 for unsupported methods', async () => {
    const { handler } = makeHandler();
    const req = { method: 'DELETE', url: '/api/civic-source-freshness-prediction/predictions', headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });
});
