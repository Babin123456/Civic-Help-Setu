/**
 * tests/civic-agent-policy-api.test.js
 *
 * Integration tests for the Civic Agent Workflow Policy-as-Code Engine API
 * route (#1187). The handler is dependency-injected, so no Clerk, Firebase or
 * network access is required.
 *
 * Synthetic fixtures only: no citizen records, credentials, raw documents or
 * sensitive prompts.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createCivicAgentPolicyHandler } from '../api/civic-agent-policy.js';
import { resetProductionPolicyStoreCacheForTests } from '../api/_lib/civicAgentPolicyStore.js';
import { InMemoryPolicyStore } from '../api/_lib/civicAgentPolicyStore.js';
import {
  validateEvaluate,
  validatePolicyUpsert,
  validateEmergencyRevoke,
  validateListQuery,
  validateSimulate
} from '../api/_lib/civicAgentPolicySchemas.js';
import { createPolicyEngine } from '../src/services/civicAgentPolicyEngine.js';
import { DEFAULT_POLICY } from '../src/data/civicAgentPolicyConstants.js';

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
  const store = new InMemoryPolicyStore();
  store.setPolicy({ ...DEFAULT_POLICY });

  const toPlain = () => ({
    schemaVersion: 1,
    policies: Array.from(store.policies.values()),
    policyVersions: Array.from(store.policyVersions.values()),
    evaluationAudit: [...store.evaluationAudit],
    emergencyRevocations: [...store.emergencyRevocations],
    meta: {}
  });

  const engine = createPolicyEngine({
    loadStore: () => toPlain(),
    runTransaction: (mutator) => {
      const draft = toPlain();
      const result = mutator(draft);
      for (const policy of draft.policies) store.setPolicy(policy);
      for (const version of draft.policyVersions) store.setPolicyVersion(version);
      store.evaluationAudit = draft.evaluationAudit;
      store.emergencyRevocations = draft.emergencyRevocations;
      return { data: { policies: Array.from(store.policies.values()) }, result };
    },
    now: () => FIXED_NOW.getTime()
  });

  const verifySession = vi.fn(overrides.verifySession || (async () => ({ userId: 'user-1' })));
  const authorizeOperator = vi.fn(overrides.authorizeOperator || (async () => ({ userId: 'admin-1', role: 'admin' })));
  const handler = createCivicAgentPolicyHandler({
    verifySession,
    authorizeOperator,
    getStore: async () => store,
    engine,
    now: () => FIXED_NOW.getTime()
  });
  return { handler, verifySession, authorizeOperator, store, engine };
}
describe('civic-agent-policy API', () => {
  beforeEach(() => {
    resetProductionPolicyStoreCacheForTests();
    vi.restoreAllMocks();
  });

  it('returns schema version and health', async () => {
    const { handler } = makeHandler();
    const req = { method: 'GET', url: '/api/civic-agent-policy?schema=1', headers: {}, query: { schema: '1' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.schemaVersion).toBe(1);
    expect(res.body.service).toBe('civic-agent-policy');
  });

  it('evaluates a request (user-gated)', async () => {
    const { handler, engine, verifySession } = makeHandler();
    // Seed an allow rule via engine upsert first.
    await engine.upsertPolicy({
      id: 'default-civic-agent-policy-v1',
      name: DEFAULT_POLICY.name,
      status: 'active',
      denyByDefault: true,
      rules: [{
        id: 'allow-read',
        description: 'Allow read.',
        resourceType: 'tool',
        resourceId: 'lookupServiceDetails',
        effect: 'allow',
        conditions: [],
        conditionParams: {},
        requiresApproval: false,
        appliesToRoles: ['citizen'],
        priority: 10,
        expiresAt: null
      }],
      createdBy: 'operator',
      nowIso: FIXED_NOW
    });

    const req = {
      method: 'POST',
      url: '/api/civic-agent-policy/evaluate',
      headers: { authorization: 'Bearer valid-token-12345' },
      body: {
        policyId: 'default-civic-agent-policy-v1',
        resourceType: 'tool',
        resourceId: 'lookupServiceDetails',
        action: 'read',
        role: 'citizen'
      }
    };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.policy.id).toBe('default-civic-agent-policy-v1');
    expect(verifySession).toHaveBeenCalled();
  });

  it('rejects evaluation without a token', async () => {
    const { handler } = makeHandler();
    const req = { method: 'POST', url: '/api/civic-agent-policy/evaluate', headers: {}, body: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('missing_token');
  });

  it('rejects invalid evaluate input', async () => {
    const { handler } = makeHandler();
    const req = {
      method: 'POST',
      url: '/api/civic-agent-policy/evaluate',
      headers: { authorization: 'Bearer valid-token-12345' },
      body: { resourceType: 'not-a-type' }
    };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  it('lists policies', async () => {
    const { handler } = makeHandler();
    const req = { method: 'GET', url: '/api/civic-agent-policy/policies', headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.policies)).toBe(true);
  });

  it('upserts a policy (operator-gated)', async () => {
    const { handler, authorizeOperator } = makeHandler();
    const req = {
      method: 'POST',
      url: '/api/civic-agent-policy/policies',
      headers: { authorization: 'Bearer operator-token' },
      body: {
        id: 'policy-test',
        name: 'Test',
        status: 'active',
        denyByDefault: true,
        rules: []
      }
    };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(authorizeOperator).toHaveBeenCalled();
  });

  it('gets a policy by id', async () => {
    const { handler, engine } = makeHandler();
    // Upsert first via engine.
    await engine.upsertPolicy({
      id: 'policy-get',
      name: 'Get',
      status: 'active',
      denyByDefault: true,
      rules: [],
      createdBy: 'operator',
      nowIso: FIXED_NOW
    });
    const req = { method: 'GET', url: '/api/civic-agent-policy/policies/policy-get', headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.policy.id).toBe('policy-get');
  });

  it('emergency revokes a policy (operator-gated)', async () => {
    const { handler, engine, authorizeOperator } = makeHandler();
    await engine.upsertPolicy({
      id: 'policy-revoke',
      name: 'Revoke',
      status: 'active',
      denyByDefault: true,
      rules: [],
      createdBy: 'operator',
      nowIso: FIXED_NOW
    });
    const req = {
      method: 'POST',
      url: '/api/civic-agent-policy/policies/policy-revoke/emergency-revoke',
      headers: { authorization: 'Bearer operator-token' },
      body: { policyId: 'policy-revoke', reason: 'test', revokedBy: 'operator' }
    };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(authorizeOperator).toHaveBeenCalled();
  });

  it('lists policy versions', async () => {
    const { handler, engine } = makeHandler();
    await engine.upsertPolicy({
      id: 'policy-ver',
      name: 'Ver',
      status: 'active',
      denyByDefault: true,
      rules: [],
      createdBy: 'operator',
      nowIso: FIXED_NOW
    });
    const req = { method: 'GET', url: '/api/civic-agent-policy/policies/policy-ver/versions', headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.versions)).toBe(true);
  });

  it('lists evaluation audit', async () => {
    const { handler } = makeHandler();
    const req = { method: 'GET', url: '/api/civic-agent-policy/audit', headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.events)).toBe(true);
  });

  it('simulates policy decisions', async () => {
    const { handler } = makeHandler();
    const req = {
      method: 'POST',
      url: '/api/civic-agent-policy/simulate',
      headers: { authorization: 'Bearer valid-token-12345' },
      body: {
        requests: [
          { resourceId: 'unknown', expectedDeny: true, action: 'read' },
          { resourceId: 'lookupServiceDetails', action: 'read', citizenConfirmed: true, expectedDeny: false }
        ]
      }
    };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.bypassDetected).toBe(false);
    expect(res.body.denyByDefaultHeld).toBe(true);
    expect(res.body.simulated).toBe(true);
  });

  it('schema validation functions reject bad input', () => {
    expect(validateEvaluate({ resourceType: 'bad' }).valid).toBe(false);
    expect(validatePolicyUpsert({ id: 'Bad Id' }).valid).toBe(false);
    expect(validateEmergencyRevoke({ policyId: 'Bad Id' }).valid).toBe(false);
    expect(validateListQuery({ limit: 0 }).valid).toBe(false);
    expect(validateSimulate({ requests: 'x' }).valid).toBe(false);
  });

  it('returns 405 for unsupported methods', async () => {
    const { handler } = makeHandler();
    const req = { method: 'DELETE', url: '/api/civic-agent-policy/policies', headers: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });
});
