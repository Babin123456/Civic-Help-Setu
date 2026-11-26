/**
 * src/services/civicSourceFreshnessPredictionMigrations.js
 *
 * Persistence, schema migration, indexing and rollback for the Civic Information
 * Freshness Prediction and Review Prioritization Model (#1189).
 *
 * Design rules (mirroring ghgInventoryMigrations.js):
 *  - One JSON bundle per storage key; a multi-collection write is atomic: the
 *    new bundle replaces the old one only after the mutator returns.
 *  - localStorage with an in-memory fallback (tests, private mode, quota errors)
 *    so the workflow keeps working offline.
 *  - Versioned schema; legacy shapes are migrated, nothing is silently dropped.
 *  - Deterministic IDs (no Math.random for access-control-relevant ids).
 *  - No citizen records, credentials, raw documents or sensitive prompts are
 *    persisted: only service-level feature aggregates, priority scores and
 *    review audit records.
 */

import {
  CIVIC_SOURCE_FRESHNESS_SCHEMA_VERSION,
  CIVIC_SOURCE_FRESHNESS_STORAGE_KEY,
  FRESHNESS_PREDICTION_STATUS,
  FRESHNESS_PREDICTION_ERRORS,
  DEFAULT_PREDICTION,
  PRIORITY_BAND,
  SERVICE_ID_PATTERN,
  PREDICTION_ID_PATTERN
} from '../data/civicSourceFreshnessPredictionConstants.js';
import { logDiagnostic } from '../utils/diagnostics.js';

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

const COLLECTIONS = ['predictions', 'predictionHistory', 'reviewAudit', 'driftEvents'];

const isSlug = (value) =>
  typeof value === 'string' && value.length > 0 && value.length <= 120 && SERVICE_ID_PATTERN.test(value);

export const isServiceId = (value) => isSlug(value);

export const isPredictionId = (value) =>
  typeof value === 'string' && value.length > 0 && value.length <= 120 && PREDICTION_ID_PATTERN.test(value);

export const createEmptyStore = ({ now = new Date().toISOString() } = {}) => ({
  schemaVersion: CIVIC_SOURCE_FRESHNESS_SCHEMA_VERSION,
  createdAt: now,
  updatedAt: now,
  meta: {
    schemaVersion: CIVIC_SOURCE_FRESHNESS_SCHEMA_VERSION,
    migratedAt: now,
    lastSavedAt: now,
    migrationHistory: []
  },
  predictions: [],
  predictionHistory: [],
  reviewAudit: [],
  driftEvents: []
});

export const createSeedStore = ({ now = new Date().toISOString() } = {}) => ({
  schemaVersion: CIVIC_SOURCE_FRESHNESS_SCHEMA_VERSION,
  createdAt: now,
  updatedAt: now,
  meta: {
    schemaVersion: CIVIC_SOURCE_FRESHNESS_SCHEMA_VERSION,
    migratedAt: now,
    lastSavedAt: now,
    seeded: true,
    migrationHistory: [{ from: 0, to: CIVIC_SOURCE_FRESHNESS_SCHEMA_VERSION, appliedAt: now, kind: 'seed' }]
  },
  predictions: [],
  predictionHistory: [],
  reviewAudit: [],
  driftEvents: []
});

export const isValidStoreShape = (data) =>
  Boolean(
    data &&
      typeof data === 'object' &&
      data.schemaVersion === CIVIC_SOURCE_FRESHNESS_SCHEMA_VERSION &&
      COLLECTIONS.every((key) => Array.isArray(data[key]))
  );

