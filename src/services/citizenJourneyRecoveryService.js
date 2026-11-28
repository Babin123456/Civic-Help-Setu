import crypto from 'node:crypto';

export const JOURNEY_STAGE_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  PREPARED: 'PREPARED',
  SUBMITTED_EXTERNALLY: 'SUBMITTED_EXTERNALLY',
  CONFIRMED: 'CONFIRMED'
});

export class CitizenJourneyRecoveryService {
  constructor(config = {}) {
    this.staleThresholdDays = config.staleThresholdDays || 14;
    this.checkpoints = new Map();
  }

  saveCheckpoint(checkpointData = {}) {
    const {
      journeyId,
      citizenId,
      serviceName,
      currentStep,
      stageStatus = JOURNEY_STAGE_STATUS.DRAFT,
      formData = {},
      externalAcknowledgementNumber = null
    } = checkpointData;

    if (!serviceName) {
      throw new Error('serviceName is required to establish journey checkpoints.');
    }

    const id = journeyId || `JRN-${crypto.randomBytes(8).toString('hex')}`;
    const timestamp = Date.now();

    // Checkpoint fingerprint excluding credentials or passwords
    const sanitizedData = this._stripSensitiveInputs(formData);
    const dataHash = crypto.createHash('sha256').update(JSON.stringify(sanitizedData)).digest('hex');

    const checkpoint = {
      journeyId: id,
      citizenId: citizenId || 'ANONYMOUS_SESSION',
      serviceName,
      currentStep: currentStep || 1,
      stageStatus,
      formData: sanitizedData,
      externalAcknowledgementNumber,
      dataHash,
      lastUpdatedAt: timestamp,
      isResumable: true
    };

    this.checkpoints.set(id, checkpoint);
    return checkpoint;
  }

  _stripSensitiveInputs(data) {
    const clean = {};
    for (const [k, v] of Object.entries(data)) {
      if (!/password|pin|otp|aadhaar/i.test(k)) {
        clean[k] = v;
      }
    }
    return clean;
  }

  resumeJourney(journeyId) {
    const checkpoint = this.checkpoints.get(journeyId);
    if (!checkpoint) {
      throw new Error(`Checkpoint ${journeyId} not found.`);
    }

    const ageDays = (Date.now() - checkpoint.lastUpdatedAt) / (1000 * 60 * 60 * 24);
    const isStale = ageDays > this.staleThresholdDays;

    return {
      checkpoint,
      isStale,
      staleWarning: isStale ? 'This saved progress is over 14 days old. Service fee schedules and portal requirements may have updated.' : null,
      resumeStep: checkpoint.currentStep,
      stage: checkpoint.stageStatus
    };
  }

  updateExternalSubmissionStatus(journeyId, ackNumber) {
    const checkpoint = this.checkpoints.get(journeyId);
    if (!checkpoint) throw new Error(`Checkpoint ${journeyId} not found.`);

    checkpoint.stageStatus = JOURNEY_STAGE_STATUS.SUBMITTED_EXTERNALLY;
    checkpoint.externalAcknowledgementNumber = ackNumber;
    checkpoint.lastUpdatedAt = Date.now();

    return checkpoint;
  }
}
