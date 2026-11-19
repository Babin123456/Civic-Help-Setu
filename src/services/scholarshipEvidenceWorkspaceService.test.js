import { describe, it, expect } from 'vitest';
import {
  evaluateScholarshipReadiness,
  getVerificationWorkflowStages,
  exportScholarshipSummary,
  SCHOLARSHIP_MODES,
  SCHEME_TIERS,
  NPCI_AADHAAR_SEEDING_NOTICE,
  FREQUENTLY_ASKED_QUESTIONS,
  APPLICATION_DEFECT_CATEGORIES
} from './scholarshipEvidenceWorkspaceService';

describe('scholarshipEvidenceWorkspaceService', () => {
  it('should define modes and scheme tiers', () => {
    expect(SCHOLARSHIP_MODES.FRESH.code).toBe('FRESH');
    expect(SCHOLARSHIP_MODES.RENEWAL.code).toBe('RENEWAL');
    expect(SCHEME_TIERS.POST_MATRIC.incomeCeiling).toBe(250000);
    expect(NPCI_AADHAAR_SEEDING_NOTICE).toContain('NPCI');
  });

  it('should evaluate fresh scholarship application correctly', () => {
    const freshApp = {
      studentName: 'Aamir Hussain',
      mode: 'FRESH',
      schemeTier: 'POST_MATRIC',
      annualIncome: 150000,
      isAadhaarBankSeeded: true,
      documents: [
        'bonafide_certificate',
        'income_certificate',
        'domicile_certificate',
        'previous_marksheet',
        'fee_receipt'
      ]
    };

    const res = evaluateScholarshipReadiness(freshApp);
    expect(res.isEligible).toBe(true);
    expect(res.errors).toHaveLength(0);
    expect(res.warnings).toHaveLength(0);
    expect(res.verificationStages.length).toBe(4);
  });

  it('should validate renewal application requirements and flag missing previous ID', () => {
    const renewalApp = {
      studentName: 'Sneha Patil',
      mode: 'RENEWAL',
      schemeTier: 'POST_MATRIC',
      previousMarksPercent: 45, // below 50%
      documents: ['bonafide_certificate']
    };

    const res = evaluateScholarshipReadiness(renewalApp);
    expect(res.isEligible).toBe(false);
    expect(res.errors).toContain('Previous Year Application ID is mandatory for scholarship renewal.');
    expect(res.warnings.some(w => w.includes('minimum 50% marks'))).toBe(true);
    expect(res.warnings.some(w => w.includes('NPCI mapping'))).toBe(true);
  });

  it('should define FAQ and defect categories', () => {
    expect(FREQUENTLY_ASKED_QUESTIONS.length).toBeGreaterThanOrEqual(4);
    expect(APPLICATION_DEFECT_CATEGORIES.INCORRECT_INCOME).toBeDefined();
  });

  it('should export formatted scholarship summary', () => {
    const app = {
      studentName: 'Deepak Mondal',
      portalName: 'Oasis Bengal Scholarship Portal',
      mode: 'FRESH',
      schemeTier: 'POST_MATRIC',
      annualIncome: 120000,
      isAadhaarBankSeeded: true,
      documents: [
        'bonafide_certificate',
        'income_certificate',
        'domicile_certificate',
        'previous_marksheet',
        'fee_receipt'
      ]
    };

    const report = exportScholarshipSummary(app);
    expect(report).toContain('# Government Scholarship Application & Renewal Dossier');
    expect(report).toContain('Deepak Mondal');
    expect(report).toContain('Oasis Bengal Scholarship Portal');
    expect(report).toContain('VERIFIED READY FOR PORTAL SUBMISSION');
    expect(report).toContain('Direct Benefit Transfer (DBT)');
  });
});
