// Agent Contracts for Multi-Agent Civic Casework Orchestrator (#1144)
// ===========================================================================
// Defines typed input/output contracts for specialist agents orchestrated
// as a versioned state machine with human approval gates.
// All contracts validate at service boundaries; AI/agent outputs are treated
// as untrusted proposals requiring human citation/provenance and approval.

import { logDiagnostic } from '../utils/diagnostics.js';

export const AGENT_SCHEMA_VERSION = '1.0.0';

export const AGENT_STATUS = Object.freeze({
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  APPROVAL_REQUIRED: 'approval_required',
  APPROVED: 'approved',
  REJECTED: 'rejected',
});

export const AGENT_PRIORITY = Object.freeze({
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent',
});

/**
 * Base agent input contract - all agent inputs must conform to one of these
 * (or have a compatible structure with validated fields).
 */
export function validateAgentInput(input, expectedSchema) {
  const errors = [];

  if (!input || typeof input !== 'object') {
    errors.push('(input)', 'must be a non-null object');
    return { valid: false, errors };
  }

  // Validate required fields based on schema type
  if (expectedSchema === 'intake') {
    if (!input.citizenId || typeof input.citizenId !== 'string') {
      errors.push({ field: 'citizenId', reason: 'is required and must be a string' });
    }
    if (!input.caseType || typeof input.caseType !== 'string') {
      errors.push({ field: 'caseType', reason: 'is required and must be a string' });
    }
    if (!input.intakeData || typeof input.intakeData !== 'object') {
      errors.push({ field: 'intakeData', reason: 'is required and must be an object' });
    }
  } else if (expectedSchema === 'policy') {
    if (!input.query || typeof input.query !== 'string') {
      errors.push({ field: 'query', reason: 'is required and must be a string' });
    }
    if (!input.jurisdiction || typeof input.jurisdiction !== 'object') {
      errors.push({ field: 'jurisdiction', reason: 'is required and must be an object' });
    }
  } else if (expectedSchema === 'evidence') {
    if (!input.caseId || typeof input.caseId !== 'string') {
      errors.push({ field: 'caseId', reason: 'is required and must be a string' });
    }
    if (!input.evidenceItems || !Array.isArray(input.evidenceItems)) {
      errors.push({ field: 'evidenceItems', reason: 'is required and must be an array' });
    }
  } else if (expectedSchema === 'form-assistance') {
    if (!input.caseId || typeof input.caseId !== 'string') {
      errors.push({ field: 'caseId', reason: 'is required and must be a string' });
    }
    if (!input.formType || typeof input.formType !== 'string') {
      errors.push({ field: 'formType', reason: 'is required and must be a string' });
    }
    if (!input.formData || typeof input.formData !== 'object') {
      errors.push({ field: 'formData', reason: 'is required and must be an object' });
    }
  } else if (expectedSchema === 'quality-review') {
    if (!input.caseId || typeof input.caseId !== 'string') {
      errors.push({ field: 'caseId', reason: 'is required and must be a string' });
    }
    if (!input.content || typeof input.content !== 'string') {
      errors.push('content', 'is required and must be a string');
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, errors: [] };
}

/**
 * Agent output proposal - AI/agent outputs are always treated as untrusted
 * proposals. Must include citations/provenance and require human approval
 * for high-impact actions.
 */
export const AgentOutputProposal = Object.freeze({
  // The proposed result from the agent
  proposal: null, // type depends on agent

  // Provenance/citations supporting the proposal
  citations: [], // Array of { source, url, excerpt, confidence }

  // Confidence score 0-1
  confidence: 0,

  // Whether this proposal requires explicit human approval
  requiresApproval: true,

  // Impact level: 'low', 'medium', 'high', 'critical'
  impactLevel: 'high',

  // Human-readable rationale
  rationale: '',

  // Timestamp of proposal generation
  timestamp: null,

  // Agent that generated this proposal
  agentName: '',
});

/**
 * Approval gate result
 */
export const ApprovalResult = Object.freeze({
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PENDING: 'pending',
  EXPIRED: 'expired',
});

/**
 * State transition map for the orchestrator state machine
 * Defines valid transitions between case states
 */
export const CASE_STATE_TRANSITIONS = Object.freeze({
  // Intake phase
  intake_pending: ['intake_in_progress'],
  intake_in_progress: [
    'intake_completed',
    'intake_failed',
    'intake_cancelled',
  ],
  intake_completed: ['policy_retrieval_queued'],
  intake_failed: ['intake_completed'], // can still proceed with partial data
  intake_cancelled: [],

  // Policy retrieval phase
  policy_retrieval_queued: ['policy_retrieval_in_progress'],
  policy_retrieval_in_progress: [
    'policy_retrieval_completed',
    'policy_retrieval_failed',
  ],
  policy_retrieval_completed: ['evidence_organization_queued'],
  policy_retrieval_failed: ['evidence_organization_queued'], // proceed with what we have

  // Evidence organization phase
  evidence_organization_queued: ['evidence_organization_in_progress'],
  evidence_organization_in_progress: [
    'evidence_organization_completed',
    'evidence_organization_failed',
  ],
  evidence_organization_completed: ['form_assistance_queued'],
  evidence_organization_failed: ['form_assistance_queued'], // proceed with partial

  // Form assistance phase
  form_assistance_queued: ['form_assistance_in_progress'],
  form_assistance_in_progress: [
    'form_assistance_completed',
    'form_assistance_failed',
    'form_assistance_approval_required',
  ],
  form_assistance_completed: ['quality_review_queued'],
  form_assistance_approval_required: ['quality_review_queued'], // after citizen approval
  form_assistance_failed: ['form_assistance_completed'], // fallback

  // Quality review phase
  quality_review_queued: ['quality_review_in_progress'],
  quality_review_in_progress: [
    'quality_review_completed',
    'quality_review_failed',
    'quality_review_approval_required',
  ],
  quality_review_completed: ['submission_pending'],
  quality_review_approval_required: ['submission_pending'], // after citizen approval
  quality_review_failed: ['quality_review_completed'], // fallback review

  // Submission phase (requires explicit citizen approval)
  // Two possible paths from submission_pending:
  submission_pending: ['submission_approved', 'submission_cancelled'],
  submission_approved: [],
  submission_cancelled: [],
  submitted: [],
});

/**
 * High-impact actions that require explicit citizen approval
 */
export const HIGH_IMPACT_ACTIONS = Object.freeze({
  SUBMIT_FORM: 'submit_form',
  FILE_OFFICIAL: 'file_official',
  CLAIM_BENEFIT: 'claim_benefit',
  RELEASE_DATA: 'release_data',
});

/**
 * Validation result shape for agent proposals
 */
export function validateAgentOutput(output) {
  const errors = [];

  if (!output || typeof output !== 'object') {
    errors.push('(output)', 'must be a non-null object');
    return { valid: false, errors };
  }

  // Check required fields
  const requiredFields = ['proposal', 'citations', 'confidence', 'requiresApproval', 'impactLevel', 'rationale', 'agentName', 'timestamp'];
  for (const field of requiredFields) {
    if (!(field in output)) {
      errors.push({ field, reason: 'is required' });
    }
  }

  // Validate confidence is a number 0-1
  if (output.confidence !== undefined && (typeof output.confidence !== 'number' || output.confidence < 0 || output.confidence > 1)) {
    errors.push({ field: 'confidence', reason: 'must be a number between 0 and 1' });
  }

  // Validate impactLevel
  const validImpactLevels = ['low', 'medium', 'high', 'critical'];
  if (output.impactLevel && !validImpactLevels.includes(output.impactLevel)) {
    errors.push({ field: 'impactLevel', reason: `must be one of: ${validImpactLevels.join(', ')}` });
  }

  // Validate requiresApproval based on impactLevel
  if (output.impactLevel === 'critical' && output.requiresApproval === undefined) {
    errors.push({ field: 'requiresApproval', reason: 'is required for critical impact actions' });
  }

  // Validate citations array
  if (output.citations !== undefined && !Array.isArray(output.citations)) {
    errors.push({ field: 'citations', reason: 'must be an array' });
  }

  // Validate agentName
  if (!output.agentName || typeof output.agentName !== 'string') {
    errors.push({ field: 'agentName', reason: 'is required and must be a string' });
  }

  // Validate timestamp
  if (!output.timestamp) {
    errors.push({ field: 'timestamp', reason: 'is required' });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, errors: [] };
}

/**
 * Check if an action requires explicit citizen approval
 */
export function requiresCitizenApproval(impactLevel, actionType) {
  // Critical or high impact always requires approval for high-impact actions
  if (impactLevel === 'critical' || impactLevel === 'high') {
    if (actionType === HIGH_IMPACT_ACTIONS.SUBMIT_FORM ||
        actionType === HIGH_IMPACT_ACTIONS.FILE_OFFICIAL ||
        actionType === HIGH_IMPACT_ACTIONS.CLAIM_BENEFIT) {
      return true;
    }
  }
  return false;
}

/**
 * Synthetic fixtures for testing - never use real citizen data
 */
export const syntheticFixtures = {
  sampleIntakeInput: {
    citizenId: 'synthetic-citizen-001',
    caseType: 'public-grievance',
    intakeData: {
      complaint: 'Road pothole causing safety hazard',
      location: 'Main Street near City Hall',
      observedDate: '2026-01-15',
    },
  },

  samplePolicyQuery: {
    query: 'What schemes am I eligible for after a flood damage?',
    jurisdiction: {
      level: 'state',
      states: ['Maharashtra'],
      districts: ['Mumbai'],
    },
  },

  sampleEvidenceInput: {
    caseId: 'synthetic-case-001',
    evidenceItems: [
      {
        id: 'evidence-001',
        type: 'photograph',
        description: 'Photo of pothole',
        url: 'synthetic-url-001',
        capturedAt: '2026-01-15T10:30:00Z',
        confidence: 0.95,
      },
    ],
  },

  sampleFormDataInput: {
    caseId: 'synthetic-case-001',
    formType: 'grievance-submission',
    formData: {
      complainantName: 'Synthetic Citizen',
      contactPhone: 'synthetic-phone',
      complaintDetails: 'Road pothole causing safety hazard',
    },
  },

  sampleQualityReviewInput: {
    caseId: 'synthetic-case-001',
    content: 'Draft grievance submission regarding road pothole',
    proposedApproval: AgentOutputProposal.APPROVED,
  },
};