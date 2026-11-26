/**
 * api/_lib/civicAgentEvalStore.js
 *
 * Store contract for the Civic Agent Evaluation Harness (#1147).
 * Persists only redacted traces, aggregate metrics, regression reports, and
 * release threshold policies with bounded retention.
 */

import {
  DEFAULT_RELEASE_THRESHOLDS,
  EVAL_LIMITS,
} from '../../src/ai/evals/evalContracts.js';

export class InMemoryEvalHarnessStore {
  constructor() {
    this.runs = new Map();
    this.runOrder = [];
    this.comparisons = [];
    this.thresholds = { ...DEFAULT_RELEASE_THRESHOLDS };
  }

  async saveRun(run) {
    if (!run?.runId) throw new Error('Eval run requires runId');
    if (!this.runs.has(run.runId)) {
      this.runOrder.push(run.runId);
      while (this.runOrder.length > EVAL_LIMITS.MAX_STORED_RUNS) {
        const oldest = this.runOrder.shift();
        this.runs.delete(oldest);
      }
    }
    this.runs.set(run.runId, run);
    return run;
  }

  async getRun(runId) {
    return this.runs.get(runId) || null;
  }

  async listRuns({ limit = 25, targetId = null } = {}) {
    let items = Array.from(this.runs.values());
    if (targetId) {
      items = items.filter((r) => r.targetId === targetId);
    }
    items.sort((a, b) => Date.parse(b.completedAt || 0) - Date.parse(a.completedAt || 0));
    return items.slice(0, limit).map((r) => ({
      runId: r.runId,
      schemaVersion: r.schemaVersion,
      targetId: r.targetId,
      modelId: r.modelId,
      modelVersion: r.modelVersion,
      promptVersion: r.promptVersion,
      filters: r.filters,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      metrics: r.metrics,
      gate: r.gate,
    }));
  }

  async saveComparison(report) {
    this.comparisons.unshift(report);
    if (this.comparisons.length > EVAL_LIMITS.MAX_STORED_RUNS) {
      this.comparisons.pop();
    }
    return report;
  }

  async getThresholds() {
    return { ...this.thresholds };
  }

  async setThresholds(nextThresholds) {
    this.thresholds = { ...nextThresholds };
    return { ...this.thresholds };
  }
}

let defaultStore = null;

export function getDefaultEvalStore() {
  if (!defaultStore) defaultStore = new InMemoryEvalHarnessStore();
  return defaultStore;
}

export function resetDefaultEvalStoreForTests() {
  defaultStore = null;
}

export async function getProductionEvalStore() {
  return getDefaultEvalStore();
}
