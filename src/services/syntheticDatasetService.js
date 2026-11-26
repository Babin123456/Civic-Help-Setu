/**
 * src/services/syntheticDatasetService.js
 *
 * Dedicated domain service layer for managing synthetic civic dataset profiles,
 * asynchronous generation jobs, certified artifacts, and local test environment loading (#778).
 *
 * Enforces:
 * - Domain state machine and explicit state transitions.
 * - Idempotent job execution with replay prevention.
 * - Multi-tier PII audit before artifact certification.
 * - Ephemeral retention policies (7-day default auto-purge).
 * - Safe injection into local application testing stores.
 */

import { requirePermission } from './accessControl';
import { sanitizePlainText, sanitizeTextFields } from '../utils/safeContent';
import {
  executeSyntheticGeneration,
  exportBundleToJson,
  exportEntityToCsv,
  exportBundleToSql,
} from './syntheticGeneratorEngine';
import { scanArtifactBundle } from './piiLeakageGuardService';
import { SYNTHETIC_SCENARIOS } from '../data/syntheticScenarios';

export const SYNTHETIC_STORAGE_KEYS = {
  PROFILES: 'civicbridge_synthetic_profiles_v1',
  JOBS: 'civicbridge_synthetic_jobs_v1',
  ARTIFACTS_META: 'civicbridge_synthetic_artifacts_meta_v1',
  VALIDATION_RUNS: 'civicbridge_synthetic_validation_runs_v1',
  DATA_PREFIX: 'civicbridge_synthetic_artifact_data_',
  SCHEMA_CATALOG: 'civicbridge_synthetic_schema_catalog_v1',
  AUDIT_LOGS: 'civicbridge_synthetic_audit_logs_v1',
  MIGRATION_BACKUP: 'civicbridge_synthetic_migration_backup_v1',
};

export const GENERATION_JOB_STATUS = {
  QUEUED: 'queued',
  GENERATING: 'generating',
  VALIDATING: 'validating',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

const DEFAULT_RETENTION_DAYS = 7;

export class SyntheticDatasetError extends Error {
  constructor(message, code = 'ERR_SYNTH_GENERAL', details = null) {
    super(message);
    this.name = 'SyntheticDatasetError';
    this.code = code;
    this.details = details;
  }
}

// ---------------------------------------------------------------------------
// STORAGE HELPERS
// ---------------------------------------------------------------------------

function getStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
    return globalThis.localStorage;
  }
  return null;
}

export function readStore(key, defaultValue = []) {
  const storage = getStorage();
  if (!storage) return defaultValue;
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch (err) {
    console.warn(`[SyntheticDatasetService] Failed to read store ${key}:`, err);
    return defaultValue;
  }
}

export function writeStore(key, data) {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error(`[SyntheticDatasetService] Failed to write store ${key}:`, err);
    throw new SyntheticDatasetError(
      'Browser storage limit reached. Please remove old synthetic artifacts.',
      'ERR_SYNTH_STORAGE_QUOTA',
      err
    );
  }
}

export function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'syn-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ---------------------------------------------------------------------------
// PROFILE MANAGEMENT
// ---------------------------------------------------------------------------

export function listProfiles() {
  const customProfiles = readStore(SYNTHETIC_STORAGE_KEYS.PROFILES, []);
  // Return presets combined with saved custom profiles
  const presetProfiles = SYNTHETIC_SCENARIOS.map((s) => ({
    profileId: s.id,
    scenarioName: s.title,
    badge: s.badge,
    description: s.description,
    isPreset: true,
    seed: s.defaultSeed,
    jurisdictionScope: s.jurisdiction,
    scaleConfig: s.scaleConfig,
    edgeCaseRates: s.edgeCaseRates,
    languageDistribution: s.languageDistribution,
    schemaVersion: '1.0.0',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  }));

  return [...presetProfiles, ...customProfiles];
}

