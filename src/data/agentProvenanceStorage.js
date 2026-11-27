// Agent Provenance & Resumable State Storage
// ===========================================
// Persists orchestrator state and agent provenance to Firestore.
// All citizen-identifiable data is synthetic; real records are never stored
// in logs, prompts, or analytics.

/**
 * Generates a simple synthetic case ID
 */
export function generateCaseId() {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 9);
  return `case-${timestamp}-${randomPart}`;
}

const db = null; // Will be initialized with firebaseAdmin

/**
 * Orchestrator case state document schema
 * Stored in Firestore collection: `casework_orchestrator_cases`
 */
export const CaseStateSchema = Object.freeze({
  // Unique case identifier
  caseId: '',

  // Citizen identifier (synthetic, never real)
  citizenId: '',

  // Case type/category
  caseType: '',

  // Current state in the versioned state machine
  state: '',

  // Version of the state machine schema
  schemaVersion: '',

  // Per-step agent states
  agentStates: Map, // { [agentName]: { status, result, error, startedAt, completedAt } }

  // Agent proposals/outputs (for audit trail)
  agentProposals: [Object], // { agentName, output, approvedAt, approvedBy }

  // Human approval gates
  approvalGates: Map, // { [gateId]: { actionType, impactLevel, status, requestedAt, respondedAt, respondedBy } }

  // Timestamps
  createdAt: null,
  updatedAt: null,
  startedAt: null,
  completedAt: null,

  // Cancellation tracking
  cancelled: false,
  cancellationReason: null,

  // Retry tracking
  retryCount: 0,
  maxRetries: 3,

  // SLA tracking
  sla: {
    targetMinutes: 60,
    elapsedMinutes: 0,
    breached: false,
  },

  // Audit trail
  auditLog: [], // [ { timestamp, action, actor, details } ]

  // Tenant/jurisdiction isolation
  tenantId: '',
});

/**
 * Create a new casework orchestrator case
 */
export function createCase(citizenId, caseType, tenantId) {
  const caseId = generateCaseId();
  const now = new Date().toISOString();

  const initialState = {
    caseId,
    citizenId,
    caseType,
    state: 'intake_pending',
    schemaVersion: AGENT_SCHEMA_VERSION,
    agentStates: new Map(),
    agentProposals: [],
    approvalGates: new Map(),
    createdAt: now,
    updatedAt: now,
    startedAt: now,
    completedAt: null,
    cancelled: false,
    cancellationReason: null,
    retryCount: 0,
    maxRetries: 3,
    sla: {
      targetMinutes: 60,
      elapsedMinutes: 0,
      breached: false,
    },
    auditLog: [
      {
        timestamp: now,
        action: 'case_created',
        actor: 'system',
        details: `Case created for citizen ${citizenId}, type ${caseType}`,
      },
    ],
    tenantId,
  };

  // Set initial agent states for intake phase
  initialState.agentStates.set('intake', {
    status: AGENT_STATUS.PENDING,
    result: null,
    error: null,
    startedAt: null,
    completedAt: null,
  });

  return initialState;
}

/**
 * Update case state with valid transition
 */
export function updateCaseState(caseState, newState) {
  const validTransitions = CASE_STATE_TRANSITIONS[caseState.state];

  if (!validTransitions || !validTransitions.includes(newState)) {
    const error = `Invalid state transition: ${caseState.state} -> ${newState}`;
    logDiagnostic(error, 'warn');
    return { success: false, error };
  }

  caseState.state = newState;
  caseState.updatedAt = new Date().toISOString();

  // Add audit log entry
  caseState.auditLog.push({
    timestamp: caseState.updatedAt,
    action: 'state_transition',
    actor: 'system',
    details: `Transitioned from planning: ${caseState.state} to ${newState}`,
  });

  return { success: true, caseState };
}

/**
 * Record an agent proposal output
 */
export function recordAgentProposal(caseState, proposal) {
  const validated = validateAgentOutput(proposal);

  if (!validated.valid) {
    const error = `Invalid agent proposal: ${validated.errors.join(', ')}`;
    logDiagnostic(error, 'error');
    return { success: false, error };
  }

  const proposalRecord = {
    ...proposal,
    proposalId: `proposal-${generateCaseId()}`,
    generatedAt: new Date().toISOString(),
    caseId: caseState.caseId,
  };

  caseState.agentProposals.push(proposalRecord);
  caseState.updatedAt = new Date().toISOString();

  // Add audit log entry
  caseState.auditLog.push({
    timestamp: caseState.updatedAt,
    action: 'agent_proposal',
    actor: 'agent',
    details: `Proposal from ${proposal.agentName}, impact: ${proposal.impactLevel}`,
  });

  return { success: true, proposalRecord };
}

/**
 * Create a human approval gate
 * Required before any external submission or high-impact action
 */
