/**
 * src/services/civicAgentCostCarbonGovernor.js
 *
 * Civic Agent Cost and Carbon Budget Governor (#1185).
 *
 * Tracks per-workflow model calls, tokens, latency and estimated energy/carbon;
 * enforces budgets and stop conditions; routes to cheaper deterministic
 * fallbacks; exposes transparent estimates; detects runaway loops and provider
 * billing metadata gaps.
 *
 * Design rules:
 *  - Deterministic rules outside LLM prompts; AI outputs are untrusted
 *    suggestions carrying provenance.
 *  - Explicit human approval required for high-impact actions.
 *  - Never autonomously file applications, deny benefits or claim official
 *    verification.
 *  - Aggregated metadata only. No citizen records, credentials, raw documents
 *    or sensitive prompts are logged or persisted.
 *  - Fail closed: on invalid input, missing policy, budget breach or stop
 *    condition, the governor returns a deterministic verdict rather than
 *    executing the call.
 */

import {
  CIVIC_AGENT_COST_CARBON_SCHEMA_VERSION,
  CIVIC_AGENT_COST_CARBON_DISCLAIMER,
  COST_CARBON_STATUS,
  COST_CARBON_ERRORS,
  CALL_SOURCE,
  DEFAULT_COST_CARBON_POLICY,
  MODEL_RATE_TABLE,
  getModelRate,
  CHARS_PER_TOKEN_ESTIMATE,
  DEFAULT_CARBON_INTENSITY_GCO2E_PER_KWH,
  SENSITIVE_KEY_PATTERN,
  AADHAAR_NUMBER_PATTERN,
  PAN_NUMBER_PATTERN,
  OTP_PATTERN,
  MAX_INPUT_BYTES,
  MAX_CONCURRENT_RUNS,
  MAX_RUNS_PER_WORKFLOW,
  POLICY_SLUG_PATTERN,
} from '../data/civicAgentCostCarbonConstants.js';
import {
  loadCostCarbonStore,
  ensureCostCarbonStore,
  runCostCarbonTransaction,
  buildCostCarbonIndexes,
  isWorkflowId,
  isRunId,
} from './civicAgentCostCarbonMigrations.js';
import { logDiagnostic } from '../utils/diagnostics.js';

const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isSlug = (value) =>
  typeof value === 'string' && value.length > 0 && value.length <= 120 && POLICY_SLUG_PATTERN.test(value);

function estimateTokensFromChars(text = '') {
  return Math.max(0, Math.ceil(String(text).length / CHARS_PER_TOKEN_ESTIMATE));
}

function estimateCostUSD(tokens, rate) {
  return Number((tokens / 1000) * (rate || 0)).toFixed(6);
}

function estimateEnergyKWh(tokens, energyPer1kTokens) {
  return Number((tokens / 1000) * (energyPer1kTokens || 0)).toFixed(9);
}

function estimateCarbonGCO2e(energyKWh, carbonIntensity) {
  return Number(energyKWh * (carbonIntensity || DEFAULT_CARBON_INTENSITY_GCO2E_PER_KWH)).toFixed(6);
}

function containsSensitive(value, path = '', depth = 0, found = []) {
  if (depth > 8) return found;
  if (Array.isArray(value)) {
    value.forEach((item, index) => containsSensitive(item, `${path}[${index}]`, depth + 1, found));
    return found;
  }
  if (typeof value === 'string') {
    if (AADHAAR_NUMBER_PATTERN.test(value)) found.push(`${path}: aadhaar-like number`);
    else if (PAN_NUMBER_PATTERN.test(value)) found.push(`${path}: pan-like number`);
    else if (OTP_PATTERN.test(value)) found.push(`${path}: otp-like value`);
    return found;
  }
  if (isObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) found.push(`${path ? `${path}.` : ''}${key}: sensitive key`);
      containsSensitive(child, path ? `${path}.${key}` : key, depth + 1, found);
    }
  }
  return found;
}

function nowIso() {
  return new Date().toISOString();
}

