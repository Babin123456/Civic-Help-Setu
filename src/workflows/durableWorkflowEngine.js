/**
 * Pure deterministic event-sourced workflow engine (ADR-1149).
 * Supports idempotent transitions, optimistic sequence checks, checkpoint/replay,
 * human-in-the-loop approval gates, and dead-letter recovery.
 */

import {
  SCHEMA_VERSION,
  WORKFLOW_STATUS,
  EVENT_TYPE,
  WORKFLOW_LIMITS,
} from './workflowContracts.js';

export function createWorkflowEvent({
  workflowId,
  sequence,
  type,
  idempotencyKey,
  causationId = null,
  payload = {},
  occurredAt = Date.now(),
}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    workflowId,
    sequence,
    type,
    idempotencyKey,
    causationId,
    payload,
    occurredAt,
  };
}

export function createEmptyState(workflowId) {
  return {
    schemaVersion: SCHEMA_VERSION,
    workflowId,
    ownerId: null,
    workflowType: null,
    serviceId: null,
    status: null,
    lastSequence: 0,
    retryCount: 0,
    requiresHumanApproval: true,
    pendingProposal: null,
    approval: null,
    steps: [],
    checkpoint: null,
    lastError: null,
    createdAt: null,
    updatedAt: null,
    retentionExpiresAt: null,
  };
}

/**
 * Deterministic reducer: applies a single validated event to materialized state.
 */
export function applyEvent(state, event) {
  const next = {
    ...state,
    steps: [...state.steps],
    lastSequence: event.sequence,
    updatedAt: event.occurredAt,
  };

  switch (event.type) {
    case EVENT_TYPE.WORKFLOW_STARTED: {
      next.ownerId = event.payload.ownerId;
      next.workflowType = event.payload.workflowType;
      next.serviceId = event.payload.serviceId ?? null;
      next.requiresHumanApproval = event.payload.requiresHumanApproval !== false;
      next.status = WORKFLOW_STATUS.RUNNING;
      next.createdAt = event.occurredAt;
      next.retentionExpiresAt =
        event.payload.retentionExpiresAt ??
        event.occurredAt + WORKFLOW_LIMITS.DEFAULT_RETENTION_DAYS * 86400_000;
      next.steps.push({
        sequence: event.sequence,
        type: event.type,
        summary: event.payload.sanitizedQuery,
        occurredAt: event.occurredAt,
      });
      break;
    }

    case EVENT_TYPE.MODEL_CALL_REQUESTED: {
      next.status = WORKFLOW_STATUS.RUNNING;
      next.steps.push({
        sequence: event.sequence,
        type: event.type,
        attempt: event.payload.attempt ?? 1,
        occurredAt: event.occurredAt,
      });
      break;
    }

    case EVENT_TYPE.STEP_PROPOSED: {
      next.retryCount = 0;
      next.lastError = null;
      next.pendingProposal = {
        summary: event.payload.summary,
        citations: event.payload.citations ?? [],
        provenance: event.payload.provenance ?? 'local_grounded_catalogue',
        untrustedProposal: true,
        requiresHumanApproval: next.requiresHumanApproval,
      };
      next.steps.push({
        sequence: event.sequence,
        type: event.type,
        summary: event.payload.summary,
        citations: event.payload.citations ?? [],
        occurredAt: event.occurredAt,
      });
      break;
    }

    case EVENT_TYPE.HUMAN_APPROVAL_REQUESTED: {
      next.status = WORKFLOW_STATUS.AWAITING_HUMAN_APPROVAL;
      next.steps.push({
        sequence: event.sequence,
        type: event.type,
        reason: event.payload.reason ?? 'High-impact civic guidance requires human review.',
        occurredAt: event.occurredAt,
      });
      break;
    }

    case EVENT_TYPE.HUMAN_APPROVAL_RESOLVED: {
      next.approval = {
        decision: event.payload.decision,
        reviewerId: event.payload.reviewerId,
        note: event.payload.note ?? '',
        resolvedAt: event.occurredAt,
      };
      next.status =
        event.payload.decision === 'approved'
          ? WORKFLOW_STATUS.COMPLETED
          : WORKFLOW_STATUS.CANCELLED;
      next.steps.push({
        sequence: event.sequence,
        type: event.type,
        decision: event.payload.decision,
        occurredAt: event.occurredAt,
      });
      break;
    }

    case EVENT_TYPE.MODEL_CALL_FAILED: {
      next.retryCount += 1;
      next.lastError = {
        code: event.payload.code ?? 'provider_error',
        retryable: Boolean(event.payload.retryable),
        occurredAt: event.occurredAt,
      };
      next.steps.push({
        sequence: event.sequence,
        type: event.type,
        code: event.payload.code ?? 'provider_error',
        retryable: Boolean(event.payload.retryable),
        occurredAt: event.occurredAt,
      });
      break;
    }

    case EVENT_TYPE.CHECKPOINT_SAVED: {
      next.checkpoint = {
        sequence: event.sequence,
        snapshotStatus: next.status,
        savedAt: event.occurredAt,
      };
      break;
    }

    case EVENT_TYPE.WORKFLOW_COMPLETED: {
      next.status = WORKFLOW_STATUS.COMPLETED;
      next.steps.push({
        sequence: event.sequence,
        type: event.type,
        occurredAt: event.occurredAt,
      });
      break;
    }

    case EVENT_TYPE.MOVED_TO_DEAD_LETTER: {
      next.status = WORKFLOW_STATUS.DEAD_LETTERED;
      next.lastError = {
        code: event.payload.errorCode ?? 'retries_exhausted',
        retryable: false,
        occurredAt: event.occurredAt,
      };
      next.steps.push({
        sequence: event.sequence,
        type: event.type,
        errorCode: event.payload.errorCode ?? 'retries_exhausted',
        occurredAt: event.occurredAt,
      });
      break;
    }

    case EVENT_TYPE.DEAD_LETTER_REPLAYED: {
      next.status = WORKFLOW_STATUS.RUNNING;
      next.retryCount = 0;
      next.lastError = null;
      next.steps.push({
        sequence: event.sequence,
        type: event.type,
        replayedBy: event.payload.replayedBy,
        occurredAt: event.occurredAt,
      });
      break;
    }

    default:
      throw new Error(`Unsupported workflow event type: ${event.type}`);
  }

  return next;
}

