/**
 * src/services/civicContractTestMarketplaceMigrations.js
 *
 * Persistence, schema migration, indexing and rollback for the Civic Service
 * Integration Contract Test Marketplace (#1191).
 *
 * Design rules (mirroring ghgInventoryMigrations.js):
 *  - One JSON bundle per storage key; a multi-collection write is atomic: the
 *    new bundle replaces the old one only after the mutator returns.
 *  - localStorage with an in-memory fallback (tests, private mode, quota errors)
 *    so the workflow keeps working offline.
 *  - Versioned schema; legacy shapes are migrated, nothing is silently dropped.
 *  - Deterministic IDs (no Math.random for access-control-relevant ids).
 *  - No citizen records, credentials, raw documents or sensitive prompts are
 *    persisted: only provider adapter metadata, contract suite definitions,
 *    test run results and audit logs.
 */

import {
  CIVIC_CONTRACT_TEST_SCHEMA_VERSION,
  CIVIC_CONTRACT_TEST_STORAGE_KEY,
  CONTRACT_TEST_STATUS,
  CONTRACT_TEST_ERRORS,
  DEFAULT_ADAPTER,
  DEFAULT_CONTRACT_SUITE,
  DEFAULT_CONTRACT_TEST_RUN,
  ADAPTER_ID_PATTERN
} from '../data/civicContractTestMarketplaceConstants.js';
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

const COLLECTIONS = ['adapters', 'suites', 'tests', 'runs', 'results', 'auditLog'];

const isSlug = (value) =>
  typeof value === 'string' && value.length > 0 && value.length <= 120 && ADAPTER_ID_PATTERN.test(value);

export const isAdapterId = (value) => isSlug(value);
export const isSuiteId = (value) => isSlug(value);
export const isTestId = (value) => isSlug(value);
export const isRunId = (value) => isSlug(value);

export const createEmptyStore = ({ now = new Date().toISOString() } = {}) => ({
  schemaVersion: CIVIC_CONTRACT_TEST_SCHEMA_VERSION,
  createdAt: now,
  updatedAt: now,
  meta: {
    schemaVersion: CIVIC_CONTRACT_TEST_SCHEMA_VERSION,
    migratedAt: now,
    lastSavedAt: now,
    migrationHistory: []
  },
  adapters: [],
  suites: [],
  tests: [],
  runs: [],
  results: [],
  auditLog: []
});

export const createSeedStore = ({ now = new Date().toISOString() } = {}) => ({
  schemaVersion: CIVIC_CONTRACT_TEST_SCHEMA_VERSION,
  createdAt: now,
  updatedAt: now,
  meta: {
    schemaVersion: CIVIC_CONTRACT_TEST_SCHEMA_VERSION,
    migratedAt: now,
    lastSavedAt: now,
    seeded: true,
    migrationHistory: [{ from: 0, to: CIVIC_CONTRACT_TEST_SCHEMA_VERSION, appliedAt: now, kind: 'seed' }]
  },
  adapters: [],
  suites: [],
  tests: [],
  runs: [],
  results: [],
  auditLog: []
});

export const isValidStoreShape = (data) =>
  Boolean(
    data &&
      typeof data === 'object' &&
      data.schemaVersion === CIVIC_CONTRACT_TEST_SCHEMA_VERSION &&
      COLLECTIONS.every((key) => Array.isArray(data[key]))
  );

export const migrateContractTestStore = (legacy, { now = new Date().toISOString() } = {}) => {
  if (!legacy || typeof legacy !== 'object') {
    throw new Error(`${CONTRACT_TEST_ERRORS.INVALID_REQUEST}: Legacy store must be an object.`);
  }
  if (isValidStoreShape(legacy)) {
    return { data: legacy, migrated: false, historyEntry: null };
  }

  const fromVersion = Number(legacy.schemaVersion || legacy.version || 0);
  const adapters = (legacy.adapters || []).map((adapter) => ({
    ...adapter,
    schemaVersion: CIVIC_CONTRACT_TEST_SCHEMA_VERSION,
    updatedAt: adapter.updatedAt || now,
    id: adapter.id || `adapter-legacy-${String(fromVersion)}-${Date.now()}`,
    isActive: adapter.isActive !== false,
    noCitizenData: true,
    untrusted: true,
    requiresHumanReview: true
  }));

  const data = {
    ...createEmptyStore({ now }),
    adapters,
    meta: {
      ...createEmptyStore({ now }).meta,
      seeded: false,
      migrationHistory: [
        {
          from: fromVersion,
          to: CIVIC_CONTRACT_TEST_SCHEMA_VERSION,
          appliedAt: now,
          kind: 'upgrade',
          sourceCollections: { adapters: adapters.length }
        }
      ]
    }
  };

  return { data, migrated: true, historyEntry: data.meta.migrationHistory[0] };
};

export const buildContractTestIndexes = (data = {}) => {
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
    adaptersById: byId('adapters'),
    suitesById: byId('suites'),
    testsById: byId('tests'),
    runsById: byId('runs'),
    resultsById: byId('results'),
    adaptersByStatus: groupBy('adapters', 'isActive'),
    suitesByStatus: groupBy('suites', 'status'),
    runsByStatus: groupBy('runs', 'status'),
    suitesByAdapter: groupBy('suites', 'adapterId'),
    testsBySuite: groupBy('tests', 'suiteId'),
    runsBySuite: groupBy('runs', 'suiteId'),
    resultsByRun: groupBy('results', 'runId'),
    auditLogByAction: groupBy('auditLog', 'action')
  };
};

