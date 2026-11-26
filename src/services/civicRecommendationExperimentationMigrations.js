/**
 * src/services/civicRecommendationExperimentationMigrations.js
 *
 * Persistence, atomic transaction, rollback, schema migrations, and retention
 * for the Civic Service Recommendation Experimentation Platform (#1193).
 *
 * Architectural constraints:
 * 1. Schema versioning is explicit (CIVIC_EXPERIMENTATION_SCHEMA_VERSION = 1).
 * 2. In-memory fallback is automatic when localStorage is unavailable.
 * 3. Atomic transactions: a failure restores the previous snapshot.
 * 4. Zero sensitive data stored: no citizen records or prompts are persisted;
 *    only aggregated metrics, variant allocations, and audit logs.
 */

import {
  CIVIC_EXPERIMENTATION_SCHEMA_VERSION,
  CIVIC_EXPERIMENTATION_STORAGE_KEY,
  EXPERIMENT_STATUS,
  EXPERIMENTATION_ERRORS,
  DEFAULT_EXPERIMENT,
  EXPERIMENT_ID_PATTERN,
  VARIANT_ID_PATTERN
} from '../data/civicRecommendationExperimentationConstants.js';

const memoryStorage = new Map();

const resolveStorage = (storage) => {
  if (storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function') {
    return storage;
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const testKey = '__storage_test__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      return window.localStorage;
    } catch {
      // Fall through to memory storage
    }
  }
  return {
    getItem: (key) => (memoryStorage.has(key) ? memoryStorage.get(key) : null),
    setItem: (key, val) => memoryStorage.set(key, String(val)),
    removeItem: (key) => memoryStorage.delete(key),
    clear: () => memoryStorage.clear()
  };
};

const clone = (value) => JSON.parse(JSON.stringify(value));

export const isExperimentId = (value) =>
  typeof value === 'string' && value.length > 0 && value.length <= 120 && EXPERIMENT_ID_PATTERN.test(value);

export const isVariantId = (value) =>
  typeof value === 'string' && value.length > 0 && value.length <= 120 && VARIANT_ID_PATTERN.test(value);

export const createEmptyStore = ({ now = new Date().toISOString() } = {}) => ({
  schemaVersion: CIVIC_EXPERIMENTATION_SCHEMA_VERSION,
  createdAt: now,
  updatedAt: now,
  meta: {
    schemaVersion: CIVIC_EXPERIMENTATION_SCHEMA_VERSION,
    migratedAt: now,
    lastSavedAt: now,
    migrationHistory: []
  },
  experiments: [],
  metricsLog: [],
  auditLog: []
});

export const createSeedStore = ({ now = new Date().toISOString() } = {}) => {
  const store = createEmptyStore({ now });
  const sampleExp = clone(DEFAULT_EXPERIMENT);
  sampleExp.id = 'exp-service-discovery-v1';
  sampleExp.name = 'Civic Service Discovery Strategy Test';
  sampleExp.description = 'Evaluating explainable intent matching vs distance-boosted matching with strict language guardrails.';
  sampleExp.status = EXPERIMENT_STATUS.ACTIVE;
  sampleExp.createdAt = now;
  sampleExp.updatedAt = now;
  store.experiments.push(sampleExp);

  store.auditLog.push({
    id: `audit-${Date.now()}-seed`,
    action: 'experiment.seed',
    entityType: 'experiment',
    entityId: sampleExp.id,
    actorRole: 'system',
    actorId: 'seed-generator',
    reason: 'Initial synthetic experimentation environment seeded.',
    timestamp: now,
    schemaVersion: CIVIC_EXPERIMENTATION_SCHEMA_VERSION
  });

  return store;
};

export function validateStoreShape(store) {
  if (!store || typeof store !== 'object' || Array.isArray(store)) return false;
  if (typeof store.schemaVersion !== 'number') return false;
  if (!Array.isArray(store.experiments)) return false;
  if (!Array.isArray(store.metricsLog)) return false;
  if (!Array.isArray(store.auditLog)) return false;
  return true;
}

