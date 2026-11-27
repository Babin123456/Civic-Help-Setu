/**
 * src/services/civicAgentPolicyService.js
 *
 * Client-facing service for the Civic Agent Workflow Policy-as-Code Engine
 * (#1187). Wraps the local policy engine (in-memory / localStorage-backed
 * store) so the workspace operates fully in the browser. When a server
 * backend is added, these functions can be switched to fetch
 * /api/civic-agent-policy endpoints without changing the UI.
 *
 * Persists only policy documents, rule metadata and evaluation audit records
 * (aggregated, no sensitive prompts).
 */

import { createPolicyEngine } from './civicAgentPolicyEngine.js';

const engine = createPolicyEngine();

export async function evaluate(input = {}) {
  return engine.evaluate(input);
}

export async function upsertPolicy(input = {}) {
  return engine.upsertPolicy(input);
}

export async function emergencyRevoke(input = {}) {
  return engine.emergencyRevoke(input);
}

export async function listPolicies() {
  return engine.listPolicies();
}

export async function getPolicy(policyId) {
  return engine.getPolicy(policyId);
}

export async function getPolicyVersions(input = {}) {
  return engine.getPolicyVersions(input);
}

export async function getEvaluationAudit(input = {}) {
  return engine.getEvaluationAudit(input);
}

export { createPolicyEngine } from './civicAgentPolicyEngine.js';
export { policyEngine as engine } from './civicAgentPolicyEngine.js';

export default {
  evaluate,
  upsertPolicy,
  emergencyRevoke,
  listPolicies,
  getPolicy,
  getPolicyVersions,
  getEvaluationAudit,
};
