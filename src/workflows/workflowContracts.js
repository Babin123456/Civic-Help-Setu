/**
 * Versioned domain contracts and boundary validators for Durable Civic Agent Workflows (ADR-1149).
 * All untrusted client inputs and AI-generated proposals are validated here.
 */

export const SCHEMA_VERSION = '1.0.0';

export const WORKFLOW_STATUS = Object.freeze({
  RUNNING: 'running',
  AWAITING_HUMAN_APPROVAL: 'awaiting_human_approval',
  COMPLETED: 'completed',
  DEAD_LETTERED: 'dead_lettered',
  CANCELLED: 'cancelled',
});

export const EVENT_TYPE = Object.freeze({
  WORKFLOW_STARTED: 'WorkflowStarted',
  MODEL_CALL_REQUESTED: 'ModelCallRequested',
  STEP_PROPOSED: 'StepProposed',
  MODEL_CALL_FAILED: 'ModelCallFailed',
  HUMAN_APPROVAL_REQUESTED: 'HumanApprovalRequested',
  HUMAN_APPROVAL_RESOLVED: 'HumanApprovalResolved',
  CHECKPOINT_SAVED: 'CheckpointSaved',
  WORKFLOW_COMPLETED: 'WorkflowCompleted',
  MOVED_TO_DEAD_LETTER: 'MovedToDeadLetter',
  DEAD_LETTER_REPLAYED: 'DeadLetterReplayed',
});

export const WORKFLOW_LIMITS = Object.freeze({
  MAX_EVENTS: 50,
  MAX_RETRIES: 3,
  DEFAULT_TIMEOUT_MS: 8000,
  MAX_QUERY_CHARS: 2000,
  MAX_NOTE_CHARS: 500,
  MAX_ID_CHARS: 128,
  DEFAULT_RETENTION_DAYS: 30,
});

export const ALLOWED_WORKFLOW_TYPES = Object.freeze([
  'service_readiness_check',
  'document_checklist_review',
  'grievance_draft_prep',
]);

// Scope-boundary patterns: AI proposals must never claim official government authority or autonomous execution.
const FORBIDDEN_AUTONOMOUS_CLAIMS = [
  /\b(?:officially\s+approved|application\s+submitted\s+to\s+government|benefit\s+denied\s+permanently|verified\s+by\s+government\s+api|legally\s+binding\s+determination)\b/i,
  /\b(?:autonomously\s+filed|submitted\s+on\s+your\s+behalf\s+to\s+portal)\b/i,
];

function isNonEmptyString(value, maxLength) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;
}

export function isValidIdempotencyKey(key) {
  return typeof key === 'string' && /^[A-Za-z0-9._:-]{8,128}$/.test(key);
}

export function validateCreateWorkflowInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, error: 'invalid_payload', message: 'Request body must be a JSON object.' };
  }
  const { workflowType, query, serviceId, idempotencyKey, requiresHumanApproval } = body;

  if (!ALLOWED_WORKFLOW_TYPES.includes(workflowType)) {
    return { valid: false, error: 'invalid_workflow_type', message: 'Unsupported workflowType.' };
  }
  if (!isNonEmptyString(query, WORKFLOW_LIMITS.MAX_QUERY_CHARS)) {
    return { valid: false, error: 'invalid_query', message: 'Query must be 1–2000 characters.' };
  }
  if (serviceId !== undefined && serviceId !== null && !isNonEmptyString(serviceId, WORKFLOW_LIMITS.MAX_ID_CHARS)) {
    return { valid: false, error: 'invalid_service_id', message: 'Invalid serviceId.' };
  }
  if (!isValidIdempotencyKey(idempotencyKey)) {
    return { valid: false, error: 'invalid_idempotency_key', message: 'Valid idempotencyKey (8–128 chars) is required.' };
  }

  return {
    valid: true,
    value: {
      workflowType,
      query: query.trim(),
      serviceId: serviceId ? serviceId.trim() : null,
      idempotencyKey,
      requiresHumanApproval: requiresHumanApproval !== false,
    },
  };
}

export function validateStepCommand(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, error: 'invalid_payload', message: 'Request body must be a JSON object.' };
  }
  const { workflowId, expectedSequence, idempotencyKey } = body;
  if (!isNonEmptyString(workflowId, WORKFLOW_LIMITS.MAX_ID_CHARS)) {
    return { valid: false, error: 'invalid_workflow_id', message: 'Invalid workflowId.' };
  }
  if (!Number.isInteger(expectedSequence) || expectedSequence < 1) {
    return { valid: false, error: 'invalid_sequence', message: 'expectedSequence must be a positive integer.' };
  }
  if (!isValidIdempotencyKey(idempotencyKey)) {
    return { valid: false, error: 'invalid_idempotency_key', message: 'Valid idempotencyKey is required.' };
  }
  return {
    valid: true,
    value: { workflowId: workflowId.trim(), expectedSequence, idempotencyKey },
  };
}

export function validateApprovalCommand(body) {
  const base = validateStepCommand(body);
  if (!base.valid) return base;

  const { decision, note } = body;
  if (decision !== 'approved' && decision !== 'rejected') {
    return { valid: false, error: 'invalid_decision', message: 'decision must be "approved" or "rejected".' };
  }
  if (note !== undefined && note !== null && (typeof note !== 'string' || note.length > WORKFLOW_LIMITS.MAX_NOTE_CHARS)) {
    return { valid: false, error: 'invalid_note', message: 'Approval note must be <= 500 characters.' };
  }
  return {
    valid: true,
    value: {
      ...base.value,
      decision,
      note: typeof note === 'string' ? note.trim() : '',
    },
  };
}

export function validateReplayCommand(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, error: 'invalid_payload', message: 'Request body must be a JSON object.' };
  }
  const { workflowId, idempotencyKey } = body;
  if (!isNonEmptyString(workflowId, WORKFLOW_LIMITS.MAX_ID_CHARS)) {
    return { valid: false, error: 'invalid_workflow_id', message: 'Invalid workflowId.' };
  }
  if (!isValidIdempotencyKey(idempotencyKey)) {
    return { valid: false, error: 'invalid_idempotency_key', message: 'Valid idempotencyKey is required.' };
  }
  return {
    valid: true,
    value: { workflowId: workflowId.trim(), idempotencyKey },
  };
}

/**
 * Validates AI/agent output as an untrusted proposal.
 * Requires provenance/citations and rejects autonomous filing or official-status claims.
 */
export function validateProposalScope(proposal) {
  if (!proposal || typeof proposal !== 'object') {
    return { valid: false, reason: 'missing_proposal' };
  }
  if (!isNonEmptyString(proposal.summary, 4000)) {
    return { valid: false, reason: 'missing_summary' };
  }
  if (!Array.isArray(proposal.citations) || proposal.citations.length === 0) {
    return { valid: false, reason: 'missing_citations' };
  }
  for (const pattern of FORBIDDEN_AUTONOMOUS_CLAIMS) {
    if (pattern.test(proposal.summary)) {
      return { valid: false, reason: 'scope_boundary_violation' };
    }
  }
  return { valid: true };
}
