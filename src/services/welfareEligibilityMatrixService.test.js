import { describe, it, expect } from 'vitest';
import {
  WELFARE_SCHEMES,
  evaluateCitizenAcrossSchemes,
} from './welfareEligibilityMatrixService';

describe('welfareEligibilityMatrixService', () => {
  it('registers core central welfare schemes in the catalog', () => {
    expect(WELFARE_SCHEMES.length).toBeGreaterThanOrEqual(5);
    const ids = WELFARE_SCHEMES.map((s) => s.id);
    expect(ids).toContain('pm-jay');
    expect(ids).toContain('pm-kisan');
    expect(ids).toContain('pmay-u');
    expect(ids).toContain('ignoaps');
    expect(ids).toContain('sukanya');
  });

  it('qualifies low income household for Ayushman Bharat PM-JAY', () => {
    const results = evaluateCitizenAcrossSchemes({ annualIncome: 180000 });
    const pmjay = results.find((r) => r.schemeId === 'pm-jay');
    expect(pmjay.isEligible).toBe(true);
    expect(pmjay.matchStatus).toBe('ELIGIBLE');
  });

  it('rejects high income applicant from subsidized health coverage', () => {
    const results = evaluateCitizenAcrossSchemes({ annualIncome: 800000 });
    const pmjay = results.find((r) => r.schemeId === 'pm-jay');
    expect(pmjay.isEligible).toBe(false);
    expect(pmjay.reason).toContain('exceeds');
  });

  it('evaluates senior citizen pension (IGNOAPS) based on age threshold', () => {
    const senior = evaluateCitizenAcrossSchemes({ age: 67, annualIncome: 120000 });
    const young = evaluateCitizenAcrossSchemes({ age: 45, annualIncome: 120000 });
    expect(senior.find((r) => r.schemeId === 'ignoaps').isEligible).toBe(true);
    expect(young.find((r) => r.schemeId === 'ignoaps').isEligible).toBe(false);
  });

  it('qualifies farmers with agricultural land for PM-Kisan', () => {
    const farmer = evaluateCitizenAcrossSchemes({ occupation: 'farmer', annualIncome: 150000 });
    const urbanProfessional = evaluateCitizenAcrossSchemes({ occupation: 'salaried', annualIncome: 150000 });
    expect(farmer.find((r) => r.schemeId === 'pm-kisan').isEligible).toBe(true);
    expect(urbanProfessional.find((r) => r.schemeId === 'pm-kisan').isEligible).toBe(false);
  });

  it('evaluates Sukanya Samriddhi Yojana for girl child <= 10 years', () => {
    const girlChild = evaluateCitizenAcrossSchemes({ hasGirlChild: true, childAge: 6 });
    const olderGirl = evaluateCitizenAcrossSchemes({ hasGirlChild: true, childAge: 14 });
    expect(girlChild.find((r) => r.schemeId === 'sukanya').isEligible).toBe(true);
    expect(olderGirl.find((r) => r.schemeId === 'sukanya').isEligible).toBe(false);
  });
});
