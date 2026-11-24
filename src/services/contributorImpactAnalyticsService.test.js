import { describe, it, expect, beforeEach } from 'vitest';
import {
  ContributorImpactAnalyticsService,
  isBotContributor,
  CONTRIBUTION_CATEGORIES
} from './contributorImpactAnalyticsService.js';

describe('contributorImpactAnalyticsService', () => {
  describe('isBotContributor', () => {
    it('accurately identifies bot accounts and human contributors', () => {
      expect(isBotContributor('dependabot[bot]')).toBe(true);
      expect(isBotContributor('renovate-app')).toBe(true);
      expect(isBotContributor('github-actions[bot]')).toBe(true);
      expect(isBotContributor('dev_priya')).toBe(false);
      expect(isBotContributor('Babin123456')).toBe(false);
    });
  });

  describe('ContributorImpactAnalyticsService', () => {
    let service;

    beforeEach(() => {
      service = new ContributorImpactAnalyticsService({ cacheTtlMs: 1000 });
    });

    it('deduplicates events with identical eventId', () => {
      const e1 = service.ingestActivityEvent({
        eventId: 'evt_100',
        username: 'alice',
        category: CONTRIBUTION_CATEGORIES.MERGED_PR
      });
      const e2 = service.ingestActivityEvent({
        eventId: 'evt_100',
        username: 'alice',
        category: CONTRIBUTION_CATEGORIES.MERGED_PR
      });

      expect(e1).toBe(true);
      expect(e2).toBe(false); // Deduplicated
      expect(service.eventLedger.size).toBe(1);
    });

    it('distinguishes merged PRs, unmerged PRs, reviews, and documentation', () => {
      service.ingestActivityEvent({ eventId: '1', username: 'alice', category: CONTRIBUTION_CATEGORIES.MERGED_PR });
      service.ingestActivityEvent({ eventId: '2', username: 'bob', category: CONTRIBUTION_CATEGORIES.UNMERGED_PR });
      service.ingestActivityEvent({ eventId: '3', username: 'charlie', category: CONTRIBUTION_CATEGORIES.CODE_REVIEW });
      service.ingestActivityEvent({ eventId: '4', username: 'david', category: CONTRIBUTION_CATEGORIES.DOCUMENTATION });
      service.ingestActivityEvent({ eventId: '5', username: 'dependabot[bot]', category: CONTRIBUTION_CATEGORIES.MERGED_PR }); // Bot

      const report = service.getAnalyticsReport();
      expect(report.activeHumanContributorsCount).toBe(4);
      expect(report.breakdown.mergedPRs).toBe(1);
      expect(report.breakdown.unmergedPRs).toBe(1);
      expect(report.breakdown.codeReviews).toBe(1);
      expect(report.breakdown.documentation).toBe(1);
      expect(report.breakdown.botEventsIgnored).toBe(1);
    });

    it('caches report within TTL and returns fromCache flag', () => {
      const now = 1700000000000;
      service.ingestActivityEvent({ eventId: '1', username: 'alice', category: CONTRIBUTION_CATEGORIES.MERGED_PR });

      const report1 = service.getAnalyticsReport(now);
      expect(report1.fromCache).toBe(false);

      const report2 = service.getAnalyticsReport(now + 500); // 500ms < 1000ms TTL
      expect(report2.fromCache).toBe(true);

      const report3 = service.getAnalyticsReport(now + 1500); // 1500ms > 1000ms TTL
      expect(report3.fromCache).toBe(false);
    });
  });
});
