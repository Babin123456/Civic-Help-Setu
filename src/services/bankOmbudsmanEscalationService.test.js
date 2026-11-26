import { describe, it, expect, beforeEach } from 'vitest';
import { BankOmbudsmanEscalationService } from './bankOmbudsmanEscalationService.js';

describe('BankOmbudsmanEscalationService', () => {
  let service;

  beforeEach(() => {
    service = new BankOmbudsmanEscalationService();
  });

  it('blocks escalation when customer did not complain to bank first', () => {
    const context = {
      lodgedWithBankFirst: false
    };

    const evaluation = service.evaluateEscalationReadiness(context);
    expect(evaluation.isReadyForOmbudsman).toBe(false);
    expect(evaluation.blockers[0].code).toBe('PREREQUISITE_BANK_COMPLAINT_MISSING');
  });

  it('blocks escalation when 30 days have not elapsed and no final rejection issued', () => {
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 10); // 10 days ago

    const context = {
      lodgedWithBankFirst: true,
      bankComplaintDate: recentDate.toISOString(),
      bankGaveFinalRejection: false
    };

    const evaluation = service.evaluateEscalationReadiness(context);
    expect(evaluation.isReadyForOmbudsman).toBe(false);
    expect(evaluation.blockers[0].code).toBe('STATUTORY_30_DAY_WINDOW_PENDING');
  });

  it('permits escalation when 30 days elapsed or when bank rejected grievance', () => {
    const context = {
      lodgedWithBankFirst: true,
      bankComplaintDate: '2026-01-01',
      bankGaveFinalRejection: true,
      rejectionDate: '2026-01-15'
    };

    const evaluation = service.evaluateEscalationReadiness(context);
    expect(evaluation.isReadyForOmbudsman).toBe(true);
    expect(evaluation.status).toBe('READY_FOR_ESCALATION');
    expect(evaluation.cmsPortalUrl).toBe('https://cms.rbi.org.in');
  });

  it('blocks matters pending in court or consumer commission', () => {
    const context = {
      lodgedWithBankFirst: true,
      bankComplaintDate: '2026-01-01',
      isPendingInCourtOrConsumerForum: true
    };

    const evaluation = service.evaluateEscalationReadiness(context);
    expect(evaluation.isReadyForOmbudsman).toBe(false);
    expect(evaluation.blockers.some(b => b.code === 'PARALLEL_JUDICIAL_PROCEEDING')).toBe(true);
  });

  it('generates an evidence checklist and dossier with statutory penalty notes', () => {
    const dossier = service.generateEscalationDossier({
      categoryCode: 'ATM_CASH_DISPENSATION_FAILURE'
    });

    expect(dossier.title).toContain('ATM');
    expect(dossier.categorySpecificStatutoryNote).toContain('₹100 per day penalty');
    expect(dossier.mandatoryEvidenceChecklist.length).toBeGreaterThanOrEqual(4);
  });
});
