import { describe, it, expect, beforeEach } from 'vitest';
import { ScholarshipNavigatorService } from './scholarshipNavigatorService.js';

describe('ScholarshipNavigatorService', () => {
  let service;

  beforeEach(() => {
    service = new ScholarshipNavigatorService();
  });

  it('filters scholarships by state and demographic', () => {
    const results = service.filterScholarships({
      state: 'IN-KA',
      demographic: 'SC'
    });
    expect(results.length).toBeGreaterThanOrEqual(2);
    const ids = results.map(r => r.id);
    expect(ids).toContain('sch_post_matric_sc_st');
    expect(ids).toContain('sch_karnataka_ssp_post_matric');
  });

  it('evaluates student profile and identifies positive eligibility factors', () => {
    const studentProfile = {
      state: 'IN-KA',
      demographic: 'SC',
      annualFamilyIncomeINR: 180000,
      course: 'Engineering'
    };

    const evaluated = service.evaluateEligibility(studentProfile);
    const ssp = evaluated.find(e => e.scholarshipId === 'sch_karnataka_ssp_post_matric');

    expect(ssp).toBeDefined();
    expect(ssp.eligibilityStatus).toBe('LIKELY_ELIGIBLE');
    expect(ssp.positiveFactors.length).toBeGreaterThan(2);
    expect(ssp.negativeFactors.length).toBe(0);
    expect(ssp.missingInformation.length).toBe(0);
  });

  it('flags ineligibility when income exceeds scheme threshold', () => {
    const wealthyStudent = {
      state: 'IN-KA',
      demographic: 'SC',
      annualFamilyIncomeINR: 500000,
      course: 'B.Tech'
    };

    const evaluated = service.evaluateEligibility(wealthyStudent);
    const scst = evaluated.find(e => e.scholarshipId === 'sch_post_matric_sc_st');

    expect(scst.eligibilityStatus).toBe('INELIGIBLE');
    expect(scst.negativeFactors[0]).toContain('exceeds limit');
  });

  it('indicates missing info when key demographic or income criteria are absent', () => {
    const partialProfile = {
      state: 'IN-KA'
    };

    const evaluated = service.evaluateEligibility(partialProfile);
    const scst = evaluated.find(e => e.scholarshipId === 'sch_post_matric_sc_st');

    expect(scst.eligibilityStatus).toBe('MORE_INFO_NEEDED');
    expect(scst.missingInformation.length).toBeGreaterThan(0);
  });

  it('generates a personalized document checklist without storing state', () => {
    const checklist = service.generatePersonalizedChecklist('sch_post_matric_sc_st');
    expect(checklist.title).toContain('Post-Matric Scholarship');
    expect(checklist.requiredDocuments.length).toBeGreaterThanOrEqual(4);
    expect(checklist.portal.url).toBe('https://scholarships.gov.in');
    expect(checklist.plainLanguageAdvice).toContain('NPCI');
  });
});
