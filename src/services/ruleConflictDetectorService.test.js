import { describe, it, expect } from 'vitest';
import {
  detectServiceRuleConflicts,
  auditCatalogueRuleConflicts,
  CONFLICT_SEVERITY,
  CONFLICT_TYPES,
} from './ruleConflictDetectorService';

describe('Civic Rule Conflict Detector Service (#270)', () => {
  it('detects mutually exclusive BPL and High-Income requirements', () => {
    const contradictoryService = {
      id: 'test-welfare-scheme',
      name: 'Subsidy Scheme',
      eligibility: ['Applicant must have valid BPL Antyodaya Ration Card', 'Annual income above 8 lakh required for tax rebate'],
      documents: ['Aadhaar', 'Income Tax ITR return acknowledgment'],
      steps: ['Apply online'],
    };

    const result = detectServiceRuleConflicts(contradictoryService);
    expect(result.hasConflicts).toBe(true);
    expect(result.conflictCount).toBe(1);
    expect(result.highestSeverity).toBe(CONFLICT_SEVERITY.HIGH);
    expect(result.conflicts[0].type).toBe(CONFLICT_TYPES.MUTUALLY_EXCLUSIVE_REQUIREMENTS);
  });

  it('detects mode inconsistency between 100% online mode and physical attestation', () => {
    const onlineWithPhysical = {
      id: 'test-online-cert',
      name: 'Digital Caste Certificate',
      mode: '100% Online Only',
      eligibility: ['Resident of Delhi'],
      documents: ['Aadhaar', 'Original notary affidavit with gazetted officer attested copy'],
      steps: ['Submit online form'],
    };

    const result = detectServiceRuleConflicts(onlineWithPhysical);
    expect(result.hasConflicts).toBe(true);
    expect(result.conflicts[0].type).toBe(CONFLICT_TYPES.INCONSISTENT_SERVICE_MODE);
  });

  it('detects circular prerequisite in learner license needing driving license', () => {
    const circularService = {
      id: 'learner-license-duplicate',
      name: 'Learner Driving License',
      documents: ['Passport size photograph', 'Existing permanent driving license'],
    };

    const result = detectServiceRuleConflicts(circularService);
    expect(result.hasConflicts).toBe(true);
    expect(result.conflicts[0].type).toBe(CONFLICT_TYPES.CONTRADICTORY_PREREQUISITE);
  });

  it('detects SLA discrepancy between same-day delivery and police verification', () => {
    const unrealisticSla = {
      id: 'express-passport',
      name: 'Express International Travel Pass',
      processingTime: 'Instant / Same Day',
      steps: ['Fill application', 'Mandatory field police verification at residence', 'Dispatch by post'],
    };

    const result = detectServiceRuleConflicts(unrealisticSla);
    expect(result.hasConflicts).toBe(true);
    expect(result.conflicts[0].type).toBe(CONFLICT_TYPES.DISCREPANT_TIMELINE_OR_SLA);
    expect(result.highestSeverity).toBe(CONFLICT_SEVERITY.MEDIUM);
  });

  it('detects impossible age threshold bounds', () => {
    const impossibleAge = {
      id: 'youth-internship',
      name: 'Youth Skill Fellowship',
      eligibility: ['Applicant must have minimum age 25 and maximum age 18'],
    };

    const result = detectServiceRuleConflicts(impossibleAge);
    expect(result.hasConflicts).toBe(true);
    expect(result.conflicts[0].type).toBe(CONFLICT_TYPES.IMPOSSIBLE_NUMERICAL_BOUNDS);
  });

  it('confirms clean service passes without conflicts', () => {
    const cleanService = {
      id: 'clean-birth-cert',
      name: 'Birth Certificate Issuance',
      mode: 'Hybrid',
      processingTime: '15 to 21 working days',
      eligibility: ['Birth occurred within municipality jurisdiction'],
      documents: ['Hospital discharge slip', 'Parent identity proof (Aadhaar / Voter ID)'],
      steps: ['Submit hospital declaration', 'Municipal registrar verification', 'Download signed certificate'],
    };

    const result = detectServiceRuleConflicts(cleanService);
    expect(result.hasConflicts).toBe(false);
    expect(result.conflictCount).toBe(0);
  });

  it('audits an entire catalogue list correctly', () => {
    const list = [
      { id: 's1', name: 'Clean Service', eligibility: ['Valid citizen'] },
      {
        id: 's2',
        name: 'Learner License Error',
        documents: ['Permanent driving license'],
      },
    ];

    const audit = auditCatalogueRuleConflicts(list);
    expect(audit.totalServices).toBe(2);
    expect(audit.flaggedServicesCount).toBe(1);
    expect(audit.hasCriticalIssues).toBe(true);
  });
});
