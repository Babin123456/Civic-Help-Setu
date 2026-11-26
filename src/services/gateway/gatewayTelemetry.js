/**
 * Gateway Telemetry and Cost Accounting Engine
 * Tracks token usage, latency, and costs securely without persisting raw citizen PII.
 */

const MAX_LOG_SIZE = 100;
const inMemoryLogs = [];

// Estimated cost rates per 1,000 tokens (converted to INR at approximate benchmark rates)
export const PROVIDER_RATES_INR_PER_1K = Object.freeze({
  'local-browser': 0.0, // Local WASM / Catalog is zero marginal cost
  'sovereign-domestic': 0.05, // e.g. national edge inference tier
  'external-frontier': 0.25, // external commercial API
});

/**
 * Estimates prompt and completion tokens conservatively (heuristic 1 token ~= 4 chars).
 *
 * @param {string} text
 * @returns {number}
 */
export function estimateTokens(text) {
  if (!text || typeof text !== 'string') return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

/**
 * Calculates estimated cost in INR for a given provider and token count.
 *
 * @param {string} providerKey
 * @param {number} totalTokens
 * @returns {number}
 */
export function calculateEstimatedCostINR(providerKey, totalTokens) {
  const rate = PROVIDER_RATES_INR_PER_1K[providerKey] || 0.0;
  return Number(((totalTokens / 1000) * rate).toFixed(4));
}

/**
 * Records a gateway interaction event into safe telemetry.
 *
 * @param {Object} event
 */
export function recordGatewayTelemetry(event) {
  if (!event || typeof event !== 'object') return;

  const safeEvent = {
    id: event.id || `gtw-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    adapterType: event.adapterType || 'unknown',
    modelName: event.modelName || 'unknown',
    residencyTier: event.residencyTier || 'unknown',
    routingReason: event.routingReason || 'unknown',
    latencyMs: typeof event.latencyMs === 'number' ? event.latencyMs : 0,
    promptTokens: event.tokenUsage?.promptTokens || 0,
    completionTokens: event.tokenUsage?.completionTokens || 0,
    totalTokens: event.tokenUsage?.totalTokens || 0,
    estimatedCostINR: typeof event.estimatedCostINR === 'number' ? event.estimatedCostINR : 0,
    fallbackTriggered: Boolean(event.fallbackTriggered),
    fallbackReason: event.fallbackReason || null,
    // Note: NEVER include raw user prompt text or PII
  };

  inMemoryLogs.unshift(safeEvent);
  if (inMemoryLogs.length > MAX_LOG_SIZE) {
    inMemoryLogs.pop();
  }
}

/**
 * Returns latest telemetry logs.
 *
 * @param {number} [limit=50]
 * @returns {Array<Object>}
 */
export function getGatewayTelemetryLogs(limit = 50) {
  return inMemoryLogs.slice(0, limit);
}

/**
 * Clears telemetry logs (for testing or privacy reset).
 */
export function clearGatewayTelemetry() {
  inMemoryLogs.length = 0;
}

/**
 * Aggregates summary stats for the Admin Dashboard.
 *
 * @returns {Object}
 */
export function getGatewayMetricsSummary() {
  if (inMemoryLogs.length === 0) {
    return {
      totalRequests: 0,
      fallbackCount: 0,
      fallbackRate: 0,
      avgLatencyMs: 0,
      totalTokens: 0,
      totalCostINR: 0,
      tierDistribution: {},
    };
  }

  let totalLatency = 0;
  let totalTokens = 0;
  let totalCost = 0;
  let fallbackCount = 0;
  const tierDistribution = {};

  for (const log of inMemoryLogs) {
    totalLatency += log.latencyMs;
    totalTokens += log.totalTokens;
    totalCost += log.estimatedCostINR;
    if (log.fallbackTriggered) fallbackCount += 1;

    tierDistribution[log.residencyTier] = (tierDistribution[log.residencyTier] || 0) + 1;
  }

  const count = inMemoryLogs.length;

  return {
    totalRequests: count,
    fallbackCount,
    fallbackRate: Number(((fallbackCount / count) * 100).toFixed(1)),
    avgLatencyMs: Math.round(totalLatency / count),
    totalTokens,
    totalCostINR: Number(totalCost.toFixed(4)),
    tierDistribution,
  };
}
