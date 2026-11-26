import { describe, it, expect, beforeEach } from 'vitest';
import {
  getUtcIsoWeek,
  isSubstantiveActivity,
  FairContributionStreakTracker,
  CONTRIBUTION_ACTIVITY_TYPES
} from './contributionStreakService.js';

describe('contributionStreakService', () => {
  describe('getUtcIsoWeek', () => {
    it('computes correct ISO week strings consistently', () => {
      const w1 = getUtcIsoWeek('2026-11-21T12:00:00Z');
      expect(w1).toMatch(/^2026-W\d{2}$/);

      const w2 = getUtcIsoWeek(new Date(Date.UTC(2026, 0, 5))); // Early Jan 2026
      expect(w2).toBe('2026-W02');
    });
  });

  describe('isSubstantiveActivity', () => {
    it('approves substantive PRs, reviews, and triage', () => {
      expect(isSubstantiveActivity({ type: CONTRIBUTION_ACTIVITY_TYPES.MERGED_PR, linesModified: 45 })).toBe(true);
      expect(isSubstantiveActivity({ type: CONTRIBUTION_ACTIVITY_TYPES.CODE_REVIEW })).toBe(true);
      expect(isSubstantiveActivity({ type: CONTRIBUTION_ACTIVITY_TYPES.ISSUE_TRIAGE })).toBe(true);
    });

    it('rejects bot activities or empty PR commits', () => {
      expect(isSubstantiveActivity({ type: 'MERGED_PR', isBot: true })).toBe(false);
      expect(isSubstantiveActivity({ type: 'MERGED_PR', linesModified: 0 })).toBe(false);
      expect(isSubstantiveActivity({ type: 'UNKNOWN_TYPE' })).toBe(false);
      expect(isSubstantiveActivity(null)).toBe(false);
    });
  });

  describe('FairContributionStreakTracker', () => {
    let tracker;

    beforeEach(() => {
      tracker = new FairContributionStreakTracker('civic_dev');
    });

    it('increments streak when active in consecutive weeks', () => {
      tracker.activeWeeks.add('2026-W40');
      tracker.activeWeeks.add('2026-W41');
      tracker.activeWeeks.add('2026-W42');

      const calendar = ['2026-W40', '2026-W41', '2026-W42'];
      const stats = tracker.calculateStreak(calendar);

      expect(stats.currentStreak).toBe(3);
      expect(stats.longestStreak).toBe(3);
      expect(stats.healthyMomentum).toBe(true);
    });

    it('utilizes grace period freeze to preserve streak during a 1-week break', () => {
      tracker.activeWeeks.add('2026-W40');
      tracker.activeWeeks.add('2026-W41');
      // Skipped 2026-W42 (e.g. sick leave / exams)
      tracker.activeWeeks.add('2026-W43');

      const calendar = ['2026-W40', '2026-W41', '2026-W42', '2026-W43'];
      const stats = tracker.calculateStreak(calendar);

      expect(stats.currentStreak).toBe(3); // 40, 41, (freeze 42), 43 = 3 active weeks maintained
      expect(stats.graceWeeksUsed).toBe(1);
    });

    it('resets streak if gap exceeds allowed grace period', () => {
      tracker.activeWeeks.add('2026-W40');
      // Skipped 2026-W41 and 2026-W42 (2 consecutive missing weeks)
      tracker.activeWeeks.add('2026-W43');

      const calendar = ['2026-W40', '2026-W41', '2026-W42', '2026-W43'];
      const stats = tracker.calculateStreak(calendar);

      expect(stats.currentStreak).toBe(1); // Reset after W42, then W43 is 1
      expect(stats.longestStreak).toBe(1);
    });

    it('logs valid activity into active weeks set', () => {
      const logged = tracker.logActivity({
        type: CONTRIBUTION_ACTIVITY_TYPES.CODE_REVIEW,
        timestamp: '2026-11-21T00:00:00Z'
      });

      expect(logged).toBe(true);
      expect(tracker.activeWeeks.size).toBe(1);
    });
  });
});
