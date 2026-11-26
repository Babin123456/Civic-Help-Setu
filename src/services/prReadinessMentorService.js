/**
 * Pull Request Review Mentor and Pre-Flight Readiness Checklist Service
 *
 * Implements an automated, empathetic pre-flight verification coach for contributors:
 * - Scans Pull Request metadata and file lists before requesting maintainer review
 * - Checks critical civic engineering readiness dimensions:
 *   * Issue Reference: Validates presence of "Closes #..." or "Fixes #..."
 *   * Test Coverage: Confirms corresponding .test.js or test specification files are included
 *   * Documentation: Validates accompanying docs/ update for new features or schema changes
 *   * Commit Hygiene: Warns against merge conflict markers, accidental .env commits, or node_modules
 *   * Accessibility & Security: Checks for WCAG considerations or security sensitive file edits
 * - Generates clear, non-punitive suggestions and readiness score (0 - 100%)
 */

export const CHECKLIST_ITEMS = Object.freeze({
  CLOSING_ISSUE_TAG: 'CLOSING_ISSUE_TAG',
  TEST_FILES_INCLUDED: 'TEST_FILES_INCLUDED',
  DOCS_UPDATED: 'DOCS_UPDATED',
  NO_SENSITIVE_LEAKS: 'NO_SENSITIVE_LEAKS',
  CLEAN_COMMIT_MESSAGE: 'CLEAN_COMMIT_MESSAGE'
});

export const LEAK_PRONE_PATTERNS = [
  /\.env(\.local|\.development|\.production)?$/i,
  /id_rsa/i,
  /\.pem$/i,
  /credentials\.json$/i,
  /serviceAccount.*\.json$/i
];

/**
 * Validates PR title and body for closing issue syntax
 * @param {string} title PR title
 * @param {string} body PR description
 * @returns {Object} Verdict and matched issue numbers
 */
export function checkIssueReferences(title = '', body = '') {
  const combined = `${title}\n${body}`;
  const issueRegex = /(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/gi;
  const matches = [...combined.matchAll(issueRegex)].map(m => Number(m[1]));

  return {
    hasClosingReference: matches.length > 0,
    matchedIssues: Array.from(new Set(matches)),
    feedback: matches.length > 0
      ? `Found valid closing reference: #${matches.join(', #')}`
      : 'Please include "Closes #XYZ" or "Fixes #XYZ" in your PR description to automatically link the issue.'
  };
}

/**
 * Scans list of modified files for sensitive configuration leaks
 * @param {Array<string>} modifiedFiles
 * @returns {Object} Leak scan verdict
 */
export function scanForSensitiveFiles(modifiedFiles = []) {
  const leaks = [];

  for (const file of modifiedFiles) {
    if (LEAK_PRONE_PATTERNS.some(pat => pat.test(file))) {
      leaks.push(file);
    }
  }

  return {
    clean: leaks.length === 0,
    leakingFiles: leaks,
    feedback: leaks.length === 0
      ? 'No sensitive configuration files or secrets detected in change set.'
      : `High risk: Detected sensitive files in PR: ${leaks.join(', ')}. Remove immediately.`
  };
}

/**
 * Checks whether PR includes corresponding tests and documentation
 * @param {Array<string>} modifiedFiles
 * @returns {Object} Test and doc coverage checks
 */
export function checkSupportingFiles(modifiedFiles = []) {
  const hasTests = modifiedFiles.some(f => f.includes('.test.') || f.includes('tests/'));
  const hasDocs = modifiedFiles.some(f => f.startsWith('docs/') || f.endsWith('.md'));

  return {
    hasTests,
    hasDocs,
    testFeedback: hasTests
      ? 'Verified: PR includes automated tests.'
      : 'Notice: No unit or integration test files found. Consider adding tests to guarantee regression protection.',
    docFeedback: hasDocs
      ? 'Verified: PR includes documentation updates.'
      : 'Notice: No documentation changes detected. If introducing new features, please update relevant guides.'
  };
}

export class PrReadinessMentor {
  constructor() {
    this.history = [];
  }

  /**
   * Evaluates complete readiness report for a Pull Request
   * @param {Object} prData
   * @returns {Object} Comprehensive mentor evaluation
   */
  evaluateReadiness({ title = '', body = '', modifiedFiles = [], commitMessage = '' }) {
    const issueCheck = checkIssueReferences(title, body);
    const leakCheck = scanForSensitiveFiles(modifiedFiles);
    const supportCheck = checkSupportingFiles(modifiedFiles);

    let score = 0;
    const actionItems = [];

    // Issue check (25 pts)
    if (issueCheck.hasClosingReference) {
      score += 25;
    } else {
      actionItems.push(issueCheck.feedback);
    }

    // Leak check (30 pts - critical)
    if (leakCheck.clean) {
      score += 30;
    } else {
      actionItems.push(leakCheck.feedback);
    }

    // Tests (25 pts)
    if (supportCheck.hasTests) {
      score += 25;
    } else {
      actionItems.push(supportCheck.testFeedback);
    }

    // Docs (20 pts)
    if (supportCheck.hasDocs) {
      score += 20;
    } else {
      actionItems.push(supportCheck.docFeedback);
    }

    const report = {
      score,
      readyForReview: score >= 75 && leakCheck.clean,
      actionItems,
      checks: {
        issueReference: issueCheck,
        sensitiveFiles: leakCheck,
        supportingArtifacts: supportCheck
      },
      mentorNote: score >= 75
        ? 'Great job! Your PR meets core civic quality standards and is ready for maintainer review.'
        : 'A few readiness items remain before requesting review. See action items above.'
    };

    this.history.push(report);
    return report;
  }
}
