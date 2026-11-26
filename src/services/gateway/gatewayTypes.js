/**
 * Civic Model Gateway Type Definitions & Validation Contracts
 * Enforces typed boundaries, input validation, and residency compliance.
 */

export const GATEWAY_CONTRACT_VERSION = '1.0.0';

export const RESIDENCY_TIER = Object.freeze({
  LOCAL_ONLY: 'local_only',
  SOVEREIGN_DOMESTIC: 'sovereign_domestic',
  CROSS_BORDER_SCRUBBED: 'cross_border_scrubbed',
});

export const TASK_RISK = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
});

export const CIRCUIT_STATE = Object.freeze({
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN',
});

export const ADAPTER_TYPE = Object.freeze({
  LOCAL_BROWSER: 'local_browser',
  SOVEREIGN_CLOUD: 'sovereign_cloud',
  EXTERNAL_PROVIDER: 'external_provider',
  DETERMINISTIC_FALLBACK: 'deterministic_fallback',
});

export const GATEWAY_ERROR_CODES = Object.freeze({
  RESIDENCY_POLICY_VIOLATION: 'RESIDENCY_POLICY_VIOLATION',
  CIRCUIT_BREAKER_OPEN: 'CIRCUIT_BREAKER_OPEN',
  TIMEOUT_EXCEEDED: 'TIMEOUT_EXCEEDED',
  ADAPTER_FAILURE: 'ADAPTER_FAILURE',
  INVALID_REQUEST: 'INVALID_REQUEST',
  UNVERIFIED_CLAIM_BLOCKED: 'UNVERIFIED_CLAIM_BLOCKED',
});

/**
 * Validates a gateway request payload at service boundary.
 *
 * @param {Object} request - Incoming request
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateGatewayRequest(request) {
  const errors = [];

  if (!request || typeof request !== 'object') {
    return { valid: false, errors: ['Request must be a non-null object'] };
  }

  if (!request.query || typeof request.query !== 'string' || !request.query.trim()) {
    errors.push('Request query must be a non-empty string');
  }

  if (request.residencyTier && !Object.values(RESIDENCY_TIER).includes(request.residencyTier)) {
    errors.push(`Invalid residencyTier: "${request.residencyTier}". Must be one of: ${Object.values(RESIDENCY_TIER).join(', ')}`);
  }

  if (request.taskRisk && !Object.values(TASK_RISK).includes(request.taskRisk)) {
    errors.push(`Invalid taskRisk: "${request.taskRisk}". Must be one of: ${Object.values(TASK_RISK).join(', ')}`);
  }

  if (request.contractVersion !== undefined && typeof request.contractVersion !== 'string') {
    errors.push('contractVersion must be a string if provided');
  }

  if (request.timeoutMs !== undefined && (typeof request.timeoutMs !== 'number' || request.timeoutMs <= 0)) {
    errors.push('timeoutMs must be a positive number if provided');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Creates a standardized Gateway response envelope.
 *
 * @param {Object} params - Response components
 * @returns {Object}
 */
export function createGatewayResponse({
  status = 'success',
  data = null,
  adapterType = ADAPTER_TYPE.LOCAL_BROWSER,
  modelName = 'local-catalog-engine',
  residencyTier = RESIDENCY_TIER.LOCAL_ONLY,
  routingReason = 'default_local',
  fallbackTriggered = false,
  fallbackReason = null,
  latencyMs = 0,
  tokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
  estimatedCostINR = 0,
  disclaimer = 'Notice: This guidance is strictly for informational civic assistance. It does not constitute legal advice or an official government eligibility decision.',
  officialSources = [],
  suggestions = [],
  serviceId = null,
  guardrail = null,
  entailment = null,
} = {}) {
  return {
    status,
    data,
    meta: {
      contractVersion: GATEWAY_CONTRACT_VERSION,
      adapterType,
      modelName,
      residencyTier,
      routingReason,
      fallbackTriggered,
      fallbackReason,
      latencyMs,
      tokenUsage,
      estimatedCostINR,
      timestamp: new Date().toISOString(),
    },
    serviceId,
    officialSources,
    suggestions,
    disclaimer,
    guardrail,
    entailment,
  };
}
