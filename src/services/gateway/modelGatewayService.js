/**
 * Civic Model Gateway Service Façade (#1153)
 * Orchestrates Validation, Guardrails, Residency Routing, Circuit-Breaker Execution,
 * Post-Synthesis Entailment Verification, and Telemetry.
 */

import {
  validateGatewayRequest,
  createGatewayResponse,
  TASK_RISK,
  GATEWAY_ERROR_CODES,
} from './gatewayTypes.js';
import { modelRouter } from './modelRouter.js';
import { circuitBreaker } from './circuitBreaker.js';
import {
  estimateTokens,
  calculateEstimatedCostINR,
  recordGatewayTelemetry,
} from './gatewayTelemetry.js';
import {
  runPreInferenceGuardrails,
  evaluateGroundedAnswerEntailment,
  stripRedactionPlaceholders,
} from '../../ai/aiGuardrailPipeline.js';

export const MANDATORY_GATEWAY_DISCLAIMER =
  'Notice: This guidance is strictly for informational civic assistance and generated under verified source constraints. It does not constitute legal advice or an official government eligibility decision.';

/**
 * Executes a model request through the Civic Model Gateway.
 *
 * @param {Object} request
 * @param {string} request.query - Citizen inquiry
 * @param {string} [request.residencyTier] - Explicit residency tier
 * @param {string} [request.taskRisk=TASK_RISK.LOW] - Risk classification
 * @param {string} [request.language='en'] - Citizen language code
 * @param {string} [request.categoryId] - Domain category
 * @param {number} [request.timeoutMs=4500] - Timeout limit in milliseconds
 * @param {number} [request.latencySLA] - Latency SLA in ms
 * @param {Object} [options]
 * @returns {Promise<Object>} Standardized Gateway Response
 */
export async function executeModelGateway(request, options = {}) {
  const startTime = Date.now();

  // 1. Boundary Input Validation
  const validation = validateGatewayRequest(request);
  if (!validation.valid) {
    return createGatewayResponse({
      status: 'error',
      data: {
        title: 'Invalid Request',
        summary: validation.errors.join('; '),
      },
      fallbackTriggered: true,
      fallbackReason: GATEWAY_ERROR_CODES.INVALID_REQUEST,
      disclaimer: MANDATORY_GATEWAY_DISCLAIMER,
    });
  }

  // 2. Pre-Inference Guardrails: PII scrubbing & Prompt-Injection defense
  const preGuardrail = runPreInferenceGuardrails(request.query || '', {
    disclaimer: MANDATORY_GATEWAY_DISCLAIMER,
  });

  if (preGuardrail.decision === 'block') {
    const latencyMs = Date.now() - startTime;
    return createGatewayResponse({
      status: 'blocked',
      data: preGuardrail.blockedResponse.data,
      officialSources: preGuardrail.blockedResponse.data?.officialSources || [],
      suggestions: preGuardrail.blockedResponse.suggestions || [],
      latencyMs,
      guardrail: {
        decision: preGuardrail.decision,
        pii: preGuardrail.pii,
        injection: preGuardrail.injection,
      },
      disclaimer: MANDATORY_GATEWAY_DISCLAIMER,
    });
  }

  const sanitizedQuery = preGuardrail.sanitizedQuery;
  const piiScrubbed = preGuardrail.decision === 'allow' || preGuardrail.decision === 'redact_and_allow';

  // 3. Multi-Criteria Residency & Model Routing
  const routing = modelRouter.route({
    requestedTier: request.residencyTier,
    taskRisk: request.taskRisk || TASK_RISK.LOW,
    language: request.language || 'en',
    categoryId: request.categoryId,
    piiScrubbed,
    latencySLA: request.latencySLA,
  });

  const primaryAdapter = routing.primaryAdapter;
  const fallbackAdapter = routing.fallbackAdapter;
  const adapterMeta = primaryAdapter.getMetadata();

  const payload = {
    query: request.query,
    sanitizedQuery,
    cleanQuery: stripRedactionPlaceholders(sanitizedQuery),
    language: request.language || 'en',
    categoryId: request.categoryId,
    piiScrubbed,
  };

  const timeoutMs = request.timeoutMs || 4500;
  let fallbackOccurred = false;
  let fallbackReason = null;
  let activeAdapterMeta = adapterMeta;

  // 4. Circuit Breaker Protected Execution
  let rawResult;
  try {
    rawResult = await circuitBreaker.execute(
      adapterMeta.id,
      async () => {
        return await primaryAdapter.generate(payload, { timeoutMs, ...options });
      },
      async (fallbackContext) => {
        fallbackOccurred = true;
        fallbackReason = fallbackContext.fallbackReason;
        activeAdapterMeta = fallbackAdapter.getMetadata();
        return await fallbackAdapter.generate(payload, {
          fallbackReason: fallbackContext.fallbackReason,
          ...options,
        });
      },
      { timeoutMs }
    );
  } catch (unexpectedError) {
    fallbackOccurred = true;
    fallbackReason = unexpectedError.message;
    activeAdapterMeta = fallbackAdapter.getMetadata();
    rawResult = await fallbackAdapter.generate(payload, {
      fallbackReason: unexpectedError.message,
      ...options,
    });
  }

  const latencyMs = Date.now() - startTime;

  // 5. Token Estimation and Cost Accounting
  const promptTokens = estimateTokens(sanitizedQuery);
  const completionTokens = estimateTokens(rawResult?.data?.summary || '');
  const totalTokens = promptTokens + completionTokens;
  const estimatedCostINR = calculateEstimatedCostINR(
    fallbackOccurred ? 'local-browser' : activeAdapterMeta.costRateKey,
    totalTokens
  );

  // 6. Post-Synthesis Entailment Verification
  let entailmentMeta = null;
  if (rawResult?.grounded && rawResult?.data?.summary) {
    const evidenceChunks = rawResult.citations || [];
    entailmentMeta = evaluateGroundedAnswerEntailment(
      sanitizedQuery,
      rawResult.data.summary,
      evidenceChunks
    );
  }

  // 7. Telemetry Recording
  recordGatewayTelemetry({
    adapterType: activeAdapterMeta.type,
    modelName: activeAdapterMeta.name,
    residencyTier: routing.effectiveTier,
    routingReason: routing.routingReason,
    latencyMs,
    tokenUsage: { promptTokens, completionTokens, totalTokens },
    estimatedCostINR,
    fallbackTriggered: fallbackOccurred,
    fallbackReason,
  });

  // 8. Assemble Envelope
  return createGatewayResponse({
    status: rawResult?.status || 'success',
    data: rawResult?.data,
    adapterType: activeAdapterMeta.type,
    modelName: activeAdapterMeta.name,
    residencyTier: routing.effectiveTier,
    routingReason: routing.routingReason,
    fallbackTriggered: fallbackOccurred,
    fallbackReason,
    latencyMs,
    tokenUsage: { promptTokens, completionTokens, totalTokens },
    estimatedCostINR,
    officialSources: rawResult?.officialSources || rawResult?.data?.officialSources || [],
    suggestions: rawResult?.suggestions || [],
    serviceId: rawResult?.serviceId || null,
    guardrail: {
      decision: preGuardrail.decision,
      pii: preGuardrail.pii,
      injection: preGuardrail.injection,
    },
    entailment: entailmentMeta,
    disclaimer: MANDATORY_GATEWAY_DISCLAIMER,
  });
}
