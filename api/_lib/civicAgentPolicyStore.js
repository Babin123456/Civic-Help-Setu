/**
 * api/_lib/civicAgentPolicyStore.js
 *
 * Store contract for the Civic Agent Workflow Policy-as-Code Engine API.
 * Implements an in-memory store by default (no Firebase required) so the API
 * is fully testable and degrades gracefully when Firestore is not configured.
 * Persists only policy documents, rule metadata and evaluation audit records
 * (aggregated, no sensitive prompts).
 */

export class PolicyStoreError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

/** In-memory implementation of the store contract. */
export class InMemoryPolicyStore {
  constructor() {
    this.policies = new Map();
    this.policyVersions = new Map();
    this.evaluationAudit = [];
    this.emergencyRevocations = [];
  }

  async getPolicy(policyId) {
    return this.policies.get(policyId) || null;
  }

  async setPolicy(policy) {
    this.policies.set(policy.id, policy);
    return policy;
  }

  async listPolicies() {
    return Array.from(this.policies.values());
  }

  async setPolicyVersion(version) {
    this.policyVersions.set(`${version.id}:${version.version}`, version);
    return version;
  }

  async listPolicyVersions({ policyId, limit = 50, cursor } = {}) {
    let items = Array.from(this.policyVersions.values());
    if (policyId) items = items.filter((v) => v.id === policyId);
    items.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    const start = cursor ? items.findIndex((v) => `${v.id}:${v.version}` === cursor) + 1 : 0;
    const page = items.slice(start, start + limit);
    return { versions: page, nextCursor: page.length === limit ? `${page[page.length - 1].id}:${page[page.length - 1].version}` : null };
  }

  async addEvaluationEvent(event) {
    this.evaluationAudit.push(event);
    return event;
  }

  async listEvaluationEvents({ policyId, limit = 50 } = {}) {
    let items = this.evaluationAudit;
    if (policyId) items = items.filter((e) => (e.details && e.details.policyId) === policyId);
    return items.slice(-limit);
  }

  async addEmergencyRevocation(revocation) {
    this.emergencyRevocations.push(revocation);
    return revocation;
  }

  async listEmergencyRevocations({ limit = 50 } = {}) {
    return this.emergencyRevocations.slice(-limit);
  }
}

let defaultStore = null;
export function getDefaultPolicyStore() {
  if (!defaultStore) defaultStore = new InMemoryPolicyStore();
  return defaultStore;
}
export function resetDefaultPolicyStoreForTests() {
  defaultStore = null;
}

export async function getProductionPolicyStore() {
  // No Firestore integration in this repo today; degrade to in-memory so the
  // API still functions. When Firestore is added, implement here.
  return getDefaultPolicyStore();
}
export function resetProductionPolicyStoreCacheForTests() {
  resetDefaultPolicyStoreForTests();
}
