/**
 * api/civic-agent-policy.js
 *
 * Vercel serverless function exposing the Civic Agent Workflow Policy-as-Code
 * Engine (#1187):
 *
 *   GET  /api/civic-agent-policy?schema=1          schema version + health
 *   GET  /api/civic-agent-policy                   schema version
 *   POST /api/civic-agent-policy/evaluate          evaluate a request { policyId, workflowId, resourceType, resourceId, action, role, citizenConfirmed, humanApproved, sourceVerified, callSource, dailyCallCount, context }
 *   GET  /api/civic-agent-policy/policies          list policies
 *   POST /api/civic-agent-policy/policies          upsert a policy (operator)
 *   GET  /api/civic-agent-policy/policies/:policyId get a policy
 *   POST /api/civic-agent-policy/policies/:policyId/emergency-revoke  emergency revoke (operator)
 *   GET  /api/civic-agent-policy/policies/:policyId/versions list policy versions
 *   GET  /api/civic-agent-policy/audit             list evaluation audit events
 *   POST /api/civic-agent-policy/simulate          simulate policy decisions (synthetic)
 *
 * All external input is validated against versioned schemas in
 * api/_lib/civicAgentPolicySchemas.js. Policy mutations require a verified
 * Clerk session with the operator role. Evaluation is user-gated.
 *
 * The handler is dependency-injected so it is fully testable without Clerk,
 * Firebase or network access.
 */

import {
  validateEvaluate,
  validatePolicyUpsert,
  validateEmergencyRevoke,
  validateListQuery,
  validateSimulate,
  schemaVersion,
} from './_lib/civicAgentPolicySchemas.js';
import {
  getProductionPolicyStore,
  resetProductionPolicyStoreCacheForTests,
} from './_lib/civicAgentPolicyStore.js';
import { createPolicyEngine } from '../src/services/civicAgentPolicyEngine.js';
import { simulatePolicyDecisions } from '../src/services/civicAgentPolicySimulation.js';

const ID_SEGMENT = /^[a-z0-9_-]{1,128}$/;

function parseBody(body) {
  if (!body || typeof body !== 'object') return null;
  return body;
}

function parseUrlQuery(url) {
  const q = {};
  const idx = url.indexOf('?');
  if (idx === -1) return q;
  const search = url.slice(idx + 1);
  for (const pair of search.split('&')) {
    const eq = pair.indexOf('=');
    if (eq === -1) {
      if (pair) q[decodeURIComponent(pair)] = '';
    } else {
      q[decodeURIComponent(pair.slice(0, eq))] = decodeURIComponent(pair.slice(eq + 1));
    }
  }
  return q;
}

/** Bearer token extraction (Clerk session). */
export function bearerToken(headers = {}) {
  const key = Object.keys(headers).find((name) => name.toLowerCase() === 'authorization');
  const value = key ? headers[key] : '';
  const match = typeof value === 'string' ? /^Bearer ([A-Za-z0-9._~+/=-]{10,4096})$/.exec(value.trim()) : null;
  return match ? match[1] : null;
}

