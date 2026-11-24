/**
 * src/data/civicAgentCostCarbonConstants.js
 *
 * Versioned schema, enums, error codes, storage keys, model rate table and
 * carbon/energy estimation factors for the Civic Agent Cost and Carbon Budget
 * Governor (#1185).
 *
 * All cost/energy/carbon figures are ESTIMATES unless a provider returns
 * verified billing metadata. Estimates are derived from token counts and
 * published model pricing; they are labelled `estimated: true` and are never
 * presented as an invoice.
 */

export const CIVIC_AGENT_COST_CARBON_SCHEMA_VERSION = 1;
export const CIVIC_AGENT_COST_CARBON_STORAGE_KEY = 'civicbridge_agent_cost_carbon_budget_v1';
export const CIVIC_AGENT_COST_CARBON_REVIEW_DATE = '2026-11-24';
export const CIVIC_AGENT_COST_CARBON_STALE_AFTER_DAYS = 90;
export const CIVIC_AGENT_COST_CARBON_DISCLAIMER =
  'Cost, energy and carbon figures are estimates only, derived from token counts ' +
  'and published model pricing. They are not a bill and do not include provider ' +
  'taxes, surcharges or committed-use discounts. Provider billing metadata, when ' +
  'absent, is filled with estimates and flagged as a billing metadata gap.';

export const COST_CARBON_STATUS = Object.freeze({
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  STOPPED: 'stopped',
  FALLBACK: 'fallback',
  BLOCKED: 'blocked',
  FAILED: 'failed',
});

export const COST_CARBON_ERRORS = Object.freeze({
  INVALID_REQUEST: 'CC_INVALID_REQUEST',
  INVALID_TYPE: 'CC_INVALID_TYPE',
  POLICY_NOT_FOUND: 'CC_POLICY_NOT_FOUND',
  RUN_NOT_FOUND: 'CC_RUN_NOT_FOUND',
  WORKFLOW_NOT_FOUND: 'CC_WORKFLOW_NOT_FOUND',
  BUDGET_EXCEEDED: 'CC_BUDGET_EXCEEDED',
  STOP_CONDITION_TRIGGERED: 'CC_STOP_CONDITION_TRIGGERED',
  VALIDATION_FAILED: 'CC_VALIDATION_FAILED',
  BILLING_METADATA_GAP: 'CC_BILLING_METADATA_GAP',
  RUNWAY_LOOP_SUSPECTED: 'CC_RUNWAY_LOOP_SUSPECTED',
  PERMISSION_DENIED: 'CC_PERMISSION_DENIED',
  RESOURCE_LIMIT_EXCEEDED: 'CC_RESOURCE_LIMIT_EXCEEDED',
  STORAGE_UNAVAILABLE: 'CC_STORAGE_UNAVAILABLE',
  CONCURRENT_WRITE: 'CC_CONCURRENT_WRITE',
  STALE_DATA: 'CC_STALE_DATA',
});

export const RUNWAY_LOOP_ERRORS = Object.freeze({
  RAPID_REPEAT_CALLS: 'CC_RAPID_REPEAT_CALLS',
  SAME_MODEL_SAME_INPUT: 'CC_SAME_MODEL_SAME_INPUT',
  CALLS_PER_MINUTE_EXCEEDED: 'CC_CALLS_PER_MINUTE_EXCEEDED',
});

export const CALL_SOURCE = Object.freeze({
  LLM: 'llm',
  DETERMINISTIC: 'deterministic',
  FALLBACK: 'fallback',
  CACHE: 'cache',
});

export const DEFAULT_COST_CARBON_POLICY = Object.freeze({
  id: 'default-civic-agent-budget-v1',
  name: 'Default civic agent cost & carbon budget',
  version: CIVIC_AGENT_COST_CARBON_SCHEMA_VERSION,
  description: 'Per-workflow cost, token, latency and estimated carbon budget.',
  maxTotalCostUSD: 5.00,
  maxTotalTokens: 50000,
  maxTotalLatencyMs: 60000,
  maxEstimatedCarbonGCO2e: 1000,
  maxCostPerCallUSD: 0.50,
  maxTokensPerCall: 4000,
  maxLatencyPerCallMs: 10000,
  maxCallsPerRun: 50,
  maxCallsPerMinute: 30,
  enableCarbonEstimates: true,
  carbonIntensityGCO2ePerKWh: 470, // grid average estimate (gCO2e/kWh)
  estimatedEnergyKWhPer1kTokens: 0.002, // estimated kWh per 1k tokens
  fallbackModel: 'deterministic-rules-v1',
  requireHumanApprovalForHighImpact: true,
  stopOnBudgetExceeded: true,
  routeToFallbackOnBudgetExceeded: true,
  allowRetryOnBillingMetadataGap: false,
  disclaimer: CIVIC_AGENT_COST_CARBON_DISCLAIMER,
  createdBy: 'system',
  createdAt: CIVIC_AGENT_COST_CARBON_REVIEW_DATE,
  updatedAt: CIVIC_AGENT_COST_CARBON_REVIEW_DATE,
});

