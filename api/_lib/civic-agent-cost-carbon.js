/**
 * api/civic-agent-cost-carbon.js
 *
 * Vercel serverless function exposing the Civic Agent Cost and Carbon Budget
 * Governor (#1185):
 *
 *   GET  /api/civic-agent-cost-carbon?schema=1          schema version + health
 *   GET  /api/civic-agent-cost-carbon/runs?workflowId=&status=&limit=&cursor=   list runs
 *   POST /api/civic-agent-cost-carbon/runs              start a run { workflowId, policyId, modelId, prompt, inputTokens, isHighImpact, humanApproved }
 *   GET  /api/civic-agent-cost-carbon/runs/:runId        get a run (with calls)
 *   POST /api/civic-agent-cost-carbon/runs/:runId/calls  record a call { modelId, prompt, output, inputTokens, outputTokens, latencyMs, billingMetadata, isHighImpact }
 *   POST /api/civic-agent-cost-carbon/runs/:runId/stop   stop a run { reason }
 *   GET  /api/civic-agent-cost-carbon/policies            list policies
 *   POST /api/civic-agent-cost-carbon/policies            create/update a policy (operator)
 *   GET  /api/civic-agent-cost-carbon/workflows/:workflowId/aggregate  workflow aggregate
 *
 * All external input is validated against versioned schemas in
 * api/_lib/civicAgentCostCarbonSchemas.js. Operator mutations require a
 * verified Clerk session with the operator role. Run/call writes require a
 * verified Clerk session (user or operator).
 *
 * The handler is dependency-injected so it is fully testable without Clerk,
 * Firebase or network access.
 */

import {
  validateStartRun,
  validateRecordCall,
  validateStopRun,
  validatePolicyConfig,
  validateListQuery,
  schemaVersion,
} from './civicAgentCostCarbonSchemas.js';
import {
  getProductionCostCarbonStore,
  resetProductionCostCarbonStoreCacheForTests,
} from './civicAgentCostCarbonStore.js';
import { createCostCarbonGovernor } from '../../src/services/civicAgentCostCarbonGovernor.js';
import { DEFAULT_COST_CARBON_POLICY } from '../../src/data/civicAgentCostCarbonConstants.js';

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

