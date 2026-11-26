/**
 * api/_lib/civicAgentPolicySchemas.test.js
 *
 * Unit tests for versioned request/response validation contracts of the
 * Civic Agent Workflow Policy-as-Code Engine API (#1187).
 */

import { describe, it, expect } from 'vitest';
import {
  validateEvaluate,
  validatePolicyUpsert,
  validateEmergencyRevoke,
  validateListQuery,
  validateSimulate,
  schemaVersion
} from './civicAgentPolicySchemas.js';

describe('civicAgentPolicySchemas', () => {
  it('reports the schema version', () => {
    expect(schemaVersion()).toBe(1);
  });

  describe('validateEvaluate', () => {
    it('accepts a valid evaluate request', () => {
      const v = validateEvaluate({
        policyId: 'policy-1',
        resourceType: 'tool',
        resourceId: 'lookupServiceDetails',
        action: 'read',
        role: 'citizen',
        citizenConfirmed: true,
        humanApproved: false,
        dailyCallCount: 0
      });
      expect(v.valid).toBe(true);
    });

    it('rejects invalid resourceType', () => {
      const v = validateEvaluate({ resourceType: 'not-a-type' });
      expect(v.valid).toBe(false);
    });

    it('rejects non-boolean citizenConfirmed', () => {
      const v = validateEvaluate({ citizenConfirmed: 'yes' });
      expect(v.valid).toBe(false);
    });

    it('rejects invalid policyId', () => {
      const v = validateEvaluate({ policyId: 'Bad Id' });
      expect(v.valid).toBe(false);
    });
  });

  describe('validatePolicyUpsert', () => {
    it('accepts a valid policy upsert', () => {
      const v = validatePolicyUpsert({
        id: 'policy-1',
        name: 'Policy',
        status: 'active',
        denyByDefault: true,
        rules: [
          {
            id: 'rule-1',
            description: 'Allow read.',
            resourceType: 'tool',
            resourceId: 'x',
            effect: 'allow',
            conditions: [],
            conditionParams: {},
            requiresApproval: false,
            appliesToRoles: ['citizen'],
            priority: 10
          }
        ]
      });
      expect(v.valid).toBe(true);
    });

    it('rejects invalid policy id', () => {
      const v = validatePolicyUpsert({ id: 'Bad Id' });
      expect(v.valid).toBe(false);
    });

    it('rejects invalid rule effect', () => {
      const v = validatePolicyUpsert({
        id: 'policy-1',
        rules: [{ id: 'r', description: 'd', resourceType: 'tool', resourceId: 'x', effect: 'maybe', conditions: [], conditionParams: {}, requiresApproval: false, appliesToRoles: ['citizen'], priority: 1 }]
      });
      expect(v.valid).toBe(false);
    });

    it('rejects too many rules', () => {
      const v = validatePolicyUpsert({
        id: 'policy-1',
        rules: Array(501).fill({ id: 'r', description: 'd', resourceType: 'tool', resourceId: 'x', effect: 'allow', conditions: [], conditionParams: {}, requiresApproval: false, appliesToRoles: ['citizen'], priority: 1 })
      });
      expect(v.valid).toBe(false);
    });
  });

  describe('validateEmergencyRevoke', () => {
    it('accepts a valid revoke request', () => {
      const v = validateEmergencyRevoke({ policyId: 'policy-1', reason: 'test', revokedBy: 'operator' });
      expect(v.valid).toBe(true);
    });

    it('rejects invalid policyId', () => {
      const v = validateEmergencyRevoke({ policyId: 'Bad Id' });
      expect(v.valid).toBe(false);
    });
  });

  describe('validateListQuery', () => {
    it('accepts a valid list query', () => {
      const v = validateListQuery({ limit: 10 });
      expect(v.valid).toBe(true);
    });

    it('rejects limit out of range', () => {
      const v = validateListQuery({ limit: 0 });
      expect(v.valid).toBe(false);
    });
  });

  describe('validateSimulate', () => {
    it('accepts a valid simulate request', () => {
      const v = validateSimulate({ requests: [], emergencyRevokeMidway: false });
      expect(v.valid).toBe(true);
    });

    it('rejects non-array requests', () => {
      const v = validateSimulate({ requests: 'not an array' });
      expect(v.valid).toBe(false);
    });
  });
});
