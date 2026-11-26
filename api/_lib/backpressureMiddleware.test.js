import { describe, it, expect, beforeEach } from 'vitest';
import { createBackpressureMiddleware, createDefaultBackpressureMiddleware, BACKPRESSURE_MODES } from './backpressureMiddleware.js';
import { BREAKER_STATES } from './mesh/resilience.js';

function createMockReq(overrides = {}) {
  const headers = {};
  for (const [k, v] of Object.entries(overrides.headers || {})) {
    headers[k.toLowerCase()] = v;
  }
  return {
    method: 'GET',
    url: '/api/services',
    path: '/api/services',
    headers,
    query: {},
    body: undefined,
    pathParams: {},
    params: {},
    ...overrides,
  };
}

function createMockRes() {
  const headers = {};
  const res = {
    statusCode: 200,
    headers,
    writableEnded: false,
    setHeader(name, value) { headers[name.toLowerCase()] = value; },
    getHeader(name) { return headers[name.toLowerCase()]; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; this.writableEnded = true; return this; },
    send(body) { this.body = body; this.writableEnded = true; return this; },
    end() { this.writableEnded = true; return this; },
    on(event, handler) {
      if (event === 'finish' || event === 'close') {
        setTimeout(() => handler(), 0);
      }
    },
  };
  return res;
}

