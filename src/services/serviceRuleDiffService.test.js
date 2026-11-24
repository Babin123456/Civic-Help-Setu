import { describe, it, expect } from 'vitest';
import {
  computeServiceRuleDiff,
  mapDiffToSavedChecklist,
  acknowledgeRuleChange,
  exportRuleDiffSummary,
  getVersionRollbackGuidelines,
  getRetroactiveSafeguardPolicy,
  RULE_CHANGE_TYPES,
  RULE_CATEGORIES
} from './serviceRuleDiffService';

describe('serviceRuleDiffService', () => {
  it('should define rule change types and categories', () => {
    expect(RULE_CHANGE_TYPES.ADDED).toBe('ADDED');
    expect(RULE_CHANGE_TYPES.MODIFIED).toBe('MODIFIED');
    expect(RULE_CATEGORIES.DOCUMENT).toBe('DOCUMENT');
  });

  it('should compute deterministic diff between two service rule versions', () => {
    const v1 = {
      serviceId: 'trade-licence',
      versionId: 'v1.0',
      rules: [
        { ruleId: 'r_fee', category: 'FEE', title: 'Base Application Fee', value: 250 },
        { ruleId: 'r_doc_id', category: 'DOCUMENT', title: 'Aadhaar Card', value: 'REQUIRED' },
        { ruleId: 'r_old_affidavit', category: 'DOCUMENT', title: 'Notarized Hardcopy Affidavit', value: 'REQUIRED' }
      ]
    };

    const v2 = {
      serviceId: 'trade-licence',
      versionId: 'v2.0',
      officialGazetteRef: 'Gazette Order 2024/77B',
      rules: [
        { ruleId: 'r_fee', category: 'FEE', title: 'Base Application Fee', value: 350 }, // modified
        { ruleId: 'r_doc_id', category: 'DOCUMENT', title: 'Aadhaar Card', value: 'REQUIRED' }, // unchanged
        { ruleId: 'r_fire_noc', category: 'DOCUMENT', title: 'Fire Safety NOC', value: 'MANDATORY_OVER_500SQFT' } // added
        // r_old_affidavit removed
      ]
    };

    const diff = computeServiceRuleDiff(v1, v2);
    expect(diff.summary.addedCount).toBe(1);
    expect(diff.summary.removedCount).toBe(1);
    expect(diff.summary.modifiedCount).toBe(1);
    expect(diff.summary.unchangedCount).toBe(1);

    expect(diff.modified[0].previousValue).toBe(250);
    expect(diff.modified[0].currentValue).toBe(350);
  });

  it('should map diff impacts directly to citizen saved checklist items', () => {
    const diff = {
      modified: [{ ruleId: 'r_fee', previousValue: 250, currentValue: 350, officialGazetteRef: 'Order 77B' }],
      removed: [{ ruleId: 'r_old_affidavit' }]
    };

    const savedItems = [
      { ruleId: 'r_fee', title: 'Fee Payment' },
      { ruleId: 'r_old_affidavit', title: 'Affidavit Attestation' },
      { ruleId: 'r_doc_id', title: 'Aadhaar Identity' }
    ];

    const mapped = mapDiffToSavedChecklist(diff, savedItems);
    expect(mapped[0].impactBadge).toBe('REQUIREMENT_MODIFIED');
    expect(mapped[0].impactDescription).toContain('amended from [250] to [350]');
    expect(mapped[1].impactBadge).toBe('RULE_REMOVED');
    expect(mapped[2].impactBadge).toBe('NO_CHANGE');
  });

  it('should record citizen dismissal/acknowledgment of rule changes', () => {
    const ack = acknowledgeRuleChange('citizen_1', 'trade-licence', 'v2.0');
    expect(ack.status).toBe('DISMISSED');
    expect(ack.acknowledgedVersion).toBe('v2.0');
  });

  it('should provide rollback guidelines and retroactive safeguards', () => {
    const rollback = getVersionRollbackGuidelines();
    expect(rollback.length).toBeGreaterThanOrEqual(2);
    expect(rollback[0]).toContain('Never mutate or overwrite');

    const policy = getRetroactiveSafeguardPolicy();
    expect(policy.rule).toBe('PROHIBIT_RETROACTIVE_APPLICATION');
  });

  it('should export formatted markdown rule diff report with badges', () => {
    const diff = {
      serviceId: 'trade-licence',
      previousVersionId: 'v1.0',
      currentVersionId: 'v2.0',
      officialGazetteRef: 'Gazette Notification 2024/88',
      summary: { addedCount: 1, modifiedCount: 1, removedCount: 1 },
      modified: [{ title: 'Application Fee', previousValue: 250, currentValue: 350, officialGazetteRef: 'Gazette 88' }]
    };

    const impacted = [
      { title: 'Application Fee', impactBadge: 'REQUIREMENT_MODIFIED', impactDescription: 'Fee increased' }
    ];

    const text = exportRuleDiffSummary(diff, impacted);
    expect(text).toContain('# Service Rule Change & Checklist Impact Report');
    expect(text).toContain('v1.0 ➔ **v2.0**');
    expect(text).toContain('Gazette Notification 2024/88');
    expect(text).toContain('[REQUIREMENT_MODIFIED]');
  });
});