export function migrateExperimentationStore(raw, { now = new Date().toISOString() } = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return createSeedStore({ now });
  }

  const v = Number(raw.schemaVersion || 0);

  if (v === CIVIC_EXPERIMENTATION_SCHEMA_VERSION && validateStoreShape(raw)) {
    return raw;
  }

  const upgraded = createEmptyStore({ now });
  if (Array.isArray(raw.experiments)) upgraded.experiments = raw.experiments.slice();
  if (Array.isArray(raw.metricsLog)) upgraded.metricsLog = raw.metricsLog.slice();
  if (Array.isArray(raw.auditLog)) upgraded.auditLog = raw.auditLog.slice();

  upgraded.meta.migrationHistory.push({
    from: v,
    to: CIVIC_EXPERIMENTATION_SCHEMA_VERSION,
    appliedAt: now,
    kind: 'upgrade'
  });

  return upgraded;
}

export function loadExperimentationStore({ storage, now = new Date().toISOString() } = {}) {
  const storeProvider = resolveStorage(storage);
  try {
    const raw = storeProvider.getItem(CIVIC_EXPERIMENTATION_STORAGE_KEY);
    if (!raw) {
      const seeded = createSeedStore({ now });
      storeProvider.setItem(CIVIC_EXPERIMENTATION_STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw);
    const migrated = migrateExperimentationStore(parsed, { now });
    return migrated;
  } catch {
    return createSeedStore({ now });
  }
}

export function persistExperimentationStore(store, { storage, now = new Date().toISOString() } = {}) {
  const storeProvider = resolveStorage(storage);
  if (!validateStoreShape(store)) {
    throw new Error('Invalid experimentation store shape for persistence.');
  }
  const toSave = clone(store);
  toSave.updatedAt = now;
  toSave.meta.lastSavedAt = now;
  storeProvider.setItem(CIVIC_EXPERIMENTATION_STORAGE_KEY, JSON.stringify(toSave));
  return toSave;
}

export function runExperimentationTransaction(
  mutationFn,
  { storage, now = new Date().toISOString(), loadStore, persistStore } = {}
) {
  const current = loadStore ? loadStore({ storage, now }) : loadExperimentationStore({ storage, now });
  const snapshot = clone(current);

  const draft = clone(current);
  let mutationResult;

  try {
    mutationResult = mutationFn(draft);
  } catch (err) {
    if (persistStore) persistStore(snapshot, { storage, now });
    else persistExperimentationStore(snapshot, { storage, now });
    throw err;
  }

  if (!validateStoreShape(draft)) {
    if (persistStore) persistStore(snapshot, { storage, now });
    else persistExperimentationStore(snapshot, { storage, now });
    const err = new Error('Transaction mutated store into invalid shape.');
    err.code = EXPERIMENTATION_ERRORS.VALIDATION_FAILED;
    throw err;
  }

  const saved = persistStore ? persistStore(draft, { storage, now }) : persistExperimentationStore(draft, { storage, now });
  return { store: saved, result: mutationResult };
}

export function rollbackExperimentationStore({ storage, now = new Date().toISOString() } = {}) {
  const seeded = createSeedStore({ now });
  return persistExperimentationStore(seeded, { storage, now });
}

export function resetExperimentationStoreToEmpty({ storage, now = new Date().toISOString() } = {}) {
  const empty = createEmptyStore({ now });
  return persistExperimentationStore(empty, { storage, now });
}

export function applyExperimentationRetentionPolicy(
  store,
  { retentionDays = 90, now = new Date().toISOString() } = {}
) {
  const cutoffMs = new Date(now).getTime() - retentionDays * 24 * 60 * 60 * 1000;
  const pruned = clone(store);

  pruned.metricsLog = (pruned.metricsLog || []).filter((m) => {
    if (!m.timestamp) return true;
    return new Date(m.timestamp).getTime() >= cutoffMs;
  });

  if (pruned.auditLog && pruned.auditLog.length > 1000) {
    pruned.auditLog = pruned.auditLog.slice(0, 1000);
  }

  pruned.updatedAt = now;
  return pruned;
}