export const migrateFreshnessStore = (legacy, { now = new Date().toISOString() } = {}) => {
  if (!legacy || typeof legacy !== 'object') {
    throw new Error(`${FRESHNESS_PREDICTION_ERRORS.INVALID_REQUEST}: Legacy store must be an object.`);
  }
  if (isValidStoreShape(legacy)) {
    return { data: legacy, migrated: false, historyEntry: null };
  }

  const fromVersion = Number(legacy.schemaVersion || legacy.version || 0);
  const predictions = (legacy.predictions || []).map((prediction) => ({
    ...prediction,
    schemaVersion: CIVIC_SOURCE_FRESHNESS_SCHEMA_VERSION,
    updatedAt: prediction.updatedAt || now,
    id: prediction.id || `fp-legacy-${String(fromVersion)}-${Date.now()}`,
    status: prediction.status || FRESHNESS_PREDICTION_STATUS.PENDING,
    priorityBand: prediction.priorityBand || PRIORITY_BAND.LOW,
    reviewed: Boolean(prediction.reviewed),
    noCitizenData: true,
    untrusted: true,
    requiresHumanReview: true
  }));

  const data = {
    ...createEmptyStore({ now }),
    predictions,
    meta: {
      ...createEmptyStore({ now }).meta,
      seeded: false,
      migrationHistory: [
        {
          from: fromVersion,
          to: CIVIC_SOURCE_FRESHNESS_SCHEMA_VERSION,
          appliedAt: now,
          kind: 'upgrade',
          sourceCollections: { predictions: predictions.length }
        }
      ]
    }
  };

  return { data, migrated: true, historyEntry: data.meta.migrationHistory[0] };
};

export const buildFreshnessIndexes = (data = {}) => {
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
    predictionsById: byId('predictions'),
    predictionsByService: groupBy('predictions', 'serviceId'),
    predictionsByBand: groupBy('predictions', 'priorityBand'),
    predictionsByStatus: groupBy('predictions', 'status'),
    reviewsByService: groupBy('reviewAudit', 'serviceId'),
    driftByService: groupBy('driftEvents', 'serviceId')
  };
};

export const loadFreshnessStore = ({ storage = null, seed = true, now } = {}) => {
  const raw = safeGetItem(CIVIC_SOURCE_FRESHNESS_STORAGE_KEY, storage);
  if (!raw) {
    const initial = seed ? createSeedStore({ now }) : createEmptyStore({ now });
    safeSetItem(CIVIC_SOURCE_FRESHNESS_STORAGE_KEY, JSON.stringify(initial), storage);
    return initial;
  }
  try {
    const parsed = JSON.parse(raw);
    if (isValidStoreShape(parsed)) return parsed;
    const { data } = migrateFreshnessStore(parsed, { now: now || new Date().toISOString() });
    safeSetItem(CIVIC_SOURCE_FRESHNESS_STORAGE_KEY, JSON.stringify(data), storage);
    return data;
  } catch (error) {
    logDiagnostic('Corrupt freshness prediction store; re-seeding the local bundle.', error);
    const initial = seed ? createSeedStore({ now }) : createEmptyStore({ now });
    safeSetItem(CIVIC_SOURCE_FRESHNESS_STORAGE_KEY, JSON.stringify(initial), storage);
    return initial;
  }
};

export const ensureFreshnessStore = (options = {}) => {
  const data = loadFreshnessStore(options);
  return { ...data, indexes: buildFreshnessIndexes(data) };
};

export const persistFreshnessStore = (data, { storage = null, now = new Date().toISOString() } = {}) => {
  if (!data || !COLLECTIONS.every((key) => Array.isArray(data[key]))) {
    throw new Error(`${FRESHNESS_PREDICTION_ERRORS.MIGRATION_FAILED}: Refusing to persist a store with a missing collection.`);
  }
  const next = {
    ...data,
    schemaVersion: CIVIC_SOURCE_FRESHNESS_SCHEMA_VERSION,
    updatedAt: now,
    meta: {
      ...(data.meta || {}),
      schemaVersion: CIVIC_SOURCE_FRESHNESS_SCHEMA_VERSION,
      lastSavedAt: now
    }
  };
  safeSetItem(CIVIC_SOURCE_FRESHNESS_STORAGE_KEY, JSON.stringify(next), storage);
  return next;
};

