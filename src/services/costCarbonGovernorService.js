/**
 * src/services/costCarbonGovernorService.js
 *
 * Client-facing service for the Civic Agent Cost and Carbon Budget Governor
 * (#1185). Wraps the local governor (in-memory / localStorage-backed store)
 * so the workspace operates fully in the browser. When a server backend is
 * added, these functions can be switched to fetch /api/civic-agent-cost-carbon
 * endpoints without changing the UI.
 *
 * Persists only aggregated cost/token/latency/carbon metadata. No citizen
 * records, credentials, raw documents or sensitive prompts are sent or stored.
 */

import { createCostCarbonGovernor } from './civicAgentCostCarbonGovernor.js';

const governor = createCostCarbonGovernor();

export async function startRun(input = {}) {
  return governor.startRun(input);
}

export async function recordCall(input = {}) {
  return governor.recordCall(input);
}

export async function stopRun(input = {}) {
  return governor.stopRun(input);
}

export async function getRun(runId) {
  return governor.getRun(runId);
}

export async function getWorkflowAggregate(workflowId) {
  return governor.getWorkflowAggregate(workflowId);
}

export async function listPolicies() {
  return governor.listPolicies();
}

export { governor, createCostCarbonGovernor };

export default {
  startRun,
  recordCall,
  stopRun,
  getRun,
  getWorkflowAggregate,
  listPolicies,
};