export function createCivicAgentCostCarbonHandler({
  verifySession,
  getStore = getProductionCostCarbonStore,
  authorizeOperator,
  governor,
  now = Date.now,
} = {}) {
  if (!verifySession) throw new TypeError('createCivicAgentCostCarbonHandler needs verifySession');
  if (!authorizeOperator) throw new TypeError('createCivicAgentCostCarbonHandler needs authorizeOperator');

  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    const { method, url = '', headers = {}, query: routeQuery = {}, body } = req;
    const query = { ...parseUrlQuery(url), ...routeQuery };
    const pathname = url.split('?')[0];
    const segments = pathname.split('/').filter(Boolean);
    const rest = segments.slice(2);

    const gov = governor || createCostCarbonGovernor({ now });

    // Health / schema endpoint.
    if (method === 'GET' && rest.length === 0 && query.schema !== undefined) {
      return res.status(200).json({ schemaVersion: schemaVersion(), service: 'civic-agent-cost-carbon', status: 'healthy' });
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
      (rest[0] === 'runs' && rest.length === 3 && rest[1] && rest[2] === 'stop' && method === 'POST');

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

    // ---------- User-gated endpoints (runs, calls) ----------
    const isUserEndpoint =
      (rest[0] === 'runs' && rest.length === 1 && method === 'POST') ||
      (rest[0] === 'runs' && rest.length === 3 && rest[2] === 'calls' && method === 'POST') ||
      (rest[0] === 'runs' && rest.length === 3 && rest[2] === 'stop' && method === 'POST');

    if (isUserEndpoint) {
      if (!token) return res.status(401).json({ error: 'missing_token' });
      if (!actorUserId) return res.status(401).json({ error: 'invalid_token' });
      req.__costCarbonUserId = actorUserId;
    }

    // ---------- Route dispatch ----------

    // GET schema
    if (method === 'GET' && rest.length === 0) {
      return res.status(200).json({ schemaVersion: schemaVersion(), service: 'civic-agent-cost-carbon' });
    }

    // GET /runs?workflowId=&status=&limit=&cursor=
    if (method === 'GET' && rest[0] === 'runs' && rest.length === 1) {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const validation = validateListQuery(query);
      if (!validation.valid) return res.status(400).json({ error: 'validation_failed', details: validation.errors });
      const result = await store.listRuns({ workflowId: validation.value.workflowId, status: validation.value.status, limit: validation.value.limit, cursor: validation.value.cursor });
      return res.status(200).json({ schemaVersion: schemaVersion(), ...result });
    }

    // POST /runs  (start a run)
    if (method === 'POST' && rest[0] === 'runs' && rest.length === 1) {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const payload = parseBody(body);
      const validation = validateStartRun(payload);
      if (!validation.valid) return res.status(400).json({ error: 'validation_failed', details: validation.errors });
      const { workflowId, policyId, modelId, prompt, inputTokens, isHighImpact, humanApproved } = validation.value;

      const governor = gov;

      const started = governor.startRun({ workflowId, policyId, modelId, prompt, inputTokens, isHighImpact, humanApproved, _now: now ? new Date(now()).toISOString() : undefined });
      if (!started.ok) {
        const code = started.error.code || 'CC_ERROR';
        return res.status(code.includes('STORAGE') ? 503 : code.includes('VALIDATION') ? 400 : 409).json({ error: code, message: started.error.message });
      }
      return res.status(201).json({ schemaVersion: schemaVersion(), run: started.run, policy: started.policy });
    }

    // GET /runs/:runId
    if (method === 'GET' && rest[0] === 'runs' && rest.length === 2) {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const runId = rest[1];
      if (!ID_SEGMENT.test(runId)) return res.status(400).json({ error: 'invalid_run_id' });
      const run = await store.getRun(runId);
      if (!run) return res.status(404).json({ error: 'run_not_found' });
      const calls = (await store.listCalls({ runId, limit: 100 })).calls;
      return res.status(200).json({ schemaVersion: schemaVersion(), run: { ...run, calls } });
    }

    // POST /runs/:runId/calls  (record a call)
    if (method === 'POST' && rest[0] === 'runs' && rest.length === 3 && rest[1] && rest[2] === 'calls') {
      const runId = rest[1];
      if (!ID_SEGMENT.test(runId)) return res.status(400).json({ error: 'invalid_run_id' });
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const run = await store.getRun(runId);
      if (!run) return res.status(404).json({ error: 'run_not_found' });

      const payload = parseBody(body);
      const validation = validateRecordCall(payload);
      if (!validation.valid) return res.status(400).json({ error: 'validation_failed', details: validation.errors });
      const { modelId, prompt, output, inputTokens, outputTokens, latencyMs, billingMetadata, isHighImpact } = validation.value;

      const governor = gov;

      const recorded = governor.recordCall({
        runId,
        modelId,
        prompt,
        output,
        inputTokens,
        outputTokens,
        latencyMs,
        billingMetadata,
        isHighImpact,
        _now: now ? new Date(now()).toISOString() : undefined,
      });
      if (!recorded.ok) {
        const code = recorded.error.code || 'CC_ERROR';
        return res.status(code.includes('STORAGE') ? 503 : code.includes('RUN_NOT_FOUND') ? 404 : 409).json({ error: code, message: recorded.error.message });
      }
      return res.status(200).json({ schemaVersion: schemaVersion(), call: recorded.call, runTotals: recorded.runTotals, stopped: recorded.stopped, reason: recorded.reason, code: recorded.code, billingMetadataGap: recorded.billingMetadataGap, runwaySuspected: recorded.runwaySuspected, estimate: recorded.estimate });
    }

    // POST /runs/:runId/stop  (stop a run)
    if (method === 'POST' && rest[0] === 'runs' && rest.length === 3 && rest[1] && rest[2] === 'stop') {
      const runId = rest[1];
      if (!ID_SEGMENT.test(runId)) return res.status(400).json({ error: 'invalid_run_id' });
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const payload = parseBody(body);
      const validation = validateStopRun(payload);
      if (!validation.valid) return res.status(400).json({ error: 'validation_failed', details: validation.errors });

      const governor = gov;

      const stopped = governor.stopRun({ runId, reason: validation.value.reason, _now: now ? new Date(now()).toISOString() : undefined });
      if (!stopped.ok) {
        const code = stopped.error.code || 'CC_ERROR';
        return res.status(code.includes('STORAGE') ? 503 : 400).json({ error: code, message: stopped.error.message });
      }
      return res.status(200).json({ schemaVersion: schemaVersion(), runId, stopped: true });
    }

    // GET /policies  (list policies)
    if (method === 'GET' && rest[0] === 'policies' && rest.length === 1) {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const policies = await store.listPolicies();
      return res.status(200).json({ schemaVersion: schemaVersion(), policies: policies.map((p) => ({ id: p.id, name: p.name, version: p.version, description: p.description })) });
    }

    // POST /policies  (create/update policy, operator)
    if (method === 'POST' && rest[0] === 'policies' && rest.length === 1) {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const payload = parseBody(body);
      const validation = validatePolicyConfig(payload);
      if (!validation.valid) return res.status(400).json({ error: 'validation_failed', details: validation.errors });
      const policy = { ...DEFAULT_COST_CARBON_POLICY, ...validation.value, id: validation.value.id || `policy-${Date.now()}`, version: 1, updatedAt: now ? new Date(now()).toISOString() : undefined };
      await store.setPolicy(policy);
      return res.status(200).json({ schemaVersion: schemaVersion(), ok: true, policy });
    }

    // GET /workflows/:workflowId/aggregate
    if (method === 'GET' && rest[0] === 'workflows' && rest.length === 3 && rest[2] === 'aggregate') {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const workflowId = rest[1];
      if (!ID_SEGMENT.test(workflowId)) return res.status(400).json({ error: 'invalid_workflow_id' });
      const governor = gov;
      const aggregate = governor.getWorkflowAggregate(workflowId);
      if (!aggregate) return res.status(400).json({ error: 'validation_failed', details: [{ field: 'workflowId', code: 'CC_INVALID_TYPE', message: 'workflowId must be a lowercase slug.' }] });
      return res.status(200).json({ schemaVersion: schemaVersion(), ...aggregate });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  };
}

export default createCivicAgentCostCarbonHandler;
export { resetProductionCostCarbonStoreCacheForTests };
