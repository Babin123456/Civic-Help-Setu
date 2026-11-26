import { describe, it, expect } from 'vitest';
import {
  PATIENT_RIGHTS_CHARTER,
  STANDARD_TARIFF_CEILINGS,
  evaluateEmergencyCareCompliance,
  analyzeHospitalBilling,
  generateDistrictRegisteringAuthorityComplaint,
} from './clinicalEstablishmentService.js';

describe('clinicalEstablishmentService', () => {
  describe('Static Constants', () => {
    it('defines 6 core patient rights with statutory citations', () => {
      expect(PATIENT_RIGHTS_CHARTER.RIGHT_TO_EMERGENCY_TREATMENT.statutoryRef).toContain('Section 56');
      expect(PATIENT_RIGHTS_CHARTER.RIGHT_AGAINST_DETAINMENT.statutoryRef).toContain('Sanjay Prajapati');
      expect(PATIENT_RIGHTS_CHARTER.RIGHT_TO_MEDICAL_RECORDS.statutoryRef).toContain('Code of Ethics');
      expect(PATIENT_RIGHTS_CHARTER.RIGHT_TO_TRANSPARENT_RATES.statutoryRef).toContain('Section 12(2)(o)');
    });

    it('defines standard procedure and bed ceilings with NPPA caps', () => {
      expect(STANDARD_TARIFF_CEILINGS.CARDIAC_STENT_DES.standardCeilingInr).toBe(30080);
      expect(STANDARD_TARIFF_CEILINGS.ICU_BED_PER_DAY.standardCeilingInr).toBe(4500);
      expect(STANDARD_TARIFF_CEILINGS.NORMAL_DELIVERY_PACKAGE.standardCeilingInr).toBe(15000);
    });
  });

  describe('evaluateEmergencyCareCompliance', () => {
    it('evaluates fully compliant emergency response', () => {
      const result = evaluateEmergencyCareCompliance({
        hospitalName: 'Apollo City Hospital',
        emergencyType: 'Acute Myocardial Infarction',
        refusedTriageOrStabilization: false,
        conditionalOnAdvanceDeposit: false,
        detainedPatientOrMortalRemains: false,
        withheldMedicalRecords: false,
      });

      expect(result.isCompliant).toBe(true);
      expect(result.severityScore).toBe(0);
      expect(result.violations.length).toBe(0);
    });

    it('catches emergency refusal, advance deposit extortion, and body detainment', () => {
      const result = evaluateEmergencyCareCompliance({
        hospitalName: 'Metro Superspecialty Hospital',
        emergencyType: 'Severe Polytrauma',
        advanceDemandedInr: 150000,
        refusedTriageOrStabilization: true,
        conditionalOnAdvanceDeposit: true,
        detainedPatientOrMortalRemains: true,
        withheldMedicalRecords: true,
      });

      expect(result.isCompliant).toBe(false);
      expect(result.severityScore).toBe(100);
      expect(result.violations.length).toBe(4);
      expect(result.violations[0].rule).toContain('Section 56');
    });
  });

  describe('analyzeHospitalBilling', () => {
    it('accurately computes overcharges and markup percentage against standard caps', () => {
      const lineItems = [
        { tariffKey: 'ICU_BED_PER_DAY', daysOrUnits: 4, invoicedAmountInr: 32000 }, // 4 * 4500 = 18000 -> 14000 overcharge
        { tariffKey: 'CARDIAC_STENT_DES', daysOrUnits: 1, invoicedAmountInr: 65000 }, // NPPA cap 30080 -> 34920 overcharge
      ];

      const analysis = analyzeHospitalBilling(lineItems);
      expect(analysis.hasOvercharge).toBe(true);
      expect(analysis.totalInvoicedInr).toBe(97000);
      expect(analysis.totalStatutoryCeilingInr).toBe(48080);
      expect(analysis.totalOverchargeInr).toBe(48920);
      expect(analysis.overchargePercent).toBeGreaterThan(100);
      expect(analysis.itemsAnalysis.length).toBe(2);
    });

    it('handles empty line items gracefully', () => {
      const analysis = analyzeHospitalBilling([]);
      expect(analysis.totalInvoicedInr).toBe(0);
      expect(analysis.hasOvercharge).toBe(false);
    });
  });

  describe('generateDistrictRegisteringAuthorityComplaint', () => {
    it('generates formal complaint memorandum with financial audit', () => {
      const text = generateDistrictRegisteringAuthorityComplaint({
        patient: { name: 'Vinod Sharma', address: 'B-201 Green Valley', contact: '9812345678' },
        hospitalName: 'CareMax Hospital',
        district: 'Pune',
        state: 'Maharashtra',
        ipdNumber: 'IPD-88902',
        compliance: {
          violations: [
            { rule: 'Section 56 CEA 2010', violation: 'Refusal of emergency stabilization', legalImpact: 'License cancellation' },
          ],
        },
        billingAnalysis: {
          totalInvoicedInr: 120000,
          totalStatutoryCeilingInr: 70000,
          totalOverchargeInr: 50000,
          overchargePercent: 71.4,
        },
      });

      expect(text).toContain('SECTION 41 & 42 OF THE CLINICAL ESTABLISHMENTS');
      expect(text).toContain('Vinod Sharma');
      expect(text).toContain('CareMax Hospital');
      expect(text).toContain('Pune');
      expect(text).toContain('Rs. 50,000');
      expect(text).toContain('Parmanand Katara');
    });
  });
});
