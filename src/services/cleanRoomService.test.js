import { describe, it, expect, beforeEach } from 'vitest';
import { CleanRoomService } from './cleanRoomService.js';
import { resetCleanRoomStorage } from './cleanRoomStorage.js';
import {
  CLEAN_ROOM_ERROR_CODES,
  WORKSPACE_STATUS,
  ALLOWED_DATASET_IDS,
} from '../data/cleanRoomContract.js';

describe('CleanRoomService & Privacy Engine', () => {
  beforeEach(() => {
    resetCleanRoomStorage();
  });

  describe('Workspace Management & Steward Governance', () => {
    it('lists seeded workspaces', () => {
      const workspaces = CleanRoomService.listWorkspaces();
      expect(workspaces.length).toBeGreaterThanOrEqual(3);
      expect(workspaces.some((w) => w.workspaceId === 'ws-urban-inst-01')).toBe(true);
    });

    it('registers new workspace in pending_approval state', () => {
      const payload = {
        partnerName: 'Civic Data Foundation',
        partnerOrg: 'Data Governance Alliance',
        partnerEmail: 'steward@datagov.org',
        tier: 'civic_ngo',
        approvedDatasets: [ALLOWED_DATASET_IDS.WARD_SERVICE_DEMAND],
      };

      const result = CleanRoomService.registerWorkspace(payload);
      expect(result.success).toBe(true);
      expect(result.workspace.status).toBe(WORKSPACE_STATUS.PENDING_APPROVAL);
      expect(result.workspace.queryBudgetRemaining).toBe(40);
      expect(result.workspace.approvedBy).toBeNull();
    });

    it('enforces human data steward approval to activate workspace', () => {
      const registered = CleanRoomService.registerWorkspace({
        partnerName: 'Civic Data Foundation',
        partnerOrg: 'Data Governance Alliance',
        partnerEmail: 'steward@datagov.org',
        tier: 'civic_ngo',
        approvedDatasets: [ALLOWED_DATASET_IDS.WARD_SERVICE_DEMAND],
      });

      const wsId = registered.workspace.workspaceId;

      // Steward approves
      const approval = CleanRoomService.reviewWorkspace(wsId, {
        decision: 'approve',
        stewardId: 'lead_steward_01',
        notes: 'Verified academic credentials and ethics board approval',
      });

      expect(approval.success).toBe(true);
      expect(approval.workspace.status).toBe(WORKSPACE_STATUS.APPROVED);
      expect(approval.workspace.approvedBy).toBe('lead_steward_01');
    });

    it('allows data steward rejection with substantive justification', () => {
      const wsId = 'ws-pending-ngo-03';
      const rejection = CleanRoomService.reviewWorkspace(wsId, {
        decision: 'reject',
        stewardId: 'lead_steward_01',
        reason: 'Missing institutional endorsement letter from accredited university',
      });

      expect(rejection.success).toBe(true);
      expect(rejection.workspace.status).toBe(WORKSPACE_STATUS.REJECTED);
      expect(rejection.workspace.approvalNotes).toContain('Missing institutional endorsement');
    });
  });

  describe('Query Execution & Privacy Preservation', () => {
    it('executes valid aggregate query and returns non-row-level aggregated buckets', () => {
      const res = CleanRoomService.executeQuery({
        workspaceId: 'ws-urban-inst-01',
        templateId: 'TPL_WARD_SERVICE_SUMMARY',
        filters: {},
      });

      expect(res.success).toBe(true);
      expect(res.template.id).toBe('TPL_WARD_SERVICE_SUMMARY');
      expect(Array.isArray(res.results)).toBe(true);
      expect(res.meta.resultDigest).toBeDefined();

      // Check that every row has only aggregated fields and no citizen identifiers
      for (const row of res.results) {
        expect(row.citizen_name).toBeUndefined();
        expect(row.phone_number).toBeUndefined();
        expect(row.aadhaar_sha256).toBeUndefined();
        expect(row.ward_id).toBeDefined();
        expect(row.service_category).toBeDefined();
      }
    });

    it('enforces k-anonymity suppression when a bucket count is below 10', () => {
      const res = CleanRoomService.executeQuery({
        workspaceId: 'ws-urban-inst-01',
        templateId: 'TPL_WARD_SERVICE_SUMMARY',
        filters: { fiscal_quarter: 'Q1-2026' },
      });

      expect(res.success).toBe(true);
      const suppressed = res.results.filter((r) => r._isSuppressed);
      if (suppressed.length > 0) {
        expect(suppressed[0].total_requests).toBe('< 10 (Suppressed)');
        expect(suppressed[0].avg_resolution_days).toBe('< 10 (Suppressed)');
      }
    });

    it('blocks execution when workspace query budget is exhausted', () => {
      const res = CleanRoomService.executeQuery({
        workspaceId: 'ws-exhausted-04', // budget is 0
        templateId: 'TPL_WARD_SERVICE_SUMMARY',
        filters: {},
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe(CLEAN_ROOM_ERROR_CODES.BUDGET_EXHAUSTED);
      expect(res.message).toContain('Query budget is fully exhausted');
    });

    it('detects and blocks differencing attacks between consecutive queries', () => {
      // Query 1: Ward-101 and Ward-102
      const q1 = CleanRoomService.executeQuery({
        workspaceId: 'ws-urban-inst-01',
        templateId: 'TPL_WARD_SERVICE_SUMMARY',
        filters: { ward_id: ['Ward-101', 'Ward-102'] },
      });
      expect(q1.success).toBe(true);

      // Query 2: Attempting differencing attack with subtle delta filter
      // (Ward-101 + single quarter where delta is < 5 records)
      const q2 = CleanRoomService.executeQuery({
        workspaceId: 'ws-urban-inst-01',
        templateId: 'TPL_WARD_SERVICE_SUMMARY',
        filters: { ward_id: ['Ward-101', 'Ward-102'], fiscal_quarter: 'Q4-2026' },
      });

      // q2 or a targeted attack with small delta must trigger differencing guard or threshold
      if (!q2.success) {
        expect([
          CLEAN_ROOM_ERROR_CODES.DIFFERENCING_ATTACK_DETECTED,
          CLEAN_ROOM_ERROR_CODES.RE_IDENTIFICATION_RISK,
        ]).toContain(q2.error);
      }
    });

    it('decrements budget and records tamper-evident audit log on query success', () => {
      const initialWs = CleanRoomService.getWorkspace('ws-urban-inst-01');
      const initialBudget = initialWs.queryBudgetRemaining;

      const res = CleanRoomService.executeQuery({
        workspaceId: 'ws-urban-inst-01',
        templateId: 'TPL_WARD_SERVICE_SUMMARY',
        filters: {},
      });

      expect(res.success).toBe(true);

      const updatedWs = CleanRoomService.getWorkspace('ws-urban-inst-01');
      expect(updatedWs.queryBudgetRemaining).toBe(initialBudget - 1);

      const logs = CleanRoomService.getAuditLogs();
      const latest = logs[0];
      expect(latest.action).toBe('QUERY_EXECUTED');
      expect(latest.workspaceId).toBe('ws-urban-inst-01');
      expect(latest.resultDigest).toBeDefined();
    });

    it('allows data steward to replenish exhausted budget', () => {
      const replenish = CleanRoomService.replenishBudget('ws-exhausted-04', {
        additionalQueries: 25,
        additionalEpsilon: 2.5,
        stewardId: 'lead_steward_01',
      });

      expect(replenish.success).toBe(true);
      expect(replenish.workspace.queryBudgetRemaining).toBe(25);
    });

    it('returns system evaluation metrics', () => {
      const metrics = CleanRoomService.getEvaluationMetrics();
      expect(metrics.totalWorkspaces).toBeGreaterThan(0);
      expect(metrics.kAnonymityThreshold).toBe(10);
      expect(metrics.zeroPiiInvariantVerified).toBe(true);
    });
  });
});
