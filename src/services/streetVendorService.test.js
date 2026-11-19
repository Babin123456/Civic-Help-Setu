import { describe, it, expect } from 'vitest';
import {
  VENDOR_CATEGORIES,
  VENDING_ZONE_TYPES,
  SEIZURE_BENCHMARKS,
  evaluateEvictionImmunity,
  reconcileGoodsSeizure,
  auditRelocationCompliance,
  generateSection20GrievancePetition,
} from './streetVendorService.js';

describe('streetVendorService', () => {
  describe('Static Constants & Vending Zones', () => {
    it('defines statutory vending categories under Section 2(m)', () => {
      expect(VENDOR_CATEGORIES.STATIONARY.id).toBe('STATIONARY');
      expect(VENDOR_CATEGORIES.MOBILE.id).toBe('MOBILE');
      expect(VENDOR_CATEGORIES.WEEKLY_HAAT.id).toBe('WEEKLY_HAAT');
    });

    it('defines zone types and seizure benchmarks under Section 19', () => {
      expect(VENDING_ZONE_TYPES.RESTRICTION_FREE.id).toBe('RESTRICTION_FREE');
      expect(SEIZURE_BENCHMARKS.PERISHABLE_RELEASE_DAYS).toBe(2);
      expect(SEIZURE_BENCHMARKS.MAX_PERISHABLE_FEE_INR).toBe(300);
    });
  });

  describe('evaluateEvictionImmunity', () => {
    it('confirms absolute statutory immunity under Section 3(3) when TVC survey is incomplete', () => {
      const result = evaluateEvictionImmunity({
        tvcSurveyCompleted: false,
        vendingCertificateIssued: false,
        hasSurveySlipOrReceipt: true,
        yearsVendingAtLocation: 4,
        zoneTypeKey: 'RESTRICTION_FREE',
      });

      expect(result.hasAbsoluteStatutoryImmunity).toBe(true);
      expect(result.immunityStrength).toBe('ABSOLUTE');
      expect(result.violationsIfEvicted.length).toBeGreaterThan(0);
      expect(result.violationsIfEvicted[0].section).toContain('Section 3(3)');
    });

    it('protects registered vendor holding certificate of vending', () => {
      const result = evaluateEvictionImmunity({
        tvcSurveyCompleted: true,
        vendingCertificateIssued: true,
        hasSurveySlipOrReceipt: true,
        yearsVendingAtLocation: 6,
        zoneTypeKey: 'RESTRICTED',
      });

      expect(result.hasAbsoluteStatutoryImmunity).toBe(false);
      expect(result.immunityStrength).toBe('CERTIFICATE_PROTECTED');
    });
  });

  describe('reconcileGoodsSeizure', () => {
    it('audits illegal confiscation with damaged perishables and extortionate holding fees', () => {
      const result = reconcileGoodsSeizure({
        inventoryMemoIssued: false,
        perishableStockValueInr: 4000,
        nonPerishableStockValueInr: 6000,
        cartEquipmentValueInr: 15000,
        seizureHoldingDays: 4, // > 2 days -> perishable damages
        fineDemandedInr: 5000, // exceeds 1300 max holding cap
      });

      expect(result.isIllegalSeizure).toBe(true);
      expect(result.violations.length).toBeGreaterThanOrEqual(3);
      expect(result.perishableDamagesInr).toBe(4000);
      expect(result.illegalFineOverchargeInr).toBe(5000 - 1300);
      expect(result.totalRestitutionClaimInr).toBe(4000 + 3700);
      expect(result.totalSeizedAssetValueInr).toBe(25000);
    });

    it('handles legitimate seizure with proper memo and timely release', () => {
      const result = reconcileGoodsSeizure({
        inventoryMemoIssued: true,
        perishableStockValueInr: 2000,
        nonPerishableStockValueInr: 3000,
        cartEquipmentValueInr: 8000,
        seizureHoldingDays: 1, // within 2-day limit
        fineDemandedInr: 800, // below 1300 cap
      });

      expect(result.isIllegalSeizure).toBe(false);
      expect(result.totalRestitutionClaimInr).toBe(0);
    });
  });

  describe('auditRelocationCompliance', () => {
    it('catches illegal relocation lacking 30 days notice or alternative natural market', () => {
      const result = auditRelocationCompliance({
        noticeDaysGiven: 7, // < 30 days
        alternativeSiteAllocated: false,
        tvcConsulted: false,
      });

      expect(result.isIllegalRelocation).toBe(true);
      expect(result.violations.length).toBe(3);
      expect(result.status).toBe('UNLAWFUL_RELOCATION');
    });
  });

  describe('generateSection20GrievancePetition', () => {
    it('generates statutory legal appeal citing Section 20, Section 3(3) and landmark ruling', () => {
      const petition = generateSection20GrievancePetition({
        vendorName: 'Mohammad Rafiq',
        vendingCategory: 'Mobile Vendor (Push Cart / Thela)',
        vendingPitchLocation: 'Lajpat Nagar Central Market',
        yearsActive: 8,
        wardNumber: 'Ward 54',
        zoneName: 'South Zone',
        municipalityName: 'Municipal Corporation of Delhi (MCD)',
        contactPhone: '9811223344',
        immunityData: {
          hasAbsoluteStatutoryImmunity: true,
        },
        goodsSeizureData: {
          isIllegalSeizure: true,
          totalSeizedAssetValueInr: 22000,
          totalRestitutionClaimInr: 6500,
          violations: [{ rule: 'Section 19', issue: 'Missing memo' }],
        },
        relocationData: {
          isIllegalRelocation: true,
        },
        grievanceSummary: 'Confiscated cart and crushed perishable fruits without memo',
      });

      expect(petition).toContain('SECTION 20 OF THE STREET VENDORS');
      expect(petition).toContain('Mohammad Rafiq');
      expect(petition).toContain('Maharashtra Ekta Hawkers Union');
      expect(petition).toContain('Lajpat Nagar Central Market');
      expect(petition).toContain('INR 6,500');
      expect(petition).toContain('Section 4');
    });
  });
});
