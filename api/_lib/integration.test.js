/**
 * api/_lib/integration.test.js
 *
 * Integration tests for the full adaptive concurrency and backpressure pipeline:
 * Gateway + Concurrency Controller + Bounded Queue + Mesh Resilience
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createApiDispatcher } from '../[...path].js';
import { createDefaultGatewayMiddleware } from './gateway/gatewayMiddleware.js';
import { createDefaultBackpressureMiddleware } from './backpressureMiddleware.js';
import { ConsumerRegistry, CONSUMER_TIERS } from './gateway/consumerRegistry.js';
import { ContractRegistry } from './versioning/contractRegistry.js';
import { DeprecationManager } from './gateway/deprecationManager.js';
import { BREAKER_STATES } from './mesh/resilience.js';
import { v2Spec } from './versioning/specs/v2Spec.js';

function createMockReq(overrides = {}) {
  const headers = {};
  for (const [k, v] of Object.entries(overrides.headers || {})) {
    headers[k.toLowerCase()] = v;
  }
  const path = overrides.path || overrides.url || '/api/services';
  return {
    method: 'GET',
    url: path,
    path,
    headers,
    query: {},
    body: undefined,
    ...overrides,
  };
}

function createMockRes() {
  const headers = {};
  const res = {
    statusCode: 200,
    headers,
    body: null,
    writableEnded: false,
    setHeader(name, value) {
      headers[name.toLowerCase()] = value;
    },
    getHeader(name) {
      return headers[name.toLowerCase()];
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      this.writableEnded = true;
      return this;
    },
    send(body) {
      this.body = body;
      this.writableEnded = true;
      return this;
    },
    end() {
      this.writableEnded = true;
      return this;
    },
    on(event, handler) {
      if (event === 'finish' || event === 'close') {
        setTimeout(() => handler(), 0);
      }
    },
  };
  return res;
}

describe('Full Pipeline Integration: Gateway + Concurrency + Queue + Mesh', () => {
  let contractRegistry;
  let consumerRegistry;
  let deprecationManager;
  let gatewayMiddleware;
  let backpressureMiddleware;
  let currentTime;

  beforeEach(() => {
    currentTime = new Date('2026-11-25T12:00:00Z').getTime();

    contractRegistry = new ContractRegistry({ now: () => currentTime });
    contractRegistry.registerLoader('v2', async () => ({ spec: v2Spec }));

    consumerRegistry = new ConsumerRegistry({
      secret: 'integration-test-secret',
      now: () => currentTime,
    });

    deprecationManager = new DeprecationManager({
      now: () => currentTime,
    });

    gatewayMiddleware = createDefaultGatewayMiddleware({
      consumerRegistry,
      contractRegistry,
      deprecationManager,
    });

    backpressureMiddleware = createDefaultBackpressureMiddleware();
  });

  describe('Full Pipeline: Gateway -> Backpressure -> Handler', () => {
    it('processes request through full pipeline successfully', async () => {
      const dispatcher = createApiDispatcher({
        gatewayMiddleware,
        backpressureMiddleware,
        extraHandlers: {
          services: async (req, res) => res.status(200).json({ ok: true, data: 'services' }),
        },
      });

      await consumerRegistry.registerConsumer({
        id: 'test-client',
        name: 'Test Client',
        tier: CONSUMER_TIERS.PARTNER,
        credentials: { apiKey: 'test-key' },
        quotas: { rpm: 100, burst: 20 },
      });

      const req = createMockReq({
        path: '/api/services',
        headers: { 'x-api-key': 'test-key' },
      });
      const res = createMockRes();

      await dispatcher(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.headers['x-concurrency-limit']).toBeDefined();
      expect(res.headers['x-concurrency-inflight']).toBeDefined();
      expect(res.headers['ratelimit-limit']).toBeDefined();
    });

    it('enforces tenant rate limit before concurrency check', async () => {
      const customMiddleware = createDefaultBackpressureMiddleware({
        tenantRateLimiter: {
          enabled: true,
          mode: 'enforce',
          profiles: { 'test': { capacity: 2, refillPerSec: 0, windowSeconds: 60 } },
          routePolicies: { '/api/test': 'test' },
        },
        concurrency: { enabled: false },
        queue: { enabled: false },
      });

      const dispatcher = createApiDispatcher({
        gatewayMiddleware,
        backpressureMiddleware: customMiddleware,
        extraHandlers: {
          test: async (req, res) => res.status(200).json({ ok: true }),
        },
      });

      // First 2 requests allowed
      for (let i = 0; i < 2; i++) {
        const req = createMockReq({ path: '/api/test', headers: { 'x-tenant-id': 'tenant-1' } });
        const res = createMockRes();
        await dispatcher(req, res);
        expect(res.statusCode).toBe(200);
      }

      // Third request rejected by tenant rate limiter
      const req = createMockReq({ path: '/api/test', headers: { 'x-tenant-id': 'tenant-1' } });
      const res = createMockRes();
      await dispatcher(req, res);

      expect(res.statusCode).toBe(429);
      expect(res.body.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('enforces concurrency limit after tenant rate limit passes', async () => {
      const resolvers = [];
      const customMiddleware = createDefaultBackpressureMiddleware({
        mode: 'enforce',
        concurrency: {
          enabled: true,
          routeConfigs: {
            '/api/test': { maxConcurrency: 4, minConcurrency: 1 },
          },
          priorityLanes: {
            CRITICAL: { minConcurrency: 1, maxConcurrency: 2, reservedSlots: 0 },
            HIGH: { minConcurrency: 0, maxConcurrency: 1, reservedSlots: 0 },
            NORMAL: { minConcurrency: 2, maxConcurrency: 2, reservedSlots: 0 },
            LOW: { minConcurrency: 0, maxConcurrency: 1, reservedSlots: 0 },
          },
        },
        tenantRateLimiter: { enabled: false },
        queue: { enabled: false },
      });

      const dispatcher = createApiDispatcher({
        gatewayMiddleware,
        backpressureMiddleware: customMiddleware,
        extraHandlers: {
          test: async (req, res) => {
            await new Promise(r => resolvers.push(r));
            return res.status(200).json({ ok: true });
          },
        },
      });

      // Start 2 concurrent in-flight requests (maxConcurrency = 2)
      const res1 = createMockRes();
      const p1 = dispatcher(createMockReq({ path: '/api/test' }), res1);
      const res2 = createMockRes();
      const p2 = dispatcher(createMockReq({ path: '/api/test' }), res2);

      // Wait until both requests have entered the handler
      for (let i = 0; i < 50 && resolvers.length < 2; i++) {
        await new Promise(r => setTimeout(r, 5));
      }
      expect(resolvers.length).toBe(2);

      // Third concurrent request should be rejected by concurrency limit
      const res3 = createMockRes();
      await dispatcher(createMockReq({ path: '/api/test' }), res3);

      expect(res3.statusCode).toBe(503);
      expect(res3.body.code).toBe('CONCURRENCY_LIMIT_EXCEEDED');
      expect(res3.headers['retry-after']).toBeDefined();

      for (const resolve of resolvers) resolve();
      await Promise.all([p1, p2]);
      expect(res1.statusCode).toBe(200);
      expect(res2.statusCode).toBe(200);
    });

    it('rejects when circuit breaker is OPEN', async () => {
      const customMiddleware = createDefaultBackpressureMiddleware({
        mode: 'enforce',
        concurrency: { enabled: true, routeConfigs: { '/api/cb-test': { maxConcurrency: 100 } } },
        tenantRateLimiter: { enabled: false },
        queue: { enabled: false },
      });

      const dispatcher = createApiDispatcher({
        gatewayMiddleware,
        backpressureMiddleware: customMiddleware,
        extraHandlers: {
          'cb-test': async (req, res) => res.status(200).json({ ok: true }),
        },
      });

      const policy = customMiddleware.registerDependencyPolicy('/api/cb-test', {
        failureThreshold: 2,
        resetTimeoutMs: 60000,
      });

      // Force circuit breaker OPEN
      for (let i = 0; i < 3; i++) {
        try {
          await policy.execute(async () => { throw new Error('fail'); });
        } catch {
          // expected failure to trip circuit breaker
        }
      }

      expect(policy.getState()).toBe(BREAKER_STATES.OPEN);

      const req = createMockReq({ path: '/api/cb-test' });
      const res = createMockRes();
      await dispatcher(req, res);

      expect(res.statusCode).toBe(503);
      expect(res.body.code).toBe('CONCURRENCY_LIMIT_EXCEEDED');
    });

    it('respects priority lanes - CRITICAL gets reserved slots', async () => {
      const resolvers = [];
      const customMiddleware = createDefaultBackpressureMiddleware({
        mode: 'enforce',
        concurrency: {
          enabled: true,
          routeConfigs: {
            '/api/test': { maxConcurrency: 5, minConcurrency: 2 },
          },
          priorityLanes: {
            CRITICAL: { minConcurrency: 2, maxConcurrency: 5, reservedSlots: 2 },
            HIGH: { minConcurrency: 1, maxConcurrency: 3, reservedSlots: 1 },
            NORMAL: { minConcurrency: 1, maxConcurrency: 3, reservedSlots: 0 },
            LOW: { minConcurrency: 1, maxConcurrency: 2, reservedSlots: 0 },
          },
        },
        tenantRateLimiter: { enabled: false },
        queue: { enabled: false },
      });

      const dispatcher = createApiDispatcher({
        gatewayMiddleware,
        backpressureMiddleware: customMiddleware,
        extraHandlers: {
          test: async (req, res) => {
            if (req.headers['x-request-priority'] !== 'CRITICAL') {
              await new Promise(r => resolvers.push(r));
            }
            return res.status(200).json({ ok: true });
          },
        },
      });

      // Hold NORMAL priority lane at capacity (1 in-flight since maxConcurrency=5 distributes 1 to NORMAL)
      const normalLimit = customMiddleware.concurrencyController.acquireSlot; // ensure controller exists
      void normalLimit;
      const inFlightNormal = [];
      for (let i = 0; i < 3; i++) {
        const r = createMockRes();
        inFlightNormal.push({
          res: r,
          promise: dispatcher(createMockReq({ path: '/api/test', headers: { 'x-tenant-id': `t-${i}` } }), r),
        });
      }
      await new Promise(r => setTimeout(r, 10));

      // Extra NORMAL should be rejected (503)
      const overflowRes = createMockRes();
      await dispatcher(createMockReq({ path: '/api/test', headers: { 'x-tenant-id': 't-overflow' } }), overflowRes);
      expect(overflowRes.statusCode).toBe(503);

      // CRITICAL should still succeed due to reserved slots
      const critReq = createMockReq({
        path: '/api/test',
        headers: { 'x-request-priority': 'CRITICAL', 'x-tenant-id': 't-crit' },
      });
      const critRes = createMockRes();
      await dispatcher(critReq, critRes);
      expect(critRes.statusCode).toBe(200);

      // Release held NORMAL requests
      for (const resolve of resolvers) resolve();
      await Promise.all(inFlightNormal.map((x) => x.promise));
    });
  });

  describe('Mesh Resilience Integration', () => {
    it('adjusts concurrency based on dependency saturation', async () => {
      const customMiddleware = createDefaultBackpressureMiddleware({
        concurrency: {
          enabled: true,
          routeConfigs: {
            '/api/sat-test': { maxConcurrency: 20, minConcurrency: 5, targetLatencyP99Ms: 20 },
          },
        },
        tenantRateLimiter: { enabled: false },
        queue: { enabled: false },
        meshResilience: { enabled: true, defaultTimeoutMs: 200, bulkheadMaxConcurrent: 10 },
      });

      const dispatcher = createApiDispatcher({
        gatewayMiddleware,
        backpressureMiddleware: customMiddleware,
        extraHandlers: {
          'sat-test': async (req, res) => res.status(200).json({ ok: true }),
        },
      });

      const policy = customMiddleware.registerDependencyPolicy('/api/sat-test', {
        maxConcurrent: 10,
        failureThreshold: 3,
        resetTimeoutMs: 5000,
        windowDurationMs: 10000,
      });

      // Prime the route controller with one request
      const initRes = createMockRes();
      await dispatcher(createMockReq({ path: '/api/sat-test' }), initRes);
      expect(initRes.statusCode).toBe(200);

      // Simulate high latency on dependency (> targetLatencyP99Ms = 20ms)
      for (let i = 0; i < 5; i++) {
        try {
          await policy.execute(async () => {
            await new Promise(r => setTimeout(r, 35));
            return { status: 200 };
          });
        } catch {
          // ignore
        }
      }

      const controller = customMiddleware.concurrencyController;
      const snapBefore = controller.getRouteSnapshot('/api/sat-test');

      // Force adjustment
      controller.forceAdjustment('/api/sat-test');

      const snapAfter = controller.getRouteSnapshot('/api/sat-test');

      // Concurrency should have decreased due to dependency latency saturation
      expect(snapAfter.global.maxConcurrent).toBeLessThan(snapBefore.global.maxConcurrent);
    });
  });

  describe('Tenant Rate Limiter + Concurrency Controller Interaction', () => {
    it('tenant rate limit checked before concurrency', async () => {
      const customMiddleware = createDefaultBackpressureMiddleware({
        concurrency: { enabled: true, routeConfigs: { '/api/test': { maxConcurrency: 100 } } },
        tenantRateLimiter: {
          enabled: true,
          mode: 'enforce',
          profiles: { 'test': { capacity: 1, refillPerSec: 0, windowSeconds: 60 } },
          routePolicies: { '/api/test': 'test' },
        },
      });

      const dispatcher = createApiDispatcher({
        gatewayMiddleware,
        backpressureMiddleware: customMiddleware,
        extraHandlers: {
          test: async (req, res) => res.status(200).json({ ok: true }),
        },
      });

      // First request allowed by tenant rate limiter
      let req = createMockReq({ path: '/api/test', headers: { 'x-tenant-id': 'tenant-1' } });
      let res = createMockRes();
      await dispatcher(req, res);
      expect(res.statusCode).toBe(200);

      // Second request rejected by tenant rate limiter (before concurrency check)
      req = createMockReq({ path: '/api/test', headers: { 'x-tenant-id': 'tenant-1' } });
      res = createMockRes();
      await dispatcher(req, res);
      expect(res.statusCode).toBe(429);
      expect(res.body.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(res.headers['x-ratelimit-scope']).toBeDefined();
    });
  });

  describe('Bounded Queue Integration', () => {
    it('tracks queue saturation in backpressure middleware', async () => {
      const customMiddleware = createDefaultBackpressureMiddleware({
        queue: {
          enabled: true,
          capacity: {
            CRITICAL: 10,
            HIGH: 20,
            NORMAL: 5,
            LOW: 10,
          },
        },
        concurrency: { enabled: false },
        tenantRateLimiter: { enabled: false },
      });

      const dispatcher = createApiDispatcher({
        gatewayMiddleware,
        backpressureMiddleware: customMiddleware,
        extraHandlers: {
          test: async (req, res) => res.status(200).json({ ok: true }),
        },
      });

      // Fill NORMAL queue to >90% (capacity 5 -> 5 items)
      for (let i = 0; i < 5; i++) {
        customMiddleware.boundedQueue.enqueue({ id: `job-${i}` }, { priority: 'NORMAL', tenantId: `tenant-${i}` });
      }

      // Check queue saturation warning header on incoming request
      const req = createMockReq({ path: '/api/test', headers: { 'x-request-priority': 'NORMAL' } });
      const res = createMockRes();
      await dispatcher(req, res);

      expect(res.headers['x-queue-warning']).toBeDefined();
      expect(res.headers['x-queue-warning']).toContain('priority_NORMAL_queue_near_capacity');
    });
  });
});