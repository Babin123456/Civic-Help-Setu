import { describe, it, expect } from 'vitest';
import {
  PROVENANCE_STATUS,
  EDGE_TYPES,
  REVIEW_DECISIONS,
  SOURCE_TYPES,
  TRANSFORMATION_TYPES,
  JURISDICTION_LEVELS,
  canTransitionSourceStatus,
  canTransitionReviewStatus,
  validateKnowledgeSource,
  validateSourceSnapshot,
  validateTransformationRun,
  validateProvenanceEdge,
  validateEditorialReview,
  validateSupersessionLink,
} from './provenanceContract';

describe('provenanceContract', () => {
  describe('state transitions', () => {
    it('allows valid source state transitions', () => {
      expect(canTransitionSourceStatus(PROVENANCE_STATUS.ACTIVE, PROVENANCE_STATUS.FLAGGED)).toBe(true);
      expect(canTransitionSourceStatus(PROVENANCE_STATUS.ACTIVE, PROVENANCE_STATUS.SUPERSEDED)).toBe(true);
      expect(canTransitionSourceStatus(PROVENANCE_STATUS.FLAGGED, PROVENANCE_STATUS.ACTIVE)).toBe(true);
      expect(canTransitionSourceStatus(PROVENANCE_STATUS.SUPERSEDED, PROVENANCE_STATUS.DEPRECATED)).toBe(true);
    });

    it('rejects invalid source state transitions', () => {
      expect(canTransitionSourceStatus(PROVENANCE_STATUS.SUPERSEDED, PROVENANCE_STATUS.ACTIVE)).toBe(false);
      expect(canTransitionSourceStatus(PROVENANCE_STATUS.DEPRECATED, PROVENANCE_STATUS.ACTIVE)).toBe(false);
      expect(canTransitionSourceStatus(null, PROVENANCE_STATUS.ACTIVE)).toBe(false);
    });

    it('allows valid review state transitions', () => {
      expect(canTransitionReviewStatus(REVIEW_DECISIONS.PENDING, REVIEW_DECISIONS.APPROVED)).toBe(true);
      expect(canTransitionReviewStatus(REVIEW_DECISIONS.PENDING, REVIEW_DECISIONS.REJECTED)).toBe(true);
      expect(canTransitionReviewStatus(REVIEW_DECISIONS.APPROVED, REVIEW_DECISIONS.FLAGGED)).toBe(true);
    });

    it('rejects invalid review transitions', () => {
      expect(canTransitionReviewStatus(REVIEW_DECISIONS.REJECTED, REVIEW_DECISIONS.APPROVED)).toBe(false);
    });
  });

  describe('validations', () => {
    it('validates a correct KnowledgeSource', () => {
      const valid = {
        id: 'src_delhi_tree_1994',
        name: 'Delhi Preservation of Trees Act, 1994',
        publisher: 'Department of Forests & Wildlife, GNCTD',
        sourceUrl: 'https://forest.delhigovt.nic.in/tree-act-1994',
        sourceType: SOURCE_TYPES.STATUTORY_ACT,
        status: PROVENANCE_STATUS.ACTIVE,
        jurisdiction: { level: JURISDICTION_LEVELS.STATE, state: 'Delhi' },
      };
      const res = validateKnowledgeSource(valid);
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it('rejects non-https KnowledgeSource sourceUrl', () => {
      const invalid = {
        id: 'src_insecure',
        name: 'Test Source',
        publisher: 'Test Publisher',
        sourceUrl: 'http://insecure.gov.in/act',
        sourceType: SOURCE_TYPES.STATUTORY_ACT,
        status: PROVENANCE_STATUS.ACTIVE,
        jurisdiction: { level: JURISDICTION_LEVELS.NATIONAL },
      };
      const res = validateKnowledgeSource(invalid);
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain('HTTPS');
    });

    it('validates SourceSnapshot and flags invalid dates', () => {
      const snapshot = {
        id: 'snap_123',
        sourceId: 'src_delhi_tree_1994',
        retrievalTimestamp: '2026-10-15T10:00:00Z',
        contentHash: 'a1b2c3d4e5f67890',
      };
      expect(validateSourceSnapshot(snapshot).valid).toBe(true);

      const invalidDate = { ...snapshot, retrievalTimestamp: 'not-a-date' };
      expect(validateSourceSnapshot(invalidDate).valid).toBe(false);
    });

    it('validates TransformationRun structure and status', () => {
      const run = {
        id: 'run_123',
        snapshotId: 'snap_123',
        parserVersion: 'v1.0.0',
        transformationType: TRANSFORMATION_TYPES.REGEX_EXTRACTION,
        status: 'success',
      };
      expect(validateTransformationRun(run).valid).toBe(true);

      const invalidRun = { ...run, status: 'unknown_status' };
      expect(validateTransformationRun(invalidRun).valid).toBe(false);
    });

    it('validates ProvenanceEdge confidence range and types', () => {
      const edge = {
        id: 'edge_1',
        sourceEntityId: 'snap_123',
        targetEntityId: 'service_fee_rule',
        edgeType: EDGE_TYPES.EXTRACTED_FROM,
        confidenceScore: 0.95,
      };
      expect(validateProvenanceEdge(edge).valid).toBe(true);

      const invalidScore = { ...edge, confidenceScore: 1.5 };
      expect(validateProvenanceEdge(invalidScore).valid).toBe(false);
    });

    it('requires overrideReason when isOverride is true on EditorialReview', () => {
      const review = {
        id: 'rev_1',
        targetEntityId: 'fact_1',
        reviewDecision: REVIEW_DECISIONS.APPROVED,
        reviewerRole: 'admin',
        isOverride: true,
      };
      const res = validateEditorialReview(review);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('overrideReason'))).toBe(true);

      const validOverride = {
        ...review,
        overrideReason: 'Gazette notification explicitly amended fee schedule clause 2',
      };
      expect(validateEditorialReview(validOverride).valid).toBe(true);
    });

    it('rejects identical predecessorId and successorId on SupersessionLink', () => {
      const link = {
        id: 'sup_1',
        predecessorId: 'src_v1',
        successorId: 'src_v1',
      };
      const res = validateSupersessionLink(link);
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain('cannot be identical');
    });
  });
});

