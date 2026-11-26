/**
 * api/_lib/overloadAndBackpressure.test.js
 *
 * Synthetic overload, concurrency, priority-starvation, permission-boundary,
 * and failure-injection tests for Adaptive Concurrency & Backpressure (#1238).
 */

import { describe, it, expect } from 'vitest';
import { createConcurrencyController, PRIORITY_CLASSES } from './concurrencyController.js';
import { createBoundedQueue } from './boundedQueue.js';
import { createBackpressureMiddleware, BACKPRESSURE_MODES } from './backpressureMiddleware.js';
import { BREAKER_STATES } from './mesh/resilience.js';

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
  return {
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
    end() {
      this.writableEnded = true;
      return this;
    },
  };
}

describe('Adaptive Concurrency: Overload, Starvation & Failure Injection (#1238)', () => {
  describe('Per-Tenant Concurrency Isolation', () => {
    it('isolates noisy tenant without blocking other tenants on the same route', async () => {
      const controller = createConcurrencyController({
        routeConfigs: {
          '/api/services': { maxConcurrency: 20, minConcurrency: 5, maxTenantConcurrency: 2 },
        },
        priorityLanes: {
          CRITICAL: { minConcurrency: 2, maxConcurrency: 10, reservedSlots: 2 },
          HIGH: { minConcurrency: 2, maxConcurrency: 10, reservedSlots: 0 },
          NORMAL: { minConcurrency: 6, maxConcurrency: 10, reservedSlots: 0 },
          LOW: { minConcurrency: 1, maxConcurrency: 5, reservedSlots: 0 },
        },
      });

      // Tenant A acquires 2 NORMAL slots (at its per-tenant limit)
      const a1 = await controller.acquireSlot({ route: '/api/services', priority: PRIORITY_CLASSES.NORMAL, tenantId: 'tenant-noisy' });
      const a2 = await controller.acquireSlot({ route: '/api/services', priority: PRIORITY_CLASSES.NORMAL, tenantId: 'tenant-noisy' });
      expect(a1.allowed).toBe(true);
      expect(a2.allowed).toBe(true);

      // Tenant A's 3rd NORMAL request is rejected with tenant_concurrency_limit
      const a3 = await controller.acquireSlot({ route: '/api/services', priority: PRIORITY_CLASSES.NORMAL, tenantId: 'tenant-noisy' });
      expect(a3.allowed).toBe(false);
      expect(a3.reason).toBe('tenant_concurrency_limit');
      expect(a3.retryAfterMs).toBeGreaterThan(0);

      // Tenant B on the same route and priority still succeeds
      const b1 = await controller.acquireSlot({ route: '/api/services', priority: PRIORITY_CLASSES.NORMAL, tenantId: 'tenant-healthy' });
      expect(b1.allowed).toBe(true);

      // Release all slots and verify tenant map is cleaned up (no memory leak)
      controller.releaseSlot({ route: '/api/services', priority: PRIORITY_CLASSES.NORMAL, tenantId: 'tenant-noisy' });
      controller.releaseSlot({ route: '/api/services', priority: PRIORITY_CLASSES.NORMAL, tenantId: 'tenant-noisy' });
      controller.releaseSlot({ route: '/api/services', priority: PRIORITY_CLASSES.NORMAL, tenantId: 'tenant-healthy' });

      const snap = controller.getRouteSnapshot('/api/services');
      expect(snap.tenants.activeCount).toBe(0);
    });
  });

  describe('Overload & Bounded Memory Guarantees', () => {
    it('degrades gracefully under burst overload with bounded queue & zero tenant leak', async () => {
      const middleware = createBackpressureMiddleware({
        mode: BACKPRESSURE_MODES.ENFORCE,
        concurrency: {
          enabled: true,
          routeConfigs: { '/api/services': { maxConcurrency: 10, minConcurrency: 2 } },
          priorityLanes: {
            CRITICAL: { minConcurrency: 2, maxConcurrency: 5, reservedSlots: 2 },
            HIGH: { minConcurrency: 2, maxConcurrency: 4, reservedSlots: 1 },
            NORMAL: { minConcurrency: 3, maxConcurrency: 4, reservedSlots: 0 },
            LOW: { minConcurrency: 1, maxConcurrency: 2, reservedSlots: 0 },
          },
        },
        queue: {
          enabled: true,
          capacity: { CRITICAL: 5, HIGH: 10, NORMAL: 15, LOW: 20 },
          tenantSlice: { enabled: true, maxPerTenant: 5 },
          aging: { enabled: false },
        },
        tenantRateLimiter: { enabled: false },
      });

      const resolvers = [];
      const requests = [];
      let rejectedCount = 0;

      // Send 60 concurrent requests from 30 distinct synthetic tenants
      for (let i = 0; i < 60; i++) {
        const req = createMockReq({
          path: '/api/services',
          headers: { 'x-tenant-id': `synthetic-tenant-${i % 30}`, 'x-request-priority': 'NORMAL' },
        });
        const res = createMockRes();
        const p = middleware(req, res, async () => {
          await new Promise((resolve) => resolvers.push(resolve));
          res.status(200).json({ ok: true });
        }).then(() => {
          if (res.statusCode === 503) {
            rejectedCount++;
            expect(res.headers['retry-after']).toBeDefined();
          }
        });
        requests.push(p);
      }

      // Let in-flight requests reach handlers
      for (let i = 0; i < 30 && resolvers.length === 0; i++) {
        await new Promise((r) => setTimeout(r, 5));
      }

      // Release all held handlers
      while (resolvers.length > 0) {
        const r = resolvers.shift();
        r();
      }
      await Promise.all(requests);

      expect(rejectedCount).toBeGreaterThan(0);

      // Verify zero leaked in-flight slots or tenant entries
      const snap = middleware.concurrencyController.getRouteSnapshot('/api/services');
      expect(snap.global.inFlight).toBe(0);
      expect(snap.tenants.activeCount).toBe(0);

      // Verify bounded queue capacity is never exceeded even under 200 enqueues
      for (let i = 0; i < 200; i++) {
        middleware.boundedQueue.enqueue({ id: i }, { priority: PRIORITY_CLASSES.LOW, tenantId: `t-${i % 50}` });
      }
      const qSnap = middleware.boundedQueue.getSnapshot();
      expect(qSnap.totalSize).toBeLessThanOrEqual(qSnap.totalCapacity);

      middleware.shutdown();
    });
  });

  describe('Priority Lane Starvation Prevention', () => {
    it('prevents LOW/NORMAL flood from starving CRITICAL citizen workflows', async () => {
      const controller = createConcurrencyController({
        routeConfigs: { '/api/grievance': { maxConcurrency: 12, minConcurrency: 4 } },
        priorityLanes: {
          CRITICAL: { minConcurrency: 3, maxConcurrency: 6, reservedSlots: 3 },
          HIGH: { minConcurrency: 2, maxConcurrency: 4, reservedSlots: 1 },
          NORMAL: { minConcurrency: 2, maxConcurrency: 4, reservedSlots: 0 },
          LOW: { minConcurrency: 1, maxConcurrency: 2, reservedSlots: 0 },
        },
      });

      // Saturate LOW and NORMAL lanes completely
      const lowAcquired = [];
      for (let i = 0; i < 10; i++) {
        const d = await controller.acquireSlot({ route: '/api/grievance', priority: PRIORITY_CLASSES.LOW, tenantId: `low-${i}` });
        if (d.allowed) lowAcquired.push(`low-${i}`);
      }
      const normalAcquired = [];
      for (let i = 0; i < 10; i++) {
        const d = await controller.acquireSlot({ route: '/api/grievance', priority: PRIORITY_CLASSES.NORMAL, tenantId: `norm-${i}` });
        if (d.allowed) normalAcquired.push(`norm-${i}`);
      }

      // Further LOW/NORMAL requests must be shed
      const extraLow = await controller.acquireSlot({ route: '/api/grievance', priority: PRIORITY_CLASSES.LOW, tenantId: 'low-extra' });
      expect(extraLow.allowed).toBe(false);

      // CRITICAL citizen workflows still acquire reserved slots immediately
      for (let i = 0; i < 3; i++) {
        const crit = await controller.acquireSlot({ route: '/api/grievance', priority: PRIORITY_CLASSES.CRITICAL, tenantId: `crit-${i}` });
        expect(crit.allowed).toBe(true);
      }
    });

    it('promotes aged LOW priority queue items to prevent indefinite starvation', () => {
      let clock = 1_000_000;
      const queue = createBoundedQueue({
        capacity: { CRITICAL: 5, HIGH: 5, NORMAL: 5, LOW: 10 },
        aging: { enabled: true, promoteAfterMs: 1000, maxPromotions: 2 },
        now: () => clock,
      });

      queue.enqueue({ id: 'old-low' }, { priority: PRIORITY_CLASSES.LOW, tenantId: 't1' });
      clock += 1500;
      const result = queue.runAging();
      expect(result.promoted).toBe(1);

      // Item moved from LOW to NORMAL
      const snap = queue.getSnapshot();
      expect(snap.byPriority.LOW.size).toBe(0);
      expect(snap.byPriority.NORMAL.size).toBe(1);
    });
  });

  describe('Failure Injection & Degraded Dependency Recovery', () => {
    it('trips circuit breaker on injected 5xx errors and activates emergency brake', async () => {
      let clock = 10_000;
      const middleware = createBackpressureMiddleware({
        mode: BACKPRESSURE_MODES.ENFORCE,
        now: () => clock,
        concurrency: {
          enabled: true,
          routeConfigs: { '/api/external': { maxConcurrency: 20, minConcurrency: 2, maxErrorRate: 0.2 } },
          emergencyBrake: { enabled: false },
        },
        tenantRateLimiter: { enabled: false },
        queue: { enabled: false },
      });

      const policy = middleware.registerDependencyPolicy('/api/external', {
        failureThreshold: 2,
        resetTimeoutMs: 5000,
      });

      // Inject 2 downstream 500 failures through the middleware
      for (let i = 0; i < 2; i++) {
        const req = createMockReq({ path: '/api/external', headers: { 'x-tenant-id': 't1' } });
        const res = createMockRes();
        await middleware(req, res, () => {
          res.status(500).json({ error: 'downstream_failure' });
        });
      }

      // Dependency policy circuit breaker should now be OPEN
      expect(policy.getState()).toBe(BREAKER_STATES.OPEN);

      // Next request is rejected immediately with circuit_breaker_open
      const blockedReq = createMockReq({ path: '/api/external', headers: { 'x-tenant-id': 't1' } });
      const blockedRes = createMockRes();
      await middleware(blockedReq, blockedRes, () => {
        blockedRes.status(200).json({ ok: true });
      });

      expect(blockedRes.statusCode).toBe(503);
      expect(blockedRes.headers['x-backpressure-reason']).toBe('circuit_breaker_open');
      expect(blockedRes.headers['retry-after']).toBeDefined();

      middleware.shutdown();
    });
  });

  describe('Permission & Route Boundary Enforcement', () => {
    it('enforces stricter tenant rate limits on /api/admin than /api/services', async () => {
      const middleware = createBackpressureMiddleware({
        mode: BACKPRESSURE_MODES.ENFORCE,
        concurrency: {
          enabled: true,
          routeConfigs: {
            '/api/admin': { maxConcurrency: 12, minConcurrency: 4 },
            '/api/services': { maxConcurrency: 50, minConcurrency: 5 },
          },
        },
        tenantRateLimiter: {
          enabled: true,
          mode: 'enforce',
          profiles: {
            adminStrict: { capacity: 1, refillPerSec: 0, windowSeconds: 60 },
            publicRead: { capacity: 50, refillPerSec: 10, windowSeconds: 60 },
          },
          routePolicies: {
            '/api/admin': 'adminStrict',
            '/api/services': 'publicRead',
          },
        },
        queue: { enabled: false },
      });

      // 1st /api/admin request allowed
      const adminRes1 = createMockRes();
      await middleware(createMockReq({ path: '/api/admin', headers: { 'x-tenant-id': 'tenant-1' } }), adminRes1, () => adminRes1.status(200).json({ ok: true }));
      expect(adminRes1.statusCode).toBe(200);

      // 2nd /api/admin request rejected (429)
      const adminRes2 = createMockRes();
      await middleware(createMockReq({ path: '/api/admin', headers: { 'x-tenant-id': 'tenant-1' } }), adminRes2, () => adminRes2.status(200).json({ ok: true }));
      expect(adminRes2.statusCode).toBe(429);

      // Same tenant can still read /api/services
      const svcRes = createMockRes();
      await middleware(createMockReq({ path: '/api/services', headers: { 'x-tenant-id': 'tenant-1' } }), svcRes, () => svcRes.status(200).json({ ok: true }));
      expect(svcRes.statusCode).toBe(200);

      middleware.shutdown();
    });
  });
});
