import { describe, it, expect } from 'vitest';
import {
  diagnosePensionDiscrepancy,
  buildMaskedPensionStatement,
  exportPensionDiscrepancyDossier,
  getPensionEscalationHierarchy,
  UP_PENSION_SCHEMES,
  COMMON_DISCREPANCY_ROOT_CAUSES
} from './upPensionDiscrepancyService';

describe('upPensionDiscrepancyService', () => {
  it('should define UP pension schemes and root causes', () => {
    expect(UP_PENSION_SCHEMES.OLD_AGE_PENSION.monthlyRateINR).toBe(1000);
    expect(UP_PENSION_SCHEMES.WIDOW_PENSION.code).toBe('WIDOW_PENSION');
    expect(COMMON_DISCREPANCY_ROOT_CAUSES.LIFE_CERTIFICATE_LAPSED.code).toBe('LIFE_CERTIFICATE_LAPSED');
  });

  it('should diagnose pension delay and identify missing life certificate and NPCI unlinked bank', () => {
    const record = {
      schemeCode: 'OLD_AGE_PENSION',
      monthsDelayed: 6,
      hasUpdatedLifeCertificateThisYear: false,
      isBankAadhaarSeeded: false,
      pfmsStatus: 'REJECTED'
    };

    const diagnosis = diagnosePensionDiscrepancy(record);
    expect(diagnosis.hasDiscrepancy).toBe(true);
    expect(diagnosis.identifiedCauses.length).toBe(3);
    expect(diagnosis.identifiedCauses.some(c => c.code === 'LIFE_CERTIFICATE_LAPSED')).toBe(true);
    expect(diagnosis.identifiedCauses.some(c => c.code === 'NPCI_DBT_MAPPING_FAILED')).toBe(true);
    expect(diagnosis.identifiedCauses.some(c => c.code === 'PFMS_BENEFICIARY_REJECTED')).toBe(true);
  });

  it('should build masked pension statement protecting sensitive credentials', () => {
    const rawData = {
      schemeCode: 'WIDOW_PENSION',
      district: 'Prayagraj',
      pensionRegistrationNumber: 'UP1234567890',
      bankAccountNumber: '987654321098',
      bankName: 'State Bank of India',
      unpaidQuartersCount: 2
    };

    const statement = buildMaskedPensionStatement(rawData);
    expect(statement.maskedBankAccount).toBe('XXXX-XXXX-1098'); // only last 4 digits visible
    expect(statement.maskedPensionRegistrationNumber).toContain('XXXX');
    expect(statement.estimatedArrearsDueINR).toBe(6000); // 2 quarters * 3000
    expect(statement.caregiverAssisted).toBe(false);
  });

  it('should handle revocable caregiver assisted mode with consent', () => {
    const rawData = {
      schemeCode: 'OLD_AGE_PENSION',
      bankAccountNumber: '123456789999'
    };

    const caregiver = {
      isConsented: true,
      relationship: 'Son / Caregiver'
    };

    const statement = buildMaskedPensionStatement(rawData, caregiver);
    expect(statement.caregiverAssisted).toBe(true);
    expect(statement.caregiverDetails.relationship).toBe('Son / Caregiver');
    expect(statement.caregiverDetails.consentRecordedAt).toBeDefined();
  });

  it('should list UP pension escalation hierarchy', () => {
    const hierarchy = getPensionEscalationHierarchy();
    expect(hierarchy.length).toBe(3);
    expect(hierarchy[2].level).toBe('DISTRICT');
    expect(hierarchy[2].designation).toContain('DSWO');
  });

  it('should export formatted markdown representation dossier for DSWO', () => {
    const statement = {
      schemeName: 'UP Old Age Pension',
      department: 'Social Welfare Department, UP',
      district: 'Lucknow',
      maskedPensionRegistrationNumber: 'UP09XXXX89',
      bankName: 'Aryavart Bank',
      maskedBankAccount: 'XXXX-XXXX-4567',
      unpaidQuartersCount: 1,
      estimatedArrearsDueINR: 3000
    };

    const diagnosis = {
      identifiedCauses: [COMMON_DISCREPANCY_ROOT_CAUSES.LIFE_CERTIFICATE_LAPSED]
    };

    const doc = exportPensionDiscrepancyDossier(statement, diagnosis);
    expect(doc).toContain('# Uttar Pradesh Social Welfare Pension Discrepancy Statement');
    expect(doc).toContain('Lucknow');
    expect(doc).toContain('XXXX-XXXX-4567');
    expect(doc).toContain('Jeevan Pramaan');
    expect(doc).toContain('District Social Welfare Officer (DSWO)');
  });

  it('should return UP pension procedural FAQs', async () => {
    const { getPensionFaqs } = await import('./upPensionDiscrepancyService');
    const faqs = getPensionFaqs();
    expect(faqs.length).toBeGreaterThanOrEqual(4);
    expect(faqs[0].q).toContain('schedule of pension release');
    expect(faqs[3].a).toContain('India Post Payments Bank');
  });

  it('should validate invalid scheme error', () => {
    const res = diagnosePensionDiscrepancy({ schemeCode: 'INVALID_CODE' });
    expect(res.errors.length).toBeGreaterThan(0);
    expect(res.errors[0]).toContain('Valid UP Pension Scheme');
  });

  it('should detect annual reverification pending when specified', () => {
    const res = diagnosePensionDiscrepancy({
      schemeCode: 'DIVYANG_PENSION',
      monthsDelayed: 4,
      hasUpdatedLifeCertificateThisYear: true,
      isBankAadhaarSeeded: true,
      annualReverificationPending: true
    });
    expect(res.identifiedCauses.some(c => c.code === 'ANNUAL_REVERIFICATION_PENDING')).toBe(true);
  });
});
