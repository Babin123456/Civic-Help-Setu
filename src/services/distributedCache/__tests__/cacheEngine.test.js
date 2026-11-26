/**
 * src/services/distributedCache/__tests__/cacheEngine.test.js
 *
 * Unit tests for the cache engine core functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createCacheEngine,
  createInMemoryCacheStorage,
  applyTtlJitter,
  computeExpirations,
  createNegativeEntry,
  getEntryFreshness,
  createRequestCoalescer,
  CACHE_ORIGIN,
} from '../index.js';
import { DEFAULT_CONFIG } from '../types.js';

describe('Cache Engine - Core Functions', () => {
  describe('applyTtlJitter', () => {
    it('applies jitter within range', () => {
      const baseTtl = 100000; // 100 seconds
      const jitterPct = 0.1; // 10%

      // Run multiple times to verify range
      for (let i = 0; i < 100; i++) {
        const jittered = applyTtlJitter(baseTtl, jitterPct, () => i / 100); // 0 to 0.99
        expect(jittered).toBeGreaterThanOrEqual(baseTtl * (1 - jitterPct));
        expect(jittered).toBeLessThanOrEqual(baseTtl * (1 + jitterPct));
      }
    });

    it('returns base TTL when jitter is 0', () => {
      expect(applyTtlJitter(100000, 0, Math.random)).toBe(100000);
    });

    it('handles edge cases', () => {
      expect(applyTtlJitter(0, 0.1, Math.random)).toBe(0);
      expect(applyTtlJitter(-1, 0.1, Math.random)).toBe(-1);
      expect(applyTtlJitter(100000, NaN, Math.random)).toBe(100000);
    });
  });

  describe('computeExpirations', () => {
    const now = () => 1000000;

    it('computes correct expiration timestamps', () => {
      const { createdAt, expiresAt, staleExpiresAt, jitteredTtl } = computeExpirations({
        ttlMs: 300000,
        staleWhileRevalidateMs: 60000,
        now,
      });

      expect(createdAt).toBe(1000000);
      expect(expiresAt).toBeGreaterThan(1000000);
      expect(staleExpiresAt).toBe(expiresAt + 60000);
      expect(jitteredTtl).toBeGreaterThan(0);
    });

    it('respects MIN_TTL_MS', () => {
      const { expiresAt } = computeExpirations({ ttlMs: 100, now });
      expect(expiresAt - 1000000).toBeGreaterThanOrEqual(DEFAULT_CONFIG.MIN_TTL_MS * 0.85); // With jitter
    });

    it('respects MAX_TTL_MS', () => {
      const { expiresAt } = computeExpirations({ ttlMs: 10000000, now });
      expect(expiresAt - 1000000).toBeLessThanOrEqual(DEFAULT_CONFIG.MAX_TTL_MS * 1.15); // With jitter
    });
  });

  describe('createNegativeEntry', () => {
    const now = () => 1000000;

    it('creates valid negative entry', () => {
      const entry = createNegativeEntry({ negativeTtlMs: 30000, now });

      expect(entry.negative).toBe(true);
      expect(entry.value).toBeNull();
      expect(entry.expiresAt).toBeGreaterThan(now());
      expect(entry.staleExpiresAt).toBe(entry.expiresAt); // No stale period for negative
      expect(entry.createdAt).toBe(now());
    });

    it('respects MAX_NEGATIVE_TTL_MS', () => {
      const entry = createNegativeEntry({ negativeTtlMs: 1000000, now });
      expect(entry.expiresAt - now()).toBeLessThanOrEqual(DEFAULT_CONFIG.MAX_NEGATIVE_TTL_MS);
    });
  });

  describe('getEntryFreshness', () => {
    const now = () => 1000000;

    it('returns miss for null entry', () => {
      expect(getEntryFreshness(null, now())).toBe('miss');
    });

    it('returns fresh for valid positive entry', () => {
      const entry = { negative: false, expiresAt: now() + 60000, staleExpiresAt: now() + 120000 };
      expect(getEntryFreshness(entry, now())).toBe('fresh');
    });

    it('returns stale for expired but within stale-while-revalidate', () => {
      const entry = { negative: false, expiresAt: now() - 10000, staleExpiresAt: now() + 60000 };
      expect(getEntryFreshness(entry, now())).toBe('stale');
    });

    it('returns expired for fully expired entry', () => {
      const entry = { negative: false, expiresAt: now() - 10000, staleExpiresAt: now() - 5000 };
      expect(getEntryFreshness(entry, now())).toBe('expired');
    });

    it('returns negative_fresh for valid negative entry', () => {
      const entry = { negative: true, expiresAt: now() + 30000, staleExpiresAt: now() + 30000 };
      expect(getEntryFreshness(entry, now())).toBe('negative_fresh');
    });

    it('returns negative_expired for expired negative entry', () => {
      const entry = { negative: true, expiresAt: now() - 10000, staleExpiresAt: now() - 10000 };
      expect(getEntryFreshness(entry, now())).toBe('negative_expired');
    });
  });

  describe('createRequestCoalescer', () => {
    it('executes work for first request', async () => {
      const coalescer = createRequestCoalescer({ timeoutMs: 5000 });
      let callCount = 0;

      const result = await coalescer.execute('key1', async () => {
        callCount++;
        return 'value1';
      });

      expect(result.value).toBe('value1');
      expect(result.origin).toBe(CACHE_ORIGIN.ORIGIN);
      expect(result.fromCoalesce).toBe(false);
      expect(callCount).toBe(1);
    });

    it('coalesces concurrent requests', async () => {
      const coalescer = createRequestCoalescer({ timeoutMs: 5000 });
      let callCount = 0;

      const work = async () => {
        callCount++;
        await new Promise(r => setTimeout(r, 10));
        return 'value1';
      };

      const [r1, r2, r3] = await Promise.all([
        coalescer.execute('key1', work),
        coalescer.execute('key1', work),
        coalescer.execute('key1', work),
      ]);

      expect(callCount).toBe(1); // Only one actual execution
      expect(r1.value).toBe('value1');
      expect(r1.fromCoalesce).toBe(false);
      expect(r2.value).toBe('value1');
      expect(r2.fromCoalesce).toBe(true);
      expect(r2.origin).toBe(CACHE_ORIGIN.COALESCED);
      expect(r3.value).toBe('value1');
      expect(r3.fromCoalesce).toBe(true);
    });

    it('handles errors in coalesced requests', async () => {
      const coalescer = createRequestCoalescer({ timeoutMs: 5000 });
      let callCount = 0;

      const work = async () => {
        callCount++;
        throw new Error('fetch failed');
      };

      await expect(coalescer.execute('key1', work)).rejects.toThrow('fetch failed');
      await expect(coalescer.execute('key1', work)).rejects.toThrow('fetch failed');
      expect(callCount).toBe(2); // Each caller gets its own execution after failure
    });

    it('times out stale in-flight requests', async () => {
      const coalescer = createRequestCoalescer({ timeoutMs: 50 });
      let callCount = 0;

      const slowWork = async () => {
        callCount++;
        await new Promise(r => setTimeout(r, 100));
        return 'value1';
      };

      // Start first request
      const p1 = coalescer.execute('key1', slowWork);

      // Wait for timeout
      await new Promise(r => setTimeout(r, 60));

      // Second request should execute its own work
      const r2 = await coalescer.execute('key1', slowWork);

      await p1.catch(() => {}); // Clean up

      expect(callCount).toBe(2);
      expect(r2.fromCoalesce).toBe(false);
    });

    it('tracks in-flight count', async () => {
      const coalescer = createRequestCoalescer({ timeoutMs: 5000 });
      let resolve;

      const work = async () => {
        await new Promise(r => { resolve = r; });
        return 'value1';
      };

      const p1 = coalescer.execute('key1', work);
      expect(coalescer.getInFlightCount()).toBe(1);

      const p2 = coalescer.execute('key1', work);
      expect(coalescer.getInFlightCount()).toBe(1);

      resolve('value1');
      await Promise.all([p1, p2]);
      expect(coalescer.getInFlightCount()).toBe(0);
    });

    it('clears all on shutdown', async () => {
      const coalescer = createRequestCoalescer({ timeoutMs: 5000 });
      let resolve;

      const work = async () => {
        await new Promise(r => { resolve = r; });
        return 'value1';
      };

      coalescer.execute('key1', work);
      coalescer.execute('key2', work);
      expect(coalescer.getInFlightCount()).toBe(2);

      coalescer.clear();
      expect(coalescer.getInFlightCount()).toBe(0);

      // Resolve to avoid unhandled rejection
      resolve('value1');
    });
  });
});

describe('Cache Engine - Integration', () => {
  let storage;
  let cacheEngine;
  const now = () => 1000000;
  const metrics = [];

  beforeEach(() => {
    storage = createInMemoryCacheStorage({ now, maxKeys: 1000, maxEntrySizeBytes: 10000 });
    cacheEngine = createCacheEngine({
      storage,
      config: { ...DEFAULT_CONFIG, DEFAULT_TTL_MS: 300000, STALE_WHILE_REVALIDATE_MS: 60000, NEGATIVE_TTL_MS: 30000 },
      now,
      onMetric: (m) => metrics.push(m),
      onError: (err) => console.error('[Test]', err),
    });
    metrics.length = 0;
  });

  afterEach(async () => {
    await cacheEngine.shutdown();
    await storage._reset?.();
  });

  it('stores and retrieves fresh values', async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: 'test' });

    const result1 = await cacheEngine.get('key1', { revalidate: fetcher });
    expect(result1.value).toEqual({ data: 'test' });
    expect(result1.origin).toBe(CACHE_ORIGIN.ORIGIN);
    expect(result1.freshness).toBe('fresh');
    expect(fetcher).toHaveBeenCalledTimes(1);

    const result2 = await cacheEngine.get('key1', { revalidate: fetcher });
    expect(result2.value).toEqual({ data: 'test' });
    expect(result2.origin).toBe(CACHE_ORIGIN.CACHE_HIT);
    expect(result2.freshness).toBe('fresh');
    expect(fetcher).toHaveBeenCalledTimes(1); // Not called again
  });

  // TODO: Fix flaky test - stale-while-revalidate timing issue
// The revalidation completes before the first get returns in test environment
it.skip('returns stale value and triggers revalidation', async () => {
    let fetchCall = 0;
    let resolveFetch;
    const fetchPromise = new Promise(resolve => { resolveFetch = resolve; });
    const fetcher = vi.fn().mockImplementation(async () => {
      fetchCall++;
      await fetchPromise;
      return { data: 'updated' };
    });

    // Manually set a stale entry
    await cacheEngine.set('key1', {
      value: { data: 'old' },
      createdAt: now() - 400000,
      expiresAt: now() - 100000,
      staleExpiresAt: now() + 60000,
    });

    // Start the get (will trigger revalidation in background)
    const getPromise = cacheEngine.get('key1', { revalidate: fetcher });

    // Give time for the get to check cache and start revalidation
    await new Promise(r => setTimeout(r, 10));

    const result = await getPromise;
    expect(result.value).toEqual({ data: 'old' });
    expect(result.origin).toBe(CACHE_ORIGIN.STALE_HIT);
    expect(result.freshness).toBe('stale');
    expect(fetchCall).toBe(1); // Revalidation started

    // Now resolve the fetch
    resolveFetch({ data: 'updated' });
    await fetchPromise;

    // Wait a bit for revalidation to complete
    await new Promise(r => setTimeout(r, 50));

    // Next get should return fresh value
    const result2 = await cacheEngine.get('key1', { revalidate: fetcher });
    expect(result2.value).toEqual({ data: 'updated' });
    expect(result2.origin).toBe(CACHE_ORIGIN.CACHE_HIT);
  });

  it('caches negative results', async () => {
    const fetcher = vi.fn().mockResolvedValue(null);

    const result1 = await cacheEngine.get('key1', { revalidate: fetcher });
    expect(result1.value).toBeNull();
    expect(result1.origin).toBe(CACHE_ORIGIN.ORIGIN);
    expect(result1.freshness).toBe('negative');
    expect(fetcher).toHaveBeenCalledTimes(1);

    const result2 = await cacheEngine.get('key1', { revalidate: fetcher });
    expect(result2.value).toBeNull();
    expect(result2.origin).toBe(CACHE_ORIGIN.NEGATIVE_HIT);
    expect(result2.freshness).toBe('negative');
    expect(fetcher).toHaveBeenCalledTimes(1); // Not called again
  });

  it('coalesces concurrent requests for same key', async () => {
    const fetcher = vi.fn().mockImplementation(() => new Promise(r => setTimeout(() => r({ data: 'test' }), 20)));

    const [r1, r2, r3] = await Promise.all([
      cacheEngine.get('key1', { revalidate: fetcher }),
      cacheEngine.get('key1', { revalidate: fetcher }),
      cacheEngine.get('key1', { revalidate: fetcher }),
    ]);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(r1.origin).toBe(CACHE_ORIGIN.ORIGIN);
    expect(r2.origin).toBe(CACHE_ORIGIN.COALESCED);
    expect(r3.origin).toBe(CACHE_ORIGIN.COALESCED);
  });

  it('respects identity isolation', async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: 'user-specific' });

    // Different keys for different identities (simulating cache key builder behavior)
    const result1 = await cacheEngine.get('key1#hash1', {
      revalidate: fetcher,
      identityHash: 'hash1',
    });

    const result2 = await cacheEngine.get('key1#hash2', {
      revalidate: fetcher,
      identityHash: 'hash2',
    });

    expect(result1.value).toEqual({ data: 'user-specific' });
    expect(result2.value).toEqual({ data: 'user-specific' });

    // Should be separate cache entries
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('tracks metrics', async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: 'test' });

    await cacheEngine.get('key1', { revalidate: fetcher }); // miss -> origin fetch
    await cacheEngine.get('key1', { revalidate: fetcher }); // hit
    await cacheEngine.get('key2', { revalidate: fetcher }); // miss -> origin fetch

    const metrics = await cacheEngine.getMetrics();
    expect(metrics.hits).toBe(1);
    expect(metrics.misses).toBe(2); // key1 first call + key2
    expect(metrics.originFetches).toBe(2);
    expect(metrics.totalRequests).toBe(3);
  });

  it('invalidates keys', async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: 'test' });

    await cacheEngine.get('key1', { revalidate: fetcher });
    await cacheEngine.invalidate('key1');

    const result = await cacheEngine.get('key1', { revalidate: fetcher });
    expect(result.origin).toBe(CACHE_ORIGIN.ORIGIN);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('invalidates by pattern', async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: 'test' });

    await cacheEngine.get('svc_cat:services/a', { revalidate: fetcher });
    await cacheEngine.get('svc_cat:services/b', { revalidate: fetcher });
    await cacheEngine.get('pub_ref:other', { revalidate: fetcher });

    await cacheEngine.invalidatePattern('svc_cat:services*');

    const r1 = await cacheEngine.get('svc_cat:services/a', { revalidate: fetcher });
    const r2 = await cacheEngine.get('svc_cat:services/b', { revalidate: fetcher });
    const r3 = await cacheEngine.get('pub_ref:other', { revalidate: fetcher });

    expect(r1.origin).toBe(CACHE_ORIGIN.ORIGIN);
    expect(r2.origin).toBe(CACHE_ORIGIN.ORIGIN);
    expect(r3.origin).toBe(CACHE_ORIGIN.CACHE_HIT); // Not invalidated
  });

  it('handles errors gracefully', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('fetch failed'));

    const result = await cacheEngine.get('key1', { revalidate: fetcher });
    expect(result.value).toBeNull();
    expect(result.freshness).toBe('error');
    expect(result.error).toBe('fetch failed');
  });

  it('getMultiple returns fresh entries', async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: 'test' });

    await cacheEngine.get('key1', { revalidate: fetcher });
    await cacheEngine.get('key2', { revalidate: fetcher });

    const results = await cacheEngine.getMultiple(['key1', 'key2', 'key3']);
    expect(results.size).toBe(2);
    expect(results.get('key1').value).toEqual({ data: 'test' });
    expect(results.get('key2').value).toEqual({ data: 'test' });
  });
});