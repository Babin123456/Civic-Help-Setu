import { describe, it, expect, beforeEach } from 'vitest';
import {
  PersonalContributionPassport,
  generatePassportShareToken,
  VISIBILITY_OPTIONS
} from './contributionPassportService.js';

describe('contributionPassportService', () => {
  describe('generatePassportShareToken', () => {
    it('generates unguessable token with pass_tok_ prefix', () => {
      const tok1 = generatePassportShareToken();
      const tok2 = generatePassportShareToken();
      expect(tok1).toMatch(/^pass_tok_[a-z0-9]+_[a-z0-9]+$/);
      expect(tok1).not.toBe(tok2);
    });
  });

  describe('PersonalContributionPassport', () => {
    let passport;

    beforeEach(() => {
      passport = new PersonalContributionPassport('dev_ananya', {
        bio: 'Civic UI accessibility specialist'
      });
    });

    it('initializes in PRIVATE mode by default with no share token', () => {
      expect(passport.visibility).toBe(VISIBILITY_OPTIONS.PRIVATE);
      expect(passport.shareToken).toBeNull();
      expect(passport.getPublicPassportView()).toBeNull();
    });

    it('enables public sharing and creates an unguessable share token', () => {
      const token = passport.enablePublicSharing();
      expect(passport.visibility).toBe(VISIBILITY_OPTIONS.PUBLIC);
      expect(token).toMatch(/^pass_tok_/);
      expect(passport.shareToken).toBe(token);

      // Public view accessible with correct token
      const view = passport.getPublicPassportView(token);
      expect(view).not.toBeNull();
      expect(view.username).toBe('dev_ananya');
      expect(view.bio).toBe('Civic UI accessibility specialist');
    });

    it('rejects public access when token is incorrect or missing', () => {
      const validToken = passport.enablePublicSharing();
      expect(passport.getPublicPassportView('wrong_token')).toBeNull();
      expect(passport.getPublicPassportView(null)).toBeNull();
    });

    it('immediately revokes public access and wipes share token', () => {
      const token = passport.enablePublicSharing();
      expect(passport.getPublicPassportView(token)).not.toBeNull();

      passport.revokePublicSharing();
      expect(passport.visibility).toBe(VISIBILITY_OPTIONS.PRIVATE);
      expect(passport.shareToken).toBeNull();
      expect(passport.getPublicPassportView(token)).toBeNull();
    });

    it('records contributions and honors timestamp privacy settings', () => {
      passport.enablePublicSharing();
      passport.addContribution({
        title: 'Fix WCAG color contrast on search filter buttons',
        prNumber: 937,
        impact: 'High accessibility fix',
        date: '2026-11-21T00:00:00Z'
      });

      const token = passport.shareToken;
      const viewWithTime = passport.getPublicPassportView(token);
      expect(viewWithTime.contributions.length).toBe(1);
      expect(viewWithTime.contributions[0].date).toBe('2026-11-21T00:00:00Z');

      // Toggle privacy setting to hide timestamps
      passport.privacySettings.showActivityTimestamps = false;
      const viewWithoutTime = passport.getPublicPassportView(token);
      expect(viewWithoutTime.contributions[0].date).toBeNull();
    });

    it('exports formatted markdown portfolio for CV or profile', () => {
      passport.addContribution({
        title: 'Implement Content Security Policy reporting',
        prNumber: 923,
        impact: 'Security baseline'
      });
      passport.addBadge({ name: 'Security Sentinel', category: 'SECURITY' });

      const md = passport.exportMarkdownPortfolio();
      expect(md).toContain('# Civic Help Setu Contribution Passport: @dev_ananya');
      expect(md).toContain('PR #923');
      expect(md).toContain('Implement Content Security Policy reporting');
      expect(md).toContain('Security Sentinel');
    });

    it('throws error when initialized without username', () => {
      expect(() => new PersonalContributionPassport('')).toThrow(/username is required/);
    });
  });
});
