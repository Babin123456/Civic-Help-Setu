/* global process */
/**
 * api/_lib/loadShedder.js
 *
 * Priority-Aware Load Shedding and Graceful Degradation Middleware for
 * Civic Help Setu Serverless API Dispatch (#1349).
 *
 * Classifies routes server-side (never trusting client priority headers) into:
 *  - `critical`: citizen grievances, emergency reports, and core writes
 *  - `standard`: normal service reads and directory lookups
 *  - `sheddable`: analytics, diagnostics, benchmarks, and synthetic datasets
 *
 * Under inflight concurrency or EWMA latency pressure, sheds `sheddable` first,
 * then `standard`, while preserving `critical` traffic up to the hard cap.
 */

export const PRIORITY_TIERS = Object.freeze({
  CRITICAL: 'critical',
  STANDARD: 'standard',
  SHEDDABLE: 'sheddable',
});

const DEFAULT_SHEDDABLE_PREFIXES = Object.freeze([
  'ward-analytics',
  'open-contracting-analytics',
  'synthetic-datasets',
  'journey-benchmark',
  'catalogue-visual-qa',
  'civic-chaos-engineering',
  'multi-region-metrics',
]);

const DEFAULT_CRITICAL_ROUTES = Object.freeze([
  'flood-incident-reports',
  'heat-relief-observations',
  'water-tanker-reports',
  'pds-observations',
  'address-change-corrections',
  'public-toilets',
  'pedestrian-barriers',
  'privacy-exports',
]);

/**
 * Classifies a route + HTTP method server-side into a priority tier.
 */
export function classifyRoutePriority(route = '', method = 'GET', {
  sheddablePrefixes = DEFAULT_SHEDDABLE_PREFIXES,
  criticalRoutes = DEFAULT_CRITICAL_ROUTES,
} = {}) {
  const normRoute = String(route || '').trim().toLowerCase();
  const normMethod = String(method || 'GET').toUpperCase();

  if (sheddablePrefixes.some((prefix) => normRoute.startsWith(prefix))) {
    return PRIORITY_TIERS.SHEDDABLE;
  }
  if (criticalRoutes.includes(normRoute) && normMethod !== 'GET' && normMethod !== 'HEAD') {
    return PRIORITY_TIERS.CRITICAL;
  }
  if (normMethod === 'POST' || normMethod === 'PUT' || normMethod === 'PATCH' || normMethod === 'DELETE') {
    return PRIORITY_TIERS.CRITICAL;
  }
  return PRIORITY_TIERS.STANDARD;
}

/**
 * Creates a priority-aware load shedder with hysteresis and EWMA latency tracking.
 */
export function createLoadShedder({
  mode = process.env.LOAD_SHEDDING_MODE || 'shadow', // 'shadow' | 'enforce' | 'disabled'
  maxInflight = Number(process.env.LOAD_SHED_MAX_INFLIGHT) || 100,
  sheddableThresholdRatio = 0.6,
  standardThresholdRatio = 0.85,
  ewmaLatencyWarningMs = 1500,
  ewmaLatencyCriticalMs = 3000,
  hysteresisRecoveryRatio = 0.5,
  now = Date.now,
  onMetric = () => {},
} = {}) {
  const effectiveMode = ['enforce', 'shadow', 'disabled'].includes(mode) ? mode : 'shadow';
  let inflight = 0;
  let ewmaLatencyMs = 0;
  let shedState = 'normal'; // 'normal' | 'elevated' | 'critical'

  function updateShedState() {
    const ratio = inflight / Math.max(1, maxInflight);

    if (ratio >= standardThresholdRatio || ewmaLatencyMs >= ewmaLatencyCriticalMs) {
      shedState = 'critical';
    } else if (ratio >= sheddableThresholdRatio || ewmaLatencyMs >= ewmaLatencyWarningMs) {
      if (shedState !== 'critical') shedState = 'elevated';
    } else if (
      ratio <= sheddableThresholdRatio * hysteresisRecoveryRatio &&
      ewmaLatencyMs < ewmaLatencyWarningMs * hysteresisRecoveryRatio
    ) {
      shedState = 'normal';
    }
    return shedState;
  }

  function shouldShed(tier) {
    if (inflight >= maxInflight) return true;
    if (shedState === 'critical') {
      return tier === PRIORITY_TIERS.SHEDDABLE || tier === PRIORITY_TIERS.STANDARD;
    }
    if (shedState === 'elevated') {
      return tier === PRIORITY_TIERS.SHEDDABLE;
    }
    return false;
  }

  function recordLatency(durationMs) {
    const alpha = 0.25;
    ewmaLatencyMs = ewmaLatencyMs === 0 ? durationMs : alpha * durationMs + (1 - alpha) * ewmaLatencyMs;
  }

  async function execute(req, res, route, fn) {
    if (effectiveMode === 'disabled') {
      return fn();
    }

    const tier = classifyRoutePriority(route, req?.method);
    updateShedState();

    if (shouldShed(tier)) {
      const retryAfterSeconds = tier === PRIORITY_TIERS.SHEDDABLE ? 10 : 5;
      onMetric({
        event: 'load_shed',
        mode: effectiveMode,
        route,
        tier,
        shedState,
        inflight,
        ewmaLatencyMs: Math.round(ewmaLatencyMs),
      });

      if (effectiveMode === 'enforce') {
        if (res && typeof res.setHeader === 'function') {
          res.setHeader('Retry-After', String(retryAfterSeconds));
          res.setHeader('X-Load-Shed-Tier', tier);
        }
        if (res && typeof res.status === 'function' && !res.writableEnded) {
          return res.status(503).json({
            error: 'Service temporarily overloaded; please retry shortly',
            code: 'LOAD_SHED_OVERLOAD',
            tier,
            retryAfterSeconds,
          });
        }
        return {
          status: 503,
          headers: {
            'Retry-After': String(retryAfterSeconds),
            'X-Load-Shed-Tier': tier,
          },
          body: {
            error: 'Service temporarily overloaded; please retry shortly',
            code: 'LOAD_SHED_OVERLOAD',
            tier,
            retryAfterSeconds,
          },
        };
      }
    }

    inflight += 1;
    const start = now();
    try {
      return await fn();
    } finally {
      inflight = Math.max(0, inflight - 1);
      recordLatency(Math.max(0, now() - start));
      updateShedState();
    }
  }

  return {
    execute,
    getSnapshot: () => ({
      mode: effectiveMode,
      inflight,
      maxInflight,
      ewmaLatencyMs: Math.round(ewmaLatencyMs),
      shedState,
    }),
  };
}
