import { describe, it, expect, beforeEach } from 'vitest';
import { LegalAidFinderService } from './legalAidFinderService.js';

describe('LegalAidFinderService', () => {
  let service;

  beforeEach(() => {
    service = new LegalAidFinderService();
  });

  it('determines income-exempt eligibility for women and persons with disabilities', () => {
    const womanApplicant = {
      isWoman: true,
      annualIncomeINR: 800000 // Higher income, but exempt by statute
    };

    const evaluation = service.evaluateEligibility(womanApplicant);
    expect(evaluation.isLikelyEligible).toBe(true);
    expect(evaluation.isIncomeExempt).toBe(true);
    expect(evaluation.matchedStatutoryCategories[0].categoryCode).toBe('WOMEN_AND_CHILDREN');
  });

  it('evaluates low-income criteria under Section 12(h)', () => {
    const lowIncomeApplicant = {
      annualIncomeINR: 150000
    };

    const evaluation = service.evaluateEligibility(lowIncomeApplicant);
    expect(evaluation.isLikelyEligible).toBe(true);
    expect(evaluation.isIncomeExempt).toBe(false);
    expect(evaluation.matchedStatutoryCategories[0].categoryCode).toBe('LOW_INCOME_CITIZENS');
  });

  it('locates District Legal Services Authorities by district', () => {
    const results = service.findAuthority('IN-KA', 'Bengaluru Urban');
    expect(results.length).toBe(1);
    expect(results[0].authorityName).toContain('Bengaluru Urban');
    expect(results[0].tollFreeHelpline).toBe('15100');
  });

  it('generates appointment checklist with emergency signposting', () => {
    const checklist = service.generateAppointmentChecklist('dlsa_ka_bengaluru_urban');
    expect(checklist.authorityName).toContain('DLSA');
    expect(checklist.documentChecklist.length).toBeGreaterThanOrEqual(4);
    expect(checklist.emergencyGuidance).toContain('112 (Police)');
  });

  it('logs incorrect contact reports for verification', () => {
    const report = service.reportIncorrectContact('dlsa_dl_new_delhi', 'Phone line busy; shifted to room 14.');
    expect(report.id).toMatch(/^dlsa_err_/);
    expect(report.status).toBe('VERIFICATION_PENDING');
  });
});
