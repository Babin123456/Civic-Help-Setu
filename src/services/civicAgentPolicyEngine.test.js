/**
 * src/services/civicAgentPolicyEngine.test.js
 *
 * Unit tests for the Civic Agent Workflow Policy-as-Code Engine (#1187).
 * Covers deny-by-default, evaluation before tool calls/state transitions,
 * versioning, emergency revocation, bypass attempts, conflicting policies,
 * permissions and concurrency.
 *
 * Synthetic fixtures only: no citizen records, credentials, raw documents or
 * sensitive prompts.
 */

import { describe, it, expect } from 'vitest';
import { createPolicyEngine } from './civicAgentPolicyEngine.js';
import {
  resetPolicyStoreToEmpty,
  createSeedStore,
  persistPolicyStore
} from './civicAgentPolicyMigrations.js';
import {
  POLICY_ENGINE_STATUS,
  POLICY_ERRORS,
  EFFECT,
  RESOURCE_TYPE,
  DEFAULT_POLICY
} from '../data/civicAgentPolicyConstants.js';

const FIXED_NOW = new Date('2026-11-24T10:00:00Z');

function freshEngine() {
  resetPolicyStoreToEmpty({ now: FIXED_NOW });
  const seeded = createSeedStore({ now: FIXED_NOW });
  persistPolicyStore(seeded, { now: FIXED_NOW });
  return createPolicyEngine({ now: () => FIXED_NOW.getTime() });
}

const ALLOW_RULE = {
  id: 'allow-read-catalogue',
  description: 'Allow read-only catalogue lookups.',
  resourceType: RESOURCE_TYPE.TOOL,
  resourceId: 'lookupServiceDetails',
  effect: EFFECT.ALLOW,
  conditions: [],
  conditionParams: {},
  requiresApproval: false,
  appliesToRoles: ['citizen', 'admin'],
  priority: 10,
  expiresAt: null
};

const CONFIRM_RULE = {
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
};

const HIGH_IMPACT_RULE = {
  id: 'require-approval-state-change',
  description: 'State change needs human approval.',
  resourceType: RESOURCE_TYPE.STATE_TRANSITION,
  resourceId: 'fileApplication',
  effect: EFFECT.REQUIRE_APPROVAL,
  conditions: [],
  conditionParams: {},
  requiresApproval: true,
  appliesToRoles: ['citizen'],
  priority: 30,
  expiresAt: null
};

