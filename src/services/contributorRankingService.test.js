import { describe, it, expect, beforeEach } from 'vitest';
import {
  isBotAccount,
  resolveContributorTier,
  calculateContributorScore,
  ContributorRankingEngine,
  CONTRIBUTOR_TIERS,
  SCORING_WEIGHTS
} from './contributorRankingService.js';

describe('contributorRankingService', () => {
  describe('isBotAccount', () => {
    it('detects common automation and bot accounts', () => {
      expect(isBotAccount('dependabot[bot]')).toBe(true);
      expect(isBotAccount('renovate-app')).toBe(true);
      expect(isBotAccount('github-actions[bot]')).toBe(true);
      expect(isBotAccount('allcontributors[bot]')).toBe(true);
      expect(isBotAccount('')).toBe(true);
      expect(isBotAccount(null)).toBe(true);
    });

    it('identifies genuine human contributors', () => {
      expect(isBotAccount('alice-dev')).toBe(false);
      expect(isBotAccount('civic_coder_99')).toBe(false);
      expect(isBotAccount('Babin123456')).toBe(false);
    });
  });

  describe('resolveContributorTier', () => {
    it('accurately resolves progressive contributor recognition tiers', () => {
      expect(resolveContributorTier(10)).toBe(CONTRIBUTOR_TIERS.INITIATE);
      expect(resolveContributorTier(35)).toBe(CONTRIBUTOR_TIERS.APPRENTICE);
      expect(resolveContributorTier(80)).toBe(CONTRIBUTOR_TIERS.BUILDER);
      expect(resolveContributorTier(160)).toBe(CONTRIBUTOR_TIERS.CORE_STEWARD);
      expect(resolveContributorTier(320)).toBe(CONTRIBUTOR_TIERS.FELLOW);
    });
  });

  describe('calculateContributorScore', () => {
    it('excludes bots and assigns zero score', () => {
      const res = calculateContributorScore({ username: 'dependabot[bot]', mergedFeaturePRs: 50 });
      expect(res.totalScore).toBe(0);
      expect(res.isBot).toBe(true);
      expect(res.rationale).toContain('bots are excluded');
    });

    it('calculates weighted composite score for human contributors', () => {
      const activity = {
        username: 'alice-dev',
        mergedFeaturePRs: 2,   // 2 * 25 = 50
        mergedBugfixPRs: 1,    // 1 * 18 = 18
        mergedDocPRs: 2,       // 2 * 10 = 20
        reviewsConducted: 2,   // 2 * 8 = 16
        testsAdded: 1,         // 1 * 15 = 15
        issuesTriaged: 1       // 1 * 5 = 5
      };

      const result = calculateContributorScore(activity);
      expect(result.totalScore).toBe(50 + 18 + 20 + 16 + 15 + 5); // 124
      expect(result.tier).toBe(CONTRIBUTOR_TIERS.BUILDER);
      expect(result.isBot).toBe(false);
      expect(result.breakdown.featurePRs.points).toBe(50);
      expect(result.breakdown.tests.points).toBe(15);
    });

    it('applies anti-gaming cap on documentation micro-edits', () => {
      const activity = {
        username: 'doc-spammer',
        mergedDocPRs: 20 // 20 * 10 = 200, but capped at 50
      };

      const result = calculateContributorScore(activity);
      expect(result.totalScore).toBe(50);
      expect(result.breakdown.docPRs.points).toBe(50);
    });

    it('applies penalties for spam PRs without dropping score below zero', () => {
      const spammer = {
        username: 'spammer_user',
        mergedDocPRs: 1, // 10
        spamOrInvalidPRs: 3 // 3 * -30 = -90
      };

      const result = calculateContributorScore(spammer);
      expect(result.totalScore).toBe(0); // Floor at 0
      expect(result.tier).toBe(CONTRIBUTOR_TIERS.INITIATE);
    });
  });

  describe('ContributorRankingEngine', () => {
    let engine;

    beforeEach(() => {
      engine = new ContributorRankingEngine();
    });

    it('ranks multiple contributors in descending score order', () => {
      engine.ingestContributor({ username: 'bob', mergedFeaturePRs: 1 }); // 25 pts
      engine.ingestContributor({ username: 'charlie', mergedFeaturePRs: 4 }); // 100 pts
      engine.ingestContributor({ username: 'dependabot[bot]', mergedFeaturePRs: 10 }); // Bot

      const leaderboard = engine.getRankedLeaderboard();
      expect(leaderboard.length).toBe(2);
      expect(leaderboard[0].username).toBe('charlie');
      expect(leaderboard[0].totalScore).toBe(100);
      expect(leaderboard[1].username).toBe('bob');
      expect(leaderboard[1].totalScore).toBe(25);
    });
  });
});
