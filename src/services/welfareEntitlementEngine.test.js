import { describe, it, expect } from 'vitest';
import {
  calculateCitizenEntitlements,
  formatInr,
  getServiceBenefitMetadata,
  calculateServiceBenefit,
} from './welfareEntitlementEngine';

describe('welfareEntitlementEngine - Calculation Rules', () => {
  it('correctly calculates DBT entitlements for small farmers', () => {
    const farmerProfile = {
      age: 45,
      annualIncome: 180000,
      occupation: 'farmer',
      isFarmer: true,
      category: 'OBC',
      hasPuccaHouse: true
    };

    const res = calculateCitizenEntitlements(farmerProfile);
    expect(res.eligibleCount).toBeGreaterThanOrEqual(2);
    expect(res.eligibleSchemes.some(s => s.id === 'pm-kisan')).toBe(true);
    expect(res.eligibleSchemes.some(s => s.id === 'ayushman-bharat')).toBe(true);
    expect(res.totalAnnualCash).toBeGreaterThanOrEqual(6000);
    expect(res.totalHealthCoverage).toBe(500000);
  });

  it('qualifies BPL seniors for Old Age Pension', () => {
    const seniorProfile = {
      age: 65,
      annualIncome: 90000,
      occupation: 'retired',
      category: 'SC',
      hasPuccaHouse: false
    };

    const res = calculateCitizenEntitlements(seniorProfile);
    expect(res.eligibleSchemes.some(s => s.id === 'nsap-old-age')).toBe(true);
    expect(res.eligibleSchemes.some(s => s.id === 'pm-awas-gramin')).toBe(true);
    expect(res.totalGrossAnnualValue).toBeGreaterThan(100000);
  });

  it('reimburses scholarships for eligible low-income students', () => {
    const studentProfile = {
      age: 20,
      annualIncome: 150000,
      occupation: 'student',
      isStudent: true,
      category: 'SC',
      hasPuccaHouse: true
    };

    const res = calculateCitizenEntitlements(studentProfile);
    expect(res.eligibleSchemes.some(s => s.id === 'post-matric-scholarship')).toBe(true);
    expect(res.totalAnnualCash).toBeGreaterThanOrEqual(24000);
  });

  it('formats currency correctly in Indian numbering system', () => {
    expect(formatInr(500000)).toContain('5,00,000');
    expect(formatInr(6000)).toContain('6,000');
  });

  describe('calculateServiceBenefit', () => {
    it('returns hasBenefit: false for purely administrative services', () => {
      const res = calculateServiceBenefit('driving-license');
      expect(res.hasBenefit).toBe(false);
      expect(res.serviceId).toBe('driving-license');
    });

    it('calculates full PM-KISAN cash entitlement for eligible farmer', () => {
      const res = calculateServiceBenefit('pm-kisan', {
        annualIncome: 200000,
        occupation: 'farmer',
        isFarmer: true,
      });

      expect(res.hasBenefit).toBe(true);
      expect(res.annualBenefitCash).toBe(6000);
      expect(res.disbursementFrequency).toContain('Quarterly');
      expect(res.installments.length).toBe(3);
      expect(res.eligibilityStatus).toBe('eligible');
      expect(res.statutoryRules.length).toBeGreaterThan(0);
    });

    it('flags ineligibility when reported income exceeds PM-KISAN limit', () => {
      const res = calculateServiceBenefit('pm-kisan', {
        annualIncome: 500000,
        occupation: 'farmer',
        isFarmer: true,
      });

      expect(res.hasBenefit).toBe(true);
      expect(res.eligibilityStatus).toBe('ineligible');
      expect(res.eligibilityReasons[0]).toMatch(/exceeds/i);
    });

    it('calculates in-kind foodgrain subsidy for NFSA ration card', () => {
      const res = calculateServiceBenefit('ration-card', {
        annualIncome: 120000,
      });

      expect(res.hasBenefit).toBe(true);
      expect(res.annualBenefitInKind).toBe(14400);
      expect(res.eligibilityStatus).toBe('eligible');
    });

    it('retrieves benefit metadata by service ID case-insensitively', () => {
      const meta = getServiceBenefitMetadata('PM-KISAN');
      expect(meta).not.toBeNull();
      expect(meta.schemeId).toBe('pm-kisan');
    });
  });
});