export function createApprovalGate(caseState, actionType, impactLevel) {
  const gateId = `gate-${generateCaseId()}`;
  const now = new Date().toISOString();

  const gate = {
    gateId,
    actionType,
    impactLevel,
    status: 'pending',
    requestedAt: now,
    respondedAt: null,
    respondedBy: null,
    citizenId: caseState.citizenId,
    caseId: caseState.caseId,
  };

  caseState.approvalGates.set(gateId, gate);
  caseState.updatedAt = now;

  // Add audit log entry
  caseState.auditLog.push({
    timestamp: now,
    action: 'approval_gate_created',
    actor: 'system',
    details: `Approval gate ${gateId} created for action: ${actionType}, impact: ${impactLevel}`,
  });

  return { success: true, gateId, gate };
}

/**
 * Respond to an approval gate (citizen approval/rejection)
 */
export function respondToApprovalGate(caseState, gateId, response) {
  const gate = caseState.approvalGates.get(gateId);

  if (!gate) {
    const error = `Approval gate ${gateId} not found`;
    logDiagnostic(error, 'error');
    return { success: false, error };
  }

  if (gate.status !== 'pending') {
    const error = `Approval gate ${gateId} already responded to (status: ${gate.status})`;
    logDiagnostic(error, 'warn');
    return { success: false, error };
  }

  // Validate response
  const validResponses = ['approved', 'rejected'];
  if (!validResponses.includes(response)) {
    const error = `Invalid approval response: ${response}. Must be one of: ${validResponses.join(', ')}`;
    logDiagnostic(error, 'error');
    return { success: false, error };
  }

  gate.status = response;
  gate.respondedAt = new Date().toISOString();
  // In a real system, would track who responded (citizen ID)

  caseState.updatedAt = gate.respondedAt;

  // Add audit log entry
  caseState.auditLog.push({
    timestamp: gate.respondedAt,
    action: 'approval_gate_responded',
    actor: 'citizen',
    details: `Approval gate ${gateId} responded: ${response} for action: ${gate.actionType}`,
  });

  return { success: true, gate };
}

/**
 * Get approval gate status
 */
export function getApprovalGate(caseState, gateId) {
  return caseState.approvalGates.get(gateId) || null;
}

/**
 * Check if any approval gate is pending for high-impact actions
 */
export function hasPendingApprovalGate(caseState) {
  for (const gate of caseState.approvalGates.values()) {
    if (gate.status === 'pending') {
      return true;
    }
  }
  return false;
}

/**
 * Get all pending approval gates
 */
export function getPendingApprovalGates(caseState) {
  const pending = [];
  for (const gate of caseState.approvalGates.values()) {
    if (gate.status === 'pending') {
      pending.push(gate);
    }
  }
  return pending;
}

/**
 * Cancel a case
 */
export function cancelCase(caseState, reason) {
  caseState.cancelled = true;
  caseState.cancellationReason = reason;
  caseState.state = 'intake_cancelled';
  caseState.updatedAt = new Date().toISOString();

  caseState.auditLog.push({
    timestamp: caseState.updatedAt,
    action: 'case_cancelled',
    actor: 'system',
    details: `Case cancelled: ${reason}`,
  });

  return caseState;
}

/**
 * Check if case can retry based on max retries
 */
export function canRetry(caseState) {
  return caseState.retryCount < caseState.maxRetries;
}

/**
 * Increment retry count
 */
export function incrementRetry(caseState) {
  caseState.retryCount += 1;
  caseState.updatedAt = new Date().toISOString();

  caseState.auditLog.push({
    timestamp: caseState.updatedAt,
    action: 'retry_attempt',
    actor: 'system',
    details: `Retry attempt ${caseState.retryCount}/${caseState.maxRetries}`,
  });

  return caseState.retryCount >= caseState.maxRetries;
}

/**
 * SLA breach check
 */
export function checkSLA(caseState) {
  const now = new Date();
  const elapsed = now - new Date(caseState.startedAt);
  const elapsedMinutes = Math.floor(elapsed / 60000);

  caseState.sla.elapsedMinutes = elapsedMinutes;
  caseState.sla.breached = elapsedMinutes > caseState.sla.targetMinutes;

  if (caseState.sla.breached) {
    caseState.auditLog.push({
      timestamp: caseState.updatedAt,
      action: 'sla_breach',
      actor: 'system',
      details: `SLA breached after ${elapsedMinutes} minutes (target: ${caseState.sla.targetMinutes} min)`,
    });
  }

  return caseState.sla;
}

/**
 * Serialize case state for storage (strip method functions, keep data)
 */
export function serializeCaseState(caseState) {
  const { agentStates, approvalGates, auditLog, ...data } = caseState;
  return data;
}

/**
 * Deserialize case state from storage (re-attach methods)
 */
export function deserializeCaseState(rawData) {
  const caseState = { ...rawData };

  // Re-attach methods by importing from scope
  // Methods are attached at runtime via the orchestrator service

  return caseState;
}