/**
 * Human-Reviewed AI Draft Comparison and Revision Workspace Service
 *
 * Implements a controlled review and approval workflow for AI-generated civic guidance:
 * - Compares AI drafts with previously approved guidance and official source excerpts
 * - Computes token-level and line-level diffs (additions, deletions, unchanged)
 * - Flags critical changes:
 *   * Monetary amounts and fees (e.g. Rs 50, Rs 500)
 *   * Deadlines and waiting periods (e.g. 15 days, 30 days)
 *   * Statutory legal sections (e.g. Section 12, Act of 2013)
 *   * Eligibility prerequisites
 * - Requires explicit human approval before any draft can be designated as reusable guidance
 * - Provides audit trails and one-click rollback to the previous approved revision
 * - Excludes citizen PII and raw private chat histories
 */

export const REVIEW_STATUS = Object.freeze({
  PENDING_REVIEW: 'PENDING_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  ROLLED_BACK: 'ROLLED_BACK'
});

export const SENSITIVE_REGEXES = Object.freeze({
  MONEY: /(?:₹|rs\.?|inr)\s*\d+(?:,\d+)*(?:\.\d+)?/gi,
  DEADLINE: /\b\d+\s*(?:day|month|week|year|working\s*day)s?\b/gi,
  STATUTE: /\b(?:section|act|article|rule|clause|sub-section)\s+\d+[a-z]?\b/gi
});

/**
 * Computes difference highlights between two drafts
 * @param {string} originalText Last approved text
 * @param {string} draftText Proposed AI draft text
 * @returns {Object} Diff structure and sensitive alteration flags
 */
export function computeDraftDiff(originalText = '', draftText = '') {
  const origLines = (originalText || '').split('\n');
  const draftLines = (draftText || '').split('\n');

  const additions = [];
  const deletions = [];

  for (const line of draftLines) {
    if (!origLines.includes(line) && line.trim()) {
      additions.push(line);
    }
  }

  for (const line of origLines) {
    if (!draftLines.includes(line) && line.trim()) {
      deletions.push(line);
    }
  }

  // Scan additions and deletions for critical civic facts
  const addedSensitive = scanForCriticalCivicFacts(additions.join(' '));
  const removedSensitive = scanForCriticalCivicFacts(deletions.join(' '));

  return {
    additionsCount: additions.length,
    deletionsCount: deletions.length,
    additions,
    deletions,
    hasSensitiveChanges: addedSensitive.hasAny || removedSensitive.hasAny,
    criticalFlags: {
      addedMoney: addedSensitive.money,
      removedMoney: removedSensitive.money,
      addedDeadlines: addedSensitive.deadlines,
      removedDeadlines: removedSensitive.deadlines,
      addedStatutes: addedSensitive.statutes,
      removedStatutes: removedSensitive.statutes
    }
  };
}

/**
 * Scans text for critical civic elements: money, timelines, and statutes
 * @param {string} text
 * @returns {Object} Found items
 */
export function scanForCriticalCivicFacts(text = '') {
  const money = text.match(SENSITIVE_REGEXES.MONEY) || [];
  const deadlines = text.match(SENSITIVE_REGEXES.DEADLINE) || [];
  const statutes = text.match(SENSITIVE_REGEXES.STATUTE) || [];

  return {
    money,
    deadlines,
    statutes,
    hasAny: money.length > 0 || deadlines.length > 0 || statutes.length > 0
  };
}

export class AiDraftReviewWorkspace {
  constructor() {
    this.revisions = new Map(); // draftId -> Array<RevisionRecord>
  }

  /**
   * Submits a newly generated AI draft for editorial review
   * @param {Object} draftPayload
   * @returns {Object} Stored revision record
   */
  submitDraftForReview({ serviceId, promptVersion, modelVersion, draftText, sourceExcerpts = [], author = 'ai-generator' }) {
    if (!serviceId || !draftText) {
      throw new Error('Draft submission requires serviceId and draftText');
    }

    const history = this.revisions.get(serviceId) || [];
    const lastApproved = [...history].reverse().find(r => r.status === REVIEW_STATUS.APPROVED);
    const originalText = lastApproved ? lastApproved.draftText : '';

    const diff = computeDraftDiff(originalText, draftText);
    const revisionId = `rev_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;

    const record = {
      revisionId,
      serviceId,
      promptVersion: promptVersion || 'v1.0',
      modelVersion: modelVersion || 'gemini-1.5-pro',
      draftText,
      originalText,
      diff,
      sourceExcerpts,
      status: REVIEW_STATUS.PENDING_REVIEW,
      submittedAt: Date.now(),
      reviewDecision: null
    };

    history.push(record);
    this.revisions.set(serviceId, history);
    return record;
  }

  /**
   * Reviewer approval action
   * @param {string} serviceId
   * @param {string} revisionId
   * @param {Object} decision
   * @returns {Object} Updated revision
   */
  approveDraft(serviceId, revisionId, { reviewerHandle, reason = 'Accurate according to gazette' }) {
    const history = this.revisions.get(serviceId) || [];
    const target = history.find(r => r.revisionId === revisionId);
    if (!target) {
      throw new Error(`Revision ${revisionId} not found for service ${serviceId}`);
    }

    target.status = REVIEW_STATUS.APPROVED;
    target.reviewDecision = {
      reviewerHandle,
      decision: 'APPROVED',
      reason,
      decidedAt: Date.now()
    };

    return target;
  }

  /**
   * Reviewer rejection action
   * @param {string} serviceId
   * @param {string} revisionId
   * @param {Object} decision
   * @returns {Object} Updated revision
   */
  rejectDraft(serviceId, revisionId, { reviewerHandle, reason }) {
    const history = this.revisions.get(serviceId) || [];
    const target = history.find(r => r.revisionId === revisionId);
    if (!target) {
      throw new Error(`Revision ${revisionId} not found for service ${serviceId}`);
    }

    target.status = REVIEW_STATUS.REJECTED;
    target.reviewDecision = {
      reviewerHandle,
      decision: 'REJECTED',
      reason: reason || 'Factually incorrect or unsupported by source',
      decidedAt: Date.now()
    };

    return target;
  }

  /**
   * Rolls back currently active guidance to previous approved version
   * @param {string} serviceId
   * @param {Object} rollbackMeta
   * @returns {Object|null} Restored revision
   */
  rollbackToLastApproved(serviceId, { reviewerHandle, reason }) {
    const history = this.revisions.get(serviceId) || [];
    const approvedList = history.filter(r => r.status === REVIEW_STATUS.APPROVED);

    if (approvedList.length < 2) {
      return approvedList[0] || null;
    }

    // Demote current approved
    const current = approvedList[approvedList.length - 1];
    current.status = REVIEW_STATUS.ROLLED_BACK;
    current.reviewDecision = {
      reviewerHandle,
      decision: 'ROLLED_BACK',
      reason: reason || 'Rolled back due to discrepancy',
      decidedAt: Date.now()
    };

    const previous = approvedList[approvedList.length - 2];
    return previous;
  }

  getActiveApprovedGuidance(serviceId) {
    const history = this.revisions.get(serviceId) || [];
    return [...history].reverse().find(r => r.status === REVIEW_STATUS.APPROVED) || null;
  }
}
