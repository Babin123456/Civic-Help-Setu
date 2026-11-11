import { describe, it, expect } from 'vitest';
import {
  DEADLINE_TIER,
  GRIEVANCE_STATUS,
  calculateWorkingDays,
  escalateGrievanceToNextStage,
  exportComplaintChronology,
  getJurisdictionEscalationRules,
  trackCivicGrievance,
} from './stateGrievanceEscalationTrackerService.js';

describe('stateGrievanceEscalationTrackerService', () => {
  it('returns verified statutory escalation rules for supported state jurisdictions', () => {
    const tn = getJurisdictionEscalationRules('TAMIL_NADU');
    expect(tn.isSupported).toBe(true);
    expect(tn.stages.length).toBe(3);
    expect(tn.officialSource).toBeDefined();
    expect(tn.lastVerifiedDate).toBe('2026-01-15');
    expect(tn.portalUrl).toContain('cmhelpline.tnega.org');

    const mh = getJurisdictionEscalationRules('MAHARASHTRA');
    expect(mh.isSupported).toBe(true);
    expect(mh.legislation).toContain('Right to Public Services Act');
  });

  it('handles unsupported jurisdictions gracefully with alternative central guidance', () => {
    const unverified = getJurisdictionEscalationRules('UNKNOWN_STATE');
    expect(unverified.isSupported).toBe(false);
    expect(unverified.recommendedAction).toContain('CPGRAMS');
  });

  it('calculates working days while properly excluding weekends and recognized holidays', () => {
    // 2026-01-23 (Friday) to 2026-01-27 (Tuesday)
    // Jan 23 = Working day 1
    // Jan 24 = Sat (skip)
    // Jan 25 = Sun (skip)
    // Jan 26 = Republic Day Holiday (skip)
    // Jan 27 = Working day 2
    const workingDays = calculateWorkingDays('2026-01-23', '2026-01-27');
    expect(workingDays).toBe(2);
  });

  it('tracks grievance and distinctly labels statutory deadlines from department targets', () => {
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 5);

    const complaint = trackCivicGrievance({
      stateKey: 'MAHARASHTRA',
      department: 'Public Health Department',
      grievanceCategory: 'Primary Health Centre Sanitation',
      referenceNumber: 'MH-G-2026-901',
      submissionDate: recentDate.toISOString().slice(0, 10),
    });

    expect(complaint.stateName).toBe('Maharashtra');
    expect(complaint.status).toBe(GRIEVANCE_STATUS.UNDER_REVIEW);
    expect(complaint.deadlines.statutoryDays).toBe(21);
    expect(complaint.deadlines.statutoryLabel).toBe(DEADLINE_TIER.STATUTORY_MANDATE);
    expect(complaint.deadlines.departmentTargetDays).toBe(14);
    expect(complaint.deadlines.departmentTargetLabel).toBe(DEADLINE_TIER.DEPARTMENT_TARGET);
  });

  it('detects statutory SLA breaches and permits formal escalation to appellate authority', () => {
    // Submission date 40 working days ago (breaches 21-day Maharashtra Stage 1 SLA)
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 65);

    const complaint = trackCivicGrievance({
      stateKey: 'MAHARASHTRA',
      department: 'Revenue & Land Records',
      referenceNumber: 'MH-REV-001',
      submissionDate: oldDate.toISOString().slice(0, 10),
    });

    expect(complaint.status).toBe(GRIEVANCE_STATUS.STATUTORY_SLA_BREACHED);
    expect(complaint.canEscalate).toBe(true);
    expect(complaint.nextAppellateStage.stageNumber).toBe(2);

    // Escalate to next stage
    const escalated = escalateGrievanceToNextStage(complaint, 'Stage 1 timeline breached without response.');
    expect(escalated.currentStageNumber).toBe(2);
    expect(escalated.currentAuthority).toContain('First Appellate Authority');
    expect(escalated.history.length).toBe(1);
    expect(escalated.history[0].action).toBe('ESCALATION_FILED');
  });

  it('exports a complete chronological complaint dossier for legal appeals', () => {
    const complaint = trackCivicGrievance({
      stateKey: 'TAMIL_NADU',
      department: 'Municipal Administration',
      referenceNumber: 'TN-MA-4421',
      submissionDate: '2026-02-01',
    });

    const dossier = exportComplaintChronology(complaint);
    expect(dossier.stateJurisdiction).toBe('Tamil Nadu');
    expect(dossier.legislationCited).toContain('Tamil Nadu Right to Service');
    expect(dossier.referenceNumber).toBe('TN-MA-4421');
    expect(dossier.officialVerification.lastVerifiedDate).toBe('2026-01-15');
  });

  it('validates required fields and throws descriptive errors on missing inputs', () => {
    expect(() =>
      trackCivicGrievance({
        stateKey: 'TAMIL_NADU',
        department: '', // Missing department
        submissionDate: '2026-01-01',
      })
    ).toThrow(/Valid department name is required/);

    expect(() =>
      trackCivicGrievance({
        department: 'Revenue',
        submissionDate: 'invalid-date',
      })
    ).toThrow(/Valid submissionDate is required/);
  });
});
