/**
 * api/civic-source-freshness-prediction.js
 *
 * Vercel serverless function exposing the Civic Information Freshness Prediction
 * and Review Prioritization Engine (#1189):
 *
 *   GET  /api/civic-source-freshness-prediction?schema=1          schema version + health
 *   GET  /api/civic-source-freshness-prediction?schema=1          schema version
 *   POST /api/civic-source-freshness-prediction/predict            compute a prediction { serviceId, service, linkHealthRecords, verificationHistory, weights, forceRecompute, nowIso }
 *   GET  /api/civic-source-freshness-prediction/predictions?band=&status=&limit=&cursor=   list predictions
 *   GET  /api/civic-source-freshness-prediction/predictions/:serviceId   get a prediction
 *   POST /api/civic-source-freshness-prediction/predictions/:serviceId/review  review a prediction { reviewerNote, reviewedBy, decision }
 *   GET  /api/civic-source-freshness-prediction/predictions/:serviceId/review-audit  list review audit
 *   GET  /api/civic-source-freshness-prediction/predictions/:serviceId/drift-events  list drift events
 *   POST /api/civic-source-freshness-prediction/drift-events  record a drift event { serviceId, previousScore, currentScore, reason }
 *   GET  /api/civic-source-freshness-prediction/feature-weights   list feature weights
 *
 * All external input is validated against versioned schemas in
 * api/_lib/civicSourceFreshnessPredictionSchemas.js. Review mutations require a
 * verified Clerk session (maintainer). Prediction reads are public.
 *
 * The handler is dependency-injected so it is fully testable without Clerk,
 * Firebase or network access.
 */

import {
  validatePredict,
  validateReviewPrediction,
  validateListQuery,
  validateDriftEvent,
  schemaVersion,
} from './_lib/civicSourceFreshnessPredictionSchemas.js';
import {
  getProductionFreshnessStore,
  resetProductionFreshnessStoreCacheForTests
} from './_lib/civicSourceFreshnessPredictionStore.js';
import { createFreshnessPredictionEngine } from '../src/services/civicSourceFreshnessPredictionEngine.js';

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

