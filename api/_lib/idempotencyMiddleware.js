/* global process */
/**
 * api/_lib/idempotencyMiddleware.js
 *
 * HTTP Idempotency-Key middleware and concurrent request coalescing layer
 * for Civic Help Setu serverless write APIs (#1335).
 */

import { createHash } from 'node:crypto';
import { createSingleFlight, clientKey } from './abuseGuard.js';
import { createIdempotencyStore, DEFAULT_IDEMPOTENCY_TTL_MS } from './idempotencyStore.js';

export const IDEMPOTENCY_HEADER = 'idempotency-key';
export const IDEMPOTENCY_METHODS = Object.freeze(['POST', 'PUT', 'PATCH', 'DELETE']);
const KEY_PATTERN = /^[a-zA-Z0-9._:-]{8,128}$/;

/**
 * Recursively canonicalizes JSON-serializable values so object key order
 * does not affect the request payload hash.
 */
export function canonicalizeValue(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalizeValue);
  }
  const sorted = {};
  for (const key of Object.keys(value).sort()) {
    if (value[key] !== undefined) {
      sorted[key] = canonicalizeValue(value[key]);
    }
  }
  return sorted;
}

/**
 * Computes a deterministic SHA-256 hash of method + route + canonicalized body.
 */
export function canonicalPayloadHash({ method = 'POST', route = '', body = null } = {}) {
  let normalizedBody = body;
  if (typeof body === 'string') {
    try {
      normalizedBody = JSON.parse(body);
    } catch {
      normalizedBody = body;
    }
  }
  const canonical = JSON.stringify({
    method: String(method).toUpperCase(),
    route: String(route),
    body: canonicalizeValue(normalizedBody ?? null),
  });
  return createHash('sha256').update(canonical).digest('hex');
}

export function extractIdempotencyKey(headers = {}) {
  for (const [name, value] of Object.entries(headers || {})) {
    if (name.toLowerCase() === IDEMPOTENCY_HEADER) {
      const raw = Array.isArray(value) ? value[0] : value;
      return typeof raw === 'string' ? raw.trim() : '';
    }
  }
  return '';
}

export function isValidIdempotencyKey(key) {
  return typeof key === 'string' && KEY_PATTERN.test(key);
}

export function buildScopedKey({ actorKey = 'anon', method = 'POST', route = '', idempotencyKey }) {
  return createHash('sha256')
    .update(`${actorKey}|${String(method).toUpperCase()}|${route}|${idempotencyKey}`)
    .digest('hex');
}

function defaultActorKey(req) {
  const userId = req.auth?.userId || req.user?.id || req.headers?.['x-actor-id'];
  if (typeof userId === 'string' && userId.trim()) {
    return `user:${userId.trim()}`;
  }
  const ip = clientKey(req.headers || {});
  return ip ? `ip:${ip}` : 'anonymous';
}

/**
 * Captures `{ status, headers, body }` written by either Vercel-style `res.status().json()`
 * handlers or legacy `{ status, headers, body }` return objects.
 */
