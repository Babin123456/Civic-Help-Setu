/* global process */
/**
 * api/_lib/abuseControlPlane.js
 *
 * Civic Service API Rate-Limit and Abuse Detection Control Plane (#1174).
 *
 * Per-route quotas, adaptive throttling, abuse signals, privacy-minimized
 * identifiers, NAT-user protection, operator dashboards and appeal paths.
 *
 * All mutable state lives in an injected store so the same logic runs under
 * tests (in-memory fixture) and in production (Firestore-backed store).
 * Caller addresses are never stored raw: only an HMAC-SHA256 hash keyed by a
 * server secret plus a route-scoped bucket is retained.
 *
 * NAT protection: an address seen with many distinct authenticated users is
 * treated as shared and is not hard-blocked on the per-address limit alone;
 * the per-user limit still applies, and abuse signals are still recorded.
 */

import { createHash, createHmac } from 'node:crypto';

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_LIMIT = 60;
const MAX_KEYS = 5000;
const SIGNAL_RETENTION_MS = 24 * 60 * 60 * 1000;
const NAT_SHARED_THRESHOLD = 5;

export const ABUSE_SIGNAL_KINDS = Object.freeze([
  'rapid_fire',
  'error_burst',
  'route_anomaly',
  'blocked_retry',
]);

export function abuseSignalKinds() {
  return [...ABUSE_SIGNAL_KINDS];
}

export function defaultConfig() {
  return {
    secret: process.env.ABUSE_CONTROL_SECRET || 'dev-secret-change-me',
    routes: new Map(),
    defaultLimit: DEFAULT_LIMIT,
    defaultWindowMs: DEFAULT_WINDOW_MS,
    natSharedThreshold: NAT_SHARED_THRESHOLD,
    signalRetentionMs: SIGNAL_RETENTION_MS,
    adaptiveMultiplier: 0.5,
    adaptiveRecoveryWindowMs: 60 * 60 * 1000,
  };
}

function routeKeyFor(route, method) {
  return `${method || '*'}:${route}`;
}

/**
 * Privacy-minimized identifier: HMAC-SHA256 of the raw identifier keyed by
 * the server secret. The raw address is never retained.
 */
export function privacyIdentifier(rawIdentifier, secret) {
  if (typeof rawIdentifier !== 'string' || rawIdentifier.length === 0) return null;
  return createHmac('sha256', secret).update(rawIdentifier).digest('hex');
}

/** Fixed-window counter with bounded memory and an injectable clock. */
export function createWindowCounter({
  limit,
  windowMs,
  now = Date.now,
  maxKeys = MAX_KEYS,
} = {}) {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new TypeError('createWindowCounter needs a positive integer limit');
  }
  if (!Number.isFinite(windowMs) || windowMs < 1) {
    throw new TypeError('createWindowCounter needs a positive windowMs');
  }
  const windows = new Map();

  function sweep(at) {
    for (const [key, entry] of windows) {
      if (entry.resetAt <= at) windows.delete(key);
    }
    while (windows.size >= maxKeys) {
      windows.delete(windows.keys().next().value);
    }
  }

  return {
    size: () => windows.size,
    take(key) {
      const at = now();
      let entry = windows.get(key);
      if (!entry || entry.resetAt <= at) {
        if (!entry && windows.size >= maxKeys) sweep(at);
        entry = { count: 0, resetAt: at + windowMs };
        windows.set(key, entry);
      }
      if (entry.count >= limit) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - at) / 1000)),
        };
      }
      entry.count += 1;
      return { allowed: true, remaining: limit - entry.count, retryAfterSeconds: 0 };
    },
    reset(key) {
      windows.delete(key);
    },
    resetAll() {
      windows.clear();
    },
  };
}

/**
 * Abuse signal detector: rapid-fire and error-burst detection with an
 * injectable clock and bounded retention.
 */
