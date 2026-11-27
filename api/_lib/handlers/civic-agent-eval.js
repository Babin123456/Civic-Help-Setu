/* global process */
/**
 * api/_lib/handlers/civic-agent-eval.js
 *
 * Serverless API handler for Civic Agent Evaluation Harness (#1147):
 *   GET  /api/civic-agent-eval?schema=1
 *   GET  /api/civic-agent-eval/scenarios?category=&language=&jurisdiction=
 *   GET  /api/civic-agent-eval/runs?targetId=&limit=
 *   GET  /api/civic-agent-eval/runs/:runId
 *   GET  /api/civic-agent-eval/thresholds
 *   POST /api/civic-agent-eval/runs        (Operator-gated)
 *   POST /api/civic-agent-eval/compare     (Operator-gated)
 *   POST /api/civic-agent-eval/thresholds  (Operator-gated)
 */

import { createRateLimiter, createSingleFlight, clientKey } from '../abuseGuard.js';
import { bearerToken } from '../firebaseToken.js';
import { resolveRole } from '../../../src/services/roleService.js';
import { filterScenarios } from '../../../src/ai/evals/scenarioFixtures.js';
import {
  runScenarioEvaluationSuite,
  compareHarnessRuns,
} from '../../../src/ai/evals/evalRunner.js';
import { getEvalObservabilitySnapshot } from '../../../src/ai/evals/evalObservability.js';
import {
  schemaVersion,
  validateCreateEvalRun,
  validateCompareRuns,
  validateThresholdConfig,
  validateListQuery,
} from '../civicAgentEvalSchemas.js';
import {
  getProductionEvalStore,
  resetDefaultEvalStoreForTests,
} from '../civicAgentEvalStore.js';

const ID_SEGMENT = /^[a-z0-9][a-z0-9_-]{1,127}$/i;
const defaultRateLimiter = createRateLimiter({ limit: 20, windowMs: 60 * 1000 });
const defaultSingleFlight = createSingleFlight();

function parseBody(body) {
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }
  return body && typeof body === 'object' ? body : null;
}

function parseUrlQuery(url) {
  const q = {};
  const idx = (url || '').indexOf('?');
  if (idx === -1) return q;
  const search = url.slice(idx + 1);
  for (const pair of search.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    if (eq === -1) {
      q[decodeURIComponent(pair)] = '';
    } else {
      q[decodeURIComponent(pair.slice(0, eq))] = decodeURIComponent(pair.slice(eq + 1));
    }
  }
  return q;
}

async function defaultVerifyClerkOperator(req) {
  const token = bearerToken(req.headers || {});
  if (!token) return { ok: false, status: 401, error: 'Authentication required.' };

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    return { ok: false, status: 503, error: 'Authentication service is not configured.' };
  }

  try {
    const { verifyToken, createClerkClient } = await import('@clerk/backend');
    const claims = await verifyToken(token, { secretKey });
    const clerk = createClerkClient({ secretKey });
    const user = await clerk.users.getUser(claims.sub);
    const role = resolveRole(user?.publicMetadata);
    if (role !== 'admin') {
      return { ok: false, status: 403, error: 'Operator admin role required.' };
    }
    return { ok: true, actorId: claims.sub, role };
  } catch {
    return { ok: false, status: 401, error: 'Invalid or expired authentication token.' };
  }
}