describe('BackpressureMiddleware', () => {
  let middleware;
  let currentTime;
  const events = [];

  beforeEach(() => {
    currentTime = new Date('2026-11-25T12:00:00Z').getTime();
    events.length = 0;

    middleware = createBackpressureMiddleware({
      now: () => currentTime,
      onEvent: (e) => events.push(e),
      mode: BACKPRESSURE_MODES.ENFORCE,
      concurrency: {
        enabled: true,
        routeConfigs: {
          '/api/test': { maxConcurrency: 10, minConcurrency: 2 },
        },
      },
      queue: { enabled: true },
      tenantRateLimiter: { enabled: true, mode: 'enforce' },
      meshResilience: { enabled: true, defaultTimeoutMs: 5000, bulkheadMaxConcurrent: 10 },
      skipPaths: ['/health', '/ready'],
    });
  });

  describe('basic operation', () => {
    it('allows requests in enforce mode', async () => {
      const req = createMockReq({ path: '/api/test' });
      const res = createMockRes();
      let nextCalled = false;

      await middleware(req, res, () => { nextCalled = true; });

      expect(nextCalled).toBe(true);
      expect(res.statusCode).toBe(200);
    });

    it('skips configured paths', async () => {
      const req = createMockReq({ path: '/health' });
      const res = createMockRes();
      let nextCalled = false;

      await middleware(req, res, () => { nextCalled = true; });

      expect(nextCalled).toBe(true);
    });

    it('does nothing in disabled mode', async () => {
      const disabledMiddleware = createBackpressureMiddleware({
        mode: BACKPRESSURE_MODES.DISABLED,
        now: () => currentTime,
      });

      const req = createMockReq({ path: '/api/test' });
      const res = createMockRes();
      let nextCalled = false;

      await disabledMiddleware(req, res, () => { nextCalled = true; });

      expect(nextCalled).toBe(true);
    });

    it('allows but warns in shadow mode', async () => {
      const shadowMiddleware = createBackpressureMiddleware({
        mode: BACKPRESSURE_MODES.SHADOW,
        now: () => currentTime,
        concurrency: {
          enabled: true,
          routeConfigs: { '/api/test': { maxConcurrency: 1 } },
        },
      });

      // Fill capacity
      const req1 = createMockReq({ path: '/api/test' });
      const res1 = createMockRes();
      await shadowMiddleware(req1, res1, () => {});

      // Second request should get warning header but still proceed
      const req2 = createMockReq({ path: '/api/test' });
      const res2 = createMockRes();
      let nextCalled = false;
      await shadowMiddleware(req2, res2, () => { nextCalled = true; });

      expect(nextCalled).toBe(true);
      expect(res2.headers['x-backpressure-warning']).toBeDefined();
    });
  });

  describe('concurrency control', () => {
    it('rejects when concurrency limit exceeded', async () => {
      // Fill concurrency slots (max 10)
      for (let i = 0; i < 10; i++) {
        const req = createMockReq({ path: '/api/test' });
        const res = createMockRes();
        await middleware(req, res, () => {});
      }

      // Next request should be rejected
      const req = createMockReq({ path: '/api/test' });
      const res = createMockRes();
      await middleware(req, res, () => {});

      expect(res.statusCode).toBe(503);
      expect(res.body.error).toBe('service_overloaded');
      expect(res.body.code).toBe('CONCURRENCY_LIMIT_EXCEEDED');
      expect(res.headers['retry-after']).toBeDefined();
      expect(res.headers['x-backpressure-reason']).toBe('concurrency_limit');
    });

    it('sets concurrency headers', async () => {
      const req = createMockReq({ path: '/api/test' });
      const res = createMockRes();

      await middleware(req, res, () => {});

      expect(res.headers['x-concurrency-limit']).toBeDefined();
      expect(res.headers['x-concurrency-inflight']).toBeDefined();
      expect(res.headers['x-concurrency-priority']).toBe('NORMAL');
    });

    it('releases concurrency slot on response', async () => {
      const req = createMockReq({ path: '/api/test' });
      const res = createMockRes();

      await middleware(req, res, () => {
        res.json({ ok: true });
      });

      // Wait for response to finish
      await new Promise(r => setTimeout(r, 10));

      const snap = middleware.concurrencyController.getRouteSnapshot('/api/test');
      expect(snap.global.inFlight).toBe(0);
    });

    it('tracks priority from header', async () => {
      const req = createMockReq({
        path: '/api/test',
        headers: { 'x-request-priority': 'CRITICAL' },
      });
      const res = createMockRes();

      await middleware(req, res, () => {});

      expect(res.headers['x-concurrency-priority']).toBe('CRITICAL');
    });
  });

  describe('tenant rate limiting', () => {
    it('rejects when tenant rate limit exceeded', async () => {
      // Make enough requests to exceed rate limit
      // The default tenant rate limiter has generous limits, so we need a custom one
      const customMiddleware = createBackpressureMiddleware({
        now: () => currentTime,
        mode: BACKPRESSURE_MODES.ENFORCE,
        tenantRateLimiter: {
          enabled: true,
          mode: 'enforce',
          profiles: { 'test': { capacity: 2, refillPerSec: 0, windowSeconds: 60 } },
          routePolicies: { '/api/test': 'test' },
        },
        concurrency: { enabled: false },
        queue: { enabled: false },
      });

      // First 2 requests allowed
      for (let i = 0; i < 2; i++) {
        const req = createMockReq({ path: '/api/test', headers: { 'x-tenant-id': 'tenant-1' } });
        const res = createMockRes();
        await customMiddleware(req, res, () => {});
        expect(res.statusCode).toBe(200);
      }

      // Third request rejected
      const req = createMockReq({ path: '/api/test', headers: { 'x-tenant-id': 'tenant-1' } });
      const res = createMockRes();
      await customMiddleware(req, res, () => {});

      expect(res.statusCode).toBe(429);
      expect(res.body.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('sets rate limit headers', async () => {
      const req = createMockReq({ path: '/api/test', headers: { 'x-tenant-id': 'tenant-1' } });
      const res = createMockRes();

      await middleware(req, res, () => {});

      expect(res.headers['ratelimit-limit']).toBeDefined();
      expect(res.headers['ratelimit-remaining']).toBeDefined();
      expect(res.headers['ratelimit-reset']).toBeDefined();
      expect(res.headers['x-ratelimit-scope']).toBeDefined();
    });
  });

  describe('circuit breaker integration', () => {
    it('rejects when circuit breaker is OPEN', async () => {
      const customMiddleware = createBackpressureMiddleware({
        now: () => currentTime,
        mode: BACKPRESSURE_MODES.ENFORCE,
        concurrency: { enabled: true, routeConfigs: { '/api/cb-test': { maxConcurrency: 100 } } },
        tenantRateLimiter: { enabled: false },
        queue: { enabled: false },
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
          // Expected to fail
        }
      }

      expect(policy.getState()).toBe(BREAKER_STATES.OPEN);

      const req = createMockReq({ path: '/api/cb-test' });
      const res = createMockRes();
      await customMiddleware(req, res, () => {});

      expect(res.statusCode).toBe(503);
      expect(res.body.code).toBe('CONCURRENCY_LIMIT_EXCEEDED');
      expect(res.body.retryAfterSeconds).toBeDefined();
    });
  });

  describe('metrics and health', () => {
    it('tracks request metrics', async () => {
      const req = createMockReq({ path: '/api/test' });
      const res = createMockRes();
      await middleware(req, res, () => { res.json({ ok: true }); });

      const metrics = middleware.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.allowedRequests).toBe(1);
      expect(metrics.rejectedRequests).toBe(0);
    });

    it('tracks rejection metrics', async () => {
      // Create middleware with higher concurrency for CRITICAL
      const customMiddleware = createBackpressureMiddleware({
        now: () => currentTime,
        mode: BACKPRESSURE_MODES.ENFORCE,
        concurrency: {
          enabled: true,
          routeConfigs: {
            '/api/test': { maxConcurrency: 10, minConcurrency: 5 },
          },
          priorityLanes: {
            CRITICAL: { minConcurrency: 5, maxConcurrency: 10, reservedSlots: 5 },
            HIGH: { minConcurrency: 3, maxConcurrency: 10, reservedSlots: 3 },
            NORMAL: { minConcurrency: 2, maxConcurrency: 10, reservedSlots: 0 },
            LOW: { minConcurrency: 1, maxConcurrency: 10, reservedSlots: 0 },
          },
        },
        tenantRateLimiter: { enabled: false },
        queue: { enabled: false },
      });

      // Fill capacity concurrently - use CRITICAL priority (max 4 slots with this config)
      const requests = [];
      for (let i = 0; i < 10; i++) {
        const req = createMockReq({ path: '/api/test', headers: { 'x-request-priority': 'CRITICAL' } });
        const res = createMockRes();
        // Don't await - fire all concurrently
        requests.push(customMiddleware(req, res, () => {}));
      }
      await Promise.all(requests);

      // Rejected request (should be rejected because all 4 CRITICAL slots are held)
      const req = createMockReq({ path: '/api/test', headers: { 'x-request-priority': 'CRITICAL' } });
      const res = createMockRes();
      await customMiddleware(req, res, () => {});

      const metrics = customMiddleware.getMetrics();
      expect(metrics.totalRequests).toBe(11);
      expect(metrics.rejectedRequests).toBeGreaterThanOrEqual(1);
      expect(metrics.concurrencyRejections).toBeGreaterThanOrEqual(1);
    });

    it('returns health status', () => {
      const health = middleware.getHealth();
      expect(health.status).toBe('healthy');
      expect(health.mode).toBe(BACKPRESSURE_MODES.ENFORCE);
      expect(health.components.concurrencyController).toBe('enabled');
      expect(health.components.boundedQueue).toBe('enabled');
      expect(health.components.tenantRateLimiter).toBe('enabled');
    });

    it('reports degraded when rejection rate high', async () => {
      // Fill and reject many
      for (let i = 0; i < 10; i++) {
        const req = createMockReq({ path: '/api/test' });
        const res = createMockRes();
        await middleware(req, res, () => {});
      }
      for (let i = 0; i < 5; i++) {
        const req = createMockReq({ path: '/api/test' });
        const res = createMockRes();
        await middleware(req, res, () => {});
      }

      const health = middleware.getHealth();
      expect(health.status).toBe('degraded');
      expect(health.rejectionRate).toBeGreaterThan(0.1);
    });
  });

  describe('dependency policy registration', () => {
    it('registers and retrieves dependency policies', () => {
      const policy = middleware.registerDependencyPolicy('/api/new-route', {
        maxConcurrent: 50,
        timeoutMs: 3000,
      });

      expect(policy).toBeDefined();
      expect(middleware.getDependencyPolicy('/api/new-route')).toBe(policy);
    });

    it('reuses existing policy for same route', () => {
      const policy1 = middleware.registerDependencyPolicy('/api/reuse', { maxConcurrent: 10 });
      const policy2 = middleware.registerDependencyPolicy('/api/reuse', { maxConcurrent: 20 });
      expect(policy1).toBe(policy2);
    });
  });

  describe('shutdown', () => {
    it('cleans up resources', () => {
      middleware.shutdown();
      // Should not throw
      expect(true).toBe(true);
    });
  });
});

describe('createDefaultBackpressureMiddleware', () => {
  it('creates middleware with default route configs', () => {
    const middleware = createDefaultBackpressureMiddleware();
    expect(typeof middleware).toBe('function');
    expect(middleware.concurrencyController).toBeDefined();
    expect(middleware.boundedQueue).toBeDefined();
    expect(middleware.tenantRateLimiter).toBeDefined();
  });

  it('includes common API route configs', async () => {
    const middleware = createDefaultBackpressureMiddleware();
    // Make a request to initialize the route controller
    const req = createMockReq({ path: '/api/services' });
    const res = createMockRes();
    await middleware(req, res, () => { res.json({ ok: true }); });

    const snap = middleware.concurrencyController.getRouteSnapshot('/api/services');
    expect(snap).toBeDefined();
    expect(snap.config.maxConcurrency).toBe(100);
    expect(snap.config.targetLatencyP99Ms).toBe(1000);
  });
});