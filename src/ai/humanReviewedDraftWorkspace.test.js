import { describe, it, expect, beforeEach } from 'vitest';
import {
  AiDraftReviewWorkspace,
  computeDraftDiff,
  scanForCriticalCivicFacts,
  REVIEW_STATUS
} from './humanReviewedDraftWorkspace.js';

describe('humanReviewedDraftWorkspace', () => {
  describe('scanForCriticalCivicFacts', () => {
    it('detects fees, timelines, and statutory section references', () => {
      const sample = 'Applicants must pay Rs 50 fee within 15 days under Section 12 of the Civic Act.';
      const facts = scanForCriticalCivicFacts(sample);

      expect(facts.hasAny).toBe(true);
      expect(facts.money.length).toBe(1);
      expect(facts.money[0]).toBe('Rs 50');
      expect(facts.deadlines.length).toBe(1);
      expect(facts.deadlines[0]).toBe('15 days');
      expect(facts.statutes.length).toBe(1);
      expect(facts.statutes[0]).toBe('Section 12');
    });

    it('returns empty lists for text without civic numbers or legal rules', () => {
      const sample = 'Please visit the municipal office during morning hours with your documents.';
      const facts = scanForCriticalCivicFacts(sample);
      expect(facts.hasAny).toBe(false);
      expect(facts.money).toEqual([]);
    });
  });

  describe('computeDraftDiff', () => {
    it('accurately identifies additions and flags newly introduced fees or timelines', () => {
      const original = 'Submit application at civic center.';
      const proposed = 'Submit application at civic center.\nPay Rs 100 processing charge within 30 days.';

      const diff = computeDraftDiff(original, proposed);
      expect(diff.additionsCount).toBe(1);
      expect(diff.hasSensitiveChanges).toBe(true);
      expect(diff.criticalFlags.addedMoney).toContain('Rs 100');
      expect(diff.criticalFlags.addedDeadlines).toContain('30 days');
    });
  });

  describe('AiDraftReviewWorkspace', () => {
    let workspace;

    beforeEach(() => {
      workspace = new AiDraftReviewWorkspace();
    });

    it('stages new drafts in PENDING_REVIEW state without publishing', () => {
      const draft = workspace.submitDraftForReview({
        serviceId: 'ration-card',
        draftText: 'New eligibility rules for ration cards.',
        sourceExcerpts: ['Circular No 142/2026']
      });

      expect(draft.status).toBe(REVIEW_STATUS.PENDING_REVIEW);
      expect(draft.revisionId).toMatch(/^rev_/);
      expect(workspace.getActiveApprovedGuidance('ration-card')).toBeNull();
    });

    it('publishes draft only after explicit reviewer approval', () => {
      const draft = workspace.submitDraftForReview({
        serviceId: 'ration-card',
        draftText: 'Standard official guidance text.'
      });

      const approved = workspace.approveDraft('ration-card', draft.revisionId, {
        reviewerHandle: 'senior_officer',
        reason: 'Matches official gazette'
      });

      expect(approved.status).toBe(REVIEW_STATUS.APPROVED);
      expect(approved.reviewDecision.reviewerHandle).toBe('senior_officer');

      const active = workspace.getActiveApprovedGuidance('ration-card');
      expect(active).not.toBeNull();
      expect(active.revisionId).toBe(draft.revisionId);
    });

    it('rejects an inaccurate draft and prevents it from entering active guidance', () => {
      const draft = workspace.submitDraftForReview({
        serviceId: 'voter-id',
        draftText: 'Incorrect fees stated.'
      });

      const rejected = workspace.rejectDraft('voter-id', draft.revisionId, {
        reviewerHandle: 'reviewer_1',
        reason: 'Voter registration is free of cost'
      });

      expect(rejected.status).toBe(REVIEW_STATUS.REJECTED);
      expect(workspace.getActiveApprovedGuidance('voter-id')).toBeNull();
    });

    it('enables rollback to previous approved version if discrepancy is found', () => {
      // 1. First approved revision
      const d1 = workspace.submitDraftForReview({ serviceId: 'pension', draftText: 'Revision 1: Valid' });
      workspace.approveDraft('pension', d1.revisionId, { reviewerHandle: 'rev_1' });

      // 2. Second approved revision
      const d2 = workspace.submitDraftForReview({ serviceId: 'pension', draftText: 'Revision 2: Flawed' });
      workspace.approveDraft('pension', d2.revisionId, { reviewerHandle: 'rev_2' });

      // 3. Rollback
      const restored = workspace.rollbackToLastApproved('pension', {
        reviewerHandle: 'admin',
        reason: 'Discrepancy in Revision 2'
      });

      expect(restored.revisionId).toBe(d1.revisionId);
      expect(workspace.getActiveApprovedGuidance('pension').revisionId).toBe(d1.revisionId);
    });
  });
});
