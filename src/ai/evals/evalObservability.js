/**
 * Civic Agent Evaluation Harness — Safe Observability
 *
 * Emits only allow-listed counters and non-PII event metadata into a bounded
 * in-memory ring buffer and diagnostics helper.
 */

import { logDiagnostic } from '../../utils/diagnostics.js';

const MAX_EVENTS = 100;
const evalEvents = [];
const counters = {
  runsStarted: 0,
  runsCompleted: 0,
  gatePassed: 0,
  gateFailed: 0,
  scenariosRetried: 0,
  redactionsApplied: 0,
  prohibitedOutcomesDetected: 0,
};

export function recordEvalEvent(event, meta = {}) {
  const safeEvent = {
    event: String(event || 'unknown'),
    runId: meta.runId ? String(meta.runId) : null,
    targetId: meta.targetId ? String(meta.targetId) : null,
    status: meta.status ? String(meta.status) : 'ok',
    count: typeof meta.count === 'number' ? meta.count : undefined,
    reason: meta.reason ? String(meta.reason) : null,
    timestamp: new Date().toISOString(),
  };

  if (evalEvents.length >= MAX_EVENTS) {
    evalEvents.shift();
  }
  evalEvents.push(safeEvent);

  if (event === 'eval_run_started') counters.runsStarted += 1;
  if (event === 'eval_run_completed') counters.runsCompleted += 1;
  if (event === 'eval_gate_passed') counters.gatePassed += 1;
  if (event === 'eval_gate_failed') counters.gateFailed += 1;
  if (event === 'eval_scenario_retried') counters.scenariosRetried += 1;
  if (event === 'eval_redaction_applied') counters.redactionsApplied += 1;
  if (event === 'eval_prohibited_outcome') counters.prohibitedOutcomesDetected += 1;

  if (safeEvent.status === 'error' || event === 'eval_gate_failed' || event === 'eval_prohibited_outcome') {
    logDiagnostic(`EvalHarness:${safeEvent.event}`, {
      runId: safeEvent.runId,
      targetId: safeEvent.targetId,
      status: safeEvent.status,
      reason: safeEvent.reason,
    });
  }
}

export function getEvalObservabilitySnapshot() {
  return {
    counters: { ...counters },
    recentEvents: evalEvents.slice(-15),
  };
}

export function resetEvalObservability() {
  evalEvents.length = 0;
  for (const key of Object.keys(counters)) {
    counters[key] = 0;
  }
}
