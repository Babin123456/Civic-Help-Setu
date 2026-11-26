/**
 * api/civic-contract-test-marketplace.js
 *
 * Vercel serverless function exposing the Civic Service Integration Contract
 * Test Marketplace (#1191):
 *
 *   GET  /api/civic-contract-test-marketplace?schema=1    schema version + health
 *   GET  /api/civic-contract-test-marketplace/adapters     list adapters
 *   POST /api/civic-contract-test-marketplace/adapters     upsert an adapter
 *   GET  /api/civic-contract-test-marketplace/adapters/:id get an adapter
 *   GET  /api/civic-contract-test-marketplace/suites       list suites
 *   POST /api/civic-contract-test-marketplace/suites       upsert a suite
 *   GET  /api/civic-contract-test-marketplace/suites/:id   get a suite
 *   POST /api/civic-contract-test-marketplace/suites/:id/run run a suite
 *   GET  /api/civic-contract-test-marketplace/runs/:id     get a run
 *   GET  /api/civic-contract-test-marketplace/runs/:id/results get run results
 *   POST /api/civic-contract-test-marketplace/runs/:id/drift record a drift event
 *   GET  /api/civic-contract-test-marketplace/audit-log    list audit log
 *   GET  /api/civic-contract-test-marketplace/feature-weights list feature weights
 *
 * All external input is validated against versioned schemas in
 * api/_lib/civicContractTestMarketplaceSchemas.json. Adapter and suite mutations
 * require a verified Clerk session with the operator role. Run execution is
 * user-gated.
 *
 * The handler is dependency-injected so it is fully testable without Clerk,
 * Firebase or network access.
 */

import {
  validateUpsertAdapter,
  validateUpsertSuite,
  validateRunSuite,
  validateListQuery,
  validateRecordDrift,
  schemaVersion
} from './_lib/civicContractTestMarketplaceSchemas.js';
import {
  getContractTestStore,
  resetContractTestStoreCacheForTests
} from './_lib/civicContractTestMarketplaceStore.js';
import { createContractTestMarketplaceEngine } from '../src/services/civicContractTestMarketplaceEngine.js';

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

