import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createDistributedCacheSystem,
  createServiceCache,
  createCacheFeatureFlagEngine,
  createCacheEngine,
  applyTtlJitter,
  CACHE_ORIGIN,
} from '../src/services/distributedCache/index.js';
import {
  createEventOutbox,
  createMemoryStorageAdapter,
} from '../api/_lib/eventOutbox.js';
import { createCacheManagementHandler } from '../api/_lib/cacheMiddleware.js';
import { createApiDispatcher } from '../api/[...path].js';

function createMockRes() {
  const headers = {};
  const res = {
    statusCode: 200,
    writableEnded: false,
    headersSent: false,
    body: undefined,
    setHeader(name, value) {
      headers[String(name).toLowerCase()] = value;
      return res;
    },
    getHeader(name) {
      return headers[String(name).toLowerCase()];
    },
    removeHeader(name) {
      delete headers[String(name).toLowerCase()];
    },
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(payload) {
      res.body = payload;
      res.writableEnded = true;
      res.headersSent = true;
      return res;
    },
    send(payload) {
      res.body = payload;
      res.writableEnded = true;
      res.headersSent = true;
      return res;
    },
  };
  return { res, headers };
}

describe('Distributed Cache Coherence and Stampede-Protection Layer (#1237)', () => {
  let outbox;
  let memoryAdapter;

  beforeEach(() => {
    memoryAdapter = createMemoryStorageAdapter();
    outbox = createEventOutbox({ storage: memoryAdapter });
  });

  describe('Stampede Protection & Hot-Key Burst Coalescing (Acceptance 1)', () => {
    it('drastically reduces origin traffic under hot-key bursts (100 concurrent requests)', async () => {
      const cacheSystem = createServiceCache({ outbox });
      let originFetchCount = 0;

      // Synthetic slow origin fetcher simulating DB latency
      const slowServiceFetcher = async (serviceId) => {
        originFetchCount++;
        await new Promise((resolve) => setTimeout(resolve, 30));
        return {
          id: serviceId,
          title: 'Synthetic Driving Licence Renewal',
          department: 'Transport',
          synthetic: true,
        };
      };

      // Fire 100 concurrent requests for the exact same service key
      const concurrentRequests = Array.from({ length: 100 }, () =>
        cacheSystem.getService('driving-licence', slowServiceFetcher, {
          userId: 'user-shared-query',
        })
      );

      const results = await Promise.all(concurrentRequests);

      // Verify origin was called only once due to single-flight coalescing
      expect(originFetchCount).toBe(1);
      expect(results).toHaveLength(100);

      // Verify all results return identical valid synthetic data
      for (const res of results) {
        expect(res.value).toEqual({
          id: 'driving-licence',
          title: 'Synthetic Driving Licence Renewal',
          department: 'Transport',
          synthetic: true,
        });
      }

      // Check metrics: 1 origin fetch, 99 coalesced hits
      const metrics = await cacheSystem.getMetrics();
      expect(metrics.originFetches).toBe(1);
      expect(metrics.coalescedHits).toBe(99);
      expect(metrics.hitRate).toBe(0.99);
    });

    it('applies uniform TTL jitter within bounds to prevent synchronized expiry storms', () => {
      const baseTtl = 300000; // 5 min
      const jitterPct = 0.15; // 15%

      const samples = Array.from({ length: 200 }, () =>
        applyTtlJitter(baseTtl, jitterPct, Math.random)
      );

      const minAllowed = baseTtl * (1 - jitterPct);
      const maxAllowed = baseTtl * (1 + jitterPct);

      for (const sample of samples) {
        expect(sample).toBeGreaterThanOrEqual(minAllowed);
        expect(sample).toBeLessThanOrEqual(maxAllowed);
      }

      // Verify samples are not identical
      const uniqueSamples = new Set(samples);
      expect(uniqueSamples.size).toBeGreaterThan(150);
    });
  });

  describe('Distributed Invalidation Across Multi-Instance Outbox (Acceptance 2)', () => {
    it('propagates invalidation across separate instances via event outbox', async () => {
      // Create two simulated instances sharing the same outbox
      const instanceA = createServiceCache({
        outbox,
        instanceId: 'node-worker-a',
      });
      const instanceB = createServiceCache({
        outbox,
        instanceId: 'node-worker-b',
      });

      let dbVersion = 1;
      const fetcher = async () => ({
        version: dbVersion,
        data: 'synthetic-catalogue-data',
      });

      // Both instances warm their local cache
      const resA1 = await instanceA.getService('income-certificate', fetcher);
      const resB1 = await instanceB.getService('income-certificate', fetcher);
      expect(resA1.value.version).toBe(1);
      expect(resB1.value.version).toBe(1);

      // Update source database version
      dbVersion = 2;

      // Instance A updates record and publishes invalidation
      await instanceA.invalidateService('income-certificate');

      // Instance B's subscriber processes outbox invalidation events
      const pollResult = await instanceB.invalidationSubscriber.processNow();
      expect(pollResult.processed).toBeGreaterThanOrEqual(1);

      // Instance B now fetches the fresh version (version 2)
      const resB2 = await instanceB.getService('income-certificate', fetcher);
      expect(resB2.value.version).toBe(2);
      expect(resB2.origin).toBe(CACHE_ORIGIN.ORIGIN);

      // Instance A also fetches version 2
      const resA2 = await instanceA.getService('income-certificate', fetcher);
      expect(resA2.value.version).toBe(2);
    });

    it('ignores own invalidation events on publishing instance', async () => {
      const instanceA = createServiceCache({
        outbox,
        instanceId: 'node-worker-a',
      });
      await instanceA.invalidateService('pension-scheme');

      // Processing on instanceA should skip its own events
      const pollResult = await instanceA.invalidationSubscriber.processNow();
      expect(pollResult.processed).toBe(0);
    });
  });

  describe('Identity Isolation & Leak Prevention (Acceptance 3)', () => {
    it('never shares sensitive or user-specific responses across identities', async () => {
      const cacheSystem = createServiceCache({ outbox });

      const userAlphaFetcher = vi.fn().mockResolvedValue({
        profile: 'Alpha',
        grants: ['transport-pass-senior'],
      });
      const userBetaFetcher = vi.fn().mockResolvedValue({
        profile: 'Beta',
        grants: ['student-concession'],
      });

      // User Alpha makes a personalized catalogue query
      const resAlpha = await cacheSystem.getService('personal-grants', userAlphaFetcher, {
        userId: 'user-alpha-001',
        tenantId: 'tenant-metro-blr',
      });

      // User Beta queries the same logical service
      const resBeta = await cacheSystem.getService('personal-grants', userBetaFetcher, {
        userId: 'user-beta-002',
        tenantId: 'tenant-metro-blr',
      });

      expect(resAlpha.value.profile).toBe('Alpha');
      expect(resBeta.value.profile).toBe('Beta');
      expect(userAlphaFetcher).toHaveBeenCalledTimes(1);
      expect(userBetaFetcher).toHaveBeenCalledTimes(1);

      // User Alpha querying again gets cache hit
      const resAlphaCached = await cacheSystem.getService('personal-grants', userAlphaFetcher, {
        userId: 'user-alpha-001',
        tenantId: 'tenant-metro-blr',
      });
      expect(resAlphaCached.value.profile).toBe('Alpha');
      expect(resAlphaCached.origin).toBe(CACHE_ORIGIN.CACHE_HIT);
      expect(userAlphaFetcher).toHaveBeenCalledTimes(1); // not called again
    });

    it('shares public reference data globally without identity isolation', async () => {
      const cacheSystem = createServiceCache({ outbox });
      const publicFetcher = vi.fn().mockResolvedValue([
        { code: 'KA-01', name: 'Bengaluru Central' },
        { code: 'KA-02', name: 'Bengaluru North' },
      ]);

      // Citizen 1 fetches public reference
      const res1 = await cacheSystem.getPublicReference('jurisdictions', 'all', publicFetcher);

      // Citizen 2 fetches public reference
      const res2 = await cacheSystem.getPublicReference('jurisdictions', 'all', publicFetcher);

      expect(publicFetcher).toHaveBeenCalledTimes(1);
      expect(res1.value).toEqual(res2.value);
      expect(res2.origin).toBe(CACHE_ORIGIN.CACHE_HIT);
    });
  });

  describe('Stale-While-Revalidate & Bounded Negative Caching', () => {
    it('serves stale entry immediately while triggering async background revalidation', async () => {
      let virtualNow = 1000000;
      const now = () => virtualNow;

      const cacheSystem = createServiceCache({
        outbox,
        config: {
          DEFAULT_TTL_MS: 1000,
          STALE_WHILE_REVALIDATE_MS: 5000,
          TTL_JITTER_PCT: 0,
        },
        now,
      });

      let fetchCount = 0;
      const fetcher = async () => {
        fetchCount++;
        return { data: `v-${fetchCount}` };
      };

      // 1. Initial fresh fetch
      const r1 = await cacheSystem.getService('service-swr', fetcher);
      expect(r1.value).toEqual({ data: 'v-1' });
      expect(r1.origin).toBe(CACHE_ORIGIN.ORIGIN);

      // 2. Advance time past fresh TTL but within SWR window (1500ms later)
      virtualNow += 1500;

      // 3. Request should return stale hit immediately
      const r2 = await cacheSystem.getService('service-swr', fetcher);
      expect(r2.value).toEqual({ data: 'v-1' });
      expect(r2.origin).toBe(CACHE_ORIGIN.STALE_HIT);

      // Wait brief tick for async revalidation promise to complete
      await new Promise((r) => setTimeout(r, 20));

      // 4. Subsequent request now gets updated value
      const r3 = await cacheSystem.getService('service-swr', fetcher);
      expect(r3.value).toEqual({ data: 'v-2' });
      expect(fetchCount).toBe(2);
    });

    it('caches null/missing entity negatively with bounded TTL to prevent origin hammering', async () => {
      const cacheSystem = createServiceCache({
        outbox,
        config: {
          NEGATIVE_TTL_MS: 30000,
        },
      });

      const missingFetcher = vi.fn().mockResolvedValue(null);

      // First query for non-existent service
      const r1 = await cacheSystem.getService('non-existent-service-404', missingFetcher);
      expect(r1.value).toBeNull();
      expect(r1.freshness).toBe('negative');
      expect(missingFetcher).toHaveBeenCalledTimes(1);

      // Second query returns negative hit without calling origin fetcher
      const r2 = await cacheSystem.getService('non-existent-service-404', missingFetcher);
      expect(r2.value).toBeNull();
      expect(r2.origin).toBe(CACHE_ORIGIN.NEGATIVE_HIT);
      expect(missingFetcher).toHaveBeenCalledTimes(1);
    });
  });

  describe('Management Endpoints & Authorization (DoD)', () => {
    it('enforces RBAC on cache invalidation and flush endpoints', async () => {
      const handler = await createCacheManagementHandler({
        requireAdmin: true,
        adminRoles: ['admin', 'reviewer'],
      });

      // 1. Unauthenticated or citizen request to invalidate is rejected (403)
      const citizenReq = {
        method: 'POST',
        url: '/api/cache/invalidate',
        auth: { userId: 'citizen-1', role: 'citizen' },
        body: { serviceIds: ['driving-licence'] },
      };
      const { res: res403 } = createMockRes();
      await handler(citizenReq, res403);
      expect(res403.statusCode).toBe(403);
      expect(res403.body.error).toMatch(/Admin authorization required|Forbidden/i);

      // 2. Admin request to invalidate succeeds
      const adminReq = {
        method: 'POST',
        url: '/api/cache/invalidate',
        auth: { userId: 'admin-1', role: 'admin' },
        body: { serviceIds: ['driving-licence'] },
      };
      const { res: res200 } = createMockRes();
      await handler(adminReq, res200);
      expect(res200.statusCode).toBe(200);
      expect(res200.body.success).toBe(true);

      // 3. Status endpoint is accessible
      const statusReq = {
        method: 'GET',
        url: '/api/cache/status',
        auth: { userId: 'admin-1', role: 'admin' },
      };
      const { res: resStatus } = createMockRes();
      await handler(statusReq, resStatus);
      expect(resStatus.statusCode).toBe(200);
      expect(resStatus.body.success).toBe(true);
      expect(resStatus.body.data.status).toBe('operational');
    });
  });

  describe('Safe Rollout & Feature Flag Gating', () => {
    it('bypasses cache when distributed cache feature flag is disabled', async () => {
      const ffEngine = createCacheFeatureFlagEngine({
        initialFlags: {
          'civic.cache.distributed': {
            defaultEnabled: false,
            rolloutPercentage: 0,
            killSwitch: true, // Kill switch active
            exposure: 'server',
          },
        },
      });

      const cacheSystem = createDistributedCacheSystem({
        featureFlagEngine: ffEngine,
        featureFlagContext: { userId: 'user-any' },
      });

      let fetchCalls = 0;
      const fetcher = async () => {
        fetchCalls++;
        return { fresh: true };
      };

      // Since flag is killed, each call should hit origin fetcher
      await cacheSystem.get('svc_cat:test-key', { revalidate: fetcher });
      await cacheSystem.get('svc_cat:test-key', { revalidate: fetcher });

      expect(fetchCalls).toBe(2);
    });
  });

  describe('Degraded Dependencies & Error Recovery (DoD)', () => {
    it('handles degraded storage dependency gracefully without throwing to caller', async () => {
      // Mock failing storage simulating Firestore partition / connection drop
      const failingStorage = {
        kind: 'failing-mock',
        get: vi.fn().mockRejectedValue(new Error('Firestore unavailable: UNAVAILABLE')),
        set: vi.fn().mockRejectedValue(new Error('Firestore unavailable: UNAVAILABLE')),
        delete: vi.fn().mockResolvedValue(false),
        has: vi.fn().mockResolvedValue(false),
        clear: vi.fn().mockResolvedValue(true),
        getMultiple: vi.fn().mockRejectedValue(new Error('Firestore unavailable')),
        setMultiple: vi.fn().mockRejectedValue(new Error('Firestore unavailable')),
      };

      const engine = createCacheEngine({
        storage: failingStorage,
        onError: () => {}, // suppress stderr in test
      });

      const fetcher = vi.fn().mockResolvedValue({ catalogue: 'fallback-synthetic-data' });

      // Request should not throw; should catch storage failure and gracefully execute origin
      const result = await engine.get('svc_cat:services/water-bill', { revalidate: fetcher });

      expect(result.freshness).toBe('degraded');
      expect(result.degraded).toBe(true);
      expect(result.value).toEqual({ catalogue: 'fallback-synthetic-data' });
      expect(fetcher).toHaveBeenCalled();
    });

    it('recovers cleanly on subsequent retries after transient origin errors', async () => {
      const cacheSystem = createServiceCache({ outbox });
      let attempts = 0;

      const transientFetcher = vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts === 1) {
          throw new Error('Transient origin timeout (504)');
        }
        return { recovered: true, version: 2 };
      });

      // First attempt fails
      const r1 = await cacheSystem.getService('transient-service', transientFetcher);
      expect(r1.freshness).toBe('error');
      expect(r1.error).toBe('Transient origin timeout (504)');

      // Second attempt (retry) executes fresh work and recovers without poisoned state
      const r2 = await cacheSystem.getService('transient-service', transientFetcher);
      expect(r2.freshness).toBe('fresh');
      expect(r2.value).toEqual({ recovered: true, version: 2 });
      expect(transientFetcher).toHaveBeenCalledTimes(2);
    });
  });

  describe('Serverless API Dispatcher Routing & Prometheus Endpoint', () => {
    it('dispatches /api/cache/status and /api/cache/metrics via createApiDispatcher', async () => {
      const dispatcher = createApiDispatcher();

      // 1. Check status route
      const statusReq = {
        method: 'GET',
        url: '/api/cache/status',
        headers: { host: 'localhost' },
      };
      const { res: statusRes } = createMockRes();
      await dispatcher(statusReq, statusRes);

      expect(statusRes.statusCode).toBe(200);
      expect(statusRes.body.success).toBe(true);
      expect(statusRes.body.data.status).toBe('operational');

      // 2. Check Prometheus metrics route
      const metricsReq = {
        method: 'GET',
        url: '/api/cache/metrics',
        headers: { host: 'localhost' },
      };
      const { res: metricsRes } = createMockRes();
      await dispatcher(metricsReq, metricsRes);

      expect(metricsRes.statusCode).toBe(200);
      expect(metricsRes.body).toContain('# TYPE cache_hits_total counter');
      expect(metricsRes.body).toContain('cache_hit_rate');
    });
  });
});
