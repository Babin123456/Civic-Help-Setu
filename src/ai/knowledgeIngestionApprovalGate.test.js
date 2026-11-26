import { describe, it, expect, beforeEach } from 'vitest';
import {
  KnowledgeIngestionApprovalGate,
  validateSourceManifest,
  INGESTION_STATUS
} from './knowledgeIngestionApprovalGate.js';

describe('knowledgeIngestionApprovalGate', () => {
  const validManifest = {
    title: 'Karnataka Ration Card Eligibility Order 2026',
    publisher: 'Department of Food and Civil Supplies',
    canonicalUrl: 'https://ahara.kar.nic.in/circulars/2026/order_14.pdf',
    checksum: 'sha256_abcdef1234567890',
    jurisdiction: 'Karnataka',
    language: 'kn, en',
    extractedText: 'All BPL cardholders are entitled to monthly quota allocations without biometric failure exclusion.'
  };

  describe('validateSourceManifest', () => {
    it('approves complete and healthy source manifests', () => {
      const res = validateSourceManifest(validManifest);
      expect(res.valid).toBe(true);
      expect(res.errors.length).toBe(0);
    });

    it('rejects manifests with missing fields or poor extraction density', () => {
      const flawed = {
        title: 'Draft',
        canonicalUrl: 'ftp://bad-protocol',
        extractedText: 'Too short'
      };
      const res = validateSourceManifest(flawed);
      expect(res.valid).toBe(false);
      expect(res.errors.some(e => e.includes('canonical HTTPS URL'))).toBe(true);
      expect(res.errors.some(e => e.includes('Extraction failure'))).toBe(true);
    });
  });

  describe('KnowledgeIngestionApprovalGate', () => {
    let gate;

    beforeEach(() => {
      gate = new KnowledgeIngestionApprovalGate();
    });

    it('stages document in PENDING_REVIEW and prevents entry into active corpus', () => {
      const staged = gate.stageDocument(validManifest);
      expect(staged.status).toBe(INGESTION_STATUS.PENDING_REVIEW);
      expect(gate.getPendingReviewQueue().length).toBe(1);
      expect(gate.getActiveRetrievalCorpus().length).toBe(0); // Cannot be retrieved
    });

    it('blocks duplicate document ingestion by checksum', () => {
      gate.stageDocument(validManifest);
      expect(() => {
        gate.stageDocument(validManifest);
      }).toThrow(/Duplicate document detected/);
    });

    it('publishes document into active retrieval corpus upon reviewer approval', () => {
      const staged = gate.stageDocument(validManifest);
      const approved = gate.approveDocument(staged.docId, {
        reviewerHandle: 'editorial_lead',
        notes: 'Verified against state gazette'
      });

      expect(approved.status).toBe(INGESTION_STATUS.APPROVED_PUBLISHED);
      expect(approved.reviewDecision.decision).toBe('APPROVED');
      expect(gate.getActiveRetrievalCorpus().length).toBe(1);
      expect(gate.getActiveRetrievalCorpus()[0].docId).toBe(staged.docId);
    });

    it('rejects unverified documents and ensures they are excluded from retrieval', () => {
      const staged = gate.stageDocument(validManifest);
      const rejected = gate.rejectDocument(staged.docId, {
        reviewerHandle: 'reviewer_2',
        reason: 'Revoked by subsequent high court order'
      });

      expect(rejected.status).toBe(INGESTION_STATUS.REJECTED);
      expect(gate.getActiveRetrievalCorpus().length).toBe(0);
    });

    it('marks outdated documents as SUPERSEDED and removes them from active queries', () => {
      const doc1 = gate.stageDocument({ ...validManifest, checksum: 'sha256_sum_11111' });
      gate.approveDocument(doc1.docId, { reviewerHandle: 'admin' });
      expect(gate.getActiveRetrievalCorpus().length).toBe(1);

      const doc2 = gate.stageDocument({ ...validManifest, checksum: 'sha256_sum_22222', title: 'Amendment Order 2026' });
      gate.approveDocument(doc2.docId, { reviewerHandle: 'admin' });

      // Supersede doc1 with doc2
      const superseded = gate.supersedeDocument(doc1.docId, doc2.docId);
      expect(superseded.status).toBe(INGESTION_STATUS.SUPERSEDED);
      expect(superseded.supersededBy).toBe(doc2.docId);

      // Only doc2 remains in active retrieval
      const active = gate.getActiveRetrievalCorpus();
      expect(active.length).toBe(1);
      expect(active[0].docId).toBe(doc2.docId);
    });
  });
});