/**
 * Reconstructs materialized state from a checkpoint (if any) and subsequent ordered events.
 */
export function replayFromCheckpoint(checkpointState, events = []) {
  const ordered = [...events].sort((a, b) => a.sequence - b.sequence);
  let state = checkpointState ?? createEmptyState(ordered[0]?.workflowId ?? 'unknown');

  for (const event of ordered) {
    if (event.sequence <= state.lastSequence) continue;
    if (event.sequence !== state.lastSequence + 1) {
      throw new Error(`Out-of-order event sequence ${event.sequence} after ${state.lastSequence}`);
    }
    state = applyEvent(state, event);
  }
  return state;
}

/**
 * Pure transition guard: checks idempotency, event limits, and sequence ordering before committing.
 */
export function appendEventDeterministic(state, event, seenIdempotencyKeys = new Set()) {
  if (seenIdempotencyKeys.has(event.idempotencyKey)) {
    return { status: 'duplicate', state, event: null };
  }
  if (state.lastSequence >= WORKFLOW_LIMITS.MAX_EVENTS) {
    return { status: 'rejected', error: 'max_events_exceeded', state };
  }
  if (event.sequence !== state.lastSequence + 1) {
    return {
      status: 'conflict',
      error: 'sequence_mismatch',
      expectedSequence: state.lastSequence + 1,
      actualSequence: event.sequence,
      state,
    };
  }
  const nextState = applyEvent(state, event);
  return { status: 'committed', state: nextState, event };
}

export function buildDeadLetterRecord(state, { errorCode, sanitizedReason, failedSequence }, now = Date.now()) {
  return {
    schemaVersion: SCHEMA_VERSION,
    workflowId: state.workflowId,
    ownerId: state.ownerId,
    workflowType: state.workflowType,
    failedSequence,
    retryCount: state.retryCount,
    errorCode: errorCode || 'retries_exhausted',
    sanitizedReason: String(sanitizedReason || 'Workflow step failed after retry budget').slice(0, 300),
    status: 'open',
    createdAt: now,
    updatedAt: now,
  };
}
