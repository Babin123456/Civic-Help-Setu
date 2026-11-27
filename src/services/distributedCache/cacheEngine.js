/**
 * src/services/distributedCache/cacheEngine.js
 *
 * Core cache engine implementing:
 * - TTL jitter to prevent thundering herd
 * - Request coalescing (single-flight) for hot keys
 * - Stale-while-revalidate for graceful degradation
 * - Bounded negative caching for missing keys
 * - Identity isolation for sensitive data
 */

import {
  DEFAULT_CONFIG,
  CACHE_ORIGIN,
  CACHE_CONSISTENCY,
  validateCacheEntry,
  validateCacheKey,
} from './types.js';
import { createCacheStorage } from './storage.js';

/**
 * Applies TTL jitter to prevent synchronized cache expiration.
 * Returns a jittered TTL within ±jitterPct of the base TTL.
 */
export function applyTtlJitter(baseTtlMs, jitterPct = DEFAULT_CONFIG.TTL_JITTER_PCT, random = Math.random) {
  if (!Number.isFinite(baseTtlMs) || baseTtlMs <= 0) return baseTtlMs;
  if (!Number.isFinite(jitterPct) || jitterPct < 0) return baseTtlMs;

  const jitterRange = baseTtlMs * jitterPct;
  const jitter = (random() * 2 - 1) * jitterRange; // ±jitterRange
  return Math.max(1, Math.round(baseTtlMs + jitter));
}

/**
 * Computes expiration timestamps for a cache entry.
 */
export function computeExpirations({ ttlMs, staleWhileRevalidateMs = DEFAULT_CONFIG.STALE_WHILE_REVALIDATE_MS, now = Date.now }) {
  const baseTtl = Math.min(Math.max(ttlMs, DEFAULT_CONFIG.MIN_TTL_MS), DEFAULT_CONFIG.MAX_TTL_MS);
  const jitteredTtl = applyTtlJitter(baseTtl);
  const createdAt = now();
  const expiresAt = createdAt + jitteredTtl;
  const staleExpiresAt = expiresAt + Math.min(staleWhileRevalidateMs, DEFAULT_CONFIG.STALE_WHILE_REVALIDATE_MS);
  return { createdAt, expiresAt, staleExpiresAt, jitteredTtl };
}

/**
 * Creates a negative cache entry (cache miss marker).
 * Negative entries don't use TTL jitter for predictable expiration.
 */
export function createNegativeEntry({ negativeTtlMs = DEFAULT_CONFIG.NEGATIVE_TTL_MS, now = Date.now }) {
  const ttl = Math.min(Math.max(negativeTtlMs, DEFAULT_CONFIG.MIN_TTL_MS), DEFAULT_CONFIG.MAX_NEGATIVE_TTL_MS);
  const createdAt = now();
  const expiresAt = createdAt + ttl;
  const staleExpiresAt = expiresAt; // No stale-while-revalidate for negative entries
  return {
    negative: true,
    value: null,
    createdAt,
    expiresAt,
    staleExpiresAt,
  };
}

/**
 * Determines cache entry freshness state.
 */
export function getEntryFreshness(entry, now = Date.now) {
  if (!entry) return 'miss';
  if (entry.negative) {
    return now < entry.expiresAt ? 'negative_fresh' : 'negative_expired';
  }
  if (now < entry.expiresAt) return 'fresh';
  if (now < entry.staleExpiresAt) return 'stale';
  return 'expired';
}

/**
 * Request coalescer using single-flight pattern.
 * Prevents stampede on hot keys by coalescing concurrent requests.
 */
