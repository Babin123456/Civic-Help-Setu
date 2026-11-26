import { describe, it, expect, beforeEach } from 'vitest';
import {
  MaintainerModerationService,
  APPEAL_TYPES,
  APPEAL_STATUS,
  generateAuditId
} from './maintainerModerationService.js';

describe('maintainerModerationService', () => {
  describe('generateAuditId', () => {
    it('produces unique audit identifiers prefixed with audit_', () => {
      const id1 = generateAuditId();
      const id2 = generateAuditId();
      expect(id1).toMatch(/^audit_[a-z0-9]+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('MaintainerModerationService', () => {
    let service;

    beforeEach(() => {
      service = new MaintainerModerationService();
    });

    it('submits a contributor appeal and stages in PENDING_REVIEW', () => {
      const appeal = service.submitAppeal({
        username: 'dev_rahul',
        type: APPEAL_TYPES.SCORE_CORRECTION,
        targetId: 'PR #935',
        reason: 'PR was miscategorized as doc instead of feature implementation',
        evidenceUrl: 'https://github.com/GoldRay19/Civic-Help-Setu/pull/935'
      });

      expect(appeal.appealId).toMatch(/^apl_/);
      expect(appeal.status).toBe(APPEAL_STATUS.PENDING_REVIEW);
      expect(appeal.username).toBe('dev_rahul');
      expect(service.getPendingAppeals().length).toBe(1);
    });

    it('throws error when submitting appeal with missing required fields', () => {
      expect(() => {
        service.submitAppeal({ username: '', type: 'SCORE_CORRECTION', reason: '' });
      }).toThrow(/requires username, type, and justification/);
    });

    it('approves an appeal and writes transparent entry to audit ledger', () => {
      const appeal = service.submitAppeal({
        username: 'dev_priya',
        type: APPEAL_TYPES.BADGE_MISSING,
        reason: 'Accessibility audit PR was merged but badge criteria check failed due to network timeout',
        evidenceUrl: 'https://github.com/GoldRay19/Civic-Help-Setu/pull/936'
      });

      const resolved = service.resolveAppeal(appeal.appealId, {
        maintainerUsername: 'maintainer_admin',
        approved: true,
        rationale: 'Verified PR contained WCAG AA landmark fixes',
        adjustmentPoints: 25
      });

      expect(resolved.status).toBe(APPEAL_STATUS.APPROVED);
      expect(resolved.resolution.approved).toBe(true);
      expect(resolved.resolution.adjustmentPoints).toBe(25);

      const audit = service.getAuditLog();
      expect(audit.length).toBe(1);
      expect(audit[0].action).toBe('APPEAL_APPROVED_OVERRIDE');
      expect(audit[0].contributor).toBe('dev_priya');
      expect(audit[0].maintainer).toBe('maintainer_admin');
    });

    it('rejects an invalid appeal with clear justification', () => {
      const appeal = service.submitAppeal({
        username: 'spammer_user',
        type: APPEAL_TYPES.PENALTY_DISPUTE,
        reason: 'Disputing spam penalty for 5 duplicate PRs'
      });

      const resolved = service.resolveAppeal(appeal.appealId, {
        maintainerUsername: 'maintainer_admin',
        approved: false,
        rationale: 'PRs contained unverified automated formatting noise'
      });

      expect(resolved.status).toBe(APPEAL_STATUS.REJECTED);
      expect(resolved.resolution.approved).toBe(false);

      const audit = service.getAuditLog();
      expect(audit[0].action).toBe('APPEAL_REJECTED');
    });
  });
});
