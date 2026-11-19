import { describe, it, expect, beforeEach } from 'vitest';
import {
  migratePedestrianBarrierSchema,
  rollbackPedestrianBarrierMigration,
  getPedestrianBarrierMigrationStatus,
  PEDESTRIAN_STORAGE_KEYS,
  PEDESTRIAN_INDEX_MANIFEST,
} from './pedestrianBarrierMigrations.js';
import { SCHEMA_VERSION } from '../data/pedestrianBarrierContract.js';

const createMemoryStorage = () => {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    clear: () => map.clear(),
  };
};

describe('pedestrianBarrierMigrations (#757)', () => {
  let storage;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  it('reports a fresh store as needing migration in dry-run mode without mutating storage', () => {
    const status = getPedestrianBarrierMigrationStatus({ storage });
    expect(status.currentVersion).toBe('0.0.0');
    expect(status.isUpToDate).toBe(false);

    const dryRunResult = migratePedestrianBarrierSchema({ storage, dryRun: true });
    expect(dryRunResult.dryRun).toBe(true);
    expect(dryRunResult.changed).toBe(true);
    expect(dryRunResult.toVersion).toBe(SCHEMA_VERSION);
    expect(storage.getItem(PEDESTRIAN_STORAGE_KEYS.meta)).toBeNull();
    expect(storage.getItem(PEDESTRIAN_STORAGE_KEYS.backup)).toBeNull();
  });

  it('migrates an empty database: seeds reference network, sets version, and creates backup', () => {
    const result = migratePedestrianBarrierSchema({ storage, dryRun: false });
    expect(result.success).toBe(true);
    expect(result.fromVersion).toBe('0.0.0');
    expect(result.toVersion).toBe(SCHEMA_VERSION);
    expect(result.backupAvailable).toBe(true);

    const meta = JSON.parse(storage.getItem(PEDESTRIAN_STORAGE_KEYS.meta));
    expect(meta.schemaVersion).toBe(SCHEMA_VERSION);
    expect(meta.backupAvailable).toBe(true);

    const segments = JSON.parse(storage.getItem(PEDESTRIAN_STORAGE_KEYS.segments));
    expect(segments.length).toBeGreaterThan(0);
    expect(segments[0].schemaVersion).toBe(SCHEMA_VERSION);

    const observations = JSON.parse(storage.getItem(PEDESTRIAN_STORAGE_KEYS.observations));
    expect(observations.length).toBeGreaterThan(0);
    expect(observations[0].schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('migrates a representative existing legacy dataset and backfills missing metadata fields', () => {
    const legacySegments = [
      {
        id: 'SEG-OLD-1',
        corridorName: 'Old Market Walkway',
        lengthMeters: 250,
        // Missing widthMeters, schemaVersion, lastInspectedAt
      },
    ];
    const legacyObservations = [
      {
        id: 'BAR-OLD-1',
        description: 'Old pothole report near shop.',
        barrierType: 'damaged_footpath',
        // Missing coordinates, schemaVersion, reportedBy
      },
    ];

    storage.setItem(PEDESTRIAN_STORAGE_KEYS.segments, JSON.stringify(legacySegments));
    storage.setItem(PEDESTRIAN_STORAGE_KEYS.observations, JSON.stringify(legacyObservations));

    const result = migratePedestrianBarrierSchema({ storage, dryRun: false });
    expect(result.success).toBe(true);

    const migratedSegments = JSON.parse(storage.getItem(PEDESTRIAN_STORAGE_KEYS.segments));
    expect(migratedSegments.length).toBe(1);
    expect(migratedSegments[0].id).toBe('SEG-OLD-1');
    expect(migratedSegments[0].widthMeters).toBe(1.8); // Backfilled default
    expect(migratedSegments[0].schemaVersion).toBe(SCHEMA_VERSION);

    const migratedObservations = JSON.parse(storage.getItem(PEDESTRIAN_STORAGE_KEYS.observations));
    expect(migratedObservations.length).toBe(1);
    expect(migratedObservations[0].id).toBe('BAR-OLD-1');
    expect(migratedObservations[0].coordinates).toBeDefined(); // Backfilled default
    expect(migratedObservations[0].schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('successfully rolls back schema changes to pre-migration snapshot', () => {
    // 1. Setup pre-migration state with specific marker
    const originalObservations = [{ id: 'BAR-PRE-MIGRATION', description: 'Original state' }];
    storage.setItem(PEDESTRIAN_STORAGE_KEYS.observations, JSON.stringify(originalObservations));

    // 2. Run migration
    migratePedestrianBarrierSchema({ storage, dryRun: false });

    // Verify migration updated record schemaVersion
    const inBetween = JSON.parse(storage.getItem(PEDESTRIAN_STORAGE_KEYS.observations));
    expect(inBetween[0].schemaVersion).toBe(SCHEMA_VERSION);

    // 3. Execute rollback
    const rollbackResult = rollbackPedestrianBarrierMigration({ storage });
    expect(rollbackResult.success).toBe(true);

    // 4. Verify original state restored
    const restored = JSON.parse(storage.getItem(PEDESTRIAN_STORAGE_KEYS.observations));
    expect(restored[0].id).toBe('BAR-PRE-MIGRATION');
    expect(restored[0].schemaVersion).toBeUndefined(); // Back to unmigrated state!
    expect(storage.getItem(PEDESTRIAN_STORAGE_KEYS.backup)).toBeNull(); // Backup consumed
  });

  it('validates the pedestrian barrier index manifest covers critical query patterns', () => {
    expect(PEDESTRIAN_INDEX_MANIFEST.length).toBeGreaterThanOrEqual(4);

    const indexNames = PEDESTRIAN_INDEX_MANIFEST.map((idx) => idx.name);
    expect(indexNames).toContain('byWardJurisdiction');
    expect(indexNames).toContain('byBarrierStatusAndSeverity');
    expect(indexNames).toContain('bySegmentId');
    expect(indexNames).toContain('byInspectionRecency');

    for (const entry of PEDESTRIAN_INDEX_MANIFEST) {
      expect(entry.collection).toBeDefined();
      expect(entry.fields.length).toBeGreaterThan(0);
      expect(entry.purpose).toBeDefined();
    }
  });
});
