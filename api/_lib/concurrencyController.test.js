import { describe, it, expect, beforeEach } from 'vitest';
import {
  createConcurrencyController,
  PRIORITY_CLASSES,
  createLatencyTracker,
  createSaturationMetrics,
} from './concurrencyController.js';

function createMockReq(overrides = {}) {
  return {
    method: 'GET',
    url: '/api/services',
    path: '/api/services',
    headers: {},
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
    end() { this.writableEnded = true; return this; },
  };
  return res;
}

describe('LatencyTracker', () => {
  it('records latencies and computes percentiles', () => {
    const tracker = createLatencyTracker({ maxSamples: 100 });
    for (let i = 1; i <= 100; i++) {
      tracker.record(i * 10);
    }
    const p = tracker.getPercentiles();
    expect(p.p50).toBe(500);
    expect(p.p95).toBe(950);
    expect(p.p99).toBe(990);
  });

  it('handles empty tracker', () => {
    const tracker = createLatencyTracker();
    const p = tracker.getPercentiles();
    expect(p.p50).toBe(0);
    expect(p.p95).toBe(0);
    expect(p.p99).toBe(0);
  });

  it('respects maxSamples limit', () => {
    const tracker = createLatencyTracker({ maxSamples: 10 });
    for (let i = 1; i <= 20; i++) {
      tracker.record(i * 10);
    }
    expect(tracker.size()).toBe(10);
  });
});

describe('SaturationMetrics', () => {
  it('tracks in-flight requests and utilization', () => {
    const metrics = createSaturationMetrics();
    metrics.maxConcurrent = 10;

    metrics.recordStart();
    metrics.recordStart();
    expect(metrics.inFlight).toBe(2);
    expect(metrics.getUtilization()).toBe(0.2);

    metrics.recordEnd({ success: true, latencyMs: 100 });
    expect(metrics.inFlight).toBe(1);
    expect(metrics.totalRequests).toBe(2);
    expect(metrics.successfulRequests).toBe(1);
  });

  it('computes error rate', () => {
    const metrics = createSaturationMetrics();
    metrics.recordStart();
    metrics.recordEnd({ success: true });
    metrics.recordStart();
    metrics.recordEnd({ success: false });
    expect(metrics.getErrorRate()).toBe(0.5);
  });

  it('tracks latency percentiles', () => {
    const metrics = createSaturationMetrics();
    metrics.recordStart();
    metrics.recordEnd({ success: true, latencyMs: 100 });
    metrics.recordStart();
    metrics.recordEnd({ success: true, latencyMs: 200 });
    metrics.recordStart();
    metrics.recordEnd({ success: true, latencyMs: 300 });

    const latencies = metrics.getLatencyPercentiles();
    expect(latencies.p50).toBe(200);
  });

  it('resets window', () => {
    const metrics = createSaturationMetrics();
    metrics.recordStart();
    metrics.recordEnd({ success: true, latencyMs: 100 });
    metrics.resetWindow();
    expect(metrics.totalRequests).toBe(0);
    expect(metrics.windowStart).toBeGreaterThan(0);
  });
});

