import { describe, it, expect } from 'vitest';
import {
  CLEAN_ROOM_SCHEMA_VERSION,
  ALLOWED_DATASET_IDS,
  ALLOWED_AGGREGATIONS,
  PRIVACY_THRESHOLDS,
  PARTNER_TIERS,
  WORKSPACE_STATUS,
  QUERY_TEMPLATES,
  validateWorkspaceContract,
  validateQueryExecutionRequest,
  validateApprovalDecision,
} from './cleanRoomContract.js';

describe('cleanRoomContract', () => {
  it('exposes valid schema version and frozen constants', () => {
    expect(CLEAN_ROOM_SCHEMA_VERSION).toBe('1.0.0');
    expect(ALLOWED_DATASET_IDS.WARD_SERVICE_DEMAND).toBe('ward_service_demand');
    expect(ALLOWED_AGGREGATIONS.COUNT).toBe('COUNT');
    expect(PRIVACY_THRESHOLDS.MIN_K_ANONYMITY).toBe(10);
    expect(PRIVACY_THRESHOLDS.MIN_DIFFERENCING_DELTA).toBe(5);
  });

  describe('validateWorkspaceContract', () => {
    it('validates a correct workspace contract', () => {
      const validPayload = {
        partnerName: 'Urban Analytics Lab',
        partnerOrg: 'City University',
        partnerEmail: 'research@city.edu',
        tier: PARTNER_TIERS.ACADEMIC_RESEARCH.id,
        approvedDatasets: [ALLOWED_DATASET_IDS.WARD_SERVICE_DEMAND],
        queryBudgetTotal: 60,
      };

      const res = validateWorkspaceContract(validPayload);
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it('rejects invalid email and missing organization', () => {
      const invalidPayload = {
        partnerName: 'U',
        partnerOrg: '',
        partnerEmail: 'invalid-email',
        tier: 'unsupported_tier',
        approvedDatasets: [],
      };

      const res = validateWorkspaceContract(invalidPayload);
      expect(res.valid).toBe(false);
      expect(res.errors).toContain('Partner name must be at least 3 characters');
      expect(res.errors).toContain('Partner organization is required');
      expect(res.errors).toContain('Valid partner email is required');
      expect(res.errors.some((e) => e.includes('Tier must be one of'))).toBe(true);
      expect(res.errors).toContain('At least one approved dataset must be requested');
    });

    it('rejects unapproved dataset identifiers', () => {
      const payload = {
        partnerName: 'Civic Watchdog',
        partnerOrg: 'Open NGO',
        partnerEmail: 'watch@openngo.org',
        tier: PARTNER_TIERS.CIVIC_NGO.id,
        approvedDatasets: ['unapproved_raw_citizen_db'],
      };

      const res = validateWorkspaceContract(payload);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('Invalid datasets requested'))).toBe(true);
    });
  });

  describe('validateQueryExecutionRequest', () => {
    const mockApprovedWorkspace = {
      workspaceId: 'ws-test-01',
      status: WORKSPACE_STATUS.APPROVED,
      approvedDatasets: [ALLOWED_DATASET_IDS.WARD_SERVICE_DEMAND],
      queryBudgetRemaining: 25,
    };

    it('accepts a valid query request matching template and workspace permissions', () => {
      const request = {
        workspaceId: 'ws-test-01',
        templateId: 'TPL_WARD_SERVICE_SUMMARY',
        filters: {
          ward_id: 'Ward-101',
          fiscal_quarter: 'Q1-2026',
        },
      };

      const res = validateQueryExecutionRequest(request, QUERY_TEMPLATES, mockApprovedWorkspace);
      expect(res.valid).toBe(true);
      expect(res.template).toBeDefined();
      expect(res.template.id).toBe('TPL_WARD_SERVICE_SUMMARY');
    });

    it('rejects query when workspace status is not approved', () => {
      const request = {
        workspaceId: 'ws-test-pending',
        templateId: 'TPL_WARD_SERVICE_SUMMARY',
      };
      const pendingWorkspace = {
        ...mockApprovedWorkspace,
        status: WORKSPACE_STATUS.PENDING_APPROVAL,
      };

      const res = validateQueryExecutionRequest(request, QUERY_TEMPLATES, pendingWorkspace);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('only approved workspaces can execute queries'))).toBe(true);
    });

    it('rejects query when workspace budget is exhausted', () => {
      const request = {
        workspaceId: 'ws-test-01',
        templateId: 'TPL_WARD_SERVICE_SUMMARY',
      };
      const exhaustedWorkspace = {
        ...mockApprovedWorkspace,
        queryBudgetRemaining: 0,
      };

      const res = validateQueryExecutionRequest(request, QUERY_TEMPLATES, exhaustedWorkspace);
      expect(res.valid).toBe(false);
      expect(res.errors).toContain('Workspace query budget is exhausted');
    });

    it('rejects template for dataset the workspace has no permissions on', () => {
      const request = {
        workspaceId: 'ws-test-01',
        templateId: 'TPL_WELFARE_PROCESSING_TIMES', // Requires welfare_scheme_reach
      };

      const res = validateQueryExecutionRequest(request, QUERY_TEMPLATES, mockApprovedWorkspace);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('not authorized for dataset'))).toBe(true);
    });

    it('detects and blocks SQL-injection attempts in parameter filters', () => {
      const request = {
        workspaceId: 'ws-test-01',
        templateId: 'TPL_WARD_SERVICE_SUMMARY',
        filters: {
          ward_id: "Ward-101' OR '1'='1",
        },
      };

      const res = validateQueryExecutionRequest(request, QUERY_TEMPLATES, mockApprovedWorkspace);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('Potentially unsafe characters detected'))).toBe(true);
    });
  });

  describe('validateApprovalDecision', () => {
    it('approves valid approval payload', () => {
      const valid = {
        decision: 'approve',
        stewardId: 'steward-01',
        notes: 'Verified institutional credentials',
      };
      const res = validateApprovalDecision(valid);
      expect(res.valid).toBe(true);
    });

    it('enforces mandatory substantive justification on rejection', () => {
      const invalidReject = {
        decision: 'reject',
        stewardId: 'steward-01',
        reason: 'no',
      };
      const res = validateApprovalDecision(invalidReject);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('substantive rejection reason'))).toBe(true);
    });
  });
});