export function createRequestCoalescer({
  timeoutMs = DEFAULT_CONFIG.COALESCE_TIMEOUT_MS,
  maxPending = 1000,
} = {}) {
  const inflight = new Map(); // key -> { promise, resolve, reject, timestamp, waiters }

  function cleanup(key) {
    inflight.delete(key);
  }

  return {
    /**
     * Execute or coalesce a request for a key.
     * @param {string} key - Cache key
     * @param {Function} work - Async function that returns the value
     * @returns {Promise<{value, origin, fromCoalesce}>}
     */
    async execute(key, work) {
      const existing = inflight.get(key);
      const now = Date.now();

      if (existing) {
        // Check if the existing request has timed out
        if (now - existing.timestamp > timeoutMs) {
          // Original request timed out, let this one take over
          existing.reject(new Error('Coalesce timeout'));
          // Fall through to create new request
        } else {
          // Wait for existing request
          try {
            const value = await existing.promise;
            return { value, origin: CACHE_ORIGIN.COALESCED, fromCoalesce: true };
          } catch {
            // If existing request failed, we'll execute our own
            // Fall through
          }
        }
      }

      // Create new in-flight request
      let resolve, reject;
      const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      });
      // Attach a no-op handler so rejections without active waiters do not trigger unhandledRejection
      promise.catch(() => {});

      const requestState = {
        promise,
        resolve,
        reject,
        timestamp: now,
        waiters: 0,
      };
      inflight.set(key, requestState);

      // Enforce max pending
      if (inflight.size > maxPending) {
        // Remove oldest
        const oldestKey = inflight.keys().next().value;
        if (oldestKey && oldestKey !== key) {
          const old = inflight.get(oldestKey);
          if (old) old.reject(new Error('Coalescer capacity exceeded'));
          inflight.delete(oldestKey);
        }
      }

      try {
        const value = await work();
        requestState.resolve(value);
        cleanup(key);
        return { value, origin: CACHE_ORIGIN.ORIGIN, fromCoalesce: false };
      } catch (err) {
        requestState.reject(err);
        cleanup(key);
        throw err;
      }
    },

    /**
     * Check if a key has an in-flight request.
     */
    hasInFlight(key) {
      return inflight.has(key);
    },

    /**
     * Get count of in-flight requests.
     */
    getInFlightCount() {
      return inflight.size;
    },

    /**
     * Clear all in-flight requests (for testing/shutdown).
     */
    clear() {
      for (const [, state] of inflight) {
        state.reject(new Error('Coalescer cleared'));
      }
      inflight.clear();
    },
  };
}

/**
 * Main cache engine class.
 */
export class CacheEngine {
  constructor({
    storage,
    config = DEFAULT_CONFIG,
    coalescer = null,
    now = Date.now,
    random = Math.random,
    onMetric = () => {},
    onError = (err) => console.error('[CacheEngine]', err),
  } = {}) {
    this.storage = storage;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.coalescer = coalescer || createRequestCoalescer({ timeoutMs: this.config.COALESCE_TIMEOUT_MS });
    this.now = now;
    this.random = random;
    this.onMetric = onMetric;
    this.onError = onError;

    // Metrics counters
    this.metrics = {
      hits: 0,
      misses: 0,
      staleHits: 0,
      negativeHits: 0,
      coalescedHits: 0,
      originFetches: 0,
      errors: 0,
      evictions: 0,
      sets: 0,
      deletes: 0,
      invalidations: 0,
    };
  }

