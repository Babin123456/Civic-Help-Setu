/**
 * src/services/recommendationFairnessAuditStorage.js
 *
 * Offline-first persistence and API client wrapper for the Civic Recommendation
 * Fairness and Coverage Audit Suite (#1449).
 */

import {
  DEFAULT_AUDIT_POLICY,
  migrateAuditStoreState,
} from './recommendationFairnessAuditContract.js';
import {
  getBuiltInOfflineEvaluationDatasets,
  runFairnessAndCoverageAudit,
} from './recommendationFairnessAuditService.js';

export const FAIRNESS_AUDIT_STORAGE_KEY = 'civicbridge_fairness_audit_v1';

let memoryFallback = null;

function getStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Ignore storage access errors in restricted contexts
  }
  return null;
}

export function loadLocalFairnessAuditState() {
  const storage = getStorage();
  if (storage) {
    try {
      const raw = storage.getItem(FAIRNESS_AUDIT_STORAGE_KEY);
      if (raw) {
        return migrateAuditStoreState(JSON.parse(raw));
      }
    } catch {
      // Fall back to defaults on corrupt localStorage
    }
  }
  if (memoryFallback) {
    return migrateAuditStoreState(memoryFallback);
  }
  const builtInDatasets = getBuiltInOfflineEvaluationDatasets();
  const initialRun = runFairnessAndCoverageAudit({
    dataset: builtInDatasets[0],
    cohortAxis: 'language',
    policy: DEFAULT_AUDIT_POLICY,
  });
  return migrateAuditStoreState({
    datasets: builtInDatasets,
    runs: [initialRun],
    policy: DEFAULT_AUDIT_POLICY,
  });
}

export function saveLocalFairnessAuditState(state) {
  const migrated = migrateAuditStoreState(state);
  memoryFallback = migrated;
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(FAIRNESS_AUDIT_STORAGE_KEY, JSON.stringify(migrated));
    } catch {
      // Ignore quota exceeded
    }
  }
  return migrated;
}

export function resetLocalFairnessAuditState() {
  memoryFallback = null;
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(FAIRNESS_AUDIT_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
}

export async function runLocalOrRemoteAudit({ datasetId, cohortAxis, baselineRunId = null, authToken = null }) {
  const state = loadLocalFairnessAuditState();
  const dataset = state.datasets.find((d) => d.id === datasetId) || state.datasets[0];
  if (!dataset) {
    throw new Error('No evaluation dataset available.');
  }
  const baselineRun = baselineRunId ? state.runs.find((r) => r.runId === baselineRunId) || null : null;

  if (typeof fetch === 'function' && authToken && (typeof navigator === 'undefined' || navigator.onLine)) {
    try {
      const res = await fetch('/api/recommendation-fairness-audit/runs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ datasetId: dataset.id, cohortAxis, baselineRunId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.run) {
          const nextRuns = [data.run, ...state.runs].slice(0, 25);
          saveLocalFairnessAuditState({ ...state, runs: nextRuns });
          return { run: data.run, source: 'remote' };
        }
      }
    } catch {
      // Fall back to deterministic offline evaluation
    }
  }

  const run = runFairnessAndCoverageAudit({
    dataset,
    cohortAxis,
    policy: state.policy,
    baselineRun,
  });
  const nextRuns = [run, ...state.runs].slice(0, 25);
  saveLocalFairnessAuditState({ ...state, runs: nextRuns });
  return { run, source: 'offline_local' };
}

