/**
 * api/_lib/civicContractTestMarketplaceStore.js
 *
 * Store contract for the Civic Service Integration Contract Test Marketplace
 * API. Implements an in-memory store by default (no Firebase required) so the
 * API is fully testable and degrades gracefully when Firestore is not
 * configured. Persists only provider adapter metadata, contract suite
 * definitions, test run results and audit logs — never citizen records,
 * credentials, raw documents or sensitive prompts.
 */

export class ContractTestStoreError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

/** In-memory implementation of the store contract. */
export class InMemoryContractTestStore {
  constructor() {
    this.adapters = new Map();
    this.suites = new Map();
    this.tests = new Map();
    this.runs = new Map();
    this.results = [];
    this.auditLog = [];
  }

  async getAdapter(adapterId) {
    return this.adapters.get(adapterId) || null;
  }

  async setAdapter(adapter) {
    this.adapters.set(adapter.id, adapter);
    return adapter;
  }

  async listAdapters() {
    return Array.from(this.adapters.values());
  }

  async getSuite(suiteId) {
    return this.suites.get(suiteId) || null;
  }

  async setSuite(suite) {
    this.suites.set(suite.id, suite);
    return suite;
  }

  async listSuites({ adapterId } = {}) {
    let items = Array.from(this.suites.values());
    if (adapterId) items = items.filter((s) => s.adapterId === adapterId);
    return items;
  }

  async getTest(testId) {
    return this.tests.get(testId) || null;
  }

  async setTest(test) {
    this.tests.set(test.id, test);
    return test;
  }

  async listTests({ suiteId } = {}) {
    let items = Array.from(this.tests.values());
    if (suiteId) items = items.filter((t) => t.suiteId === suiteId);
    return items;
  }

  async getRun(runId) {
    return this.runs.get(runId) || null;
  }

  async setRun(run) {
    this.runs.set(run.id, run);
    return run;
  }

  async listRuns({ suiteId, status, limit = 50, cursor } = {}) {
    let items = Array.from(this.runs.values());
    if (suiteId) items = items.filter((r) => r.suiteId === suiteId);
    if (status) items = items.filter((r) => r.status === status);
    items.sort((a, b) => new Date(b.completedAt || b.startedAt) - new Date(a.completedAt || a.startedAt));
    const start = cursor ? items.findIndex((r) => r.id === cursor) + 1 : 0;
    const page = items.slice(start, start + limit);
    return { runs: page, nextCursor: page.length === limit ? page[page.length - 1].id : null };
  }

  async getRunResults({ runId, limit = 1000 } = {}) {
    let items = this.results.filter((r) => r.runId === runId);
    items.sort((a, b) => new Date(b.timestamp || b.startedAt || '') - new Date(a.timestamp || a.startedAt || ''));
    return items.slice(0, limit);
  }

  async setRunResult(result) {
    this.results.push(result);
    return result;
  }

  async setSuiteResult(suiteId, suiteResult) {
    // Store suite-level rollup if needed
    return suiteResult;
  }

  async addAuditLog(event) {
    this.auditLog.push(event);
    return event;
  }

  async listAuditLog({ limit = 50 } = {}) {
    return this.auditLog.slice(0, limit);
  }
}

let defaultStore = null;
export function getContractTestStore() {
  if (!defaultStore) defaultStore = new InMemoryContractTestStore();
  return defaultStore;
}
export function resetContractTestStoreCacheForTests() {
  defaultStore = null;
}
