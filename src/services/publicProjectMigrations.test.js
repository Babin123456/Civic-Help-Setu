import { describe, it, expect, beforeEach } from 'vitest';
import {
  getPublicProjectsMigrationStatus,
  applyPublicProjectsMigration,
  rollbackPublicProjectsMigration,
  exportPublicProjectAuditTrail,
  PUBLIC_PROJECTS_INDEX_MANIFEST,
  PUBLIC_PROJECTS_META_KEY,
  PUBLIC_PROJECTS_BACKUP_KEY,
} from './publicProjectMigrations';
import {
  PUBLIC_PROJECTS_STORAGE_KEY,
  PROJECT_MILESTONES_STORAGE_KEY,
  EVIDENCE_ASSETS_STORAGE_KEY,
  SCHEMA_VERSION,
} from './publicProjectService';

const createMemoryStorage = () => {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, val) => map.set(key, String(val)),
    removeItem: (key) => map.delete(key),
    map,
  };
};

describe('publicProjectMigrations (#752)', () => {
  let storage;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  describe('Index Manifest & Query Coverage', () => {
    it('documents query indexes for jurisdiction, category, milestone sequence, and evidence hash', () => {
      expect(PUBLIC_PROJECTS_INDEX_MANIFEST.length).toBeGreaterThanOrEqual(4);
      const names = PUBLIC_PROJECTS_INDEX_MANIFEST.map((idx) => idx.name);
      expect(names).toContain('byJurisdictionStatus');
      expect(names).toContain('byCategoryStatus');
      expect(names).toContain('byMilestoneSequence');
      expect(names).toContain('byEvidenceAssetHash');
    });
  });

  describe('Migration against an Empty Database (Bootstrap)', () => {
    it('detects that an empty database needs migration', () => {
      const status = getPublicProjectsMigrationStatus(storage);
      expect(status.needsMigration).toBe(true);
      expect(status.isCurrent).toBe(false);
      expect(status.currentVersion).toBe(0);
    });

    it('boots an empty database with seed projects and marks schema version current', () => {
      const result = applyPublicProjectsMigration(storage);
      expect(result.applied).toBe(true);
      expect(result.migrationType).toBe('BOOTSTRAP_SEED');

      const status = getPublicProjectsMigrationStatus(storage);
      expect(status.isCurrent).toBe(true);
      expect(status.currentVersion).toBe(SCHEMA_VERSION);
      expect(status.counts.projects).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Migration against a Representative Existing Dataset (Legacy Normalization)', () => {
    it('normalizes legacy unversioned projects and backfills required attributes', () => {
      // Simulate existing legacy dataset (v0)
      const legacyProjects = [
        {
          id: 'proj_legacy_old_1',
          title: 'Old Pipeline Repair Corridor',
          ward: 'Ward 80',
          zone: 'West Zone',
          category: 'drains',
          // Missing schemaVersion, overallProgressPercent, locationGeometry, budgetReference
        },
      ];
      storage.setItem(PUBLIC_PROJECTS_STORAGE_KEY, JSON.stringify(legacyProjects));

      // Simulate legacy milestones
      const legacyMilestones = [
        {
          id: 'ms_old_1',
          projectId: 'proj_legacy_old_1',
          title: 'Trench digging',
          // Missing weightPercentage, schemaVersion
        },
      ];
      storage.setItem(PROJECT_MILESTONES_STORAGE_KEY, JSON.stringify(legacyMilestones));

      // Simulate legacy evidence assets without hash
      const legacyAssets = [
        {
          id: 'asset_old_1',
          storageUrl: 'https://storage/old.jpg',
          // Missing assetHash, schemaVersion
        },
      ];
      storage.setItem(EVIDENCE_ASSETS_STORAGE_KEY, JSON.stringify(legacyAssets));

      const statusBefore = getPublicProjectsMigrationStatus(storage);
      expect(statusBefore.needsMigration).toBe(true);

      const result = applyPublicProjectsMigration(storage);
      expect(result.applied).toBe(true);
      expect(result.migrationType).toBe('LEGACY_TRANSFORMATION');

      // Verify transformed project has schemaVersion and defaults
      const migratedProjects = JSON.parse(storage.getItem(PUBLIC_PROJECTS_STORAGE_KEY));
      expect(migratedProjects[0].schemaVersion).toBe(SCHEMA_VERSION);
      expect(migratedProjects[0].overallProgressPercent).toBe(0);
      expect(migratedProjects[0].jurisdiction.wardNumber).toBe('Ward 80');

      // Verify milestone has weight and schemaVersion
      const migratedMilestones = JSON.parse(storage.getItem(PROJECT_MILESTONES_STORAGE_KEY));
      expect(migratedMilestones[0].weightPercentage).toBe(25);
      expect(migratedMilestones[0].schemaVersion).toBe(SCHEMA_VERSION);

      // Verify asset was backfilled with assetHash
      const migratedAssets = JSON.parse(storage.getItem(EVIDENCE_ASSETS_STORAGE_KEY));
      expect(migratedAssets[0].assetHash).toBeDefined();
      expect(migratedAssets[0].assetHash.length).toBe(64);
      expect(migratedAssets[0].schemaVersion).toBe(SCHEMA_VERSION);
    });
  });

  describe('Snapshot & Rollback Strategy', () => {
    it('creates pre-migration snapshot and safely rolls back to previous state', () => {
      // 1. Initial state
      const initialProjects = [{ id: 'proj-pre-migration', title: 'Pre-migration title' }];
      storage.setItem(PUBLIC_PROJECTS_STORAGE_KEY, JSON.stringify(initialProjects));

      // 2. Apply migration
      applyPublicProjectsMigration(storage);
      const postMigration = JSON.parse(storage.getItem(PUBLIC_PROJECTS_STORAGE_KEY));
      expect(postMigration[0].schemaVersion).toBe(SCHEMA_VERSION);

      // 3. Rollback
      const rollbackResult = rollbackPublicProjectsMigration(storage);
      expect(rollbackResult.rolledBack).toBe(true);

      // 4. Verify original state restored
      const restored = JSON.parse(storage.getItem(PUBLIC_PROJECTS_STORAGE_KEY));
      expect(restored[0].id).toBe('proj-pre-migration');
      expect(restored[0].schemaVersion).toBeUndefined(); // Back to unversioned original!
    });
  });

  describe('Cryptographic Audit Trail Export', () => {
    it('exports audit trail with calculated integrity digest', () => {
      applyPublicProjectsMigration(storage);
      const auditExport = exportPublicProjectAuditTrail(null, storage);

      expect(auditExport.totalEntries).toBeGreaterThanOrEqual(1);
      expect(auditExport.exportTimestamp).toBeDefined();
      expect(auditExport.exportIntegrityDigest).toBeDefined();
      expect(auditExport.exportIntegrityDigest.length).toBe(64);
    });
  });
});
