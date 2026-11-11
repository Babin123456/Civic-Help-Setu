import { describe, it, expect } from 'vitest';
import {
  ADMIN_AUDIT_ACTION,
  ANCHOR_NETWORK,
  AUDIT_COMMITMENT_DISCLAIMER,
  anchorAuditBatch,
  buildAdminAuditMerkleTree,
  createCanonicalAdminEvent,
  generateEventAuditProof,
  rotateAnchoringKey,
  verifyDisclosedEventAgainstRoot,
} from './administrativeAuditCommitmentService.js';

describe('administrativeAuditCommitmentService', () => {
  const sampleEvents = [
    createCanonicalAdminEvent({
      recordId: 'service_fee_guide_birth_certificate',
      action: ADMIN_AUDIT_ACTION.FEE_SCHEDULE_UPDATE,
      role: 'SUPER_ADMIN',
      timestamp: '2026-03-01T10:00:00.000Z',
      sourceVersion: '2.1.0',
      payloadHash: 'a1b2c3d4e5f60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef',
    }),
    createCanonicalAdminEvent({
      recordId: 'grievance_statutory_sla_tamil_nadu',
      action: ADMIN_AUDIT_ACTION.STATUTORY_TIMELINE_CHANGE,
      role: 'COMPLIANCE_OFFICER',
      timestamp: '2026-03-02T11:30:00.000Z',
      sourceVersion: '2.2.0',
      payloadHash: 'b2c3d4e5f60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef12',
    }),
    createCanonicalAdminEvent({
      recordId: 'water_tax_portal_url_endpoint',
      action: ADMIN_AUDIT_ACTION.SERVICE_PORTAL_URL_CHANGE,
      role: 'SYSTEM_ADMIN',
      timestamp: '2026-03-03T14:15:00.000Z',
      sourceVersion: '2.2.1',
      payloadHash: 'c3d4e5f60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef1234',
    }),
  ];

  it('rejects creation of canonical events containing citizen personal identifiers', () => {
    expect(() =>
      createCanonicalAdminEvent({
        recordId: 'test_record',
        action: ADMIN_AUDIT_ACTION.FEE_SCHEDULE_UPDATE,
        role: 'ADMIN',
        payloadHash: '123456',
        citizenName: 'John Doe',
      })
    ).toThrow(/PII Violation/);

    expect(() =>
      createCanonicalAdminEvent({
        recordId: 'test_record',
        action: ADMIN_AUDIT_ACTION.FEE_SCHEDULE_UPDATE,
        role: 'ADMIN',
        payloadHash: '123456',
        aadhaar: '1234 5678 9012',
      })
    ).toThrow(/PII Violation/);
  });

  it('builds a deterministic Merkle tree and generates a valid audit proof', async () => {
    const tree = await buildAdminAuditMerkleTree(sampleEvents);

    expect(tree.root).toBeDefined();
    expect(tree.root.length).toBe(64); // SHA-256 hex string
    expect(tree.leaves.length).toBe(3);

    const targetEvent = sampleEvents[1];
    const { proof } = await generateEventAuditProof(tree, targetEvent);
    expect(proof.length).toBeGreaterThan(0);

    const verification = await verifyDisclosedEventAgainstRoot(targetEvent, proof, tree.root);
    expect(verification.isValid).toBe(true);
    expect(verification.computedRoot).toBe(tree.root);
    expect(verification.disclaimer).toBe(AUDIT_COMMITMENT_DISCLAIMER);
  });

  it('detects tampering when an event payload is altered after root anchoring', async () => {
    const tree = await buildAdminAuditMerkleTree(sampleEvents);
    const targetEvent = sampleEvents[0];
    const { proof } = await generateEventAuditProof(tree, targetEvent);

    // Maliciously tamper with the event action
    const tamperedEvent = {
      ...targetEvent,
      action: 'MALICIOUS_FEE_OVERRIDE',
    };

    const verification = await verifyDisclosedEventAgainstRoot(tamperedEvent, proof, tree.root);
    expect(verification.isValid).toBe(false);
    expect(verification.computedRoot).not.toBe(tree.root);
  });

  it('fails verification if verified against a mismatched root', async () => {
    const tree = await buildAdminAuditMerkleTree(sampleEvents);
    const targetEvent = sampleEvents[0];
    const { proof } = await generateEventAuditProof(tree, targetEvent);

    const fakeRoot = '0000000000000000000000000000000000000000000000000000000000000000';
    const verification = await verifyDisclosedEventAgainstRoot(targetEvent, proof, fakeRoot);
    expect(verification.isValid).toBe(false);
  });

  it('preserves local audit continuity during network anchoring failures', async () => {
    const tree = await buildAdminAuditMerkleTree(sampleEvents);

    // 1. Successful anchoring
    const successReceipt = await anchorAuditBatch(tree, { simulateNetworkFailure: false });
    expect(successReceipt.status).toBe('CONFIRMED_PUBLIC_COMMITMENT');
    expect(successReceipt.network).toBe(ANCHOR_NETWORK.PUBLIC_MAINNET);
    expect(successReceipt.txHash).toBeDefined();

    // 2. Network failure fallback
    const failureReceipt = await anchorAuditBatch(tree, { simulateNetworkFailure: true });
    expect(failureReceipt.status).toBe('FALLBACK_LOCAL_CONTINUITY');
    expect(failureReceipt.network).toBe(ANCHOR_NETWORK.LOCAL_IMMUTABLE_FALLBACK);
    expect(failureReceipt.root).toBe(tree.root);
    expect(failureReceipt.retryScheduled).toBe(true);
  });

  it('supports key rotation while incrementing epoch and preserving history', () => {
    const currentConfig = {
      activeKeyId: 'ed25519_2026_q1',
      epoch: 1,
    };

    const rotated = rotateAnchoringKey(currentConfig, 'ed25519_2026_q2');
    expect(rotated.previousKeyId).toBe('ed25519_2026_q1');
    expect(rotated.activeKeyId).toBe('ed25519_2026_q2');
    expect(rotated.epoch).toBe(2);
    expect(rotated.status).toBe('ACTIVE');
  });
});
