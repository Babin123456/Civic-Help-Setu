import { describe, it, expect, beforeEach } from 'vitest';
import {
  PREDEFINED_POLICIES,
  SYNTHETIC_ISSUERS,
  generateCryptographicNonce,
  createPolicyChallenge,
  verifyAndConsumeNonce,
  resetPolicyCache,
} from './zkVerifierPolicyService';

describe('zkVerifierPolicyService', () => {
  beforeEach(() => {
    resetPolicyCache();
  });

  it('generates cryptographic nonces with at least 32 hex chars', () => {
    const nonce1 = generateCryptographicNonce(16);
    const nonce2 = generateCryptographicNonce(16);
    expect(nonce1).toHaveLength(32);
    expect(nonce2).toHaveLength(32);
    expect(nonce1).not.toBe(nonce2);
  });

  it('creates valid interactive policy challenge with nonce and TTL', () => {
    const challenge = createPolicyChallenge('SENIOR_CITIZEN_CONCESSION_TN');
    expect(challenge.policyId).toBe(PREDEFINED_POLICIES.SENIOR_CITIZEN_CONCESSION_TN.policyId);
    expect(challenge.nonce).toMatch(/^ch-[a-f0-9]{32}$/);
    expect(challenge.requiredPredicates).toHaveLength(2);
    expect(challenge.trustedIssuers).toContain(SYNTHETIC_ISSUERS.DEPT_REVENUE_TN);
  });

  it('verifies and consumes a fresh nonce successfully', () => {
    const challenge = createPolicyChallenge('ADULT_CIVIC_ELECTOR');
    const result = verifyAndConsumeNonce(challenge.nonce, challenge.policyId);
    expect(result.valid).toBe(true);

    // Replay attack: consuming the same nonce again must fail
    const replayResult = verifyAndConsumeNonce(challenge.nonce, challenge.policyId);
    expect(replayResult.valid).toBe(false);
    expect(replayResult.error).toBe('NONCE_ALREADY_CONSUMED');
  });

  it('rejects policy ID mismatch', () => {
    const challenge = createPolicyChallenge('ADULT_CIVIC_ELECTOR');
    const result = verifyAndConsumeNonce(challenge.nonce, 'wrong-policy-id');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('POLICY_ID_MISMATCH');
  });

  it('rejects expired challenge', () => {
    const challenge = createPolicyChallenge('ADULT_CIVIC_ELECTOR', 1); // 1 sec TTL
    const futureDate = new Date(Date.now() + 5000); // 5 sec later
    const result = verifyAndConsumeNonce(challenge.nonce, challenge.policyId, futureDate);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('CHALLENGE_EXPIRED');
  });

  it('rejects unissued nonces', () => {
    const result = verifyAndConsumeNonce('ch-fake1234567890123456789012', 'some-policy');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('UNRECOGNIZED_CHALLENGE');
  });
});
