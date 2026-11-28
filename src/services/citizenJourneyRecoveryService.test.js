import { describe, it, expect, beforeEach } from 'vitest';
import {
  CitizenJourneyRecoveryService,
  JOURNEY_STAGE_STATUS
} from './citizenJourneyRecoveryService.js';

describe('CitizenJourneyRecoveryService (#1451)', () => {
  let recoveryService;

  beforeEach(() => {
    recoveryService = new CitizenJourneyRecoveryService({ staleThresholdDays: 14 });
  });

  it('persists progress checkpoints without credentials and distinguishes stage statuses', () => {
    const cp = recoveryService.saveCheckpoint({
      serviceName: 'Disability Certificate UDID',
      currentStep: 3,
      stageStatus: JOURNEY_STAGE_STATUS.PREPARED,
      formData: {
        applicantName: 'Ramesh Kumar',
        hospitalName: 'District Hospital Agra',
        accountPassword: 'secret_to_be_stripped'
      }
    });

    expect(cp.journeyId).toMatch(/^JRN-[0-9a-f]{16}$/);
    expect(cp.stageStatus).toBe(JOURNEY_STAGE_STATUS.PREPARED);
    expect(cp.formData.applicantName).toBe('Ramesh Kumar');
    expect(cp.formData.accountPassword).toBeUndefined();
  });

  it('detects stale checkpoints and tracks external portal submissions', () => {
    const cp = recoveryService.saveCheckpoint({
      serviceName: 'UP Pension Registration',
      currentStep: 4,
      stageStatus: JOURNEY_STAGE_STATUS.DRAFT
    });

    // Simulate stale last updated timestamp
    cp.lastUpdatedAt = Date.now() - (15 * 24 * 60 * 60 * 1000);

    const resumeResult = recoveryService.resumeJourney(cp.journeyId);
    expect(resumeResult.isStale).toBe(true);
    expect(resumeResult.staleWarning).toContain('over 14 days old');

    recoveryService.updateExternalSubmissionStatus(cp.journeyId, 'ACK-UP-2026-9812');
    expect(cp.stageStatus).toBe(JOURNEY_STAGE_STATUS.SUBMITTED_EXTERNALLY);
    expect(cp.externalAcknowledgementNumber).toBe('ACK-UP-2026-9812');
  });
});
