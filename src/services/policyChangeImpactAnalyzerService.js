/**
 * @file policyChangeImpactAnalyzerService.js
 * @description Traces government policy, rule, and gazette amendments to affected downstream assets:
 * application forms, eligibility rules, generated AI guidance, and public documentation pages.
 * Emits reproducible impact reports and enforces domain maintainer approval before publishing.
 */

export class PolicyImpactError extends Error {
  constructor(message, code = 'POLICY_IMPACT_ERROR') {
    super(message);
    this.name = 'PolicyImpactError';
    this.code = code;
  }
}

export const ImpactSeverity = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH_BREAKING: 'HIGH_BREAKING'
});

export class PolicyChangeImpactAnalyzerService {
  constructor() {
    this.assetRegistry = [];
    this.stagedReports = new Map();
    this.initDefaultAssets();
  }

  initDefaultAssets() {
    this.assetRegistry = [
      {
        assetId: 'form_ka_caste_cert',
        type: 'FORM_SCHEMA',
        title: 'Form 7: Karnataka Caste Certificate Application',
        linkedPolicies: ['policy_ka_creamy_layer_2026', 'policy_ka_reservation_slabs']
      },
      {
        assetId: 'rule_ka_creamy_layer_engine',
        type: 'ELIGIBILITY_RULE',
        title: 'Karnataka OBC Creamy Layer Income Cutoff Rule',
        linkedPolicies: ['policy_ka_creamy_layer_2026']
      },
      {
        assetId: 'doc_page_obc_benefits',
        type: 'PUBLIC_GUIDE_PAGE',
        title: 'Plain Language Guide to Karnataka OBC Welfare Schemes',
        linkedPolicies: ['policy_ka_creamy_layer_2026']
      },
      {
        assetId: 'form_voter_enrollment_form6',
        type: 'FORM_SCHEMA',
        title: 'Form 6: New Voter Inclusion',
        linkedPolicies: ['policy_eci_qualifying_dates']
      }
    ];
  }

  /**
   * Analyzes the downstream blast radius of an upcoming policy amendment.
   */
  analyzePolicyChange({ policyId, policyTitle, proposedChanges = {}, previousValues = {} }) {
    if (!policyId) {
      throw new PolicyImpactError('policyId is required', 'INVALID_ARGUMENT');
    }

    const affectedAssets = this.assetRegistry.filter(asset => asset.linkedPolicies.includes(policyId));

    // Determine impact severity
    let severity = ImpactSeverity.LOW;
    if (affectedAssets.some(a => a.type === 'ELIGIBILITY_RULE')) {
      severity = ImpactSeverity.HIGH_BREAKING;
    } else if (affectedAssets.length > 2) {
      severity = ImpactSeverity.MEDIUM;
    }

    const diffPreview = {
      changedKeys: Object.keys(proposedChanges),
      previousValues,
      proposedChanges
    };

    const reportId = `ir_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const report = {
      reportId,
      policyId,
      policyTitle: policyTitle || policyId,
      impactSeverity: severity,
      requiresDomainLeadApproval: severity === ImpactSeverity.HIGH_BREAKING,
      totalAffectedAssets: affectedAssets.length,
      affectedAssets: affectedAssets.map(a => ({ assetId: a.assetId, type: a.type, title: a.title })),
      diffPreview,
      approvalStatus: 'PENDING_REVIEW',
      approvedBy: null,
      createdAt: new Date().toISOString()
    };

    this.stagedReports.set(reportId, report);
    return report;
  }

  /**
   * Approves and publishes the policy impact report.
   */
  approveAndPromote(reportId, domainLeadPrincipal) {
    const report = this.stagedReports.get(reportId);
    if (!report) {
      throw new PolicyImpactError(`Impact report ${reportId} not found`, 'NOT_FOUND');
    }

    if (report.requiresDomainLeadApproval) {
      if (!domainLeadPrincipal || !['domain_lead', 'legal_lead', 'admin'].includes(domainLeadPrincipal.role)) {
        throw new PolicyImpactError('High breaking policy change requires domain_lead or admin approval', 'FORBIDDEN');
      }
    }

    report.approvalStatus = 'APPROVED_FOR_ROLLOUT';
    report.approvedBy = domainLeadPrincipal?.id || 'system';
    report.approvedAt = new Date().toISOString();
    return report;
  }

  getReport(reportId) {
    return this.stagedReports.get(reportId) || null;
  }
}

export const defaultPolicyImpactService = new PolicyChangeImpactAnalyzerService();
