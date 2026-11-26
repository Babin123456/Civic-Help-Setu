/* global process */
/**
 * api/_lib/tenantRateLimiter.js
 *
 * Multi-Tenant & Jurisdiction-Scoped Rate Limiting and Quota Enforcement Engine (#1336).
 *
 * Reuses privacy-minimized HMAC identifiers from abuseControlPlane.js and trusted
 * edge-IP extraction from abuseGuard.js. Provides:
 *  - Per-route sensitivity policy profiles (`public-read`, `public-write`,
 *    `authenticated-write`, `admin-mutation`) with tenant & jurisdiction overrides.
 *  - Token-bucket burst + sustained refill rate limiting per scope
 *    (`actor`, `jurisdiction`, `tenant`) so noisy neighbors cannot starve other tenants.
 *  - Standard `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`,
 *    `Retry-After`, and `X-RateLimit-Scope` headers.
 *  - `shadow` vs `enforce` rollout modes and explicit `fail-open` / `fail-closed`
 *    degraded-store handling.
 */

import { privacyIdentifier } from './abuseControlPlane.js';
import { clientKey } from './abuseGuard.js';

export const DEFAULT_ROUTE_PROFILES = Object.freeze({
  'public-read': { capacity: 120, refillPerSec: 2, windowSeconds: 60, failMode: 'open' },
  'public-write': { capacity: 20, refillPerSec: 0.35, windowSeconds: 60, failMode: 'open' },
  'authenticated-write': { capacity: 45, refillPerSec: 0.75, windowSeconds: 60, failMode: 'open' },
  'admin-mutation': { capacity: 30, refillPerSec: 0.5, windowSeconds: 60, failMode: 'closed' },
});

const DEFAULT_MAX_BUCKETS = 10_000;
const SCOPE_PATTERN = /^[a-zA-Z0-9._:-]{1,64}$/;

