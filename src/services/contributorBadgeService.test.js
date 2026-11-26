import { describe, it, expect, beforeEach } from 'vitest';
import {
  BADGE_DEFINITIONS,
  generateEvidenceDigest,
  evaluateBadgeCriteria,
  ContributorBadgeLedger
} from './contributorBadgeService.js';

describe('contributorBadgeService', () => {
  describe('generateEvidenceDigest', () => {
    it('produces deterministic hexadecimal digests for identical evidence', () => {
      const evidence = {
        prNumber: 936,
        commitSha: 'abcdef1234567890',
        author: 'civic-contributor',
        timestamp: 1700000000000
      };

      const d1 = generateEvidenceDigest(evidence);
      const d2 = generateEvidenceDigest(evidence);
      expect(d1).toBe(d2);
      expect(d1).toMatch(/^dig_[a-f0-9]{8}$/);
    });
  });

  describe('evaluateBadgeCriteria', () => {
    it('evaluates FIRST_MERGED_PR based on merged PR count', () => {
      expect(evaluateBadgeCriteria('FIRST_MERGED_PR', { mergedPRCount: 0 }).qualified).toBe(false);
      expect(evaluateBadgeCriteria('FIRST_MERGED_PR', { mergedPRCount: 1 }).qualified).toBe(true);
    });

    it('evaluates DOC_STEWARD requiring at least 3 documentation changes', () => {
      expect(evaluateBadgeCriteria('DOC_STEWARD', { docsEditedCount: 2 }).qualified).toBe(false);
      expect(evaluateBadgeCriteria('DOC_STEWARD', { docsEditedCount: 3 }).qualified).toBe(true);
    });

    it('evaluates ACCESSIBILITY_ADVOCATE requiring accessibility labels', () => {
      expect(evaluateBadgeCriteria('ACCESSIBILITY_ADVOCATE', { hasAccessibilityTag: false }).qualified).toBe(false);
      expect(evaluateBadgeCriteria('ACCESSIBILITY_ADVOCATE', { hasAccessibilityTag: true }).qualified).toBe(true);
    });

    it('evaluates TEST_GUARDIAN requiring at least 5 authored test cases', () => {
      expect(evaluateBadgeCriteria('TEST_GUARDIAN', { testsAuthored: 4 }).qualified).toBe(false);
      expect(evaluateBadgeCriteria('TEST_GUARDIAN', { testsAuthored: 6 }).qualified).toBe(true);
    });

    it('evaluates SECURITY_SENTINEL requiring security hardening tag', () => {
      expect(evaluateBadgeCriteria('SECURITY_SENTINEL', { hasSecurityTag: false }).qualified).toBe(false);
      expect(evaluateBadgeCriteria('SECURITY_SENTINEL', { hasSecurityTag: true }).qualified).toBe(true);
    });

    it('returns false for unknown badge IDs', () => {
      expect(evaluateBadgeCriteria('UNKNOWN_BADGE', {}).qualified).toBe(false);
    });
  });

  describe('ContributorBadgeLedger', () => {
    let ledger;

    beforeEach(() => {
      ledger = new ContributorBadgeLedger();
    });

    it('awards badge with verifiable evidence digest', () => {
      const grant = ledger.awardBadge('contributor_raj', 'FIRST_MERGED_PR', {
        prNumber: 42,
        commitSha: '9a8b7c6d5e4f',
        timestamp: 1710000000000
      });

      expect(grant.badgeId).toBe('FIRST_MERGED_PR');
      expect(grant.username).toBe('contributor_raj');
      expect(grant.evidence.digest).toMatch(/^dig_/);
      expect(grant.evidence.prNumber).toBe(42);

      const badges = ledger.getBadgesForUser('contributor_raj');
      expect(badges.length).toBe(1);
    });

    it('prevents duplicate awarding of the same badge to the same user', () => {
      ledger.awardBadge('user_bob', 'DOC_STEWARD', { prNumber: 101 });
      ledger.awardBadge('user_bob', 'DOC_STEWARD', { prNumber: 102 });

      const badges = ledger.getBadgesForUser('user_bob');
      expect(badges.length).toBe(1);
    });

    it('throws error when awarding non-existent badge', () => {
      expect(() => {
        ledger.awardBadge('user_bob', 'NON_EXISTENT_BADGE', {});
      }).toThrow(/Invalid badge ID/);
    });
  });
});
