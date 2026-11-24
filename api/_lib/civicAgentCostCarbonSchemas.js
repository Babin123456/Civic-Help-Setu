/**
 * api/_lib/civicAgentCostCarbonSchemas.js
 *
 * Versioned request/response validation contracts for the Civic Agent Cost and
 * Carbon Budget Governor (#1185). All external input at trust boundaries is
 * validated against the current schema version. Unknown fields are rejected to
 * prevent schema drift and mass-assignment issues.
 */

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MODEL_ID = /^[A-Za-z0-9_.:-]{1,120}$/;
const POSITIVE_INT = (value) => Number.isInteger(value) && value > 0;
const NON_NEG_INT = (value) => Number.isInteger(value) && value >= 0;

const RUN_STATUSES = new Set(['pending', 'running', 'completed', 'stopped', 'fallback', 'blocked', 'failed']);
const SCHEMA_VERSION = 1;

/** Result shape for all validators. */
function ok(value) { return { valid: true, value, errors: [] }; }
function fail(...errors) { return { valid: false, value: null, errors }; }

/**
 * Validate a start-run request.
 * Input: { workflowId, policyId, modelId, prompt, inputTokens, isHighImpact, humanApproved }
 */
export function validateStartRun(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail('Request body must be a non-null JSON object');
  }

  const { workflowId, policyId, modelId, prompt, inputTokens, isHighImpact, humanApproved } = body;

  if (typeof workflowId !== 'string' || !SLUG.test(workflowId)) {
    errors.push('workflowId must be a lowercase slug.');
  }
  if (policyId !== undefined && (typeof policyId !== 'string' || !SLUG.test(policyId))) {
    errors.push('policyId must be a lowercase slug.');
  }
  if (modelId !== undefined && (typeof modelId !== 'string' || !MODEL_ID.test(modelId))) {
    errors.push('modelId must be a string up to 120 characters.');
  }
  if (prompt !== undefined && typeof prompt !== 'string') {
    errors.push('prompt must be a string.');
  }
  if (prompt !== undefined && new TextEncoder().encode(prompt).byteLength > 64 * 1024) {
    errors.push('prompt must be at most 64 KiB.');
  }
  if (inputTokens !== undefined && !NON_NEG_INT(inputTokens)) {
    errors.push('inputTokens must be a non-negative integer.');
  }
  if (isHighImpact !== undefined && typeof isHighImpact !== 'boolean') {
    errors.push('isHighImpact must be a boolean.');
  }
  if (humanApproved !== undefined && typeof humanApproved !== 'boolean') {
    errors.push('humanApproved must be a boolean.');
  }

  return errors.length ? fail(...errors) : ok({ workflowId, policyId, modelId, prompt, inputTokens, isHighImpact, humanApproved });
}

/**
 * Validate a record-call request.
 * Input: { runId, modelId, prompt, output, inputTokens, outputTokens, latencyMs, billingMetadata, isHighImpact }
 */
export function validateRecordCall(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail('Request body must be a non-null JSON object');
  }

  const { runId, modelId, prompt, output, inputTokens, outputTokens, latencyMs, billingMetadata, isHighImpact } = body;

  if (typeof runId !== 'string' || !SLUG.test(runId)) {
    errors.push('runId must be a lowercase slug.');
  }
  if (typeof modelId !== 'string' || !MODEL_ID.test(modelId)) {
    errors.push('modelId must be a string up to 120 characters.');
  }
  if (prompt !== undefined && typeof prompt !== 'string') {
    errors.push('prompt must be a string.');
  }
  if (prompt !== undefined && new TextEncoder().encode(prompt).byteLength > 64 * 1024) {
    errors.push('prompt must be at most 64 KiB.');
  }
  if (output !== undefined && typeof output !== 'string') {
    errors.push('output must be a string.');
  }
  if (inputTokens !== undefined && !NON_NEG_INT(inputTokens)) {
    errors.push('inputTokens must be a non-negative integer.');
  }
  if (outputTokens !== undefined && !NON_NEG_INT(outputTokens)) {
    errors.push('outputTokens must be a non-negative integer.');
  }
  if (latencyMs !== undefined && !NON_NEG_INT(latencyMs)) {
    errors.push('latencyMs must be a non-negative integer.');
  }
  if (billingMetadata !== undefined && (typeof billingMetadata !== 'object' || Array.isArray(billingMetadata) || billingMetadata === null)) {
    errors.push('billingMetadata must be a JSON object.');
  }
  if (isHighImpact !== undefined && typeof isHighImpact !== 'boolean') {
    errors.push('isHighImpact must be a boolean.');
  }

  return errors.length ? fail(...errors) : ok({ runId, modelId, prompt, output, inputTokens, outputTokens, latencyMs, billingMetadata, isHighImpact });
}

/**
 * Validate a stop-run request.
 * Input: { runId, reason }
 */
export function validateStopRun(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail('Request body must be a non-null JSON object');
  }

  const { runId, reason } = body;

  if (typeof runId !== 'string' || !SLUG.test(runId)) {
    errors.push('runId must be a lowercase slug.');
  }
  if (reason !== undefined && (typeof reason !== 'string' || reason.length < 1 || reason.length > 500)) {
    errors.push('reason must be a string between 1 and 500 characters.');
  }

  return errors.length ? fail(...errors) : ok({ runId, reason });
}

