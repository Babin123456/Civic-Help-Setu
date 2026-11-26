import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  applyGhgRetentionPolicy,
  buildGhgIndexes,
  createEmptyInventory,
  ensureGhgInventory,
  isValidInventoryShape,
  loadGhgInventory,
  migrateGhgInventoryData,
  persistGhgInventory,
  resetGhgStorageToEmpty,
  rollbackGhgStorage,
  runGhgTransaction,
} from './ghgInventoryMigrations.js';
import { GHG_ERROR_CODES, GHG_STORAGE_KEYS } from './ghgInventoryConstants.js';
import { GhgInventoryError } from './ghgInventoryValidation.js';

describe('GHG inventory persistence and migrations (#753)', () => {
  let store;

  beforeEach(() => {
    store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
      clear: () => store.clear(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('seeds a valid bundle with every normalised collection on first load', () => {
    const data = loadGhgInventory({ now: '2026-11-17T00:00:00.000Z' });
    expect(isValidInventoryShape(data)).toBe(true);
    expect(data.emissionSources).toHaveLength(6);
    expect(data.activityRecords).toHaveLength(14);
    expect(data.emissionFactors).toHaveLength(7);
    expect(data.factorVersions).toHaveLength(8);
    expect(data.reportingPeriods).toHaveLength(3);
    expect(data.departmentSubmissions).toHaveLength(8);
    expect(data.calculationRuns).toHaveLength(2);
    expect(data.recommendations).toHaveLength(1);
    expect(data.meta.seeded).toBe(true);
    expect(store.get(GHG_STORAGE_KEYS.BUNDLE)).toBeTruthy();
  });

  it('builds indexes for ids, periods, submissions and categories', () => {
    const data = ensureGhgInventory();
    expect(data.indexes.sourcesById.get('SRC-BLD-01').name).toBe(
      'Municipal Administrative Headquarters'
    );
    expect(data.indexes.recordsByPeriod.get('per-2025-26')).toHaveLength(6);
    expect(data.indexes.recordsBySubmission.get('sub-2526-energy')).toHaveLength(3);
    expect(data.indexes.recordsByCategory.get('fleet_fuel')).toHaveLength(5);
    expect(data.indexes.recordsByQuality.get('measured').length).toBeGreaterThan(0);
    expect(data.indexes.periodsByStatus.get('locked')).toHaveLength(2);
    expect(data.indexes.factorsByCategory.get('fleet_fuel')).toHaveLength(3);
  });

  it('migrates the legacy flat shape without silently dropping records', () => {
    const result = migrateGhgInventoryData(
      {
        schemaVersion: 0,
        sources: [{ id: 'SRC-OLD', name: 'Old depot', factorId: 'EF-DIESEL' }],
        periods: [{ id: 'PER-OLD', label: 'Old year' }],
        submissions: [{ id: 'SUB-OLD', periodId: 'PER-OLD', status: 'legacy-status' }],
        activities: [
          { id: 'ACT-OLD', submissionId: 'SUB-OLD', sourceId: 'SRC-OLD', value: 12, unit: 'L' },
        ],
      },
      { now: '2026-11-17T00:00:00.000Z' }
    );

    expect(result.migrated).toBe(true);
    expect(isValidInventoryShape(result.data)).toBe(true);
    expect(result.data.emissionSources[0]).toMatchObject({
      id: 'SRC-OLD',
      jurisdictionId: 'WARD-042',
      defaultFactorId: 'EF-DIESEL',
    });
    expect(result.data.departmentSubmissions[0].status).toBe('draft');
    expect(result.data.activityRecords[0]).toMatchObject({
      id: 'ACT-OLD',
      quantity: 12,
      unit: 'L',
      // A submission with an unknown status is coerced to draft, and the record follows.
      status: 'draft',
    });
    expect(result.data.meta.migrationHistory[0]).toMatchObject({ from: 0, to: 1, kind: 'upgrade' });
    expect(result.historyEntry).toEqual(result.data.meta.migrationHistory[0]);
  });

  it('keeps the previous bundle when a transaction throws', () => {
    const before = loadGhgInventory();
    expect(() =>
      runGhgTransaction((draft) => {
        draft.emissionSources.push({ id: 'SRC-HALF-WRITTEN' });
        throw new Error('network failed');
      })
    ).toThrow(GhgInventoryError);

    const after = loadGhgInventory();
    expect(after.emissionSources).toHaveLength(before.emissionSources.length);
    expect(after.emissionSources.some((source) => source.id === 'SRC-HALF-WRITTEN')).toBe(false);
  });

  it('refuses to persist an incomplete bundle', () => {
    try {
      persistGhgInventory({ emissionSources: [] });
      throw new Error('Expected MIGRATION_FAILED');
    } catch (error) {
      expect(error).toBeInstanceOf(GhgInventoryError);
      expect(error.code).toBe(GHG_ERROR_CODES.MIGRATION_FAILED);
    }
  });

  it('rolls back to the seed and resets to an empty but valid bundle', () => {
    runGhgTransaction((draft) => {
      draft.emissionSources = [];
      draft.reportingPeriods = [];
      return null;
    });
    expect(loadGhgInventory().emissionSources).toHaveLength(0);

    const seeded = rollbackGhgStorage();
    expect(seeded.emissionSources).toHaveLength(6);
    expect(seeded.meta.seeded).toBe(true);

    const empty = resetGhgStorageToEmpty();
    expect(isValidInventoryShape(empty)).toBe(true);
    expect(empty.emissionSources).toHaveLength(0);
    expect(empty.activityRecords).toHaveLength(0);
    expect(empty.meta.seeded).toBeUndefined();
  });

  it('archives old periods, purges abandoned drafts and redacts document metadata', () => {
    const before = ensureGhgInventory();
    const draftBefore = before.departmentSubmissions.find((item) => item.id === 'SUB-2627-WASTE');
    expect(draftBefore).toBeTruthy();

    const { result } = applyGhgRetentionPolicy(
      { retentionYears: 0, draftRetentionDays: 0, now: '2026-11-17T00:00:00.000Z' },
      {}
    );

    const after = ensureGhgInventory();
    const archived = after.reportingPeriods.filter((period) => period.status === 'archived');
    expect(result.archivedPeriods).toBe(2);
    expect(archived.map((period) => period.id).sort()).toEqual(['PER-2024-25', 'PER-2025-26']);
    expect(after.departmentSubmissions.some((item) => item.id === 'SUB-2627-WASTE')).toBe(false);
    expect(result.purgedDraftSubmissions).toBeGreaterThanOrEqual(1);
    expect(result.purgedDraftRecords).toBeGreaterThanOrEqual(2);
    expect(result.redactedDocuments).toBeGreaterThan(0);
    expect(
      after.activityRecords
        .filter((record) => ['PER-2024-25', 'PER-2025-26'].includes(record.periodId))
        .every((record) => record.sourceDocument === null)
    ).toBe(true);
    expect(after.auditEvents[0].action).toBe('retention.applied');
  });

  it('creates a valid empty shape for tests and disaster recovery', () => {
    expect(isValidInventoryShape(createEmptyInventory())).toBe(true);
    expect(buildGhgIndexes(createEmptyInventory()).sourcesById.size).toBe(0);
  });
});
