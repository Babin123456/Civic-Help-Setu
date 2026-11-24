/**
 * Persistence, schema migration, indexing and rollback for the Greenhouse-Gas Inventory (#753).
 *
 * All collections live in one JSON bundle. A single key makes a multi-collection write
 * atomic in localStorage: the new bundle replaces the old one only after the mutator returns.
 * When localStorage is unavailable (tests, private modes, quota errors) the same API uses an
 * in-memory store, so the workflow still works and the caller can show an offline notice.
 */

import {
  ACTIVITY_STATUS,
  GHG_ERROR_CODES,
  GHG_SCHEMA_VERSION,
  GHG_STORAGE_KEYS,
  PERIOD_STATUS,
  SUBMISSION_STATUS,
} from './ghgInventoryConstants.js';
import { GhgInventoryError } from './ghgInventoryValidation.js';
import { logDiagnostic } from '../utils/diagnostics.js';
import {
  SEED_ACTIVITY_RECORDS,
  SEED_AUDIT_EVENTS,
  SEED_CALCULATION_RUNS,
  SEED_DEPARTMENT_SUBMISSIONS,
  SEED_EMISSION_FACTORS,
  SEED_EMISSION_SOURCES,
  SEED_FACTOR_VERSIONS,
  SEED_RECOMMENDATIONS,
  SEED_REPORTING_PERIODS,
} from '../data/ghgInventorySeed.js';

const memoryStorage = new Map();

const resolveStorage = (storage) => {
  if (storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function') {
    return storage;
  }
  return null;
};

const safeGetItem = (key, storage) => {
  const custom = resolveStorage(storage);
  if (custom) {
    try {
      return custom.getItem(key);
    } catch {
      return memoryStorage.get(key) || null;
    }
  }
  try {
    const browserStorage =
      typeof window !== 'undefined' && window.localStorage
        ? window.localStorage
        : typeof globalThis !== 'undefined'
          ? globalThis.localStorage
          : null;
    if (browserStorage) {
      // When real storage is available it is the source of truth, even when the key is
      // absent (a cleared store must not be shadowed by a stale in-memory copy).
      return browserStorage.getItem(key);
    }
  } catch {
    // Fall through to memory.
  }
  return memoryStorage.get(key) || null;
};

const safeSetItem = (key, value, storage) => {
  const custom = resolveStorage(storage);
  if (custom) {
    custom.setItem(key, value);
    memoryStorage.set(key, value);
    return;
  }
  try {
    const browserStorage =
      typeof window !== 'undefined' && window.localStorage
        ? window.localStorage
        : typeof globalThis !== 'undefined'
          ? globalThis.localStorage
          : null;
    if (browserStorage) {
      browserStorage.setItem(key, value);
    }
  } catch {
    // Quota or privacy mode: keep the working copy in memory.
  }
  memoryStorage.set(key, value);
};

const safeRemoveItem = (key, storage) => {
  const custom = resolveStorage(storage);
  if (custom && typeof custom.removeItem === 'function') {
    custom.removeItem(key);
  } else {
    try {
      const browserStorage =
        typeof window !== 'undefined' && window.localStorage
          ? window.localStorage
          : typeof globalThis !== 'undefined'
            ? globalThis.localStorage
            : null;
      if (browserStorage) {
        browserStorage.removeItem(key);
      }
    } catch {
      // Ignore.
    }
  }
  memoryStorage.delete(key);
};

const clone = (value) => JSON.parse(JSON.stringify(value));

const COLLECTIONS = [
  'emissionSources',
  'activityRecords',
  'emissionFactors',
  'factorVersions',
  'reportingPeriods',
  'departmentSubmissions',
  'calculationRuns',
  'recommendations',
  'auditEvents',
];

