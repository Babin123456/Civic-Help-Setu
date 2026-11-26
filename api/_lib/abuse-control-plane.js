import { withApiErrorContract } from './errorContract.js';
/**
 * api/abuse-control-plane.js
 *
 * Vercel serverless function exposing the Abuse Control Plane (#1174):
 *
 *   GET  /api/abuse-control-plane?schema=1          schema version + health
 *   GET  /api/abuse-control-plane/quotas?route=     list route quotas (operator)
 *   POST /api/abuse-control-plane/quotas            set route quota (operator)
 *   GET  /api/abuse-control-plane/signals           list abuse signals (operator)
 *   GET  /api/abuse-control-plane/appeals           list appeals (operator)
 *   POST /api/abuse-control-plane/appeals           create appeal (user)
 *   GET  /api/abuse-control-plane/appeals/:id       appeal status (user/operator)
 *   PATCH /api/abuse-control-plane/appeals/:id      update appeal (operator)
 *   POST /api/abuse-control-plane/blocklist         blocklist identifier (operator)
 *   POST /api/abuse-control-plane/allowlist         allowlist identifier (operator)
 *
 * All external input is validated against versioned schemas in api/_lib/abuseSchemas.js.
 * Operator mutations require a verified Clerk session with the operator role.
 * Appeal mutations are user actions and require a verified Clerk session.
 *
 * The handler is dependency-injected so it is fully testable without Clerk,
 * Firebase or network access (see tests/abuse-control-plane.test.js).
 */

/* global process */
import { createHash } from 'node:crypto';
import {
  validateRouteQuota,
  validateListEntry,
  validateCreateAppeal,
  validateUpdateAppeal,
  validateListQuery,
  schemaVersion,
} from './abuseSchemas.js';
import { privacyIdentifier } from './abuseControlPlane.js';
import { getProductionAbuseStore, resetProductionAbuseStoreCacheForTests } from './abuseStore.js';
import { withRequestSecurity } from './requestSecurity.js';

const ID_SEGMENT = /^[a-z0-9_-]{1,128}$/;

function parseBody(body) {
  if (!body || typeof body !== 'object') return null;
  return body;
}

/** Parse query string from a URL into an object (Vercel does this in production). */
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

