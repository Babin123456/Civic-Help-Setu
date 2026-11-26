/**
 * api/_lib/concurrencyController.js
 *
 * Adaptive Concurrency Controller for dynamic concurrency limits based on
 * dependency saturation signals. Uses AIMD (Additive Increase / Multiplicative
 * Decrease) algorithm with per-route and per-tenant isolation.
 *
 * Integrates with:
 *  - Mesh Resilience circuit breakers (api/_lib/mesh/resilience.js)
 *  - Tenant Rate Limiter (api/_lib/tenantRateLimiter.js)
 *  - Gateway Middleware (api/_lib/gateway/gatewayMiddleware.js)
 */

import { BREAKER_STATES } from './mesh/resilience.js';

export const PRIORITY_CLASSES = Object.freeze({
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  NORMAL: 'NORMAL',
  LOW: 'LOW',
});

export const DEFAULT_ROUTE_CONFIG = Object.freeze({
  maxConcurrency: 100,
  minConcurrency: 10,
  targetLatencyP50Ms: 200,
  targetLatencyP99Ms: 1000,
  maxErrorRate: 0.05,
  increaseStep: 5,
  decreaseFactor: 0.5,
  measurementWindowMs: 30_000,
  saturationThreshold: 0.8, // 80% utilization triggers decrease
});

export const DEFAULT_PRIORITY_LANE_CONFIG = Object.freeze({
  [PRIORITY_CLASSES.CRITICAL]: { minConcurrency: 5, maxConcurrency: 50, reservedSlots: 10 },
  [PRIORITY_CLASSES.HIGH]: { minConcurrency: 3, maxConcurrency: 30, reservedSlots: 5 },
  [PRIORITY_CLASSES.NORMAL]: { minConcurrency: 2, maxConcurrency: 20, reservedSlots: 0 },
  [PRIORITY_CLASSES.LOW]: { minConcurrency: 1, maxConcurrency: 10, reservedSlots: 0 },
});

export const DEFAULT_EMERGENCY_BRAKE_CONFIG = Object.freeze({
  enabled: true,
  latencyP99ThresholdMs: 5000,
  errorRateThreshold: 0.5,
  cooldownMs: 60_000,
});

export const DEFAULT_TENANT_CONCURRENCY_CONFIG = Object.freeze({
  enabled: true,
  maxConcurrencyPerTenant: null,
  shareRatio: 0.8,
  minConcurrencyPerTenant: 2,
});

const MAX_LATENCY_SAMPLES = 1000;

