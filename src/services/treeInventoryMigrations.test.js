import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildTreeInventoryIndexes,
  ensureTreeInventoryData,
  getTreeInventoryMigrationStatus,
  migrateTreeInventory,
  rollbackTreeInventoryMigration,
  TREE_INVENTORY_INDEX_MANIFEST,
} from './treeInventoryMigrations';
import {
  TREE_INVENTORY_SCHEMA_VERSION,
  TREE_STORAGE_KEYS,
} from './treeInventoryConstants';

const createMemoryStorage = () => {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    clear: () => map.clear(),
    dump: () => map,
  };
};

const read = (storage, key) => {
  const raw = storage.getItem(key);
  return raw ? JSON.parse(raw) : null;
};

describe('treeInventoryMigrations — versioning, backup, rollback and seeding', () => {
  let storage;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  it('reports a fresh store as needing migration without writing a backup during dry run', () => {
    const result = migrateTreeInventory({ storage, nowMs: 1_700_000_000_000, dryRun: true });
    expect(result.changed).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.fromVersion).toBe(0);
    expect(result.toVersion).toBe(TREE_INVENTORY_SCHEMA_VERSION);
    expect(result.preview.trees).toBe(0);
    expect(storage.getItem(TREE_STORAGE_KEYS.migrationBackup)).toBeNull();
    expect(storage.getItem(TREE_STORAGE_KEYS.meta)).toBeNull();
  });

  it('applies the current schema, seeds reference data and writes a rollback backup', () => {
    const result = migrateTreeInventory({ storage, nowMs: 1_700_000_000_000 });
    expect(result.changed).toBe(true);
    expect(result.backupAvailable).toBe(true);

    const meta = read(storage, TREE_STORAGE_KEYS.meta);
    expect(meta.schemaVersion).toBe(TREE_INVENTORY_SCHEMA_VERSION);
    expect(meta.previousVersion).toBe(0);
    expect(meta.backupAvailable).toBe(true);
    expect(read(storage, TREE_STORAGE_KEYS.species).length).toBeGreaterThan(0);
    expect(read(storage, TREE_STORAGE_KEYS.plantingSites).length).toBeGreaterThan(0);
    expect(read(storage, TREE_STORAGE_KEYS.trees)).toEqual([]);
    expect(storage.getItem(TREE_STORAGE_KEYS.migrationBackup)).not.toBeNull();

    const status = getTreeInventoryMigrationStatus(storage);
    expect(status.isCurrent).toBe(true);
    expect(status.needsMigration).toBe(false);
    expect(status.backupAvailable).toBe(true);

    const repeat = migrateTreeInventory({ storage });
    expect(repeat.changed).toBe(false);
  });

  it('rolls a fresh migration back to the exact pre-migration state', () => {
    migrateTreeInventory({ storage });
    const result = rollbackTreeInventoryMigration({ storage });
    expect(result.rolledBack).toBe(true);
    expect(result.restoredVersion).toBe(0);
    expect(storage.getItem(TREE_STORAGE_KEYS.meta)).toBeNull();
    expect(storage.getItem(TREE_STORAGE_KEYS.species)).toBeNull();
    expect(storage.getItem(TREE_STORAGE_KEYS.migrationBackup)).toBeNull();
  });

  it('normalises legacy trees and reports and can restore the legacy snapshot', () => {
    const legacyTree = {
      id: 'legacy_1',
      publicId: 'OLD-TREE-1',
      jurisdictionId: 'blr',
      species: 'sp_neem',
      condition: 'fair',
      latitude: 12.9716,
      longitude: 77.6412,
      notes: 'Legacy private note',
    };
    const legacyReport = {
      id: 'legacy_report_1',
      treeId: 'legacy_1',
      category: 'visible_damage',
      description: 'A legacy observation about a broken branch.',
    };
    storage.setItem(TREE_STORAGE_KEYS.trees, JSON.stringify([legacyTree]));
    storage.setItem(TREE_STORAGE_KEYS.legacyReports, JSON.stringify([legacyReport]));

    const result = migrateTreeInventory({ storage, nowMs: 1_700_000_000_000 });
    expect(result.changed).toBe(true);
    expect(result.preview.trees).toBe(1);

    const trees = read(storage, TREE_STORAGE_KEYS.trees);
    expect(trees).toHaveLength(1);
    expect(trees[0].publicId).toBe('OLD-TREE-1');
    expect(trees[0].speciesId).toBe('sp_neem');
    expect(trees[0].schemaVersion).toBe(TREE_INVENTORY_SCHEMA_VERSION);
    expect(trees[0].privateCoordinates).toEqual({ lat: 12.9716, lng: 77.6412 });
    expect(trees[0].approxCoordinates).toMatchObject({ lat: 12.97, lng: 77.64, precision: 'approx_1km' });
    expect(trees[0].privateNotes).toBe('Legacy private note');

    const reports = read(storage, TREE_STORAGE_KEYS.citizenReports);
    expect(reports).toHaveLength(1);
    expect(reports[0].trackingCode).toMatch(/^TREE-REP-/);
    expect(reports[0].state).toBe('submitted');

    const rollback = rollbackTreeInventoryMigration({ storage });
    expect(rollback.restoredVersion).toBe(0);
    expect(read(storage, TREE_STORAGE_KEYS.trees)).toEqual([legacyTree]);
    expect(read(storage, TREE_STORAGE_KEYS.legacyReports)).toEqual([legacyReport]);
  });

  it('seeds the demo register once and never overwrites real records', () => {
    const first = ensureTreeInventoryData({ storage, nowMs: 1_700_000_000_000 });
    expect(first.seeded).toBe(true);
    const trees = read(storage, TREE_STORAGE_KEYS.trees);
    expect(trees.length).toBeGreaterThan(0);
    expect(read(storage, TREE_STORAGE_KEYS.meta).demoSeeded).toBe(true);

    const second = ensureTreeInventoryData({ storage });
    expect(second.seeded).toBe(false);
    expect(read(storage, TREE_STORAGE_KEYS.trees)).toHaveLength(trees.length);
  });

  it('builds the documented query indexes from normalised collections', () => {
    ensureTreeInventoryData({ storage });
    const built = buildTreeInventoryIndexes(storage);
    expect(built.manifest).toHaveLength(TREE_INVENTORY_INDEX_MANIFEST.length);
    expect(Object.keys(built.byJurisdiction).length).toBeGreaterThan(0);
    expect(built.byInspectionDue.length).toBeGreaterThan(0);
    expect(built.bySearchText.length).toBeGreaterThan(0);
    expect(built.byWorkOrderState).toBeTypeOf('object');
    expect(built.byCitizenReportState).toBeTypeOf('object');
  });
});
