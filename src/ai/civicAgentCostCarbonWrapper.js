/**
 * src/ai/civicAgentCostCarbonWrapper.js
 *
 * Wraps AI/provider calls with the Civic Agent Cost and Carbon Budget Governor
 * (#1185). Provides estimate-before-call, record-after-call, fallback routing
 * to cheaper deterministic fallbacks, and transparent provenance.
 *
 * Design rules:
 *  - Estimate cost/tokens/energy/carbon BEFORE the call; fail closed if the
 *    estimate exceeds budget.
 *  - Record actual usage AFTER the call; stop the run if cumulative budget is
 *    exceeded or a stop condition is triggered.
 *  - Route to a deterministic (non-AI) fallback when budget is exhausted or a
 *    runaway loop is suspected.
 *  - AI outputs are untrusted suggestions carrying provenance; never
 *    autonomously file applications or deny benefits.
 *  - No sensitive prompts, citizen records, credentials or raw documents are
 *    logged or persisted (prompt is hashed; only length is stored).
 */

import { createCostCarbonGovernor } from '../services/civicAgentCostCarbonGovernor.js';
import { CALL_SOURCE, COST_CARBON_STATUS, DEFAULT_COST_CARBON_POLICY } from '../data/civicAgentCostCarbonConstants.js';

/**
 * Create a governed AI caller. The `providerCall` is an async function
 * (prompt, options) => Promise<{ text, usage?, latencyMs?, billing? }>.
 *
 * @param {Object} options
 * @param {Function} options.providerCall underlying provider invoker
 * @param {Object} [options.governor] default createCostCarbonGovernor()
 * @param {Object} [options.policy] overrides merged into default policy
 * @param {Function} [options.deterministicFallback] (prompt) => Promise<string>
 * @param {string} [options.workflowId] required workflow id
 * @param {string} [options.policyId]
 * @param {boolean} [options.isHighImpact]
 * @param {boolean} [options.humanApproved]
 * @param {Function} [options.now]
 */