function sanitizeScopeId(raw, fallback) {
  if (typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  return SCOPE_PATTERN.test(trimmed) ? trimmed : fallback;
}

/**
 * Extracts tenant, jurisdiction, and privacy-minimized actor context from a request.
 */
export function resolveRateLimitContext(req = {}, { secret = process.env.ABUSE_CONTROL_SECRET || 'dev-secret-change-me' } = {}) {
  const headers = req.headers || {};
  const tenantId = sanitizeScopeId(
    req.tenantId || headers['x-tenant-id'] || req.auth?.tenantId,
    'default-tenant',
  );
  const jurisdictionCode = sanitizeScopeId(
    req.jurisdictionCode || headers['x-jurisdiction-code'] || req.query?.jurisdiction,
    'global',
  );
  const rawActor = req.auth?.userId || req.user?.id || clientKey(headers) || 'anonymous';
  const actorHash = privacyIdentifier(String(rawActor), secret) || 'anonymous';

  return { tenantId, jurisdictionCode, actorHash };
}

/**
 * Bounded in-memory token-bucket store (injectable for tests or replaceable with
 * an async distributed store implementing `get(key)` and `set(key, state)`).
 */
export function createInMemoryBucketStore({ maxBuckets = DEFAULT_MAX_BUCKETS } = {}) {
  const buckets = new Map();
  return {
    kind: 'memory',
    size: () => buckets.size,
    async get(key) {
      return buckets.get(key) || null;
    },
    async set(key, value) {
      if (!buckets.has(key) && buckets.size >= maxBuckets) {
        buckets.delete(buckets.keys().next().value);
      }
      buckets.set(key, value);
    },
  };
}

function consumeTokenBucket(existing, { capacity, refillPerSec, at, cost = 1 }) {
  const prev = existing || { tokens: capacity, updatedAt: at };
  const elapsedSec = Math.max(0, (at - prev.updatedAt) / 1000);
  const replenished = Math.min(capacity, prev.tokens + elapsedSec * refillPerSec);

  if (replenished < cost) {
    const deficit = cost - replenished;
    const retryAfterSeconds = Math.max(1, Math.ceil(deficit / Math.max(refillPerSec, 0.001)));
    return {
      allowed: false,
      remaining: Math.floor(replenished),
      retryAfterSeconds,
      nextState: { tokens: replenished, updatedAt: at },
    };
  }

  const nextTokens = replenished - cost;
  return {
    allowed: true,
    remaining: Math.floor(nextTokens),
    retryAfterSeconds: 0,
    nextState: { tokens: nextTokens, updatedAt: at },
  };
}

/**
 * Creates a multi-tenant & jurisdiction-scoped rate-limiting engine.
 */
export function createTenantRateLimiter({
  store = createInMemoryBucketStore(),
  profiles = DEFAULT_ROUTE_PROFILES,
  routePolicies = {},
  tenantOverrides = {},
  jurisdictionOverrides = {},
  mode = 'enforce', // 'enforce' | 'shadow'
  secret = process.env.ABUSE_CONTROL_SECRET || 'dev-secret-change-me',
  now = Date.now,
  onEvent = () => {},
} = {}) {
  const effectiveMode = mode === 'shadow' ? 'shadow' : 'enforce';

  function resolvePolicy(route, tenantId, jurisdictionCode) {
    const routeSpec = routePolicies[route] || {};
    const profileName = typeof routeSpec === 'string' ? routeSpec : routeSpec.profile || 'public-write';
    const base = profiles[profileName] || profiles['public-write'] || DEFAULT_ROUTE_PROFILES['public-write'];
    const tenantPatch = tenantOverrides[tenantId] || {};
    const jurisdictionPatch = jurisdictionOverrides[jurisdictionCode] || {};

    return {
      profileName,
      capacity: jurisdictionPatch.capacity ?? tenantPatch.capacity ?? routeSpec.capacity ?? base.capacity,
      refillPerSec: jurisdictionPatch.refillPerSec ?? tenantPatch.refillPerSec ?? routeSpec.refillPerSec ?? base.refillPerSec,
      windowSeconds: jurisdictionPatch.windowSeconds ?? tenantPatch.windowSeconds ?? routeSpec.windowSeconds ?? base.windowSeconds,
      failMode: routeSpec.failMode ?? base.failMode ?? 'open',
      tenantMultiplier: tenantPatch.tenantMultiplier ?? 5,
      jurisdictionMultiplier: jurisdictionPatch.jurisdictionMultiplier ?? 3,
    };
  }

  async function checkScope(scopeName, key, spec, at, cost) {
    const current = await store.get(key);
    const result = consumeTokenBucket(current, {
      capacity: spec.capacity,
      refillPerSec: spec.refillPerSec,
      at,
      cost,
    });
    await store.set(key, result.nextState);
    return { scope: scopeName, ...result, limit: spec.capacity };
  }

  async function evaluate(req, route = 'default', { cost = 1 } = {}) {
    const at = now();
    const { tenantId, jurisdictionCode, actorHash } = resolveRateLimitContext(req, { secret });
    const policy = resolvePolicy(route, tenantId, jurisdictionCode);

    const scopes = [
      {
        name: 'actor',
        key: `rl:actor:${tenantId}:${jurisdictionCode}:${route}:${actorHash}`,
        capacity: policy.capacity,
        refillPerSec: policy.refillPerSec,
      },
      {
        name: 'jurisdiction',
        key: `rl:jur:${tenantId}:${jurisdictionCode}:${route}`,
        capacity: Math.max(1, Math.floor(policy.capacity * policy.jurisdictionMultiplier)),
        refillPerSec: policy.refillPerSec * policy.jurisdictionMultiplier,
      },
      {
        name: 'tenant',
        key: `rl:tenant:${tenantId}:${route}`,
        capacity: Math.max(1, Math.floor(policy.capacity * policy.tenantMultiplier)),
        refillPerSec: policy.refillPerSec * policy.tenantMultiplier,
      },
    ];

    try {
      const results = [];
      for (const s of scopes) {
        const res = await checkScope(s.name, s.key, s, at, cost);
        results.push(res);
        if (!res.allowed) {
          onEvent({
            event: 'rate_limit_exceeded',
            mode: effectiveMode,
            route,
            tenantId,
            jurisdictionCode,
            scope: s.name,
            retryAfterSeconds: res.retryAfterSeconds,
          });
          return {
            allowed: effectiveMode === 'shadow',
            shadowBlocked: effectiveMode === 'shadow',
            scope: s.name,
            limit: res.limit,
            remaining: res.remaining,
            retryAfterSeconds: res.retryAfterSeconds,
            resetSeconds: policy.windowSeconds,
            tenantId,
            jurisdictionCode,
          };
        }
      }

      const actorRes = results[0];
      return {
        allowed: true,
        shadowBlocked: false,
        scope: 'actor',
        limit: actorRes.limit,
        remaining: actorRes.remaining,
        retryAfterSeconds: 0,
        resetSeconds: policy.windowSeconds,
        tenantId,
        jurisdictionCode,
      };
    } catch (err) {
      onEvent({
        event: 'rate_limit_store_error',
        route,
        tenantId,
        jurisdictionCode,
        failMode: policy.failMode,
        error: err.message,
      });
      if (policy.failMode === 'closed') {
        return {
          allowed: false,
          degraded: true,
          scope: 'store',
          limit: policy.capacity,
          remaining: 0,
          retryAfterSeconds: 5,
          resetSeconds: policy.windowSeconds,
          tenantId,
          jurisdictionCode,
        };
      }
      return {
        allowed: true,
        degraded: true,
        scope: 'store',
        limit: policy.capacity,
        remaining: policy.capacity,
        retryAfterSeconds: 0,
        resetSeconds: policy.windowSeconds,
        tenantId,
        jurisdictionCode,
      };
    }
  }

  function middleware(routeResolver = (req) => req.url || 'default') {
    return function withTenantRateLimit(handler) {
      return async function rateLimitedHandler(req, res) {
        const route = typeof routeResolver === 'function' ? routeResolver(req) : String(routeResolver);
        const decision = await evaluate(req, route);

        res.setHeader('RateLimit-Limit', String(decision.limit));
        res.setHeader('RateLimit-Remaining', String(decision.remaining));
        res.setHeader('RateLimit-Reset', String(decision.resetSeconds));
        res.setHeader('X-RateLimit-Scope', decision.scope);

        if (!decision.allowed) {
          res.setHeader('Retry-After', String(decision.retryAfterSeconds));
          const status = decision.degraded ? 503 : 429;
          return res.status(status).json({
            error: decision.degraded
              ? 'Rate limit backing store unavailable'
              : 'Rate limit exceeded for tenant/jurisdiction quota',
            code: decision.degraded ? 'RATE_LIMIT_STORE_UNAVAILABLE' : 'RATE_LIMIT_EXCEEDED',
            scope: decision.scope,
            retryAfterSeconds: decision.retryAfterSeconds,
          });
        }

        return handler(req, res);
      };
    };
  }

  return { evaluate, middleware, resolvePolicy };
}