export function createAbuseSignalDetector({
  now = Date.now,
  retentionMs = SIGNAL_RETENTION_MS,
} = {}) {
  const events = new Map(); // key -> [{ at, kind }]

  return {
    record(key, kind, at = now()) {
      if (!ABUSE_SIGNAL_KINDS.includes(kind)) {
        throw new TypeError(`unknown signal kind ${kind}`);
      }
      let list = events.get(key);
      if (!list) {
        list = [];
        events.set(key, list);
      }
      list.push({ at, kind });
      const cutoff = at - retentionMs;
      while (list.length && list[0].at < cutoff) list.shift();
    },
    events(key, since = now() - retentionMs) {
      const list = events.get(key) || [];
      return list.filter((e) => e.at >= since);
    },
    rapidFire(key, count, windowMs, at = now()) {
      return this.events(key, at - windowMs)
        .filter((e) => e.kind === 'rapid_fire').length >= count;
    },
    errorBurst(key, errorCount, totalCount, windowMs, at = now()) {
      const recent = this.events(key, at - windowMs);
      const errors = recent.filter((e) => e.kind === 'error_burst').length;
      return errors >= errorCount && recent.length >= totalCount;
    },
    reset(key) {
      events.delete(key);
    },
  };
}

/**
 * Create the control plane. `store` is injectable; see tests/helpers/abuseFixture.js
 * for a test double and api/_lib/abuseStore.js for the Firestore-backed store.
 *
 * Store shape (all methods optional unless noted):
 *   getQuota(bucket) -> { count, limit, windowMs, resetAt } | null
 *   setQuota(bucket, { count, limit, windowMs, resetAt }) -> void
 *   recordSignal(signal) -> void          // { bucket, kind, at, route, severity }
 *   getSignals(bucket, since) -> signal[]
 *   setAllowlist(identifierHash, route, reason, expiresAt) -> void
 *   setBlocklist(identifierHash, route, reason, expiresAt) -> void
 *   isAllowlisted(identifierHash, route) -> boolean
 *   isBlocklisted(identifierHash, route) -> boolean
 *   getAppeal(appealId) -> appeal | null
 *   createAppeal(appeal) -> appeal
 *   listAppeals({ status, limit, cursor }) -> { appeals, nextCursor }
 *   updateAppeal(appealId, patch) -> appeal
 */
