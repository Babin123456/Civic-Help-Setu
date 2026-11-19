import { describe, it, expect } from 'vitest';
import {
  STATE_EWS_THRESHOLDS,
  RTE_CATEGORIES,
  MANDATORY_FREE_ENTITLEMENTS,
  evaluateRteEligibility,
  auditScreeningAndCapitation,
  reconcileFreeEntitlementOvercharges,
  generateRteSection32Petition,
} from './rteAdmissionService.js';

describe('rteAdmissionService', () => {
  describe('Static Constants & Thresholds', () => {
    it('defines state EWS income thresholds correctly', () => {
      expect(STATE_EWS_THRESHOLDS.DELHI.thresholdInr).toBe(100000);
      expect(STATE_EWS_THRESHOLDS.KARNATAKA.thresholdInr).toBe(350000);
      expect(STATE_EWS_THRESHOLDS.RAJASTHAN.thresholdInr).toBe(250000);
      expect(STATE_EWS_THRESHOLDS.DEFAULT.thresholdInr).toBe(100000);
    });

    it('defines RTE categories and identifies income proof requirement', () => {
      expect(RTE_CATEGORIES.EWS.requiresIncomeProof).toBe(true);
      expect(RTE_CATEGORIES.SC.requiresIncomeProof).toBe(false);
      expect(RTE_CATEGORIES.ST.requiresIncomeProof).toBe(false);
      expect(RTE_CATEGORIES.CWSN_DISABILITY.requiresIncomeProof).toBe(false);
      expect(RTE_CATEGORIES.ORPHAN_TRANSGENDER.requiresIncomeProof).toBe(false);
    });

    it('contains mandatory free entitlements under Section 3(2)', () => {
      expect(MANDATORY_FREE_ENTITLEMENTS.length).toBeGreaterThanOrEqual(6);
      expect(MANDATORY_FREE_ENTITLEMENTS.some((item) => item.id === 'tuition_fee')).toBe(true);
      expect(MANDATORY_FREE_ENTITLEMENTS.some((item) => item.id === 'textbooks_workbooks')).toBe(true);
      expect(MANDATORY_FREE_ENTITLEMENTS.some((item) => item.id === 'school_uniform')).toBe(true);
    });
  });

  describe('evaluateRteEligibility', () => {
    it('accurately evaluates an eligible EWS applicant within 1 km', () => {
      const result = evaluateRteEligibility({
        stateKey: 'DELHI',
        categoryKey: 'EWS',
        annualIncomeInr: 80000,
        distanceKm: 0.8,
        childAgeYears: 6,
        targetGrade: 'class_1',
        documents: {
          proofOfResidence: true,
          proofOfAge: true,
          incomeCertificate: true,
        },
      });

      expect(result.isEligible).toBe(true);
      expect(result.isIncomeEligible).toBe(true);
      expect(result.catchment.id).toBe('ZONE_1');
      expect(result.missingDocs.length).toBe(0);
      expect(result.statutoryScore).toBeGreaterThanOrEqual(85);
    });

    it('disqualifies EWS applicant when income exceeds state threshold', () => {
      const result = evaluateRteEligibility({
        stateKey: 'DELHI',
        categoryKey: 'EWS',
        annualIncomeInr: 150000, // exceeds 1 Lakh in Delhi
        distanceKm: 0.5,
        childAgeYears: 6,
        targetGrade: 'class_1',
        documents: {
          proofOfResidence: true,
          proofOfAge: true,
          incomeCertificate: true,
        },
      });

      expect(result.isEligible).toBe(false);
      expect(result.isIncomeEligible).toBe(false);
    });

    it('does not require income proof for SC/ST or CwSN categories', () => {
      const result = evaluateRteEligibility({
        stateKey: 'MAHARASHTRA',
        categoryKey: 'SC',
        annualIncomeInr: 400000, // income should not bar SC category
        distanceKm: 1.2,
        childAgeYears: 6,
        targetGrade: 'class_1',
        documents: {
          proofOfResidence: true,
          proofOfAge: true,
          categoryCertificate: true,
        },
      });

      expect(result.isEligible).toBe(true);
      expect(result.isIncomeEligible).toBe(true);
      expect(result.catchment.id).toBe('ZONE_2');
    });

    it('detects missing documents and lists them in missingDocs', () => {
      const result = evaluateRteEligibility({
        stateKey: 'KARNATAKA',
        categoryKey: 'EWS',
        annualIncomeInr: 200000,
        distanceKm: 0.5,
        childAgeYears: 6,
        targetGrade: 'class_1',
        documents: {},
      });

      expect(result.missingDocs.length).toBeGreaterThan(0);
      expect(result.allDocumentsPresent).toBe(false);
    });
  });

  describe('auditScreeningAndCapitation', () => {
    it('returns compliant when no screening or capitation fee is demanded', () => {
      const result = auditScreeningAndCapitation({
        childWrittenTest: false,
        childOralInterview: false,
        parentInterview: false,
        parentQualificationAudit: false,
        capitationFeeDemandedInr: 0,
        isSubsequentViolation: false,
      });

      expect(result.hasViolations).toBe(false);
      expect(result.severity).toBe('COMPLIANT');
      expect(result.totalStatutoryPenalLiabilityInr).toBe(0);
    });

    it('calculates 10x capitation fine and screening penalty for first-time offense', () => {
      const result = auditScreeningAndCapitation({
        childWrittenTest: true,
        parentInterview: true,
        capitationFeeDemandedInr: 25000,
        isSubsequentViolation: false,
      });

      expect(result.hasViolations).toBe(true);
      expect(result.screeningViolationCount).toBe(2);
      expect(result.capitationDemandedInr).toBe(25000);
      expect(result.statutoryCapitationFineInr).toBe(250000); // 10x 25,000 = 2,50,000
      expect(result.statutoryScreeningFineInr).toBe(25000); // 1st violation
      expect(result.totalStatutoryPenalLiabilityInr).toBe(275000);
      expect(result.severity).toBe('CRITICAL');
    });

    it('applies Rs 50,000 screening fine for subsequent repeat contravention', () => {
      const result = auditScreeningAndCapitation({
        childOralInterview: true,
        capitationFeeDemandedInr: 0,
        isSubsequentViolation: true,
      });

      expect(result.statutoryScreeningFineInr).toBe(50000);
      expect(result.totalStatutoryPenalLiabilityInr).toBe(50000);
      expect(result.severity).toBe('HIGH');
    });
  });

  describe('reconcileFreeEntitlementOvercharges', () => {
    it('identifies illegal auxiliary charges and calculates net overcharge', () => {
      const feeItems = [
        { id: 'tuition_fee', label: 'Tuition Fee', billedInr: 12000 },
        { id: 'textbooks_workbooks', label: 'Prescribed Textbooks', billedInr: 3500 },
        { id: 'school_uniform', label: 'Uniform & Shoes', billedInr: 4500 },
      ];

      const result = reconcileFreeEntitlementOvercharges(feeItems);
      expect(result.hasOvercharges).toBe(true);
      expect(result.totalBilledInr).toBe(20000);
      expect(result.totalIllegalOverchargeInr).toBe(20000);
      expect(result.markupPercentage).toBe(100);
      expect(result.lineAudits.length).toBe(3);
    });

    it('returns zero overcharge when no auxiliary fee is billed', () => {
      const feeItems = [
        { id: 'tuition_fee', label: 'Tuition Fee', billedInr: 0 },
      ];

      const result = reconcileFreeEntitlementOvercharges(feeItems);
      expect(result.hasOvercharges).toBe(false);
      expect(result.totalIllegalOverchargeInr).toBe(0);
    });
  });

  describe('generateRteSection32Petition', () => {
    it('generates a full statutory petition text citing Section 32 and landmark case', () => {
      const petition = generateRteSection32Petition({
        childName: 'Aarav Kumar',
        dateOfBirth: '2020-04-15',
        guardianName: 'Ramesh Kumar',
        contactPhone: '9876543210',
        residentialAddress: 'House 44, Karol Bagh',
        allotmentSlipId: 'RTE-DEL-2026-9901',
        category: 'Economically Weaker Section (EWS)',
        targetGrade: 'Class 1',
        schoolName: 'St. Marks Academy',
        schoolAddress: 'Road 5, New Delhi',
        blockName: 'Central Zone',
        districtName: 'Central Delhi',
        stateName: 'Delhi',
        screeningData: {
          hasViolations: true,
          violations: [{ name: 'Prohibited Child Interview' }],
          capitationDemandedInr: 10000,
          totalStatutoryPenalLiabilityInr: 125000,
        },
        billingData: {
          hasOvercharges: true,
          totalIllegalOverchargeInr: 8000,
        },
        denialReason: 'Demanded Rs 10,000 donation and Rs 8,000 for books before admission',
      });

      expect(petition).toContain('SECTION 32 OF THE RIGHT OF CHILDREN TO FREE AND COMPULSORY EDUCATION');
      expect(petition).toContain('Aarav Kumar');
      expect(petition).toContain('St. Marks Academy');
      expect(petition).toContain('RTE-DEL-2026-9901');
      expect(petition).toContain('Society for Unaided Private Schools of Rajasthan');
      expect(petition).toContain('INR 1,25,000');
      expect(petition).toContain('INR 8,000');
      expect(petition).toContain('Section 18(3)');
    });
  });
});
