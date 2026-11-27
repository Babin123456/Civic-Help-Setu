/**
 * api/_lib/civicContributionPipelineStore.js
 *
 * Bounded in-memory store for the Human-Reviewed Civic Data Contribution Pipeline (#1432).
 *
 * Invariants:
 *  - Separate contributor vs publisher/reviewer roles (self-review forbidden).
 *  - Field-level diffs computed deterministically between beforeFields & proposedFields.
 *  - Conflict detection on stale baseRevision when publishing.
 *  - Rollback restores previous snapshot and appends immutable audit entry.
 *  - Max 500 proposals, max 2,000 immutable audit log entries.
 */

import { randomBytes } from 'node:crypto';

const MAX_PROPOSALS = 500;
const MAX_AUDIT_LOGS = 2000;

export const PROPOSAL_STATUS = Object.freeze({
  PENDING_REVIEW: 'PENDING_REVIEW',
  PUBLISHED: 'PUBLISHED',
  REJECTED: 'REJECTED',
  ROLLED_BACK: 'ROLLED_BACK',
});

export function computeFieldDiffs(beforeObj = {}, afterObj = {}) {
  const keys = Array.from(new Set([...Object.keys(beforeObj || {}), ...Object.keys(afterObj || {})]));
  const diffs = [];
  for (const field of keys) {
    const before = beforeObj?.[field] ?? null;
    const after = afterObj?.[field] ?? null;
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      diffs.push({ field, before, after });
    }
  }
  return diffs;
}

export class InMemoryCivicContributionPipelineStore {
  constructor() {
    this._proposals = new Map();
    /** @type {Map<string, { revision: number, snapshot: object }>} */
    this._entities = new Map();
    this._auditLog = [];
  }

  _evictIfFull() {
    if (this._proposals.size >= MAX_PROPOSALS) {
      const oldestKey = this._proposals.keys().next().value;
      if (oldestKey) this._proposals.delete(oldestKey);
    }
  }

  _appendAudit(entry) {
    if (this._auditLog.length >= MAX_AUDIT_LOGS) {
      this._auditLog.shift();
    }
    const seq = this._auditLog.length + 1;
    this._auditLog.push(
      Object.freeze({
        auditId: `aud_${randomBytes(6).toString('hex')}`,
        sequence: seq,
        timestamp: new Date().toISOString(),
        ...entry,
      })
    );
  }

  seedEntity(entityId, snapshot, revision = 1) {
    this._entities.set(entityId, { revision, snapshot: { ...snapshot } });
  }

  getEntity(entityId) {
    return this._entities.get(entityId) || { revision: 1, snapshot: {} };
  }

  submitProposal({
    targetEntityId,
    entityType = 'office_contact',
    contributorId,
    baseRevision = 1,
    beforeFields = {},
    proposedFields = {},
    sourceAttachment,
    provenanceKind = 'community_suggestion',
    rationale = '',
  }) {
    const diffs = computeFieldDiffs(beforeFields, proposedFields);
    if (diffs.length === 0) {
      return { ok: false, status: 400, error: 'At least one field change is required.' };
    }

    this._evictIfFull();
    const proposalId = `prop_${randomBytes(6).toString('hex')}`;
    const proposal = {
      proposalId,
      targetEntityId,
      entityType,
      contributorId,
      assignedReviewerId: null,
      baseRevision: Number(baseRevision || 1),
      beforeFields: { ...beforeFields },
      proposedFields: { ...proposedFields },
      fieldDiffs: diffs,
      sourceAttachment,
      provenanceKind,
      rationale,
      status: PROPOSAL_STATUS.PENDING_REVIEW,
      rejectionReason: null,
      reviewedBy: null,
      reviewedAt: null,
      rollbackReason: null,
      createdAt: new Date().toISOString(),
    };

    this._proposals.set(proposalId, proposal);
    this._appendAudit({
      action: 'PROPOSAL_SUBMITTED',
      proposalId,
      targetEntityId,
      actorId: contributorId,
      provenanceKind,
      changedFields: diffs.map((d) => d.field),
    });

    return { ok: true, status: 201, proposal };
  }

  assignReviewer(proposalId, reviewerId, assignedBy) {
    const p = this._proposals.get(proposalId);
    if (!p) return { ok: false, status: 404, error: 'Proposal not found' };
    if (reviewerId === p.contributorId) {
      return { ok: false, status: 403, error: 'Contributor cannot be assigned as their own reviewer' };
    }
    p.assignedReviewerId = reviewerId;
    this._appendAudit({
      action: 'REVIEWER_ASSIGNED',
      proposalId,
      actorId: assignedBy,
      assignedReviewerId: reviewerId,
    });
    return { ok: true, status: 200, proposal: p };
  }