export function createAbuseControlPlane({
  config = defaultConfig(),
  store,
  now = Date.now,
} = {}) {
  if (!store) throw new TypeError('createAbuseControlPlane needs a store');

  const {
    secret,
    routes,
    defaultLimit,
    defaultWindowMs,
    natSharedThreshold,
    adaptiveMultiplier,
    adaptiveRecoveryWindowMs,
    signalRetentionMs,
  } = config;

  const perRoute = new Map(); // routeKey -> WindowCounter (hot cache)
  const userWindows = new Map(); // userHash -> WindowCounter
  const addressUsers = new Map(); // addressHash -> Set of userHashes (NAT detection)
  const signalDetector = createAbuseSignalDetector({ now, retentionMs: signalRetentionMs });

  function routeConfig(routeKey) {
    if (routes.has(routeKey)) return routes.get(routeKey);
    let best = null;
    for (const [pattern, cfg] of routes) {
      if (routeKey.startsWith(pattern) && (!best || pattern.length > best[0].length)) {
        best = [pattern, cfg];
      }
    }
    return best ? best[1] : { limit: defaultLimit, windowMs: defaultWindowMs, adaptive: true };
  }

  function counterFor(routeKey) {
    let c = perRoute.get(routeKey);
    if (!c) {
      const cfg = routeConfig(routeKey);
      c = createWindowCounter({ limit: cfg.limit, windowMs: cfg.windowMs, now });
      perRoute.set(routeKey, c);
    }
    return c;
  }

  function adaptiveLimit(baseLimit, bucket, at) {
    const recent = signalDetector.events(bucket, at - adaptiveRecoveryWindowMs);
    if (recent.length === 0) return baseLimit;
    return Math.max(1, Math.floor(baseLimit * adaptiveMultiplier));
  }

  return {
    config,
    /**
     * Check a request against abuse controls.
     * @param {Object} params
     * @param {string} params.route - route path pattern
     * @param {string} params.method - HTTP method
     * @param {string|null} params.identifier - raw caller address (privacy-minimized internally)
     * @param {string|null} params.userId - authenticated user id (privacy-minimized internally)
     * @param {number|null} params.statusCode - response status code (to record error_burst signals)
     * @returns {{ allowed: boolean, reason: string, retryAfterSeconds: number, identifierHash: string|null, natShared: boolean, route: string }}
     */
    async check({ route, method, identifier, userId, statusCode }) {
      const at = now();
      const routeKey = routeKeyFor(route, method);
      const addressHash = identifier ? privacyIdentifier(identifier, secret) : null;
      const userHash = userId ? privacyIdentifier(userId, secret) : null;

      // Blocklist check (hard block).
      const addrBlocklisted = addressHash && store.isBlocklisted
        ? await store.isBlocklisted(addressHash, routeKey)
        : false;
      const userBlocklisted = userHash && store.isBlocklisted
        ? await store.isBlocklisted(userHash, routeKey)
        : false;
      if (addrBlocklisted || userBlocklisted) {
        return {
          allowed: false, reason: 'blocklisted', retryAfterSeconds: 0,
          identifierHash: addrBlocklisted ? addressHash : userHash, natShared: false, route: routeKey,
        };
      }

      // Allowlist check (bypass limits).
      const addrAllowlisted = addressHash && store.isAllowlisted
        ? await store.isAllowlisted(addressHash, routeKey)
        : false;
      const userAllowlisted = userHash && store.isAllowlisted
        ? await store.isAllowlisted(userHash, routeKey)
        : false;
      if (addrAllowlisted || userAllowlisted) {
        return {
          allowed: true, reason: 'allowlisted', retryAfterSeconds: 0,
          identifierHash: addressHash, natShared: false, route: routeKey,
        };
      }

      // NAT detection: track distinct authenticated users per address.
      let natShared = false;
      if (addressHash && userHash) {
        let users = addressUsers.get(addressHash);
        if (!users) {
          users = new Set();
          addressUsers.set(addressHash, users);
        }
        users.add(userHash);
        if (users.size >= natSharedThreshold) natShared = true;
      }

      // Per-user limit first: protects each authenticated user independently,
      // including users behind a shared NAT address.
      let userRemaining = null;
      if (userHash) {
        const baseCfg = routeConfig(routeKey);
        let counter = userWindows.get(userHash);
        if (!counter) {
          counter = createWindowCounter({ limit: baseCfg.limit, windowMs: baseCfg.windowMs, now });
          userWindows.set(userHash, counter);
        }
        const verdict = counter.take(`user:${userHash}`);
        userRemaining = Math.max(0, baseCfg.limit - verdict.remaining);
        if (!verdict.allowed) {
          if (store.recordSignal) {
            await store.recordSignal({
              bucket: `user:${userHash}`, kind: 'blocked_retry', at, route: routeKey, severity: 'medium',
            });
          }
          signalDetector.record(`user:${userHash}`, 'blocked_retry', at);
          return {
            allowed: false, reason: 'rate_limited', retryAfterSeconds: verdict.retryAfterSeconds,
            identifierHash: addressHash, natShared, route: routeKey,
          };
        }
      }

      // Per-address limit only for anonymous requests (no userId). When an
      // address is shared behind NAT, the per-user limit above already protects
      // each user, so we skip the address limit to avoid punishing innocent
      // NAT users for another user's traffic.
      let addressRemaining = null;
      if (addressHash && !userHash && !natShared) {
        const counter = counterFor(routeKey);
        const baseCfg = routeConfig(routeKey);
        const limit = adaptiveLimit(baseCfg.limit, `addr:${addressHash}`, at);
        const verdict = counter.take(`addr:${addressHash}`);
        addressRemaining = Math.max(0, limit - verdict.remaining);
        if (!verdict.allowed) {
          if (store.recordSignal) {
            await store.recordSignal({
              bucket: `addr:${addressHash}`, kind: 'blocked_retry', at, route: routeKey, severity: 'medium',
            });
          }
          signalDetector.record(`addr:${addressHash}`, 'blocked_retry', at);
          return {
            allowed: false, reason: 'rate_limited', retryAfterSeconds: verdict.retryAfterSeconds,
            identifierHash: addressHash, natShared: false, route: routeKey,
          };
        }
      }

      // Record abuse signals for adaptive detection and observability.
      if (addressHash) {
        signalDetector.record(`addr:${addressHash}`, 'rapid_fire', at);
        if (store.recordSignal) {
          await store.recordSignal({
            bucket: `addr:${addressHash}`, kind: 'rapid_fire', at, route: routeKey, severity: 'low',
          });
        }
      }
      if (statusCode && statusCode >= 400 && addressHash) {
        signalDetector.record(`addr:${addressHash}`, 'error_burst', at);
        if (store.recordSignal) {
          await store.recordSignal({
            bucket: `addr:${addressHash}`, kind: 'error_burst', at, route: routeKey, severity: 'medium',
          });
        }
      }

      return {
        allowed: true, reason: 'ok', retryAfterSeconds: 0,
        identifierHash: addressHash, natShared, route: routeKey,
        remaining: addressRemaining !== null && userRemaining !== null
          ? Math.min(addressRemaining, userRemaining)
          : addressRemaining !== null ? addressRemaining : userRemaining,
      };
    },

    /** Record an abuse signal (e.g. after a 4xx response). */
    async recordSignal({ bucket, kind, at = now(), route, severity = 'low' }) {
      if (!ABUSE_SIGNAL_KINDS.includes(kind)) {
        throw new TypeError(`unknown signal kind ${kind}`);
      }
      signalDetector.record(bucket, kind, at);
      if (store.recordSignal) {
        await store.recordSignal({ bucket, kind, at, route, severity });
      }
    },

    /** Allowlist an identifier for a route (operator action). */
    async allowlist({ identifierHash, route, reason, expiresAt }) {
      if (store.setAllowlist) await store.setAllowlist(identifierHash, route, reason, expiresAt);
    },

    /** Blocklist an identifier for a route (operator action, high impact). */
    async blocklist({ identifierHash, route, reason, expiresAt }) {
      if (store.setBlocklist) await store.setBlocklist(identifierHash, route, reason, expiresAt);
    },

    /** Create an appeal (user action). */
    async createAppeal(appeal) {
      if (!store.createAppeal) throw new TypeError('store.createAppeal is required');
      return await store.createAppeal({
        id: appeal.id || createHash('sha256')
          .update(`${appeal.identifierHash}:${appeal.route}:${now()}`)
          .digest('hex').slice(0, 24),
        ...appeal,
        status: 'pending',
        createdAt: now(),
        updatedAt: now(),
      });
    },

    /** Get appeal status. */
    async getAppeal(appealId) {
      if (!store.getAppeal) throw new TypeError('store.getAppeal is required');
      return await store.getAppeal(appealId);
    },

    /** Update appeal (operator action, requires human approval for high impact). */
    async updateAppeal(appealId, patch) {
      if (!store.updateAppeal) throw new TypeError('store.updateAppeal is required');
      return await store.updateAppeal(appealId, patch);
    },

    /** List signals for diagnostics/dashboard. */
    async listSignals(bucket, since) {
      return signalDetector.events(bucket, since);
    },

    /** Diagnostic counters. */
    size() {
      return perRoute.size + userWindows.size;
    },
  };
}