export const createEmptyInventory = ({ now = new Date().toISOString() } = {}) => ({
  schemaVersion: GHG_SCHEMA_VERSION,
  createdAt: now,
  updatedAt: now,
  meta: {
    schemaVersion: GHG_SCHEMA_VERSION,
    migratedAt: now,
    lastSavedAt: now,
    migrationHistory: [],
  },
  emissionSources: [],
  activityRecords: [],
  emissionFactors: [],
  factorVersions: [],
  reportingPeriods: [],
  departmentSubmissions: [],
  calculationRuns: [],
  recommendations: [],
  auditEvents: [],
});

export const createSeedInventory = ({ now = new Date().toISOString() } = {}) => ({
  schemaVersion: GHG_SCHEMA_VERSION,
  createdAt: now,
  updatedAt: now,
  meta: {
    schemaVersion: GHG_SCHEMA_VERSION,
    migratedAt: now,
    lastSavedAt: now,
    seeded: true,
    migrationHistory: [{ from: 0, to: GHG_SCHEMA_VERSION, appliedAt: now, kind: 'seed' }],
  },
  emissionSources: clone(SEED_EMISSION_SOURCES),
  activityRecords: clone(SEED_ACTIVITY_RECORDS),
  emissionFactors: clone(SEED_EMISSION_FACTORS),
  factorVersions: clone(SEED_FACTOR_VERSIONS),
  reportingPeriods: clone(SEED_REPORTING_PERIODS),
  departmentSubmissions: clone(SEED_DEPARTMENT_SUBMISSIONS),
  calculationRuns: clone(SEED_CALCULATION_RUNS),
  recommendations: clone(SEED_RECOMMENDATIONS),
  auditEvents: clone(SEED_AUDIT_EVENTS),
});

export const isValidInventoryShape = (data) =>
  Boolean(
    data &&
      typeof data === 'object' &&
      data.schemaVersion === GHG_SCHEMA_VERSION &&
      COLLECTIONS.every((key) => Array.isArray(data[key]))
  );

/**
 * Migration from the pre-#753 flat prototype shape (`sources`, `activities`, `factors`).
 * Missing metadata and enums receive explicit defaults; nothing is silently dropped.
 */
