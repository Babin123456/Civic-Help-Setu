/* global process */
/**
 * api/_lib/backpressureMiddleware.js
 *
 * Backpressure Middleware integrating Concurrency Controller and Bounded Queue
 * into the API Gateway request pipeline.
 *
 * This middleware sits after the Gateway Middleware and provides:
 *  - Dynamic concurrency limits per route/tenant/priority
 *  - Bounded queue with priority lanes and tenant isolation
 *  - Explicit rejection with Retry-After headers
 *  - Integration with Mesh Resilience circuit breakers
 *  - Integration with Tenant Rate Limiter
 */

import { createConcurrencyController, PRIORITY_CLASSES } from './concurrencyController.js';
import { createBoundedQueue, QUEUE_PRIORITIES } from './boundedQueue.js';
import { createTenantRateLimiter } from './tenantRateLimiter.js';
import { createDependencyPolicy } from './mesh/resilience.js';

export const BACKPRESSURE_MODES = Object.freeze({
  DISABLED: 'disabled',
  SHADOW: 'shadow',      // Metrics only, no enforcement
  ENFORCE: 'enforce',    // Full enforcement
});

export const DEFAULT_BACKPRESSURE_CONFIG = Object.freeze({
  mode: process.env.BACKPRESSURE_MODE || BACKPRESSURE_MODES.SHADOW,
  concurrency: {
    enabled: true,
    routeConfigs: {},
    priorityLanes: {
      [PRIORITY_CLASSES.CRITICAL]: { minConcurrency: 5, maxConcurrency: 50, reservedSlots: 10 },
      [PRIORITY_CLASSES.HIGH]: { minConcurrency: 3, maxConcurrency: 30, reservedSlots: 5 },
      [PRIORITY_CLASSES.NORMAL]: { minConcurrency: 2, maxConcurrency: 20, reservedSlots: 0 },
      [PRIORITY_CLASSES.LOW]: { minConcurrency: 1, maxConcurrency: 10, reservedSlots: 0 },
    },
    emergencyBrake: {
      enabled: true,
      latencyP99ThresholdMs: 5000,
      errorRateThreshold: 0.5,
      cooldownMs: 60000,
    },
  },
  queue: {
    enabled: true,
    capacity: {
      [PRIORITY_CLASSES.CRITICAL]: 100,
      [PRIORITY_CLASSES.HIGH]: 200,
      [PRIORITY_CLASSES.NORMAL]: 500,
      [PRIORITY_CLASSES.LOW]: 1000,
    },
    tenantSlice: { enabled: true, maxPerTenant: 50 },
    aging: { enabled: true, promoteAfterMs: 5 * 60 * 1000, maxPromotions: 2 },
    rejection: { mode: 'immediate', defaultRetryAfterMs: 5000 },
  },
  tenantRateLimiter: {
    enabled: true,
    mode: 'enforce',
  },
  meshResilience: {
    enabled: true,
    defaultTimeoutMs: 5000,
    bulkheadMaxConcurrent: 64,
  },
  skipPaths: ['/health', '/ready', '/metrics', '/mesh-readiness', '/gateway-health', '/gateway-metrics', '/openapi'],
  onError: (err) => console.error('Backpressure middleware error:', err),
});

function extractPriority(req) {
  // Priority can come from:
  // 1. Request header (set by upstream router)
  // 2. Route configuration
  // 3. User role/tier
  // 4. Default: NORMAL
  const headerPriority = req.headers?.['x-request-priority'] || req.headers?.['X-Request-Priority'];
  if (headerPriority && QUEUE_PRIORITIES.includes(headerPriority)) {
    return headerPriority;
  }
  return req.priority || PRIORITY_CLASSES.NORMAL;
}

function extractRoute(req) {
  return req.path || req.url?.split('?')[0] || 'default';
}