/**
 * Create the governor backed by a cost-carbon store. The store layer is
 * dependency-injected so the governor is fully testable without localStorage.
 *
 * @param {Object} options
 * @param {Function} [options.loadStore] default loadCostCarbonStore
 * @param {Function} [options.runTransaction] default runCostCarbonTransaction
 * @param {Function} [options.logDiagnostic] default logDiagnostic
 */
export function createCostCarbonGovernor({
  loadStore = loadCostCarbonStore,
  runTransaction = runCostCarbonTransaction,
  logDiagnostic: log = logDiagnostic,
} = {}) {
  const activeRuns = new Map(); // runId => { startedAt, concurrencySlot }

  /**
   * Validate a governor request at the trust boundary.
   */
  function validateGovernorRequest(input = {}) {
    const errors = [];
    const fail = (field, code, message) => errors.push({ field, code, message });

    if (!isObject(input)) {
      return { valid: false, errors: [{ field: '(request)', code: COST_CARBON_ERRORS.INVALID_TYPE, message: 'Request must be a JSON object.' }] };
    }

    if (input.workflowId !== undefined && !isWorkflowId(input.workflowId)) {
      fail('workflowId', COST_CARBON_ERRORS.INVALID_TYPE, 'workflowId must be a lowercase slug.');
    }
    if (input.runId !== undefined && !isRunId(input.runId)) {
      fail('runId', COST_CARBON_ERRORS.INVALID_TYPE, 'runId must be a lowercase slug.');
    }
    if (input.policyId !== undefined && !isSlug(input.policyId)) {
      fail('policyId', COST_CARBON_ERRORS.INVALID_TYPE, 'policyId must be a lowercase slug.');
    }
    if (input.modelId !== undefined && typeof input.modelId !== 'string') {
      fail('modelId', COST_CARBON_ERRORS.INVALID_TYPE, 'modelId must be a string.');
    }
    if (input.prompt !== undefined && typeof input.prompt !== 'string') {
      fail('prompt', COST_CARBON_ERRORS.INVALID_TYPE, 'prompt must be a string.');
    }
    if (input.prompt !== undefined) {
      const promptBytes = new TextEncoder().encode(input.prompt).byteLength;
      if (promptBytes > MAX_INPUT_BYTES) {
        fail('prompt', COST_CARBON_ERRORS.INVALID_TYPE, `prompt must be at most ${MAX_INPUT_BYTES} bytes.`);
      }
    }
    if (input.output !== undefined && typeof input.output !== 'string') {
      fail('output', COST_CARBON_ERRORS.INVALID_TYPE, 'output must be a string.');
    }
    if (input.inputTokens !== undefined && (!Number.isInteger(input.inputTokens) || input.inputTokens < 0)) {
      fail('inputTokens', COST_CARBON_ERRORS.INVALID_TYPE, 'inputTokens must be a non-negative integer.');
    }
    if (input.outputTokens !== undefined && (!Number.isInteger(input.outputTokens) || input.outputTokens < 0)) {
      fail('outputTokens', COST_CARBON_ERRORS.INVALID_TYPE, 'outputTokens must be a non-negative integer.');
    }
    if (input.latencyMs !== undefined && (!Number.isInteger(input.latencyMs) || input.latencyMs < 0)) {
      fail('latencyMs', COST_CARBON_ERRORS.INVALID_TYPE, 'latencyMs must be a non-negative integer.');
    }
    if (input.billingMetadata !== undefined && !isObject(input.billingMetadata)) {
      fail('billingMetadata', COST_CARBON_ERRORS.INVALID_TYPE, 'billingMetadata must be an object.');
    }
    if (input.humanApproved !== undefined && typeof input.humanApproved !== 'boolean') {
      fail('humanApproved', COST_CARBON_ERRORS.INVALID_TYPE, 'humanApproved must be a boolean.');
    }
    if (input.callSource !== undefined && !Object.values(CALL_SOURCE).includes(input.callSource)) {
      fail('callSource', COST_CARBON_ERRORS.INVALID_TYPE, `callSource must be one of ${Object.values(CALL_SOURCE).join(', ')}.`);
    }
    if (input.isHighImpact !== undefined && typeof input.isHighImpact !== 'boolean') {
      fail('isHighImpact', COST_CARBON_ERRORS.INVALID_TYPE, 'isHighImpact must be a boolean.');
    }

    const sensitive = containsSensitive(input);
    for (const where of sensitive) {
      fail(where, COST_CARBON_ERRORS.SENSITIVE_VALUE, 'Remove identity numbers, OTPs and credentials from the request.');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Resolve a policy by id; fall back to the default policy.
   */
  function resolvePolicy(store, policyId) {
    if (!policyId) return clonePolicy(DEFAULT_COST_CARBON_POLICY);
    const policy = store.policies.find((p) => p.id === policyId);
    return policy ? clonePolicy(policy) : clonePolicy(DEFAULT_COST_CARBON_POLICY);
  }

  function clonePolicy(policy) {
    return JSON.parse(JSON.stringify(policy));
  }

  /**
   * Check a proposed call against budgets and stop conditions BEFORE execution.
   * Returns { allowed, reason, estimate, policy, billingMetadataGap }.
   */
  async function preflightCall({
    modelId,
    prompt,
    inputTokens,
    isHighImpact,
    humanApproved,
    policyId,
    nowIso: _now,
  } = {}) {
    let store;
    try {
      store = loadStore({ now: _now ? new Date(_now).toISOString() : nowIso() });
    } catch {
      store = ensureCostCarbonStore({ now: _now ? new Date(_now).toISOString() : nowIso() });
    }
    const policy = resolvePolicy(store, policyId);
    const rate = getModelRate(modelId);
    const tokens = inputTokens != null ? inputTokens : estimateTokensFromChars(prompt || '');
    const estimatedInputCost = estimateCostUSD(tokens, rate.inputCostUSDPer1kTokens);
    const estimatedOutputCost = 0; // output unknown before the call
    const estimatedCost = Number(estimatedInputCost + estimatedOutputCost).toFixed(6);
    const estimatedEnergy = estimateEnergyKWh(tokens, rate.estimatedEnergyKWhPer1kTokens);
    const estimatedCarbon = estimateCarbonGCO2e(estimatedEnergy, policy.carbonIntensityGCO2ePerKWh);

    const billingMetadataGap = !modelId || !MODEL_RATE_TABLE[modelId];
    const reasons = [];

    if (Number(estimatedCost) > policy.maxCostPerCallUSD) {
      reasons.push({ code: COST_CARBON_ERRORS.BUDGET_EXCEEDED, message: `Estimated call cost $${estimatedCost} exceeds per-call budget $${policy.maxCostPerCallUSD}.` });
    }
    if (tokens > policy.maxTokensPerCall) {
      reasons.push({ code: COST_CARBON_ERRORS.BUDGET_EXCEEDED, message: `Estimated tokens ${tokens} exceed per-call budget ${policy.maxTokensPerCall}.` });
    }
    if (isHighImpact && policy.requireHumanApprovalForHighImpact && !humanApproved) {
      reasons.push({ code: COST_CARBON_ERRORS.PERMISSION_DENIED, message: 'High-impact action requires explicit human approval.' });
    }
    if (billingMetadataGap && policy.allowRetryOnBillingMetadataGap === false) {
      reasons.push({ code: COST_CARBON_ERRORS.BILLING_METADATA_GAP, message: 'No verified billing metadata for model; estimates only.' });
    }

    const allowed = reasons.length === 0;
    return {
      allowed,
      reason: allowed ? null : reasons[0].message,
      code: allowed ? null : reasons[0].code,
      estimate: {
        inputTokens: tokens,
        estimatedInputCostUSD: estimatedInputCost,
        estimatedOutputCostUSD: estimatedOutputCost,
        estimatedCostUSD: estimatedCost,
        estimatedEnergyKWh: estimatedEnergy,
        estimatedCarbonGCO2e: estimatedCarbon,
        estimated: true,
        billingMetadataGap,
        modelId,
        rate,
      },
      policy,
    };
  }

  /**
   * Start a workflow run within budgets. Returns { ok, run, policy, reason }.
   */
  function startRun({ workflowId, policyId, modelId, prompt, inputTokens, isHighImpact, humanApproved, callSource = CALL_SOURCE.LLM, _now } = {}) {
    const validation = validateGovernorRequest({ workflowId, policyId, modelId, prompt, inputTokens, isHighImpact, humanApproved, callSource });
    if (!validation.valid) {
      return { ok: false, error: { code: COST_CARBON_ERRORS.VALIDATION_FAILED, message: 'Invalid governor request.' }, errors: validation.errors };
    }

    let store;
    try {
      store = loadStore({ now: _now ? new Date(_now).toISOString() : nowIso() });
    } catch (error) {
      log('Failed to load cost-carbon store; degrading to in-memory.', error);
      store = ensureCostCarbonStore({ now: _now ? new Date(_now).toISOString() : nowIso() });
    }

    const policy = resolvePolicy(store, policyId);
    const now = _now ? new Date(_now).toISOString() : nowIso();

    // Concurrency limit.
    if (activeRuns.size >= MAX_CONCURRENT_RUNS) {
      return { ok: false, error: { code: COST_CARBON_ERRORS.RESOURCE_LIMIT_EXCEEDED, message: `Maximum ${MAX_CONCURRENT_RUNS} concurrent runs reached.` } };
    }

    // Per-workflow run limit.
    const indexes = buildCostCarbonIndexes(store);
    const workflowRuns = (indexes.runsByWorkflow && indexes.runsByWorkflow.get(workflowId.toLowerCase())) || [];
    const activeCount = workflowRuns.filter((r) => r.status === COST_CARBON_STATUS.RUNNING).length;
    if (activeCount >= MAX_RUNS_PER_WORKFLOW) {
      return { ok: false, error: { code: COST_CARBON_ERRORS.RESOURCE_LIMIT_EXCEEDED, message: `Maximum ${MAX_RUNS_PER_WORKFLOW} concurrent runs per workflow reached.` } };
    }

    const runId = `run-${String(Date.now())}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
    const run = {
      id: runId,
      workflowId,
      policyId: policy.id,
      policyVersion: policy.version,
      modelId,
      status: COST_CARBON_STATUS.RUNNING,
      callSource,
      isHighImpact: Boolean(isHighImpact),
      humanApproved: Boolean(humanApproved),
      createdAt: now,
      updatedAt: now,
      startedAt: now,
      totals: {
        calls: 0,
        inputTokens: 0,
        outputTokens: 0,
        costUSD: '0.000000',
        energyKWh: '0.000000000',
        carbonGCO2e: '0.000000',
        latencyMs: 0,
        fallbackCalls: 0,
        blockedCalls: 0,
        billingMetadataGaps: 0,
      },
      stopTrigger: null,
      schemaVersion: CIVIC_AGENT_COST_CARBON_SCHEMA_VERSION,
      disclaimer: CIVIC_AGENT_COST_CARBON_DISCLAIMER,
      noCitizenData: true,
      untrusted: true,
      requiresHumanReview: isHighImpact,
    };

    activeRuns.set(runId, { startedAt: now });
    try {
      runTransaction((draft) => {
        draft.runs.push(run);
        draft.auditEvents.push({
          id: `audit-run-start-${Date.now()}`,
          action: 'run.started',
          entityType: 'run',
          entityId: runId,
          actorRole: 'system',
          actorId: 'costCarbon.governor',
          reason: `Run started for workflow ${workflowId} under policy ${policy.id}.`,
          details: { workflowId, policyId: policy.id, modelId, isHighImpact: run.isHighImpact, humanApproved: run.humanApproved },
          timestamp: now,
          schemaVersion: CIVIC_AGENT_COST_CARBON_SCHEMA_VERSION,
        });
      }, { now: new Date(now) });
    } catch (error) {
      activeRuns.delete(runId);
      return { ok: false, error: { code: COST_CARBON_ERRORS.STORAGE_UNAVAILABLE, message: 'Could not persist run: ' + String(error) } };
    }

    return { ok: true, run, policy };
  }

  /**
   * Record a completed call inside a run, updating totals and checking budget.
   * Returns { ok, call, runTotals, stopped, reason }.
   */
  function recordCall({ runId, modelId, prompt, output, inputTokens, outputTokens, latencyMs, callSource = CALL_SOURCE.LLM, billingMetadata, isHighImpact, _now } = {}) {
    const validation = validateGovernorRequest({ runId, modelId, prompt, output, inputTokens, outputTokens, latencyMs, billingMetadata, isHighImpact, callSource });
    if (!validation.valid) {
      return { ok: false, error: { code: COST_CARBON_ERRORS.VALIDATION_FAILED, message: 'Invalid call record.' }, errors: validation.errors };
    }

    if (!activeRuns.has(runId)) {
      return { ok: false, error: { code: COST_CARBON_ERRORS.RUN_NOT_FOUND, message: 'Run is not active or does not exist.' } };
    }

    const now = _now ? new Date(_now).toISOString() : nowIso();
    let store;
    try {
      store = loadStore({ now });
    } catch (error) {
      log('Failed to load cost-carbon store; cannot record call.', error);
      return { ok: false, error: { code: COST_CARBON_ERRORS.STORAGE_UNAVAILABLE, message: 'Store unavailable.' } };
    }

    const run = store.runs.find((r) => r.id === runId);
    if (!run) {
      return { ok: false, error: { code: COST_CARBON_ERRORS.RUN_NOT_FOUND, message: 'Run not found in store.' } };
    }

    const policy = resolvePolicy(store, run.policyId);
    const rate = getModelRate(modelId);
    const tokensIn = inputTokens != null ? inputTokens : estimateTokensFromChars(prompt || '');
    const tokensOut = outputTokens != null ? outputTokens : estimateTokensFromChars(output || '');
    const totalTokens = tokensIn + tokensOut;
    const costIn = estimateCostUSD(tokensIn, rate.inputCostUSDPer1kTokens);
    const costOut = estimateCostUSD(tokensOut, rate.outputCostUSDPer1kTokens);
    const callCost = Number(costIn + costOut).toFixed(6);
    const energy = estimateEnergyKWh(totalTokens, rate.estimatedEnergyKWhPer1kTokens);
    const carbon = estimateCarbonGCO2e(energy, policy.carbonIntensityGCO2ePerKWh);

    const billingMetadataGap = !billingMetadata || !billingMetadata.verified;
    const reasons = [];
    let stopped = false;
    let stopReason = null;

    // Per-call budget.
    if (Number(callCost) > policy.maxCostPerCallUSD) {
      reasons.push({ code: COST_CARBON_ERRORS.BUDGET_EXCEEDED, message: `Call cost $${callCost} exceeds per-call budget $${policy.maxCostPerCallUSD}.` });
    }
    if (totalTokens > policy.maxTokensPerCall) {
      reasons.push({ code: COST_CARBON_ERRORS.BUDGET_EXCEEDED, message: `Call tokens ${totalTokens} exceed per-call budget ${policy.maxTokensPerCall}.` });
    }

    // Cumulative budget.
    const projectedCost = Number(run.totals.costUSD) + Number(callCost);
    const projectedTokens = run.totals.inputTokens + run.totals.outputTokens + totalTokens;
    const projectedLatency = run.totals.latencyMs + (latencyMs || 0);
    const projectedCarbon = Number(run.totals.carbonGCO2e) + Number(carbon);

    if (policy.stopOnBudgetExceeded) {
      if (projectedCost > policy.maxTotalCostUSD) {
        stopped = true;
        stopReason = `Projected cost $${projectedCost.toFixed(6)} exceeds total budget $${policy.maxTotalCostUSD}.`;
        reasons.push({ code: COST_CARBON_ERRORS.BUDGET_EXCEEDED, message: stopReason });
      }
      if (projectedTokens > policy.maxTotalTokens) {
        stopped = true;
        stopReason = `Projected tokens ${projectedTokens} exceed total budget ${policy.maxTotalTokens}.`;
        reasons.push({ code: COST_CARBON_ERRORS.BUDGET_EXCEEDED, message: stopReason });
      }
      if (projectedLatency > policy.maxTotalLatencyMs) {
        stopped = true;
        stopReason = `Projected latency ${projectedLatency}ms exceeds total budget ${policy.maxTotalLatencyMs}ms.`;
        reasons.push({ code: COST_CARBON_ERRORS.BUDGET_EXCEEDED, message: stopReason });
      }
      if (projectedCarbon > policy.maxEstimatedCarbonGCO2e) {
        stopped = true;
        stopReason = `Projected carbon ${projectedCarbon.toFixed(6)}g exceeds budget ${policy.maxEstimatedCarbonGCO2e}g.`;
        reasons.push({ code: COST_CARBON_ERRORS.BUDGET_EXCEEDED, message: stopReason });
      }
      if (run.totals.calls + 1 > policy.maxCallsPerRun) {
        stopped = true;
        stopReason = `Calls ${run.totals.calls + 1} exceed per-run budget ${policy.maxCallsPerRun}.`;
        reasons.push({ code: COST_CARBON_ERRORS.BUDGET_EXCEEDED, message: stopReason });
      }
    }

    // Runaway loop detection: rapid repeat calls to same model + input.
    const recentCalls = store.calls.filter((c) => c.runId === runId).slice(-policy.maxCallsPerMinute);
    const sameInputCalls = recentCalls.filter((c) => c.modelId === modelId && c.promptHash === hashString(prompt || '')).length;
    const callsInLastMinute = recentCalls.filter((c) => now - new Date(c.recordedAt).getTime() < 60000).length;
    let runwaySuspected = false;
    if (sameInputCalls >= 5) {
      runwaySuspected = true;
      reasons.push({ code: COST_CARBON_ERRORS.RUNWAY_LOOP_SUSPECTED, message: 'Repeated identical calls to the same model detected (possible runaway loop).' });
    }
    if (callsInLastMinute > policy.maxCallsPerMinute) {
      runwaySuspected = true;
      reasons.push({ code: COST_CARBON_ERRORS.RUNWAY_LOOP_SUSPECTED, message: `Calls per minute ${callsInLastMinute} exceed limit ${policy.maxCallsPerMinute}.` });
    }

    const call = {
      id: `call-${String(Date.now())}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
      runId,
      workflowId: run.workflowId,
      modelId,
      callSource,
      promptHash: hashString(prompt || ''),
      promptLength: String(prompt || '').length,
      outputLength: String(output || '').length,
      inputTokens: tokensIn,
      outputTokens: tokensOut,
      totalTokens,
      costUSD: callCost,
      energyKWh: energy,
      carbonGCO2e: carbon,
      latencyMs: latencyMs || 0,
      billingMetadata: billingMetadata || { verified: false, source: 'estimate' },
      billingMetadataGap,
      estimated: true,
      isHighImpact: Boolean(isHighImpact),
      status: stopped ? COST_CARBON_STATUS.STOPPED : COST_CARBON_STATUS.COMPLETED,
      recordedAt: now,
      schemaVersion: CIVIC_AGENT_COST_CARBON_SCHEMA_VERSION,
      disclaimer: CIVIC_AGENT_COST_CARBON_DISCLAIMER,
      noCitizenData: true,
      untrusted: true,
    };

    let persisted;
    try {
      persisted = runTransaction((draft) => {
        const targetRun = draft.runs.find((r) => r.id === runId);
        if (!targetRun) throw new Error('Run disappeared during transaction.');
        targetRun.totals.calls += 1;
        targetRun.totals.inputTokens += tokensIn;
        targetRun.totals.outputTokens += tokensOut;
        targetRun.totals.costUSD = Number(targetRun.totals.costUSD) + Number(callCost);
        targetRun.totals.energyKWh = Number(targetRun.totals.energyKWh) + Number(energy);
        targetRun.totals.carbonGCO2e = Number(targetRun.totals.carbonGCO2e) + Number(carbon);
        targetRun.totals.latencyMs += latencyMs || 0;
        targetRun.totals.fallbackCalls += callSource === CALL_SOURCE.FALLBACK ? 1 : 0;
        targetRun.totals.blockedCalls += stopped ? 1 : 0;
        targetRun.totals.billingMetadataGaps += billingMetadataGap ? 1 : 0;
        targetRun.updatedAt = now;
        if (stopped) {
          targetRun.status = COST_CARBON_STATUS.STOPPED;
          targetRun.stopTrigger = { code: reasons[0]?.code, message: reasons[0]?.message, at: now };
        }
        draft.calls.push(call);
        draft.auditEvents.push({
          id: `audit-call-${Date.now()}`,
          action: 'call.recorded',
          entityType: 'call',
          entityId: call.id,
          actorRole: 'system',
          actorId: 'costCarbon.governor',
          reason: `Call recorded for run ${runId}; stopped=${stopped}.`,
          details: { runId, modelId, callSource, totalTokens, costUSD: callCost, stopped, billingMetadataGap, runwaySuspected },
          timestamp: now,
          schemaVersion: CIVIC_AGENT_COST_CARBON_SCHEMA_VERSION,
        });
      }, { now: new Date(now) });
    } catch (error) {
      return { ok: false, error: { code: COST_CARBON_ERRORS.STORAGE_UNAVAILABLE, message: 'Could not persist call: ' + String(error) } };
    }

    activeRuns.get(runId).startedAt = now;

    const updatedRun = (persisted && persisted.data && persisted.data.runs) ? persisted.data.runs.find((r) => r.id === runId) : null;

    return {
      ok: true,
      call,
      runTotals: updatedRun ? updatedRun.totals : null,
      stopped,
      reason: stopReason,
      code: stopped ? (reasons[0]?.code || COST_CARBON_ERRORS.BUDGET_EXCEEDED) : null,
      billingMetadataGap,
      runwaySuspected,
      estimate: {
        inputTokens: tokensIn,
        outputTokens: tokensOut,
        totalTokens,
        costUSD: callCost,
        energyKWh: energy,
        carbonGCO2e: carbon,
        estimated: true,
        billingMetadataGap,
      },
    };
  }

  /**
   * Stop a run explicitly (operator or human action).
   */
  function stopRun({ runId, reason, _now } = {}) {
    if (!isRunId(runId)) {
      return { ok: false, error: { code: COST_CARBON_ERRORS.INVALID_TYPE, message: 'Invalid runId.' } };
    }
    const now = _now ? new Date(_now).toISOString() : nowIso();
    try {
      runTransaction((draft) => {
        const run = draft.runs.find((r) => r.id === runId);
        if (!run) throw new Error('Run not found.');
        run.status = COST_CARBON_STATUS.STOPPED;
        run.stopTrigger = { code: 'USER_STOP', message: reason || 'Run stopped by user/operator.', at: now };
        run.updatedAt = now;
        draft.auditEvents.push({
          id: `audit-run-stop-${Date.now()}`,
          action: 'run.stopped',
          entityType: 'run',
          entityId: runId,
          actorRole: 'system',
          actorId: 'costCarbon.governor',
          reason: reason || 'Run stopped.',
          details: { runId, reason },
          timestamp: now,
          schemaVersion: CIVIC_AGENT_COST_CARBON_SCHEMA_VERSION,
        });
        return { runId };
      }, { now: new Date(now) });
      activeRuns.delete(runId);
      return { ok: true, runId };
    } catch {
      return { ok: false, error: { code: COST_CARBON_ERRORS.STORAGE_UNAVAILABLE, message: 'Could not stop run.' } };
    }
  }

  /**
   * Get a run summary (aggregated, no sensitive data).
   */
  function getRun(runId) {
    if (!isRunId(runId)) return null;
    const store = loadStore({ now: nowIso() });
    const run = store.runs.find((r) => r.id === runId);
    if (!run) return null;
    const calls = store.calls.filter((c) => c.runId === runId);
    return {
      ...run,
      callCount: calls.length,
      calls: calls.map((c) => ({
        id: c.id,
        modelId: c.modelId,
        callSource: c.callSource,
        totalTokens: c.totalTokens,
        costUSD: c.costUSD,
        energyKWh: c.energyKWh,
        carbonGCO2e: c.carbonGCO2e,
        latencyMs: c.latencyMs,
        billingMetadataGap: c.billingMetadataGap,
        estimated: c.estimated,
        status: c.status,
        recordedAt: c.recordedAt,
      })),
    };
  }

  /**
   * Get workflow-level aggregate across all runs.
   */
  function getWorkflowAggregate(workflowId) {
    if (!isWorkflowId(workflowId)) return null;
    const store = loadStore({ now: nowIso() });
    const indexes = buildCostCarbonIndexes(store);
    const runs = (indexes.runsByWorkflow && indexes.runsByWorkflow.get(workflowId.toLowerCase())) || [];
    const calls = runs.flatMap((r) => store.calls.filter((c) => c.runId === r.id));
    const totals = runs.reduce(
      (acc, r) => {
        acc.calls += r.totals.calls;
        acc.inputTokens += r.totals.inputTokens;
        acc.outputTokens += r.totals.outputTokens;
        acc.costUSD = Number(acc.costUSD) + Number(r.totals.costUSD);
        acc.energyKWh = Number(acc.energyKWh) + Number(r.totals.energyKWh);
        acc.carbonGCO2e = Number(acc.carbonGCO2e) + Number(r.totals.carbonGCO2e);
        acc.latencyMs += r.totals.latencyMs;
        acc.fallbackCalls += r.totals.fallbackCalls;
        acc.blockedCalls += r.totals.blockedCalls;
        acc.billingMetadataGaps += r.totals.billingMetadataGaps;
        return acc;
      },
      { calls: 0, inputTokens: 0, outputTokens: 0, costUSD: 0, energyKWh: 0, carbonGCO2e: 0, latencyMs: 0, fallbackCalls: 0, blockedCalls: 0, billingMetadataGaps: 0 },
    );
    return { workflowId, runCount: runs.length, callCount: calls.length, totals, runs };
  }

  /**
   * List policies.
   */
  function listPolicies() {
    const store = loadStore({ now: nowIso() });
    return store.policies.map((p) => ({ id: p.id, name: p.name, version: p.version, description: p.description }));
  }

  function hashString(value) {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      const char = value.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return `h-${Math.abs(hash).toString(16).padStart(8, '0')}`;
  }

  return {
    validateGovernorRequest,
    preflightCall,
    startRun,
    recordCall,
    stopRun,
    getRun,
    getWorkflowAggregate,
    listPolicies,
    COST_CARBON_STATUS,
    COST_CARBON_ERRORS,
    CALL_SOURCE,
    DEFAULT_COST_CARBON_POLICY,
    __testables: {
      validateGovernorRequest,
      preflightCall,
      startRun,
      recordCall,
      stopRun,
      getRun,
      getWorkflowAggregate,
      listPolicies,
      estimateTokensFromChars,
      estimateCostUSD,
      estimateEnergyKWh,
      estimateCarbonGCO2e,
      hashString,
      containsSensitive,
      COST_CARBON_STATUS,
      COST_CARBON_ERRORS,
      CALL_SOURCE,
    },
  };
}

export const costCarbonGovernor = createCostCarbonGovernor();
