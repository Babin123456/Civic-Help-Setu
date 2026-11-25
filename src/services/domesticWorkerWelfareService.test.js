import { describe, it, expect, beforeEach } from 'vitest';
import { DomesticWorkerWelfareService } from './domesticWorkerWelfareService.js';

describe('DomesticWorkerWelfareService', () => {
  let service;

  beforeEach(() => {
    service = new DomesticWorkerWelfareService();
  });

  it('filters schemes by state and worker category', () => {
    const results = service.getWelfareInfo('IN-MH', 'Cook');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some(r => r.boardName.includes('Maharashtra'))).toBe(true);
  });

  it('distinguishes statutory rights from scheme-specific discretionary benefits', () => {
    const breakdown = service.getRightsAndProtectionsBreakdown('IN-KA');
    expect(breakdown.statutoryRights.length).toBeGreaterThan(0);
    expect(breakdown.schemeBenefits.length).toBeGreaterThan(0);
    expect(breakdown.privacyGuarantee).toContain('does not collect');

    const maternity = breakdown.schemeBenefits.find(b => b.benefitType === 'ACCIDENTAL_DISABILITY_AID');
    expect(maternity).toBeDefined();
    expect(maternity.amountINR).toBe(100000);
  });

  it('generates a printable application checklist with fees and emergency numbers', () => {
    const checklist = service.generateApplicationPreparationChecklist('IN-MH');
    expect(checklist.isAvailable).toBe(true);
    expect(checklist.boardName).toContain('Maharashtra');
    expect(checklist.registrationRoute.feeINR).toBe(30);
    expect(checklist.requiredDocuments.length).toBeGreaterThan(3);
    expect(checklist.emergencyHelplines.length).toBeGreaterThan(1);
  });

  it('records correction reports for outdated guidelines into editorial review queue', () => {
    const report = service.submitCorrectionReport({
      sourceBoardId: 'dw_welfare_mh',
      correctionDetails: 'Annual renewal fee updated from ₹12 to ₹15 via recent gazette notification.',
      suggestedOfficialSource: 'https://labour.maharashtra.gov.in/gazette/2026-02.pdf'
    });

    expect(report.reportId).toMatch(/^corr_/);
    expect(report.status).toBe('PENDING_EDITORIAL_AUDIT');
  });
});
