/**
 * @file citizenJourneyStateMachineService.js
 * @description Versioned citizen journey state machine with resumable checkpoints, state validation,
 * schema migration handling, and strict server-side transition guards.
 */

export class JourneyStateError extends Error {
  constructor(message, code = 'JOURNEY_STATE_ERROR', details = {}) {
    super(message);
    this.name = 'JourneyStateError';
    this.code = code;
    this.details = details;
  }
}

export const JourneyState = Object.freeze({
  DRAFT: 'DRAFT',
  ELIGIBILITY_VERIFIED: 'ELIGIBILITY_VERIFIED',
  DOCUMENTS_ATTACHED: 'DOCUMENTS_ATTACHED',
  FIELD_CONFIRMATION_COMPLETED: 'FIELD_CONFIRMATION_COMPLETED',
  READY_FOR_EXPORT: 'READY_FOR_EXPORT',
  ARCHIVED: 'ARCHIVED'
});

export const VALID_TRANSITIONS = {
  [JourneyState.DRAFT]: [JourneyState.ELIGIBILITY_VERIFIED, JourneyState.ARCHIVED],
  [JourneyState.ELIGIBILITY_VERIFIED]: [JourneyState.DOCUMENTS_ATTACHED, JourneyState.DRAFT, JourneyState.ARCHIVED],
  [JourneyState.DOCUMENTS_ATTACHED]: [JourneyState.FIELD_CONFIRMATION_COMPLETED, JourneyState.ELIGIBILITY_VERIFIED, JourneyState.ARCHIVED],
  [JourneyState.FIELD_CONFIRMATION_COMPLETED]: [JourneyState.READY_FOR_EXPORT, JourneyState.DOCUMENTS_ATTACHED, JourneyState.ARCHIVED],
  [JourneyState.READY_FOR_EXPORT]: [JourneyState.ARCHIVED],
  [JourneyState.ARCHIVED]: [] // Terminal
};

export class CitizenJourneyStateMachineService {
  constructor() {
    this.checkpoints = new Map(); // journeyId -> Journey Instance
  }

  /**
   * Initializes a new citizen journey draft.
   */
  createJourney(journeyId, serviceId, citizenId, schemaVersion = 'v1.0') {
    if (!journeyId || !serviceId) {
      throw new JourneyStateError('journeyId and serviceId are required', 'INVALID_ARGUMENT');
    }

    const timestamp = new Date().toISOString();
    const journey = {
      journeyId,
      serviceId,
      citizenId: citizenId || 'anonymous',
      schemaVersion,
      currentState: JourneyState.DRAFT,
      checkpointData: {},
      transitionHistory: [
        { state: JourneyState.DRAFT, transitionedAt: timestamp, reason: 'INITIALIZED' }
      ],
      updatedAt: timestamp
    };

    this.checkpoints.set(journeyId, journey);
    return journey;
  }

  getJourney(journeyId) {
    const journey = this.checkpoints.get(journeyId);
    if (!journey) {
      throw new JourneyStateError(`Journey ${journeyId} not found`, 'NOT_FOUND');
    }
    return journey;
  }

  /**
   * Transitions journey state with strict server-side validation and checkpoint saving.
   */
  transition(journeyId, targetState, patchData = {}, reason = 'USER_PROGRESSION') {
    const journey = this.getJourney(journeyId);
    const allowed = VALID_TRANSITIONS[journey.currentState] || [];

    if (!allowed.includes(targetState)) {
      throw new JourneyStateError(
        `Invalid journey state transition from ${journey.currentState} to ${targetState}`,
        'INVALID_TRANSITION',
        { currentState: journey.currentState, targetState, allowedTransitions: allowed }
      );
    }

    // Merge checkpoint patch
    journey.checkpointData = { ...journey.checkpointData, ...patchData };
    journey.currentState = targetState;
    const timestamp = new Date().toISOString();
    journey.updatedAt = timestamp;
    journey.transitionHistory.push({
      state: targetState,
      transitionedAt: timestamp,
      reason
    });

    return journey;
  }

  /**
   * Migrates state schema version (e.g. v1.0 to v2.0) across backwards-compatible transforms.
   */
  migrateSchema(journeyId, targetVersion) {
    const journey = this.getJourney(journeyId);

    if (journey.schemaVersion === targetVersion) {
      return journey;
    }

    if (journey.schemaVersion === 'v1.0' && targetVersion === 'v2.0') {
      // Example migration: rename legacy `applicant_name` to `legal_full_name`
      if (journey.checkpointData.applicant_name) {
        journey.checkpointData.legal_full_name = journey.checkpointData.applicant_name;
        delete journey.checkpointData.applicant_name;
      }
      journey.schemaVersion = 'v2.0';
      journey.updatedAt = new Date().toISOString();
      return journey;
    }

    throw new JourneyStateError(
      `Unsupported schema migration path from ${journey.schemaVersion} to ${targetVersion}`,
      'INCOMPATIBLE_SCHEMA'
    );
  }
}

export const defaultJourneyStateMachine = new CitizenJourneyStateMachineService();
