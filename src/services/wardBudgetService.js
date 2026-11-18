/**
 * src/services/wardBudgetService.js
 * Business logic and data access service for Participatory Ward Budget Platform (#765).
 */

import {
  SCHEMA_VERSION,
  validateProposalPayload,
  validateCommentPayload,
  validateReviewDecisionPayload,
  sanitizeText,
} from '../data/wardBudgetContract.js';
import {
  loadStoredBudgetCycle,
  saveStoredBudgetCycle,
  loadStoredProposals,
  saveStoredProposals,
  loadStoredComments,
  saveStoredComments,
  loadStoredDecisions,
  saveStoredDecisions,
  loadStoredUpdates,
  saveStoredUpdates,
  loadStoredVotes,
  saveStoredVotes,
  loadOfflineQueue,
  enqueueOfflineAction,
  clearOfflineQueue,
} from './wardBudgetStorage.js';
import { findDuplicateCandidates } from './proposalClusteringService.js';

// Deterministic ID generators
export const generateProposalId = (prefix = 'PROP') => {
  const rand = Math.floor(1000 + Math.random() * 9000);
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${rand}`;
};

export const generateCommentId = () => {
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `COMM-${rand}`;
};

export const generateDecisionId = () => {
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `DEC-${rand}`;
};

export const generateVoterHash = (citizenId, cycleId) => {
  const seed = `${citizenId}|${cycleId}|SALT_CIVIC_BUDGET_2026`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `VOTER-SEAL-${(hash >>> 0).toString(16).toUpperCase()}`;
};

export const wardBudgetService = {
  getBudgetCycle() {
    return loadStoredBudgetCycle();
  },

  updateBudgetCycle(updates) {
    const current = loadStoredBudgetCycle();
    const updated = { ...current, ...updates, updatedAt: new Date().toISOString() };
    saveStoredBudgetCycle(updated);
    return updated;
  },

  listProposals(filters = {}) {
    const all = loadStoredProposals();
    const { category, ward, status, search, page = 1, limit = 10 } = filters;

    let filtered = all;

    if (category && category !== 'all') {
      filtered = filtered.filter((p) => p.category === category);
    }
    if (ward && ward !== 'all') {
      filtered = filtered.filter((p) => p.ward === ward);
    }
    if (status && status !== 'all') {
      filtered = filtered.filter((p) => p.status === status);
    }
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.title?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.approximateLocation?.toLowerCase().includes(q)
      );
    }

    const total = filtered.length;
    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    return {
      proposals: paginated,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  },

  getProposalById(id, { userRole = 'citizen' } = {}) {
    const all = loadStoredProposals();
    const proposal = all.find((p) => p.id === id);
    if (!proposal) return null;

    // Redact private fields if viewer is standard public/citizen
    const safeProposal = { ...proposal };
    if (userRole !== 'reviewer' && userRole !== 'admin') {
      // Ensure no raw contact numbers or sensitive metadata
      if (safeProposal.submittedBy) {
        safeProposal.submittedBy = {
          displayName: safeProposal.submittedBy.displayName || 'Resident',
          role: safeProposal.submittedBy.role || 'citizen',
        };
      }
    }

    return safeProposal;
  },

  createProposal(payload, { isOffline = false, idempotencyKey = null, user = {} } = {}) {
    const validationErrors = validateProposalPayload(payload);
    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join(' '));
    }

    // Check offline mode
    if (isOffline) {
      const queued = enqueueOfflineAction({
        type: 'CREATE_PROPOSAL',
        payload,
        idempotencyKey,
      });
      return {
        proposal: {
          id: `TEMP-OFFLINE-${Date.now()}`,
          ...payload,
          status: 'draft',
          isOfflineQueued: true,
        },
        queuedAction: queued,
      };
    }

    const all = loadStoredProposals();

    // Idempotency check
    if (idempotencyKey) {
      const existing = all.find((p) => p.idempotencyKey === idempotencyKey);
      if (existing) {
        return { proposal: existing, isDuplicateSubmission: true };
      }
    }

    // Run duplicate clustering before inserting
    const duplicateAssessment = findDuplicateCandidates(payload, all);

    const newProposal = {
      id: generateProposalId(),
      cycleId: payload.cycleId || 'CYCLE-BLR-2026-W150',
      title: sanitizeText(payload.title, 120),
      category: payload.category,
      ward: sanitizeText(payload.ward, 60),
      approximateLocation: sanitizeText(payload.approximateLocation, 200),
      summary: sanitizeText(payload.summary || payload.description?.slice(0, 140) || '', 150),
      description: sanitizeText(payload.description, 2000),
      costEstimateRange: {
        min: Number(payload.costEstimateRange?.min),
        max: Number(payload.costEstimateRange?.max),
        currency: 'INR',
        basis: sanitizeText(payload.costEstimateRange?.basis || 'Resident estimation', 300),
      },
      supportingEvidence: Array.isArray(payload.supportingEvidence) ? payload.supportingEvidence : [],
      submittedBy: {
        citizenId: user.id || 'CIT-ANON',
        displayName: user.name ? `${user.name} (Resident)` : 'Resident Contributor',
        role: user.role || 'citizen',
      },
      status: 'submitted',
      duplicateClusterId: duplicateAssessment.candidates[0]?.proposalId
        ? `CLUSTER-${duplicateAssessment.candidates[0].proposalId}`
        : null,
      canonicalProposalId: null,
      metrics: {
        voteCount: 0,
        commentCount: 0,
      },
      idempotencyKey,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schemaVersion: SCHEMA_VERSION,
    };

    all.unshift(newProposal);
    saveStoredProposals(all);

    return {
      proposal: newProposal,
      duplicateAssessment,
    };
  },

  listComments(proposalId) {
    const all = loadStoredComments();
    return all.filter((c) => c.proposalId === proposalId && c.moderationStatus === 'visible');
  },

  addComment(payload, user = {}) {
    const errors = validateCommentPayload(payload);
    if (errors.length > 0) {
      throw new Error(errors.join(' '));
    }

    const all = loadStoredComments();
    const newComment = {
      id: generateCommentId(),
      proposalId: payload.proposalId,
      parentCommentId: payload.parentCommentId || null,
      author: {
        id: user.id || 'CIT-ANON',
        displayName: user.name || 'Ward Resident',
        role: user.role || 'citizen',
      },
      content: sanitizeText(payload.content, 800),
      moderationStatus: 'visible',
      createdAt: new Date().toISOString(),
      schemaVersion: SCHEMA_VERSION,
    };

    all.push(newComment);
    saveStoredComments(all);

    // Increment comment count on proposal
    const proposals = loadStoredProposals();
    const target = proposals.find((p) => p.id === payload.proposalId);
    if (target) {
      target.metrics = target.metrics || { voteCount: 0, commentCount: 0 };
      target.metrics.commentCount = (target.metrics.commentCount || 0) + 1;
      saveStoredProposals(proposals);
    }

    return newComment;
  },

  recordReviewDecision(payload, reviewer = {}) {
    if (reviewer.role !== 'reviewer' && reviewer.role !== 'admin') {
      throw new Error('Unauthorized: only municipal reviewers or administrators may record review decisions.');
    }

    const errors = validateReviewDecisionPayload(payload);
    if (errors.length > 0) {
      throw new Error(errors.join(' '));
    }

    const decisions = loadStoredDecisions();
    const proposals = loadStoredProposals();
    const proposal = proposals.find((p) => p.id === payload.proposalId);

    if (!proposal) {
      throw new Error(`Proposal with ID ${payload.proposalId} not found.`);
    }

    const newDecision = {
      id: generateDecisionId(),
      proposalId: payload.proposalId,
      reviewerId: reviewer.id || 'REV-DEFAULT',
      reviewerRole: reviewer.role || 'reviewer',
      decision: payload.decision,
      reasonCode: payload.reasonCode || 'DECISION_ENTERED',
      canonicalProposalId: payload.canonicalProposalId || null,
      publicSummary: sanitizeText(payload.publicSummary, 1000),
      internalNotes: sanitizeText(payload.internalNotes || '', 1000),
      decisionDate: new Date().toISOString(),
      schemaVersion: SCHEMA_VERSION,
    };

    decisions.push(newDecision);
    saveStoredDecisions(decisions);

    // Map decision to proposal status
    let mappedStatus = proposal.status;
    if (payload.decision === 'eligible') mappedStatus = 'eligible';
    else if (payload.decision === 'ineligible') mappedStatus = 'ineligible';
    else if (payload.decision === 'technical_revision_needed') mappedStatus = 'draft';
    else if (payload.decision === 'merged_as_duplicate') {
      mappedStatus = 'consolidated_duplicate';
      proposal.canonicalProposalId = payload.canonicalProposalId;
    } else if (payload.decision === 'approved_for_voting') mappedStatus = 'approved_for_voting';
    else if (payload.decision === 'funded') mappedStatus = 'funded';
    else if (payload.decision === 'rejected') mappedStatus = 'rejected';

    proposal.status = mappedStatus;
    proposal.updatedAt = new Date().toISOString();
    saveStoredProposals(proposals);

    return { decision: newDecision, proposal };
  },

  castAdvisoryVote(proposalId, citizenId, cycleId = 'CYCLE-BLR-2026-W150') {
    if (!proposalId || !citizenId) {
      throw new Error('proposalId and citizenId are required to cast an advisory vote.');
    }

    const votes = loadStoredVotes();
    const voterHash = generateVoterHash(citizenId, cycleId);

    // Prevent double voting in the same proposal
    const alreadyVoted = votes.some((v) => v.proposalId === proposalId && v.voterHash === voterHash);
    if (alreadyVoted) {
      throw new Error('You have already cast your advisory vote for this proposal in this budget cycle.');
    }

    const newVote = {
      id: `VOTE-${Date.now()}`,
      cycleId,
      proposalId,
      voterHash,
      ballotTimestamp: new Date().toISOString(),
      advisoryNote: 'Advisory vote recorded for ward committee deliberation.',
      schemaVersion: SCHEMA_VERSION,
    };

    votes.push(newVote);
    saveStoredVotes(votes);

    // Increment vote count on proposal
    const proposals = loadStoredProposals();
    const target = proposals.find((p) => p.id === proposalId);
    if (target) {
      target.metrics = target.metrics || { voteCount: 0, commentCount: 0 };
      target.metrics.voteCount = (target.metrics.voteCount || 0) + 1;
      saveStoredProposals(proposals);
    }

    return {
      success: true,
      voteReceipt: newVote.id,
      voterHash,
      newVoteCount: target?.metrics?.voteCount || 1,
    };
  },

  listDecisionsForProposal(proposalId) {
    const decisions = loadStoredDecisions();
    return decisions.filter((d) => d.proposalId === proposalId);
  },

  listImplementationUpdates(proposalId) {
    const updates = loadStoredUpdates();
    return updates.filter((u) => u.proposalId === proposalId);
  },

  addImplementationUpdate(payload, official = {}) {
    if (official.role !== 'reviewer' && official.role !== 'admin') {
      throw new Error('Unauthorized: only officials may post implementation milestones.');
    }

    const updates = loadStoredUpdates();
    const newUpdate = {
      id: `IMP-${Date.now()}`,
      proposalId: payload.proposalId,
      milestoneTitle: sanitizeText(payload.milestoneTitle || '', 120),
      stage: payload.stage || 'work_in_progress',
      progressPercent: Math.min(100, Math.max(0, Number(payload.progressPercent) || 0)),
      expenditureToDate: Number(payload.expenditureToDate) || 0,
      targetCompletionDate: payload.targetCompletionDate || '',
      publicNotes: sanitizeText(payload.publicNotes || '', 1000),
      updatedAt: new Date().toISOString(),
      updatedBy: official.name || 'Municipal Engineer',
      schemaVersion: SCHEMA_VERSION,
    };

    updates.push(newUpdate);
    saveStoredUpdates(updates);

    // If progress reaches 100%, update proposal status to completed
    if (newUpdate.progressPercent === 100) {
      const proposals = loadStoredProposals();
      const p = proposals.find((item) => item.id === payload.proposalId);
      if (p) {
        p.status = 'completed';
        saveStoredProposals(proposals);
      }
    }

    return newUpdate;
  },

  getOfflineStatus() {
    const queue = loadOfflineQueue();
    return {
      pendingActionsCount: queue.length,
      queue,
    };
  },

  flushOfflineQueue() {
    const queue = loadOfflineQueue();
    const results = [];
    for (const action of queue) {
      try {
        if (action.type === 'CREATE_PROPOSAL') {
          const res = this.createProposal(action.payload, {
            isOffline: false,
            idempotencyKey: action.idempotencyKey,
          });
          results.push({ actionId: action.queuedAt, status: 'synced', result: res });
        }
      } catch (err) {
        results.push({ actionId: action.queuedAt, status: 'failed', error: err.message });
      }
    }
    clearOfflineQueue();
    return results;
  },
};
