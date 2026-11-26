import { describe, it, expect } from 'vitest';
import {
  SYNTHETIC_AUTHORITY_KEYS,
  computeAttributeCommitment,
  signDigest,
  verifyIssuerSignature,
  issueSyntheticCredential,
  issueCredentialForPersona,
} from './zkCredentialIssuerService';
import { SYNTHETIC_ISSUERS } from './zkVerifierPolicyService';

describe('zkCredentialIssuerService', () => {
  it('computes deterministic 64-char hex attribute commitments', () => {
    const c1 = computeAttributeCommitment('birthDate', '1962-04-10', 'salt12345678901234');
    const c2 = computeAttributeCommitment('birthDate', '1962-04-10', 'salt12345678901234');
    const c3 = computeAttributeCommitment('birthDate', '1962-04-11', 'salt12345678901234');

    expect(c1).toMatch(/^[a-f0-9]{64}$/);
    expect(c1).toBe(c2);
    expect(c1).not.toBe(c3);
  });

  it('signs and verifies credential root digest using authority keys', () => {
    const issuerId = SYNTHETIC_ISSUERS.DEPT_REVENUE_TN;
    const privKey = SYNTHETIC_AUTHORITY_KEYS[issuerId].privateKey;
    const testDigest = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

    const sig = signDigest(testDigest, privKey);
    expect(sig).toMatch(/^[a-f0-9]{64}$/);

    const isValid = verifyIssuerSignature(testDigest, sig, issuerId);
    expect(isValid).toBe(true);

    // Tampered digest fails
    expect(verifyIssuerSignature('tampered-digest', sig, issuerId)).toBe(false);

    // Tampered signature fails
    expect(verifyIssuerSignature(testDigest, 'bad-signature', issuerId)).toBe(false);
  });

  it('issues synthetic credential with public envelope and private attributes', () => {
    const { credentialEnvelope, secretAttributes } = issueSyntheticCredential({
      issuerId: SYNTHETIC_ISSUERS.DEPT_REVENUE_TN,
      attributes: {
        birthDate: '1960-05-15',
        'jurisdiction.district': 'Chennai',
      },
      statusListIndex: 42,
    });

    expect(credentialEnvelope.credentialId).toMatch(/^cred-/);
    expect(credentialEnvelope.issuer.id).toBe(SYNTHETIC_ISSUERS.DEPT_REVENUE_TN);
    expect(credentialEnvelope.commitments.birthDate).toBeDefined();
    expect(credentialEnvelope.commitments['jurisdiction.district']).toBeDefined();
    expect(credentialEnvelope.revocation.statusListIndex).toBe(42);
    expect(credentialEnvelope.issuerSignature).toBeDefined();

    // Raw secrets are in secretAttributes, NOT exposed in commitments
    expect(secretAttributes.birthDate.value).toBe('1960-05-15');
    expect(secretAttributes.birthDate.salt).toHaveLength(32);
    expect(secretAttributes.birthDate.commitment).toBe(credentialEnvelope.commitments.birthDate);
  });

  it('issues credential for synthetic personas accurately', () => {
    const bundle = issueCredentialForPersona('SENIOR_CITIZEN_CHENNAI', 10);
    expect(bundle.persona.id).toBe('synthetic-user-senior-chennai');
    expect(bundle.credentialEnvelope.commitments.birthDate).toBeDefined();
    expect(bundle.secretAttributes.birthDate.value).toBe('1962-04-10');
  });
});