export function createCivicAgentPolicyHandler({
  verifySession,
  getStore = getProductionPolicyStore,
  authorizeOperator,
  engine,
  now = Date.now
} = {}) {
  if (!verifySession) throw new TypeError('createCivicAgentPolicyHandler needs verifySession');
  if (!authorizeOperator) throw new TypeError('createCivicAgentPolicyHandler needs authorizeOperator');

  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    const { method, url = '', headers = {}, query: routeQuery = {}, body } = req;
    const query = { ...parseUrlQuery(url), ...routeQuery };
    const pathname = url.split('?')[0];
    const segments = pathname.split('/').filter(Boolean);
    // segments: ['api', 'civic-agent-policy', ...rest]
    const rest = segments.slice(2);

    // Health / schema endpoint.
    if (method === 'GET' && rest.length === 0 && query.schema !== undefined) {
      return res.status(200).json({ schemaVersion: schemaVersion(), service: 'civic-agent-policy', status: 'healthy' });
    }

    let store;
    try {
      store = await getStore();
    } catch {
      store = null;
    }

    // Resolve the actor for user/operator-gated endpoints.
    let actorUserId = null;
    const token = bearerToken(headers);
    if (token) {
      try {
        const { userId } = await verifySession(token);
        if (userId) actorUserId = userId;
      } catch {
        // Invalid token; actor stays null. User-gated endpoints will 401.
      }
    }

    // ---------- Operator-gated endpoints ----------
    const isOperatorEndpoint =
      (rest[0] === 'policies' && method === 'POST') ||
      (rest[0] === 'policies' && rest.length === 2 && rest[1] === 'emergency-revoke' && method === 'POST');

    if (isOperatorEndpoint) {
      let operator;
      try {
        operator = await authorizeOperator(req);
      } catch {
        return res.status(503).json({ error: 'operator_access_unavailable' });
      }
      if (operator && operator.status) return res.status(operator.status).json({ error: 'operator_access_denied' });
      if (!operator || !operator.userId) return res.status(403).json({ error: 'operator_access_denied' });
    }

    // ---------- User-gated endpoints (evaluate) ----------
    const isUserEndpoint = rest[0] === 'evaluate' && method === 'POST';
    if (isUserEndpoint) {
      if (!token) return res.status(401).json({ error: 'missing_token' });
      if (!actorUserId) return res.status(401).json({ error: 'invalid_token' });
      req.__policyUserId = actorUserId;
    }

    const eng = engine || createPolicyEngine({ now });

    // ---------- Route dispatch ----------

    // GET schema
    if (method === 'GET' && rest.length === 0) {
      return res.status(200).json({ schemaVersion: schemaVersion(), service: 'civic-agent-policy' });
    }

    // POST /evaluate
    if (method === 'POST' && rest[0] === 'evaluate' && rest.length === 1) {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const payload = parseBody(body);
      const validation = validateEvaluate(payload);
      if (!validation.valid) return res.status(400).json({ error: 'validation_failed', details: validation.errors });
      const { policyId, workflowId, resourceType, resourceId, action, role, citizenConfirmed, humanApproved, sourceVerified, callSource, dailyCallCount, context } = validation.value;

      const decision = await eng.evaluate({
        policyId,
        workflowId,
        resourceType,
        resourceId,
        action,
        role,
        citizenConfirmed,
        humanApproved,
        sourceVerified,
        callSource,
        dailyCallCount,
        context,
        nowIso: now ? new Date(now()).toISOString() : undefined
      });
      if (!decision.permitted && decision.code === 'CP_STORAGE_UNAVAILABLE') {
        return res.status(503).json({ error: decision.code, message: decision.reason });
      }
      return res.status(200).json({ schemaVersion: schemaVersion(), ...decision });
    }

    // GET /policies
    if (method === 'GET' && rest[0] === 'policies' && rest.length === 1) {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const validation = validateListQuery(query);
      if (!validation.valid) return res.status(400).json({ error: 'validation_failed', details: validation.errors });
      const policies = eng.listPolicies();
      return res.status(200).json({ schemaVersion: schemaVersion(), policies });
    }

    // POST /policies (operator)
    if (method === 'POST' && rest[0] === 'policies' && rest.length === 1) {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const payload = parseBody(body);
      const validation = validatePolicyUpsert(payload);
      if (!validation.valid) return res.status(400).json({ error: 'validation_failed', details: validation.errors });
      const { id, name, description, status, denyByDefault, rules, emergencyLocked, requireHumanApprovalForHighImpact, createdBy } = validation.value;

      const result = await eng.upsertPolicy({
        id,
        name,
        description,
        status,
        denyByDefault,
        rules,
        emergencyLocked,
        requireHumanApprovalForHighImpact,
        createdBy: createdBy || 'operator',
        nowIso: now ? new Date(now()).toISOString() : undefined
      });
      if (!result.ok) {
        const code = result.error.code || 'CP_ERROR';
        return res.status(code.includes('STORAGE') ? 503 : 400).json({ error: code, message: result.error.message });
      }
      return res.status(200).json({ schemaVersion: schemaVersion(), ok: true, policy: result.policy });
    }

    // GET /policies/:policyId
    if (method === 'GET' && rest[0] === 'policies' && rest.length === 2) {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const policyId = rest[1];
      if (!ID_SEGMENT.test(policyId)) return res.status(400).json({ error: 'invalid_policy_id' });
      const policy = eng.getPolicy(policyId);
      if (!policy) return res.status(404).json({ error: 'policy_not_found' });
      return res.status(200).json({ schemaVersion: schemaVersion(), policy });
    }

    // POST /policies/:policyId/emergency-revoke (operator)
    if (method === 'POST' && rest[0] === 'policies' && rest.length === 3 && rest[2] === 'emergency-revoke') {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const targetId = rest[1];
      if (!ID_SEGMENT.test(targetId)) return res.status(400).json({ error: 'invalid_policy_id' });

      const payload = parseBody(body);
      const validation = validateEmergencyRevoke(payload);
      if (!validation.valid) return res.status(400).json({ error: 'validation_failed', details: validation.errors });
      const { reason, revokedBy } = validation.value;

      const result = await eng.emergencyRevoke({
        policyId: targetId,
        reason,
        revokedBy: revokedBy || 'operator',
        nowIso: now ? new Date(now()).toISOString() : undefined
      });
      if (!result.ok) {
        const code = result.error.code || 'CP_ERROR';
        return res.status(code.includes('STORAGE') ? 503 : 400).json({ error: code, message: result.error.message });
      }
      return res.status(200).json({ schemaVersion: schemaVersion(), ok: true, policyId: targetId, revokedAt: result.revokedAt });
    }

    // GET /policies/:policyId/versions
    if (method === 'GET' && rest[0] === 'policies' && rest.length === 3 && rest[2] === 'versions') {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const policyId = rest[1];
      if (!ID_SEGMENT.test(policyId)) return res.status(400).json({ error: 'invalid_policy_id' });
      const validation = validateListQuery(query);
      if (!validation.valid) return res.status(400).json({ error: 'validation_failed', details: validation.errors });
      const versions = eng.getPolicyVersions({ policyId, limit: validation.value.limit, cursor: validation.value.cursor });
      return res.status(200).json({ schemaVersion: schemaVersion(), ...versions });
    }

    // GET /audit
    if (method === 'GET' && rest[0] === 'audit' && rest.length === 1) {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const validation = validateListQuery(query);
      if (!validation.valid) return res.status(400).json({ error: 'validation_failed', details: validation.errors });
      const events = eng.getEvaluationAudit({ policyId: validation.value.policyId, limit: validation.value.limit });
      return res.status(200).json({ schemaVersion: schemaVersion(), events });
    }

    // POST /simulate
    if (method === 'POST' && rest[0] === 'simulate' && rest.length === 1) {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const payload = parseBody(body);
      const validation = validateSimulate(payload);
      if (!validation.valid) return res.status(400).json({ error: 'validation_failed', details: validation.errors });
      const { requests, policy: simPolicy, emergencyRevokeMidway } = validation.value;

      // Use a fresh engine instance for simulation to avoid mutating shared state.
      const result = await simulatePolicyDecisions({
        requests,
        policy: simPolicy,
        emergencyRevokeMidway
      });
      if (!result.ok) {
        return res.status(400).json({ error: result.error.code, message: result.error.message });
      }
      return res.status(200).json({ schemaVersion: schemaVersion(), ...result });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  };
}

export default createCivicAgentPolicyHandler;
export { resetProductionPolicyStoreCacheForTests };