function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil(p / 100 * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export function createLatencyTracker({ maxSamples = MAX_LATENCY_SAMPLES } = {}) {
  const samples = [];
  return {
    record(latencyMs) {
      samples.push(latencyMs);
      if (samples.length > maxSamples) samples.shift();
    },
    getPercentiles() {
      if (!samples.length) return { p50: 0, p95: 0, p99: 0 };
      return {
        p50: percentile(samples, 50),
        p95: percentile(samples, 95),
        p99: percentile(samples, 99),
      };
    },
    reset() {
      samples.length = 0;
    },
    size: () => samples.length,
  };
}

export function createSaturationMetrics() {
  return {
    inFlight: 0,
    maxConcurrent: 0,
    peakInFlight: 0,
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    latencyTracker: createLatencyTracker(),
    windowStart: Date.now(),
    lastAdjustment: 0,
    adjustmentCount: 0,

    recordStart() {
      this.inFlight++;
      this.totalRequests++;
      if (this.inFlight > this.peakInFlight) this.peakInFlight = this.inFlight;
    },

    recordEnd({ success, latencyMs }) {
      this.inFlight = Math.max(0, this.inFlight - 1);
      if (success) this.successfulRequests++; else this.failedRequests++;
      if (latencyMs !== undefined) this.latencyTracker.record(latencyMs);
    },

    getUtilization() {
      return this.maxConcurrent > 0 ? this.inFlight / this.maxConcurrent : 0;
    },

    getErrorRate() {
      return this.totalRequests > 0 ? this.failedRequests / this.totalRequests : 0;
    },

    getLatencyPercentiles() {
      return this.latencyTracker.getPercentiles();
    },

    snapshot() {
      const latencies = this.getLatencyPercentiles();
      return {
        inFlight: this.inFlight,
        maxConcurrent: this.maxConcurrent,
        peakInFlight: this.peakInFlight,
        utilization: this.getUtilization(),
        totalRequests: this.totalRequests,
        errorRate: this.getErrorRate(),
        latencyP50: latencies.p50,
        latencyP95: latencies.p95,
        latencyP99: latencies.p99,
        windowAgeMs: Date.now() - this.windowStart,
        adjustmentCount: this.adjustmentCount,
        lastAdjustmentAgoMs: Date.now() - this.lastAdjustment,
      };
    },

    resetWindow() {
      this.windowStart = Date.now();
      this.totalRequests = 0;
      this.successfulRequests = 0;
      this.failedRequests = 0;
      this.latencyTracker.reset();
      this.peakInFlight = this.inFlight;
    },
  };
}

function createRouteController(route, config, priorityLanes, emergencyBrake, tenantConfig, getDepPolicy, now, onEvent) {
  const metrics = createSaturationMetrics();
  metrics.maxConcurrent = config.maxConcurrency;
  const tenantInFlight = new Map();

  const laneMetrics = {};
  for (const [priority, laneConfig] of Object.entries(priorityLanes)) {
    laneMetrics[priority] = {
      ...createSaturationMetrics(),
      maxConcurrent: 0, // Will be set by distributeToLanes
      reservedSlots: laneConfig.reservedSlots,
      minConcurrency: laneConfig.minConcurrency,
      maxCapacity: laneConfig.maxConcurrency,
    };
  }

  let emergencyBrakeActive = false;
  let emergencyBrakeUntil = 0;

  // Initial distribution
  distributeToLanes(config.maxConcurrency);

  function checkEmergencyBrake() {
    if (!emergencyBrake.enabled) return false;
    const nowMs = now();
    if (emergencyBrakeActive) {
      if (nowMs >= emergencyBrakeUntil) {
        emergencyBrakeActive = false;
        onEvent({ event: 'emergency_brake_released', route, at: nowMs });
        return false;
      }
      return true;
    }
    const snap = metrics.snapshot();
    if (snap.latencyP99 > emergencyBrake.latencyP99ThresholdMs ||
        snap.errorRate > emergencyBrake.errorRateThreshold) {
      emergencyBrakeActive = true;
      emergencyBrakeUntil = nowMs + emergencyBrake.cooldownMs;
      onEvent({
        event: 'emergency_brake_activated',
        route,
        reason: snap.latencyP99 > emergencyBrake.latencyP99ThresholdMs ? 'latency' : 'error_rate',
        latencyP99: snap.latencyP99,
        errorRate: snap.errorRate,
        at: nowMs,
      });
      return true;
    }
    return false;
  }

  function computeDesiredConcurrency() {
    const snap = metrics.snapshot();
    const utilization = snap.utilization;
    const errorRate = snap.errorRate;
    const latencyP99 = snap.latencyP99;

    // Emergency brake overrides everything
    if (checkEmergencyBrake()) {
      return Math.max(config.minConcurrency, Math.floor(metrics.maxConcurrent * 0.25));
    }

    // Factor in dependency saturation from Mesh Resilience if available
    const depPolicy = typeof getDepPolicy === 'function' ? getDepPolicy(route) : null;
    const depSat = depPolicy && typeof depPolicy.getSaturation === 'function' ? depPolicy.getSaturation() : null;

    // AIMD logic
    const isSaturated = utilization > config.saturationThreshold ||
                        errorRate > config.maxErrorRate ||
                        latencyP99 > config.targetLatencyP99Ms ||
                        (depSat && (
                          depSat.utilization > config.saturationThreshold ||
                          depSat.errorRate > config.maxErrorRate ||
                          depSat.latencyP99 > config.targetLatencyP99Ms
                        ));

    if (isSaturated) {
      // Multiplicative decrease
      const newMax = Math.max(config.minConcurrency, Math.floor(metrics.maxConcurrent * config.decreaseFactor));
      return newMax;
    } else if (utilization < config.saturationThreshold * 0.5 && errorRate < config.maxErrorRate * 0.5) {
      // Additive increase (only when well under threshold)
      return Math.min(config.maxConcurrency, metrics.maxConcurrent + config.increaseStep);
    }
    return metrics.maxConcurrent;
  }

  function adjustConcurrency() {
    const desired = computeDesiredConcurrency();
    if (desired !== metrics.maxConcurrent) {
      const oldMax = metrics.maxConcurrent;
      metrics.maxConcurrent = desired;
      metrics.lastAdjustment = now();
      metrics.adjustmentCount++;

      // Distribute to priority lanes proportionally
      distributeToLanes(desired);

      onEvent({
        event: 'concurrency_adjusted',
        route,
        oldMax,
        newMax: desired,
        utilization: metrics.getUtilization(),
        errorRate: metrics.getErrorRate(),
        latencyP99: metrics.snapshot().latencyP99,
        emergencyBrake: emergencyBrakeActive,
        at: metrics.lastAdjustment,
      });
    }
  }

  function distributeToLanes(totalConcurrency) {
    const laneConfigs = [
      { priority: PRIORITY_CLASSES.CRITICAL, min: laneMetrics.CRITICAL.minConcurrency, max: laneMetrics.CRITICAL.maxCapacity, reserved: laneMetrics.CRITICAL.reservedSlots },
      { priority: PRIORITY_CLASSES.HIGH, min: laneMetrics.HIGH.minConcurrency, max: laneMetrics.HIGH.maxCapacity, reserved: laneMetrics.HIGH.reservedSlots },
      { priority: PRIORITY_CLASSES.NORMAL, min: laneMetrics.NORMAL.minConcurrency, max: laneMetrics.NORMAL.maxCapacity, reserved: laneMetrics.NORMAL.reservedSlots },
      { priority: PRIORITY_CLASSES.LOW, min: laneMetrics.LOW.minConcurrency, max: laneMetrics.LOW.maxCapacity, reserved: laneMetrics.LOW.reservedSlots },
    ];

    const totalMin = laneConfigs.reduce((sum, lc) => sum + lc.min, 0);

    if (totalConcurrency >= totalMin) {
      // Enough capacity for all minimums + reserved + proportional
      let remaining = totalConcurrency;

      // First pass: allocate minimums
      for (const lc of laneConfigs) {
        const allocated = Math.min(lc.max, lc.min);
        laneMetrics[lc.priority].maxConcurrent = allocated;
        remaining -= allocated;
      }

      // Second pass: allocate reserved slots
      for (const lc of laneConfigs) {
        if (remaining <= 0) break;
        const reserved = Math.min(lc.reserved, lc.max - laneMetrics[lc.priority].maxConcurrent);
        const allocated = Math.min(reserved, remaining);
        laneMetrics[lc.priority].maxConcurrent += allocated;
        remaining -= allocated;
      }

      // Third pass: distribute remaining proportionally by weight
      if (remaining > 0) {
        const weights = { CRITICAL: 4, HIGH: 3, NORMAL: 2, LOW: 1 };
        const totalWeight = laneConfigs.reduce((sum, lc) => sum + weights[lc.priority], 0);
        for (const lc of laneConfigs) {
          if (remaining <= 0) break;
          const maxAdditional = lc.max - laneMetrics[lc.priority].maxConcurrent;
          if (maxAdditional <= 0) continue;
          const share = Math.min(maxAdditional, Math.floor(remaining * weights[lc.priority] / totalWeight));
          laneMetrics[lc.priority].maxConcurrent += share;
          remaining -= share;
        }
      }
    } else {
      // Not enough capacity for all minimums - allocate proportionally by weight
      // but ensure at least 1 for CRITICAL if possible
      const weights = { CRITICAL: 4, HIGH: 3, NORMAL: 2, LOW: 1 };
      const totalWeight = laneConfigs.reduce((sum, lc) => sum + weights[lc.priority], 0);
      let remaining = totalConcurrency;

      // Allocate at least 1 to CRITICAL if possible
      if (remaining > 0) {
        const criticalAlloc = Math.min(1, laneConfigs[0].max, remaining);
        laneMetrics.CRITICAL.maxConcurrent = criticalAlloc;
        remaining -= criticalAlloc;
      }

      // Distribute remaining proportionally
      for (const lc of laneConfigs.slice(1)) {
        if (remaining <= 0) break;
        const share = Math.min(lc.max, Math.floor(totalConcurrency * weights[lc.priority] / totalWeight));
        const allocated = Math.min(share, remaining);
        laneMetrics[lc.priority].maxConcurrent = allocated;
        remaining -= allocated;
      }

      // If any remaining, give to CRITICAL
      if (remaining > 0) {
        laneMetrics.CRITICAL.maxConcurrent = Math.min(laneConfigs[0].max, laneMetrics.CRITICAL.maxConcurrent + remaining);
      }
    }
  }

  function getTenantLimit() {
    if (!tenantConfig?.enabled) return Infinity;
    if (typeof config.maxTenantConcurrency === 'number') return config.maxTenantConcurrency;
    if (typeof tenantConfig.maxConcurrencyPerTenant === 'number') return tenantConfig.maxConcurrencyPerTenant;
    const minTenant = Math.min(config.maxConcurrency, tenantConfig.minConcurrencyPerTenant ?? 2);
    return Math.max(minTenant, Math.floor(metrics.maxConcurrent * (tenantConfig.shareRatio ?? 0.8)));
  }

  function canAcquire(priority = PRIORITY_CLASSES.NORMAL, tenantId = 'default') {
    const lane = laneMetrics[priority] || laneMetrics.NORMAL;
    if (lane.inFlight >= lane.maxConcurrent) return false;
    if (tenantConfig?.enabled && priority !== PRIORITY_CLASSES.CRITICAL) {
      const currentTenantInFlight = tenantInFlight.get(tenantId) || 0;
      if (currentTenantInFlight >= getTenantLimit()) return false;
    }
    return true;
  }

  function isTenantSaturated(priority = PRIORITY_CLASSES.NORMAL, tenantId = 'default') {
    if (!tenantConfig?.enabled || priority === PRIORITY_CLASSES.CRITICAL) return false;
    const currentTenantInFlight = tenantInFlight.get(tenantId) || 0;
    return currentTenantInFlight >= getTenantLimit();
  }

  function acquire(priority = PRIORITY_CLASSES.NORMAL, tenantId = 'default') {
    const lane = laneMetrics[priority] || laneMetrics.NORMAL;
    lane.recordStart();
    metrics.recordStart();
    tenantInFlight.set(tenantId, (tenantInFlight.get(tenantId) || 0) + 1);
    return true;
  }

  function release(priority = PRIORITY_CLASSES.NORMAL, { success = true, latencyMs, tenantId = 'default' } = {}) {
    const lane = laneMetrics[priority] || laneMetrics.NORMAL;
    lane.recordEnd({ success, latencyMs });
    metrics.recordEnd({ success, latencyMs });
    const current = tenantInFlight.get(tenantId) || 0;
    if (current <= 1) {
      tenantInFlight.delete(tenantId);
    } else {
      tenantInFlight.set(tenantId, current - 1);
    }
  }

  function getRetryAfter(priority = PRIORITY_CLASSES.NORMAL) {
    const lane = laneMetrics[priority] || laneMetrics.NORMAL;
    if (lane.inFlight >= lane.maxConcurrent) {
      // Estimate based on current latency
      const snap = lane.snapshot();
      const avgLatency = snap.latencyP50 || config.targetLatencyP50Ms || 200;
      return Math.max(1000, Math.ceil(avgLatency * 1.5));
    }
    return 0;
  }

  function checkEmergencyBrakeOnAcquire() {
    return checkEmergencyBrake();
  }

  function getSnapshot() {
    return {
      route,
      global: metrics.snapshot(),
      lanes: Object.fromEntries(
        Object.entries(laneMetrics).map(([k, v]) => [k, v.snapshot()])
      ),
      tenants: {
        activeCount: tenantInFlight.size,
        limit: getTenantLimit(),
        inFlight: Object.fromEntries(tenantInFlight),
      },
      emergencyBrake: { active: emergencyBrakeActive, until: emergencyBrakeUntil },
      config: { ...config, priorityLanes, emergencyBrake, tenantConfig },
    };
  }

  // Periodic adjustment
  let adjustmentTimer = null;
  function startAdjustmentLoop(intervalMs = config.measurementWindowMs) {
    if (adjustmentTimer) return;
    adjustmentTimer = setInterval(() => {
      adjustConcurrency();
      metrics.resetWindow();
      for (const lane of Object.values(laneMetrics)) {
        lane.resetWindow();
      }
    }, intervalMs);
  }

  function stopAdjustmentLoop() {
    if (adjustmentTimer) {
      clearInterval(adjustmentTimer);
      adjustmentTimer = null;
    }
  }

  return {
    route,
    acquire,
    release,
    canAcquire,
    isTenantSaturated,
    getRetryAfter,
    getSnapshot,
    adjustConcurrency,
    startAdjustmentLoop,
    stopAdjustmentLoop,
    checkEmergencyBrakeOnAcquire,
    metrics,
    laneMetrics,
  };
}

export function createConcurrencyController({
  routeConfigs = {},
  priorityLanes = DEFAULT_PRIORITY_LANE_CONFIG,
  emergencyBrake = DEFAULT_EMERGENCY_BRAKE_CONFIG,
  tenantConfig = DEFAULT_TENANT_CONCURRENCY_CONFIG,
  defaultConfig = DEFAULT_ROUTE_CONFIG,
  now = Date.now,
  onEvent = () => {},
  dependencyPolicies = new Map(), // route -> DependencyPolicy from mesh/resilience
} = {}) {
  const controllers = new Map();
  const routeConfigCache = new Map();
  let saturationMonitorsStarted = false;

  function getRouteConfig(route) {
    if (routeConfigCache.has(route)) return routeConfigCache.get(route);
    const config = { ...defaultConfig, ...(routeConfigs[route] || {}) };
    routeConfigCache.set(route, config);
    return config;
  }

  function getController(route) {
    if (!controllers.has(route)) {
      const config = getRouteConfig(route);
      controllers.set(
        route,
        createRouteController(
          route,
          config,
          priorityLanes,
          emergencyBrake,
          tenantConfig,
          (r) => dependencyPolicies.get(r),
          now,
          onEvent
        )
      );
    }
    return controllers.get(route);
  }

  /**
   * Start saturation monitors for all registered dependency policies.
   * This enables the concurrency controller to react to dependency saturation changes.
   */
  function startSaturationMonitors() {
    if (saturationMonitorsStarted) return;
    saturationMonitorsStarted = true;

    for (const [route, policy] of dependencyPolicies) {
      if (typeof policy.startSaturationMonitor === 'function') {
        policy.startSaturationMonitor();
        // Set up callback to adjust concurrency based on dependency saturation
        if (typeof policy.onSaturationChange === 'function') {
          // Wrap the callback to adjust concurrency
          const originalCallback = policy.onSaturationChange;
          policy.onSaturationChange = (current, previous) => {
            originalCallback(current, previous);
            // Adjust concurrency based on dependency saturation
            const controller = controllers.get(route);
            if (controller) {
              // Force concurrency adjustment based on new saturation data
              controller.adjustConcurrency();
              onEvent({
                event: 'dependency_saturation_changed',
                route,
                current: {
                  utilization: current.utilization,
                  errorRate: current.errorRate,
                  latencyP99: current.latencyP99,
                  breakerState: current.breakerState,
                },
                previous: {
                  utilization: previous.utilization,
                  errorRate: previous.errorRate,
                  latencyP99: previous.latencyP99,
                  breakerState: previous.breakerState,
                },
              });
            }
          };
        }
      }
    }
  }

  /**
   * Stop all saturation monitors.
   */
  function stopSaturationMonitors() {
    if (!saturationMonitorsStarted) return;
    saturationMonitorsStarted = false;
    for (const [, policy] of dependencyPolicies) {
      if (typeof policy.stopSaturationMonitor === 'function') {
        policy.stopSaturationMonitor();
      }
    }
  }

  /**
   * Attempt to acquire a concurrency slot for a request.
   * @returns {Object} { allowed: boolean, retryAfterMs: number, route: string, priority: string }
   */
  async function acquireSlot({ route, priority = PRIORITY_CLASSES.NORMAL, tenantId = 'default' } = {}) {
    const controller = getController(route);
    const depPolicy = dependencyPolicies.get(route);

    // Check dependency circuit breaker first
    if (depPolicy) {
      const state = depPolicy.getState();
      if (state === BREAKER_STATES.OPEN) {
        return {
          allowed: false,
          retryAfterMs: 5000,
          reason: 'circuit_breaker_open',
          route,
          priority,
        };
      }
      if (state === BREAKER_STATES.HALF_OPEN) {
        // Allow but with reduced concurrency
        const snap = depPolicy.snapshot();
        if (snap.activeCalls >= snap.maxConcurrent) {
          return {
            allowed: false,
            retryAfterMs: 1000,
            reason: 'half_open_saturated',
            route,
            priority,
          };
        }
      }
    }

    // Check emergency brake
    if (controller.checkEmergencyBrakeOnAcquire()) {
      return {
        allowed: false,
        retryAfterMs: emergencyBrake.cooldownMs,
        reason: 'emergency_brake',
        route,
        priority,
      };
    }

    // Check local concurrency limit (lane + per-tenant)
    if (!controller.canAcquire(priority, tenantId)) {
      const tenantLimited = controller.isTenantSaturated(priority, tenantId);
      const retryAfter = controller.getRetryAfter(priority) || 1000;
      return {
        allowed: false,
        retryAfterMs: retryAfter,
        reason: tenantLimited ? 'tenant_concurrency_limit' : 'concurrency_limit',
        route,
        priority,
        tenantId,
      };
    }

    controller.acquire(priority, tenantId);
    return { allowed: true, retryAfterMs: 0, route, priority, tenantId };
  }

  /**
   * Release a concurrency slot after request completion.
   */
  function releaseSlot({ route, priority = PRIORITY_CLASSES.NORMAL, tenantId = 'default', success = true, latencyMs } = {}) {
    const controller = getController(route);
    controller.release(priority, { success, latencyMs, tenantId });
  }

  /**
   * Middleware wrapper for easy integration.
   */
  function middleware(options = {}) {
    const {
      routeResolver = (req) => req.url || 'default',
      priorityResolver = (req) => req.priority || PRIORITY_CLASSES.NORMAL,
      tenantResolver = (req) => req.tenantId || req.consumer?.id || 'default',
    } = options;

    return async function concurrencyMiddleware(req, res, next) {
      const route = typeof routeResolver === 'function' ? routeResolver(req) : String(routeResolver);
      const priority = typeof priorityResolver === 'function' ? priorityResolver(req) : PRIORITY_CLASSES.NORMAL;
      const tenantId = typeof tenantResolver === 'function' ? tenantResolver(req) : 'default';

      const decision = await acquireSlot({ route, priority, tenantId });

      // Set response headers for observability
      res.setHeader('X-Concurrency-Limit', String(getController(route).metrics.maxConcurrent));
      res.setHeader('X-Concurrency-InFlight', String(getController(route).metrics.inFlight));
      res.setHeader('X-Concurrency-Priority', priority);

      if (!decision.allowed) {
        res.setHeader('Retry-After', String(Math.ceil(decision.retryAfterMs / 1000)));
        res.setHeader('X-Concurrency-Rejection-Reason', decision.reason);
        return res.status(503).json({
          error: 'service_overloaded',
          code: 'CONCURRENCY_LIMIT_EXCEEDED',
          message: 'Service temporarily overloaded. Please retry later.',
          retryAfterSeconds: Math.ceil(decision.retryAfterMs / 1000),
          priority,
          route,
        });
      }

      // Track latency
      const startAt = now();
      let released = false;
      const releaseOnce = () => {
        if (released) return;
        released = true;
        const latencyMs = now() - startAt;
        releaseSlot({ route, priority, tenantId, success: res.statusCode < 400, latencyMs });
      };

      if (typeof res.json === 'function') {
        const originalJson = res.json.bind(res);
        res.json = function(body) {
          releaseOnce();
          return originalJson(body);
        };
      }

      if (typeof res.end === 'function') {
        const originalEnd = res.end.bind(res);
        res.end = function(...args) {
          releaseOnce();
          return originalEnd(...args);
        };
      }

      next();
    };
  }

  /**
   * Get aggregated snapshot for all routes.
   */
  function getAllSnapshots() {
    const result = {};
    for (const [route, controller] of controllers) {
      result[route] = controller.getSnapshot();
    }
    return result;
  }

  /**
   * Get snapshot for a specific route.
   */
  function getRouteSnapshot(route) {
    const controller = controllers.get(route);
    return controller?.getSnapshot() || null;
  }

  /**
   * Start periodic adjustment for all controllers.
   */
  function startAllAdjustmentLoops() {
    for (const controller of controllers.values()) {
      controller.startAdjustmentLoop();
    }
  }

  /**
   * Stop all adjustment loops.
   */
  function stopAllAdjustmentLoops() {
    for (const controller of controllers.values()) {
      controller.stopAdjustmentLoop();
    }
  }

  /**
   * Register a dependency policy for a route (for circuit breaker integration).
   */
  function registerDependencyPolicy(route, policy) {
    dependencyPolicies.set(route, policy);
  }

  /**
   * Force concurrency adjustment for a route (operator action).
   */
  function forceAdjustment(route) {
    const controller = controllers.get(route);
    if (controller) controller.adjustConcurrency();
  }

  return {
    acquireSlot,
    releaseSlot,
    middleware,
    getAllSnapshots,
    getRouteSnapshot,
    startAllAdjustmentLoops,
    stopAllAdjustmentLoops,
    registerDependencyPolicy,
    forceAdjustment,
    startSaturationMonitors,
    stopSaturationMonitors,
    PRIORITY_CLASSES,
    DEFAULT_ROUTE_CONFIG,
    DEFAULT_PRIORITY_LANE_CONFIG,
    DEFAULT_EMERGENCY_BRAKE_CONFIG,
    DEFAULT_TENANT_CONCURRENCY_CONFIG,
  };
}

export default createConcurrencyController;