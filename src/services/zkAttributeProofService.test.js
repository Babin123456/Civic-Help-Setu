import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateAge,
  generateAgePredicateProof,
  generateResidencyPredicateProof,
  generateAttributeProof,
  verifyAttributeProof,
} from './zkAttributeProofService';
import {
  createPolicyChallenge,
  resetPolicyCache,
  SYNTHETIC_ISSUERS,
} from './zkVerifierPolicyService';
import {
  issueCredentialForPersona,
  computeAttributeCommitment,
} from './zkCredentialIssuerService';
import {
  revokeCredential,
  resetRevocationRegistry,
} from './zkRevocationRegistryService';

describe('zkAttributeProofService', () => {
  beforeEach(() => {
    resetPolicyCache();
    resetRevocationRegistry();
  });

  describe('calculateAge', () => {
    it('calculates calendar-accurate age before birthday in the year', () => {
      const birth = '1960-10-15';
      const ref = new Date('2026-05-01');
      expect(calculateAge(birth, ref)).toBe(65);
    });

    it('calculates calendar-accurate age on and after birthday', () => {
      const birth = '1960-10-15';
      const onBirthday = new Date('2026-10-15');
      const afterBirthday = new Date('2026-10-16');
      expect(calculateAge(birth, onBirthday)).toBe(66);
      expect(calculateAge(birth, afterBirthday)).toBe(66);
    });

    it('handles leap years correctly', () => {
      const leapBirth = '2000-02-29';
      expect(calculateAge(leapBirth, new Date('2024-02-28'))).toBe(23);
      expect(calculateAge(leapBirth, new Date('2024-02-29'))).toBe(24);
    });
  });

  describe('generateAgePredicateProof', () => {
    const salt = 'salt12345678901234567890';
    const birthDate = '1962-04-10';
    const commitment = computeAttributeCommitment('birthDate', birthDate, salt);

    it('generates satisfied proof for age >= 60 on a 64-year-old', () => {
      const proof = generateAgePredicateProof({
        birthDate,
        salt,
        commitment,
        operator: 'gte',
        threshold: 60,
        nonce: 'ch-test-nonce-1234',
        referenceDate: '2026-11-25',
      });

      expect(proof.satisfied).toBe(true);
      expect(proof.witness).toBeDefined();
      expect(proof.challengeDigest).toBeDefined();
    });

    it('returns satisfied=false for age >= 60 on a 55-year-old', () => {
      const proof = generateAgePredicateProof({
        birthDate: '1971-05-10',
        salt,
        commitment,
        operator: 'gte',
        threshold: 60,
        nonce: 'ch-test-nonce-1234',
        referenceDate: '2026-11-25',
      });

      expect(proof.satisfied).toBe(false);
      expect(proof.error).toBe('PREDICATE_NOT_SATISFIED');
    });
  });

  describe('generateResidencyPredicateProof', () => {
    const salt = 'salt98765432109876543210';
    const district = 'Chennai';
    const commitment = computeAttributeCommitment('jurisdiction.district', district, salt);

    it('generates satisfied proof when district is in allowedValues', () => {
      const proof = generateResidencyPredicateProof({
        value: district,
        salt,
        commitment,
        attributeName: 'jurisdiction.district',
        operator: 'in',
        target: ['Chennai', 'Tiruvallur'],
        nonce: 'ch-test-nonce-1234',
      });

      expect(proof.satisfied).toBe(true);
      expect(proof.witness).toBeDefined();
    });

    it('returns satisfied=false when district is not in allowedValues', () => {
      const proof = generateResidencyPredicateProof({
        value: 'Madurai',
        salt,
        commitment,
        attributeName: 'jurisdiction.district',
        operator: 'in',
        target: ['Chennai', 'Tiruvallur'],
        nonce: 'ch-test-nonce-1234',
      });

      expect(proof.satisfied).toBe(false);
    });
  });

  describe('End-to-End Attribute Proof Generation & Verification', () => {
    it('successfully generates and verifies a Senior Citizen proof for Chennai resident', () => {
      // 1. Issue credential for Senior Citizen Persona (Age 64, Chennai)
      const { credentialEnvelope, secretAttributes } = issueCredentialForPersona('SENIOR_CITIZEN_CHENNAI', 5);

      // 2. Verifier issues policy challenge
      const policyRequest = createPolicyChallenge('SENIOR_CITIZEN_CONCESSION_TN');

      // 3. Prover generates attribute proof in browser
      const proofPayload = generateAttributeProof({
        credentialEnvelope,
        secretAttributes,
        policyRequest,
      });

      expect(proofPayload.nonce).toBe(policyRequest.nonce);
      expect(proofPayload.predicateProofs.age.satisfied).toBe(true);
      expect(proofPayload.disclosedCommitments.birthDate).toBeDefined();

      // Zero PII: raw birth date or street address is NOT present in proofPayload
      const proofJson = JSON.stringify(proofPayload);
      expect(proofJson).not.toContain('1962-04-10');

      // 4. Verifier verifies proof
      const result = verifyAttributeProof({
        proofPayload,
        policyRequest,
      });

      expect(result.verified).toBe(true);
      expect(result.checks.schemaValid).toBe(true);
      expect(result.checks.policyMatch).toBe(true);
      expect(result.checks.freshnessAndAntiReplay).toBe(true);
      expect(result.checks.trustedIssuer).toBe(true);
      expect(result.checks.issuerSignature).toBe(true);
      expect(result.checks.revocationStatus).toBe(true);
      expect(result.checks.predicatesSatisfied).toBe(true);
      expect(result.disclaimer).toContain('PROTOTYPE');
    });

    it('rejects replayed proof presentations (Anti-Replay Security)', () => {
      const { credentialEnvelope, secretAttributes } = issueCredentialForPersona('SENIOR_CITIZEN_CHENNAI', 5);
      const policyRequest = createPolicyChallenge('SENIOR_CITIZEN_CONCESSION_TN');

      const proofPayload = generateAttributeProof({
        credentialEnvelope,
        secretAttributes,
        policyRequest,
      });

      // First verification succeeds
      const firstResult = verifyAttributeProof({ proofPayload, policyRequest });
      expect(firstResult.verified).toBe(true);

      // Replay attack with same proof and nonce must fail
      const replayResult = verifyAttributeProof({ proofPayload, policyRequest });
      expect(replayResult.verified).toBe(false);
      expect(replayResult.failureReason).toContain('Anti-replay');
    });

    it('rejects proof when credential has been revoked', () => {
      const statusIndex = 12;
      const { credentialEnvelope, secretAttributes } = issueCredentialForPersona('SENIOR_CITIZEN_CHENNAI', statusIndex);

      // Revoke credential in registry
      revokeCredential(SYNTHETIC_ISSUERS.DEPT_REVENUE_TN, statusIndex, 'Deceased or cancelled');

      const policyRequest = createPolicyChallenge('SENIOR_CITIZEN_CONCESSION_TN');
      const proofPayload = generateAttributeProof({
        credentialEnvelope,
        secretAttributes,
        policyRequest,
      });

      const result = verifyAttributeProof({ proofPayload, policyRequest });
      expect(result.verified).toBe(false);
      expect(result.failureReason).toContain('revoked');
    });

    it('rejects proof when applicant does not satisfy age predicate', () => {
      // Adult Persona (Age 28) attempting to generate Senior Citizen proof (Age >= 60)
      const { credentialEnvelope, secretAttributes } = issueCredentialForPersona('ADULT_TIRUVALLUR');
      const policyRequest = createPolicyChallenge('SENIOR_CITIZEN_CONCESSION_TN');

      expect(() =>
        generateAttributeProof({
          credentialEnvelope,
          secretAttributes,
          policyRequest,
        })
      ).toThrow(/Age predicate failed/);
    });

    it('rejects proof when residency is outside allowed district', () => {
      // Out of State resident (Bengaluru) attempting to generate Ward 174 proof
      const { credentialEnvelope, secretAttributes } = issueCredentialForPersona('OUT_OF_STATE_RESIDENT');
      const policyRequest = createPolicyChallenge('WARD_174_PARTICIPATORY_BUDGET');

      expect(() =>
        generateAttributeProof({
          credentialEnvelope,
          secretAttributes,
          policyRequest,
        })
      ).toThrow(/Residency predicate failed/);
    });

    it('rejects tampered commitment in proof payload', () => {
      const { credentialEnvelope, secretAttributes } = issueCredentialForPersona('SENIOR_CITIZEN_CHENNAI', 5);
      const policyRequest = createPolicyChallenge('SENIOR_CITIZEN_CONCESSION_TN');

      const proofPayload = generateAttributeProof({
        credentialEnvelope,
        secretAttributes,
        policyRequest,
      });

      // Tamper 1 character of disclosed commitment
      proofPayload.disclosedCommitments.birthDate =
        proofPayload.disclosedCommitments.birthDate.slice(0, -1) + (proofPayload.disclosedCommitments.birthDate.endsWith('0') ? '1' : '0');

      const result = verifyAttributeProof({ proofPayload, policyRequest });
      expect(result.verified).toBe(false);
      expect(result.failureReason).toContain('mismatch');
    });

    it('rejects untrusted issuer ID', () => {
      const { credentialEnvelope, secretAttributes } = issueCredentialForPersona('SENIOR_CITIZEN_CHENNAI', 5);
      const policyRequest = createPolicyChallenge('SENIOR_CITIZEN_CONCESSION_TN');

      const proofPayload = generateAttributeProof({
        credentialEnvelope,
        secretAttributes,
        policyRequest,
      });

      // Spoof untrusted issuer
      proofPayload.issuerId = 'did:civic:untrusted-rogue-authority';

      const result = verifyAttributeProof({ proofPayload, policyRequest });
      expect(result.verified).toBe(false);
      expect(result.failureReason).toContain('Untrusted issuer');
    });
  });
});
