import { describe, it, expect, beforeEach } from 'vitest';
import {
  getStoredRules,
  saveStoredRule,
  resetRulesToDefault,
  getStoredEvaluationSnapshots,
  saveEvaluationSnapshotRecord,
  clearEvaluationSnapshots,
} from './temporalPolicyStorage';
import { JURISDICTION_LEVELS, RULE_STATUS } from './temporalPolicyEngineService';

describe('Temporal Policy Storage Service (#1155)', () => {
  beforeEach(() => {
    resetRulesToDefault();
    clearEvaluationSnapshots();
  });

  it('initializes with predefined seed rules representing real Indian schemes', () => {
    const rules = getStoredRules();
    expect(rules.length).toBeGreaterThanOrEqual(4);
    const mhEws = rules.find((r) => r.ruleFamilyId === 'scheme_ews_certificate' && r.jurisdictionCode === 'IN-MH');
    expect(mhEws).toBeDefined();
    expect(mhEws.sourceMetadata.issuingAuthority).toContain('Maharashtra');
  });

  it('saves new or updated rules preserving versioning attributes', () => {
    const newRule = {
      id: 'rule_custom_test_v1',
      ruleFamilyId: 'scheme_custom_test',
      title: 'Custom Local Municipality Rule',
      version: '1.0.0',
      jurisdictionLevel: JURISDICTION_LEVELS.LOCAL,
      jurisdictionCode: 'IN-MH-PUN',
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      effectiveTo: null,
      conditions: [],
      sourceMetadata: {
        documentType: 'EXECUTIVE_ORDER',
        notificationNumber: 'PMC-2026-01',
        issuingAuthority: 'Pune Municipal Corporation',
        isVerified: true,
      },
      status: RULE_STATUS.PUBLISHED,
    };

    saveStoredRule(newRule);
    const updatedRules = getStoredRules();
    const found = updatedRules.find((r) => r.id === 'rule_custom_test_v1');
    expect(found).toBeDefined();
    expect(found.title).toBe('Custom Local Municipality Rule');
  });

  it('persists and retrieves immutable historical evaluation snapshots', () => {
    const mockSnapshot = {
      evaluationId: 'eval_test_123',
      asOfDate: '2022-05-15T00:00:00.000Z',
      ruleFamilyId: 'scheme_ews_certificate',
      ruleId: 'rule_ews_mh_2022_v2',
      outcome: 'ELIGIBLE',
      reason: 'Satisfied criteria',
      snapshotHash: 'mock_sha256_hash_value',
    };

    saveEvaluationSnapshotRecord(mockSnapshot);
    const snapshots = getStoredEvaluationSnapshots();
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].evaluationId).toBe('eval_test_123');

    clearEvaluationSnapshots();
    expect(getStoredEvaluationSnapshots()).toHaveLength(0);
  });
});
