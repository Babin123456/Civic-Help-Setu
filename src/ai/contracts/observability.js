/**
 * Contract Observability & Bounded Ring-Buffer Metrics
 *
 * Emits only allow-listed safe keys via diagnostics.js (no PII, raw queries,
 * credentials, or citizen records).
 */

import { logDiagnostic } from '../../utils/diagnostics.js';

const MAX_EVENTS = 100;
const contractEvents = [];

const counters = {
  validated: 0,
  rejected: 0,
  migrated: 0,
  retries: 0,
  deadlineExceeded: 0,
};

/**
 * Records a safe contract telemetry event in-memory and forwards safe metadata to diagnostics.
 * @param {string} event
 * @param {Object} [meta]
 */
export function recordContractEvent(event, meta = {}) {
  const safeEntry = {
    event,
    code: meta.code || null,
    status: meta.status || 'ok',
    kind: meta.kind || 'agent_contract',
    reason: meta.reason || null,
    attempt: typeof meta.attempt === 'number' ? meta.attempt : undefined,
    count: typeof meta.count === 'number' ? meta.count : undefined,
    timestamp: new Date().toISOString(),
  };

  if (contractEvents.length >= MAX_EVENTS) {
    contractEvents.shift();
  }
  contractEvents.push(safeEntry);

  if (event === 'contract_validated') counters.validated += 1;
  if (event === 'contract_rejected') counters.rejected += 1;
  if (event === 'contract_migrated') counters.migrated += 1;
  if (event === 'agent_retry') counters.retries += 1;
  if (meta.code === 'DEADLINE_EXCEEDED') counters.deadlineExceeded += 1;

  if (safeEntry.status === 'error') {
    logDiagnostic(`AgentContract:${event}`, {
      code: safeEntry.code,
      status: safeEntry.status,
      kind: safeEntry.kind,
      reason: safeEntry.reason,
      attempt: safeEntry.attempt,
    });
  }
}

export function getContractMetricsSnapshot() {
  return {
    counters: { ...counters },
    recentEventsCount: contractEvents.length,
    recentEvents: contractEvents.slice(-10),
  };
}

export function resetContractMetrics() {
  contractEvents.length = 0;
  counters.validated = 0;
  counters.rejected = 0;
  counters.migrated = 0;
  counters.retries = 0;
  counters.deadlineExceeded = 0;
}
