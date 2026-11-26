import { describe, it, expect } from 'vitest';
import {
  ZK_CREDENTIAL_SCHEMA_VERSION,
  ZK_POLICY_SCHEMA_VERSION,
  ZK_PROOF_SCHEMA_VERSION,
  ZK_VERIFICATION_SCHEMA_VERSION,
  ZK_PROTOTYPE_DISCLAIMER,
  validateCredentialEnvelope,
  validatePolicyRequest,
  validateProofPayload,
  validateVerificationResult,
  SYNTHETIC_TEST_PERSONAS,
} from './zkProofContracts';

describe('zkProofContracts', () => {
  it('exports standard schema versions and prototype disclaimer', () => {
    expect(ZK_CREDENTIAL_SCHEMA_VERSION).toBe('civicbridge.zk.credential.v1');
    expect(ZK_POLICY_SCHEMA_VERSION).toBe('civicbridge.zk.policy.v1');
    expect(ZK_PROOF_SCHEMA_VERSION).toBe('civicbridge.zk.proof.v1');
    expect(ZK_VERIFICATION_SCHEMA_VERSION).toBe('civicbridge.zk.verification.v1');
    expect(ZK_PROTOTYPE_DISCLAIMER).toContain('PROTOTYPE');
  });

  describe('validateCredentialEnvelope', () => {
    const validCredential = {
      schemaVersion: ZK_CREDENTIAL_SCHEMA_VERSION,
      credentialId: 'cred-123',
      issuer: {
        id: 'did:civic:dept-revenue-tn',
        name: 'Dept of Revenue',
        publicKey: 'pubkey-abc',
      },
      issuedAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2028-01-01T00:00:00.000Z',
      revocation: {
        statusListUrl: '/api/zk-revocation/status-list-v1',
        statusListIndex: 0,
      },
      commitments: {
        birthDate: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      },
      issuerSignature: 'sig-mock-123',
    };

    it('passes for a well-formed credential envelope', () => {
      const result = validateCredentialEnvelope(validCredential);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('fails when null or not an object', () => {
      expect(validateCredentialEnvelope(null).valid).toBe(false);
      expect(validateCredentialEnvelope([]).valid).toBe(false);
    });

    it('fails for invalid schema version', () => {
      const bad = { ...validCredential, schemaVersion: 'invalid.v2' };
      const res = validateCredentialEnvelope(bad);
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain('Invalid schemaVersion');
    });

    it('fails when expiresAt is before or equal to issuedAt', () => {
      const bad = {
        ...validCredential,
        issuedAt: '2026-05-01T00:00:00.000Z',
        expiresAt: '2026-04-01T00:00:00.000Z',
      };
      const res = validateCredentialEnvelope(bad);
      expect(res.valid).toBe(false);
      expect(res.errors).toContain('expiresAt must be strictly after issuedAt.');
    });

    it('fails when commitment format is not 64 hex chars', () => {
      const bad = {
        ...validCredential,
        commitments: {
          birthDate: 'invalid-not-64-hex',
        },
      };
      const res = validateCredentialEnvelope(bad);
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain('64-character hex string');
    });
  });

  describe('validatePolicyRequest', () => {
    const validPolicy = {
      schemaVersion: ZK_POLICY_SCHEMA_VERSION,
      policyId: 'policy-senior-tn',
      nonce: 'nonce-abcdef1234567890',
      issuedAt: '2026-11-25T12:00:00.000Z',
      validUntil: '2026-11-25T12:05:00.000Z',
      requiredPredicates: [
        {
          attribute: 'age',
          operator: 'gte',
          threshold: 60,
        },
        {
          attribute: 'jurisdiction.district',
          operator: 'in',
          allowedValues: ['Chennai'],
        },
      ],
      trustedIssuers: ['did:civic:dept-revenue-tn'],
    };

    it('passes for a valid policy request', () => {
      const result = validatePolicyRequest(validPolicy);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('fails when nonce is shorter than 16 chars', () => {
      const bad = { ...validPolicy, nonce: 'short' };
      const res = validatePolicyRequest(bad);
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain('at least 16 characters');
    });

    it('fails for unsupported operator', () => {
      const bad = {
        ...validPolicy,
        requiredPredicates: [
          {
            attribute: 'age',
            operator: 'bitwise_and',
            threshold: 60,
          },
        ],
      };
      const res = validatePolicyRequest(bad);
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain('invalid operator');
    });
  });

  describe('validateProofPayload', () => {
    const validProof = {
      schemaVersion: ZK_PROOF_SCHEMA_VERSION,
      policyId: 'policy-senior-tn',
      nonce: 'nonce-abcdef1234567890',
      timestamp: '2026-11-25T12:01:00.000Z',
      issuerId: 'did:civic:dept-revenue-tn',
      credentialId: 'cred-123',
      disclosedCommitments: {
        birthDate: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      },
      predicateProofs: {
        age: {
          satisfied: true,
          token: 'token-mock',
        },
      },
      revocationWitness: {
        statusListIndex: 0,
      },
      issuerSignature: 'issuer-sig',
      proofSignature: 'proof-sig',
    };

    it('passes for a valid proof payload', () => {
      const res = validateProofPayload(validProof);
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it('fails when required fields are missing', () => {
      const bad = { ...validProof, proofSignature: '' };
      const res = validateProofPayload(bad);
      expect(res.valid).toBe(false);
    });
  });

  describe('validateVerificationResult', () => {
    it('validates verification results', () => {
      const res = validateVerificationResult({
        schemaVersion: ZK_VERIFICATION_SCHEMA_VERSION,
        verified: true,
        policyId: 'policy-senior-tn',
        timestamp: '2026-11-25T12:02:00.000Z',
        checks: {
          issuerSignature: true,
          revocation: true,
          freshness: true,
          predicates: true,
        },
      });
      expect(res.valid).toBe(true);
    });
  });

  describe('SYNTHETIC_TEST_PERSONAS', () => {
    it('defines synthetic personas with expected attributes and no real PII', () => {
      expect(SYNTHETIC_TEST_PERSONAS.SENIOR_CITIZEN_CHENNAI).toBeDefined();
      expect(SYNTHETIC_TEST_PERSONAS.ADULT_TIRUVALLUR).toBeDefined();
      expect(SYNTHETIC_TEST_PERSONAS.MINOR_RESIDENT).toBeDefined();
      expect(SYNTHETIC_TEST_PERSONAS.OUT_OF_STATE_RESIDENT).toBeDefined();

      for (const persona of Object.values(SYNTHETIC_TEST_PERSONAS)) {
        expect(persona.id).toMatch(/^synthetic-user-/);
        expect(persona.attributes.birthDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        // Ensure no Aadhaar or phone patterns
        const json = JSON.stringify(persona);
        expect(json).not.toMatch(/\b\d{12}\b/);
        expect(json).not.toMatch(/\b\d{10}\b/);
      }
    });
  });
});