export const loadContractTestStore = ({ storage = null, seed = true, now } = {}) => {
  const raw = safeGetItem(CIVIC_CONTRACT_TEST_STORAGE_KEY, storage);
  if (!raw) {
    const initial = seed ? createSeedStore({ now }) : createEmptyStore({ now });
    safeSetItem(CIVIC_CONTRACT_TEST_STORAGE_KEY, JSON.stringify(initial), storage);
    return initial;
  }
  try {
    const parsed = JSON.parse(raw);
    if (isValidStoreShape(parsed)) return parsed;
    const { data } = migrateContractTestStore(parsed, { now: now || new Date().toISOString() });
    safeSetItem(CIVIC_CONTRACT_TEST_STORAGE_KEY, JSON.stringify(data), storage);
    return data;
  } catch (error) {
    logDiagnostic('Corrupt contract test store; re-seeding the local bundle.', error);
    const initial = seed ? createSeedStore({ now }) : createEmptyStore({ now });
    safeSetItem(CIVIC_CONTRACT_TEST_STORAGE_KEY, JSON.stringify(initial), storage);
    return initial;
  }
};

export const ensureContractTestStore = (options = {}) => {
  const data = loadContractTestStore(options);
  return { ...data, indexes: buildContractTestIndexes(data) };
};

export const persistContractTestStore = (data, { storage = null, now = new Date().toISOString() } = {}) => {
  if (!data || !COLLECTIONS.every((key) => Array.isArray(data[key]))) {
    throw new Error(`${CONTRACT_TEST_ERRORS.INVALID_REQUEST}: Refusing to persist a store with a missing collection.`);
  }
  const next = {
    ...data,
    schemaVersion: CIVIC_CONTRACT_TEST_SCHEMA_VERSION,
    updatedAt: now,
    meta: {
      ...(data.meta || {}),
      schemaVersion: CIVIC_CONTRACT_TEST_SCHEMA_VERSION,
      lastSavedAt: now
    }
  };
  safeSetItem(CIVIC_CONTRACT_TEST_STORAGE_KEY, JSON.stringify(next), storage);
  return next;
};

/**
 * Transactional write: the mutator receives a detached draft. Nothing is
 * persisted unless it completes. If the mutator throws, storage still holds
 * the previous bundle.
 */
export const runContractTestTransaction = (mutator, { storage = null, now, loadStore = loadContractTestStore, persistStore = persistContractTestStore } = {}) => {
  const current = loadStore({ storage, now });
  const draft = clone(current);
  let result;
  try {
    result = mutator(draft);
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error(`${CONTRACT_TEST_ERRORS.INVALID_REQUEST}: The contract test change could not be saved. No records were written.`);
  }
  const persisted = persistStore(draft, { storage, now });
  return { data: persisted, result };
};

export const rollbackContractTestStore = ({ storage = null, now } = {}) => {
  safeRemoveItem(CIVIC_CONTRACT_TEST_STORAGE_KEY, storage);
  const seeded = createSeedStore({ now });
  persistContractTestStore(seeded, { storage, now });
  return { ...seeded, indexes: buildContractTestIndexes(seeded) };
};

export const resetContractTestStoreToEmpty = ({ storage = null, now } = {}) => {
  safeRemoveItem(CIVIC_CONTRACT_TEST_STORAGE_KEY, storage);
  const empty = createEmptyStore({ now });
  persistContractTestStore(empty, { storage, now });
  return { ...empty, indexes: buildContractTestIndexes(empty) };
};

/**
 * Retention: completed/stopped runs older than retentionDays are archived;
 * their results stay for audit. Audit log entries older than retentionDays
 * are archived too.
 */
export const applyContractTestRetentionPolicy = (
  { retentionDays = 90, now = new Date().toISOString() } = {},
  { storage = null } = {}
) => {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - retentionDays);

  return runContractTestTransaction(
    (draft) => {
      let archivedRuns = 0;
      draft.runs = draft.runs.map((run) => {
        if (
          [CONTRACT_TEST_STATUS.COMPLETED, CONTRACT_TEST_STATUS.FAILED, CONTRACT_TEST_STATUS.CANCELLED].includes(run.status) &&
          new Date(run.updatedAt) < cutoff
        ) {
          archivedRuns += 1;
          return { ...run, status: 'archived', archivedAt: now, updatedAt: now };
        }
        return run;
      });

      let archivedAuditEntries = 0;
      draft.auditLog = draft.auditLog.map((entry) => {
        if (new Date(entry.timestamp) < cutoff) {
          archivedAuditEntries += 1;
          return { ...entry, status: 'archived', archivedAt: now };
        }
        return entry;
      });

      draft.auditLog.unshift({
        id: `audit-retention-${Date.now()}`,
        action: 'retention.applied',
        entityType: 'contractTestStore',
        entityId: 'bundle',
        actorRole: 'system',
        actorId: 'contractTest.retention',
        reason: 'Scheduled retention policy run.',
        details: { archivedRuns, archivedAuditEntries, retentionDays },
        timestamp: now,
        schemaVersion: CIVIC_CONTRACT_TEST_SCHEMA_VERSION
      });

      return { archivedRuns, archivedAuditEntries };
    },
    { storage, now }
  );
};

export const __testables = {
  createEmptyStore,
  createSeedStore,
  isValidStoreShape,
  migrateContractTestStore,
  buildContractTestIndexes,
  loadContractTestStore,
  ensureContractTestStore,
  persistContractTestStore,
  runContractTestTransaction,
  rollbackContractTestStore,
  resetContractTestStoreToEmpty,
  applyContractTestRetentionPolicy,
  isAdapterId,
  isSuiteId,
  isTestId,
  isRunId,
  COLLECTIONS,
  CONTRACT_TEST_STATUS,
  CONTRACT_TEST_ERRORS,
  DEFAULT_ADAPTER,
  DEFAULT_CONTRACT_SUITE,
  DEFAULT_CONTRACT_TEST_RUN
};