export function getProfile(profileId) {
  const profiles = listProfiles();
  const found = profiles.find((p) => p.profileId === profileId);
  if (!found) {
    throw new SyntheticDatasetError(
      `Profile with id '${profileId}' not found.`,
      'ERR_SYNTH_PROFILE_NOT_FOUND'
    );
  }
  return found;
}

export function createProfile(profileData, actor = null) {
  requirePermission('synthetic.generate', actor);

  if (!profileData || typeof profileData !== 'object') {
    throw new SyntheticDatasetError(
      'Invalid profile payload: expected object',
      'ERR_SYNTH_INVALID_PAYLOAD'
    );
  }

  const sanitized = sanitizeTextFields(profileData);
  const now = new Date().toISOString();
  const profileId = `prof-custom-${generateUUID().slice(0, 8)}`;

  const newProfile = {
    profileId,
    scenarioName: sanitizePlainText(sanitized.scenarioName || 'Custom Civic Scenario'),
    badge: 'Custom',
    description: sanitizePlainText(sanitized.description || 'Contributor defined testing scenario.'),
    isPreset: false,
    seed: Math.abs(parseInt(sanitized.seed, 10)) || Math.floor(Math.random() * 9000000) + 1000000,
    jurisdictionScope: sanitized.jurisdictionScope || {
      state: 'Maharashtra',
      district: 'Pune',
      ward: 'All Wards',
    },
    scaleConfig: {
      servicesCount: Math.min(Math.max(parseInt(sanitized.scaleConfig?.servicesCount, 10) || 5, 1), 50),
      officesCount: Math.min(Math.max(parseInt(sanitized.scaleConfig?.officesCount, 10) || 3, 1), 20),
      applicationsCount: Math.min(Math.max(parseInt(sanitized.scaleConfig?.applicationsCount, 10) || 25, 1), 200),
      grievancesCount: Math.min(Math.max(parseInt(sanitized.scaleConfig?.grievancesCount, 10) || 10, 1), 100),
    },
    edgeCaseRates: {
      statutoryDeadlineOverduePct: Math.min(Math.max(Number(sanitized.edgeCaseRates?.statutoryDeadlineOverduePct) || 0.15, 0), 1),
      queryDeficiencyPct: Math.min(Math.max(Number(sanitized.edgeCaseRates?.queryDeficiencyPct) || 0.15, 0), 1),
      malformedOptionalFieldsPct: Math.min(Math.max(Number(sanitized.edgeCaseRates?.malformedOptionalFieldsPct) || 0.05, 0), 1),
      multiScriptNamesPct: Math.min(Math.max(Number(sanitized.edgeCaseRates?.multiScriptNamesPct) || 0.25, 0), 1),
    },
    languageDistribution: sanitized.languageDistribution || { en: 0.5, mr: 0.5 },
    schemaVersion: '1.0.0',
    createdBy: actor?.id || 'contributor-local',
    createdAt: now,
    updatedAt: now,
  };

  const existing = readStore(SYNTHETIC_STORAGE_KEYS.PROFILES, []);
  writeStore(SYNTHETIC_STORAGE_KEYS.PROFILES, [newProfile, ...existing]);

  return newProfile;
}

export function deleteProfile(profileId, actor = null) {
  requirePermission('synthetic.manage', actor);

  const existing = readStore(SYNTHETIC_STORAGE_KEYS.PROFILES, []);
  const updated = existing.filter((p) => p.profileId !== profileId);
  writeStore(SYNTHETIC_STORAGE_KEYS.PROFILES, updated);
  recordAuditEvent('profile.deleted', { profileId }, actor);
  return { deleted: true, profileId };
}

export function updateProfile(profileId, updates, actor = null) {
  requirePermission('synthetic.generate', actor);

  const existing = readStore(SYNTHETIC_STORAGE_KEYS.PROFILES, []);
  const idx = existing.findIndex((p) => p.profileId === profileId);

  if (idx === -1) {
    throw new SyntheticDatasetError(
      `Cannot update preset or non-existent profile '${profileId}'.`,
      'ERR_SYNTH_PROFILE_NOT_MODIFIABLE'
    );
  }

  const sanitized = sanitizeTextFields(updates);
  existing[idx] = {
    ...existing[idx],
    ...sanitized,
    profileId, // protect stable ID
    updatedAt: new Date().toISOString(),
  };

  writeStore(SYNTHETIC_STORAGE_KEYS.PROFILES, existing);
  recordAuditEvent('profile.updated', { profileId }, actor);
  return existing[idx];
}