async function executeWithCapture(handler, req, res) {
  let capturedStatus = 200;
  const capturedHeaders = {};
  let capturedBody;
  let capturedViaRes = false;

  const proxyRes = new Proxy(res, {
    get(target, prop) {
      if (prop === 'status') {
        return (code) => {
          capturedStatus = code;
          target.status(code);
          return proxyRes;
        };
      }
      if (prop === 'setHeader') {
        return (name, value) => {
          capturedHeaders[String(name).toLowerCase()] = value;
          target.setHeader(name, value);
          return proxyRes;
        };
      }
      if (prop === 'json') {
        return (payload) => {
          capturedBody = payload;
          capturedViaRes = true;
          return target.json(payload);
        };
      }
      if (prop === 'send') {
        return (payload) => {
          capturedBody = payload;
          capturedViaRes = true;
          return target.send(payload);
        };
      }
      const value = Reflect.get(target, prop);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });

  const result = await handler(req, proxyRes);
  if (
    !capturedViaRes &&
    result &&
    typeof result.status === 'number' &&
    Object.prototype.hasOwnProperty.call(result, 'body')
  ) {
    return {
      viaRes: false,
      result,
      snapshot: {
        status: result.status,
        headers: { ...(result.headers || {}) },
        body: result.body,
      },
    };
  }

  return {
    viaRes: true,
    result,
    snapshot: {
      status: capturedStatus,
      headers: capturedHeaders,
      body: capturedBody,
    },
  };
}

function sendSnapshot(res, snapshot, { replayed = false } = {}) {
  for (const [name, value] of Object.entries(snapshot.headers || {})) {
    if (name.toLowerCase() !== 'x-idempotency-replayed') {
      res.setHeader(name, value);
    }
  }
  if (replayed) {
    res.setHeader('X-Idempotency-Replayed', 'true');
  }
  return res.status(snapshot.status).json(snapshot.body);
}

/**
 * Wraps a serverless route handler with Idempotency-Key enforcement, payload-mismatch
 * conflict detection (409), in-flight single-flight coalescing, and replay caching.
 */
export function createIdempotencyLayer({
  store = createIdempotencyStore(),
  singleFlight = createSingleFlight(),
  ttlMs = DEFAULT_IDEMPOTENCY_TTL_MS,
  methods = IDEMPOTENCY_METHODS,
  requireKeyRoutes = [],
  failClosedRoutes = [],
  actorResolver = defaultActorKey,
  onMetric = () => {},
} = {}) {
  const allowedMethods = new Set(methods.map((m) => String(m).toUpperCase()));
  const requiredSet = new Set(requireKeyRoutes);
  const failClosedSet = new Set(failClosedRoutes);

  return {
    store,

    async execute(req, res, route, handler) {
      const method = String(req?.method || 'GET').toUpperCase();
      if (!allowedMethods.has(method)) {
        return handler(req, res);
      }

      const rawKey = extractIdempotencyKey(req?.headers || {});
      if (!rawKey) {
        if (requiredSet.has(route)) {
          onMetric({ event: 'idempotency_missing_key', route, method });
          return res.status(400).json({
            error: 'Missing required Idempotency-Key header',
            code: 'IDEMPOTENCY_KEY_REQUIRED',
          });
        }
        return handler(req, res);
      }

      if (!isValidIdempotencyKey(rawKey)) {
        onMetric({ event: 'idempotency_invalid_key', route, method });
        return res.status(400).json({
          error: 'Invalid Idempotency-Key format (must be 8-128 alphanumeric, ., _, :, or - characters)',
          code: 'INVALID_IDEMPOTENCY_KEY',
        });
      }

      const actorKey = actorResolver(req);
      const scopedKey = buildScopedKey({ actorKey, method, route, idempotencyKey: rawKey });
      const payloadHash = canonicalPayloadHash({ method, route, body: req?.body });

      let existing;
      try {
        existing = await store.get(scopedKey);
      } catch (err) {
        onMetric({ event: 'idempotency_store_error', route, method, phase: 'get', error: err.message });
        if (failClosedSet.has(route)) {
          return res.status(503).json({
            error: 'Idempotency store unavailable',
            code: 'IDEMPOTENCY_STORE_UNAVAILABLE',
            retryAfterSeconds: 5,
          });
        }
        return handler(req, res);
      }

      if (existing) {
        if (existing.payloadHash !== payloadHash) {
          onMetric({ event: 'idempotency_payload_conflict', route, method });
          return res.status(409).json({
            error: 'Idempotency-Key already used with a different request payload',
            code: 'IDEMPOTENCY_KEY_CONFLICT',
          });
        }
        if (existing.status === 'completed' && existing.response) {
          onMetric({ event: 'idempotency_replay_hit', route, method });
          return sendSnapshot(res, existing.response, { replayed: true });
        }
      }

      let outcome;
      try {
        outcome = await singleFlight.run(scopedKey, async () => {
          const lock = await store.acquireLock(scopedKey, { payloadHash });
          if (!lock.acquired && lock.existing) {
            if (lock.existing.payloadHash !== payloadHash) {
              return { type: 'conflict' };
            }
            if (lock.existing.status === 'completed' && lock.existing.response) {
              return { type: 'replay', snapshot: lock.existing.response };
            }
            return { type: 'in_flight' };
          }

          try {
            const captured = await executeWithCapture(handler, req, res);
            if (captured.snapshot.status < 500) {
              await store.complete(scopedKey, {
                payloadHash,
                response: captured.snapshot,
                ttlOverrideMs: ttlMs,
              });
            } else {
              await store.release(scopedKey);
            }
            return { type: 'executed', captured };
          } catch (err) {
            await store.release(scopedKey).catch(() => {});
            throw err;
          }
        });
      } catch (err) {
        if (err?.code === 'IDEMPOTENCY_STORE_ERROR' || err?.name === 'FirebaseError') {
          onMetric({ event: 'idempotency_store_error', route, method, phase: 'lock', error: err.message });
          if (failClosedSet.has(route)) {
            return res.status(503).json({
              error: 'Idempotency store unavailable',
              code: 'IDEMPOTENCY_STORE_UNAVAILABLE',
              retryAfterSeconds: 5,
            });
          }
          return handler(req, res);
        }
        throw err;
      }

      if (outcome.type === 'conflict') {
        onMetric({ event: 'idempotency_payload_conflict', route, method });
        return res.status(409).json({
          error: 'Idempotency-Key already used with a different request payload',
          code: 'IDEMPOTENCY_KEY_CONFLICT',
        });
      }
      if (outcome.type === 'in_flight') {
        onMetric({ event: 'idempotency_in_flight_conflict', route, method });
        res.setHeader('Retry-After', '2');
        return res.status(409).json({
          error: 'Request with this Idempotency-Key is currently in flight',
          code: 'IDEMPOTENCY_IN_FLIGHT',
          retryAfterSeconds: 2,
        });
      }
      if (outcome.type === 'replay') {
        onMetric({ event: 'idempotency_replay_hit', route, method });
        return sendSnapshot(res, outcome.snapshot, { replayed: true });
      }

      // Coalesced caller: the primary caller already wrote to its own `res`,
      // so any waiting coalesced caller whose `res` hasn't ended receives the snapshot.
      if (!res.writableEnded && outcome.captured.viaRes) {
        onMetric({ event: 'idempotency_coalesced_hit', route, method });
        return sendSnapshot(res, outcome.captured.snapshot, { replayed: true });
      }
      return outcome.captured.result;
    },
  };
}

export function resolveIdempotencyConfig(env = process.env || {}) {
  const parseList = (raw) =>
    String(raw || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  const ttlMs = Number(env.IDEMPOTENCY_TTL_MS);
  return {
    ttlMs: Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : DEFAULT_IDEMPOTENCY_TTL_MS,
    requireKeyRoutes: parseList(env.IDEMPOTENCY_REQUIRED_ROUTES),
    failClosedRoutes: parseList(env.IDEMPOTENCY_FAIL_CLOSED_ROUTES),
  };
}
