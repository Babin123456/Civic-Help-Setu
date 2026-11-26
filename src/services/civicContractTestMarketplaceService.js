/**
 * src/services/civicContractTestMarketplaceService.js
 *
 * Client-facing service for the Civic Service Integration Contract Test
 * Marketplace (#1191). Wraps the local marketplace engine (in-memory /
 * localStorage-backed store) so the workspace operates fully in the browser.
 * When a server backend is added, these functions can be switched to fetch
 * /api/civic-contract-test-marketplace endpoints without changing the UI.
 *
 * Persists only provider adapter metadata, contract suite definitions, test
 * run results and audit logs. No citizen records, credentials, raw documents
 * or sensitive prompts are sent or stored.
 */

import { createContractTestMarketplaceEngine } from './civicContractTestMarketplaceEngine.js';

const engine = createContractTestMarketplaceEngine();

export async function upsertAdapter(input = {}) {
  return engine.upsertAdapter(input);
}

export async function listAdapters() {
  return engine.listAdapters();
}

export async function getAdapter(adapterId) {
  return engine.getAdapter(adapterId);
}

export async function upsertSuite(input = {}) {
  return engine.upsertSuite(input);
}

export async function listSuites(input = {}) {
  return engine.listSuites(input);
}

export async function getSuite(suiteId) {
  return engine.getSuite(suiteId);
}

export async function runSuite(input = {}) {
  return engine.runSuite(input);
}

export async function getRun(runId) {
  return engine.getRun(runId);
}

export async function listRuns(input = {}) {
  return engine.listRuns(input);
}

export async function getRunResults(input = {}) {
  return engine.getRunResults(input);
}

export async function getAuditLog(input = {}) {
  return engine.getAuditLog(input);
}

export async function listFeatureWeights() {
  return engine.listFeatureWeights();
}

export { engine };
export { createContractTestMarketplaceEngine } from './civicContractTestMarketplaceEngine.js';

export {
  CONTRACT_TEST_STATUS,
  CONTRACT_TEST_ERRORS,
  CONTRACT_TEST_RESULT,
  ADAPTER_TYPE,
  TEST_TYPE,
  CONTRACT_SUITE_STATUS,
  DEFAULT_ADAPTER,
  DEFAULT_CONTRACT_SUITE,
  DEFAULT_CONTRACT_TEST,
  DEFAULT_CONTRACT_TEST_RUN
} from '../data/civicContractTestMarketplaceConstants.js';

export default {
  upsertAdapter,
  listAdapters,
  getAdapter,
  upsertSuite,
  listSuites,
  getSuite,
  runSuite,
  getRun,
  listRuns,
  getRunResults,
  getAuditLog,
  listFeatureWeights
};
