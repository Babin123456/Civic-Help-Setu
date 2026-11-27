import { describe, it, expect } from 'vitest';
import {
  computeAttributeCommitment,
  generatePresentation,
  verifyPresentation
} from './verifiablePresentationService';
import { CREDENTIAL_SCHEMA_TYPES, TRUST_TIERS } from '../data/walletContracts';

describe('verifiablePresentationService', () => {
  const sampleCredential = {
    id: 'cred_sample_01',
    schemaType: CREDENTIAL_SCHEMA_TYPES.RESIDENCE_PROOF,
    trustTier: TRUST_TIERS.SELF_ASSERTED,
    issuer: {
      id: 'issuer:citizen:self',
      name: 'Self-Declared Residence'
    },
    createdAt: '2026-11-20T10:00:00.000Z',
    claims: {
      fullName: 'Anita Roy',
      wardNumber: 'Ward 9',
      city: 'Bengaluru',
      district: 'Bengaluru Urban',
      state: 'Karnataka',
      pincode: '560001',
      secretPrivateNote: 'Do not disclose'
    }
  };

  it('computes deterministic salted attribute commitments', async () => {
    const salt = 'random-salt-1234';
    const c1 = await computeAttributeCommitment('wardNumber', 'Ward 9', salt);
    const c2 = await computeAttributeCommitment('wardNumber', 'Ward 9', salt);
    const cDifferent = await computeAttributeCommitment('wardNumber', 'Ward 10', salt);

    expect(c1).toBe(c2);
    expect(c1).not.toBe(cDifferent);
    expect(typeof c1).toBe('string');
  });

  it('generates selective disclosure presentations withholding unselected claims', async () => {
    const { presentation, consentReceiptProposal } = await generatePresentation({
      credential: sampleCredential,
      selectedAttributeKeys: ['wardNumber', 'city'],
      audience: 'civicbridge:service:local-water',
      nonce: 'challenge_nonce_xyz'
    });

    expect(presentation.disclosedClaims).toEqual({
      wardNumber: 'Ward 9',
      city: 'Bengaluru'
    });
    // Secret / unselected attributes must be omitted completely
    expect(presentation.disclosedClaims.secretPrivateNote).toBeUndefined();
    expect(presentation.disclosedClaims.fullName).toBeUndefined();
    expect(presentation.withheldClaimsCount).toBe(5);

    expect(presentation.attributeCommitments.wardNumber).toBeDefined();
    expect(presentation.attributeCommitments.city).toBeDefined();
    expect(presentation.attributeSalts.wardNumber).toBeDefined();
    expect(presentation.presentationDigest).toBeDefined();

    expect(consentReceiptProposal.relyingParty.serviceId).toBe('civicbridge:service:local-water');
  });

  it('passes verification when presentation is valid and un-tampered', async () => {
    const { presentation } = await generatePresentation({
      credential: sampleCredential,
      selectedAttributeKeys: ['wardNumber', 'city'],
      audience: 'civicbridge:service:local-water',
      nonce: 'challenge_nonce_xyz',
      validDurationSeconds: 3600
    });

    const result = await verifyPresentation(presentation, {
      expectedAudience: 'civicbridge:service:local-water',
      expectedNonce: 'challenge_nonce_xyz'
    });

    expect(result.valid).toBe(true);
    expect(result.verdict).toBe('PASS');
    expect(result.disclosedClaims.wardNumber).toBe('Ward 9');
    expect(result.isSelfAsserted).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('detects attribute tampering', async () => {
    const { presentation } = await generatePresentation({
      credential: sampleCredential,
      selectedAttributeKeys: ['wardNumber', 'city'],
      audience: 'civicbridge:service:local-water',
      nonce: 'challenge_nonce_xyz'
    });

    // Tamper with the disclosed claim
    presentation.disclosedClaims.wardNumber = 'Ward 99';

    const result = await verifyPresentation(presentation, {
      expectedAudience: 'civicbridge:service:local-water',
      expectedNonce: 'challenge_nonce_xyz'
    });

    expect(result.valid).toBe(false);
    expect(result.code).toBe('TAMPERED_ATTRIBUTE');
    expect(result.verdict).toBe('FAIL');
  });

  it('detects envelope digest tampering', async () => {
    const { presentation } = await generatePresentation({
      credential: sampleCredential,
      selectedAttributeKeys: ['wardNumber'],
      audience: 'civicbridge:service:local-water',
      nonce: 'challenge_nonce_xyz'
    });

    presentation.presentationDigest = '0000000000000000000000000000000000000000000000000000000000000000';

    const result = await verifyPresentation(presentation, {
      expectedAudience: 'civicbridge:service:local-water',
      expectedNonce: 'challenge_nonce_xyz'
    });

    expect(result.valid).toBe(false);
    expect(result.code).toBe('TAMPERED_DIGEST');
    expect(result.verdict).toBe('FAIL');
  });

  it('detects replay attack when audience does not match', async () => {
    const { presentation } = await generatePresentation({
      credential: sampleCredential,
      selectedAttributeKeys: ['wardNumber'],
      audience: 'civicbridge:service:service-A',
      nonce: 'challenge_nonce_xyz'
    });

    // Replay to service B
    const result = await verifyPresentation(presentation, {
      expectedAudience: 'civicbridge:service:service-B',
      expectedNonce: 'challenge_nonce_xyz'
    });

    expect(result.valid).toBe(false);
    expect(result.code).toBe('AUDIENCE_MISMATCH');
  });

  it('detects replay attack when nonce does not match', async () => {
    const { presentation } = await generatePresentation({
      credential: sampleCredential,
      selectedAttributeKeys: ['wardNumber'],
      audience: 'civicbridge:service:service-A',
      nonce: 'fresh_nonce_123'
    });

    const result = await verifyPresentation(presentation, {
      expectedAudience: 'civicbridge:service:service-A',
      expectedNonce: 'stale_nonce_999'
    });

    expect(result.valid).toBe(false);
    expect(result.code).toBe('NONCE_MISMATCH');
  });

  it('detects expired presentation', async () => {
    const pastTime = Date.now() - 50000;
    const { presentation } = await generatePresentation({
      credential: sampleCredential,
      selectedAttributeKeys: ['wardNumber'],
      audience: 'civicbridge:service:service-A',
      nonce: 'fresh_nonce_123',
      validDurationSeconds: 10,
      now: pastTime
    });

    const result = await verifyPresentation(presentation, {
      expectedAudience: 'civicbridge:service:service-A',
      expectedNonce: 'fresh_nonce_123',
      currentTime: Date.now()
    });

    expect(result.valid).toBe(false);
    expect(result.code).toBe('PRESENTATION_EXPIRED');
  });

  it('detects revoked presentation', async () => {
    const { presentation } = await generatePresentation({
      credential: sampleCredential,
      selectedAttributeKeys: ['wardNumber'],
      audience: 'civicbridge:service:service-A',
      nonce: 'fresh_nonce_123'
    });

    const result = await verifyPresentation(presentation, {
      expectedAudience: 'civicbridge:service:service-A',
      expectedNonce: 'fresh_nonce_123',
      isRevokedChecker: (pid) => pid === presentation.presentationId
    });

    expect(result.valid).toBe(false);
    expect(result.code).toBe('PRESENTATION_REVOKED');
  });
});
