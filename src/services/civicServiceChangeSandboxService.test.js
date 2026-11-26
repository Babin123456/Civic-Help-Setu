import { describe, it, expect } from 'vitest';
import {
  runShadowTraffic,
  validateServiceChangeRequest,
  publishSnapshot,
  rollbackSnapshot,
  createSnapshot,
  saveSandboxRun,
  loadSandboxRun,
  listSandboxRuns,
  buildShadowTrafficReport,
  SERVICE_CHANGE_ERRORS,
  __testables
} from './civicServiceChangeSandboxService.js';
import { listStagingSnapshots, listServiceVersions, getStagingSnapshot } from '../data/civicServiceChangeSandboxData.js';

const { replayJourneyPattern, computeDigest, SNAPSHOT_STATUS, COMPARISON_RECOMMENDATION } = __testables;

// ---- localStorage mock (vitest runs in node env) ----
const localStorageStore = {};
const mockLocalStorage = {
  getItem: (key) => localStorageStore[key] ?? null,
  setItem: (key, value) => { localStorageStore[key] = value; },
  removeItem: (key) => { delete localStorageStore[key]; },
  clear: () => { Object.keys(localStorageStore).forEach((k) => delete localStorageStore[k]); }
};
Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage, writable: true });

describe('civicServiceChangeSandboxService', () => {
  describe('listings', () => {
    it('lists staging snapshots, service versions, journey patterns, shadow runs, comparisons', () => {
      expect(listStagingSnapshots().length).toBeGreaterThan(0);
      expect(listServiceVersions().length).toBeGreaterThan(0);
      expect(getStagingSnapshot('snapshot-income-certificate-v2-rollout')).not.toBeNull();
    });
  });

  describe('validation', () => {
    it('rejects non-object input', () => {
      const result = validateServiceChangeRequest('not-object');
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe(SERVICE_CHANGE_ERRORS.INVALID_TYPE);
    });

    it('rejects sensitive keys', () => {
      const result = validateServiceChangeRequest({ aadhaar_number: '1234' });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === SERVICE_CHANGE_ERRORS.SENSITIVE_FIELD)).toBe(true);
    });

    it('rejects sensitive text values', () => {
      const result = validateServiceChangeRequest({ title: 'my aadhaar is 1234 5678 9012' });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === SERVICE_CHANGE_ERRORS.SENSITIVE_VALUE)).toBe(true);
    });

    it('rejects unknown snapshot id when requireSnapshot', () => {
      const result = validateServiceChangeRequest({ snapshotId: 'unknown-snapshot' }, { requireSnapshot: true });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === SERVICE_CHANGE_ERRORS.SNAPSHOT_NOT_FOUND)).toBe(true);
    });

    it('rejects unknown service version id', () => {
      const result = validateServiceChangeRequest({ serviceVersionId: 'svc-does-not-exist' });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === SERVICE_CHANGE_ERRORS.SERVICE_VERSION_NOT_FOUND)).toBe(true);
    });

    it('accepts a valid minimal request', () => {
      const result = validateServiceChangeRequest({ snapshotId: 'snapshot-income-certificate-v2-rollout' });
      expect(result.valid).toBe(true);
    });
  });

  describe('replayJourneyPattern', () => {
    it('produces aggregate outcome metrics in valid ranges', () => {
      const result = replayJourneyPattern({
        journeyPatternId: 'journey-income-certificate-complete',
        serviceVersionId: 'svc-income-certificate-v1',
        replayCount: 1000,
        seed: 20261122
      });
      expect(result).not.toBeNull();
      expect(result.completionRate).toBeGreaterThanOrEqual(0);
      expect(result.completionRate).toBeLessThanOrEqual(1);
      expect(result.validationFailureRate).toBeGreaterThanOrEqual(0);
      expect(result.validationFailureRate).toBeLessThanOrEqual(1);
      expect(result.noCitizenData).toBe(true);
      expect(result.illustrative).toBe(true);
    });

    it('is deterministic across repeated replays', () => {
      const a = replayJourneyPattern({ journeyPatternId: 'journey-income-certificate-complete', serviceVersionId: 'svc-income-certificate-v1', replayCount: 1000, seed: 42 });
      const b = replayJourneyPattern({ journeyPatternId: 'journey-income-certificate-complete', serviceVersionId: 'svc-income-certificate-v1', replayCount: 1000, seed: 42 });
      expect(a.completionRate).toBe(b.completionRate);
      expect(a.validationFailureRate).toBe(b.validationFailureRate);
    });

    it('returns null for unknown journey pattern or version', () => {
      expect(replayJourneyPattern({ journeyPatternId: 'unknown', serviceVersionId: 'svc-income-certificate-v1', replayCount: 100, seed: 1 })).toBeNull();
      expect(replayJourneyPattern({ journeyPatternId: 'journey-income-certificate-complete', serviceVersionId: 'unknown', replayCount: 100, seed: 1 })).toBeNull();
    });
  });

  describe('runShadowTraffic', () => {
    it('runs shadow traffic for a snapshot successfully', () => {
      const result = runShadowTraffic({
        snapshotId: 'snapshot-income-certificate-v2-rollout',
        journeyPatternIds: ['journey-income-certificate-complete'],
        replayCount: 1000,
        seed: 20261122
      });
      expect(result.ok).toBe(true);
      expect(result.snapshot).toHaveProperty('id', 'snapshot-income-certificate-v2-rollout');
      expect(result.baseline).toHaveProperty('completionRate');
      expect(result.proposed).toHaveProperty('completionRate');
      expect(result.comparison).toHaveProperty('recommendation');
      expect(result.comparison).toHaveProperty('reasoning');
      expect(result.reproducibility).toHaveProperty('seed');
      expect(result.untrusted).toBe(true);
      expect(result.requiresHumanReview).toBe(true);
      expect(result.noCitizenData).toBe(true);
      expect(result.illustrative).toBe(true);
    });

    it('is deterministic across repeated runs with same seed', () => {
      const a = runShadowTraffic({ snapshotId: 'snapshot-income-certificate-v2-rollout', journeyPatternIds: ['journey-income-certificate-complete'], replayCount: 1000, seed: 7 });
      const b = runShadowTraffic({ snapshotId: 'snapshot-income-certificate-v2-rollout', journeyPatternIds: ['journey-income-certificate-complete'], replayCount: 1000, seed: 7 });
      expect(a.comparison.completionDelta).toBe(b.comparison.completionDelta);
      expect(a.reproducibility.seed).toBe(b.reproducibility.seed);
    });

    it('returns validation failure for unknown snapshot', () => {
      const result = runShadowTraffic({ snapshotId: 'unknown-snapshot' });
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe(SERVICE_CHANGE_ERRORS.SNAPSHOT_NOT_FOUND);
    });

    it('compares completion, validation and accessibility deltas', () => {
      const result = runShadowTraffic({ snapshotId: 'snapshot-income-certificate-v2-rollout', journeyPatternIds: ['journey-income-certificate-complete'], replayCount: 1000, seed: 20261122 });
      expect(result.ok).toBe(true);
      expect(typeof result.comparison.completionDelta).toBe('number');
      expect(typeof result.comparison.validationFailureDelta).toBe('number');
      expect(typeof result.comparison.accessibilityIssuesDelta).toBe('number');
    });
  });

  describe('publishSnapshot', () => {
    it('requires human approval', () => {
      const result = publishSnapshot({ snapshotId: 'snapshot-income-certificate-v2-rollout', humanApproved: false });
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe(SERVICE_CHANGE_ERRORS.PERMISSION_DENIED);
    });

    it('fails when production writes are blocked', () => {
      const result = publishSnapshot({ snapshotId: 'snapshot-income-certificate-v2-rollout', humanApproved: true });
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe(SERVICE_CHANGE_ERRORS.PRODUCTION_WRITE_BLOCKED);
    });

    it('succeeds with human approval when not blocked (approved snapshot)', () => {
      const result = publishSnapshot({ snapshotId: 'snapshot-caste-certificate-v1-baseline', humanApproved: true, actor: { username: 'maintainer-reviews' } });
      expect(result.ok).toBe(true);
      expect(result.status).toBe('published');
    });

    it('rejects unknown snapshot', () => {
      const result = publishSnapshot({ snapshotId: 'unknown-snapshot', humanApproved: true });
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe(SERVICE_CHANGE_ERRORS.SNAPSHOT_NOT_FOUND);
    });
  });

  describe('rollbackSnapshot', () => {
    it('requires human approval', () => {
      const result = rollbackSnapshot({ snapshotId: 'snapshot-income-certificate-v2-rollout', humanApproved: false });
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe(SERVICE_CHANGE_ERRORS.PERMISSION_DENIED);
    });

    it('succeeds with human approval', () => {
      const result = rollbackSnapshot({ snapshotId: 'snapshot-income-certificate-v2-rollout', humanApproved: true, actor: { username: 'maintainer-reviews' } });
      expect(result.ok).toBe(true);
      expect(result.status).toBe('rolled-back');
    });
  });

  describe('createSnapshot', () => {
    it('creates a draft snapshot successfully', () => {
      const result = createSnapshot({
        snapshotId: 'snapshot-test-draft',
        serviceId: 'service-income-certificate',
        fromVersionId: 'svc-income-certificate-v1',
        toVersionId: 'svc-income-certificate-v2',
        title: 'Test draft snapshot',
        description: 'A deterministic draft snapshot for testing.',
        deterministicSeed: 999
      });
      expect(result.ok).toBe(true);
      expect(result.snapshot.status).toBe('drafting');
      expect(result.snapshot.deterministicSeed).toBe(999);
      expect(result.snapshot.isSynthetic).toBe(true);
    });

    it('rejects duplicate snapshot id', () => {
      const result = createSnapshot({
        snapshotId: 'snapshot-income-certificate-v2-rollout',
        serviceId: 'service-income-certificate',
        fromVersionId: 'svc-income-certificate-v1',
        toVersionId: 'svc-income-certificate-v2',
        title: 'Duplicate'
      });
      expect(result.ok).toBe(false);
    });
  });

  describe('storage', () => {
    it('save/load/list round-trips', () => {
      const saved = saveSandboxRun({ runId: 'run-1', snapshotId: 'snapshot-income-certificate-v2-rollout', status: 'completed', summary: 'test shadow run' });
      expect(saved.ok).toBe(true);
      const loaded = loadSandboxRun('run-1');
      expect(loaded).not.toBeNull();
      expect(loaded.summary).toBe('test shadow run');
      const all = listSandboxRuns();
      expect(all.some((r) => r.runId === 'run-1')).toBe(true);
    });

    it('rejects invalid save', () => {
      const saved = saveSandboxRun({ runId: 'run-2', snapshotId: 'unknown-snapshot' });
      expect(saved.ok).toBe(false);
    });
  });

  describe('buildShadowTrafficReport', () => {
    it('returns a report string', () => {
      const result = runShadowTraffic({ snapshotId: 'snapshot-income-certificate-v2-rollout', journeyPatternIds: ['journey-income-certificate-complete'], replayCount: 1000, seed: 20261122 });
      const report = buildShadowTrafficReport(result);
      expect(typeof report).toBe('string');
      expect(report.length).toBeGreaterThan(0);
      expect(report).toContain('illustrative');
    });

    it('returns message for invalid result', () => {
      const report = buildShadowTrafficReport({ ok: false });
      expect(typeof report).toBe('string');
    });
  });

  describe('computeDigest', () => {
    it('is deterministic', () => {
      expect(computeDigest({ x: 1 })).toBe(computeDigest({ x: 1 }));
      expect(computeDigest({ x: 1 })).not.toBe(computeDigest({ x: 2 }));
    });
  });

  describe('constants', () => {
    it('snapshot statuses and recommendations are defined', () => {
      expect(Object.values(SNAPSHOT_STATUS).length).toBeGreaterThan(0);
      expect(Object.values(COMPARISON_RECOMMENDATION).length).toBeGreaterThan(0);
    });
  });
});
