/**
 * tests/fixtures/civicAgentPolicySyntheticFixtures.js
 *
 * Synthetic fixtures for the Civic Agent Workflow Policy-as-Code Engine (#1187).
 *
 * These are synthetic, non-citizen records: made-up policy ids, rule ids,
 * resource ids, roles and fabricated evaluation outcomes. No citizen records,
 * credentials, raw documents, or sensitive prompts are included. Safe to
 * commit and share.
 */

import {
  CIVIC_AGENT_POLICY_SCHEMA_VERSION,
  POLICY_ENGINE_STATUS,
  POLICY_ERRORS,
  EFFECT,
  RESOURCE_TYPE,
  DEFAULT_POLICY
} from '../src/data/civicAgentPolicyConstants.js';

const NOW = '2026-11-24T10:00:00Z';

/** A synthetic policy id. */
export function syntheticPolicyId(label) {
  return `policy-synth-${label}`;
}

/** A synthetic rule id. */
export function syntheticRuleId(label) {
  return `rule-synth-${label}`;
}

/** A synthetic resource id. */
export function syntheticResourceId(label) {
  return `resource-synth-${label}`;
}

/** A synthetic role. */
export function syntheticRole(label = 'citizen') {
  return `role-synth-${label}`;
}

/** A synthetic policy document. */
export function syntheticPolicy(overrides = {}) {
  return {
    id: overrides.id || syntheticPolicyId('default'),
    name: overrides.name || 'Synthetic policy',
    version: CIVIC_AGENT_POLICY_SCHEMA_VERSION,
    status: overrides.status || POLICY_ENGINE_STATUS.ACTIVE,
    description: overrides.description || 'A synthetic deny-by-default policy.',
    denyByDefault: overrides.denyByDefault !== false,
    emergencyLocked: Boolean(overrides.emergencyLocked),
    requireHumanApprovalForHighImpact: Boolean(overrides.requireHumanApprovalForHighImpact),
    rules: overrides.rules || [],
    createdAt: overrides.createdAt || NOW,
    updatedAt: overrides.updatedAt || NOW,
    disclaimer: DEFAULT_POLICY.disclaimer,
    noCitizenData: true,
    untrusted: true,
    requiresHumanReview: true,
    ...overrides
  };
}

/** A synthetic policy rule. */
export function syntheticRule(overrides = {}) {
  return {
    id: overrides.id || syntheticRuleId('allow-read'),
    description: overrides.description || 'Allow read access.',
    resourceType: overrides.resourceType || RESOURCE_TYPE.TOOL,
    resourceId: overrides.resourceId || syntheticResourceId('lookup'),
    effect: overrides.effect || EFFECT.ALLOW,
    conditions: overrides.conditions || [],
    conditionParams: overrides.conditionParams || {},
    requiresApproval: Boolean(overrides.requiresApproval),
    appliesToRoles: overrides.appliesToRoles || ['citizen'],
    priority: overrides.priority !== undefined ? overrides.priority : 10,
    expiresAt: overrides.expiresAt || null
  };
}

/** A synthetic evaluation request descriptor. */
export function syntheticEvaluationRequest(overrides = {}) {
  return {
    policyId: overrides.policyId || syntheticPolicyId('default'),
    workflowId: overrides.workflowId || 'workflow-synth',
    resourceType: overrides.resourceType || RESOURCE_TYPE.TOOL,
    resourceId: overrides.resourceId || syntheticResourceId('lookup'),
    action: overrides.action || 'read',
    role: overrides.role || 'citizen',
    citizenConfirmed: Boolean(overrides.citizenConfirmed),
    humanApproved: Boolean(overrides.humanApproved),
    sourceVerified: Boolean(overrides.sourceVerified),
    callSource: overrides.callSource || 'direct',
    dailyCallCount: overrides.dailyCallCount || 0,
    context: overrides.context || {},
    expectedDeny: Boolean(overrides.expectedDeny),
    nowIso: overrides.nowIso || NOW
  };
}

/** A synthetic evaluation decision. */
export function syntheticDecision(overrides = {}) {
  return {
    permitted: overrides.permitted ?? false,
    decision: overrides.decision || EFFECT.DENY,
    reason: overrides.reason || 'Denied by policy.',
    code: overrides.code || POLICY_ERRORS.DECISION_DENIED,
    policy: overrides.policy || { id: syntheticPolicyId('default'), name: 'Synthetic', version: 1 },
    rule: overrides.rule || null,
    explanation: overrides.explanation || 'Deny-by-default.',
    noCitizenData: true,
    untrusted: true
  };
}

/** A synthetic evaluation audit event. */
export function syntheticAuditEvent(overrides = {}) {
  return {
    id: overrides.id || `audit-synth-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
    action: overrides.action || 'policy.evaluate',
    policyId: overrides.policyId || syntheticPolicyId('default'),
    decision: overrides.decision || EFFECT.DENY,
    permitted: Boolean(overrides.permitted),
    resourceType: overrides.resourceType || RESOURCE_TYPE.TOOL,
    resourceId: overrides.resourceId || syntheticResourceId('lookup'),
    actionName: overrides.actionName || 'read',
    timestamp: overrides.timestamp || NOW
  };
}

/** A synthetic emergency revocation. */
export const syntheticEmergencyRevocation = (overrides = {}) => ({
  id: overrides.id || `revoke-synth-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
  policyId: overrides.policyId || syntheticPolicyId('default'),
  reason: overrides.reason || 'Synthetic emergency revocation.',
  revokedBy: overrides.revokedBy || 'simulation',
  revokedAt: overrides.revokedAt || NOW,
  status: overrides.status || 'active',
  schemaVersion: CIVIC_AGENT_POLICY_SCHEMA_VERSION
});

export { NOW, CIVIC_AGENT_POLICY_SCHEMA_VERSION, POLICY_ENGINE_STATUS, POLICY_ERRORS, EFFECT, RESOURCE_TYPE };