/**
 * Estimated model pricing (USD per 1,000 tokens) and energy factors.
 * These are illustrative estimates, not provider quotes. Providers change
 * pricing; operators must review and update this table before production use.
 * Every entry carries `estimated: true`.
 */
export const MODEL_RATE_TABLE = Object.freeze({
  'gpt-4o-mini': {
    provider: 'openai',
    inputCostUSDPer1kTokens: 0.00015,
    outputCostUSDPer1kTokens: 0.0006,
    estimatedEnergyKWhPer1kTokens: 0.0018,
    estimated: true,
    notes: 'Illustrative estimate; verify against current provider pricing.',
  },
  'gpt-4o': {
    provider: 'openai',
    inputCostUSDPer1kTokens: 0.0025,
    outputCostUSDPer1kTokens: 0.010,
    estimatedEnergyKWhPer1kTokens: 0.004,
    estimated: true,
    notes: 'Illustrative estimate; verify against current provider pricing.',
  },
  'claude-3-haiku': {
    provider: 'anthropic',
    inputCostUSDPer1kTokens: 0.00025,
    outputCostUSDPer1kTokens: 0.00125,
    estimatedEnergyKWhPer1kTokens: 0.0015,
    estimated: true,
    notes: 'Illustrative estimate; verify against current provider pricing.',
  },
  'claude-3-sonnet': {
    provider: 'anthropic',
    inputCostUSDPer1kTokens: 0.003,
    outputCostUSDPer1kTokens: 0.015,
    estimatedEnergyKWhPer1kTokens: 0.003,
    estimated: true,
    notes: 'Illustrative estimate; verify against current provider pricing.',
  },
  'deterministic-rules-v1': {
    provider: 'local',
    inputCostUSDPer1kTokens: 0,
    outputCostUSDPer1kTokens: 0,
    estimatedEnergyKWhPer1kTokens: 0.00005,
    estimated: true,
    notes: 'Deterministic local fallback; near-zero cost and energy.',
  },
});

export function getModelRate(modelId) {
  return MODEL_RATE_TABLE[modelId] || {
    provider: 'unknown',
    inputCostUSDPer1kTokens: 0,
    outputCostUSDPer1kTokens: 0,
    estimatedEnergyKWhPer1kTokens: 0.002,
    estimated: true,
    notes: 'Unknown model; conservative default estimate applied.',
  };
}

/** Rough token estimate: ~4 characters per token when provider metadata is missing. */
export const CHARS_PER_TOKEN_ESTIMATE = 4;

/** Carbon intensity default when no grid figure is configured (gCO2e/kWh). */
export const DEFAULT_CARBON_INTENSITY_GCO2E_PER_KWH = 470;

export const MAX_INPUT_BYTES = 64 * 1024;
export const MAX_CONCURRENT_RUNS = 20;
export const MAX_RUNS_PER_WORKFLOW = 200;
export const POLICY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const WORKFLOW_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const RUN_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const SENSITIVE_KEY_PATTERN =
  /(password|passwd|otp|one.?time|\btoken\b|secret|credential|api.?key|private.?key|aadhaar.?number|aadhaar.?no|pan.?number|document.?content|file.?content|file.?data|base64|biometric|passphrase|authorization|salary|income.?amount|mobile.?number|phone.?number)/i;

export const AADHAAR_NUMBER_PATTERN = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
export const PAN_NUMBER_PATTERN = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/;
export const OTP_PATTERN = /\b(?:otp|one[- ]time password)\b\s*[:#-]?\s*\d{4,8}\b/i;

export const __testables = {
  getModelRate,
  CIVIC_AGENT_COST_CARBON_SCHEMA_VERSION,
  DEFAULT_COST_CARBON_POLICY,
  MODEL_RATE_TABLE,
  CHARS_PER_TOKEN_ESTIMATE,
  DEFAULT_CARBON_INTENSITY_GCO2E_PER_KWH,
};
