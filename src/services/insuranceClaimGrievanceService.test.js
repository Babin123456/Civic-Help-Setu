import { describe, it, expect, beforeEach } from 'vitest';
import { InsuranceClaimGrievanceService } from './insuranceClaimGrievanceService.js';

describe('InsuranceClaimGrievanceService', () => {
  let service;

  beforeEach(() => {
    service = new InsuranceClaimGrievanceService();
  });

  it('analyzes health insurance pre-existing disease rejections with moratorium rule citations', () => {
    const analysis = service.getRejectionAnalysis('HEALTH_INSURANCE', 'PRE_EXISTING_DISEASE_NON_DISCLOSURE');
    expect(analysis.productTitle).toContain('Health');
    expect(analysis.rejectionTitle).toContain('Pre-Existing Disease');
    expect(analysis.statutoryCounterCheck).toContain('Moratorium Period');
    expect(analysis.privacyWarning).toContain('Do NOT share sensitive medical records');
  });

  it('analyzes motor insurance delay in intimation with Supreme Court ruling guidance', () => {
    const analysis = service.getRejectionAnalysis('MOTOR_INSURANCE', 'DELAY_IN_INTIMATION');
    expect(analysis.statutoryCounterCheck).toContain('Supreme Court');
  });

  it('evaluates Insurance Ombudsman readiness and identifies missing GRO complaints', () => {
    const unreadyCase = {
      complainedToInsurerGro: false
    };

    const evaluation = service.evaluateOmbudsmanReadiness(unreadyCase);
    expect(evaluation.isReady).toBe(false);
    expect(evaluation.blockers[0].code).toBe('GRO_COMPLAINT_MISSING');
  });

  it('allows Ombudsman escalation when GRO rejected claim and no court case pending', () => {
    const readyCase = {
      complainedToInsurerGro: true,
      groComplaintDate: '2026-01-10',
      groRejectedClaim: true,
      isPendingInConsumerCourt: false
    };

    const evaluation = service.evaluateOmbudsmanReadiness(readyCase);
    expect(evaluation.isReady).toBe(true);
    expect(evaluation.status).toBe('ELIGIBLE_FOR_INSURANCE_OMBUDSMAN');
    expect(evaluation.ombudsmanFramework.maxAwardCompensationINR).toBe(5000000);
  });

  it('generates a comprehensive claim repudiation document checklist', () => {
    const checklist = service.generateRejectionChecklist();
    expect(checklist.items.length).toBeGreaterThanOrEqual(4);
    expect(checklist.escalationSequence[0]).toContain('Insurance Ombudsman');
  });
});
