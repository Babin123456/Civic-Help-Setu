/* global process */
/**
 * api/_lib/handlers/recommendation-fairness-audit.js
 *
 * Serverless API handler for the Civic Recommendation Fairness and
 * Coverage Audit Suite (#1449):
 *   GET  /api/recommendation-fairness-audit
 *   GET  /api/recommendation-fairness-audit/datasets
 *   GET  /api/recommendation-fairness-audit/runs
 *   GET  /api/recommendation-fairness-audit/runs/:runId
 *   GET  /api/recommendation-fairness-audit/thresholds
 *   GET  /api/recommendation-fairness-audit/audit-log        (Operator-gated)
 *   POST /api/recommendation-fairness-audit/datasets         (Operator-gated + jurisdiction check)
 *   POST /api/recommendation-fairness-audit/runs             (Operator-gated + jurisdiction check)
 *   POST /api/recommendation-fairness-audit/thresholds       (Operator-gated + jurisdiction check)
 */

import { createRateLimiter, createSingleFlight, clientKey } from '../abuseGuard.js';
import { bearerToken } from '../firebaseToken.js';
import { resolveRole } from '../../../src/services/roleService.js';
import {
  AUDIT_SCHEMA_VERSION,
  COHORT_AXES,
  validateNoSensitiveTraitOrPii,
  validateOfflineEvalDataset,
  evaluateProvenanceVerification,
} from '../../../src/services/recommendationFairnessAuditContract.js';
import { runFairnessAndCoverageAudit } from '../../../src/services/recommendationFairnessAuditService.js';
import { getProductionFairnessAuditStore } from '../recommendationFairnessAuditStore.js';

const ID_SEGMENT = /^[a-z0-9][a-z0-9_-]{1,127}$/i;
const defaultRateLimiter = createRateLimiter({ limit: 30, windowMs: 60 * 1000 });
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

export async function defaultVerifyFairnessOperator(req) {
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
    const jurisdiction =
      typeof user?.publicMetadata?.jurisdiction === 'string' && user.publicMetadata.jurisdiction.trim()
        ? user.publicMetadata.jurisdiction.trim()
        : '*';
    return { ok: true, actorId: claims.sub, role, jurisdiction };
  } catch {
    return { ok: false, status: 401, error: 'Invalid or expired authentication token.' };
  }
}

function isJurisdictionAuthorized(operatorJurisdiction, targetJurisdiction) {
  if (!operatorJurisdiction || operatorJurisdiction === '*') return true;
  if (!targetJurisdiction || targetJurisdiction === 'UNSPECIFIED') return false;
  return operatorJurisdiction.toLowerCase() === String(targetJurisdiction).trim().toLowerCase();
}