export const migrateGhgInventoryData = (legacy, { now = new Date().toISOString() } = {}) => {
  if (!legacy || typeof legacy !== 'object') {
    throw new GhgInventoryError(GHG_ERROR_CODES.MIGRATION_FAILED, 'Legacy inventory must be an object.');
  }
  if (isValidInventoryShape(legacy)) {
    return {
      data: legacy,
      migrated: false,
      historyEntry: null,
    };
  }

  const fromVersion = Number(legacy.schemaVersion || legacy.version || 0);
  const sources = (legacy.emissionSources || legacy.sources || []).map((source) => ({
    id: source.id || `SRC-LEGACY-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    jurisdictionId: source.jurisdictionId || source.wardId || 'WARD-042',
    name: source.name || 'Unnamed legacy source',
    department: source.department || 'Unassigned department',
    category: source.category || 'public_building_energy',
    location: source.location || '',
    defaultFactorId: source.defaultFactorId || source.factorId || 'EF-GRID-IN',
    status: source.status || 'active',
    description: source.description || '',
    createdBy: source.createdBy || 'legacy.migration',
    createdAt: source.createdAt || now,
    updatedAt: source.updatedAt || now,
    schemaVersion: GHG_SCHEMA_VERSION,
  }));

  const periods = (legacy.reportingPeriods || legacy.periods || []).map((period) => ({
    id: period.id || `PER-LEGACY-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    jurisdictionId: period.jurisdictionId || 'WARD-042',
    label: period.label || 'Legacy period',
    startDate: period.startDate || '2024-04-01',
    endDate: period.endDate || '2025-03-31',
    status: period.status || PERIOD_STATUS.DRAFT,
    publishedAt: period.publishedAt || null,
    createdBy: period.createdBy || 'legacy.migration',
    createdAt: period.createdAt || now,
    updatedAt: period.updatedAt || now,
    schemaVersion: GHG_SCHEMA_VERSION,
  }));

  const submissions = (legacy.departmentSubmissions || legacy.submissions || []).map((submission) => {
    const matching = (legacy.activityRecords || legacy.activities || []).filter(
      (record) =>
        record.submissionId === submission.id ||
        (Array.isArray(submission.activityRecordIds) &&
          submission.activityRecordIds.includes(record.id))
    );
    return {
      id: submission.id || `SUB-LEGACY-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      periodId: submission.periodId || periods[0]?.id || 'PER-LEGACY',
      jurisdictionId: submission.jurisdictionId || 'WARD-042',
      department: submission.department || 'Unassigned department',
      title: submission.title || 'Legacy department submission',
      status: Object.values(SUBMISSION_STATUS).includes(submission.status)
        ? submission.status
        : SUBMISSION_STATUS.DRAFT,
      submittedBy: submission.submittedBy || 'legacy.department',
      submittedAt: submission.submittedAt || null,
      reviewedBy: submission.reviewedBy || null,
      reviewedAt: submission.reviewedAt || null,
      reviewNotes: submission.reviewNotes || '',
      correctionNotes: submission.correctionNotes || '',
      idempotencyKey: submission.idempotencyKey || `legacy-${submission.id || 'submission'}`,
      activityRecordIds:
        submission.activityRecordIds || matching.map((record) => record.id).filter(Boolean),
      createdBy: submission.createdBy || 'legacy.department',
      createdAt: submission.createdAt || now,
      updatedAt: submission.updatedAt || now,
      schemaVersion: GHG_SCHEMA_VERSION,
    };
  });

  const activities = (legacy.activityRecords || legacy.activities || []).map((record) => ({
    id: record.id || `ACT-LEGACY-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    submissionId: record.submissionId || submissions[0]?.id || null,
    periodId: record.periodId || periods[0]?.id || 'PER-LEGACY',
    jurisdictionId: record.jurisdictionId || 'WARD-042',
    sourceId: record.sourceId,
    category: record.category || 'public_building_energy',
    quantity: Number(record.quantity ?? record.value ?? 0),
    unit: record.unit || 'kWh',
    dataQuality: record.dataQuality || 'measured',
    factorVersionId: record.factorVersionId || null,
    factorId: record.factorId || null,
    status: Object.values(ACTIVITY_STATUS).includes(record.status)
      ? record.status
      : ACTIVITY_STATUS.DRAFT,
    correctionNotes: record.correctionNotes || '',
    sourceDocument: record.sourceDocument || null,
    createdBy: record.createdBy || 'legacy.department',
    createdAt: record.createdAt || now,
    updatedAt: record.updatedAt || now,
    schemaVersion: GHG_SCHEMA_VERSION,
  }));

  const data = {
    ...createEmptyInventory({ now }),
    emissionSources: sources,
    reportingPeriods: periods,
    departmentSubmissions: submissions,
    activityRecords: activities,
    emissionFactors: legacy.emissionFactors || legacy.factors || clone(SEED_EMISSION_FACTORS),
    factorVersions: legacy.factorVersions || clone(SEED_FACTOR_VERSIONS),
    calculationRuns: legacy.calculationRuns || legacy.runs || [],
    recommendations: legacy.recommendations || [],
    auditEvents: legacy.auditEvents || [],
    meta: {
      ...createEmptyInventory({ now }).meta,
      seeded: false,
      migrationHistory: [
        {
          from: fromVersion,
          to: GHG_SCHEMA_VERSION,
          appliedAt: now,
          kind: 'upgrade',
          sourceCollections: {
            sources: (legacy.emissionSources || legacy.sources || []).length,
            activities: (legacy.activityRecords || legacy.activities || []).length,
          },
        },
      ],
    },
  };

  return {
    data,
    migrated: true,
    historyEntry: data.meta.migrationHistory[0],
  };
};