export function createAbuseControlPlaneHandler({
  verifySession,
  getStore = getProductionAbuseStore,
  authorizeOperator,
  now = Date.now,
  secret = process.env.ABUSE_CONTROL_SECRET || 'dev-secret-change-me',
} = {}) {
  if (!verifySession) throw new TypeError('createAbuseControlPlaneHandler needs verifySession');
  if (!authorizeOperator) throw new TypeError('createAbuseControlPlaneHandler needs authorizeOperator');

  return withApiErrorContract(withRequestSecurity(async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    const { method, url = '', headers = {}, query: routeQuery = {}, body } = req;
    const query = { ...parseUrlQuery(url), ...routeQuery };
    const pathname = url.split('?')[0];
    const segments = pathname.split('/').filter(Boolean);
    // segments: ['api', 'abuse-control-plane', ...rest]
    const rest = segments.slice(2);

    // Health / schema endpoint.
    if (method === 'GET' && rest.length === 0 && query.schema !== undefined) {
      return res.status(200).json({ schemaVersion: schemaVersion(), service: 'abuse-control-plane', status: 'healthy' });
    }

    // Resolve store (may be null when Firebase not configured; in-memory limits still apply).
    let store;
    try {
      store = await getStore();
    } catch {
      store = null;
    }

    // ---------- Operator-gated endpoints ----------
    const isOperatorEndpoint = ['quotas', 'signals', 'blocklist', 'allowlist'].includes(rest[0])
      || (rest[0] === 'appeals' && method === 'PATCH');

    if (isOperatorEndpoint) {
      let actor;
      try {
        actor = await authorizeOperator(req);
      } catch {
        return res.status(503).json({ error: 'operator_access_unavailable' });
      }
      if (actor && actor.status) return res.status(actor.status).json({ error: 'operator_access_denied' });
      if (!actor || !actor.userId) return res.status(403).json({ error: 'operator_access_denied' });
    }

    // ---------- User-gated endpoints (appeals create/read) ----------
    const isUserEndpoint = rest[0] === 'appeals' && (method === 'POST' || (method === 'GET' && rest.length === 2));
    if (isUserEndpoint) {
      const token = bearerToken(headers);
      if (!token) return res.status(401).json({ error: 'missing_token' });
      let userId;
      try {
        ({ userId } = await verifySession(token));
      } catch {
        return res.status(401).json({ error: 'invalid_token' });
      }
      if (typeof userId !== 'string' || userId.length === 0 || userId.length > 128) {
        return res.status(401).json({ error: 'invalid_token' });
      }
      req.__abuseUserId = userId;
    }

    // ---------- Route dispatch ----------

    // GET schema
    if (method === 'GET' && rest.length === 0) {
      return res.status(200).json({ schemaVersion: schemaVersion(), service: 'abuse-control-plane' });
    }

    // GET /quotas?route=
    if (method === 'GET' && rest[0] === 'quotas') {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const validation = validateListQuery(query);
      if (!validation.valid) return res.status(400).json({ error: 'validation_failed', details: validation.errors });
      return res.status(200).json({
        schemaVersion: schemaVersion(),
        quotas: [...(store.quotas || new Map()).entries()].map(([bucket, value]) => ({ bucket, ...value })),
      });
    }

    // POST /quotas  { route, method, limit, windowMs, adaptive }
    if (method === 'POST' && rest[0] === 'quotas') {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const payload = parseBody(body);
      const validation = validateRouteQuota(payload);
      if (!validation.valid) return res.status(400).json({ error: 'validation_failed', details: validation.errors });
      const { route, method: m, limit, windowMs, adaptive } = validation.value;
      const bucket = `quota:${m || '*'}:${route}`;
      await store.setQuota(bucket, { route, method: m, limit, windowMs, adaptive, updatedAt: now() });
      return res.status(201).json({ ok: true, bucket, schemaVersion: schemaVersion() });
    }

    // GET /signals?bucket=&since=
    if (method === 'GET' && rest[0] === 'signals') {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const validation = validateListQuery(query);
      if (!validation.valid) return res.status(400).json({ error: 'validation_failed', details: validation.errors });
      const { bucket, since } = validation.value;
      if (!bucket) return res.status(400).json({ error: 'bucket_required' });
      const signals = await store.getSignals(bucket, since ? new Date(since).getTime() : 0);
      return res.status(200).json({ schemaVersion: schemaVersion(), bucket, signals });
    }

    // GET /appeals?status=&limit=&cursor=
    if (method === 'GET' && rest[0] === 'appeals' && rest.length === 1) {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const validation = validateListQuery(query);
      if (!validation.valid) return res.status(400).json({ error: 'validation_failed', details: validation.errors });
      const result = await store.listAppeals({ status: validation.value.status, limit: validation.value.limit, cursor: validation.value.cursor });
      return res.status(200).json({ schemaVersion: schemaVersion(), ...result });
    }

    // POST /appeals  { identifierHash, route, reason }  (user creates an appeal)
    if (method === 'POST' && rest[0] === 'appeals' && rest.length === 1) {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const userId = req.__abuseUserId;
      const payload = parseBody(body);
      const validation = validateCreateAppeal(payload);
      if (!validation.valid) return res.status(400).json({ error: 'validation_failed', details: validation.errors });
      const { identifierHash, route, reason } = validation.value;
      // Privacy: the appeal references the hashed identifier only.
      const appealId = createHash('sha256')
        .update(`${identifierHash}:${route}:${now()}`)
        .digest('hex').slice(0, 24);
      const appeal = {
        id: appealId,
        identifierHash,
        route,
        reason,
        userId: privacyIdentifier(userId, secret),
        status: 'pending',
        requestedAt: now(),
        createdAt: now(),
        updatedAt: now(),
      };
      const created = await store.createAppeal(appeal);
      return res.status(201).json({ schemaVersion: schemaVersion(), appeal: created });
    }

    // GET /appeals/:id  (appeal status)
    if (method === 'GET' && rest[0] === 'appeals' && rest.length === 2) {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const appealId = rest[1];
      if (!ID_SEGMENT.test(appealId)) return res.status(400).json({ error: 'invalid_appeal_id' });
      const appeal = await store.getAppeal(appealId);
      if (!appeal) return res.status(404).json({ error: 'appeal_not_found' });
      return res.status(200).json({ schemaVersion: schemaVersion(), appeal });
    }

    // PATCH /appeals/:id  { status, reviewerNote }  (operator updates)
    if (method === 'PATCH' && rest[0] === 'appeals' && rest.length === 2) {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const appealId = rest[1];
      if (!ID_SEGMENT.test(appealId)) return res.status(400).json({ error: 'invalid_appeal_id' });
      const payload = parseBody(body);
      const validation = validateUpdateAppeal(payload);
      if (!validation.valid) return res.status(400).json({ error: 'validation_failed', details: validation.errors });
      const updated = await store.updateAppeal(appealId, validation.value);
      if (!updated) return res.status(404).json({ error: 'appeal_not_found' });
      return res.status(200).json({ schemaVersion: schemaVersion(), appeal: updated });
    }

    // POST /blocklist  { identifierHash, route, reason, expiresAt }
    if (method === 'POST' && rest[0] === 'blocklist') {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const payload = parseBody(body);
      const validation = validateListEntry(payload);
      if (!validation.valid) return res.status(400).json({ error: 'validation_failed', details: validation.errors });
      const { identifierHash, route, reason, expiresAt } = validation.value;
      await store.setBlocklist(identifierHash, route, reason, expiresAt);
      return res.status(200).json({ ok: true, schemaVersion: schemaVersion() });
    }

    // POST /allowlist  { identifierHash, route, reason, expiresAt }
    if (method === 'POST' && rest[0] === 'allowlist') {
      if (!store) return res.status(503).json({ error: 'store_unavailable' });
      const payload = parseBody(body);
      const validation = validateListEntry(payload);
      if (!validation.valid) return res.status(400).json({ error: 'validation_failed', details: validation.errors });
      const { identifierHash, route, reason, expiresAt } = validation.value;
      await store.setAllowlist(identifierHash, route, reason, expiresAt);
      return res.status(200).json({ ok: true, schemaVersion: schemaVersion() });
    }

    res.setHeader('Allow', 'GET, POST, PATCH');
    return res.status(405).json({ error: 'method_not_allowed' });
  }, { allowMissingOrigin: true }));
}

// Expose for tests.
export default createAbuseControlPlaneHandler;
export { resetProductionAbuseStoreCacheForTests };