export function createCivicAgentEvalHandler({
  verifyOperator = defaultVerifyClerkOperator,
  getStore = getProductionEvalStore,
  rateLimiter = defaultRateLimiter,
  singleFlight = defaultSingleFlight,
  registry = undefined,
} = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    const method = (req.method || 'GET').toUpperCase();
    const url = req.url || '';
    const query = { ...parseUrlQuery(url), ...(req.query || {}) };
    const pathname = url.split('?')[0];
    const segments = pathname.split('/').filter(Boolean);
    const rest = segments[0] === 'api' ? segments.slice(2) : segments.slice(1);

    if (method === 'GET' && rest.length === 0) {
      return res.status(200).json({
        schemaVersion: schemaVersion(),
        service: 'civic-agent-eval',
        status: 'healthy',
        observability: getEvalObservabilitySnapshot(),
      });
    }

    let store;
    try {
      store = await getStore();
    } catch {
      store = null;
    }

    if (method === 'GET' && rest[0] === 'scenarios' && rest.length === 1) {
      const validation = validateListQuery(query);
      if (!validation.valid) {
        return res.status(400).json({ error: 'validation_failed', details: validation.errors });
      }
      const scenarios = filterScenarios(validation.value).slice(0, validation.value.limit);
      return res.status(200).json({
        schemaVersion: schemaVersion(),
        total: scenarios.length,
        scenarios,
      });
    }

    if (method === 'GET' && rest[0] === 'thresholds' && rest.length === 1) {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const thresholds = await store.getThresholds();
      return res.status(200).json({ schemaVersion: schemaVersion(), thresholds });
    }

    if (method === 'GET' && rest[0] === 'runs' && rest.length === 1) {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const validation = validateListQuery(query);
      if (!validation.valid) {
        return res.status(400).json({ error: 'validation_failed', details: validation.errors });
      }
      const runs = await store.listRuns(validation.value);
      return res.status(200).json({ schemaVersion: schemaVersion(), runs });
    }

    if (method === 'GET' && rest[0] === 'runs' && rest.length === 2) {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const runId = rest[1];
      if (!ID_SEGMENT.test(runId)) {
        return res.status(400).json({ error: 'invalid_run_id' });
      }
      const run = await store.getRun(runId);
      if (!run) return res.status(404).json({ error: 'run_not_found' });
      return res.status(200).json({ schemaVersion: schemaVersion(), run });
    }

    if (method === 'POST') {
      const key = clientKey(req.headers);
      if (key) {
        const limitCheck = rateLimiter.take(key);
        if (!limitCheck.allowed) {
          res.setHeader('Retry-After', String(limitCheck.retryAfterSeconds || 60));
          return res.status(429).json({ error: 'rate_limit_exceeded' });
        }
      }

      const auth = await verifyOperator(req);
      if (!auth?.ok) {
        return res.status(auth?.status || 403).json({ error: auth?.error || 'Forbidden' });
      }

      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const payload = parseBody(req.body);

      if (rest[0] === 'runs' && rest.length === 1) {
        const validation = validateCreateEvalRun(payload);
        if (!validation.valid) {
          return res.status(400).json({ error: 'validation_failed', details: validation.errors });
        }

        const activeThresholds =
          payload?.thresholds !== undefined ? validation.value.thresholds : await store.getThresholds();
        const flightKey = `eval-run:${auth.actorId}:${validation.value.targetId}:${validation.value.modelId}:${validation.value.modelVersion}`;

        const run = await singleFlight.run(flightKey, async () => {
          const executed = await runScenarioEvaluationSuite(
            { ...validation.value, thresholds: activeThresholds },
            { registry }
          );
          await store.saveRun(executed);
          return executed;
        });

        return res.status(201).json({ schemaVersion: schemaVersion(), run });
      }

      if (rest[0] === 'compare' && rest.length === 1) {
        const validation = validateCompareRuns(payload);
        if (!validation.valid) {
          return res.status(400).json({ error: 'validation_failed', details: validation.errors });
        }

        const baseline = await store.getRun(validation.value.baselineRunId);
        const candidate = await store.getRun(validation.value.candidateRunId);
        if (!baseline || !candidate) {
          return res.status(404).json({ error: 'run_not_found' });
        }

        const activeThresholds = validation.value.thresholds || (await store.getThresholds());
        const report = compareHarnessRuns(baseline, candidate, activeThresholds);
        await store.saveComparison(report);
        return res.status(200).json({ schemaVersion: schemaVersion(), report });
      }

      if (rest[0] === 'thresholds' && rest.length === 1) {
        const validation = validateThresholdConfig(payload);
        if (!validation.valid) {
          return res.status(400).json({ error: 'validation_failed', details: validation.errors });
        }
        const saved = await store.setThresholds(validation.value);
        return res.status(200).json({ schemaVersion: schemaVersion(), thresholds: saved });
      }
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  };
}

export default createCivicAgentEvalHandler();
export { resetDefaultEvalStoreForTests };