export const buildGhgIndexes = (data = {}) => {
  const byId = (collection) =>
    new Map((data[collection] || []).map((item) => [String(item.id), item]));
  const groupBy = (collection, key) => {
    const map = new Map();
    for (const item of data[collection] || []) {
      const value = String(item[key] || 'UNKNOWN').toLowerCase();
      if (!map.has(value)) map.set(value, []);
      map.get(value).push(item);
    }
    return map;
  };

  return {
    sourcesById: byId('emissionSources'),
    recordsById: byId('activityRecords'),
    factorsById: byId('emissionFactors'),
    factorVersionsById: byId('factorVersions'),
    periodsById: byId('reportingPeriods'),
    submissionsById: byId('departmentSubmissions'),
    runsById: byId('calculationRuns'),
    recommendationsById: byId('recommendations'),
    sourcesByJurisdiction: groupBy('emissionSources', 'jurisdictionId'),
    recordsByPeriod: groupBy('activityRecords', 'periodId'),
    recordsBySubmission: groupBy('activityRecords', 'submissionId'),
    recordsBySource: groupBy('activityRecords', 'sourceId'),
    recordsByCategory: groupBy('activityRecords', 'category'),
    recordsByQuality: groupBy('activityRecords', 'dataQuality'),
    submissionsByStatus: groupBy('departmentSubmissions', 'status'),
    submissionsByJurisdiction: groupBy('departmentSubmissions', 'jurisdictionId'),
    periodsByStatus: groupBy('reportingPeriods', 'status'),
    factorsByCategory: groupBy('emissionFactors', 'category'),
  };
};

export const loadGhgInventory = ({ storage = null, seed = true, now } = {}) => {
  const raw = safeGetItem(GHG_STORAGE_KEYS.BUNDLE, storage);
  if (!raw) {
    const initial = seed ? createSeedInventory({ now }) : createEmptyInventory({ now });
    safeSetItem(GHG_STORAGE_KEYS.BUNDLE, JSON.stringify(initial), storage);
    return initial;
  }
  try {
    const parsed = JSON.parse(raw);
    if (isValidInventoryShape(parsed)) return parsed;
    const { data } = migrateGhgInventoryData(parsed, { now: now || new Date().toISOString() });
    safeSetItem(GHG_STORAGE_KEYS.BUNDLE, JSON.stringify(data), storage);
    return data;
  } catch (error) {
    logDiagnostic('Corrupt greenhouse-gas inventory storage; re-seeding the local bundle.', error);
    const initial = seed ? createSeedInventory({ now }) : createEmptyInventory({ now });
    safeSetItem(GHG_STORAGE_KEYS.BUNDLE, JSON.stringify(initial), storage);
    return initial;
  }
};

export const ensureGhgInventory = (options = {}) => {
  const data = loadGhgInventory(options);
  return { ...data, indexes: buildGhgIndexes(data) };
};

export const persistGhgInventory = (data, { storage = null, now = new Date().toISOString() } = {}) => {
  if (!data || !COLLECTIONS.every((key) => Array.isArray(data[key]))) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.MIGRATION_FAILED,
      'Refusing to persist an inventory with a missing collection.'
    );
  }
  const next = {
    ...data,
    schemaVersion: GHG_SCHEMA_VERSION,
    updatedAt: now,
    meta: {
      ...(data.meta || {}),
      schemaVersion: GHG_SCHEMA_VERSION,
      lastSavedAt: now,
    },
  };
  safeSetItem(GHG_STORAGE_KEYS.BUNDLE, JSON.stringify(next), storage);
  return next;
};

/**
 * Transactional write: the mutator receives a detached draft. Nothing is persisted unless it
 * completes. If the mutator throws, storage still holds the previous bundle.
 */
export const runGhgTransaction = (mutator, { storage = null, now } = {}) => {
  const current = loadGhgInventory({ storage, now });
  const draft = clone(current);
  let result;
  try {
    result = mutator(draft);
  } catch (error) {
    throw error instanceof GhgInventoryError
      ? error
      : new GhgInventoryError(
          GHG_ERROR_CODES.MIGRATION_FAILED,
          'The inventory change could not be saved. No records were written.',
          { cause: error instanceof Error ? error.message : String(error) }
        );
  }
  const persisted = persistGhgInventory(draft, { storage, now });
  return { data: persisted, result };
};

