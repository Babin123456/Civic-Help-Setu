/**
 * tests/civic-agent-cost-carbon-api.test.js
 *
 * Integration tests for the Civic Agent Cost and Carbon Budget Governor API
 * route (#1185). The handler is dependency-injected, so no Clerk, Firebase or
 * network access is required.
 *
 * Synthetic fixtures only: no citizen records, credentials, raw documents or
 * sensitive prompts.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createCivicAgentCostCarbonHandler } from '../api/civic-agent-cost-carbon.js';
import { InMemoryCostCarbonStore, resetProductionCostCarbonStoreCacheForTests } from '../api/_lib/civicAgentCostCarbonStore.js';
import {
  validateStartRun,
  validateRecordCall,
  validateStopRun,
  validatePolicyConfig,
} from '../api/_lib/civicAgentCostCarbonSchemas.js';
import { DEFAULT_COST_CARBON_POLICY } from '../src/data/civicAgentCostCarbonConstants.js';
import { createCostCarbonGovernor } from '../src/services/civicAgentCostCarbonGovernor.js';

const FIXED_NOW = new Date('2026-11-24T10:00:00Z');

function mockRes() {
  const headers = {};
  const res = {
    statusCode: null,
    headers,
    setHeader(k, v) { headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    getHeader(k) { return headers[k]; },
  };
  return res;
}

function makeHandler(overrides = {}) {
  const store = new InMemoryCostCarbonStore();
  store.setPolicy({ ...DEFAULT_COST_CARBON_POLICY });

  const toPlain = () => ({
    schemaVersion: 1,
    policies: Array.from(store.policies.values()),
    workflows: [],
    runs: Array.from(store.runs.values()),
    calls: Array.from(store.calls.values()),
    auditEvents: [...store.auditEvents],
    meta: {},
  });

  const governor = createCostCarbonGovernor({
    loadStore: () => toPlain(),
    runTransaction: (mutator) => {
      const draft = toPlain();
      const result = mutator(draft);
      for (const run of draft.runs) store.setRun(run);
      for (const call of draft.calls) store.setCall(call);
      store.auditEvents = draft.auditEvents;
      return { data: { runs: Array.from(store.runs.values()) }, result };
    },
    now: () => FIXED_NOW.getTime(),
  });

  const verifySession = vi.fn(overrides.verifySession || (async () => ({ userId: 'user-1' })));
  const authorizeOperator = vi.fn(overrides.authorizeOperator || (async () => ({ userId: 'admin-1', role: 'admin' })));
  const handler = createCivicAgentCostCarbonHandler({
    verifySession,
    authorizeOperator,
    getStore: async () => store,
    governor,
    now: () => FIXED_NOW.getTime(),
  });
  return { handler, verifySession, authorizeOperator, store, governor };
}

describe('civic-agent-cost-carbon API', () => {
  beforeEach(() => {
    resetProductionCostCarbonStoreCacheForTests();
    vi.restoreAllMocks();
  });

  it('returns schema version and health', async () => {
    const { handler } = makeHandler();
    const req = { method: 'GET', url: '/api/civic-agent-cost-carbon?schema=1', headers: {}, query: { schema: '1' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.schemaVersion).toBe(1);
    expect(res.body.service).toBe('civic-agent-cost-carbon');
  });

  it('starts a run (user-gated)', async () => {
    const { handler, verifySession } = makeHandler();
    const req = {
      method: 'POST',
      url: '/api/civic-agent-cost-carbon/runs',
      headers: { authorization: 'Bearer valid-token-12345' },
      body: { workflowId: 'wf-1', modelId: 'gpt-4o-mini', prompt: 'hello', isHighImpact: false, humanApproved: false },
    };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(201);
    expect(res.body.run.workflowId).toBe('wf-1');
    expect(res.body.run.status).toBe('running');
    expect(verifySession).toHaveBeenCalled();
  });

  it('rejects starting a run without a token', async () => {
    const { handler } = makeHandler();
    const req = { method: 'POST', url: '/api/civic-agent-cost-carbon/runs', headers: {}, body: { workflowId: 'wf-1' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('missing_token');
  });

  it('rejects invalid start-run input', async () => {
    const { handler } = makeHandler();
    const req = {
      method: 'POST',
      url: '/api/civic-agent-cost-carbon/runs',
      headers: { authorization: 'Bearer valid-token-12345' },
      body: { workflowId: 'Bad Id!' },
    };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  it('records a call for a run', async () => {
    const { handler } = makeHandler();
    // First start a run.
    const startReq = {
      method: 'POST',
      url: '/api/civic-agent-cost-carbon/runs',
      headers: { authorization: 'Bearer valid-token-12345' },
      body: { workflowId: 'wf-1', modelId: 'gpt-4o-mini', prompt: 'hello' },
    };
    const startRes = mockRes();
    await handler(startReq, startRes);
    const runId = startRes.body.run.id;

    const recReq = {
      method: 'POST',
      url: `/api/civic-agent-cost-carbon/runs/${runId}/calls`,
      headers: { authorization: 'Bearer valid-token-12345' },
      body: { runId, modelId: 'gpt-4o-mini', prompt: 'hello', output: 'world', latencyMs: 100 },
    };
    const recRes = mockRes();
    await handler(recReq, recRes);
    expect(recRes.statusCode).toBe(200);
    expect(recRes.body.call.modelId).toBe('gpt-4o-mini');
    expect(recRes.body.call.totalTokens).toBeGreaterThan(0);
  });

  it('stops a run (operator-gated)', async () => {
    const { handler, authorizeOperator } = makeHandler();
    // Start a run first.
    const startReq = {
      method: 'POST',
      url: '/api/civic-agent-cost-carbon/runs',
      headers: { authorization: 'Bearer valid-token-12345' },
      body: { workflowId: 'wf-1', modelId: 'gpt-4o-mini', prompt: 'hello' },
    };
    const startRes = mockRes();
    await handler(startReq, startRes);
    const runId = startRes.body.run.id;

    const stopReq = {
      method: 'POST',
      url: `/api/civic-agent-cost-carbon/runs/${runId}/stop`,
      headers: { authorization: 'Bearer operator-token' },
      body: { runId, reason: 'budget review' },
    };
    const stopRes = mockRes();
    await handler(stopReq, stopRes);
    expect(stopRes.statusCode).toBe(200);
    expect(stopRes.body.stopped).toBe(true);
    expect(authorizeOperator).toHaveBeenCalled();
  });

  it('lists policies (operator-gated create)', async () => {
    const { handler, authorizeOperator } = makeHandler();
    const listReq = { method: 'GET', url: '/api/civic-agent-cost-carbon/policies', headers: {} };
    const listRes = mockRes();
    await handler(listReq, listRes);
    expect(listRes.statusCode).toBe(200);
    expect(Array.isArray(listRes.body.policies)).toBe(true);

    const createReq = {
      method: 'POST',
      url: '/api/civic-agent-cost-carbon/policies',
      headers: { authorization: 'Bearer operator-token' },
      body: { id: 'policy-test', name: 'Test', maxTotalCostUSD: 5 },
    };
    const createRes = mockRes();
    await handler(createReq, createRes);
    expect(createRes.statusCode).toBe(200);
    expect(createRes.body.ok).toBe(true);
    expect(authorizeOperator).toHaveBeenCalled();
  });

  it('returns workflow aggregate', async () => {
    const { handler } = makeHandler();
    const startReq = {
      method: 'POST',
      url: '/api/civic-agent-cost-carbon/runs',
      headers: { authorization: 'Bearer valid-token-12345' },
      body: { workflowId: 'wf-agg', modelId: 'gpt-4o-mini', prompt: 'p' },
    };
    const startRes = mockRes();
    await handler(startReq, startRes);

    const aggReq = { method: 'GET', url: '/api/civic-agent-cost-carbon/workflows/wf-agg/aggregate', headers: {} };
    const aggRes = mockRes();
    await handler(aggReq, aggRes);
    expect(aggRes.statusCode).toBe(200);
    expect(aggRes.body.workflowId).toBe('wf-agg');
    expect(aggRes.body.runCount).toBe(1);
  });

  it('schema validation functions are exported and reject bad input', () => {
    expect(validateStartRun({ workflowId: 'x', prompt: 5 }).valid).toBe(false);
    expect(validateRecordCall({ runId: 'x', modelId: 5 }).valid).toBe(false);
    expect(validateStopRun({ runId: 'x', reason: 'A'.repeat(600) }).valid).toBe(false);
    expect(validatePolicyConfig({ id: 'Bad Id' }).valid).toBe(false);
  });

  it('returns 405 for unsupported methods', async () => {
    const { handler } = makeHandler();
    const req = { method: 'DELETE', url: '/api/civic-agent-cost-carbon/runs', headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });
});
