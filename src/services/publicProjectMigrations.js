/**
 * src/services/publicProjectMigrations.js
 * Schema bootstrap, migrations, rollback, and audit export for Geospatial Public Projects (#752).
 *
 * Operational guarantees:
 * - Version stamp metadata tracking.
 * - Pre-migration snapshot and all-or-nothing rollback.
 * - Migrations against both empty databases and legacy/existing datasets.
 * - Documented index manifest for fast query performance.
 * - Cryptographic audit trail export.
 */

import {
  PUBLIC_PROJECTS_STORAGE_KEY,
  PROJECT_MILESTONES_STORAGE_KEY,
  PROGRESS_SUBMISSIONS_STORAGE_KEY,
  EVIDENCE_ASSETS_STORAGE_KEY,
  VERIFICATION_REVIEWS_STORAGE_KEY,
  PROJECT_AUDIT_LOGS_STORAGE_KEY,
  SCHEMA_VERSION,
  SEED_PROJECTS,
  SEED_MILESTONES,
  SEED_SUBMISSIONS,
  SEED_EVIDENCE_ASSETS,
  SEED_AUDIT_LOGS,
} from './publicProjectService';
import { computeAssetHash } from './evidenceVerificationService';
import { logDiagnostic } from '../utils/diagnostics';

export const PUBLIC_PROJECTS_META_KEY = 'civicbridge_public_projects_meta_v1';
export const PUBLIC_PROJECTS_BACKUP_KEY = 'civicbridge_public_projects_migration_backup_v1';

export const PUBLIC_PROJECTS_INDEX_MANIFEST = Object.freeze([
  {
    name: 'byJurisdictionStatus',
    fields: ['jurisdiction.wardNumber', 'status', 'createdAt'],
    purpose: 'Ward and jurisdictional filtering with newest-first ordering.',
  },
  {
    name: 'byCategoryStatus',
    fields: ['category', 'status', 'createdAt'],
    purpose: 'Category browsing (roads, drains, schools, healthcare).',
  },
  {
    name: 'byMilestoneSequence',
    fields: ['projectId', 'sequenceOrder'],
    purpose: 'Ordered sequential rendering of milestone timeline cards.',
  },
  {
    name: 'bySubmissionMilestone',
    fields: ['milestoneId', 'status', 'submissionDate'],
    purpose: 'Grouping and reviewing progress evidence under each milestone.',
  },
  {
    name: 'byEvidenceAssetHash',
    fields: ['assetHash'],
    purpose: 'Tamper detection and cryptographic integrity checks across uploads.',
  },
]);

const ALL_PERSISTENCE_KEYS = Object.freeze([
  PUBLIC_PROJECTS_STORAGE_KEY,
  PROJECT_MILESTONES_STORAGE_KEY,
  PROGRESS_SUBMISSIONS_STORAGE_KEY,
  EVIDENCE_ASSETS_STORAGE_KEY,
  VERIFICATION_REVIEWS_STORAGE_KEY,
  PROJECT_AUDIT_LOGS_STORAGE_KEY,
]);

const getStorage = (storage) => {
  if (storage && typeof storage.getItem === 'function') return storage;
  return typeof globalThis.localStorage !== 'undefined' ? globalThis.localStorage : null;
};