export function createCivicSourceFreshnessPredictionHandler({
  verifySession,
  getStore = getProductionFreshnessStore,
  engine,
  now = Date.now
} = {}) {
  if (!verifySession) throw new TypeError('createCivicSourceFreshnessPredictionHandler needs verifySession');

  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    const { method, url = '', headers = {}, query: routeQuery = {}, body } = req;
    const query = { ...parseUrlQuery(url), ...routeQuery };
    const pathname = url.split('?')[0];
    const segments = pathname.split('/').filter(Boolean);
    // segments: ['api', 'civic-source-freshness-prediction', ...rest]
    const rest = segments.slice(2);

    // Health / schema endpoint.
    if (method === 'GET' && rest.length === 0 && query.schema !== undefined) {
      return res.status(200).json({ schemaVersion: schemaVersion(), service: 'civic-source-freshness-prediction', status: 'healthy' });
    }

    let store;
    try {
      store = await getStore();
    } catch {
      store = null;
    }

    // Resolve the actor for review-gated endpoints.
    let actorUserId = null;
    const token = bearerToken(headers);
    if (token) {
      try {
        const { userId } = await verifySession(token);
        if (userId) actorUserId = userId;
      } catch {
        // Invalid token; actor stays null. Review endpoints will 401.
      }
    }

    // ---------- Review-gated endpoints ----------
    const isReviewEndpoint =
      (rest[0] === 'predictions' && rest.length === 3 && rest[2] === 'review' && method === 'POST') ||
      (rest[0] === 'drift-events' && method === 'POST');

    if (isReviewEndpoint) {
      if (!token) return res.status(401).json({ error: 'missing_token' });
      if (!actorUserId) return res.status(401).json({ error: 'invalid_token' });
      req.__freshnessUserId = actorUserId;
    }

    const eng = engine || createFreshnessPredictionEngine({ now });

    // ---------- Route dispatch ----------

    // GET schema
    if (method === 'GET' && rest.length === 0) {
      return res.status(200).json({ schemaVersion: schemaVersion(), service: 'civic-source-freshness-prediction' });
    }

    // POST /predict
    if (method === 'POST' && rest[0] === 'predict' && rest.length === 1) {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const payload = parseBody(body);
      const validation = validatePredict(payload);
      if (!validation.valid) return res.status(400).json({ error: 'validation_failed', details: validation.errors });
      const { serviceId, service, linkHealthRecords, verificationHistory, weights, forceRecompute, nowIso } = validation.value;

      const result = await eng.predict({
        serviceId,
        service,
        linkHealthRecords,
        verificationHistory,
        weights,
        forceRecompute,
        nowIso
      });
      if (!result.ok) {
        const code = result.error.code || 'FP_ERROR';
        return res.status(code.includes('STORAGE') ? 503 : 400).json({ error: code, message: result.error.message });
      }
      return res.status(200).json({ schemaVersion: schemaVersion(), ...result });
    }

    // GET /predictions?band=&status=&limit=&cursor=
    if (method === 'GET' && rest[0] === 'predictions' && rest.length === 1) {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const validation = validateListQuery(query);
      if (!validation.valid) return res.status(400).json({ error: 'validation_failed', details: validation.errors });
      const result = await eng.listPredictions({ band: validation.value.band, status: validation.value.status, limit: validation.value.limit, cursor: validation.value.cursor });
      return res.status(200).json({ schemaVersion: schemaVersion(), ...result });
    }

    // GET /predictions/:serviceId
    if (method === 'GET' && rest[0] === 'predictions' && rest.length === 2) {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const serviceId = rest[1];
      if (!ID_SEGMENT.test(serviceId)) return res.status(400).json({ error: 'invalid_service_id' });
      const prediction = await eng.getPrediction(serviceId);
      if (!prediction) return res.status(404).json({ error: 'prediction_not_found' });
      return res.status(200).json({ schemaVersion: schemaVersion(), prediction });
    }

    // POST /predictions/:serviceId/review  (review-gated)
    if (method === 'POST' && rest[0] === 'predictions' && rest.length === 3 && rest[2] === 'review') {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const serviceId = rest[1];
      if (!ID_SEGMENT.test(serviceId)) return res.status(400).json({ error: 'invalid_service_id' });
      const payload = parseBody(body);
      const validation = validateReviewPrediction(payload);
      if (!validation.valid) return res.status(400).json({ error: 'validation_failed', details: validation.errors });
      const { reviewerNote, reviewedBy, decision } = validation.value;

      const result = await eng.reviewPrediction({
        serviceId,
        reviewerNote,
        reviewedBy: reviewedBy || actorUserId || 'maintainer',
        decision,
        nowIso: now ? new Date(now()).toISOString() : undefined
      });
      if (!result.ok) {
        const code = result.error.code || 'FP_ERROR';
        return res.status(code.includes('STORAGE') ? 503 : 400).json({ error: code, message: result.error.message });
      }
      return res.status(200).json({ schemaVersion: schemaVersion(), ok: true, prediction: result.prediction });
    }

    // GET /predictions/:serviceId/review-audit
    if (method === 'GET' && rest[0] === 'predictions' && rest.length === 3 && rest[1] === 'review-audit') {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const serviceId = rest[2];
      if (!ID_SEGMENT.test(serviceId)) return res.status(400).json({ error: 'invalid_service_id' });
      const validation = validateListQuery(query);
      if (!validation.valid) return res.status(400).json({ error: 'validation_failed', details: validation.errors });
      const events = await eng.getReviewAudit({ serviceId, limit: validation.value.limit });
      return res.status(200).json({ schemaVersion: schemaVersion(), serviceId, events });
    }

    // GET /predictions/:serviceId/drift-events
    if (method === 'GET' && rest[0] === 'predictions' && rest.length === 3 && rest[2] === 'drift-events') {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const serviceId = rest[2];
      if (!ID_SEGMENT.test(serviceId)) return res.status(400).json({ error: 'invalid_service_id' });
      const validation = validateListQuery(query);
      if (!validation.valid) return res.status(400).json({ error: 'validation_failed', details: validation.errors });
      const events = await eng.getDriftEvents({ serviceId, limit: validation.value.limit });
      return res.status(200).json({ schemaVersion: schemaVersion(), serviceId, events });
    }

    // POST /drift-events  { serviceId, previousScore, currentScore, reason }  (review-gated)
    if (method === 'POST' && rest[0] === 'drift-events' && rest.length === 1) {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const payload = parseBody(body);
      const validation = validateDriftEvent(payload);
      if (!validation.valid) return res.status(400).json({ error: 'validation_failed', details: validation.errors });
      const { serviceId, previousScore, currentScore, reason } = validation.value;

      const result = eng.recordDriftEvent({
        serviceId,
        previousScore,
        currentScore,
        reason,
        nowIso: now ? new Date(now()).toISOString() : undefined
      });
      if (!result.ok) {
        const code = result.error.code || 'FP_ERROR';
        return res.status(code.includes('STORAGE') ? 503 : 400).json({ error: code, message: result.error.message });
      }
      return res.status(200).json({ schemaVersion: schemaVersion(), ...result });
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

export default createCivicSourceFreshnessPredictionHandler;
export { resetProductionFreshnessStoreCacheForTests };
