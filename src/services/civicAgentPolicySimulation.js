/**
 * src/services/civicAgentPolicySimulation.js
 *
 * Policy simulation for the Civic Agent Workflow Policy-as-Code Engine (#1187).
 *
 * Simulates policy decisions against hypothetical (synthetic) requests to:
 *  - Test bypass attempts (actions that should be denied but might slip through).
 *  - Test conflicting policies (multiple rules matching with different effects).
 *  - Test emergency revocation (policy locked mid-evaluation).
 *  - Validate that deny-by-default holds for unknown resources.
 *
 * All inputs are synthetic, non-citizen records. No citizen records,
 * credentials, raw documents or sensitive prompts are used or persisted.
 * Simulation results are aggregates only and never presented as official
 * decisions.
 */

import { createPolicyEngine } from './civicAgentPolicyEngine.js';
import { resetPolicyStoreToEmpty, createSeedStore, persistPolicyStore } from './civicAgentPolicyMigrations.js';
import {
  CIVIC_AGENT_POLICY_SCHEMA_VERSION,
  POLICY_ENGINE_STATUS,
  POLICY_ERRORS,
  EFFECT,
  RESOURCE_TYPE,
  DEFAULT_POLICY
} from '../data/civicAgentPolicyConstants.js';


/**
 * Build a default deny-by-default policy with a set of rules.
 */
function buildDefaultPolicy(overrides = {}) {
  return {
    id: 'policy-sim-default',
    name: 'Simulation default policy',
    version: CIVIC_AGENT_POLICY_SCHEMA_VERSION,
    status: POLICY_ENGINE_STATUS.ACTIVE,
    denyByDefault: true,
    emergencyLocked: false,
    requireHumanApprovalForHighImpact: true,
    rules: [
      {
        id: 'allow-read-catalogue',
        description: 'Allow read-only catalogue lookups.',
        resourceType: RESOURCE_TYPE.TOOL,
        resourceId: 'lookupServiceDetails',
        effect: EFFECT.ALLOW,
        conditions: ['read_only'],
        conditionParams: {},
        requiresApproval: false,
        appliesToRoles: ['citizen', 'admin'],
        priority: 10,
        expiresAt: null
      },
      {
        id: 'allow-save-draft-confirmed',
        description: 'Allow saving drafts when citizen confirmed.',
        resourceType: RESOURCE_TYPE.TOOL,
        resourceId: 'saveApplicationDraft',
        effect: EFFECT.ALLOW,
        conditions: ['citizen_confirmed'],
        conditionParams: {},
        requiresApproval: false,
        appliesToRoles: ['citizen'],
        priority: 20,
        expiresAt: null
      },
      {
        id: 'deny-vault-access',
        description: 'Deny all vault access.',
        resourceType: RESOURCE_TYPE.SOURCE,
        resourceId: 'vault',
        effect: EFFECT.DENY,
        conditions: [],
        conditionParams: {},
        requiresApproval: false,
        appliesToRoles: ['*'],
        priority: 100,
        expiresAt: null
      },
      ...(overrides.rules || [])
    ],
    createdAt: '2026-11-24T00:00:00Z',
    updatedAt: '2026-11-24T00:00:00Z',
    disclaimer: DEFAULT_POLICY.disclaimer,
    noCitizenData: true,
    untrusted: true,
    requiresHumanReview: true,
    ...overrides
  };
}

/**
 * Seed the store with a policy and return a fresh engine.
 */
function seedEngine() {
  resetPolicyStoreToEmpty({ now: new Date('2026-11-24T00:00:00Z') });
  const store = createSeedStore({ now: new Date('2026-11-24T00:00:00Z') });
  // Replace default policy with simulation default.
  store.policies[0] = buildDefaultPolicy();
  store.policyVersions[0] = JSON.parse(JSON.stringify(store.policies[0]));
  persistPolicyStore(store, { now: new Date('2026-11-24T00:00:00Z') });
  return createPolicyEngine();
}

/**
 * Simulate a batch of hypothetical requests against a policy and report
 * whether deny-by-default held and whether any bypass was detected.
 *
 * @param {Object} options
 * @param {Array<Object>} options.requests - synthetic request descriptors
 * @param {Object} [options.policy] - optional custom policy (defaults to sim default)
 * @param {boolean} [options.emergencyRevokeMidway] - revoke policy after N requests
 * @returns {Promise<Object>} simulation result
 */
