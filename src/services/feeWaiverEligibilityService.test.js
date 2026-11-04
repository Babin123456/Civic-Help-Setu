import { describe, it, expect } from 'vitest';
import {
  CONCESSION_CATEGORIES,
  CONCESSION_METADATA,
  parseServiceStandardFee,
  resolveServiceSpecificConcession,
  evaluateFeeWaiverEligibility,
} from './feeWaiverEligibilityService.js';

describe('feeWaiverEligibilityService (#433)', () => {
  describe('parseServiceStandardFee', () => {
    it('extracts numeric fee from string like "₹50"', () => {
      expect(parseServiceStandardFee({ fees: '₹50' })).toBe(50);
      expect(parseServiceStandardFee({ fee: 'Rs. 100' })).toBe(100);
    });

    it('returns 0 for free services', () => {
      expect(parseServiceStandardFee({ fees: 'Free' })).toBe(0);
      expect(parseServiceStandardFee({ fees: 'Nil / No fee' })).toBe(0);
    });

    it('accepts direct numbers', () => {
      expect(parseServiceStandardFee({ fee: 35 })).toBe(35);
    });

    it('defaults to 50 when fee is omitted or invalid', () => {
      expect(parseServiceStandardFee({})).toBe(50);
      expect(parseServiceStandardFee(null)).toBe(50);
    });
  });

  describe('resolveServiceSpecificConcession', () => {
    it('grants 100% waiver to BPL applicants for RTI requests under Sec 7(5)', () => {
      const service = { id: 'public-grievance', name: 'RTI Application Online' };
      const res = resolveServiceSpecificConcession(service, CONCESSION_CATEGORIES.BPL_ANTYODAYA);
      expect(res.waiverPercent).toBe(100);
      expect(res.customCitation).toContain('RTI Act 2005 Section 7(5)');
    });

    it('grants 100% waiver to PwD applicants for income and caste certificates', () => {
      const service = { id: 'income-cert', name: 'Income Certificate' };
      const res = resolveServiceSpecificConcession(service, CONCESSION_CATEGORIES.PWD_DIVYANG);
      expect(res.waiverPercent).toBe(100);
      expect(res.customCitation).toContain('Priority Households & PwD');
    });

    it('returns 0% default for General category', () => {
      const service = { id: 'passport', name: 'Passport Renewal' };
      const res = resolveServiceSpecificConcession(service, CONCESSION_CATEGORIES.GENERAL);
      expect(res.waiverPercent).toBe(0);
    });
  });

  describe('evaluateFeeWaiverEligibility', () => {
    it('evaluates complete fee waiver for BPL on a ₹50 service', () => {
      const service = { id: 'ration-card', name: 'Ration Card Member Addition', fees: '₹50' };
      const report = evaluateFeeWaiverEligibility({
        service,
        category: CONCESSION_CATEGORIES.BPL_ANTYODAYA,
      });

      expect(report.standardFee).toBe(50);
      expect(report.waiverPercent).toBe(100);
      expect(report.waivedAmount).toBe(50);
      expect(report.netPayableFee).toBe(0);
      expect(report.isFullyExempt).toBe(true);
      expect(report.isPartiallyConcessional).toBe(false);
      expect(report.requiredProof).toContain('BPL');
      expect(report.advice).toContain('100% statutory fee exemption');
      expect(report.safetyTip).toContain('Never hand over original');
    });

    it('evaluates partial 50% concession for Senior Citizens', () => {
      const service = { id: 'driving-license', name: 'Driving License Renewal', fee: 200 };
      const report = evaluateFeeWaiverEligibility({
        service,
        category: CONCESSION_CATEGORIES.SENIOR_CITIZEN,
      });

      expect(report.standardFee).toBe(200);
      expect(report.waiverPercent).toBe(50);
      expect(report.waivedAmount).toBe(100);
      expect(report.netPayableFee).toBe(100);
      expect(report.isFullyExempt).toBe(false);
      expect(report.isPartiallyConcessional).toBe(true);
      expect(report.requiredProof).toContain('DOB');
    });

    it('handles free services cleanly', () => {
      const service = { id: 'pm-kisan', name: 'PM-Kisan Scheme', fees: 'Free' };
      const report = evaluateFeeWaiverEligibility({
        service,
        category: CONCESSION_CATEGORIES.GENERAL,
      });

      expect(report.standardFee).toBe(0);
      expect(report.netPayableFee).toBe(0);
      expect(report.advice).toContain('free of charge');
    });

    it('supports custom fee overrides', () => {
      const service = { id: 'custom-service', name: 'Special Municipal Verification' };
      const report = evaluateFeeWaiverEligibility({
        service,
        category: CONCESSION_CATEGORIES.STUDENT,
        customFee: 300,
      });

      expect(report.standardFee).toBe(300);
      expect(report.waivedAmount).toBe(150);
      expect(report.netPayableFee).toBe(150);
    });
  });
});