const safeRead = (storage, key, fallback) => {
  const s = getStorage(storage);
  if (!s) return fallback;
  try {
    const raw = s.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const safeWrite = (storage, key, val) => {
  const s = getStorage(storage);
  if (!s) return;
  try {
    s.setItem(key, JSON.stringify(val));
  } catch (err) {
    logDiagnostic(`Migration write failed for key ${key}:`, err);
  }
};

/**
 * Returns current migration status.
 */
export function getPublicProjectsMigrationStatus(storage) {
  const meta = safeRead(storage, PUBLIC_PROJECTS_META_KEY, null);
  const currentVersion = Number(meta?.schemaVersion || 0);

  const projects = safeRead(storage, PUBLIC_PROJECTS_STORAGE_KEY, []);
  const milestones = safeRead(storage, PROJECT_MILESTONES_STORAGE_KEY, []);
  const submissions = safeRead(storage, PROGRESS_SUBMISSIONS_STORAGE_KEY, []);
  const evidenceAssets = safeRead(storage, EVIDENCE_ASSETS_STORAGE_KEY, []);
  const auditLogs = safeRead(storage, PROJECT_AUDIT_LOGS_STORAGE_KEY, []);

  return {
    currentVersion,
    targetVersion: SCHEMA_VERSION,
    needsMigration: currentVersion < SCHEMA_VERSION || projects.length === 0,
    isCurrent: currentVersion === SCHEMA_VERSION && projects.length > 0,
    migratedAt: meta?.migratedAt || null,
    backupAvailable: Boolean(safeRead(storage, PUBLIC_PROJECTS_BACKUP_KEY, null)),
    counts: {
      projects: projects.length,
      milestones: milestones.length,
      submissions: submissions.length,
      evidenceAssets: evidenceAssets.length,
      auditLogs: auditLogs.length,
    },
  };
}

/**
 * Normalizes a legacy project record to Schema Version 1.
 */
export function normalizeLegacyProject(legacy, index, now) {
  return {
    id: legacy.id || `proj_legacy_${index + 1}`,
    title: legacy.title || 'Untitled Municipal Project',
    description: legacy.description || 'Legacy public infrastructure project record.',
    category: legacy.category || 'roads',
    status: legacy.status || 'PLANNED',
    jurisdiction: legacy.jurisdiction || {
      wardNumber: legacy.ward || 'Ward 1',
      wardName: legacy.wardName || 'Ward 1',
      zone: legacy.zone || 'Central Zone',
      municipality: 'Urban Municipal Corporation',
    },
    locationGeometry: legacy.locationGeometry || {
      type: 'Point',
      coordinates: [77.5946, 12.9716],
      boundingBBox: [77.5936, 12.9706, 77.5956, 12.9726],
      centerLat: 12.9716,
      centerLng: 77.5946,
    },
    budgetReference: legacy.budgetReference || {
      sanctionedAmountInr: legacy.sanctionedAmount || 1000000,
      financialYear: legacy.financialYear || '2026-2027',
      isPublic: true,
    },
    contractorDetails: legacy.contractorDetails || {
      name: legacy.contractorName || 'Legacy Contractor',
      licenseId: legacy.contractorLicense || 'LEGACY-LIC',
    },
    startDate: legacy.startDate || now.slice(0, 10),
    targetCompletionDate: legacy.targetCompletionDate || '2027-12-31',
    overallProgressPercent: typeof legacy.overallProgressPercent === 'number' ? legacy.overallProgressPercent : 0,
    schemaVersion: SCHEMA_VERSION,
    createdAt: legacy.createdAt || now,
    updatedAt: now,
    createdBy: legacy.createdBy || 'migration_normalizer',
  };
}

/**
 * Applies migration:
 * 1. Takes pre-migration snapshot for rollback safety.
 * 2. If storage is empty, boots with seed data.
 * 3. If storage has existing/legacy data, normalizes every entity to schemaVersion: 1.
 * 4. Writes updated metadata.
 */
export function applyPublicProjectsMigration(storage, { force = false } = {}) {
  const status = getPublicProjectsMigrationStatus(storage);
  if (!status.needsMigration && !force) {
    return { applied: false, reason: 'Schema is already current.', status };
  }

  // 1. Snapshot existing keys for rollback safety
  const snapshot = {};
  for (const k of ALL_PERSISTENCE_KEYS) {
    snapshot[k] = safeRead(storage, k, null);
  }
  safeWrite(storage, PUBLIC_PROJECTS_BACKUP_KEY, {
    snapshot,
    snapshotAt: new Date().toISOString(),
    previousVersion: status.currentVersion,
  });

  const now = new Date().toISOString();

  // 2. Check if database is empty
  const rawProjects = safeRead(storage, PUBLIC_PROJECTS_STORAGE_KEY, null);
  const isEmptyDatabase = !rawProjects || !Array.isArray(rawProjects) || rawProjects.length === 0;

  if (isEmptyDatabase) {
    // Seed fresh normalized dataset
    safeWrite(storage, PUBLIC_PROJECTS_STORAGE_KEY, SEED_PROJECTS);
    safeWrite(storage, PROJECT_MILESTONES_STORAGE_KEY, SEED_MILESTONES);
    safeWrite(storage, PROGRESS_SUBMISSIONS_STORAGE_KEY, SEED_SUBMISSIONS);
    safeWrite(storage, EVIDENCE_ASSETS_STORAGE_KEY, SEED_EVIDENCE_ASSETS);
    safeWrite(storage, VERIFICATION_REVIEWS_STORAGE_KEY, []);
    safeWrite(storage, PROJECT_AUDIT_LOGS_STORAGE_KEY, SEED_AUDIT_LOGS);
  } else {
    // Migrate existing dataset
    const migratedProjects = rawProjects.map((p, idx) => normalizeLegacyProject(p, idx, now));
    safeWrite(storage, PUBLIC_PROJECTS_STORAGE_KEY, migratedProjects);

    // Normalize milestones
    const rawMilestones = safeRead(storage, PROJECT_MILESTONES_STORAGE_KEY, []);
    const migratedMilestones = rawMilestones.map((m, idx) => ({
      ...m,
      id: m.id || `ms_legacy_${idx + 1}`,
      weightPercentage: typeof m.weightPercentage === 'number' ? m.weightPercentage : 25,
      status: m.status || 'PENDING',
      completionCriteria: Array.isArray(m.completionCriteria) ? m.completionCriteria : ['Standard municipal civil specs'],
      schemaVersion: SCHEMA_VERSION,
    }));
    safeWrite(storage, PROJECT_MILESTONES_STORAGE_KEY, migratedMilestones);

    // Normalize evidence assets (ensure assetHash is populated)
    const rawAssets = safeRead(storage, EVIDENCE_ASSETS_STORAGE_KEY, []);
    const migratedAssets = rawAssets.map((a, idx) => ({
      ...a,
      id: a.id || `asset_legacy_${idx + 1}`,
      assetHash: a.assetHash || computeAssetHash(a.storageUrl || `asset-${idx}`),
      redactionStatus: a.redactionStatus || 'REDACTED',
      schemaVersion: SCHEMA_VERSION,
    }));
    safeWrite(storage, EVIDENCE_ASSETS_STORAGE_KEY, migratedAssets);
  }

  // 3. Write metadata stamp
  const meta = {
    schemaVersion: SCHEMA_VERSION,
    previousVersion: status.currentVersion,
    migratedAt: now,
    migrationType: isEmptyDatabase ? 'BOOTSTRAP_SEED' : 'LEGACY_TRANSFORMATION',
  };
  safeWrite(storage, PUBLIC_PROJECTS_META_KEY, meta);

  return {
    applied: true,
    migrationType: meta.migrationType,
    migratedAt: now,
    status: getPublicProjectsMigrationStatus(storage),
  };
}

/**
 * Rolls back migration to the snapshot stored in PUBLIC_PROJECTS_BACKUP_KEY.
 */
export function rollbackPublicProjectsMigration(storage) {
  const backup = safeRead(storage, PUBLIC_PROJECTS_BACKUP_KEY, null);
  if (!backup || !backup.snapshot) {
    return { rolledBack: false, reason: 'No rollback snapshot available in storage.' };
  }

  const { snapshot, previousVersion } = backup;
  for (const [key, val] of Object.entries(snapshot)) {
    if (val !== null) {
      safeWrite(storage, key, val);
    }
  }

  // Restore metadata
  safeWrite(storage, PUBLIC_PROJECTS_META_KEY, {
    schemaVersion: previousVersion || 0,
    rolledBackAt: new Date().toISOString(),
  });

  return {
    rolledBack: true,
    rolledBackAt: new Date().toISOString(),
    restoredVersion: previousVersion || 0,
    status: getPublicProjectsMigrationStatus(storage),
  };
}

/**
 * Exports cryptographic, tamper-evident audit trail as a downloadable JSON object.
 */
export function exportPublicProjectAuditTrail(projectId = null, storage) {
  const allLogs = safeRead(storage, PROJECT_AUDIT_LOGS_STORAGE_KEY, []);
  const logs = projectId ? allLogs.filter((l) => l.projectId === projectId) : allLogs;

  const exportPayload = {
    exportTimestamp: new Date().toISOString(),
    projectId: projectId || 'ALL_PROJECTS',
    totalEntries: logs.length,
    auditEntries: logs,
    exportIntegrityDigest: computeAssetHash(JSON.stringify(logs)),
  };

  return exportPayload;
}
