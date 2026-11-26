import { describe, it, expect, beforeEach } from 'vitest';
import {
  evaluateResidencyPolicy,
  getActiveResidencyPolicy,
  setActiveResidencyPolicy,
  isHighRiskCategory,
} from './residencyPolicyEngine.js';
import { RESIDENCY_TIER, TASK_RISK, GATEWAY_ERROR_CODES } from './gatewayTypes.js';

describe('ResidencyPolicyEngine (#1153)', () => {
  beforeEach(() => {
    setActiveResidencyPolicy(RESIDENCY_TIER.LOCAL_ONLY);
  });

  it('defaults to LOCAL_ONLY tier', () => {
    expect(getActiveResidencyPolicy()).toBe(RESIDENCY_TIER.LOCAL_ONLY);
  });

  it('allows local processing without network egress', () => {
    const decision = evaluateResidencyPolicy({
      requestedTier: RESIDENCY_TIER.LOCAL_ONLY,
      taskRisk: TASK_RISK.LOW,
      piiScrubbed: false,
    });

    expect(decision.allowed).toBe(true);
    expect(decision.effectiveTier).toBe(RESIDENCY_TIER.LOCAL_ONLY);
    expect(decision.downgraded).toBe(false);
  });

  it('forces downgrade to LOCAL_ONLY if global policy is LOCAL_ONLY', () => {
    setActiveResidencyPolicy(RESIDENCY_TIER.LOCAL_ONLY);

    const decision = evaluateResidencyPolicy({
      requestedTier: RESIDENCY_TIER.CROSS_BORDER_SCRUBBED,
      taskRisk: TASK_RISK.LOW,
      piiScrubbed: true,
    });

    expect(decision.allowed).toBe(true);
    expect(decision.effectiveTier).toBe(RESIDENCY_TIER.LOCAL_ONLY);
    expect(decision.downgraded).toBe(true);
  });

  it('blocks high-risk tasks from cross-border transmission', () => {
    setActiveResidencyPolicy(RESIDENCY_TIER.CROSS_BORDER_SCRUBBED);

    const decision = evaluateResidencyPolicy({
      requestedTier: RESIDENCY_TIER.CROSS_BORDER_SCRUBBED,
      taskRisk: TASK_RISK.HIGH,
      categoryId: 'income-certificate',
      piiScrubbed: true,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.effectiveTier).toBe(RESIDENCY_TIER.LOCAL_ONLY);
    expect(decision.errorCode).toBe(GATEWAY_ERROR_CODES.RESIDENCY_POLICY_VIOLATION);
  });

  it('blocks cross-border transmission if pre-inference PII scrub is unverified', () => {
    setActiveResidencyPolicy(RESIDENCY_TIER.CROSS_BORDER_SCRUBBED);

    const decision = evaluateResidencyPolicy({
      requestedTier: RESIDENCY_TIER.CROSS_BORDER_SCRUBBED,
      taskRisk: TASK_RISK.LOW,
      piiScrubbed: false,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.effectiveTier).toBe(RESIDENCY_TIER.LOCAL_ONLY);
    expect(decision.errorCode).toBe(GATEWAY_ERROR_CODES.RESIDENCY_POLICY_VIOLATION);
  });

  it('approves sovereign domestic processing when configured', () => {
    setActiveResidencyPolicy(RESIDENCY_TIER.SOVEREIGN_DOMESTIC);

    const decision = evaluateResidencyPolicy({
      requestedTier: RESIDENCY_TIER.SOVEREIGN_DOMESTIC,
      taskRisk: TASK_RISK.MEDIUM,
      piiScrubbed: true,
    });

    expect(decision.allowed).toBe(true);
    expect(decision.effectiveTier).toBe(RESIDENCY_TIER.SOVEREIGN_DOMESTIC);
    expect(decision.downgraded).toBe(false);
  });

  it('identifies high risk civic categories accurately', () => {
    expect(isHighRiskCategory('income-certificate')).toBe(true);
    expect(isHighRiskCategory('caste-certificate')).toBe(true);
    expect(isHighRiskCategory('general-directory')).toBe(false);
  });
});
