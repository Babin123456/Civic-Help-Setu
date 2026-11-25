/**
 * src/data/civicAgentPolicyConstants.test.js
 *
 * Unit tests for versioned schema, enums, error codes and default policy for
 * the Civic Agent Workflow Policy-as-Code Engine (#1187).
 */

import { describe, it, expect } from 'vitest';
import {
  CIVIC_AGENT_POLICY_SCHEMA_VERSION,
  DEFAULT_POLICY,
  POLICY_ENGINE_STATUS,
  POLICY_ERRORS,
  EFFECT,
  RESOURCE_TYPE,
  DENY_BY_DEFAULT_RULE,
  POLICY_ID_PATTERN,
  RULE_ID_PATTERN
} from './civicAgentPolicyConstants.js';

describe('civicAgentPolicyConstants', () => {
  it('exposes a schema version', () => {
    expect(CIVIC_AGENT_POLICY_SCHEMA_VERSION).toBe(1);
  });

  it('default policy is deny-by-default and active', () => {
    expect(DEFAULT_POLICY.id).toBe('default-civic-agent-policy-v1');
    expect(DEFAULT_POLICY.status).toBe(POLICY_ENGINE_STATUS.ACTIVE);
    expect(DEFAULT_POLICY.denyByDefault).toBe(true);
    expect(DEFAULT_POLICY.disclaimer).toContain('deterministic');
  });

  it('exposes enums', () => {
    expect(EFFECT.ALLOW).toBe('allow');
    expect(EFFECT.DENY).toBe('deny');
    expect(EFFECT.REQUIRE_APPROVAL).toBe('require_approval');
    expect(RESOURCE_TYPE.TOOL).toBe('tool');
    expect(RESOURCE_TYPE.STATE_TRANSITION).toBe('state_transition');
    expect(POLICY_ENGINE_STATUS.EMERGENCY_LOCKED).toBe('emergency_locked');
  });

  it('error codes are defined', () => {
    expect(POLICY_ERRORS.DECISION_DENIED).toBe('CP_DECISION_DENIED');
    expect(POLICY_ERRORS.EMERGENCY_REVOKED).toBe('CP_EMERGENCY_REVOKED');
    expect(POLICY_ERRORS.POLICY_NOT_FOUND).toBe('CP_POLICY_NOT_FOUND');
    expect(POLICY_ERRORS.VALIDATION_FAILED).toBe('CP_VALIDATION_FAILED');
  });

  it('deny-by-default rule is present', () => {
    expect(DENY_BY_DEFAULT_RULE.id).toBe('deny-by-default');
    expect(DENY_BY_DEFAULT_RULE.effect).toBe(EFFECT.DENY);
    expect(DENY_BY_DEFAULT_RULE.resourceId).toBe('*');
    expect(DENY_BY_DEFAULT_RULE.priority).toBe(0);
  });

  it('id patterns are sane', () => {
    expect(POLICY_ID_PATTERN.test('policy-1')).toBe(true);
    expect(POLICY_ID_PATTERN.test('Bad Id')).toBe(false);
    expect(RULE_ID_PATTERN.test('rule-1')).toBe(true);
    expect(RULE_ID_PATTERN.test('Bad Id')).toBe(false);
  });
});