/**
 * Transactional write: the mutator receives a detached draft. Nothing is
 * persisted unless it completes. If the mutator throws, storage still holds
 * the previous bundle.
 */
export const runFreshnessTransaction = (mutator, { storage = null, now } = {}) => {
  const current = loadFreshnessStore({ storage, now });
  const draft = clone(current);
  let result;
  try {
    result = mutator(draft);
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error(`${FRESHNESS_PREDICTION_ERRORS.MIGRATION_FAILED}: The freshness change could not be saved. No records were written.`);
  }
  const persisted = persistFreshnessStore(draft, { storage, now });
  return { data: persisted, result };
};

export const rollbackFreshnessStore = ({ storage = null, now } = {}) => {
  safeRemoveItem(CIVIC_SOURCE_FRESHNESS_STORAGE_KEY, storage);
  const seeded = createSeedStore({ now });
  persistFreshnessStore(seeded, { storage, now });
  return { ...seeded, indexes: buildFreshnessIndexes(seeded) };
};

export const resetFreshnessStoreToEmpty = ({ storage = null, now } = {}) => {
  safeRemoveItem(CIVIC_SOURCE_FRESHNESS_STORAGE_KEY, storage);
  const empty = createEmptyStore({ now });
  persistFreshnessStore(empty, { storage, now });
  return { ...empty, indexes: buildFreshnessIndexes(empty) };
};

/**
 * Retention: reviewed predictions older than retentionDays are archived;
 * their scores stay for audit. Drift events older than retentionDays are
 * archived too.
 */
export const applyFreshnessRetentionPolicy = (
  { retentionDays = 90, now = new Date().toISOString() } = {},
  { storage = null } = {}
) => {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - retentionDays);

  return runFreshnessTransaction(
    (draft) => {
      let archivedPredictions = 0;
      draft.predictions = draft.predictions.map((prediction) => {
        if (
          [FRESHNESS_PREDICTION_STATUS.REVIEWED, FRESHNESS_PREDICTION_STATUS.SUPERSEDED, FRESHNESS_PREDICTION_STATUS.WITHDRAWN].includes(prediction.status) &&
          new Date(prediction.updatedAt) < cutoff
        ) {
          archivedPredictions += 1;
          return { ...prediction, status: 'archived', archivedAt: now, updatedAt: now };
        }
        return prediction;
      });

      let archivedDriftEvents = 0;
      draft.driftEvents = draft.driftEvents.map((event) => {
        if (new Date(event.recordedAt) < cutoff) {
          archivedDriftEvents += 1;
          return { ...event, status: 'archived' };
        }
        return event;
      });

      draft.reviewAudit.unshift({
        id: `audit-retention-${Date.now()}`,
        action: 'retention.applied',
        entityType: 'freshnessStore',
        entityId: 'bundle',
        actorRole: 'system',
        actorId: 'freshness.retention',
        reason: 'Scheduled retention policy run.',
        details: { archivedPredictions, archivedDriftEvents, retentionDays },
        timestamp: now,
        schemaVersion: CIVIC_SOURCE_FRESHNESS_SCHEMA_VERSION
      });

      return { archivedPredictions, archivedDriftEvents };
    },
    { storage, now }
  );
};

export const __testables = {
  createEmptyStore,
  createSeedStore,
  isValidStoreShape,
  migrateFreshnessStore,
  buildFreshnessIndexes,
  loadFreshnessStore,
  ensureFreshnessStore,
  persistFreshnessStore,
  runFreshnessTransaction,
  rollbackFreshnessStore,
  resetFreshnessStoreToEmpty,
  applyFreshnessRetentionPolicy,
  isServiceId,
  isPredictionId,
  COLLECTIONS,
  FRESHNESS_PREDICTION_STATUS,
  FRESHNESS_PREDICTION_ERRORS,
  DEFAULT_PREDICTION,
  PRIORITY_BAND
};
