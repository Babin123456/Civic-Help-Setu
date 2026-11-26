/**
 * api/_lib/civicRecommendationExperimentationStore.js
 *
 * In-memory store implementation of the experimentation storage contract
 * for serverless API environments.
 */

export class InMemoryExperimentationStore {
  constructor() {
    this.experiments = new Map();
    this.metricsLog = [];
    this.auditLog = [];
  }

  getExperiment(id) {
    return this.experiments.get(id) || null;
  }

  setExperiment(id, exp) {
    this.experiments.set(id, JSON.parse(JSON.stringify(exp)));
  }

  listExperiments() {
    return Array.from(this.experiments.values());
  }

  addMetric(metric) {
    this.metricsLog.push(JSON.parse(JSON.stringify(metric)));
  }

  addAudit(audit) {
    this.auditLog.unshift(JSON.parse(JSON.stringify(audit)));
  }

  clear() {
    this.experiments.clear();
    this.metricsLog = [];
    this.auditLog = [];
  }
}

let globalStore = null;

export function getExperimentationStore() {
  if (!globalStore) {
    globalStore = new InMemoryExperimentationStore();
  }
  return globalStore;
}