export function createRecommendationFairnessAuditHandler({
  verifyOperator = defaultVerifyFairnessOperator,
  getStore = getProductionFairnessAuditStore,
  rateLimiter = defaultRateLimiter,
  singleFlight = defaultSingleFlight,
} = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json');

    const method = (req.method || 'GET').toUpperCase();
    const url = req.url || '';
    const query = { ...parseUrlQuery(url), ...(req.query || {}) };
    const pathname = url.split('?')[0];
    const segments = pathname.split('/').filter(Boolean);
    const rest = segments[0] === 'api' ? segments.slice(2) : segments.slice(1);

    const ipKey = clientKey(req);
    const rate = rateLimiter.take(ipKey);
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
      return res.status(429).json({
        error: 'Rate limit exceeded. Please retry later.',
        code: 'ERR_RATE_LIMIT',
      });
    }

    let store;
    try {
      store = await getStore();
    } catch {
      return res.status(503).json({ error: 'Fairness audit store unavailable.' });
    }

    if (method === 'GET' && rest.length === 0) {
      return res.status(200).json({
        schemaVersion: AUDIT_SCHEMA_VERSION,
        service: 'recommendation-fairness-audit',
        status: 'healthy',
        cohortAxes: COHORT_AXES,
      });
    }

    if (method === 'GET' && rest[0] === 'datasets' && rest.length === 1) {
      const datasets = await store.listDatasets({
        jurisdiction: query.jurisdiction || null,
      });
      return res.status(200).json({ schemaVersion: AUDIT_SCHEMA_VERSION, datasets });
    }

    if (method === 'GET' && rest[0] === 'runs' && rest.length === 1) {
      const runs = await store.listRuns({
        limit: query.limit,
        datasetId: query.datasetId || null,
        cohortAxis: query.cohortAxis || null,
        jurisdiction: query.jurisdiction || null,
      });
      return res.status(200).json({ schemaVersion: AUDIT_SCHEMA_VERSION, runs });
    }

    if (method === 'GET' && rest[0] === 'runs' && rest.length === 2) {
      if (!ID_SEGMENT.test(rest[1])) {
        return res.status(400).json({ error: 'Invalid runId format.' });
      }
      const run = await store.getRun(rest[1]);
      if (!run) return res.status(404).json({ error: 'Audit run not found.' });
      return res.status(200).json({ schemaVersion: AUDIT_SCHEMA_VERSION, run });
    }

    if (method === 'GET' && rest[0] === 'thresholds' && rest.length === 1) {
      const policy = await store.getPolicy();
      return res.status(200).json({ schemaVersion: AUDIT_SCHEMA_VERSION, policy });
    }

    // Operator-gated routes
    const isOperatorRoute =
      (method === 'GET' && rest[0] === 'audit-log') ||
      (method === 'POST' && ['datasets', 'runs', 'thresholds'].includes(rest[0]));

    if (!isOperatorRoute) {
      return res.status(404).json({ error: 'Fairness audit endpoint not found.' });
    }

    const auth = await verifyOperator(req);
    if (!auth?.ok) {
      return res.status(auth?.status || 401).json({ error: auth?.error || 'Unauthorized' });
    }

    if (method === 'GET' && rest[0] === 'audit-log') {
      const entries = await store.listAuditLog({ limit: query.limit });
      return res.status(200).json({ schemaVersion: AUDIT_SCHEMA_VERSION, entries });
    }

    const body = parseBody(req.body);
    if (!body) {
      return res.status(400).json({ error: 'Request body must be valid JSON.' });
    }

    const sensitivity = validateNoSensitiveTraitOrPii(body, 'request');
    if (!sensitivity.valid) {
      return res.status(400).json({
        error: 'Sensitive-trait inference or PII is strictly prohibited.',
        code: 'ERR_SENSITIVE_OR_PII_PROHIBITED',
        details: sensitivity.violations,
      });
    }

    if (method === 'POST' && rest[0] === 'datasets') {
      const validation = validateOfflineEvalDataset(body);
      if (!validation.valid) {
        return res.status(400).json({
          error: 'Invalid offline evaluation dataset payload.',
          details: validation.errors,
        });
      }

      const targetJurisdiction = validation.normalized.provenance.jurisdiction;
      if (!isJurisdictionAuthorized(auth.jurisdiction, targetJurisdiction)) {
        return res.status(403).json({
          error: `Operator jurisdiction '${auth.jurisdiction}' cannot modify dataset for '${targetJurisdiction}'.`,
        });
      }

      const saved = await store.saveDataset(validation.normalized);
      await store.appendAuditLog({
        action: 'REGISTER_DATASET',
        actorId: auth.actorId,
        role: auth.role,
        jurisdiction: targetJurisdiction,
        targetId: saved.id,
        status: saved.provenance.status,
        summary: `Registered offline eval dataset ${saved.id} (${saved.records.length} cases)`,
      });

      return res.status(201).json({ schemaVersion: AUDIT_SCHEMA_VERSION, dataset: saved });
    }

    if (method === 'POST' && rest[0] === 'runs') {
      const datasetId = typeof body.datasetId === 'string' ? body.datasetId.trim() : '';
      const cohortAxis = typeof body.cohortAxis === 'string' ? body.cohortAxis.trim() : 'language';
      const baselineRunId = typeof body.baselineRunId === 'string' ? body.baselineRunId.trim() : null;

      if (!ID_SEGMENT.test(datasetId)) {
        return res.status(400).json({ error: 'Valid datasetId is required.' });
      }
      if (!COHORT_AXES.includes(cohortAxis)) {
        return res.status(400).json({
          error: `cohortAxis must be one of: ${COHORT_AXES.join(', ')}`,
        });
      }

      const dataset = await store.getDataset(datasetId);
      if (!dataset) {
        return res.status(404).json({ error: `Dataset '${datasetId}' not found.` });
      }

      const targetJurisdiction = dataset.provenance?.jurisdiction;
      if (!isJurisdictionAuthorized(auth.jurisdiction, targetJurisdiction)) {
        return res.status(403).json({
          error: `Operator jurisdiction '${auth.jurisdiction}' cannot audit dataset for '${targetJurisdiction}'.`,
        });
      }

      const policy = await store.getPolicy();
      const baselineRun = baselineRunId ? await store.getRun(baselineRunId) : null;
      const flightKey = `audit:${datasetId}:${cohortAxis}:${baselineRunId || 'none'}:${body.idempotencyKey || 'default'}`;

      const run = await singleFlight.run(flightKey, async () => {
        const evaluated = runFairnessAndCoverageAudit({
          dataset,
          cohortAxis,
          policy,
          baselineRun,
        });
        await store.saveRun(evaluated);
        await store.appendAuditLog({
          action: 'RUN_FAIRNESS_AUDIT',
          actorId: auth.actorId,
          role: auth.role,
          jurisdiction: targetJurisdiction || 'UNSPECIFIED',
          targetId: evaluated.runId,
          status: evaluated.gate.status,
          summary: `Audit ${evaluated.runId} on ${datasetId} (${cohortAxis}): ${evaluated.gate.status}`,
        });
        return evaluated;
      });

      return res.status(201).json({ schemaVersion: AUDIT_SCHEMA_VERSION, run });
    }

    if (method === 'POST' && rest[0] === 'thresholds') {
      const numericFields = [
        'minCohortSize',
        'minRecallAt5',
        'minNdcgAt5',
        'minParityRatio',
        'minCompletionRate',
        'maxAbstentionRate',
        'minCatalogCoverage',
        'maxRegressionDelta',
      ];

      const next = {};
      for (const field of numericFields) {
        if (body[field] !== undefined) {
          const num = Number(body[field]);
          if (!Number.isFinite(num) || num < 0) {
            return res.status(400).json({ error: `${field} must be a non-negative number.` });
          }
          if (field === 'minCohortSize' && num < 5) {
            return res.status(400).json({
              error: 'minCohortSize cannot be lower than 5 to preserve k-anonymity suppression.',
            });
          }
          if (field !== 'minCohortSize' && num > 1) {
            return res.status(400).json({ error: `${field} must be between 0 and 1.` });
          }
          next[field] = num;
        }
      }

      if (body.provenance && typeof body.provenance === 'object') {
        const provCheck = evaluateProvenanceVerification(body.provenance);
        next.provenance = {
          ...body.provenance,
          verified: provCheck.verified,
          status: provCheck.status,
          missingFields: provCheck.missingFields,
        };
      }

      const targetJurisdiction = next.provenance?.jurisdiction || (await store.getPolicy()).provenance?.jurisdiction;
      if (!isJurisdictionAuthorized(auth.jurisdiction, targetJurisdiction)) {
        return res.status(403).json({
          error: `Operator jurisdiction '${auth.jurisdiction}' cannot update policy for '${targetJurisdiction}'.`,
        });
      }

      const updated = await store.setPolicy(next);
      await store.appendAuditLog({
        action: 'UPDATE_THRESHOLDS',
        actorId: auth.actorId,
        role: auth.role,
        jurisdiction: targetJurisdiction || 'UNSPECIFIED',
        targetId: 'policy',
        status: updated.provenance?.verified ? 'verified' : 'unverified',
        summary: `Updated fairness gate policy (minCohortSize=${updated.minCohortSize}, minParityRatio=${updated.minParityRatio})`,
      });

      return res.status(200).json({ schemaVersion: AUDIT_SCHEMA_VERSION, policy: updated });
    }

    return res.status(404).json({ error: 'Fairness audit endpoint not found.' });
  };
}

export default createRecommendationFairnessAuditHandler();

