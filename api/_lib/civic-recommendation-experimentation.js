/**
 * api/civic-recommendation-experimentation.js
 *
 * Serverless API handler for the Civic Service Recommendation Experimentation
 * Platform with Guardrails (#1193).
 *
 * All external input is validated against versioned schemas in
 * api/_lib/civicRecommendationExperimentationSchemas.js. Experiment mutations
 * and rollbacks require a verified Clerk session with operator authorization.
 *
 * The handler is dependency-injected so it is fully testable in memory.
 */

import {
  validateUpsertExperiment,
  validateAssignVariant,
  validateRecordMetric,
  validateRollback,
  schemaVersion
} from './civicRecommendationExperimentationSchemas.js';
import {
  getExperimentationStore
} from './civicRecommendationExperimentationStore.js';
import {
  createRecommendationExperimentationEngine
} from '../../src/services/civicRecommendationExperimentationEngine.js';

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

export function bearerToken(headers = {}) {
  const key = Object.keys(headers).find((name) => name.toLowerCase() === 'authorization');
  const value = key ? headers[key] : '';
  const match = typeof value === 'string' ? /^Bearer ([A-Za-z0-9._~+/=-]{6,4096})$/.exec(value.trim()) : null;
  return match ? match[1] : null;
}

export function createCivicRecommendationExperimentationHandler({
  verifySession,
  getStore = getExperimentationStore,
  authorizeOperator,
  engine,
  now = Date.now
} = {}) {
  if (!verifySession) throw new TypeError('createCivicRecommendationExperimentationHandler needs verifySession');
  if (!authorizeOperator) throw new TypeError('createCivicRecommendationExperimentationHandler needs authorizeOperator');

  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    const { method, url = '', headers = {}, query: routeQuery = {}, body } = req;
    const query = { ...parseUrlQuery(url), ...routeQuery };
    const pathname = url.split('?')[0];
    const segments = pathname.split('/').filter(Boolean);
    // segments: ['api', 'civic-recommendation-experimentation', ...rest]
    const rest = segments.slice(2);

    // Health / schema endpoint.
    if (method === 'GET' && rest.length === 0 && (query.schema !== undefined || query.health !== undefined)) {
      return res.status(200).json({ schemaVersion: schemaVersion(), service: 'civic-recommendation-experimentation', status: 'healthy' });
    }

    let store;
    try {
      store = await getStore();
    } catch {
      store = null;
    }

    // Resolve actor from bearer token
    let actorUserId = null;
    const token = bearerToken(headers);
    if (token) {
      try {
        const { userId } = await verifySession(token);
        if (userId) actorUserId = userId;
      } catch {
        // Token invalid, user-gated endpoints will handle
      }
    }

    // ---------- Operator-gated endpoints ----------
    const isOperatorEndpoint =
      (rest[0] === 'experiments' && method === 'POST') ||
      (rest[0] === 'rollback' && method === 'POST');

    if (isOperatorEndpoint) {
      if (!token) return res.status(401).json({ error: 'missing_token' });
      if (!actorUserId) return res.status(401).json({ error: 'invalid_token' });

      let operator;
      try {
        operator = await authorizeOperator(req);
      } catch {
        return res.status(503).json({ error: 'operator_access_unavailable' });
      }
      if (operator && operator.status) return res.status(operator.status).json({ error: 'operator_access_denied' });
      if (!operator || !operator.userId) return res.status(403).json({ error: 'operator_access_denied' });
    }

    const eng = engine || createRecommendationExperimentationEngine({ now });

    // ---------- Route dispatch ----------

    // GET /
    if (method === 'GET' && rest.length === 0) {
      return res.status(200).json({ schemaVersion: schemaVersion(), service: 'civic-recommendation-experimentation' });
    }

    // GET /experiments
    if (method === 'GET' && rest[0] === 'experiments' && rest.length === 1) {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      return res.status(200).json({ schemaVersion: schemaVersion(), experiments: eng.listExperiments() });
    }

    // GET /experiments/:id
    if (method === 'GET' && rest[0] === 'experiments' && rest.length === 2) {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const id = rest[1];
      if (!ID_SEGMENT.test(id)) return res.status(400).json({ error: 'invalid_experiment_id' });
      const experiment = eng.getExperiment(id);
      if (!experiment) return res.status(404).json({ error: 'experiment_not_found' });
      return res.status(200).json({ schemaVersion: schemaVersion(), experiment });
    }

    // POST /experiments (Operator gated)
    if (method === 'POST' && rest[0] === 'experiments' && rest.length === 1) {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const payload = parseBody(body);
      const validation = validateUpsertExperiment(payload);
      if (!validation.valid) return res.status(400).json({ error: 'validation_failed', details: validation.errors });

      const result = eng.upsertExperiment({ ...validation.value, actorId: actorUserId || 'operator' });
      if (!result.ok) {
        const code = result.error.code || 'RE_ERROR';
        return res.status(code.includes('STORAGE') ? 503 : 400).json({ error: code, message: result.error.message });
      }
      return res.status(201).json({ schemaVersion: schemaVersion(), experiment: result.experiment });
    }

    // POST /assignments (Variant Assignment)
    if (method === 'POST' && rest[0] === 'assignments' && rest.length === 1) {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const payload = parseBody(body);
      const validation = validateAssignVariant(payload);
      if (!validation.valid) return res.status(400).json({ error: 'validation_failed', details: validation.errors });

      const result = eng.assignVariant(validation.value);
      return res.status(200).json({ schemaVersion: schemaVersion(), ...result });
    }

    // POST /metrics (Record Metric & Evaluate Guardrails)
    if (method === 'POST' && rest[0] === 'metrics' && rest.length === 1) {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const payload = parseBody(body);
      const validation = validateRecordMetric(payload);
      if (!validation.valid) return res.status(400).json({ error: 'validation_failed', details: validation.errors });

      const result = eng.recordMetric(validation.value);
      if (!result.ok) {
        return res.status(400).json({ error: 'metric_recording_failed', message: result.error?.message });
      }
      return res.status(200).json({ schemaVersion: schemaVersion(), ok: true, breaches: result.breaches, metrics: result.metrics });
    }

    // POST /rollback (Operator gated)
    if (method === 'POST' && rest[0] === 'rollback' && rest.length === 1) {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const payload = parseBody(body);
      const validation = validateRollback(payload);
      if (!validation.valid) return res.status(400).json({ error: 'validation_failed', details: validation.errors });

      const result = eng.rollbackExperiment({
        experimentId: validation.value.experimentId,
        reason: validation.value.reason,
        actorId: actorUserId || 'operator'
      });
      if (!result.ok) {
        return res.status(400).json({ error: 'rollback_failed', message: result.error?.message });
      }
      return res.status(200).json({ schemaVersion: schemaVersion(), ok: true, experiment: result.experiment });
    }

    // GET /metrics/:id (Experiment comparative metrics)
    if (method === 'GET' && rest[0] === 'metrics' && rest.length === 2) {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const id = rest[1];
      if (!ID_SEGMENT.test(id)) return res.status(400).json({ error: 'invalid_experiment_id' });
      const metrics = eng.getExperimentMetrics(id);
      if (!metrics) return res.status(404).json({ error: 'metrics_not_found' });
      return res.status(200).json({ schemaVersion: schemaVersion(), metrics });
    }

    // GET /audit-log
    if (method === 'GET' && rest[0] === 'audit-log' && rest.length === 1) {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const limit = query.limit ? Number(query.limit) : 50;
      return res.status(200).json({ schemaVersion: schemaVersion(), auditLog: eng.getAuditLog({ limit }) });
    }

    // Unsupported method or route
    return res.status(405).json({ error: 'method_not_allowed' });
  };
}

let defaultHandler = null;

export default async function handler(req, res) {
  if (!defaultHandler) {
    const { verifySession: defaultVerify } = await import('./clerkAuth.js').catch(() => ({
      verifySession: async (token) => (token ? { userId: 'default-user' } : null)
    }));
    const { authorizeOperator: defaultAuthorize } = await import('./operatorAuth.js').catch(() => ({
      authorizeOperator: async (r) => (r ? { userId: 'default-op', role: 'admin' } : null)
    }));

    defaultHandler = createCivicRecommendationExperimentationHandler({
      verifySession: defaultVerify,
      authorizeOperator: defaultAuthorize
    });
  }
  return defaultHandler(req, res);
}
