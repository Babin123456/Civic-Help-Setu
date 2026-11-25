/**
 * api/_lib/civicAgentCostCarbonStore.js
 *
 * Store contract for the Civic Agent Cost and Carbon Budget Governor API.
 * Implements an in-memory store by default (no Firebase required) so the API
 * is fully testable and degrades gracefully when Firestore is not configured.
 * Persists only aggregated cost/token/latency/carbon metadata — never citizen
 * records, credentials, raw documents or sensitive prompts.
 */

export class CostCarbonStoreError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

/** In-memory implementation of the store contract. */
export class InMemoryCostCarbonStore {
  constructor() {
    this.runs = new Map();
    this.calls = new Map();
    this.policies = new Map();
    this.auditEvents = [];
  }

  async getRun(runId) {
    return this.runs.get(runId) || null;
  }

  async setRun(run) {
    this.runs.set(run.id, run);
    return run;
  }

  async listRuns({ workflowId, status, limit = 50, cursor } = {}) {
    let items = Array.from(this.runs.values());
    if (workflowId) items = items.filter((r) => r.workflowId === workflowId);
    if (status) items = items.filter((r) => r.status === status);
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const start = cursor ? items.findIndex((r) => r.id === cursor) + 1 : 0;
    const page = items.slice(start, start + limit);
    return { runs: page, nextCursor: page.length === limit ? page[page.length - 1].id : null };
  }

  async getCall(callId) {
    return this.calls.get(callId) || null;
  }

  async setCall(call) {
    this.calls.set(call.id, call);
    return call;
  }

  async listCalls({ runId, limit = 50, cursor } = {}) {
    let items = Array.from(this.calls.values());
    if (runId) items = items.filter((c) => c.runId === runId);
    items.sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));
    const start = cursor ? items.findIndex((c) => c.id === cursor) + 1 : 0;
    const page = items.slice(start, start + limit);
    return { calls: page, nextCursor: page.length === limit ? page[page.length - 1].id : null };
  }

  async setPolicy(policy) {
    this.policies.set(policy.id, policy);
    return policy;
  }

  async getPolicy(policyId) {
    return this.policies.get(policyId) || null;
  }

  async listPolicies() {
    return Array.from(this.policies.values());
  }

  async addAuditEvent(event) {
    this.auditEvents.push(event);
    return event;
  }

  async listAuditEvents({ limit = 50 } = {}) {
    return this.auditEvents.slice(-limit);
  }
}

let defaultStore = null;
export function getDefaultCostCarbonStore() {
  if (!defaultStore) defaultStore = new InMemoryCostCarbonStore();
  return defaultStore;
}
export function resetDefaultCostCarbonStoreForTests() {
  defaultStore = null;
}

export async function getProductionCostCarbonStore() {
  // No Firestore integration in this repo today; degrade to in-memory so the
  // API still functions. When Firestore is added, implement here.
  return getDefaultCostCarbonStore();
}
export function resetProductionCostCarbonStoreCacheForTests() {
  resetDefaultCostCarbonStoreForTests();
}
