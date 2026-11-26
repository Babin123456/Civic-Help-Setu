import { describe, it, expect, beforeEach } from 'vitest';
import {
  CitizenJourneyStateMachineService,
  JourneyState,
  JourneyStateError
} from './citizenJourneyStateMachineService.js';

describe('CitizenJourneyStateMachineService', () => {
  let service;

  beforeEach(() => {
    service = new CitizenJourneyStateMachineService();
  });

  it('creates and tracks new journey state drafts', () => {
    const journey = service.createJourney('j_101', 'srv_caste_cert', 'citizen_44');
    expect(journey.journeyId).toBe('j_101');
    expect(journey.currentState).toBe(JourneyState.DRAFT);
    expect(journey.transitionHistory.length).toBe(1);
  });

  it('allows valid sequential transitions with checkpoint payload saving', () => {
    service.createJourney('j_102', 'srv_income_cert', 'citizen_44');
    const updated = service.transition('j_102', JourneyState.ELIGIBILITY_VERIFIED, {
      incomeCheckPassed: true,
      annualIncomeINR: 150000
    });

    expect(updated.currentState).toBe(JourneyState.ELIGIBILITY_VERIFIED);
    expect(updated.checkpointData.annualIncomeINR).toBe(150000);
    expect(updated.transitionHistory.length).toBe(2);
  });

  it('rejects invalid state transitions with detailed guard error', () => {
    service.createJourney('j_103', 'srv_pension', 'citizen_44');

    expect(() => {
      // Skipping directly from DRAFT to READY_FOR_EXPORT is illegal
      service.transition('j_103', JourneyState.READY_FOR_EXPORT);
    }).toThrow(JourneyStateError);
  });

  it('handles safe backward-compatible schema migrations across journey versions', () => {
    const journey = service.createJourney('j_104', 'srv_voter_card', 'citizen_44', 'v1.0');
    service.transition('j_104', JourneyState.ELIGIBILITY_VERIFIED, { applicant_name: 'Anita Roy' });

    const migrated = service.migrateSchema('j_104', 'v2.0');
    expect(migrated.schemaVersion).toBe('v2.0');
    expect(migrated.checkpointData.legal_full_name).toBe('Anita Roy');
    expect(migrated.checkpointData.applicant_name).toBeUndefined();
  });
});
