import { describe, it, expect } from 'vitest';
import {
  evaluateLegalAidEntitlement,
  buildLegalAidVisitDossier,
  exportLegalAidDossier,
  NALSA_STATUTORY_CATEGORIES,
  DEFAULT_STATE_INCOME_CEILINGS,
  MANDATORY_LEGAL_AID_SERVICES
} from './nalsaLegalAidDiscoveryService';

describe('nalsaLegalAidDiscoveryService', () => {
  it('should recognize means-test exempt categories under Section 12', () => {
    const womenApplicant = {
      applicantName: 'Ananya Mukherjee',
      category: 'WOMEN_CHILDREN',
      state: 'WEST_BENGAL'
    };

    const res = evaluateLegalAidEntitlement(womenApplicant);
    expect(res.isEntitled).toBe(true);
    expect(res.matchedCategory.code).toBe('WOMEN_CHILDREN');
    expect(res.entitlementReason).toContain('Section 12(c)');
    expect(res.nalsaNationalHelpline).toBe('15100');
  });

  it('should evaluate income-tested applicants under Section 12(h)', () => {
    // Within ceiling
    const eligibleApplicant = {
      applicantName: 'Manoj Paswan',
      category: 'INCOME_ELIGIBLE',
      annualIncome: 120000,
      state: 'BIHAR'
    };
    const resEligible = evaluateLegalAidEntitlement(eligibleApplicant);
    expect(resEligible.isEntitled).toBe(true);
    expect(resEligible.stateCeiling).toBe(150000);

    // Exceeding ceiling
    const highIncomeApplicant = {
      applicantName: 'Rajesh Khanna',
      category: 'INCOME_ELIGIBLE',
      annualIncome: 450000,
      state: 'MAHARASHTRA'
    };
    const resHigh = evaluateLegalAidEntitlement(highIncomeApplicant);
    expect(resHigh.isEntitled).toBe(false);
    expect(resHigh.warnings.length).toBeGreaterThan(0);
  });

  it('should flag errors when name or category is missing', () => {
    const invalidApp = {
      applicantName: '',
      category: 'INVALID_CATEGORY'
    };
    const res = evaluateLegalAidEntitlement(invalidApp);
    expect(res.isEntitled).toBe(false);
    expect(res.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('should construct a comprehensive DLSA visit dossier', () => {
    const dossier = buildLegalAidVisitDossier({
      district: 'Pune',
      state: 'Maharashtra',
      matterType: 'Maintenance / Domestic Dispute'
    });

    expect(dossier.authority).toContain('DLSA');
    expect(dossier.authority).toContain('Pune');
    expect(dossier.checklistForVisit.length).toBeGreaterThanOrEqual(4);
    expect(dossier.procedure.length).toBeGreaterThanOrEqual(4);
    expect(dossier.entitledServices).toEqual(MANDATORY_LEGAL_AID_SERVICES);
  });

  it('should export formatted markdown report', () => {
    const app = {
      applicantName: 'Fatima Khatun',
      district: 'Murshidabad',
      state: 'West Bengal',
      category: 'WOMEN_CHILDREN',
      matterType: 'Matrimonial / Property'
    };

    const doc = exportLegalAidDossier(app);
    expect(doc).toContain('# National Legal Services Authority (NALSA) Free Legal-Aid Dossier');
    expect(doc).toContain('Fatima Khatun');
    expect(doc).toContain('Murshidabad');
    expect(doc).toContain('CONFIRMED ELIGIBLE UNDER SECTION 12');
    expect(doc).toContain('15100');
  });
});