describe('civicAgentPolicyEngine', () => {
  describe('validation', () => {
    it('rejects non-object requests', () => {
      const e = freshEngine();
      const v = e.validateEngineRequest(null);
      expect(v.valid).toBe(false);
      expect(v.errors[0].code).toBe(POLICY_ERRORS.INVALID_TYPE);
    });

    it('rejects sensitive values', () => {
      const e = freshEngine();
      const v = e.validateEngineRequest({ resourceId: 'My Aadhaar 1234 5678 9012' });
      expect(v.valid).toBe(false);
      expect(v.errors.some((err) => err.code === POLICY_ERRORS.INVALID_TYPE)).toBe(true);
    });

    it('accepts a valid minimal request', () => {
      const e = freshEngine();
      const v = e.validateEngineRequest({ resourceType: RESOURCE_TYPE.TOOL, resourceId: 'x', action: 'read' });
      expect(v.valid).toBe(true);
    });
  });

  describe('evaluate', () => {
    it('denies by default when no matching allow rule', async () => {
      const e = freshEngine();
      const decision = await e.evaluate({
        resourceType: RESOURCE_TYPE.TOOL,
        resourceId: 'unknown-tool',
        action: 'read',
        role: 'citizen',
        nowIso: FIXED_NOW
      });
      expect(decision.permitted).toBe(false);
      expect(decision.decision).toBe(EFFECT.DENY);
      expect(decision.code).toBe(POLICY_ERRORS.DECISION_DENIED);
      expect(decision.noCitizenData).toBe(true);
      expect(decision.untrusted).toBe(true);
    });

    it('allows when a matching allow rule exists', async () => {
      const e = freshEngine();
      const seeded = createSeedStore({ now: FIXED_NOW });
      seeded.policies[0].rules = [ALLOW_RULE];
      persistPolicyStore(seeded, { now: FIXED_NOW });

      const decision = await e.evaluate({
        resourceType: RESOURCE_TYPE.TOOL,
        resourceId: 'lookupServiceDetails',
        action: 'read',
        role: 'citizen',
        nowIso: FIXED_NOW
      });
      expect(decision.permitted).toBe(true);
      expect(decision.decision).toBe(EFFECT.ALLOW);
      expect(decision.code).toBe('APPROVED');
    });

    it('denies state change requiring approval when not approved', async () => {
      const e = freshEngine();
      const seeded = createSeedStore({ now: FIXED_NOW });
      seeded.policies[0].rules = [HIGH_IMPACT_RULE];
      persistPolicyStore(seeded, { now: FIXED_NOW });

      const decision = await e.evaluate({
        resourceType: RESOURCE_TYPE.STATE_TRANSITION,
        resourceId: 'fileApplication',
        action: 'submit',
        role: 'citizen',
        humanApproved: false,
        nowIso: FIXED_NOW
      });
      expect(decision.permitted).toBe(false);
      expect(decision.decision).toBe(EFFECT.REQUIRE_APPROVAL);
      expect(decision.code).toBe(POLICY_ERRORS.DECISION_REQUIRES_APPROVAL);
      expect(decision.requiresHumanReview).toBe(true);
    });

    it('allows state change when human approved', async () => {
      const e = freshEngine();
      const seeded = createSeedStore({ now: FIXED_NOW });
      seeded.policies[0].rules = [HIGH_IMPACT_RULE];
      persistPolicyStore(seeded, { now: FIXED_NOW });

      const decision = await e.evaluate({
        resourceType: RESOURCE_TYPE.STATE_TRANSITION,
        resourceId: 'fileApplication',
        action: 'submit',
        role: 'citizen',
        humanApproved: true,
        nowIso: FIXED_NOW
      });
      expect(decision.permitted).toBe(true);
      expect(decision.decision).toBe(EFFECT.ALLOW);
    });

    it('requires citizen confirmation for confirmation-gated rule', async () => {
      const e = freshEngine();
      const seeded = createSeedStore({ now: FIXED_NOW });
      seeded.policies[0].rules = [CONFIRM_RULE];
      persistPolicyStore(seeded, { now: FIXED_NOW });

      const unconfirmed = await e.evaluate({
        resourceType: RESOURCE_TYPE.TOOL,
        resourceId: 'saveApplicationDraft',
        action: 'save',
        role: 'citizen',
        citizenConfirmed: false,
        nowIso: FIXED_NOW
      });
      expect(unconfirmed.permitted).toBe(false);

      const confirmed = await e.evaluate({
        resourceType: RESOURCE_TYPE.TOOL,
        resourceId: 'saveApplicationDraft',
        action: 'save',
        role: 'citizen',
        citizenConfirmed: true,
        nowIso: FIXED_NOW
      });
      expect(confirmed.permitted).toBe(true);
    });

    it('suspends all actions under emergency lock', async () => {
      const e = freshEngine();
      const seeded = createSeedStore({ now: FIXED_NOW });
      seeded.policies[0].rules = [ALLOW_RULE];
      seeded.policies[0].emergencyLocked = true;
      seeded.policies[0].status = POLICY_ENGINE_STATUS.EMERGENCY_LOCKED;
      persistPolicyStore(seeded, { now: FIXED_NOW });

      const decision = await e.evaluate({
        resourceType: RESOURCE_TYPE.TOOL,
        resourceId: 'lookupServiceDetails',
        action: 'read',
        role: 'citizen',
        nowIso: FIXED_NOW
      });
      expect(decision.permitted).toBe(false);
      expect(decision.code).toBe(POLICY_ERRORS.EMERGENCY_REVOKED);
    });

    it('returns policy not found for missing policy', async () => {
      const e = freshEngine();
      const decision = await e.evaluate({
        policyId: 'policy-missing',
        resourceType: RESOURCE_TYPE.TOOL,
        resourceId: 'lookupServiceDetails',
        action: 'read',
        role: 'citizen',
        nowIso: FIXED_NOW
      });
      expect(decision.permitted).toBe(false);
      expect(decision.code).toBe(POLICY_ERRORS.POLICY_NOT_FOUND);
    });

    it('applies higher-priority deny over lower-priority allow (conflict resolution)', async () => {
      const e = freshEngine();
      const seeded = createSeedStore({ now: FIXED_NOW });
      seeded.policies[0].rules = [
        { ...ALLOW_RULE, id: 'allow-low', priority: 5, resourceId: 'conflictTool' },
        { ...ALLOW_RULE, id: 'deny-high', effect: EFFECT.DENY, priority: 50, resourceId: 'conflictTool' }
      ];
      persistPolicyStore(seeded, { now: FIXED_NOW });

      const decision = await e.evaluate({
        resourceType: RESOURCE_TYPE.TOOL,
        resourceId: 'conflictTool',
        action: 'read',
        role: 'citizen',
        nowIso: FIXED_NOW
      });
      expect(decision.permitted).toBe(false);
      expect(decision.decision).toBe(EFFECT.DENY);
    });

    it('respects role restrictions', async () => {
      const e = freshEngine();
      const seeded = createSeedStore({ now: FIXED_NOW });
      seeded.policies[0].rules = [{
        ...ALLOW_RULE,
        appliesToRoles: ['admin']
      }];
      persistPolicyStore(seeded, { now: FIXED_NOW });

      const citizen = await e.evaluate({
        resourceType: RESOURCE_TYPE.TOOL,
        resourceId: 'lookupServiceDetails',
        action: 'read',
        role: 'citizen',
        nowIso: FIXED_NOW
      });
      expect(citizen.permitted).toBe(false);

      const admin = await e.evaluate({
        resourceType: RESOURCE_TYPE.TOOL,
        resourceId: 'lookupServiceDetails',
        action: 'read',
        role: 'admin',
        nowIso: FIXED_NOW
      });
      expect(admin.permitted).toBe(true);
    });
  });

  describe('upsertPolicy', () => {
    it('creates a new policy', async () => {
      const e = freshEngine();
      const result = await e.upsertPolicy({
        id: 'policy-new',
        name: 'New policy',
        status: POLICY_ENGINE_STATUS.ACTIVE,
        rules: [ALLOW_RULE],
        createdBy: 'operator',
        nowIso: FIXED_NOW
      });
      expect(result.ok).toBe(true);
      expect(result.policy.id).toBe('policy-new');
      expect(result.policy.version).toBe(1);
    });

    it('creates a new version on update', async () => {
      const e = freshEngine();
      await e.upsertPolicy({
        id: 'policy-ver',
        name: 'Ver policy',
        status: POLICY_ENGINE_STATUS.ACTIVE,
        rules: [ALLOW_RULE],
        createdBy: 'operator',
        nowIso: FIXED_NOW
      });
      const result = await e.upsertPolicy({
        id: 'policy-ver',
        name: 'Ver policy v2',
        status: POLICY_ENGINE_STATUS.ACTIVE,
        rules: [ALLOW_RULE],
        createdBy: 'operator',
        nowIso: FIXED_NOW
      });
      expect(result.ok).toBe(true);
      expect(result.policy.version).toBe(2);
    });

    it('rejects invalid policy id', async () => {
      const e = freshEngine();
      const result = await e.upsertPolicy({
        id: 'Bad Id',
        name: 'Bad',
        nowIso: FIXED_NOW
      });
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe(POLICY_ERRORS.VALIDATION_FAILED);
    });
  });

  describe('emergencyRevoke', () => {
    it('revokes a policy and locks it', async () => {
      const e = freshEngine();
      await e.upsertPolicy({
        id: 'policy-revoke',
        name: 'Revoke policy',
        status: POLICY_ENGINE_STATUS.ACTIVE,
        rules: [ALLOW_RULE],
        createdBy: 'operator',
        nowIso: FIXED_NOW
      });

      const revoked = await e.emergencyRevoke({
        policyId: 'policy-revoke',
        reason: 'Test revocation.',
        revokedBy: 'operator',
        nowIso: FIXED_NOW
      });
      expect(revoked.ok).toBe(true);

      const policy = e.getPolicy('policy-revoke');
      expect(policy.status).toBe(POLICY_ENGINE_STATUS.EMERGENCY_LOCKED);
      expect(policy.emergencyLocked).toBe(true);
    });

    it('rejects revoking a missing policy', async () => {
      const e = freshEngine();
      const revoked = await e.emergencyRevoke({
        policyId: 'policy-missing',
        reason: 'x',
        nowIso: FIXED_NOW
      });
      expect(revoked.ok).toBe(false);
    });
  });

  describe('listPolicies / getPolicy / getPolicyVersions / getEvaluationAudit', () => {
    it('lists policies', async () => {
      const e = freshEngine();
      const policies = e.listPolicies();
      expect(Array.isArray(policies)).toBe(true);
      expect(policies.length).toBeGreaterThan(0);
    });

    it('gets a policy by id', async () => {
      const e = freshEngine();
      const policy = e.getPolicy(DEFAULT_POLICY.id);
      expect(policy).not.toBeNull();
      expect(policy.id).toBe(DEFAULT_POLICY.id);
      expect(e.getPolicy('missing')).toBeNull();
    });

    it('gets policy versions', async () => {
      const e = freshEngine();
      await e.upsertPolicy({
        id: 'policy-ver',
        name: 'Ver',
        status: POLICY_ENGINE_STATUS.ACTIVE,
        rules: [ALLOW_RULE],
        createdBy: 'operator',
        nowIso: FIXED_NOW
      });
      const versions = e.getPolicyVersions({ policyId: 'policy-ver' });
      expect(versions.versions.length).toBeGreaterThan(0);
    });

    it('gets evaluation audit', async () => {
      const e = freshEngine();
      await e.evaluate({
        resourceType: RESOURCE_TYPE.TOOL,
        resourceId: 'lookupServiceDetails',
        action: 'read',
        role: 'citizen',
        nowIso: FIXED_NOW
      });
      const audit = e.getEvaluationAudit();
      expect(audit.length).toBeGreaterThan(0);
    });
  });

  describe('concurrency', () => {
    it('evaluates successfully under normal load', async () => {
      const e = freshEngine();
      const results = await Promise.all([
        e.evaluate({ resourceType: RESOURCE_TYPE.TOOL, resourceId: 'a', action: 'read', role: 'citizen', nowIso: FIXED_NOW }),
        e.evaluate({ resourceType: RESOURCE_TYPE.TOOL, resourceId: 'b', action: 'read', role: 'citizen', nowIso: FIXED_NOW })
      ]);
      expect(results[0].permitted).toBe(false);
      expect(results[1].permitted).toBe(false);
    });
  });
});