function extractTenantId(req) {
  return req.tenantId ||
         req.headers?.['x-tenant-id'] ||
         req.consumer?.tenantId ||
         req.auth?.tenantId ||
         'default';
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

export function createBackpressureMiddleware(options = {}) {
  const config = deepMerge(DEFAULT_BACKPRESSURE_CONFIG, options);
  const now = config.now || Date.now;

  // Initialize components
  const concurrencyController = config.concurrency.enabled
    ? createConcurrencyController({
        routeConfigs: config.concurrency.routeConfigs,
        priorityLanes: config.concurrency.priorityLanes,
        emergencyBrake: config.concurrency.emergencyBrake,
        now,
        onEvent: config.onEvent,
      })
    : null;

  const boundedQueue = config.queue.enabled
    ? createBoundedQueue({
        capacity: config.queue.capacity,
        tenantSlice: config.queue.tenantSlice,
        aging: config.queue.aging,
        rejection: config.queue.rejection,
        now,
        onEvent: config.onEvent,
      })
    : null;

  const tenantRateLimiter = config.tenantRateLimiter.enabled
    ? createTenantRateLimiter({
        mode: config.tenantRateLimiter.mode,
        profiles: config.tenantRateLimiter.profiles,
        routePolicies: config.tenantRateLimiter.routePolicies,
        tenantOverrides: config.tenantRateLimiter.tenantOverrides,
        jurisdictionOverrides: config.tenantRateLimiter.jurisdictionOverrides,
        secret: config.tenantRateLimiter.secret,
        now,
        onEvent: config.onEvent,
      })
    : null;

  // Dependency policies for mesh resilience integration
  const dependencyPolicies = new Map();

  // Periodic aging for queue
  let agingTimer = null;
  if (boundedQueue && config.queue?.aging?.enabled) {
    agingTimer = setInterval(() => {
      boundedQueue.runAging();
    }, config.queue.aging.promoteAfterMs);
  }

  // Metrics collection
  const middlewareMetrics = {
    totalRequests: 0,
    allowedRequests: 0,
    rejectedRequests: 0,
    queuedRequests: 0,
    concurrencyRejections: 0,
    queueRejections: 0,
    tenantRateLimitRejections: 0,
    circuitBreakerRejections: 0,
    startTime: now(),
  };

  function getMetrics() {
    return {
      ...middlewareMetrics,
      uptimeMs: now() - middlewareMetrics.startTime,
      concurrency: concurrencyController?.getAllSnapshots() || {},
      queue: boundedQueue?.getSnapshot() || {},
    };
  }

  function getHealth() {
    const metrics = getMetrics();
    const isHealthy = config.mode === BACKPRESSURE_MODES.DISABLED ||
                      (metrics.rejectedRequests / Math.max(1, metrics.totalRequests)) < 0.1;
    return {
      status: isHealthy ? 'healthy' : 'degraded',
      mode: config.mode,
      rejectionRate: metrics.totalRequests > 0
        ? metrics.rejectedRequests / metrics.totalRequests
        : 0,
      components: {
        concurrencyController: concurrencyController ? 'enabled' : 'disabled',
        boundedQueue: boundedQueue ? 'enabled' : 'disabled',
        tenantRateLimiter: tenantRateLimiter ? 'enabled' : 'disabled',
      },
      timestamp: new Date(now()).toISOString(),
    };
  }

  /**
   * Register a dependency policy for circuit breaker integration.
   */
  function registerDependencyPolicy(route, policyOptions = {}) {
    if (!dependencyPolicies.has(route)) {
      const policy = createDependencyPolicy(`route:${route}`, {
        timeoutMs: config.meshResilience.defaultTimeoutMs,
        maxConcurrent: config.meshResilience.bulkheadMaxConcurrent,
        maxRetries: 0,
        failureThreshold: 5,
        errorRateThresholdPercent: 50,
        minWindowRequests: 6,
        windowDurationMs: 60000,
        resetTimeoutMs: 15000,
        maxHalfOpenAttempts: 2,
        now,
        ...policyOptions,
      });
      dependencyPolicies.set(route, policy);
      if (concurrencyController) {
        concurrencyController.registerDependencyPolicy(route, policy);
      }
    }
    return dependencyPolicies.get(route);
  }

  /**
   * Get dependency policy for a route.
   */
  function getDependencyPolicy(route) {
    return dependencyPolicies.get(route);
  }

  /**
   * Main middleware function.
   */
  async function backpressureMiddleware(req, res, next) {
    const startAt = now();
    middlewareMetrics.totalRequests++;

    try {
      // Skip paths
      const requestPath = extractRoute(req);
      if (config.skipPaths.some(p => requestPath.startsWith(p))) {
        return next();
      }

      // Skip if disabled
      if (config.mode === BACKPRESSURE_MODES.DISABLED) {
        return next();
      }

      // Extract context
      const priority = extractPriority(req);
      const route = requestPath;
      const tenantId = extractTenantId(req);

      // Attach to request for downstream use
      req.backpressure = { priority, route, tenantId };

      // Check tenant rate limit first (cheaper check)
      if (tenantRateLimiter) {
        const rateLimitDecision = await tenantRateLimiter.evaluate(req, route);
        res.setHeader('RateLimit-Limit', String(rateLimitDecision.limit));
        res.setHeader('RateLimit-Remaining', String(rateLimitDecision.remaining));
        res.setHeader('RateLimit-Reset', String(rateLimitDecision.resetSeconds));
        res.setHeader('X-RateLimit-Scope', rateLimitDecision.scope);

        if (!rateLimitDecision.allowed) {
          middlewareMetrics.tenantRateLimitRejections++;
          middlewareMetrics.rejectedRequests++;
          res.setHeader('Retry-After', String(rateLimitDecision.retryAfterSeconds));
          return res.status(rateLimitDecision.degraded ? 503 : 429).json({
            error: rateLimitDecision.degraded
              ? 'Rate limit backing store unavailable'
              : 'Rate limit exceeded for tenant/jurisdiction quota',
            code: rateLimitDecision.degraded ? 'RATE_LIMIT_STORE_UNAVAILABLE' : 'RATE_LIMIT_EXCEEDED',
            scope: rateLimitDecision.scope,
            retryAfterSeconds: rateLimitDecision.retryAfterSeconds,
          });
        }
      }

      // Try to acquire concurrency slot
      let concurrencyDecision = { allowed: true };
      if (concurrencyController) {
        concurrencyDecision = await concurrencyController.acquireSlot({ route, priority, tenantId });

        // Set concurrency headers
        const routeSnap = concurrencyController.getRouteSnapshot(route);
        if (routeSnap) {
          res.setHeader('X-Concurrency-Limit', String(routeSnap.global.maxConcurrent));
          res.setHeader('X-Concurrency-InFlight', String(routeSnap.global.inFlight));
          res.setHeader('X-Concurrency-Priority', priority);
        }
      }

      if (!concurrencyDecision.allowed) {
        middlewareMetrics.concurrencyRejections++;
        middlewareMetrics.rejectedRequests++;

        if (config.mode === BACKPRESSURE_MODES.SHADOW) {
          // In shadow mode, allow but add warning header
          res.setHeader('X-Backpressure-Warning', `concurrency_limit_exceeded: ${concurrencyDecision.reason}`);
          return next();
        }

        res.setHeader('Retry-After', String(Math.ceil(concurrencyDecision.retryAfterMs / 1000)));
        res.setHeader('X-Backpressure-Reason', concurrencyDecision.reason);
        return res.status(503).json({
          error: 'service_overloaded',
          code: 'CONCURRENCY_LIMIT_EXCEEDED',
          message: 'Service temporarily overloaded. Please retry later.',
          retryAfterSeconds: Math.ceil(concurrencyDecision.retryAfterMs / 1000),
          priority,
          route,
        });
      }

      // Check bounded queue saturation signal
      if (boundedQueue) {
        const queueSnap = boundedQueue.getSnapshot();
        const priorityQueueSnap = queueSnap.byPriority[priority];

        if (priorityQueueSnap && priorityQueueSnap.utilization > 0.9) {
          res.setHeader('X-Queue-Warning', `priority_${priority}_queue_near_capacity`);
        }
      }

      // Track latency and release on response
      const originalJson = typeof res.json === 'function' ? res.json.bind(res) : null;
      const originalSend = typeof res.send === 'function' ? res.send.bind(res) : null;
      const originalEnd = typeof res.end === 'function' ? res.end.bind(res) : null;
      let responseSent = false;

      function finalizeResponse(success = true) {
        if (responseSent) return;
        responseSent = true;

        const latencyMs = now() - startAt;

        if (concurrencyController) {
          concurrencyController.releaseSlot({ route, priority, tenantId, success, latencyMs });
        }

        if (success && res.statusCode < 400) {
          middlewareMetrics.allowedRequests++;
        } else {
          middlewareMetrics.rejectedRequests++;
        }

        // Record outcome to dependency policy for circuit breaker & saturation metrics
        const depPolicy = dependencyPolicies.get(route);
        if (depPolicy && typeof depPolicy.recordExternalOutcome === 'function') {
          depPolicy.recordExternalOutcome({ ok: success && res.statusCode < 500, latencyMs });
        }
      }

      if (originalJson) {
        res.json = function(body) {
          finalizeResponse(res.statusCode < 400);
          return originalJson(body);
        };
      }

      if (originalSend) {
        res.send = function(body) {
          finalizeResponse(res.statusCode < 400);
          return originalSend(body);
        };
      }

      if (originalEnd) {
        res.end = function(...args) {
          finalizeResponse(res.statusCode < 400);
          return originalEnd(...args);
        };
      }

      // Also handle error paths if response emitter supports .on()
      if (typeof res.on === 'function') {
        const originalOn = res.on.bind(res);
        res.on = function(event, handler) {
          if (event === 'finish' || event === 'close') {
            return originalOn(event, (...args) => {
              if (!responseSent) finalizeResponse(res.statusCode < 400);
              return handler?.apply(this, args);
            });
          }
          return originalOn(event, handler);
        };
      }

      next();
    } catch (err) {
      config.onError(err, req, res);
      // Fail open - don't block request on middleware errors
      next();
    }
  }

  // Expose internal components for testing and advanced use
  backpressureMiddleware.concurrencyController = concurrencyController;
  backpressureMiddleware.boundedQueue = boundedQueue;
  backpressureMiddleware.tenantRateLimiter = tenantRateLimiter;
  backpressureMiddleware.dependencyPolicies = dependencyPolicies;
  backpressureMiddleware.getMetrics = getMetrics;
  backpressureMiddleware.getHealth = getHealth;
  backpressureMiddleware.registerDependencyPolicy = registerDependencyPolicy;
  backpressureMiddleware.getDependencyPolicy = getDependencyPolicy;
  backpressureMiddleware.config = config;
  backpressureMiddleware.middlewareMetrics = middlewareMetrics;

  // Cleanup function
  backpressureMiddleware.shutdown = function() {
    if (agingTimer) {
      clearInterval(agingTimer);
      agingTimer = null;
    }
    if (concurrencyController) {
      concurrencyController.stopAllAdjustmentLoops();
      concurrencyController.stopSaturationMonitors();
    }
  };

  return backpressureMiddleware;
}

/**
 * Create a backpressure middleware with default configuration
 * that integrates with the existing gateway middleware.
 */
export function createDefaultBackpressureMiddleware(gatewayOptions = {}) {
  const defaultRouteConfigs = {
    '/api/services': { maxConcurrency: 100, targetLatencyP99Ms: 1000 },
    '/api/services/': { maxConcurrency: 100, targetLatencyP99Ms: 1000 },
    '/api/auth': { maxConcurrency: 50, targetLatencyP99Ms: 2000 },
    '/api/upload': { maxConcurrency: 20, targetLatencyP99Ms: 10000 },
    '/api/reports': { maxConcurrency: 30, targetLatencyP99Ms: 5000 },
    '/api/admin': { maxConcurrency: 10, targetLatencyP99Ms: 2000 },
  };
  return createBackpressureMiddleware(deepMerge({
    concurrency: { routeConfigs: defaultRouteConfigs },
  }, gatewayOptions));
}

export default createBackpressureMiddleware;