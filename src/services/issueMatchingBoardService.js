/**
 * Contributor Skill and Interest Matching Board Service
 *
 * Implements a privacy-first, client-driven issue matching service for contributors:
 * - Matches developers to open civic issues without profile scraping or external tracking:
 *   * Technical Skills: React, Vite, Node.js, Security, Firebase, CSS/Tailwind, Accessibility/a11y
 *   * Difficulty Levels: Good First Issue (L1), Intermediate (L2), Advanced Architecture (L3)
 *   * Civic Domain Interests: Public Grievance, Ration Services, Education & Schools, Sanitation, Women Safety
 * - Scoring algorithm evaluates:
 *   * Label match density
 *   * Experience tier compatibility
 *   * Domain keyword alignment
 * - Provides explainable fit rationale so developers know why an issue was recommended
 */

export const DIFFICULTY_LEVELS = Object.freeze({
  LEVEL_1_BEGINNER: 'LEVEL_1_BEGINNER',
  LEVEL_2_INTERMEDIATE: 'LEVEL_2_INTERMEDIATE',
  LEVEL_3_ADVANCED: 'LEVEL_3_ADVANCED'
});

export const SUPPORTED_SKILLS = Object.freeze([
  'react',
  'javascript',
  'nodejs',
  'security',
  'accessibility',
  'vitest',
  'firebase',
  'documentation',
  'css'
]);

export const CIVIC_DOMAINS = Object.freeze([
  'grievance',
  'ration',
  'education',
  'sanitation',
  'health',
  'women_safety'
]);

/**
 * Normalizes label tokens for consistent string matching
 * @param {string} token
 * @returns {string} Lowercase alphanumeric normalized token
 */
export function normalizeToken(token = '') {
  if (typeof token !== 'string') return '';
  return token.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Evaluates the compatibility between an issue and contributor preferences
 * @param {Object} issue Open GitHub issue metadata
 * @param {Object} preferences Contributor preferences
 * @returns {Object} Match evaluation with score and explanation
 */
export function evaluateIssueMatch(issue, preferences = {}) {
  const {
    skills = [],
    preferredDifficulty = null,
    domains = []
  } = preferences;

  const issueLabels = (issue.labels || []).map(normalizeToken);
  const issueTitle = (issue.title || '').toLowerCase();
  const issueBody = (issue.body || '').toLowerCase();

  let score = 0;
  const matchHighlights = [];

  // 1. Skill overlap
  for (const skill of skills) {
    const normSkill = normalizeToken(skill);
    const hasLabel = issueLabels.some(l => l.includes(normSkill));
    const inTitleOrBody = issueTitle.includes(normSkill) || issueBody.includes(normSkill);

    if (hasLabel) {
      score += 30;
      matchHighlights.push(`Direct skill label match: ${skill}`);
    } else if (inTitleOrBody) {
      score += 15;
      matchHighlights.push(`Skill mentioned in issue description: ${skill}`);
    }
  }

  // 2. Difficulty fit
  if (preferredDifficulty) {
    const isL1 = issueLabels.some(l => l.includes('goodfirstissue') || l.includes('level1') || l.includes('beginner'));
    const isL3 = issueLabels.some(l => l.includes('level3') || l.includes('advanced') || l.includes('architecture'));

    if (preferredDifficulty === DIFFICULTY_LEVELS.LEVEL_1_BEGINNER && isL1) {
      score += 25;
      matchHighlights.push('Beginner-friendly issue matches preference');
    } else if (preferredDifficulty === DIFFICULTY_LEVELS.LEVEL_3_ADVANCED && isL3) {
      score += 25;
      matchHighlights.push('Advanced level matches preference');
    } else if (preferredDifficulty === DIFFICULTY_LEVELS.LEVEL_2_INTERMEDIATE && !isL1 && !isL3) {
      score += 20;
      matchHighlights.push('Intermediate issue complexity fits preference');
    }
  }

  // 3. Civic domain alignment
  for (const domain of domains) {
    const normDomain = normalizeToken(domain);
    if (issueTitle.includes(normDomain) || issueLabels.some(l => l.includes(normDomain))) {
      score += 20;
      matchHighlights.push(`Domain alignment: ${domain}`);
    }
  }

  return {
    issueId: issue.number || issue.id,
    issueTitle: issue.title,
    matchScore: score,
    matchHighlights,
    recommended: score >= 25
  };
}

export class IssueMatchingBoard {
  constructor(issues = []) {
    this.issues = issues;
  }

  setIssues(issues = []) {
    this.issues = issues;
  }

  /**
   * Recommends ranked issues for a given contributor preference set
   * @param {Object} preferences Contributor preferences
   * @param {number} limit Maximum results to return
   * @returns {Array<Object>} Sorted list of matching issues
   */
  getRecommendations(preferences, limit = 10) {
    const evaluated = this.issues.map(issue => evaluateIssueMatch(issue, preferences));
    const sorted = evaluated.filter(e => e.matchScore > 0).sort((a, b) => b.matchScore - a.matchScore);
    return sorted.slice(0, limit);
  }
}
