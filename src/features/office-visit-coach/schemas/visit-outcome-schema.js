/**
 * Visit Outcome Schema v1.0.0
 * Defines valid visit outcomes and outcome recording structure for the Follow-Up Agent.
 * 
 * All visit outcome recordings must conform to this schema at the trust boundary.
 * Outcome recording requires explicit human approval - the coach never autonomously
 * records outcomes without user confirmation.
 */

export const VisitOutcomeSchema = {
  /** Current visit status */
  status: {
    type: 'string',
    enum: ['PENDING_VISIT', 'COMPLETED', 'RESCHEDULED', 'TOKEN_ISSUED', 'ADDITIONAL_DOCS_REQUESTED', 'CANCELLED'],
    description: 'High-level visit status',
  },

  /** Specific visit outcome */
  outcome: {
    type: 'string',
    enum: ['PENDING_VISIT', 'COMPLETED', 'RESCHEDULED', 'TOKEN_ISSUED', 'ADDITIONAL_DOCS_REQUESTED', 'CANCELLED'],
    description: 'Specific visit result',
  },

  /** Free-form notes about the visit outcome */
  outcomeNotes: {
    type: 'string',
    default: '',
    description: 'Citizen-entered notes about what happened during the visit',
  },

  /** When the outcome was recorded */
  recordedAt: {
    type: 'string',
    format: 'date-time',
    description: 'ISO 8601 timestamp of outcome recording',
  },

  /** Who recorded the outcome (opaque identifier) */
  recordedBy: {
    type: 'string',
    minLength: 1,
    description: 'Opaque identifier - no PII or credential data',
  },

  /** Whether this outcome was explicitly approved by the citizen */
  explicitlyApproved: {
    type: 'boolean',
    default: false,
    description: 'Set when citizen confirmed outcome recording',
  },

  /** Provenance metadata */
  provenance: {
    type: 'object',
    properties: {
      recordedBy: { type: 'string' },
      recordedAt: { type: 'string', format: 'date-time' },
    },
    required: ['recordedBy', 'recordedAt'],
    additionalProperties: false,
  },
};

/**
 * Validate a visit outcome against the schema.
 * @param {unknown} data - Data to validate
 * @returns {Array} List of validation errors (empty if valid)
 */
export function validateVisitOutcome(data) {
  if (!data || typeof data !== 'object') {
    return ['visit outcome must be an object'];
  }

  const errors = [];

  if (!data.status || !['PENDING_VISIT', 'COMPLETED', 'RESCHEDULED', 'TOKEN_ISSUED', 'ADDITIONAL_DOCS_REQUESTED', 'CANCELLED'].includes(data.status)) {
    errors.push(`status must be one of: PENDING_VISIT, COMPLETED, RESCHEDULED, TOKEN_ISSUED, ADDITIONAL_DOCS_REQUESTED, CANCELLED`);
  }

  if (!data.outcome || !['PENDING_VISIT', 'COMPLETED', 'RESCHEDULED', 'TOKEN_ISSUED', 'ADDITIONAL_DOCS_REQUESTED', 'CANCELLED'].includes(data.outcome)) {
    errors.push(`outcome must be one of: PENDING_VISIT, COMPLETED, RESCHEDULED, TOKEN_ISSUED, ADDITIONAL_DOCS_REQUESTED, CANCELLED`);
  }

  if (data.outcomeNotes !== undefined && typeof data.outcomeNotes !== 'string') {
    errors.push('outcomeNotes must be a string or undefined');
  }

  if (data.recordedAt && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.+/.test(data.recordedAt)) {
    errors.push('recordedAt must be a valid ISO 8601 datetime');
  }

  if (data.recordedBy && (typeof data.recordedBy !== 'string' || data.recordedBy.length === 0)) {
    errors.push('recordedBy must be a non-empty string or undefined');
  }

  if (data.explicitlyApproved !== undefined && typeof data.explicitlyApproved !== 'boolean') {
    errors.push('explicitlyApproved must be a boolean or undefined');
  }

  if (data.provenance) {
    const p = data.provenance;
    if (!p.recordedBy || typeof p.recordedBy !== 'string') {
      errors.push('provenance.recordedBy is required');
    }
    if (!p.recordedAt || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.+/.test(p.recordedAt)) {
      errors.push('provenance.recordedAt must be a valid ISO 8601 datetime');
    }
  }

  return errors;
}

/**
 * Create a new visit outcome with default values (PENDING_VISIT).
 * @param {Object} options - Options for outcome creation
 * @returns {Object} Valid visit outcome
 */
export function createVisitOutcome(options = {}) {
  const status = options.status !== undefined ? options.status : 'PENDING_VISIT';
  const outcomeVal = options.outcome !== undefined ? options.outcome : (options.status || 'PENDING_VISIT');
  const outcome = {
    status,
    outcome: outcomeVal,
    outcomeNotes: options.outcomeNotes || '',
    recordedAt: options.recordedAt || new Date().toISOString(),
    recordedBy: options.recordedBy || 'citizen',
    explicitlyApproved: options.explicitlyApproved || false,
    provenance: {
      recordedBy: options.recordedBy || 'citizen',
      recordedAt: new Date().toISOString(),
    },
  };

  return outcome;
}

/**
 * Update a visit outcome with new data, ensuring explicit approval for state changes.
 * @param {Object} currentOutcome - Current visit outcome
 * @param {Object} updates - Partial updates
 * @param {boolean} [approved] - Whether the citizen approved this change
 * @returns {Object} Updated visit outcome
 */
export function updateVisitOutcome(currentOutcome, updates = {}, approved = false) {
  // For status/outcome changes from PENDING_VISIT, require explicit approval
  const statusChanges = ['COMPLETED', 'RESCHEDULED', 'TOKEN_ISSUED', 'ADDITIONAL_DOCS_REQUESTED', 'CANCELLED'];
  const targetStatus = updates.status || updates.outcome;
  const isPendingToFinal = currentOutcome?.status === 'PENDING_VISIT' && targetStatus && statusChanges.includes(targetStatus);

  if (isPendingToFinal && !approved) {
    throw new Error(
      'Explicit citizen approval required to record visit outcome. ' +
      'This is a high-impact action that cannot be performed autonomously.'
    );
  }

  const outcome = {
    ...currentOutcome,
    ...updates,
    explicitlyApproved: approved ? true : (currentOutcome?.explicitlyApproved || false),
    provenance: {
      ...currentOutcome?.provenance,
      recordedBy: updates.recordedBy || currentOutcome?.provenance?.recordedBy || 'citizen',
      recordedAt: new Date().toISOString(),
    },
  };

  return outcome;
}