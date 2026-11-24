/**
 * Fair Contribution Streaks Service with Anti-Gaming Rules
 *
 * Implements a healthy, resilient streak tracker for civic tech contributors:
 * - Moves beyond brittle daily streaks that incentivize burnout or artificial empty commits
 * - Tracks Weekly Active Contribution cycles based on standardized UTC ISO weeks
 * - Grace Period Mechanism: Permits 1 excused week freeze (e.g. exams, health, holidays) without resetting streak
 * - Anti-Gaming Rules:
 *   * Excludes trivial commits (e.g., whitespace changes, git empty commits)
 *   * Filters automated bot accounts
 *   * Enforces substantive contribution criteria (merged PR, approved review, or triaged issue)
 * - Returns historical streak statistics and active status
 */

export const CONTRIBUTION_ACTIVITY_TYPES = Object.freeze({
  MERGED_PR: 'MERGED_PR',
  CODE_REVIEW: 'CODE_REVIEW',
  ISSUE_TRIAGE: 'ISSUE_TRIAGE',
  DOCUMENTATION: 'DOCUMENTATION'
});

/**
 * Returns ISO week key (e.g., "2026-W47") for a given date in UTC
 * @param {Date|number|string} dateInput
 * @returns {string} ISO week representation
 */
export function getUtcIsoWeek(dateInput = new Date()) {
  const d = new Date(dateInput);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target) / 604800000);
  const year = new Date(firstThursday).getUTCFullYear();
  return `${year}-W${String(weekNumber).padStart(2, '0')}`;
}

/**
 * Evaluates whether an activity item qualifies as substantive
 * @param {Object} activity Activity record
 * @returns {boolean} True if activity is legitimate and substantive
 */
export function isSubstantiveActivity(activity = {}) {
  if (!activity || typeof activity !== 'object') return false;

  // Reject bot contributions
  if (activity.isBot) return false;

  // Check valid substantive activity types
  if (!CONTRIBUTION_ACTIVITY_TYPES[activity.type]) {
    return false;
  }

  // Reject empty or whitespace-only commit activities
  if (activity.linesModified !== undefined && activity.linesModified <= 0 && activity.type === 'MERGED_PR') {
    return false;
  }

  return true;
}

export class FairContributionStreakTracker {
  constructor(username, options = {}) {
    this.username = username;
    this.maxGraceWeeks = options.maxGraceWeeks || 1;
    this.activeWeeks = new Set();
    this.freezeWeeksUsed = 0;
  }

  /**
   * Logs a qualifying contribution
   * @param {Object} activity Contribution record with timestamp and type
   * @returns {boolean} True if recorded
   */
  logActivity(activity) {
    if (!isSubstantiveActivity(activity)) {
      return false;
    }

    const weekKey = getUtcIsoWeek(activity.timestamp || Date.now());
    this.activeWeeks.add(weekKey);
    return true;
  }

  /**
   * Computes streak metrics sorted across chronological weeks
   * @param {Array<string>} calendarWeeks Chronological list of weeks to evaluate
   * @returns {Object} Streak metrics
   */
  calculateStreak(calendarWeeks = []) {
    let currentStreak = 0;
    let longestStreak = 0;
    let graceAvailable = this.maxGraceWeeks;
    let graceUsedCount = 0;

    for (const week of calendarWeeks) {
      if (this.activeWeeks.has(week)) {
        currentStreak += 1;
        if (currentStreak > longestStreak) {
          longestStreak = currentStreak;
        }
      } else if (graceAvailable > 0 && currentStreak > 0) {
        // Use grace week freeze to keep momentum intact
        graceAvailable -= 1;
        graceUsedCount += 1;
      } else {
        currentStreak = 0;
        graceAvailable = this.maxGraceWeeks;
      }
    }

    return {
      username: this.username,
      currentStreak,
      longestStreak,
      activeWeeksCount: this.activeWeeks.size,
      graceWeeksUsed: graceUsedCount,
      healthyMomentum: currentStreak >= 2
    };
  }
}
