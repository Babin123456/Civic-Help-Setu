/**
 * tests/civic-contract-test-marketplace-api.test.js
 *
 * Integration tests for the Civic Service Integration Contract Test
 * Marketplace API route (#1191). The handler is dependency-injected, so no
 * Clerk, Firebase or network access is required.
 *
 * Synthetic fixtures only: no citizen records, credentials, raw documents or
 * sensitive prompts.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createCivicContractTestMarketplaceHandler } from '../api/civic-contract-test-marketplace.js';
import { resetContractTestStoreCacheForTests } from '../api/_lib/civicContractTestMarketplaceStore.js';
import { InMemoryContractTestStore } from '../api/_lib/civicContractTestMarketplaceStore.js';
import {
  validateUpsertAdapter,
  validateUpsertSuite,
  validateRunSuite,
  validateListQuery,
  validateRecordDrift
} from '../api/_lib/civicContractTestMarketplaceSchemas.js';
import { createContractTestMarketplaceEngine } from '../src/services/civicContractTestMarketplaceEngine.js';

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
  const store = new InMemoryContractTestStore();

  const engine = createContractTestMarketplaceEngine({
    loadStore: () => ({
      schemaVersion: 1,
      adapters: Array.from(store.adapters.values()),
      suites: Array.from(store.suites.values()),
      tests: Array.from(store.tests.values()),
      runs: Array.from(store.runs.values()),
      results: [],
      auditLog: [],
      meta: {}
    }),
    persistStore: (draft) => {
      for (const adapter of draft.adapters) store.adapters.set(adapter.id, adapter);
      for (const suite of draft.suites) store.suites.set(suite.id, suite);
      for (const test of draft.tests) store.tests.set(test.id, test);
      for (const run of draft.runs) store.runs.set(run.id, run);
      for (const result of draft.results) store.results.push(result);
    },
    runTransaction: (mutator) => {
      const draft = {
        schemaVersion: 1,
        adapters: Array.from(store.adapters.values()),
        suites: Array.from(store.suites.values()),
        tests: Array.from(store.tests.values()),
        runs: Array.from(store.runs.values()),
        results: [],
        auditLog: [],
        meta: {}
      };
      const result = mutator(draft);
      for (const adapter of draft.adapters) store.adapters.set(adapter.id, adapter);
      for (const suite of draft.suites) store.suites.set(suite.id, suite);
      for (const test of draft.tests) store.tests.set(test.id, test);
      for (const run of draft.runs) store.runs.set(run.id, run);
      for (const result of draft.results) store.results.push(result);
      for (const event of draft.auditLog) store.auditLog.push(event);
      return { data: {}, result };
    },
    now: () => FIXED_NOW.getTime()
  });

  const verifySession = vi.fn(overrides.verifySession || (async () => ({ userId: 'user-1' })));
  const authorizeOperator = vi.fn(overrides.authorizeOperator || (async () => ({ userId: 'operator-1', role: 'admin' })));
  const handler = createCivicContractTestMarketplaceHandler({
    verifySession,
    authorizeOperator,
    getStore: async () => store,
    engine,
    now: () => FIXED_NOW.getTime()
  });
  return { handler, verifySession, authorizeOperator, store, engine };
}

describe('civic-contract-test-marketplace API', () => {
  beforeEach(() => {
    resetContractTestStoreCacheForTests();
    vi.restoreAllMocks();
  });

  it('returns schema version and health', async () => {
    const { handler } = makeHandler();
    const req = { method: 'GET', url: '/api/civic-contract-test-marketplace?schema=1', headers: {}, query: { schema: '1' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.schemaVersion).toBe(1);
    expect(res.body.service).toBe('civic-contract-test-marketplace');
  });

  it('registers an adapter (operator-gated)', async () => {
    const { handler, authorizeOperator } = makeHandler();
    const req = {
      method: 'POST',
      url: '/api/civic-contract-test-marketplace/adapters',
      headers: { authorization: 'Bearer operator-token-12345' },
      body: {
        id: 'adapter-1',
        name: 'Test Adapter',
        type: 'rest',
        baseUrl: 'https://example.gov.in/api',
        authType: 'bearer',
        authConfig: {},
        headers: {},
        timeoutMs: 5000,
        retryCount: 2,
        isActive: true,
        description: 'Test adapter'
      }
    };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.adapter.id).toBe('adapter-1');
    expect(authorizeOperator).toHaveBeenCalled();
  });

  it('rejects adapter registration without a token', async () => {
    const { handler } = makeHandler();
    const req = {
      method: 'POST',
      url: '/api/civic-contract-test-marketplace/adapters',
      headers: {},
      body: { id: 'adapter-1', name: 'Test Adapter', type: 'rest', baseUrl: 'https://example.gov.in/api', authType: 'none', authConfig: {}, headers: {}, timeoutMs: 5000, retryCount: 2, isActive: true }
    };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('missing_token');
  });

  it('rejects invalid adapter registration input', async () => {
    const { handler } = makeHandler();
    const req = {
      method: 'POST',
      url: '/api/civic-contract-test-marketplace/adapters',
      headers: { authorization: 'Bearer operator-token-12345' },
      body: { id: 'Bad Id', name: 'Bad', type: 'not-a-type', baseUrl: 'https://example.gov.in/api', authType: 'none', authConfig: {}, headers: {}, timeoutMs: 5000, retryCount: 2, isActive: true }
    };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  it('lists adapters', async () => {
    const { handler, engine } = makeHandler();
    await engine.upsertAdapter({
      id: 'adapter-list',
      name: 'List Adapter',
      type: 'rest',
      baseUrl: 'https://example.gov.in/api',
      authType: 'none',
      authConfig: {},
      headers: {},
      timeoutMs: 5000,
      retryCount: 2,
      isActive: true,
      createdBy: 'maintainer',
      nowIso: FIXED_NOW
    });
    const req = { method: 'GET', url: '/api/civic-contract-test-marketplace/adapters', headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.adapters)).toBe(true);
  });

  it('gets an adapter by id', async () => {
    const { handler, engine } = makeHandler();
    await engine.upsertAdapter({
      id: 'adapter-get',
      name: 'Get Adapter',
      type: 'rest',
      baseUrl: 'https://example.gov.in/api',
      authType: 'none',
      authConfig: {},
      headers: {},
      timeoutMs: 5000,
      retryCount: 2,
      isActive: true,
      createdBy: 'maintainer',
      nowIso: FIXED_NOW
    });
    const req = { method: 'GET', url: '/api/civic-contract-test-marketplace/adapters/adapter-get', headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.adapter.id).toBe('adapter-get');
  });

  it('registers a suite (operator-gated)', async () => {
    const { handler, engine, authorizeOperator } = makeHandler();
    await engine.upsertAdapter({
      id: 'adapter-suite',
      name: 'Suite Adapter',
      type: 'rest',
      baseUrl: 'https://example.gov.in/api',
      authType: 'none',
      authConfig: {},
      headers: {},
      timeoutMs: 5000,
      retryCount: 2,
      isActive: true,
      createdBy: 'maintainer',
      nowIso: FIXED_NOW
    });
    const req = {
      method: 'POST',
      url: '/api/civic-contract-test-marketplace/suites',
      headers: { authorization: 'Bearer operator-token-12345' },
      body: {
        id: 'suite-1',
        adapterId: 'adapter-suite',
        name: 'Test Suite',
        description: 'Test suite',
        status: 'draft',
        tests: [],
        schedule: 'manual'
      }
    };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(authorizeOperator).toHaveBeenCalled();
  });

  it('lists suites', async () => {
    const { handler, engine } = makeHandler();
    await engine.upsertAdapter({
      id: 'adapter-list-suites',
      name: 'List Suites Adapter',
      type: 'rest',
      baseUrl: 'https://example.gov.in/api',
      authType: 'none',
      authConfig: {},
      headers: {},
      timeoutMs: 5000,
      retryCount: 2,
      isActive: true,
      createdBy: 'maintainer',
      nowIso: FIXED_NOW
    });
    await engine.upsertSuite({
      id: 'suite-list',
      adapterId: 'adapter-list-suites',
      name: 'List Suite',
      description: 'List suite',
      status: 'draft',
      tests: [],
      schedule: 'manual',
      createdBy: 'maintainer',
      nowIso: FIXED_NOW
    });
    const req = { method: 'GET', url: '/api/civic-contract-test-marketplace/suites', headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.suites)).toBe(true);
  });

  it('gets a suite by id', async () => {
    const { handler, engine } = makeHandler();
    await engine.upsertAdapter({
      id: 'adapter-get-suite',
      name: 'Get Suite Adapter',
      type: 'rest',
      baseUrl: 'https://example.gov.in/api',
      authType: 'none',
      authConfig: {},
      headers: {},
      timeoutMs: 5000,
      retryCount: 2,
      isActive: true,
      createdBy: 'maintainer',
      nowIso: FIXED_NOW
    });
    await engine.upsertSuite({
      id: 'suite-get',
      adapterId: 'adapter-get-suite',
      name: 'Get Suite',
      description: 'Get suite',
      status: 'draft',
      tests: [],
      schedule: 'manual',
      createdBy: 'maintainer',
      nowIso: FIXED_NOW
    });
    const req = { method: 'GET', url: '/api/civic-contract-test-marketplace/suites/suite-get', headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.suite.id).toBe('suite-get');
  });

  it('runs a suite (user-gated)', async () => {
    const { handler, engine, verifySession } = makeHandler();
    await engine.upsertAdapter({
      id: 'adapter-run-suite',
      name: 'Run Suite Adapter',
      type: 'rest',
      baseUrl: 'https://example.gov.in/api',
      authType: 'none',
      authConfig: {},
      headers: {},
      timeoutMs: 5000,
      retryCount: 2,
      isActive: true,
      createdBy: 'maintainer',
      nowIso: FIXED_NOW
    });
    await engine.upsertSuite({
      id: 'suite-run',
      adapterId: 'adapter-run-suite',
      name: 'Run Suite',
      description: 'Run suite',
      status: 'active',
      tests: [
        {
          id: 'test-1',
          name: 'Auth Test',
          type: 'auth',
          endpoint: '/auth',
          method: 'GET',
          requestSchema: {},
          responseSchema: {},
          expectedStatus: 200,
          expectedHeaders: {},
          expectedBody: {},
          maxResponseTimeMs: 5000,
          followRedirects: false,
          allowMalformedPayloads: false,
          breakingChangeRules: [],
          isCritical: false,
          isEnabled: true
        }
      ],
      schedule: 'manual',
      createdBy: 'maintainer',
      nowIso: FIXED_NOW
    });
    const req = {
      method: 'POST',
      url: '/api/civic-contract-test-marketplace/suites/suite-run/run',
      headers: { authorization: 'Bearer user-token-12345' },
      body: { suiteId: 'suite-run', adapterId: 'adapter-run-suite', forceRecompute: false }
    };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.run).toBeDefined();
    expect(verifySession).toHaveBeenCalled();
  });

  it('gets a run by id', async () => {
    const { handler, engine } = makeHandler();
    await engine.upsertAdapter({
      id: 'adapter-get-run',
      name: 'Get Run Adapter',
      type: 'rest',
      baseUrl: 'https://example.gov.in/api',
      authType: 'none',
      authConfig: {},
      headers: {},
      timeoutMs: 5000,
      retryCount: 2,
      isActive: true,
      createdBy: 'maintainer',
      nowIso: FIXED_NOW
    });
    await engine.upsertSuite({
      id: 'suite-get-run',
      adapterId: 'adapter-get-run',
      name: 'Get Run Suite',
      description: 'Get run suite',
      status: 'active',
      tests: [],
      schedule: 'manual',
      createdBy: 'maintainer',
      nowIso: FIXED_NOW
    });
    await engine.runSuite({ suiteId: 'suite-get-run', adapterId: 'adapter-get-run', nowIso: FIXED_NOW });
    const runs = engine.listRuns({ suiteId: 'suite-get-run' });
    const req = { method: 'GET', url: `/api/civic-contract-test-marketplace/runs/${runs.runs[0].id}`, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.run.id).toBe(runs.runs[0].id);
  });

  it('gets run results', async () => {
    const { handler, engine } = makeHandler();
    await engine.upsertAdapter({
      id: 'adapter-get-results',
      name: 'Get Results Adapter',
      type: 'rest',
      baseUrl: 'https://example.gov.in/api',
      authType: 'none',
      authConfig: {},
      headers: {},
      timeoutMs: 5000,
      retryCount: 2,
      isActive: true,
      createdBy: 'maintainer',
      nowIso: FIXED_NOW
    });
    await engine.upsertSuite({
      id: 'suite-get-results',
      adapterId: 'adapter-get-results',
      name: 'Get Results Suite',
      description: 'Get results suite',
      status: 'active',
      tests: [],
      schedule: 'manual',
      createdBy: 'maintainer',
      nowIso: FIXED_NOW
    });
    await engine.runSuite({ suiteId: 'suite-get-results', adapterId: 'adapter-get-results', nowIso: FIXED_NOW });
    const runs = engine.listRuns({ suiteId: 'suite-get-results' });
    const req = { method: 'GET', url: `/api/civic-contract-test-marketplace/runs/${runs.runs[0].id}/results`, headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.results)).toBe(true);
  });

  it('records a drift event (user-gated)', async () => {
    const { handler, engine, verifySession } = makeHandler();
    await engine.upsertAdapter({
      id: 'adapter-drift',
      name: 'Drift Adapter',
      type: 'rest',
      baseUrl: 'https://example.gov.in/api',
      authType: 'none',
      authConfig: {},
      headers: {},
      timeoutMs: 5000,
      retryCount: 2,
      isActive: true,
      createdBy: 'maintainer',
      nowIso: FIXED_NOW
    });
    await engine.upsertSuite({
      id: 'suite-drift',
      adapterId: 'adapter-drift',
      name: 'Drift Suite',
      description: 'Drift suite',
      status: 'active',
      tests: [],
      schedule: 'manual',
      createdBy: 'maintainer',
      nowIso: FIXED_NOW
    });
    await engine.runSuite({ suiteId: 'suite-drift', adapterId: 'adapter-drift', nowIso: FIXED_NOW });
    const runs = engine.listRuns({ suiteId: 'suite-drift' });
    const req = {
      method: 'POST',
      url: `/api/civic-contract-test-marketplace/runs/${runs.runs[0].id}/drift`,
      headers: { authorization: 'Bearer user-token-12345' },
      body: { runId: runs.runs[0].id, previousScore: 0.4, currentScore: 0.75, reason: 'Link health deteriorated.' }
    };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(verifySession).toHaveBeenCalled();
  });

  it('lists feature weights', async () => {
    const { handler } = makeHandler();
    const req = { method: 'GET', url: '/api/civic-contract-test-marketplace/feature-weights', headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(typeof res.body.weights).toBe('object');
  });

  it('schema validation functions reject bad input', () => {
    expect(validateUpsertAdapter({ id: 'Bad Id' }).valid).toBe(false);
    expect(validateUpsertSuite({ id: 'Bad Id' }).valid).toBe(false);
    expect(validateRunSuite({ suiteId: 'Bad Id' }).valid).toBe(false);
    expect(validateListQuery({ status: 'invalid' }).valid).toBe(false);
    expect(validateRecordDrift({ runId: 'Bad Id' }).valid).toBe(false);
  });

  it('returns 405 for unsupported methods', async () => {
    const { handler } = makeHandler();
    const req = { method: 'DELETE', url: '/api/civic-contract-test-marketplace/adapters', headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });
});
