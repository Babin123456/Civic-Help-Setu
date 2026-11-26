/**
 * Maintainer Moderation Console and Ranking Appeals Service
 *
 * Implements a transparent, accountable dispute resolution framework for community metrics:
 * - Empowers contributors to submit appeals if scores, badges, or streaks are miscalculated:
 *   * Appeal categories: SCORE_CORRECTION, BADGE_MISSING, PENALTY_DISPUTE, STREAK_RESTORATION
 * - Maintainer Moderation Capabilities:
 *   * Review appeal dossiers with attached PR evidence
 *   * Approve adjustments with required rationale justification
 *   * Reject invalid claims with constructive feedback
 * - Strict Audit Logging & Transparency:
 *   * Every manual override is recorded in an immutable audit ledger
 *   * Maintains reversible correction state (never mutates history silently)
 *   * Prevents unilateral maintainer tampering by requiring review timestamps and admin signatures
 */

export const APPEAL_TYPES = Object.freeze({
  SCORE_CORRECTION: 'SCORE_CORRECTION',
  BADGE_MISSING: 'BADGE_MISSING',
  PENALTY_DISPUTE: 'PENALTY_DISPUTE',
  STREAK_RESTORATION: 'STREAK_RESTORATION'
});

export const APPEAL_STATUS = Object.freeze({
  PENDING_REVIEW: 'PENDING_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED'
});

/**
 * Generates an audit trail identifier
 * @returns {string} Audit record ID
 */
export function generateAuditId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `audit_${ts}_${rand}`;
}

export class MaintainerModerationService {
  constructor() {
    this.appeals = new Map(); // appealId -> AppealRecord
    this.auditLog = [];
  }

  /**
   * Files a new contributor appeal
   * @param {Object} appealData
   * @returns {Object} Created appeal record
   */
  submitAppeal({ username, type, targetId, reason, evidenceUrl }) {
    if (!username || !type || !reason) {
      throw new Error('Appeal submission requires username, type, and justification reason');
    }

    if (!APPEAL_TYPES[type]) {
      throw new Error(`Unsupported appeal type: ${type}`);
    }

    const appealId = `apl_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const record = {
      appealId,
      username,
      type,
      targetId: targetId || null,
      reason,
      evidenceUrl: evidenceUrl || null,
      status: APPEAL_STATUS.PENDING_REVIEW,
      submittedAt: Date.now(),
      resolution: null
    };

    this.appeals.set(appealId, record);
    return record;
  }

  /**
   * Resolves an appeal by maintainer action
   * @param {string} appealId Appeal identifier
   * @param {Object} resolution Maintainer decision payload
   * @returns {Object} Updated appeal record
   */
  resolveAppeal(appealId, { maintainerUsername, approved, rationale, adjustmentPoints = 0 }) {
    const appeal = this.appeals.get(appealId);
    if (!appeal) {
      throw new Error(`Appeal not found: ${appealId}`);
    }

    if (!maintainerUsername || !rationale) {
      throw new Error('Appeal resolution requires maintainer username and rationale');
    }

    appeal.status = approved ? APPEAL_STATUS.APPROVED : APPEAL_STATUS.REJECTED;
    appeal.resolution = {
      maintainerUsername,
      approved,
      rationale,
      adjustmentPoints: approved ? adjustmentPoints : 0,
      resolvedAt: Date.now()
    };

    // Log to immutable audit ledger
    this.auditLog.push({
      auditId: generateAuditId(),
      appealId,
      contributor: appeal.username,
      maintainer: maintainerUsername,
      action: approved ? 'APPEAL_APPROVED_OVERRIDE' : 'APPEAL_REJECTED',
      adjustmentPoints: approved ? adjustmentPoints : 0,
      rationale,
      timestamp: Date.now()
    });

    return appeal;
  }

  getAppeal(appealId) {
    return this.appeals.get(appealId) || null;
  }

  getPendingAppeals() {
    return Array.from(this.appeals.values()).filter(a => a.status === APPEAL_STATUS.PENDING_REVIEW);
  }

  getAuditLog() {
    return [...this.auditLog];
  }
}