  /**
   * Get a value from cache, with optional revalidation callback.
   * Implements stale-while-revalidate and request coalescing.
   */
  async get(key, options = {}) {
    const {
      revalidate = null,        // Async function to fetch fresh value
      revalidateOptions = {},   // Options passed to revalidate
      consistency = CACHE_CONSISTENCY.BOUNDED_STALE,
      identityHash = null,      // For identity isolation verification
    } = options;

    const keyCheck = validateCacheKey(key);
    if (!keyCheck.valid) {
      this.onMetric({ event: 'cache_key_invalid', key, errors: keyCheck.errors });
      return { value: null, origin: CACHE_ORIGIN.ORIGIN, freshness: 'miss', entry: null };
    }

    let entry = null;
    let storageError = null;

    try {
      entry = await this.storage.get(key);
    } catch (err) {
      storageError = err;
      this.metrics.errors++;
      this.onError(err);
      this.onMetric({ event: 'cache_storage_error', key, error: err.message });
    }

    if (storageError) {
      if (revalidate) {
        try {
          const value = await revalidate(revalidateOptions);
          return { value, origin: CACHE_ORIGIN.ORIGIN, freshness: 'degraded', entry: null, degraded: true };
        } catch (originErr) {
          return { value: null, origin: CACHE_ORIGIN.ORIGIN, freshness: 'error', entry: null, error: originErr.message };
        }
      }
      return { value: null, origin: CACHE_ORIGIN.ORIGIN, freshness: 'error', entry: null, error: storageError.message };
    }

    try {
      const freshness = getEntryFreshness(entry, this.now());

      // Record metrics
      switch (freshness) {
        case 'fresh':
          this.metrics.hits++;
          this.onMetric({ event: 'cache_hit', key, freshness });
          return {
            value: entry.value,
            origin: CACHE_ORIGIN.CACHE_HIT,
            freshness: 'fresh',
            entry: { ...entry, value: entry.value }, // Clone without reference
          };
        case 'stale':
          this.metrics.staleHits++;
          this.onMetric({ event: 'cache_stale_hit', key, freshness });

          // Stale-while-revalidate: return stale value, trigger async revalidation
          if (revalidate && consistency !== CACHE_CONSISTENCY.STRONG) {
            this._triggerRevalidation(key, revalidate, revalidateOptions);
          }
          return {
            value: entry.value,
            origin: CACHE_ORIGIN.STALE_HIT,
            freshness: 'stale',
            entry: { ...entry, value: entry.value },
          };
        case 'negative_fresh':
          this.metrics.negativeHits++;
          this.onMetric({ event: 'cache_negative_hit', key, freshness });
          return {
            value: null,
            origin: CACHE_ORIGIN.NEGATIVE_HIT,
            freshness: 'negative',
            entry: { ...entry },
          };
        case 'negative_expired':
        case 'miss':
        case 'expired':
          break;
      }

      // Cache miss or expired: fetch from origin with coalescing
      if (!revalidate) {
        this.metrics.misses++;
        this.onMetric({ event: 'cache_miss', key, freshness });
        return { value: null, origin: CACHE_ORIGIN.ORIGIN, freshness: 'miss', entry: null };
      }

      // Use coalescer for origin fetch
      const { value, origin, fromCoalesce } = await this.coalescer.execute(key, async () => {
        this.metrics.originFetches++;
        return await revalidate(revalidateOptions);
      });

      if (fromCoalesce) {
        this.metrics.coalescedHits++;
        this.onMetric({ event: 'cache_coalesced_hit', key });
      } else {
        this.metrics.misses++;
        this.onMetric({ event: 'cache_miss', key, freshness });
      }

      // Store the result
      if (value === null || value === undefined) {
        // Cache negative result
        const negativeEntry = createNegativeEntry({ negativeTtlMs: this.config.NEGATIVE_TTL_MS, now: this.now });
        await this.set(key, negativeEntry, { identityHash });
        return { value: null, origin: origin, freshness: 'negative', entry: negativeEntry };
      } else {
        const { createdAt, expiresAt, staleExpiresAt, jitteredTtl } = computeExpirations({
          ttlMs: this.config.DEFAULT_TTL_MS,
          staleWhileRevalidateMs: this.config.STALE_WHILE_REVALIDATE_MS,
          now: this.now,
        });
        const entry = {
          value,
          createdAt,
          expiresAt,
          staleExpiresAt,
          ttl: jitteredTtl,
        };
        // Only include identityHash if it's a valid string
        if (typeof identityHash === 'string') {
          entry.identityHash = identityHash;
        }
        await this.set(key, entry, { identityHash });
        return { value, origin, freshness: 'fresh', entry };
      }
    } catch (err) {
      this.metrics.errors++;
      this.onError(err);
      this.onMetric({ event: 'cache_error', key, error: err.message });
      // On error, return null but don't cache the error
      return { value: null, origin: CACHE_ORIGIN.ORIGIN, freshness: 'error', entry: null, error: err.message };
    }
  }

  /**
   * Set a value in cache.
   */
  async set(key, entry, options = {}) {
    const { identityHash } = options;

    const keyCheck = validateCacheKey(key);
    if (!keyCheck.valid) throw new Error(`Invalid cache key: ${keyCheck.errors.join('; ')}`);

    const entryToStore = { ...entry };
    if (typeof identityHash === 'string') {
      entryToStore.identityHash = identityHash;
    }

    const entryCheck = validateCacheEntry(entryToStore);
    if (!entryCheck.valid) throw new Error(`Invalid cache entry: ${entryCheck.errors.join('; ')}`);

    await this.storage.set(key, entryToStore);
    this.metrics.sets++;
    this.onMetric({ event: 'cache_set', key, freshness: getEntryFreshness(entryToStore, this.now()) });
  }

  /**
   * Delete a key from cache.
   */
  async delete(key) {
    const keyCheck = validateCacheKey(key);
    if (!keyCheck.valid) return false;

    const result = await this.storage.delete(key);
    if (result) {
      this.metrics.deletes++;
      this.onMetric({ event: 'cache_delete', key });
    }
    return result;
  }

  /**
   * Check if a key exists and is fresh.
   */
  async has(key) {
    return await this.storage.has(key);
  }

  /**
   * Invalidate a key (delete from cache).
   */
  async invalidate(key) {
    const result = await this.delete(key);
    if (result) this.metrics.invalidations++;
    return result;
  }