/**
 * Validate a policy config request (operator).
 * Input: { id, name, maxTotalCostUSD, maxTotalTokens, maxTotalLatencyMs,
 *          maxEstimatedCarbonGCO2e, maxCostPerCallUSD, maxTokensPerCall,
 *          maxCallsPerRun, maxCallsPerMinute, enableCarbonEstimates,
 *          carbonIntensityGCO2ePerKWh, fallbackModel, requireHumanApprovalForHighImpact,
 *          stopOnBudgetExceeded, routeToFallbackOnBudgetExceeded }
 */
export function validatePolicyConfig(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail('Request body must be a non-null JSON object');
  }

  const {
    id, name, maxTotalCostUSD, maxTotalTokens, maxTotalLatencyMs,
    maxEstimatedCarbonGCO2e, maxCostPerCallUSD, maxTokensPerCall,
    maxCallsPerRun, maxCallsPerMinute, enableCarbonEstimates,
    carbonIntensityGCO2ePerKWh, fallbackModel, requireHumanApprovalForHighImpact,
    stopOnBudgetExceeded, routeToFallbackOnBudgetExceeded,
  } = body;

  if (id !== undefined && (typeof id !== 'string' || !SLUG.test(id))) {
    errors.push('id must be a lowercase slug.');
  }
  if (name !== undefined && (typeof name !== 'string' || name.length < 1 || name.length > 120)) {
    errors.push('name must be a string between 1 and 120 characters.');
  }
  if (maxTotalCostUSD !== undefined && (typeof maxTotalCostUSD !== 'number' || maxTotalCostUSD < 0)) {
    errors.push('maxTotalCostUSD must be a non-negative number.');
  }
  if (maxTotalTokens !== undefined && !POSITIVE_INT(maxTotalTokens)) {
    errors.push('maxTotalTokens must be a positive integer.');
  }
  if (maxTotalLatencyMs !== undefined && !POSITIVE_INT(maxTotalLatencyMs)) {
    errors.push('maxTotalLatencyMs must be a positive integer.');
  }
  if (maxEstimatedCarbonGCO2e !== undefined && (typeof maxEstimatedCarbonGCO2e !== 'number' || maxEstimatedCarbonGCO2e < 0)) {
    errors.push('maxEstimatedCarbonGCO2e must be a non-negative number.');
  }
  if (maxCostPerCallUSD !== undefined && (typeof maxCostPerCallUSD !== 'number' || maxCostPerCallUSD < 0)) {
    errors.push('maxCostPerCallUSD must be a non-negative number.');
  }
  if (maxTokensPerCall !== undefined && !POSITIVE_INT(maxTokensPerCall)) {
    errors.push('maxTokensPerCall must be a positive integer.');
  }
  if (maxCallsPerRun !== undefined && !POSITIVE_INT(maxCallsPerRun)) {
    errors.push('maxCallsPerRun must be a positive integer.');
  }
  if (maxCallsPerMinute !== undefined && !POSITIVE_INT(maxCallsPerMinute)) {
    errors.push('maxCallsPerMinute must be a positive integer.');
  }
  if (enableCarbonEstimates !== undefined && typeof enableCarbonEstimates !== 'boolean') {
    errors.push('enableCarbonEstimates must be a boolean.');
  }
  if (carbonIntensityGCO2ePerKWh !== undefined && (typeof carbonIntensityGCO2ePerKWh !== 'number' || carbonIntensityGCO2ePerKWh < 0)) {
    errors.push('carbonIntensityGCO2ePerKWh must be a non-negative number.');
  }
  if (fallbackModel !== undefined && (typeof fallbackModel !== 'string' || !SLUG.test(fallbackModel))) {
    errors.push('fallbackModel must be a lowercase slug.');
  }
  if (requireHumanApprovalForHighImpact !== undefined && typeof requireHumanApprovalForHighImpact !== 'boolean') {
    errors.push('requireHumanApprovalForHighImpact must be a boolean.');
  }
  if (stopOnBudgetExceeded !== undefined && typeof stopOnBudgetExceeded !== 'boolean') {
    errors.push('stopOnBudgetExceeded must be a boolean.');
  }
  if (routeToFallbackOnBudgetExceeded !== undefined && typeof routeToFallbackOnBudgetExceeded !== 'boolean') {
    errors.push('routeToFallbackOnBudgetExceeded must be a boolean.');
  }

  return errors.length ? fail(...errors) : ok({
    id, name, maxTotalCostUSD, maxTotalTokens, maxTotalLatencyMs,
    maxEstimatedCarbonGCO2e, maxCostPerCallUSD, maxTokensPerCall,
    maxCallsPerRun, maxCallsPerMinute, enableCarbonEstimates,
    carbonIntensityGCO2ePerKWh, fallbackModel, requireHumanApprovalForHighImpact,
    stopOnBudgetExceeded, routeToFallbackOnBudgetExceeded,
  });
}

/**
 * Validate a list/query request.
 * Input: { workflowId, status, limit, cursor }
 */
export function validateListQuery(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail('Request body must be a non-null JSON object');
  }

  const { workflowId, status, limit, cursor } = body;

  if (workflowId !== undefined && (typeof workflowId !== 'string' || !SLUG.test(workflowId))) {
    errors.push('workflowId must be a lowercase slug.');
  }
  if (status !== undefined && !RUN_STATUSES.has(status)) {
    errors.push(`status must be one of ${[...RUN_STATUSES].join(', ')}.`);
  }
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 100)) {
    errors.push('limit must be an integer between 1 and 100.');
  }
  if (cursor !== undefined && typeof cursor !== 'string') {
    errors.push('cursor must be a string.');
  }

  return errors.length ? fail(...errors) : ok({ workflowId, status, limit, cursor });
}

/**
 * Current schema version exposed to clients.
 */
export function schemaVersion() {
  return SCHEMA_VERSION;
}