describe('ConcurrencyController', () => {
  let controller;
  let currentTime;
  const events = [];

  beforeEach(() => {
    currentTime = new Date('2026-11-25T12:00:00Z').getTime();
    events.length = 0;

    controller = createConcurrencyController({
      now: () => currentTime,
      onEvent: (e) => events.push(e),
      routeConfigs: {
        '/api/test': { maxConcurrency: 20, minConcurrency: 5, saturationThreshold: 0.8 },
      },
    });
  });

  describe('acquireSlot', () => {
    it('allows requests within concurrency limit', async () => {
      const result = await controller.acquireSlot({ route: '/api/test', priority: PRIORITY_CLASSES.NORMAL });
      expect(result.allowed).toBe(true);
      expect(result.retryAfterMs).toBe(0);
    });

    it('tracks in-flight count', async () => {
      await controller.acquireSlot({ route: '/api/test' });
      await controller.acquireSlot({ route: '/api/test' });
      const snap = controller.getRouteSnapshot('/api/test');
      expect(snap.global.inFlight).toBe(2);
    });

    it('rejects when concurrency limit exceeded', async () => {
      // Fill up the concurrency slots
      for (let i = 0; i < 20; i++) {
        await controller.acquireSlot({ route: '/api/test', priority: PRIORITY_CLASSES.NORMAL });
      }

      const result = await controller.acquireSlot({ route: '/api/test', priority: PRIORITY_CLASSES.NORMAL });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('concurrency_limit');
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it('respects priority lanes', async () => {
      // Fill NORMAL priority
      for (let i = 0; i < 20; i++) {
        await controller.acquireSlot({ route: '/api/test', priority: PRIORITY_CLASSES.NORMAL });
      }

      // CRITICAL should still have reserved slots
      const result = await controller.acquireSlot({ route: '/api/test', priority: PRIORITY_CLASSES.CRITICAL });
      expect(result.allowed).toBe(true);
    });

    it('returns retry-after when at capacity', async () => {
      for (let i = 0; i < 20; i++) {
        await controller.acquireSlot({ route: '/api/test', priority: PRIORITY_CLASSES.NORMAL });
      }

      const result = await controller.acquireSlot({ route: '/api/test', priority: PRIORITY_CLASSES.NORMAL });
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });
  });

  describe('releaseSlot', () => {
    it('decrements in-flight count', async () => {
      await controller.acquireSlot({ route: '/api/test' });
      controller.releaseSlot({ route: '/api/test', success: true, latencyMs: 100 });
      const snap = controller.getRouteSnapshot('/api/test');
      expect(snap.global.inFlight).toBe(0);
    });

    it('records latency', async () => {
      await controller.acquireSlot({ route: '/api/test' });
      controller.releaseSlot({ route: '/api/test', success: true, latencyMs: 250 });
      const snap = controller.getRouteSnapshot('/api/test');
      expect(snap.global.latencyP50).toBe(250);
    });

    it('tracks errors', async () => {
      await controller.acquireSlot({ route: '/api/test' });
      controller.releaseSlot({ route: '/api/test', success: false, latencyMs: 5000 });
      const snap = controller.getRouteSnapshot('/api/test');
      expect(snap.global.errorRate).toBe(1);
    });
  });

  describe('priority lane isolation', () => {
    it('reserves slots for CRITICAL priority', async () => {
      // Fill all NORMAL slots (max 20, but reserved for critical/high)
      for (let i = 0; i < 20; i++) {
        const result = await controller.acquireSlot({ route: '/api/test', priority: PRIORITY_CLASSES.NORMAL });
        if (!result.allowed) break;
      }

      // CRITICAL should still work due to reserved slots
      const criticalResult = await controller.acquireSlot({ route: '/api/test', priority: PRIORITY_CLASSES.CRITICAL });
      expect(criticalResult.allowed).toBe(true);
    });

    it('tracks per-priority metrics', async () => {
      await controller.acquireSlot({ route: '/api/test', priority: PRIORITY_CLASSES.HIGH });
      await controller.acquireSlot({ route: '/api/test', priority: PRIORITY_CLASSES.HIGH });
      controller.releaseSlot({ route: '/api/test', priority: PRIORITY_CLASSES.HIGH, success: true, latencyMs: 100 });

      const snap = controller.getRouteSnapshot('/api/test');
      expect(snap.lanes.HIGH.inFlight).toBe(1);
      expect(snap.lanes.HIGH.latencyP50).toBe(100);
    });
  });

  describe('emergency brake', () => {
    it('activates when latency P99 exceeds threshold', async () => {
      // Fill queue and release with high latency
      for (let i = 0; i < 10; i++) {
        await controller.acquireSlot({ route: '/api/test' });
        controller.releaseSlot({ route: '/api/test', success: true, latencyMs: 6000 }); // Above 5000 threshold
      }

      const snap = controller.getRouteSnapshot('/api/test');
      expect(snap.emergencyBrake.active).toBe(true);
    });

    it('reduces concurrency when emergency brake active', async () => {
      for (let i = 0; i < 10; i++) {
        await controller.acquireSlot({ route: '/api/test' });
        controller.releaseSlot({ route: '/api/test', success: true, latencyMs: 6000 });
      }

      // Trigger adjustment to apply emergency brake reduction
      controller.forceAdjustment('/api/test');

      const snap = controller.getRouteSnapshot('/api/test');
      const newMax = snap.global.maxConcurrent;
      expect(newMax).toBeLessThan(20); // Should be reduced
    });

    it('releases emergency brake after cooldown', async () => {
      for (let i = 0; i < 10; i++) {
        await controller.acquireSlot({ route: '/api/test' });
        controller.releaseSlot({ route: '/api/test', success: true, latencyMs: 6000 });
      }

      expect(controller.getRouteSnapshot('/api/test').emergencyBrake.active).toBe(true);

      // Advance time past cooldown
      currentTime += 61000;

      // Trigger adjustment
      controller.forceAdjustment('/api/test');

      expect(controller.getRouteSnapshot('/api/test').emergencyBrake.active).toBe(false);
    });
  });

  describe('circuit breaker integration', () => {
    it('rejects when circuit breaker is OPEN', async () => {
      const { createDependencyPolicy, BREAKER_STATES } = await import('./mesh/resilience.js');
      const policy = createDependencyPolicy('route:/api/test', { now: () => currentTime });
      controller.registerDependencyPolicy('/api/test', policy);

      // Force circuit breaker OPEN
      for (let i = 0; i < 10; i++) {
        try {
          await policy.execute(async () => { throw new Error('fail'); });
        } catch {
          // Expected to fail
        }
      }

      expect(policy.getState()).toBe(BREAKER_STATES.OPEN);

      const result = await controller.acquireSlot({ route: '/api/test' });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('circuit_breaker_open');
    });

    it('allows limited traffic in HALF_OPEN', async () => {
      const { createDependencyPolicy, BREAKER_STATES } = await import('./mesh/resilience.js');
      const policy = createDependencyPolicy('route:/api/test', {
        now: () => currentTime,
        resetTimeoutMs: 100,
        maxHalfOpenAttempts: 2,
      });
      controller.registerDependencyPolicy('/api/test', policy);

      // Force OPEN
      for (let i = 0; i < 10; i++) {
        try { await policy.execute(async () => { throw new Error('fail'); }); } catch {
          // Expected to fail
        }
      }
      expect(policy.getState()).toBe(BREAKER_STATES.OPEN);

      // Advance to HALF_OPEN
      currentTime += 200;
      // Trigger state transition by calling canAcquireBreakerSlot
      await policy.execute(async () => 'ok').catch(() => {
        // Expected to fail during transition
      });

      // Check half-open allows some traffic
      const result = await controller.acquireSlot({ route: '/api/test' });
      expect(result.allowed).toBe(true);
    });
  });

  describe('concurrency adjustment', () => {
    it('decreases concurrency under saturation', async () => {
      // Initialize controller by making a request
      await controller.acquireSlot({ route: '/api/test' });
      controller.releaseSlot({ route: '/api/test', success: true, latencyMs: 100 });

      const routeController = controller.getRouteSnapshot('/api/test');
      const initialMax = routeController.global.maxConcurrent;

      // Simulate high utilization and errors
      for (let i = 0; i < 15; i++) {
        await controller.acquireSlot({ route: '/api/test' });
        controller.releaseSlot({ route: '/api/test', success: false, latencyMs: 2000 });
      }

      controller.forceAdjustment('/api/test');
      const newMax = controller.getRouteSnapshot('/api/test').global.maxConcurrent;
      expect(newMax).toBeLessThan(initialMax);
    });

    it('increases concurrency when underutilized', async () => {
      // First decrease it
      for (let i = 0; i < 15; i++) {
        await controller.acquireSlot({ route: '/api/test' });
        controller.releaseSlot({ route: '/api/test', success: false, latencyMs: 2000 });
      }
      controller.forceAdjustment('/api/test');
      const decreasedMax = controller.getRouteSnapshot('/api/test').global.maxConcurrent;

      // Now simulate healthy traffic
      currentTime += 35000; // Advance past measurement window
      for (let i = 0; i < 5; i++) {
        await controller.acquireSlot({ route: '/api/test' });
        controller.releaseSlot({ route: '/api/test', success: true, latencyMs: 100 });
      }
      controller.forceAdjustment('/api/test');
      const increasedMax = controller.getRouteSnapshot('/api/test').global.maxConcurrent;
      expect(increasedMax).toBeGreaterThanOrEqual(decreasedMax);
    });

    it('emits concurrency_adjusted events', async () => {
      await controller.acquireSlot({ route: '/api/test' });
      controller.releaseSlot({ route: '/api/test', success: false, latencyMs: 2000 });
      controller.forceAdjustment('/api/test');

      const adjustEvent = events.find(e => e.event === 'concurrency_adjusted');
      expect(adjustEvent).toBeDefined();
      expect(adjustEvent.route).toBe('/api/test');
      expect(adjustEvent.newMax).toBeLessThan(adjustEvent.oldMax);
    });
  });

  describe('snapshot and metrics', () => {
    it('returns comprehensive snapshot', async () => {
      await controller.acquireSlot({ route: '/api/test', priority: PRIORITY_CLASSES.HIGH });
      const snap = controller.getRouteSnapshot('/api/test');

      expect(snap.route).toBe('/api/test');
      expect(snap.global).toBeDefined();
      expect(snap.lanes).toBeDefined();
      expect(snap.emergencyBrake).toBeDefined();
      expect(snap.config).toBeDefined();
    });

    it('getAllSnapshots returns all routes', async () => {
      await controller.acquireSlot({ route: '/api/test' });
      await controller.acquireSlot({ route: '/api/other' });
      const all = controller.getAllSnapshots();
      expect(all['/api/test']).toBeDefined();
      expect(all['/api/other']).toBeDefined();
    });
  });

  describe('middleware', () => {
    it('creates middleware function', () => {
      const mw = controller.middleware();
      expect(typeof mw).toBe('function');
    });

    it('sets concurrency headers on response', async () => {
      const mw = controller.middleware({
        routeResolver: (req) => req.path,
        priorityResolver: (req) => req.priority,
      });

      const req = createMockReq({ path: '/api/test', priority: PRIORITY_CLASSES.NORMAL });
      const res = createMockRes();
      let nextCalled = false;

      await mw(req, res, () => { nextCalled = true; });

      expect(nextCalled).toBe(true);
      expect(res.headers['x-concurrency-limit']).toBeDefined();
      expect(res.headers['x-concurrency-inflight']).toBeDefined();
      expect(res.headers['x-concurrency-priority']).toBe('NORMAL');
    });

    it('rejects with 503 when at capacity', async () => {
      const mw = controller.middleware({
        routeResolver: (req) => req.path,
      });

      // Fill capacity
      for (let i = 0; i < 20; i++) {
        const req = createMockReq({ path: '/api/test' });
        const res = createMockRes();
        await mw(req, res, () => {});
      }

      // Next request should be rejected
      const req = createMockReq({ path: '/api/test' });
      const res = createMockRes();
      await mw(req, res, () => {});

      expect(res.statusCode).toBe(503);
      expect(res.body.error).toBe('service_overloaded');
      expect(res.body.code).toBe('CONCURRENCY_LIMIT_EXCEEDED');
      expect(res.headers['retry-after']).toBeDefined();
    });
  });
});