  /**
   * Invalidate multiple keys by pattern.
   */
  async invalidatePattern(pattern) {
    const result = await this.storage.clear(pattern);
    if (result) this.metrics.invalidations++;
    this.onMetric({ event: 'cache_invalidate_pattern', pattern });
    return result;
  }

  /**
   * Trigger async revalidation (stale-while-revalidate).
   * Fire-and-forget with error handling.
   */
  async _triggerRevalidation(key, revalidate, revalidateOptions) {
    try {
      const value = await revalidate(revalidateOptions);
      if (value !== null && value !== undefined) {
        const { createdAt, expiresAt, staleExpiresAt, jitteredTtl } = computeExpirations({
          ttlMs: this.config.DEFAULT_TTL_MS,
          staleWhileRevalidateMs: this.config.STALE_WHILE_REVALIDATE_MS,
          now: this.now,
        });
        const entry = { value, createdAt, expiresAt, staleExpiresAt, ttl: jitteredTtl };
        await this.set(key, entry);
        this.onMetric({ event: 'cache_revalidated', key });
      } else {
        // Revalidation returned null - cache negative
        const negativeEntry = createNegativeEntry({ negativeTtlMs: this.config.NEGATIVE_TTL_MS, now: this.now });
        await this.set(key, negativeEntry);
        this.onMetric({ event: 'cache_revalidated_negative', key });
      }
    } catch (err) {
      this.onError(err);
      this.onMetric({ event: 'cache_revalidation_failed', key, error: err.message });
    }
  }

  /**
   * Get multiple keys at once.
   */
  async getMultiple(keys) {
    const results = new Map();
    const entries = await this.storage.getMultiple(keys);
    for (const [key, entry] of entries) {
      const freshness = getEntryFreshness(entry, this.now());
      if (freshness === 'fresh' || freshness === 'stale' || freshness === 'negative_fresh') {
        results.set(key, {
          value: entry.value,
          origin: freshness === 'stale' ? CACHE_ORIGIN.STALE_HIT : freshness === 'negative_fresh' ? CACHE_ORIGIN.NEGATIVE_HIT : CACHE_ORIGIN.CACHE_HIT,
          freshness,
          entry: { ...entry, value: entry.value },
        });
        if (freshness === 'fresh') this.metrics.hits++;
        else if (freshness === 'stale') this.metrics.staleHits++;
        else this.metrics.negativeHits++;
      }
    }
    return results;
  }

  /**
   * Set multiple keys at once.
   */
  async setMultiple(entriesMap) {
    const results = await this.storage.setMultiple(entriesMap);
    for (const { success } of results) {
      if (success) this.metrics.sets++;
    }
    return results;
  }

  /**
   * Get current metrics snapshot.
   */
  async getMetrics() {
    const totalRequests = this.metrics.hits + this.metrics.misses + this.metrics.staleHits + this.metrics.negativeHits + this.metrics.coalescedHits;
    const hitRate = totalRequests > 0 ? (this.metrics.hits + this.metrics.staleHits + this.metrics.negativeHits + this.metrics.coalescedHits) / totalRequests : 0;
    return {
      ...this.metrics,
      totalRequests,
      hitRate: Math.round(hitRate * 10000) / 10000,
      inFlightRequests: this.coalescer.getInFlightCount(),
      storageSize: this.storage.size ? await this.storage.size() : -1,
    };
  }

  /**
   * Reset metrics counters.
   */
  resetMetrics() {
    this.metrics = {
      hits: 0,
      misses: 0,
      staleHits: 0,
      negativeHits: 0,
      coalescedHits: 0,
      originFetches: 0,
      errors: 0,
      evictions: 0,
      sets: 0,
      deletes: 0,
      invalidations: 0,
    };
  }

  /**
   * Shutdown the cache engine.
   */
  async shutdown() {
    this.coalescer.clear();
    if (this.storage.shutdown) await this.storage.shutdown();
  }
}

/**
 * Factory function to create a configured cache engine.
 */
export function createCacheEngine(options = {}) {
  const { config = {}, storage: providedStorage, ...engineOptions } = options;

  const storage = providedStorage || createCacheStorage(config, {
    db: options.db,
    maxKeys: config.MAX_KEYS,
    maxEntrySizeBytes: config.MAX_ENTRY_SIZE_BYTES,
  });

  return new CacheEngine({ storage, config, ...engineOptions });
}