export async function simulatePolicyDecisions({
  requests = [],
  policy,
  emergencyRevokeMidway = false
} = {}) {
  if (!Array.isArray(requests)) {
    return { ok: false, error: { code: POLICY_ERRORS.VALIDATION_FAILED, message: 'requests must be an array.' } };
  }

  const engine = seedEngine();

  // Apply custom policy if provided.
  if (policy) {
    const upserted = engine.upsertPolicy(policy);
    if (!upserted.ok) {
      return { ok: false, error: upserted.error };
    }
  }

  const results = [];
  let bypassCount = 0;
  let deniedCount = 0;
  let approvedCount = 0;
  let approvalRequiredCount = 0;
  let revokedAt = null;

  for (let index = 0; index < requests.length; index += 1) {
    const req = requests[index];
    // Simulate emergency revocation midway.
    if (emergencyRevokeMidway && index === Math.floor(requests.length / 2) && !revokedAt) {
      const revoked = await engine.emergencyRevoke({
        policyId: (policy && policy.id) || 'policy-sim-default',
        reason: 'Simulation emergency revocation.',
        revokedBy: 'simulation',
        nowIso: '2026-11-24T00:00:30Z'
      });
      if (revoked.ok) revokedAt = index;
    }

    const decision = await engine.evaluate({
      policyId: (policy && policy.id) || 'policy-sim-default',
      workflowId: req.workflowId || 'workflow-sim',
      resourceType: req.resourceType || RESOURCE_TYPE.TOOL,
      resourceId: req.resourceId || `resource-${index}`,
      action: req.action || 'read',
      role: req.role || 'citizen',
      citizenConfirmed: Boolean(req.citizenConfirmed),
      humanApproved: Boolean(req.humanApproved),
      sourceVerified: Boolean(req.sourceVerified),
      callSource: req.callSource || 'direct',
      dailyCallCount: req.dailyCallCount || 0,
      context: req.context || {},
      nowIso: '2026-11-24T00:00:00Z'
    });

    const isBypass = req.expectedDeny && decision.permitted;
    if (isBypass) bypassCount += 1;
    if (decision.permitted) approvedCount += 1;
    else if (decision.decision === EFFECT.REQUIRE_APPROVAL) approvalRequiredCount += 1;
    else deniedCount += 1;

    results.push({
      index,
      request: {
        resourceType: req.resourceType,
        resourceId: req.resourceId,
        action: req.action,
        role: req.role,
        citizenConfirmed: req.citizenConfirmed,
        expectedDeny: req.expectedDeny
      },
      decision: {
        permitted: decision.permitted,
        decision: decision.decision,
        reason: decision.reason,
        code: decision.code,
        rule: decision.rule
      },
      bypassDetected: isBypass,
      denyByDefaultHeld: !req.expectedDeny || !decision.permitted
    });
  }

  const total = results.length;
  const bypassDetected = bypassCount > 0;
  const denyByDefaultHeld = deniedCount + approvalRequiredCount === total - approvedCount;

  return {
    ok: true,
    total,
    approvedCount,
    deniedCount,
    approvalRequiredCount,
    bypassCount,
    bypassDetected,
    denyByDefaultHeld,
    emergencyRevokedAt: revokedAt,
    results,
    disclaimer: DEFAULT_POLICY.disclaimer,
    noCitizenData: true,
    untrusted: true,
    simulated: true
  };
}

/**
 * Simulate conflicting policies: two rules matching the same resource with
 * different effects. Higher priority should win.
 */