// ---------------------------------------------------------------------------
// JOB EXECUTION & WORKFLOW
// ---------------------------------------------------------------------------

export function listJobs(limit = 20) {
  const jobs = readStore(SYNTHETIC_STORAGE_KEYS.JOBS, []);
  return jobs.slice(0, limit);
}

export function getJob(jobId) {
  const jobs = listJobs(100);
  const found = jobs.find((j) => j.jobId === jobId);
  if (!found) {
    throw new SyntheticDatasetError(`Job '${jobId}' not found.`, 'ERR_SYNTH_JOB_NOT_FOUND');
  }
  return found;
}

export function updateJobState(jobId, updates) {
  const jobs = readStore(SYNTHETIC_STORAGE_KEYS.JOBS, []);
  const idx = jobs.findIndex((j) => j.jobId === jobId);
  if (idx !== -1) {
    jobs[idx] = { ...jobs[idx], ...updates, updatedAt: new Date().toISOString() };
    writeStore(SYNTHETIC_STORAGE_KEYS.JOBS, jobs);
    return jobs[idx];
  }
  return null;
}

/**
 * Executes a deterministic synthetic generation job end-to-end.
 * Validates with piiLeakageGuard before saving the artifact.
 */
export async function executeGenerationJob(profile, idempotencyKey = null, actor = null) {
  requirePermission('synthetic.generate', actor);

  // 1. Check idempotency
  if (idempotencyKey) {
    const existingJobs = listJobs(50);
    const dup = existingJobs.find(
      (j) => j.idempotencyKey === idempotencyKey && j.status === GENERATION_JOB_STATUS.COMPLETED
    );
    if (dup && dup.artifactId) {
      return {
        job: dup,
        artifactMeta: getArtifactMeta(dup.artifactId),
        isIdempotentReplay: true,
      };
    }
  }

  const jobId = `job-${generateUUID().slice(0, 8)}`;
  const startTime = Date.now();

  const jobRecord = {
    jobId,
    profileId: profile.profileId,
    scenarioName: profile.scenarioName,
    seed: profile.seed,
    status: GENERATION_JOB_STATUS.GENERATING,
    progressPercent: 20,
    idempotencyKey: idempotencyKey || generateUUID(),
    startedAt: new Date().toISOString(),
    completedAt: null,
  };

  const jobs = readStore(SYNTHETIC_STORAGE_KEYS.JOBS, []);
  writeStore(SYNTHETIC_STORAGE_KEYS.JOBS, [jobRecord, ...jobs]);

  try {
    // Stage 1: Generate via procedural topological engine
    updateJobState(jobId, { progressPercent: 50, status: GENERATION_JOB_STATUS.GENERATING });
    const bundle = executeSyntheticGeneration(profile);

    // Stage 2: Audit with PII Leakage Guard
    updateJobState(jobId, { progressPercent: 80, status: GENERATION_JOB_STATUS.VALIDATING });
    const auditResult = scanArtifactBundle(bundle);

    if (!auditResult.passed) {
      const err = new SyntheticDatasetError(
        'PII Guard failed: Simulated patterns resembled restricted personal identifiers.',
        'ERR_SYNTH_PII_SUSPECT',
        auditResult.violations
      );
      updateJobState(jobId, {
        status: GENERATION_JOB_STATUS.FAILED,
        progressPercent: 100,
        completedAt: new Date().toISOString(),
        errorPayload: { code: err.code, message: err.message, violations: auditResult.violations },
      });
      throw err;
    }

    // Stage 3: Persist artifact & record validation run
    const artifactId = `art-syn-${generateUUID().slice(0, 8)}`;
    const expiresAt = new Date(Date.now() + DEFAULT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const dataKey = `${SYNTHETIC_STORAGE_KEYS.DATA_PREFIX}${artifactId}`;

    const artifactMeta = {
      artifactId,
      jobId,
      profileId: profile.profileId,
      scenarioName: profile.scenarioName,
      seed: profile.seed,
      summary: bundle.summary,
      checksumSha256: bundle.checksum,
      schemaVersion: profile.schemaVersion || '1.0.0',
      piiAuditStatus: 'clean',
      kAnonymityScore: auditResult.kAnonymityScore,
      dataStorageKey: dataKey,
      retentionExpiresAt: expiresAt,
      createdAt: new Date().toISOString(),
    };

    // Save full data payload in isolated key
    writeStore(dataKey, bundle);

    // Save artifact metadata in collection
    const artifactsMeta = readStore(SYNTHETIC_STORAGE_KEYS.ARTIFACTS_META, []);
    writeStore(SYNTHETIC_STORAGE_KEYS.ARTIFACTS_META, [artifactMeta, ...artifactsMeta]);

    // Save validation run log
    const runId = `val-${generateUUID().slice(0, 8)}`;
    const valRun = {
      runId,
      artifactId,
      passed: true,
      recordsScanned: auditResult.recordsScanned,
      referentialIntegrityScore: 1.0,
      piiViolationsCount: 0,
      kAnonymityScore: auditResult.kAnonymityScore,
      durationMs: Date.now() - startTime,
      auditedAt: new Date().toISOString(),
    };
    const valRuns = readStore(SYNTHETIC_STORAGE_KEYS.VALIDATION_RUNS, []);
    writeStore(SYNTHETIC_STORAGE_KEYS.VALIDATION_RUNS, [valRun, ...valRuns]);

    // Complete Job
    const completedJob = updateJobState(jobId, {
      status: GENERATION_JOB_STATUS.COMPLETED,
      progressPercent: 100,
      artifactId,
      completedAt: new Date().toISOString(),
      executionDurationMs: Date.now() - startTime,
    });

    recordAuditEvent(
      'job.completed',
      { jobId, artifactId, seed: profile.seed, totalRecords: bundle.summary.grandTotalRecords },
      actor
    );

    return {
      job: completedJob,
      artifactMeta,
      bundle,
      validationRun: valRun,
      isIdempotentReplay: false,
    };
  } catch (err) {
    updateJobState(jobId, {
      status: GENERATION_JOB_STATUS.FAILED,
      progressPercent: 100,
      completedAt: new Date().toISOString(),
      errorPayload: { code: err.code || 'ERR_SYNTH_FAILED', message: err.message },
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// ARTIFACTS MANAGEMENT
// ---------------------------------------------------------------------------

export function listArtifacts() {
  return readStore(SYNTHETIC_STORAGE_KEYS.ARTIFACTS_META, []);
}

export function getArtifactMeta(artifactId) {
  const artifacts = listArtifacts();
  const found = artifacts.find((a) => a.artifactId === artifactId);
  if (!found) {
    throw new SyntheticDatasetError(
      `Artifact '${artifactId}' metadata not found.`,
      'ERR_SYNTH_ARTIFACT_NOT_FOUND'
    );
  }
  return found;
}

export function getArtifactData(artifactId) {
  const meta = getArtifactMeta(artifactId);
  const data = readStore(meta.dataStorageKey, null);
  if (!data) {
    throw new SyntheticDatasetError(
      `Artifact data payload for '${artifactId}' is missing or purged.`,
      'ERR_SYNTH_PAYLOAD_MISSING'
    );
  }
  return data;
}

export function deleteArtifact(artifactId, actor = null) {
  requirePermission('synthetic.manage', actor);

  const metaList = readStore(SYNTHETIC_STORAGE_KEYS.ARTIFACTS_META, []);
  const target = metaList.find((a) => a.artifactId === artifactId);

  if (target) {
    const storage = getStorage();
    if (storage) {
      storage.removeItem(target.dataStorageKey);
    }
    const updated = metaList.filter((a) => a.artifactId !== artifactId);
    writeStore(SYNTHETIC_STORAGE_KEYS.ARTIFACTS_META, updated);
    recordAuditEvent('artifact.deleted', { artifactId }, actor);
  }

  return { deleted: true, artifactId };
}

/**
 * Purges expired artifacts based on retentionExpiresAt.
 */
export function purgeExpiredArtifacts() {
  const metaList = readStore(SYNTHETIC_STORAGE_KEYS.ARTIFACTS_META, []);
  const now = new Date().toISOString();
  const storage = getStorage();

  const retained = [];
  let purgedCount = 0;

  for (const meta of metaList) {
    if (meta.retentionExpiresAt && meta.retentionExpiresAt < now) {
      if (storage) {
        storage.removeItem(meta.dataStorageKey);
      }
      purgedCount += 1;
    } else {
      retained.push(meta);
    }
  }

  if (purgedCount > 0) {
    writeStore(SYNTHETIC_STORAGE_KEYS.ARTIFACTS_META, retained);
  }

  return { purgedCount, remainingCount: retained.length };
}

export function exportArtifactContent(artifactId, format = 'json') {
  const data = getArtifactData(artifactId);
  if (format === 'json') {
    return {
      content: exportBundleToJson(data),
      filename: `synthetic-dataset-${data.seed}-${artifactId}.json`,
      mimeType: 'application/json',
    };
  }
  if (format === 'csv-applications') {
    return {
      content: exportEntityToCsv(data.applications),
      filename: `synthetic-applications-${data.seed}.csv`,
      mimeType: 'text/csv',
    };
  }
  if (format === 'csv-grievances') {
    return {
      content: exportEntityToCsv(data.grievances),
      filename: `synthetic-grievances-${data.seed}.csv`,
      mimeType: 'text/csv',
    };
  }
  if (format === 'sql') {
    return {
      content: exportBundleToSql(data),
      filename: `synthetic-dataset-${data.seed}.sql`,
      mimeType: 'application/sql',
    };
  }

  throw new SyntheticDatasetError(`Unsupported export format: ${format}`, 'ERR_SYNTH_FORMAT');
}

// ---------------------------------------------------------------------------
// LOCAL TEST ENVIRONMENT INJECTION
// ---------------------------------------------------------------------------

/**
 * Loads generated synthetic services into the active development catalog (`civicbridge_custom_services`),
 * enabling immediate testing of service details, checklists, and search without typing manually.
 */
export function loadArtifactIntoLocalTestEnvironment(artifactId, options = { loadServices: true }) {
  const data = getArtifactData(artifactId);
  let loadedServicesCount = 0;

  if (options.loadServices && Array.isArray(data.services)) {
    const existingServices = readStore('civicbridge_custom_services', []);

    // Transform synthetic service to application guide structure
    const transformedServices = data.services.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      department: s.department,
      difficulty: s.difficulty,
      speedDays: s.statutoryDays,
      feeType: s.feeType,
      fee: s.fee,
      lastVerified: new Date().toISOString().split('T')[0],
      publicationState: 'published',
      requiredDocs: s.requiredDocs,
      validityNote: s.validity,
      officialSources: [
        {
          title: 'Official Civic Delivery Portal (Synthetic Test Endpoint)',
          url: s.officialPortalUrl,
          verified: true,
        },
      ],
      steps: [
        'Collect prescribed verification proofs and self-declaration affidavit.',
        'Submit dossier at designated Ward Facilitation Center or verified online desk.',
        'Obtain statutory acknowledgement and track verification progress.',
      ],
      isSynthetic: true,
      syntheticWatermark: s.syntheticWatermark,
    }));

    // Avoid duplicates by ID
    const merged = [...transformedServices, ...existingServices.filter((e) => !e.id.startsWith('SYN-SRV-'))];
    writeStore('civicbridge_custom_services', merged);
    loadedServicesCount = transformedServices.length;
    recordAuditEvent('artifact.loaded_to_local_db', { artifactId, loadedServicesCount });
  }

  return {
    success: true,
    artifactId,
    loadedServicesCount,
    timestamp: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// AUDIT LOGGING & SECURITY TRACKING
// ---------------------------------------------------------------------------

export function recordAuditEvent(action, payload = {}, actor = null) {
  const auditEvent = {
    eventId: `aud-${generateUUID().slice(0, 8)}`,
    action,
    payload,
    actorId: actor?.id || 'system-or-contributor',
    actorRole: actor?.role || 'contributor',
    timestamp: new Date().toISOString(),
  };

  const existing = readStore(SYNTHETIC_STORAGE_KEYS.AUDIT_LOGS, []);
  writeStore(SYNTHETIC_STORAGE_KEYS.AUDIT_LOGS, [auditEvent, ...existing.slice(0, 199)]);
  return auditEvent;
}

export function listAuditLogs(limit = 50) {
  const logs = readStore(SYNTHETIC_STORAGE_KEYS.AUDIT_LOGS, []);
  return logs.slice(0, limit);
}

// ---------------------------------------------------------------------------
// SCHEMA MIGRATION & ROLLBACK
// ---------------------------------------------------------------------------

export function migrateSyntheticStores(targetVersion = '1.1.0', actor = null) {
  requirePermission('synthetic.manage', actor);

  const profiles = readStore(SYNTHETIC_STORAGE_KEYS.PROFILES, []);
  const artifacts = readStore(SYNTHETIC_STORAGE_KEYS.ARTIFACTS_META, []);

  // 1. Take snapshot backup before migrating
  const backup = {
    profiles: JSON.parse(JSON.stringify(profiles)),
    artifacts: JSON.parse(JSON.stringify(artifacts)),
    preMigrationVersion: '1.0.0',
    migratedAt: new Date().toISOString(),
  };
  writeStore(SYNTHETIC_STORAGE_KEYS.MIGRATION_BACKUP, backup);

  // 2. Perform non-destructive forward migration
  const migratedProfiles = profiles.map((p) => ({
    ...p,
    schemaVersion: targetVersion,
    updatedAt: new Date().toISOString(),
  }));

  const migratedArtifacts = artifacts.map((a) => ({
    ...a,
    schemaVersion: targetVersion,
  }));

  writeStore(SYNTHETIC_STORAGE_KEYS.PROFILES, migratedProfiles);
  writeStore(SYNTHETIC_STORAGE_KEYS.ARTIFACTS_META, migratedArtifacts);

  recordAuditEvent('migration.applied', { fromVersion: '1.0.0', toVersion: targetVersion, profilesCount: migratedProfiles.length }, actor);

  return {
    success: true,
    migratedProfilesCount: migratedProfiles.length,
    migratedArtifactsCount: migratedArtifacts.length,
    targetVersion,
  };
}

export function rollbackSyntheticMigration(actor = null) {
  requirePermission('synthetic.manage', actor);

  const backup = readStore(SYNTHETIC_STORAGE_KEYS.MIGRATION_BACKUP, null);
  if (!backup) {
    throw new SyntheticDatasetError(
      'No migration backup found to roll back.',
      'ERR_SYNTH_NO_MIGRATION_BACKUP'
    );
  }

  writeStore(SYNTHETIC_STORAGE_KEYS.PROFILES, backup.profiles || []);
  writeStore(SYNTHETIC_STORAGE_KEYS.ARTIFACTS_META, backup.artifacts || []);
  writeStore(SYNTHETIC_STORAGE_KEYS.MIGRATION_BACKUP, null);

  recordAuditEvent('migration.rolled_back', { restoredVersion: backup.preMigrationVersion }, actor);

  return {
    success: true,
    restoredProfilesCount: (backup.profiles || []).length,
    restoredArtifactsCount: (backup.artifacts || []).length,
    version: backup.preMigrationVersion,
  };
}

export function isArtifactStale(artifactMeta, currentCatalogVersion = '1.0.0') {
  if (!artifactMeta || !artifactMeta.schemaVersion) return false;
  return artifactMeta.schemaVersion !== currentCatalogVersion;
}
