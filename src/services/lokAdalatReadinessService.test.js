import { describe, it, expect } from 'vitest';
import {
  assessLokAdalatReadiness,
  getLokAdalatNextSteps,
  exportLokAdalatDossier,
  validateSettlementDocuments,
  LOK_ADALAT_STAGES,
  SUITABLE_CASE_CATEGORIES,
  STATUTORY_AWARD_FACTS
} from './lokAdalatReadinessService';

describe('lokAdalatReadinessService', () => {
  it('should define statutory facts and non-appealable award under Section 21', () => {
    expect(STATUTORY_AWARD_FACTS.appealability).toContain('No appeal shall lie');
    expect(STATUTORY_AWARD_FACTS.natureOfAward).toContain('decree of a civil court');
    expect(STATUTORY_AWARD_FACTS.courtFeeRefund).toContain('refunded');
  });

  it('should accurately assess pre-litigation bank settlement case', () => {
    const caseDetails = {
      title: 'Housing Loan Overdue Reconciliation',
      disputeSummary: 'Dispute over penal interest calculation on educational loan recovery of ₹2.4 Lakhs.',
      matterCategory: 'BANK_LOAN_RECOVERY',
      stage: 'PRE_LITIGATION',
      willingToCompromise: true
    };

    const res = assessLokAdalatReadiness(caseDetails);
    expect(res.isEligible).toBe(true);
    expect(res.category.code).toBe('BANK_RECOVERY');
    expect(res.stage.code).toBe('PRE_LITIGATION');
    expect(res.errors).toHaveLength(0);
    expect(res.nextSteps.length).toBeGreaterThanOrEqual(4);
  });

  it('should bar non-compoundable criminal offenses under Section 19(5) proviso', () => {
    const caseDetails = {
      title: 'Criminal Trial IPC 302',
      disputeSummary: 'Non-compoundable serious criminal matter',
      matterCategory: 'NON_COMPOUNDABLE_CRIMINAL',
      stage: 'PENDING_CASE'
    };

    const res = assessLokAdalatReadiness(caseDetails);
    expect(res.isEligible).toBe(false);
    expect(res.errors.some(e => e.includes('Section 19(5) proviso'))).toBe(true);
  });

  it('should warn when voluntary compromise willingness is absent', () => {
    const caseDetails = {
      title: 'Motor Accident Claim MACT',
      disputeSummary: 'Accident claim dispute with insurance company for ₹8 Lakh compensation.',
      matterCategory: 'MOTOR_ACCIDENT_MACT',
      stage: 'PENDING_CASE',
      willingToCompromise: false
    };

    const res = assessLokAdalatReadiness(caseDetails);
    expect(res.isEligible).toBe(true);
    expect(res.warnings.some(w => w.includes('Voluntary compromise'))).toBe(true);
  });

  it('should validate settlement documents completeness', () => {
    const valid = validateSettlementDocuments(['ID_PROOF', 'CASE_PAPERS', 'COMPROMISE_TERMS']);
    expect(valid.isReady).toBe(true);
    expect(valid.missingMandatory).toHaveLength(0);

    const invalid = validateSettlementDocuments(['ID_PROOF']);
    expect(invalid.isReady).toBe(false);
    expect(invalid.missingMandatory.length).toBeGreaterThan(0);
  });

  it('should format full markdown dossier with essential principles', () => {
    const caseDetails = {
      title: 'Cheque Dishonour NI Act 138 Case',
      disputeSummary: 'Cheque bounce for ₹75,000 between local traders pending before ACJM Court.',
      matterCategory: 'CHEQUE_BOUNCE_NI_138',
      stage: 'PENDING_CASE',
      courtCaseNumber: 'CC/1042/2023',
      willingToCompromise: true
    };

    const doc = exportLokAdalatDossier(caseDetails);
    expect(doc).toContain('# Lok Adalat Settlement-Readiness Dossier');
    expect(doc).toContain('Cheque Bounce Cases (Section 138 NI Act)');
    expect(doc).toContain('Mutual Consent Principle');
    expect(doc).toContain('Finality (Section 21)');
    expect(doc).toContain('SUITABLE FOR LOK ADALAT CONCILIATION');
  });
});