export async function simulateConflictResolution() {
  const engine = seedEngine();

  const conflicting = buildDefaultPolicy({
    id: 'policy-sim-conflict',
    rules: [
      {
        id: 'allow-tool-low',
        description: 'Low priority allow.',
        resourceType: RESOURCE_TYPE.TOOL,
        resourceId: 'conflictTool',
        effect: EFFECT.ALLOW,
        conditions: [],
        conditionParams: {},
        requiresApproval: false,
        appliesToRoles: ['citizen'],
        priority: 5,
        expiresAt: null
      },
      {
        id: 'deny-tool-high',
        description: 'High priority deny.',
        resourceType: RESOURCE_TYPE.TOOL,
        resourceId: 'conflictTool',
        effect: EFFECT.DENY,
        conditions: [],
        conditionParams: {},
        requiresApproval: false,
        appliesToRoles: ['citizen'],
        priority: 50,
        expiresAt: null
      }
    ]
  });

  await engine.upsertPolicy(conflicting);

  const allowed = await engine.evaluate({
    policyId: 'policy-sim-conflict',
    resourceType: RESOURCE_TYPE.TOOL,
    resourceId: 'conflictTool',
    action: 'read',
    role: 'citizen',
    nowIso: '2026-11-24T00:00:00Z'
  });

  return {
    ok: true,
    higherPriorityWins: !allowed.permitted && allowed.decision === EFFECT.DENY,
    decision: {
      permitted: allowed.permitted,
      decision: allowed.decision,
      reason: allowed.reason,
      code: allowed.code
    },
    disclaimer: DEFAULT_POLICY.disclaimer,
    noCitizenData: true,
    untrusted: true,
    simulated: true
  };
}

/**
 * Simulate emergency revocation: evaluate before and after revocation.
 */
export async function simulateEmergencyRevocation() {
  const engine = seedEngine();

  const before = await engine.evaluate({
    policyId: 'policy-sim-default',
    resourceType: RESOURCE_TYPE.TOOL,
    resourceId: 'lookupServiceDetails',
    action: 'read',
    role: 'citizen',
    citizenConfirmed: true,
    nowIso: '2026-11-24T00:00:00Z'
  });

  const revoked = await engine.emergencyRevoke({
    policyId: 'policy-sim-default',
    reason: 'Simulation emergency revocation.',
    revokedBy: 'simulation',
    nowIso: '2026-11-24T00:00:05Z'
  });

  const after = await engine.evaluate({
    policyId: 'policy-sim-default',
    resourceType: RESOURCE_TYPE.TOOL,
    resourceId: 'lookupServiceDetails',
    action: 'read',
    role: 'citizen',
    citizenConfirmed: true,
    nowIso: '2026-11-24T00:00:10Z'
  });

  return {
    ok: true,
    revoked: revoked.ok,
    before: { permitted: before.permitted, decision: before.decision, code: before.code },
    after: { permitted: after.permitted, decision: after.decision, code: after.code },
    revocationSuspendedActions: before.permitted && !after.permitted,
    disclaimer: DEFAULT_POLICY.disclaimer,
    noCitizenData: true,
    untrusted: true,
    simulated: true
  };
}

/**
 * Simulate deny-by-default: unknown resource with no matching rule must be denied.
 */
export async function simulateDenyByDefault() {
  const engine = seedEngine();

  const unknown = await engine.evaluate({
    policyId: 'policy-sim-default',
    resourceType: RESOURCE_TYPE.TOOL,
    resourceId: 'tool-that-does-not-exist',
    action: 'execute',
    role: 'citizen',
    nowIso: '2026-11-24T00:00:00Z'
  });

  const noPolicy = await engine.evaluate({
    policyId: 'policy-nonexistent',
    resourceType: RESOURCE_TYPE.TOOL,
    resourceId: 'lookupServiceDetails',
    action: 'read',
    role: 'citizen',
    nowIso: '2026-11-24T00:00:00Z'
  });

  return {
    ok: true,
    unknownResourceDenied: !unknown.permitted && unknown.code === POLICY_ERRORS.DECISION_DENIED,
    missingPolicyDenied: !noPolicy.permitted && noPolicy.code === POLICY_ERRORS.POLICY_NOT_FOUND,
    denyByDefault: !unknown.permitted && !noPolicy.permitted,
    decisions: {
      unknown: { permitted: unknown.permitted, code: unknown.code },
      noPolicy: { permitted: noPolicy.permitted, code: noPolicy.code }
    },
    disclaimer: DEFAULT_POLICY.disclaimer,
    noCitizenData: true,
    untrusted: true,
    simulated: true
  };
}

export const __testables = {
  simulatePolicyDecisions,
  simulateConflictResolution,
  simulateEmergencyRevocation,
  simulateDenyByDefault,
  buildDefaultPolicy,
  seedEngine,
  EFFECT,
  RESOURCE_TYPE,
  POLICY_ENGINE_STATUS,
  POLICY_ERRORS
};
