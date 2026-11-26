import { describe, it, expect, beforeEach } from 'vitest';
import {
  PublicConsultationTimestampService,
  computeSaltedCommitment,
  computeMerkleRoot
} from './publicConsultationTimestampService.js';

describe('publicConsultationTimestampService', () => {
  describe('computeSaltedCommitment', () => {
    it('produces deterministic hash and incorporates salt', () => {
      const text = 'Proposal to increase green park buffer zone by 10 meters.';
      const salt = 'salt_random_123';

      const c1 = computeSaltedCommitment(text, salt);
      const c2 = computeSaltedCommitment(text, salt);
      const c3 = computeSaltedCommitment(text, 'different_salt');

      expect(c1).toBe(c2);
      expect(c1).toMatch(/^cmt_[a-f0-9]{8}$/);
      expect(c1).not.toBe(c3);
    });
  });

  describe('computeMerkleRoot', () => {
    it('computes consistent Merkle root regardless of commitment input order', () => {
      const c1 = 'cmt_11111111';
      const c2 = 'cmt_22222222';

      const rootA = computeMerkleRoot([c1, c2]);
      const rootB = computeMerkleRoot([c2, c1]);

      expect(rootA).toBe(rootB);
      expect(rootA).toMatch(/^mkl_[a-f0-9]{8}$/);
    });

    it('returns default root for empty commitments list', () => {
      expect(computeMerkleRoot([])).toBe('root_empty');
    });
  });

  describe('PublicConsultationTimestampService', () => {
    let service;

    beforeEach(() => {
      service = new PublicConsultationTimestampService();
    });

    it('creates initial unanchored pending receipt', () => {
      const receipt = service.createSubmissionReceipt({
        submissionId: 'sub_42',
        consultationId: 'ward_71_budget',
        submissionText: 'Expand pedestrian footpath on Main Road.'
      });

      expect(receipt.receiptId).toMatch(/^rcpt_/);
      expect(receipt.anchored).toBe(false);
      expect(receipt.merkleRoot).toBeNull();
      expect(receipt.commitment).toMatch(/^cmt_/);
    });

    it('anchors batch and updates receipts with Merkle root', () => {
      const r1 = service.createSubmissionReceipt({
        submissionId: 'sub_1',
        consultationId: 'c1',
        submissionText: 'Text 1'
      });
      const r2 = service.createSubmissionReceipt({
        submissionId: 'sub_2',
        consultationId: 'c1',
        submissionText: 'Text 2'
      });

      const root = service.anchorBatch();
      expect(root).toMatch(/^mkl_/);
      expect(r1.anchored).toBe(true);
      expect(r1.merkleRoot).toBe(root);
      expect(r2.anchored).toBe(true);
      expect(r2.merkleRoot).toBe(root);
    });

    it('verifies valid receipt independently against raw submission text', () => {
      const r = service.createSubmissionReceipt({
        submissionId: 'sub_3',
        consultationId: 'c1',
        submissionText: 'Authentic citizen text.'
      });
      const root = service.anchorBatch();

      const verification = service.verifyReceipt(r, 'Authentic citizen text.', root);
      expect(verification.valid).toBe(true);
      expect(verification.submissionId).toBe('sub_3');
    });

    it('fails verification when submission content was altered or tampered with', () => {
      const r = service.createSubmissionReceipt({
        submissionId: 'sub_4',
        consultationId: 'c1',
        submissionText: 'Original citizen text.'
      });
      const root = service.anchorBatch();

      const verification = service.verifyReceipt(r, 'Tampered citizen text.', root);
      expect(verification.valid).toBe(false);
      expect(verification.reason).toContain('Content mismatch');
    });
  });
});
