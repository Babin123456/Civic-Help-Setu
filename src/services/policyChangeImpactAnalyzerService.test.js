import { describe, it, expect, beforeEach } from 'vitest';
import {
  PolicyChangeImpactAnalyzerService,
  ImpactSeverity,
  PolicyImpactError
} from './policyChangeImpactAnalyzerService.js';

describe('PolicyChangeImpactAnalyzerService', () => {
  let service;

  beforeEach(() => {
    service = new PolicyChangeImpactAnalyzerService();
  });

  it('detects all linked forms, eligibility rules, and guide pages for a policy amendment', () => {
    const report = service.analyzePolicyChange({
      policyId: 'policy_ka_creamy_layer_2026',
      policyTitle: 'Karnataka Revised OBC Creamy Layer Ceiling 2026',
      previousValues: { incomeCeilingINR: 800000 },
      proposedChanges: { incomeCeilingINR: 1000000 }
    });

    expect(report.totalAffectedAssets).toBe(3);
    expect(report.impactSeverity).toBe(ImpactSeverity.HIGH_BREAKING);
    expect(report.requiresDomainLeadApproval).toBe(true);
    expect(report.affectedAssets.map(a => a.assetId)).toContain('form_ka_caste_cert');
    expect(report.affectedAssets.map(a => a.assetId)).toContain('rule_ka_creamy_layer_engine');
  });

  it('blocks publication of high impact changes without domain lead approval', () => {
    const report = service.analyzePolicyChange({
      policyId: 'policy_ka_creamy_layer_2026',
      proposedChanges: { incomeCeilingINR: 1000000 }
    });

    expect(() => {
      service.approveAndPromote(report.reportId, { id: 'citizen_1', role: 'citizen' });
    }).toThrow(PolicyImpactError);
  });

  it('allows promotion when approved by a verified domain_lead', () => {
    const report = service.analyzePolicyChange({
      policyId: 'policy_ka_creamy_layer_2026',
      proposedChanges: { incomeCeilingINR: 1000000 }
    });

    const approved = service.approveAndPromote(report.reportId, { id: 'lead_sharma', role: 'domain_lead' });
    expect(approved.approvalStatus).toBe('APPROVED_FOR_ROLLOUT');
    expect(approved.approvedBy).toBe('lead_sharma');
  });
});
