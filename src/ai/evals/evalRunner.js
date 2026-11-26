/**
 * Civic Agent Evaluation Harness — Scenario Runner, Model Comparator & Release Gate
 *
 * Orchestrates bounded-concurrency scenario execution with bounded retries,
 * timeout enforcement, redacted trace persistence, model/version comparison,
 * and deterministic release-gate checks.
 */

import {
  EVAL_SCHEMA_VERSION,
  DEFAULT_RELEASE_THRESHOLDS,
  validateEvalRunRequest,
  validateReleaseThresholds,
} from './evalContracts.js';
import { filterScenarios } from './scenarioFixtures.js';
import { scoreScenarioResult, aggregateHarnessMetrics } from './evalScorer.js';
import { redactExecutionTrace } from './traceRedactor.js';
import { resolveHarnessAdapter, createHarnessAdapterRegistry } from './harnessAdapters.js';
import { recordEvalEvent } from './evalObservability.js';

function isRetryableError(err) {
  if (!err) return false;
  if (err.retryable === true) return true;
  const msg = String(err.message || '').toLowerCase();
  return msg.includes('timeout') || msg.includes('transient') || msg.includes('econnreset');
}

async function withTimeout(promiseFactory, timeoutMs) {
  let timer = null;
  try {
    return await Promise.race([
      promiseFactory(),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const err = new Error(`Scenario execution exceeded ${timeoutMs}ms timeout.`);
          err.retryable = true;
          err.code = 'EVAL_TIMEOUT';
          reject(err);
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function executeSingleScenario({
  scenario,
  adapter,
  runId,
  modelId,
  modelVersion,
  promptVersion,
  maxRetries,
  timeoutMs,
}) {
  const correlationId = `${runId}-${scenario.id}`;
  const effectiveTimeout = Math.min(timeoutMs, scenario.maxLatencyMs || timeoutMs);
  let lastError = null;
  let attempts = 0;
  const startMs = Date.now();

  for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
    attempts = attempt;
    try {
      const execResult = await withTimeout(
        () =>
          adapter.execute(scenario, {
            correlationId,
            modelId,
            modelVersion,
            promptVersion,
            timeoutMs: effectiveTimeout,
          }),
        effectiveTimeout
      );

      const latencyMs = Date.now() - startMs;
      const output = execResult?.output || {};
      const score = scoreScenarioResult(scenario, output, latencyMs);
      const trace = redactExecutionTrace({
        scenarioId: scenario.id,
        correlationId,
        rawQuery: scenario.query,
        rawOutput: output,
        hops: execResult?.hops || [],
        latencyMs,
        attempts,
        adapterMeta: execResult?.adapterMeta || {},
      });

      if (trace.redactionApplied) {
        recordEvalEvent('eval_redaction_applied', { runId, targetId: adapter.id });
      }
      if (score.hasProhibitedViolation) {
        recordEvalEvent('eval_prohibited_outcome', {
          runId,
          targetId: adapter.id,
          status: 'error',
          reason: score.prohibitedViolations.join(','),
        });
      }

      return { score, trace };
    } catch (err) {
      lastError = err;
      if (attempt <= maxRetries && isRetryableError(err)) {
        recordEvalEvent('eval_scenario_retried', {
          runId,
          targetId: adapter.id,
          reason: err.code || err.message,
        });
        continue;
      }
      break;
    }
  }

  const latencyMs = Date.now() - startMs;
  const errorOutput = {
    status: 'error',
    grounded: false,
    data: {
      title: 'Evaluation Scenario Execution Error',
      summary: lastError?.message || 'Scenario execution failed.',
      officialSources: [],
    },
    contractMeta: { requiresHumanApproval: true },
  };
  const score = scoreScenarioResult(scenario, errorOutput, latencyMs);
  const trace = redactExecutionTrace({
    scenarioId: scenario.id,
    correlationId,
    rawQuery: scenario.query,
    rawOutput: errorOutput,
    hops: [{ agent: adapter.id, ok: false, schemaVersion: '2.0', attempts }],
    latencyMs,
    attempts,
    adapterMeta: { errorCode: lastError?.code || 'EXECUTION_ERROR' },
  });

  return { score, trace };
}

/**
 * Evaluates aggregate metrics against release threshold policy.
 * @param {Object} metrics
 * @param {Object} [thresholds]
 * @returns {{ passed: boolean, failures: Array<Object> }}
 */
export function evaluateReleaseThresholds(metrics, thresholds = DEFAULT_RELEASE_THRESHOLDS) {
  const checked = validateReleaseThresholds(thresholds);
  const policy = checked.valid ? checked.value : DEFAULT_RELEASE_THRESHOLDS;
  const failures = [];

  if (metrics.taskSuccessRate < policy.minTaskSuccessRate) {
    failures.push({
      metric: 'taskSuccessRate',
      actual: metrics.taskSuccessRate,
      threshold: policy.minTaskSuccessRate,
      message: `Task success rate ${metrics.taskSuccessRate} is below minimum ${policy.minTaskSuccessRate}.`,
    });
  }
  if (metrics.factualityScore < policy.minFactualityScore) {
    failures.push({
      metric: 'factualityScore',
      actual: metrics.factualityScore,
      threshold: policy.minFactualityScore,
      message: `Factuality score ${metrics.factualityScore} is below minimum ${policy.minFactualityScore}.`,
    });
  }
  if (metrics.citationCoverage < policy.minCitationCoverage) {
    failures.push({
      metric: 'citationCoverage',
      actual: metrics.citationCoverage,
      threshold: policy.minCitationCoverage,
      message: `Citation coverage ${metrics.citationCoverage} is below minimum ${policy.minCitationCoverage}.`,
    });
  }
  if (metrics.refusalAccuracy < policy.minRefusalAccuracy) {
    failures.push({
      metric: 'refusalAccuracy',
      actual: metrics.refusalAccuracy,
      threshold: policy.minRefusalAccuracy,
      message: `Refusal accuracy ${metrics.refusalAccuracy} is below minimum ${policy.minRefusalAccuracy}.`,
    });
  }
  if (metrics.prohibitedOutcomeRate > policy.maxProhibitedOutcomeRate) {
    failures.push({
      metric: 'prohibitedOutcomeRate',
      actual: metrics.prohibitedOutcomeRate,
      threshold: policy.maxProhibitedOutcomeRate,
      message: `Prohibited outcome rate ${metrics.prohibitedOutcomeRate} exceeds allowed ${policy.maxProhibitedOutcomeRate}.`,
    });
  }
  if (metrics.p95LatencyMs > policy.maxP95LatencyMs) {
    failures.push({
      metric: 'p95LatencyMs',
      actual: metrics.p95LatencyMs,
      threshold: policy.maxP95LatencyMs,
      message: `p95 latency ${metrics.p95LatencyMs}ms exceeds SLA ${policy.maxP95LatencyMs}ms.`,
    });
  }

  return {
    passed: failures.length === 0,
    policy,
    failures,
  };
}

/**
 * Runs a scenario-based evaluation suite with bounded concurrency and retries.
 * @param {Object} request
 * @param {Object} [options]
 * @returns {Promise<Object>} Evaluation run record
 */
export async function runScenarioEvaluationSuite(request = {}, options = {}) {
  const validation = validateEvalRunRequest(request);
  if (!validation.valid) {
    const err = new Error(`Invalid evaluation run request: ${validation.errors.join('; ')}`);
    err.code = 'INVALID_EVAL_REQUEST';
    err.details = validation.errors;
    throw err;
  }

  const req = validation.value;
  const registry = options.registry || createHarnessAdapterRegistry(options.customAdapters);
  const adapter = resolveHarnessAdapter(req.targetId, registry);
  const scenarios =
    req.scenarios || filterScenarios({ category: req.category, language: req.language });

  if (scenarios.length === 0) {
    const err = new Error('No evaluation scenarios matched the provided filters.');
    err.code = 'EMPTY_SCENARIO_SUITE';
    throw err;
  }

  const runId = options.runId || `evalrun-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const startedAt = new Date().toISOString();
  recordEvalEvent('eval_run_started', { runId, targetId: req.targetId, count: scenarios.length });

  const orderedOutputs = new Array(scenarios.length);
  let cursor = 0;
  const workerCount = Math.min(req.concurrency, scenarios.length);

  async function worker() {
    while (cursor < scenarios.length) {
      const idx = cursor;
      cursor += 1;
      const scenario = scenarios[idx];
      orderedOutputs[idx] = await executeSingleScenario({
        scenario,
        adapter,
        runId,
        modelId: req.modelId,
        modelVersion: req.modelVersion,
        promptVersion: req.promptVersion,
        maxRetries: req.maxRetries,
        timeoutMs: req.timeoutMs,
      });
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  const results = orderedOutputs.map((o) => o.score);
  const traces = orderedOutputs.map((o) => o.trace);
  const metrics = aggregateHarnessMetrics(results);
  const gate = evaluateReleaseThresholds(metrics, req.thresholds);

  recordEvalEvent('eval_run_completed', {
    runId,
    targetId: req.targetId,
    count: results.length,
    status: gate.passed ? 'ok' : 'error',
  });
  recordEvalEvent(gate.passed ? 'eval_gate_passed' : 'eval_gate_failed', {
    runId,
    targetId: req.targetId,
    status: gate.passed ? 'ok' : 'error',
    reason: gate.failures.map((f) => f.metric).join(',') || null,
  });

  return {
    schemaVersion: EVAL_SCHEMA_VERSION,
    runId,
    targetId: req.targetId,
    modelId: req.modelId,
    modelVersion: req.modelVersion,
    promptVersion: req.promptVersion,
    filters: { category: req.category, language: req.language },
    startedAt,
    completedAt: new Date().toISOString(),
    metrics,
    gate,
    results,
    traces,
    disclaimer:
      'Synthetic evaluation metrics measure grounding, refusal, and safety boundaries only. Passing does not imply official government integration or legal authority.',
  };
}

/**
 * Compares a baseline run against a candidate run across metrics and scenarios.
 * @param {Object} baselineRun
 * @param {Object} candidateRun
 * @param {Object} [thresholds]
 * @returns {Object} Regression report
 */
export function compareHarnessRuns(baselineRun, candidateRun, thresholds = DEFAULT_RELEASE_THRESHOLDS) {
  if (!baselineRun || !candidateRun) {
    throw new Error('Both baselineRun and candidateRun are required for comparison.');
  }

  const checked = validateReleaseThresholds(thresholds);
  const policy = checked.valid ? checked.value : DEFAULT_RELEASE_THRESHOLDS;
  const base = baselineRun.metrics || aggregateHarnessMetrics(baselineRun.results || []);
  const cand = candidateRun.metrics || aggregateHarnessMetrics(candidateRun.results || []);

  const roundDelta = (v) => Math.round(v * 1000) / 1000;
  const deltas = {
    taskSuccessDelta: roundDelta(cand.taskSuccessRate - base.taskSuccessRate),
    factualityDelta: roundDelta(cand.factualityScore - base.factualityScore),
    citationDelta: roundDelta(cand.citationCoverage - base.citationCoverage),
    refusalAccuracyDelta: roundDelta(cand.refusalAccuracy - base.refusalAccuracy),
    prohibitedRateDelta: roundDelta(cand.prohibitedOutcomeRate - base.prohibitedOutcomeRate),
    p95LatencyDeltaMs: cand.p95LatencyMs - base.p95LatencyMs,
  };

  const baseById = new Map((baselineRun.results || []).map((r) => [r.scenarioId, r]));
  const regressedScenarios = [];
  const improvedScenarios = [];

  for (const candRes of candidateRun.results || []) {
    const baseRes = baseById.get(candRes.scenarioId);
    if (!baseRes) continue;
    if ((baseRes.passed && !candRes.passed) || (!baseRes.hasProhibitedViolation && candRes.hasProhibitedViolation)) {
      regressedScenarios.push({
        scenarioId: candRes.scenarioId,
        category: candRes.category,
        language: candRes.language,
        baselinePassed: baseRes.passed,
        candidatePassed: candRes.passed,
        prohibitedViolations: candRes.prohibitedViolations,
      });
    } else if (!baseRes.passed && candRes.passed) {
      improvedScenarios.push({
        scenarioId: candRes.scenarioId,
        category: candRes.category,
        language: candRes.language,
      });
    }
  }

  const candidateGate = evaluateReleaseThresholds(cand, policy);
  const regressionFailures = [...candidateGate.failures];

  if (deltas.taskSuccessDelta < -policy.maxRegressionDrop) {
    regressionFailures.push({
      metric: 'taskSuccessDelta',
      actual: deltas.taskSuccessDelta,
      threshold: -policy.maxRegressionDrop,
      message: `Task success regressed by ${Math.abs(deltas.taskSuccessDelta)} (max drop ${policy.maxRegressionDrop}).`,
    });
  }
  if (deltas.citationDelta < -policy.maxRegressionDrop) {
    regressionFailures.push({
      metric: 'citationDelta',
      actual: deltas.citationDelta,
      threshold: -policy.maxRegressionDrop,
      message: `Citation coverage regressed by ${Math.abs(deltas.citationDelta)} (max drop ${policy.maxRegressionDrop}).`,
    });
  }
  if (regressedScenarios.length > 0 && regressionFailures.length === 0) {
    regressionFailures.push({
      metric: 'regressedScenarios',
      actual: regressedScenarios.length,
      threshold: 0,
      message: `${regressedScenarios.length} previously passing scenario(s) regressed.`,
    });
  }

  return {
    schemaVersion: EVAL_SCHEMA_VERSION,
    comparedAt: new Date().toISOString(),
    baseline: {
      runId: baselineRun.runId,
      targetId: baselineRun.targetId,
      modelId: baselineRun.modelId,
      modelVersion: baselineRun.modelVersion,
      promptVersion: baselineRun.promptVersion,
      metrics: base,
    },
    candidate: {
      runId: candidateRun.runId,
      targetId: candidateRun.targetId,
      modelId: candidateRun.modelId,
      modelVersion: candidateRun.modelVersion,
      promptVersion: candidateRun.promptVersion,
      metrics: cand,
    },
    deltas,
    regressedScenarios,
    improvedScenarios,
    gatePassed: regressionFailures.length === 0,
    gateFailures: regressionFailures,
    policy,
  };
}