  reviewProposal({
    proposalId,
    publisherId,
    decision,
    rejectionReason = '',
    resolveConflict = false,
  }) {
    const p = this._proposals.get(proposalId);
    if (!p) return { ok: false, status: 404, error: 'Proposal not found' };
    if (p.status !== PROPOSAL_STATUS.PENDING_REVIEW) {
      return { ok: false, status: 409, error: `Proposal already in status ${p.status}` };
    }
    if (publisherId === p.contributorId) {
      this._appendAudit({
        action: 'SELF_REVIEW_BLOCKED',
        proposalId,
        actorId: publisherId,
      });
      return { ok: false, status: 403, error: 'Role separation: contributor cannot approve or publish their own proposal' };
    }

    if (decision === 'REJECT') {
      if (!rejectionReason || !rejectionReason.trim()) {
        return { ok: false, status: 400, error: 'rejectionReason is required when rejecting a proposal' };
      }
      p.status = PROPOSAL_STATUS.REJECTED;
      p.rejectionReason = rejectionReason.trim();
      p.reviewedBy = publisherId;
      p.reviewedAt = new Date().toISOString();
      this._appendAudit({
        action: 'PROPOSAL_REJECTED',
        proposalId,
        actorId: publisherId,
        rejectionReason: p.rejectionReason,
      });
      return { ok: true, status: 200, proposal: p };
    }

    // PUBLISH / APPROVE
    const currentEntity = this.getEntity(p.targetEntityId);
    if (currentEntity.revision > p.baseRevision && !resolveConflict) {
      this._appendAudit({
        action: 'CONFLICT_DETECTED',
        proposalId,
        actorId: publisherId,
        baseRevision: p.baseRevision,
        currentRevision: currentEntity.revision,
      });
      return {
        ok: false,
        status: 409,
        code: 'ERR_REVISION_CONFLICT',
        error: `Entity revision ${currentEntity.revision} is newer than proposal baseRevision ${p.baseRevision}. Explicit conflict resolution required.`,
        currentSnapshot: currentEntity.snapshot,
        currentRevision: currentEntity.revision,
      };
    }

    const previousSnapshot = { ...currentEntity.snapshot };
    const nextSnapshot = { ...previousSnapshot, ...p.proposedFields };
    const nextRevision = currentEntity.revision + 1;
    this._entities.set(p.targetEntityId, { revision: nextRevision, snapshot: nextSnapshot });

    p.status = PROPOSAL_STATUS.PUBLISHED;
    p.reviewedBy = publisherId;
    p.reviewedAt = new Date().toISOString();
    p.previousSnapshot = previousSnapshot;
    p.publishedRevision = nextRevision;

    this._appendAudit({
      action: 'PROPOSAL_PUBLISHED',
      proposalId,
      targetEntityId: p.targetEntityId,
      actorId: publisherId,
      publishedRevision: nextRevision,
      conflictResolved: Boolean(resolveConflict),
    });

    return { ok: true, status: 200, proposal: p, entityRevision: nextRevision, entitySnapshot: nextSnapshot };
  }

  rollbackProposal(proposalId, publisherId, reason = 'Rolled back by publisher') {
    const p = this._proposals.get(proposalId);
    if (!p) return { ok: false, status: 404, error: 'Proposal not found' };
    if (p.status !== PROPOSAL_STATUS.PUBLISHED) {
      return { ok: false, status: 409, error: 'Only PUBLISHED proposals can be rolled back' };
    }

    const currentEntity = this.getEntity(p.targetEntityId);
    const restoredSnapshot = { ...(p.previousSnapshot || p.beforeFields) };
    const nextRevision = currentEntity.revision + 1;
    this._entities.set(p.targetEntityId, { revision: nextRevision, snapshot: restoredSnapshot });

    p.status = PROPOSAL_STATUS.ROLLED_BACK;
    p.rollbackReason = reason;
    p.rolledBackBy = publisherId;
    p.rolledBackAt = new Date().toISOString();

    this._appendAudit({
      action: 'PROPOSAL_ROLLED_BACK',
      proposalId,
      targetEntityId: p.targetEntityId,
      actorId: publisherId,
      reason,
      restoredRevision: nextRevision,
    });

    return { ok: true, status: 200, proposal: p, entityRevision: nextRevision, entitySnapshot: restoredSnapshot };
  }

  listProposals() {
    return Array.from(this._proposals.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getAuditLog({ limit = 100 } = {}) {
    return [...this._auditLog].reverse().slice(0, limit);
  }

  clear() {
    this._proposals.clear();
    this._entities.clear();
    this._auditLog.length = 0;
  }
}

let _prodStore = null;
export function getProductionCivicContributionPipelineStore() {
  if (!_prodStore) {
    _prodStore = new InMemoryCivicContributionPipelineStore();
  }
  return _prodStore;
}

