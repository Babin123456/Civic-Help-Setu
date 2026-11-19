import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  listProfiles,
  createProfile,
  updateProfile,
  executeGenerationJob,
  listArtifacts,
  getArtifactData,
  deleteArtifact,
  purgeExpiredArtifacts,
  loadArtifactIntoLocalTestEnvironment,
  migrateSyntheticStores,
  rollbackSyntheticMigration,
  isArtifactStale,
  listAuditLogs,
  SYNTHETIC_STORAGE_KEYS,
  readStore,
  writeStore,
} from './syntheticDatasetService';
import { setCurrentActor } from './accessControl';
import { getAllServices } from './serviceCatalog';

describe('syntheticDatasetService (#778)', () => {
  let memoryStore = new Map();

  beforeEach(() => {
    memoryStore = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (k) => memoryStore.get(k) || null,
      setItem: (k, v) => memoryStore.set(k, String(v)),
      removeItem: (k) => memoryStore.delete(k),
      clear: () => memoryStore.clear(),
    });
    setCurrentActor({ id: 'test-admin', role: 'admin' });
  });

  afterEach(() => {
    memoryStore.clear();
    setCurrentActor(null);
    vi.unstubAllGlobals();
  });

  describe('Profile Management', () => {
    it('lists preset scenario profiles out of the box', () => {
      const profiles = listProfiles();
      expect(profiles.length).toBeGreaterThanOrEqual(4);
      expect(profiles.some((p) => p.profileId === 'scen-pune-grievance-surge')).toBe(true);
    });

    it('creates and persists a sanitized custom profile', () => {
      const profile = createProfile({
        scenarioName: 'Test Custom Scenario <script>alert(1)</script>',
        description: 'Test Description',
        seed: 1234567,
        scaleConfig: { servicesCount: 3, officesCount: 2, applicationsCount: 10, grievancesCount: 5 },
      });

      expect(profile.profileId).toContain('prof-custom-');
      // Script tags stripped
      expect(profile.scenarioName).not.toContain('<script>');
      expect(profile.seed).toBe(1234567);

      const all = listProfiles();
      expect(all.some((p) => p.profileId === profile.profileId)).toBe(true);
    });
  });

  describe('Job Execution & Certification', () => {
    it('executes a generation job, audits PII, and stores certified artifact', async () => {
      const profile = listProfiles()[0];
      const result = await executeGenerationJob(profile, 'idemp-test-01');

      expect(result.job.status).toBe('completed');
      expect(result.job.progressPercent).toBe(100);
      expect(result.artifactMeta.piiAuditStatus).toBe('clean');
      expect(result.validationRun.passed).toBe(true);

      // Verify artifact metadata is persisted
      const artifacts = listArtifacts();
      expect(artifacts).toHaveLength(1);
      expect(artifacts[0].artifactId).toBe(result.artifactMeta.artifactId);

      // Verify artifact data payload can be retrieved
      const data = getArtifactData(result.artifactMeta.artifactId);
      expect(data.applications.length).toBeGreaterThan(0);
      expect(data.services.length).toBeGreaterThan(0);
    });

    it('handles idempotent replay without re-generating', async () => {
      const profile = listProfiles()[0];
      const run1 = await executeGenerationJob(profile, 'idemp-fixed-key');
      const run2 = await executeGenerationJob(profile, 'idemp-fixed-key');

      expect(run2.isIdempotentReplay).toBe(true);
      expect(run2.job.jobId).toBe(run1.job.jobId);
    });
  });

  describe('Local Test Environment Injection', () => {
    it('loads synthetic services into civicbridge_custom_services store', async () => {
      const profile = listProfiles()[0];
      const { artifactMeta } = await executeGenerationJob(profile);

      const res = loadArtifactIntoLocalTestEnvironment(artifactMeta.artifactId, { loadServices: true });
      expect(res.success).toBe(true);
      expect(res.loadedServicesCount).toBeGreaterThan(0);

      const customServices = readStore('civicbridge_custom_services', []);
      expect(customServices.length).toBe(res.loadedServicesCount);
      expect(customServices[0].id).toContain('SYN-SRV-');
      expect(customServices[0].isSynthetic).toBe(true);

      // Verify that the global app service catalogue immediately surfaces the synthetic services
      const allAppServices = getAllServices();
      expect(allAppServices.some((s) => s.id === customServices[0].id)).toBe(true);
    });
  });

  describe('Retention & Artifact Deletion', () => {
    it('deletes an artifact and removes its data store', async () => {
      const profile = listProfiles()[0];
      const { artifactMeta } = await executeGenerationJob(profile);

      expect(listArtifacts()).toHaveLength(1);
      deleteArtifact(artifactMeta.artifactId);
      expect(listArtifacts()).toHaveLength(0);
      expect(() => getArtifactData(artifactMeta.artifactId)).toThrow();
    });

    it('purges expired artifacts based on retentionExpiresAt', () => {
      const expiredMeta = {
        artifactId: 'art-expired-01',
        dataStorageKey: `${SYNTHETIC_STORAGE_KEYS.DATA_PREFIX}art-expired-01`,
        retentionExpiresAt: new Date(Date.now() - 10000).toISOString(), // expired
      };
      const activeMeta = {
        artifactId: 'art-active-02',
        dataStorageKey: `${SYNTHETIC_STORAGE_KEYS.DATA_PREFIX}art-active-02`,
        retentionExpiresAt: new Date(Date.now() + 1000000).toISOString(), // active
      };

      writeStore(SYNTHETIC_STORAGE_KEYS.ARTIFACTS_META, [expiredMeta, activeMeta]);
      writeStore(expiredMeta.dataStorageKey, { expired: true });
      writeStore(activeMeta.dataStorageKey, { active: true });

      const res = purgeExpiredArtifacts();
      expect(res.purgedCount).toBe(1);
      expect(res.remainingCount).toBe(1);

      const remaining = listArtifacts();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].artifactId).toBe('art-active-02');
    });
  });

  describe('Profile Updates & Audit Logging', () => {
    it('updates a custom profile and writes an audit event', () => {
      const created = createProfile({
        scenarioName: 'Initial Scenario',
        seed: 5555,
      });

      const updated = updateProfile(created.profileId, {
        scenarioName: 'Updated Scenario Title',
      });

      expect(updated.scenarioName).toBe('Updated Scenario Title');

      const logs = listAuditLogs();
      expect(logs.some((l) => l.action === 'profile.updated')).toBe(true);
    });

    it('rejects modifying built-in preset scenarios', () => {
      expect(() =>
        updateProfile('scen-pune-grievance-surge', { scenarioName: 'Hacked' })
      ).toThrow();
    });
  });

  describe('Schema Migrations & Rollback Strategy', () => {
    it('migrates profile and artifact schemas to target version and rolls back on demand', () => {
      createProfile({ scenarioName: 'Pre-migration Profile', seed: 7777 });

      const migResult = migrateSyntheticStores('1.2.0');
      expect(migResult.success).toBe(true);
      expect(migResult.targetVersion).toBe('1.2.0');

      const migratedProfiles = listProfiles();
      const customP = migratedProfiles.find((p) => !p.isPreset);
      expect(customP.schemaVersion).toBe('1.2.0');

      // Now rollback
      const rollResult = rollbackSyntheticMigration();
      expect(rollResult.success).toBe(true);

      const restoredProfiles = listProfiles();
      const restoredCustom = restoredProfiles.find((p) => !p.isPreset);
      expect(restoredCustom.schemaVersion).toBe('1.0.0');
    });

    it('detects stale artifact schema versions', () => {
      expect(isArtifactStale({ schemaVersion: '0.9.0' }, '1.0.0')).toBe(true);
      expect(isArtifactStale({ schemaVersion: '1.0.0' }, '1.0.0')).toBe(false);
    });
  });

  describe('Authorization & Access Control', () => {
    it('permits citizens to generate synthetic datasets in testing mode', async () => {
      setCurrentActor({ id: 'citizen-contributor', role: 'citizen' });
      const profile = listProfiles()[0];
      const result = await executeGenerationJob(profile);
      expect(result.job.status).toBe('completed');
    });

    it('denies citizens from performing admin-only schema migrations', () => {
      setCurrentActor({ id: 'citizen-contributor', role: 'citizen' });
      expect(() => migrateSyntheticStores('2.0.0')).toThrow();
      expect(() => rollbackSyntheticMigration()).toThrow();
    });
  });
});
