/**
 * Multi-Signal Contributor Ranking Engine
 *
 * Implements a transparent, deterministic scoring system for open-source contributors:
 * - Balances multiple weighted contribution dimensions:
 *   * Merged Pull Requests (core logic, features, bug fixes)
 *   * Rigorous Code Reviews & constructive inline comments
 *   * Documentation Stewarding & Guides
 *   * Test Coverage & Verification suites added
 *   * Issue Triage & Bug Reproduction reports
 * - Strict Anti-Gaming & Quality Checks:
 *   * Filters out automated bots (dependabot, github-actions, renovate)
 *   * Enforces diminishing marginal returns on high-frequency small edits
 *   * Subtracts spam or rejected pull requests
 * - Emits transparent explainability breakdown for every scored contributor
 */

export const KNOWN_BOT_PATTERNS = [
  /\[bot\]$/i,
  /^dependabot/i,
  /^renovate/i,
  /^github-actions/i,
  /^allcontributors/i
];

export const SCORING_WEIGHTS = Object.freeze({
  MERGED_FEATURE_PR: 25,
  MERGED_BUGFIX_PR: 18,
  MERGED_DOC_PR: 10,
  CONSTRUCTIVE_CODE_REVIEW: 8,
  TEST_SUITE_CONTRIBUTION: 15,
  VALID_ISSUE_TRIAGE: 5,
  SPAM_OR_MALICIOUS_PR_PENALTY: -30
});

export const CONTRIBUTOR_TIERS = Object.freeze({
  INITIATE: 'INITIATE',       // 0 - 29 pts
  APPRENTICE: 'APPRENTICE',   // 30 - 74 pts
  BUILDER: 'BUILDER',         // 75 - 149 pts
  CORE_STEWARD: 'CORE_STEWARD', // 150 - 299 pts
  FELLOW: 'FELLOW'            // 300+ pts
});

/**
 * Determines whether a given username corresponds to an automated bot
 * @param {string} username GitHub handle
 * @returns {boolean} True if identified as a bot
 */
export function isBotAccount(username = '') {
  if (typeof username !== 'string' || !username.trim()) return true;
  return KNOWN_BOT_PATTERNS.some(pattern => pattern.test(username.trim()));
}

/**
 * Calculates contributor tier based on total aggregated score
 * @param {number} totalScore
 * @returns {string} Contributor tier identifier
 */
export function resolveContributorTier(totalScore = 0) {
  if (totalScore >= 300) return CONTRIBUTOR_TIERS.FELLOW;
  if (totalScore >= 150) return CONTRIBUTOR_TIERS.CORE_STEWARD;
  if (totalScore >= 75) return CONTRIBUTOR_TIERS.BUILDER;
  if (totalScore >= 30) return CONTRIBUTOR_TIERS.APPRENTICE;
  return CONTRIBUTOR_TIERS.INITIATE;
}

/**
 * Computes deterministic score and explainability breakdown for a contributor
 * @param {Object} signals Contributor activity counters
 * @returns {Object} Scored profile with itemized rationale
 */
export function calculateContributorScore(signals = {}) {
  const {
    username = 'unknown',
    mergedFeaturePRs = 0,
    mergedBugfixPRs = 0,
    mergedDocPRs = 0,
    reviewsConducted = 0,
    testsAdded = 0,
    issuesTriaged = 0,
    spamOrInvalidPRs = 0
  } = signals;

  if (isBotAccount(username)) {
    return {
      username,
      totalScore: 0,
      tier: CONTRIBUTOR_TIERS.INITIATE,
      isBot: true,
      breakdown: {},
      rationale: 'Automated service accounts and bots are excluded from rankings'
    };
  }

  // Calculate points with diminishing return bounds
  const featureScore = Math.max(0, mergedFeaturePRs) * SCORING_WEIGHTS.MERGED_FEATURE_PR;
  const bugfixScore = Math.max(0, mergedBugfixPRs) * SCORING_WEIGHTS.MERGED_BUGFIX_PR;
  const docScore = Math.min(50, Math.max(0, mergedDocPRs) * SCORING_WEIGHTS.MERGED_DOC_PR); // capped at 50 to prevent micro-doc spam
  const reviewScore = Math.min(80, Math.max(0, reviewsConducted) * SCORING_WEIGHTS.CONSTRUCTIVE_CODE_REVIEW);
  const testScore = Math.max(0, testsAdded) * SCORING_WEIGHTS.TEST_SUITE_CONTRIBUTION;
  const triageScore = Math.min(30, Math.max(0, issuesTriaged) * SCORING_WEIGHTS.VALID_ISSUE_TRIAGE);
  const penalty = Math.max(0, spamOrInvalidPRs) * SCORING_WEIGHTS.SPAM_OR_MALICIOUS_PR_PENALTY;

  const rawSum = featureScore + bugfixScore + docScore + reviewScore + testScore + triageScore + penalty;
  const totalScore = Math.max(0, rawSum); // Total cannot fall below zero

  return {
    username,
    totalScore,
    tier: resolveContributorTier(totalScore),
    isBot: false,
    breakdown: {
      featurePRs: { count: mergedFeaturePRs, points: featureScore },
      bugfixPRs: { count: mergedBugfixPRs, points: bugfixScore },
      docPRs: { count: mergedDocPRs, points: docScore },
      reviews: { count: reviewsConducted, points: reviewScore },
      tests: { count: testsAdded, points: testScore },
      triage: { count: issuesTriaged, points: triageScore },
      penalties: { count: spamOrInvalidPRs, points: penalty }
    },
    rationale: `Scored ${totalScore} pts across code, reviews, documentation, and tests.`
  };
}

export class ContributorRankingEngine {
  constructor() {
    this.profiles = new Map();
  }

  ingestContributor(activityData) {
    const scored = calculateContributorScore(activityData);
    this.profiles.set(scored.username, scored);
    return scored;
  }

  getRankedLeaderboard() {
    const valid = Array.from(this.profiles.values()).filter(p => !p.isBot);
    return valid.sort((a, b) => b.totalScore - a.totalScore);
  }
}
