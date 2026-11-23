/**
 * AI Inference Latency and Fallback Operations Dashboard Service
 *
 * Implements a privacy-safe telemetry aggregator and operations analytics service:
 * - Aggregates operational telemetry emitted by the AI policy layer:
 *   * Request volume over selectable time windows (1h, 24h, 7d)
 *   * Latency percentiles: P50 (median) and P95 (tail latency)
 *   * Distinguishes Provider Outages (upstream 5xx/timeouts) vs. Local Validation Rejections (oversized inputs)
 *   * Fallback pathway activation frequency
 * - Strict Privacy-First Constraints:
 *   * Zero recording of citizen prompts, response texts, documents, or account IDs
 *   * All telemetry is purely numeric, keyed by modelId, configVersion, and timestamp
 * - Statistical Integrity:
 *   * Explicitly marks low-volume sample periods (< 10 requests) to prevent skewed decisions
 * - Access Control:
 *   * Restricted to authorized maintainer roles
 */

export const TELEMETRY_WINDOWS = Object.freeze({
  ONE_HOUR: '1h',
  TWENTY_FOUR_HOURS: '24h',
  SEVEN_DAYS: '7d'
});

export const FAILURE_TYPES = Object.freeze({
  PROVIDER_TIMEOUT: 'PROVIDER_TIMEOUT',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  LOCAL_VALIDATION_REJECTION: 'LOCAL_VALIDATION_REJECTION',
  BUDGET_EXHAUSTION: 'BUDGET_EXHAUSTION'
});

export const MIN_TELEMETRY_SAMPLE_THRESHOLD = 10;

/**
 * Calculates P50 and P95 latency percentiles from raw latency measurements
 * @param {Array<number>} latencies Array of latency values in milliseconds
 * @returns {Object} { p50: number, p95: number }
 */
export function calculateLatencyPercentiles(latencies = []) {
  if (!Array.isArray(latencies) || latencies.length === 0) {
    return { p50: 0, p95: 0 };
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const getPercentile = (p) => {
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  };

  return {
    p50: getPercentile(50),
    p95: getPercentile(95)
  };
}

export class AiOperationsDashboardService {
  constructor() {
    this.telemetryRecords = []; // Array of anonymized operational metric events
  }

  /**
   * Ingests an operational metric event (strictly zero PII)
   * @param {Object} event Metric data
   */
  recordInferenceEvent({
    timestamp = Date.now(),
    modelId = 'gemini-1.5-pro',
    configVersion = '2026.11-v1',
    latencyMs = 0,
    success = true,
    failureType = null,
    fallbackActivated = false
  }) {
    // Sanity check: Ensure no accidental prompt or user text is stored
    const record = {
      timestamp,
      modelId,
      configVersion,
      latencyMs: Number(latencyMs) || 0,
      success: Boolean(success),
      failureType: failureType || null,
      fallbackActivated: Boolean(fallbackActivated)
    };

    this.telemetryRecords.push(record);
    return record;
  }

  /**
   * Aggregates telemetry across selectable filters and time window
   * @param {Object} query Query options
   * @param {Object} actor Authenticated user context
   * @returns {Object} Aggregated dashboard metrics
   */
  getDashboardMetrics(query = {}, actor = {}) {
    // Access control: Restricted to maintainer
    if (!actor || actor.role !== 'MAINTAINER') {
      throw new Error('Access denied: AI Operations Dashboard requires MAINTAINER privileges');
    }

    const {
      window = TELEMETRY_WINDOWS.TWENTY_FOUR_HOURS,
      modelId = null,
      configVersion = null,
      now = Date.now()
    } = query;

    let windowMs = 24 * 60 * 60 * 1000;
    if (window === TELEMETRY_WINDOWS.ONE_HOUR) windowMs = 60 * 60 * 1000;
    if (window === TELEMETRY_WINDOWS.SEVEN_DAYS) windowMs = 7 * 24 * 60 * 60 * 1000;

    const windowStart = now - windowMs;

    let filtered = this.telemetryRecords.filter(r => r.timestamp >= windowStart);

    if (modelId) {
      filtered = filtered.filter(r => r.modelId === modelId);
    }
    if (configVersion) {
      filtered = filtered.filter(r => r.configVersion === configVersion);
    }

    const totalRequests = filtered.length;
    const isLowVolume = totalRequests < MIN_TELEMETRY_SAMPLE_THRESHOLD;

    const latencies = filtered.map(r => r.latencyMs);
    const percentiles = calculateLatencyPercentiles(latencies);

    let providerErrors = 0;
    let localRejections = 0;
    let fallbackCount = 0;
    let successfulCount = 0;

    for (const r of filtered) {
      if (r.success) successfulCount++;
      if (r.fallbackActivated) fallbackCount++;
      if (r.failureType === FAILURE_TYPES.PROVIDER_ERROR || r.failureType === FAILURE_TYPES.PROVIDER_TIMEOUT) {
        providerErrors++;
      }
      if (r.failureType === FAILURE_TYPES.LOCAL_VALIDATION_REJECTION || r.failureType === FAILURE_TYPES.BUDGET_EXHAUSTION) {
        localRejections++;
      }
    }

    const errorRate = totalRequests > 0
      ? Math.round(((providerErrors + localRejections) / totalRequests) * 100) / 100
      : 0;

    const fallbackRate = totalRequests > 0
      ? Math.round((fallbackCount / totalRequests) * 100) / 100
      : 0;

    return {
      window,
      totalRequests,
      isLowVolume,
      lowVolumeWarning: isLowVolume ? `Sample size (${totalRequests}) is below threshold of ${MIN_TELEMETRY_SAMPLE_THRESHOLD}; percentiles may vary.` : null,
      percentiles,
      breakdown: {
        successfulRequests: successfulCount,
        providerErrors,
        localValidationRejections: localRejections,
        fallbackInvocations: fallbackCount
      },
      errorRate,
      fallbackRate,
      timestamp: now
    };
  }
}