export const rollbackGhgStorage = ({ storage = null, now } = {}) => {
  safeRemoveItem(GHG_STORAGE_KEYS.BUNDLE, storage);
  const seeded = createSeedInventory({ now });
  persistGhgInventory(seeded, { storage, now });
  return { ...seeded, indexes: buildGhgIndexes(seeded) };
};

export const resetGhgStorageToEmpty = ({ storage = null, now } = {}) => {
  safeRemoveItem(GHG_STORAGE_KEYS.BUNDLE, storage);
  const empty = createEmptyInventory({ now });
  persistGhgInventory(empty, { storage, now });
  return { ...empty, indexes: buildGhgIndexes(empty) };
};

/**
 * Retention:
 *  - Approved/locked periods older than `retentionYears` are archived; their values stay for audit.
 *  - Draft submissions older than `draftRetentionDays` are purged, because they were never approved
 *    and may contain corrected or abandoned operational notes.
 *  - Document metadata is removed when a period is archived; the department retains the original.
 */
export const applyGhgRetentionPolicy = (
  { retentionYears = 7, draftRetentionDays = 180, now = new Date().toISOString() } = {},
  { storage = null } = {}
) => {
  const cutoff = new Date(now);
  cutoff.setFullYear(cutoff.getFullYear() - retentionYears);
  const draftCutoff = new Date(now);
  draftCutoff.setDate(draftCutoff.getDate() - draftRetentionDays);

  return runGhgTransaction(
    (draft) => {
      let archivedPeriods = 0;
      const archivedPeriodIds = new Set();
      draft.reportingPeriods = draft.reportingPeriods.map((period) => {
        if (
          [PERIOD_STATUS.LOCKED, PERIOD_STATUS.APPROVED].includes(period.status) &&
          new Date(period.endDate) < cutoff
        ) {
          archivedPeriods += 1;
          archivedPeriodIds.add(period.id);
          return { ...period, status: PERIOD_STATUS.ARCHIVED, archivedAt: now, updatedAt: now };
        }
        return period;
      });

      let purgedDraftSubmissions = 0;
      const purgedSubmissionIds = new Set();
      draft.departmentSubmissions = draft.departmentSubmissions.filter((submission) => {
        const isOldDraft =
          submission.status === SUBMISSION_STATUS.DRAFT &&
          new Date(submission.createdAt) < draftCutoff &&
          !archivedPeriodIds.has(submission.periodId);
        if (isOldDraft) {
          purgedDraftSubmissions += 1;
          purgedSubmissionIds.add(submission.id);
        }
        return !isOldDraft;
      });

      let purgedDraftRecords = 0;
      draft.activityRecords = draft.activityRecords.filter((record) => {
        const remove =
          purgedSubmissionIds.has(record.submissionId) ||
          (record.status === ACTIVITY_STATUS.DRAFT && new Date(record.createdAt) < draftCutoff);
        if (remove) purgedDraftRecords += 1;
        return !remove;
      });

      let redactedDocuments = 0;
      draft.activityRecords = draft.activityRecords.map((record) => {
        if (archivedPeriodIds.has(record.periodId) && record.sourceDocument) {
          redactedDocuments += 1;
          return { ...record, sourceDocument: null };
        }
        return record;
      });

      // Keep the audit trail append-only; record the retention action itself.
      draft.auditEvents.unshift({
        id: `AUD-RET-${Date.now()}`,
        action: 'retention.applied',
        entityType: 'inventory',
        entityId: 'bundle',
        actorRole: 'admin',
        actorId: 'inventory.retention',
        reason: 'Scheduled retention policy run.',
        details: {
          archivedPeriods,
          purgedDraftSubmissions,
          purgedDraftRecords,
          redactedDocuments,
          retentionYears,
          draftRetentionDays,
        },
        timestamp: now,
        schemaVersion: GHG_SCHEMA_VERSION,
      });

      return {
        archivedPeriods,
        purgedDraftSubmissions,
        purgedDraftRecords,
        redactedDocuments,
      };
    },
    { storage, now }
  );
};
