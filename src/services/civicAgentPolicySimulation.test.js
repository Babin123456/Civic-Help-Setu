/**
 * src/services/civicAgentPolicySimulation.test.js
 *
 * Unit tests for policy simulation (#1187).
 * Covers bypass attempts, conflicting policies, emergency revocation and
 * deny-by-default with synthetic data.
 *
 * Synthetic fixtures only: no citizen records, credentials, raw documents or
 * sensitive prompts.
 */

import { describe, it, expect } from 'vitest';
import { simulatePolicyDecisions, simulateConflictResolution, simulateEmergencyRevocation, simulateDenyByDefault } from './civicAgentPolicySimulation.js';
import { POLICY_ENGINE_STATUS, POLICY_ERRORS, EFFECT, RESOURCE_TYPE } from '../data/civicAgentPolicyConstants.js';

describe('civicAgentPolicySimulation', () => {
  describe('simulatePolicyDecisions', () => {
    it('denies unexpected-deny requests and detects no bypass', async () => {
      const result = await simulatePolicyDecisions({
        requests: [
          { resourceId: 'unknown', expectedDeny: true },
          { resourceId: 'lookupServiceDetails', action: 'read', citizenConfirmed: true, expectedDeny: false }
        ]
      });
      expect(result.ok).toBe(true);
      expect(result.bypassDetected).toBe(false);
      expect(result.denyByDefaultHeld).toBe(true);
      expect(result.noCitizenData).toBe(true);
      expect(result.simulated).toBe(true);
    });

    it('detects a bypass when an expected-deny request is permitted', async () => {
      const result = await simulatePolicyDecisions({
        requests: [{ resourceId: 'unknown', expectedDeny: true, action: 'read' }],
        policy: {
          id: 'policy-sim-allow-all',
          name: 'Allow all',
          status: POLICY_ENGINE_STATUS.ACTIVE,
          denyByDefault: false,
          rules: [{
            id: 'allow-all',
            description: 'Allow all.',
            resourceType: RESOURCE_TYPE.TOOL,
            resourceId: '*',
            effect: EFFECT.ALLOW,
            conditions: [],
            conditionParams: {},
            requiresApproval: false,
            appliesToRoles: ['*'],
            priority: 10,
            expiresAt: null
          }],
          createdAt: '2026-11-24T00:00:00Z',
          updatedAt: '2026-11-24T00:00:00Z'
        }
      });
      expect(result.ok).toBe(true);
      expect(result.bypassDetected).toBe(true);
      expect(result.bypassCount).toBeGreaterThan(0);
    });

    it('rejects non-array requests', async () => {
      const result = await simulatePolicyDecisions({ requests: 'not an array' });
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe(POLICY_ERRORS.VALIDATION_FAILED);
    });
  });

  describe('simulateConflictResolution', () => {
    it('lets higher-priority deny win over lower-priority allow', async () => {
      const result = await simulateConflictResolution();
      expect(result.ok).toBe(true);
      expect(result.higherPriorityWins).toBe(true);
      expect(result.decision.permitted).toBe(false);
      expect(result.decision.decision).toBe(EFFECT.DENY);
      expect(result.noCitizenData).toBe(true);
      expect(result.simulated).toBe(true);
    });
  });

  describe('simulateEmergencyRevocation', () => {
    it('suspends actions after revocation', async () => {
      const result = await simulateEmergencyRevocation();
      expect(result.ok).toBe(true);
      expect(result.revoked).toBe(true);
      expect(result.before.permitted).toBe(true);
      expect(result.after.permitted).toBe(false);
      expect(result.revocationSuspendedActions).toBe(true);
      expect(result.noCitizenData).toBe(true);
      expect(result.simulated).toBe(true);
    });
  });

  describe('simulateDenyByDefault', () => {
    it('denies unknown resources and missing policies', async () => {
      const result = await simulateDenyByDefault();
      expect(result.ok).toBe(true);
      expect(result.unknownResourceDenied).toBe(true);
      expect(result.missingPolicyDenied).toBe(true);
      expect(result.denyByDefault).toBe(true);
      expect(result.decisions.unknown.permitted).toBe(false);
      expect(result.decisions.noPolicy.permitted).toBe(false);
      expect(result.noCitizenData).toBe(true);
      expect(result.simulated).toBe(true);
    });
  });
});
