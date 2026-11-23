/**
 * Contributor Impact and Review Activity Analytics Dashboard Service
 *
 * Implements a balanced repository activity analytics service:
 * - Separates distinct open-source contribution vectors:
 *   * Merged Pull Requests vs. Unmerged / Closed PRs
 *   * Rigorous Code Reviews & Inline Discussion Threads
 *   * Documentation Guides & Localization
 *   * Issue Triage & Bug Confirmations
 *   * Code Commits
 * - Quality & Bot Hygiene:
 *   * Distinguishes human contributors from automated bots (dependabot, renovate, actions)
 *   * Deduplicates event IDs across paginated GitHub REST / GraphQL responses
 * - Caching & Rate Limit Resilience:
 *   * Enforces 15-minute cache TTL to respect GitHub API rate limits
 *   * Records last successful refresh timestamp
 * - Privacy Protection:
 *   * Excludes private email addresses, personal locations, and demographic inferences
 */

export const CONTRIBUTION_CATEGORIES = Object.freeze({
  MERGED_PR: 'MERGED_PR',
  UNMERGED_PR: 'UNMERGED_PR',
  CODE_REVIEW: 'CODE_REVIEW',
  DOCUMENTATION: 'DOCUMENTATION',
  ISSUE_TRIAGE: 'ISSUE_TRIAGE',
  COMMIT: 'COMMIT'
});

export const BOT_HANDLE_PATTERNS = [
  /\[bot\]$/i,
  /^dependabot/i,
  /^renovate/i,
  /^github-actions/i
];

export const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Checks if a contributor username belongs to an automated bot
 * @param {string} username
 * @returns {boolean}
 */
export function isBotContributor(username = '') {
  if (!username || typeof username !== 'string') return true;
  return BOT_HANDLE_PATTERNS.some(p => p.test(username.trim()));
}

export class ContributorImpactAnalyticsService {
  constructor(options = {}) {
    this.cacheTtlMs = options.cacheTtlMs || CACHE_TTL_MS;
    this.cachedReport = null;
    this.lastRefreshedAt = null;
    this.eventLedger = new Map(); // eventId -> EventRecord
  }

  /**
   * Ingests a raw GitHub activity event deduplicated by ID
   * @param {Object} event
   * @returns {boolean} True if recorded (not duplicate)
   */
  ingestActivityEvent(event = {}) {
    const { eventId, username, category, timestamp = Date.now() } = event;

    if (!eventId || !username || !category) {
      throw new Error('Activity event requires eventId, username, and category');
    }

    if (this.eventLedger.has(eventId)) {
      return false; // Deduplicated
    }

    const isBot = isBotContributor(username);
    const record = {
      eventId,
      username,
      category,
      isBot,
      timestamp: Number(timestamp) || Date.now()
    };

    this.eventLedger.set(eventId, record);
    this.cachedReport = null; // Invalidate cache
    return true;
  }

  /**
   * Generates or retrieves cached analytics dashboard report
   * @param {number} currentTime
   * @returns {Object} Contributor impact report
   */
  getAnalyticsReport(currentTime = Date.now()) {
    if (this.cachedReport && this.lastRefreshedAt && (currentTime - this.lastRefreshedAt) < this.cacheTtlMs) {
      return {
        ...this.cachedReport,
        fromCache: true
      };
    }

    const events = Array.from(this.eventLedger.values());
    const humanEvents = events.filter(e => !e.isBot);

    const counts = {
      mergedPRs: 0,
      unmergedPRs: 0,
      codeReviews: 0,
      documentation: 0,
      issueTriage: 0,
      commits: 0,
      botEventsIgnored: events.length - humanEvents.length
    };

    const uniqueHumanContributors = new Set();

    for (const e of humanEvents) {
      uniqueHumanContributors.add(e.username);
      switch (e.category) {
        case CONTRIBUTION_CATEGORIES.MERGED_PR:
          counts.mergedPRs++;
          break;
        case CONTRIBUTION_CATEGORIES.UNMERGED_PR:
          counts.unmergedPRs++;
          break;
        case CONTRIBUTION_CATEGORIES.CODE_REVIEW:
          counts.codeReviews++;
          break;
        case CONTRIBUTION_CATEGORIES.DOCUMENTATION:
          counts.documentation++;
          break;
        case CONTRIBUTION_CATEGORIES.ISSUE_TRIAGE:
          counts.issueTriage++;
          break;
        case CONTRIBUTION_CATEGORIES.COMMIT:
          counts.commits++;
          break;
      }
    }

    this.lastRefreshedAt = currentTime;
    this.cachedReport = {
      fromCache: false,
      lastRefreshedAt: new Date(currentTime).toISOString(),
      cacheTtlSeconds: Math.round(this.cacheTtlMs / 1000),
      totalEventsAnalyzed: events.length,
      activeHumanContributorsCount: uniqueHumanContributors.size,
      breakdown: counts,
      summary: `Analyzed ${humanEvents.length} human contributions across ${uniqueHumanContributors.size} contributors.`
    };

    return this.cachedReport;
  }
}