export function createGovernedAICaller({
  providerCall,
  governor = createCostCarbonGovernor(),
  policy = {},
  deterministicFallback,
  workflowId,
  policyId,
  isHighImpact = false,
  humanApproved = false,
  now = Date.now,
} = {}) {
  if (!providerCall || typeof providerCall !== 'function') {
    throw new Error('createGovernedAICaller requires a providerCall function.');
  }
  if (!workflowId) {
    throw new Error('createGovernedAICaller requires a workflowId.');
  }

  const mergedPolicy = { ...DEFAULT_COST_CARBON_POLICY, ...policy };

  /**
   * Execute a single AI call under the governor. Returns a result object with
   * `success`, `output`, `governed` metadata and `fallback` flag.
   */
  async function call({ prompt, modelId, callSource = CALL_SOURCE.LLM, options = {} } = {}) {
    if (typeof prompt !== 'string') {
      return {
        success: false,
        fallback: true,
        governed: true,
        error: { code: 'CC_INVALID_REQUEST', message: 'prompt must be a string.' },
        output: null,
      };
    }

    // 1. Pre-flight estimate against budgets.
    const preflight = await governor.preflightCall({
      workflowId,
      modelId,
      prompt,
      inputTokens: options.inputTokens,
      callSource,
      isHighImpact,
      humanApproved,
      policyId,
      nowIso: now ? new Date(now()).toISOString() : undefined,
    });

    if (!preflight.allowed) {
      // Route to deterministic fallback if configured and allowed by policy.
      if (mergedPolicy.routeToFallbackOnBudgetExceeded && deterministicFallback) {
        try {
          const output = await deterministicFallback(prompt);
          return {
            success: true,
            output,
            fallback: true,
            governed: true,
            reason: preflight.reason,
            code: preflight.code,
            estimate: preflight.estimate,
            policy: preflight.policy,
            disclaimer: DEFAULT_COST_CARBON_POLICY.disclaimer,
          };
        } catch (fallbackErr) {
          return {
            success: false,
            fallback: true,
            governed: true,
            error: { code: 'CC_FALLBACK_FAILED', message: String(fallbackErr) },
            output: null,
            reason: preflight.reason,
            code: preflight.code,
            estimate: preflight.estimate,
          };
        }
      }
      return {
        success: false,
        fallback: false,
        governed: true,
        error: { code: preflight.code || 'CC_BUDGET_EXCEEDED', message: preflight.reason },
        output: null,
        estimate: preflight.estimate,
        policy: preflight.policy,
        disclaimer: DEFAULT_COST_CARBON_POLICY.disclaimer,
      };
    }

    // 2. Execute the provider call.
    let result;
    let latencyMs;
    let billingMetadata = { verified: false, source: 'estimate' };
    let actualOutputTokens = 0;
    let actualInputTokens = preflight.estimate.inputTokens;

    const startTime = Date.now();
    try {
      result = await providerCall(prompt, {
        modelId,
        ...options,
      });
      latencyMs = Date.now() - startTime;
    } catch (err) {
      // Provider error: try deterministic fallback.
      if (mergedPolicy.routeToFallbackOnBudgetExceeded && deterministicFallback) {
        try {
          const output = await deterministicFallback(prompt);
          return {
            success: true,
            output,
            fallback: true,
            governed: true,
            reason: `Provider call failed: ${String(err)}`,
            code: 'CC_PROVIDER_ERROR',
            estimate: preflight.estimate,
            policy: preflight.policy,
            disclaimer: DEFAULT_COST_CARBON_POLICY.disclaimer,
          };
        } catch (fallbackErr) {
          return {
            success: false,
            fallback: true,
            governed: true,
            error: { code: 'CC_FALLBACK_FAILED', message: String(fallbackErr) },
            output: null,
            reason: `Provider call failed and fallback failed: ${String(err)}`,
            code: 'CC_PROVIDER_ERROR',
            estimate: preflight.estimate,
          };
        }
      }
      return {
        success: false,
        fallback: false,
        governed: true,
        error: { code: 'CC_PROVIDER_ERROR', message: String(err) },
        output: null,
        estimate: preflight.estimate,
        policy: preflight.policy,
      };
    }

    const output = result && typeof result === 'object' ? result.text : String(result);
    if (result && result.usage) {
      actualInputTokens = result.usage.inputTokens != null ? result.usage.inputTokens : actualInputTokens;
      actualOutputTokens = result.usage.outputTokens != null ? result.usage.outputTokens : 0;
      if (result.usage.billing) billingMetadata = { verified: true, source: result.usage.billing.source || 'provider', ...result.usage.billing };
      else billingMetadata = { verified: false, source: 'estimate' };
    } else if (result && result.billing) {
      billingMetadata = { verified: true, source: result.billing.source || 'provider', ...result.billing };
    }

    const effectiveLatency = result && result.latencyMs != null ? result.latencyMs : latencyMs;

    // 3. Record the call (updates totals, checks cumulative budget + stop conditions).
    const record = governor.recordCall({
      runId: options.runId,
      modelId,
      prompt,
      output,
      inputTokens: actualInputTokens,
      outputTokens: actualOutputTokens,
      latencyMs: effectiveLatency,
      callSource,
      billingMetadata,
      isHighImpact,
      nowIso: now ? new Date(now()).toISOString() : undefined,
    });

    if (!record.ok) {
      return {
        success: false,
        fallback: false,
        governed: true,
        error: record.error,
        output: null,
        estimate: preflight.estimate,
        policy: preflight.policy,
      };
    }

    // 4. If stopped by budget/stop condition, surface fallback or block.
    if (record.stopped) {
      if (mergedPolicy.routeToFallbackOnBudgetExceeded && deterministicFallback) {
        try {
          const output = await deterministicFallback(prompt);
          return {
            success: true,
            output,
            fallback: true,
            governed: true,
            reason: record.reason,
            code: record.code,
            estimate: record.estimate,
            policy: preflight.policy,
            runTotals: record.runTotals,
            stopped: true,
            disclaimer: DEFAULT_COST_CARBON_POLICY.disclaimer,
          };
        } catch (fallbackErr) {
          return {
            success: false,
            fallback: true,
            governed: true,
            error: { code: 'CC_FALLBACK_FAILED', message: String(fallbackErr) },
            output: null,
            reason: record.reason,
            code: record.code,
            estimate: record.estimate,
            runTotals: record.runTotals,
            stopped: true,
          };
        }
      }
      return {
        success: false,
        fallback: false,
        governed: true,
        error: { code: record.code || 'CC_BUDGET_EXCEEDED', message: record.reason },
        output: null,
        estimate: record.estimate,
        runTotals: record.runTotals,
        stopped: true,
        policy: preflight.policy,
        disclaimer: DEFAULT_COST_CARBON_POLICY.disclaimer,
      };
    }

    return {
      success: true,
      output,
      fallback: false,
      governed: true,
      estimate: record.estimate,
      runTotals: record.runTotals,
      billingMetadataGap: record.billingMetadataGap,
      runwaySuspected: record.runwaySuspected,
      policy: preflight.policy,
      disclaimer: DEFAULT_COST_CARBON_POLICY.disclaimer,
    };
  }

  /**
   * Start a governed run. Returns { ok, run, policy }.
   */
  function startRun({ modelId, prompt, inputTokens } = {}) {
    return governor.startRun({
      workflowId,
      policyId,
      modelId,
      prompt,
      inputTokens,
      isHighImpact,
      humanApproved,
      callSource: CALL_SOURCE.LLM,
      _now: now ? new Date(now()).toISOString() : undefined,
    });
  }

  /**
   * Stop the current run explicitly.
   */
  function stopRun() {
    // The governor tracks runs by runId; the caller must pass runId via options.runId
    // on each call. We expose stopRun as a no-op here unless runId is known.
    return { ok: false, error: { code: 'CC_NO_RUN_ID', message: 'Pass runId via call options to stop a specific run.' } };
  }

  return {
    call,
    startRun,
    stopRun,
    governor,
    getRun: governor.getRun.bind(governor),
    getWorkflowAggregate: governor.getWorkflowAggregate.bind(governor),
    listPolicies: governor.listPolicies.bind(governor),
    CALL_SOURCE,
    COST_CARBON_STATUS,
    mergedPolicy,
  };
}

export const __testables = {
  createGovernedAICaller,
};