export function createCivicContractTestMarketplaceHandler({
  verifySession,
  getStore = getContractTestStore,
  authorizeOperator,
  engine,
  now = Date.now
} = {}) {
  if (!verifySession) throw new TypeError('createCivicContractTestMarketplaceHandler needs verifySession');
  if (!authorizeOperator) throw new TypeError('createCivicContractTestMarketplaceHandler needs authorizeOperator');

  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    const { method, url = '', headers = {}, query: routeQuery = {}, body } = req;
    const query = { ...parseUrlQuery(url), ...routeQuery };
    const pathname = url.split('?')[0];
    const segments = pathname.split('/').filter(Boolean);
    const rest = segments.slice(2);

    // Health / schema endpoint.
    if (method === 'GET' && rest.length === 0 && query.schema !== undefined) {
      return res.status(200).json({ schemaVersion: schemaVersion(), service: 'civic-contract-test-marketplace', status: 'healthy' });
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
        // Invalid token; actor stays null.
      }
    }

    // ---------- Operator-gated endpoints ----------
    const isOperatorEndpoint =
      (rest[0] === 'adapters' && method === 'POST') ||
      (rest[0] === 'suites' && method === 'POST');

    if (isOperatorEndpoint) {
      if (!token) return res.status(401).json({ error: 'missing_token' });
      let operator;
      try {
        operator = await authorizeOperator(req);
      } catch {
        return res.status(503).json({ error: 'operator_access_unavailable' });
      }
      if (operator && operator.status) return res.status(operator.status).json({ error: 'operator_access_denied' });
      if (!operator || !operator.userId) return res.status(403).json({ error: 'operator_access_denied' });
    }

    // ---------- User-gated endpoints (run suite, record drift) ----------
    const isUserEndpoint =
      (rest[0] === 'suites' && rest.length === 3 && rest[2] === 'run' && method === 'POST') ||
      (rest[0] === 'runs' && rest.length === 3 && rest[2] === 'drift' && method === 'POST');

    if (isUserEndpoint) {
      if (!token) return res.status(401).json({ error: 'missing_token' });
      if (!actorUserId) return res.status(401).json({ error: 'invalid_token' });
      req.__marketplaceUserId = actorUserId;
    }

    const eng = engine || createContractTestMarketplaceEngine({ now });

    // ---------- Route dispatch ----------

    // GET schema
    if (method === 'GET' && rest.length === 0) {
      return res.status(200).json({ schemaVersion: schemaVersion(), service: 'civic-contract-test-marketplace' });
    }

    // GET /adapters
    if (method === 'GET' && rest[0] === 'adapters' && rest.length === 1) {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      return res.status(200).json({ schemaVersion: schemaVersion(), adapters: eng.listAdapters() });
    }

    // POST /adapters (operator)
    if (method === 'POST' && rest[0] === 'adapters' && rest.length === 1) {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const payload = parseBody(body);
      const validation = validateUpsertAdapter(payload);
      if (!validation.valid) return res.status(400).json({ error: 'validation_failed', details: validation.errors });
      const { id, name, type, baseUrl, authType, authConfig, headers, timeoutMs, retryCount, isActive, description } = validation.value;
      const result = eng.upsertAdapter({ id, name, type, baseUrl, authType, authConfig, headers, timeoutMs, retryCount, isActive, description, createdBy: actorUserId || 'operator', nowIso: now ? new Date(now()).toISOString() : undefined });
      if (!result.ok) {
        const code = result.error.code || 'CT_ERROR';
        return res.status(code.includes('STORAGE') ? 503 : 400).json({ error: code, message: result.error.message });
      }
      return res.status(200).json({ schemaVersion: schemaVersion(), ok: true, adapter: result.adapter });
    }

    // GET /adapters/:id
    if (method === 'GET' && rest[0] === 'adapters' && rest.length === 2) {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const adapterId = rest[1];
      if (!ID_SEGMENT.test(adapterId)) return res.status(400).json({ error: 'invalid_adapter_id' });
      const adapter = eng.getAdapter(adapterId);
      if (!adapter) return res.status(404).json({ error: 'adapter_not_found' });
      return res.status(200).json({ schemaVersion: schemaVersion(), adapter });
    }

    // GET /suites
    if (method === 'GET' && rest[0] === 'suites' && rest.length === 1) {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const validation = validateListQuery(query);
      if (!validation.valid) return res.status(400).json({ error: 'validation_failed', details: validation.errors });
      return res.status(200).json({ schemaVersion: schemaVersion(), suites: eng.listSuites({ adapterId: validation.value.adapterId }) });
    }

    // POST /suites (operator)
    if (method === 'POST' && rest[0] === 'suites' && rest.length === 1) {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const payload = parseBody(body);
      const validation = validateUpsertSuite(payload);
      if (!validation.valid) return res.status(400).json({ error: 'validation_failed', details: validation.errors });
      const { id, adapterId, name, description, status, tests, schedule } = validation.value;
      const result = eng.upsertSuite({ id, adapterId, name, description, status, tests, schedule, createdBy: actorUserId || 'operator', nowIso: now ? new Date(now()).toISOString() : undefined });
      if (!result.ok) {
        const code = result.error.code || 'CT_ERROR';
        return res.status(code.includes('STORAGE') ? 503 : 400).json({ error: code, message: result.error.message });
      }
      return res.status(200).json({ schemaVersion: schemaVersion(), ok: true, suite: result.suite });
    }

    // GET /suites/:id
    if (method === 'GET' && rest[0] === 'suites' && rest.length === 2) {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const suiteId = rest[1];
      if (!ID_SEGMENT.test(suiteId)) return res.status(400).json({ error: 'invalid_suite_id' });
      const suite = eng.getSuite(suiteId);
      if (!suite) return res.status(404).json({ error: 'suite_not_found' });
      return res.status(200).json({ schemaVersion: schemaVersion(), suite });
    }

    // POST /suites/:id/run (user-gated)
    if (method === 'POST' && rest[0] === 'suites' && rest.length === 3 && rest[2] === 'run') {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const suiteId = rest[1];
      if (!ID_SEGMENT.test(suiteId)) return res.status(400).json({ error: 'invalid_suite_id' });
      const payload = parseBody(body);
      const validation = validateRunSuite(payload);
      if (!validation.valid) return res.status(400).json({ error: 'validation_failed', details: validation.errors });
      const { adapterId, forceRecompute } = validation.value;
      const result = await eng.runSuite({ suiteId, adapterId, forceRecompute, nowIso: now ? new Date(now()).toISOString() : undefined });
      if (!result.ok) {
        const code = result.error.code || 'CT_ERROR';
        return res.status(code.includes('STORAGE') ? 503 : 400).json({ error: code, message: result.error.message });
      }
      return res.status(200).json({ schemaVersion: schemaVersion(), ok: true, run: result.run, results: result.results, summary: result.summary, conformanceScore: result.conformanceScore, breakingChanges: result.breakingChanges, maliciousPayloadsDetected: result.maliciousPayloadsDetected });
    }

    // GET /runs/:id
    if (method === 'GET' && rest[0] === 'runs' && rest.length === 2) {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const runId = rest[1];
      if (!ID_SEGMENT.test(runId)) return res.status(400).json({ error: 'invalid_run_id' });
      const run = eng.getRun(runId);
      if (!run) return res.status(404).json({ error: 'run_not_found' });
      return res.status(200).json({ schemaVersion: schemaVersion(), run });
    }

    // GET /runs/:id/results
    if (method === 'GET' && rest[0] === 'runs' && rest.length === 3 && rest[2] === 'results') {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const runId = rest[1];
      if (!ID_SEGMENT.test(runId)) return res.status(400).json({ error: 'invalid_run_id' });
      const validation = validateListQuery(query);
      if (!validation.valid) return res.status(400).json({ error: 'validation_failed', details: validation.errors });
      return res.status(200).json({ schemaVersion: schemaVersion(), results: eng.getRunResults({ runId, limit: validation.value.limit }) });
    }

    // POST /runs/:id/drift (user-gated)
    if (method === 'POST' && rest[0] === 'runs' && rest.length === 3 && rest[2] === 'drift') {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const runId = rest[1];
      if (!ID_SEGMENT.test(runId)) return res.status(400).json({ error: 'invalid_run_id' });
      const payload = parseBody(body);
      const validation = validateRecordDrift(payload);
      if (!validation.valid) return res.status(400).json({ error: 'validation_failed', details: validation.errors });
      const { previousScore, currentScore, reason } = validation.value;
      const result = eng.recordDriftEvent({ runId, previousScore, currentScore, reason, nowIso: now ? new Date(now()).toISOString() : undefined });
      if (!result.ok) {
        const code = result.error.code || 'CT_ERROR';
        return res.status(code.includes('STORAGE') ? 503 : 400).json({ error: code, message: result.error.message });
      }
      return res.status(200).json({ schemaVersion: schemaVersion(), ok: true, recorded: result.recorded, drift: result.drift });
    }

    // GET /audit-log
    if (method === 'GET' && rest[0] === 'audit-log' && rest.length === 1) {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const validation = validateListQuery(query);
      if (!validation.valid) return res.status(400).json({ error: 'validation_failed', details: validation.errors });
      return res.status(200).json({ schemaVersion: schemaVersion(), auditLog: eng.getAuditLog({ limit: validation.value.limit }) });
    }

    // GET /feature-weights
    if (method === 'GET' && rest[0] === 'feature-weights' && rest.length === 1) {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      return res.status(200).json({ schemaVersion: schemaVersion(), weights: eng.listFeatureWeights() });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  };
}

export default createCivicContractTestMarketplaceHandler;
export { resetContractTestStoreCacheForTests };
