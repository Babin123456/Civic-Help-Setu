/**
 * src/services/civicAgentCostCarbonMigrations.js
 *
 * Persistence, schema migration, indexing and rollback for the Civic Agent Cost
 * and Carbon Budget Governor (#1185).
 *
 * Design rules (mirroring ghgInventoryMigrations.js):
 *  - One JSON bundle per storage key; a multi-collection write is atomic: the
 *    new bundle replaces the old one only after the mutator returns.
 *  - localStorage with an in-memory fallback (tests, private mode, quota errors)
 *    so the workflow keeps working offline.
 *  - Versioned schema; legacy shapes are migrated, nothing is silently dropped.
 *  - Deterministic IDs (no Math.random for access-control-relevant ids).
 *  - No citizen records, credentials, raw documents or sensitive prompts are
 *    persisted: only aggregated cost/token/latency/carbon metadata.
 */

import {
  CIVIC_AGENT_COST_CARBON_SCHEMA_VERSION,
  CIVIC_AGENT_COST_CARBON_STORAGE_KEY,
  COST_CARBON_STATUS,
  COST_CARBON_ERRORS,
  DEFAULT_COST_CARBON_POLICY,
  WORKFLOW_ID_PATTERN,
  RUN_ID_PATTERN,
} from '../data/civicAgentCostCarbonConstants.js';
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

const COLLECTIONS = ['policies', 'workflows', 'runs', 'calls', 'auditEvents'];

export const isWorkflowId = (value) =>
  typeof value === 'string' && value.length > 0 && value.length <= 120 && WORKFLOW_ID_PATTERN.test(value);

export const isRunId = (value) =>
  typeof value === 'string' && value.length > 0 && value.length <= 120 && RUN_ID_PATTERN.test(value);

export const createEmptyStore = ({ now = new Date().toISOString() } = {}) => ({
  schemaVersion: CIVIC_AGENT_COST_CARBON_SCHEMA_VERSION,
  createdAt: now,
  updatedAt: now,
  meta: {
    schemaVersion: CIVIC_AGENT_COST_CARBON_SCHEMA_VERSION,
    migratedAt: now,
    lastSavedAt: now,
    migrationHistory: [],
  },
  policies: [],
  workflows: [],
  runs: [],
  calls: [],
  auditEvents: [],
});

export const createSeedStore = ({ now = new Date().toISOString() } = {}) => ({
  schemaVersion: CIVIC_AGENT_COST_CARBON_SCHEMA_VERSION,
  createdAt: now,
  updatedAt: now,
  meta: {
    schemaVersion: CIVIC_AGENT_COST_CARBON_SCHEMA_VERSION,
    migratedAt: now,
    lastSavedAt: now,
    seeded: true,
    migrationHistory: [{ from: 0, to: CIVIC_AGENT_COST_CARBON_SCHEMA_VERSION, appliedAt: now, kind: 'seed' }],
  },
  policies: [clone(DEFAULT_COST_CARBON_POLICY)],
  workflows: [],
  runs: [],
  calls: [],
  auditEvents: [],
});

export const isValidStoreShape = (data) =>
  Boolean(
    data &&
      typeof data === 'object' &&
      data.schemaVersion === CIVIC_AGENT_COST_CARBON_SCHEMA_VERSION &&
      COLLECTIONS.every((key) => Array.isArray(data[key]))
  );

export const migrateCostCarbonStore = (legacy, { now = new Date().toISOString() } = {}) => {
  if (!legacy || typeof legacy !== 'object') {
    throw new Error(`${COST_CARBON_ERRORS.INVALID_REQUEST}: Legacy store must be an object.`);
  }
  if (isValidStoreShape(legacy)) {
    return { data: legacy, migrated: false, historyEntry: null };
  }

  const fromVersion = Number(legacy.schemaVersion || legacy.version || 0);
  const policies = (legacy.policies || []).map((policy) => ({
    ...policy,
    schemaVersion: CIVIC_AGENT_COST_CARBON_SCHEMA_VERSION,
    updatedAt: policy.updatedAt || now,
    id: policy.id || `policy-legacy-${String(fromVersion)}-${Date.now()}`,
  }));

  const data = {
    ...createEmptyStore({ now }),
    policies,
    meta: {
      ...createEmptyStore({ now }).meta,
      seeded: false,
      migrationHistory: [
        {
          from: fromVersion,
          to: CIVIC_AGENT_COST_CARBON_SCHEMA_VERSION,
          appliedAt: now,
          kind: 'upgrade',
          sourceCollections: { policies: policies.length },
        },
      ],
    },
  };

  return { data, migrated: true, historyEntry: data.meta.migrationHistory[0] };
};

export const buildCostCarbonIndexes = (data = {}) => {
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
    policiesById: byId('policies'),
    workflowsById: byId('workflows'),
    runsById: byId('runs'),
    callsById: byId('calls'),
    runsByWorkflow: groupBy('runs', 'workflowId'),
    runsByStatus: groupBy('runs', 'status'),
    callsByRun: groupBy('calls', 'runId'),
    callsByWorkflow: groupBy('calls', 'workflowId'),
    policiesByVersion: groupBy('policies', 'version'),
  };
};

export const loadCostCarbonStore = ({ storage = null, seed = true, now } = {}) => {
  const raw = safeGetItem(CIVIC_AGENT_COST_CARBON_STORAGE_KEY, storage);
  if (!raw) {
    const initial = seed ? createSeedStore({ now }) : createEmptyStore({ now });
    safeSetItem(CIVIC_AGENT_COST_CARBON_STORAGE_KEY, JSON.stringify(initial), storage);
    return initial;
  }
  try {
    const parsed = JSON.parse(raw);
    if (isValidStoreShape(parsed)) return parsed;
    const { data } = migrateCostCarbonStore(parsed, { now: now || new Date().toISOString() });
    safeSetItem(CIVIC_AGENT_COST_CARBON_STORAGE_KEY, JSON.stringify(data), storage);
    return data;
  } catch (error) {
    logDiagnostic('Corrupt cost-carbon budget store; re-seeding the local bundle.', error);
    const initial = seed ? createSeedStore({ now }) : createEmptyStore({ now });
    safeSetItem(CIVIC_AGENT_COST_CARBON_STORAGE_KEY, JSON.stringify(initial), storage);
    return initial;
  }
};

export const ensureCostCarbonStore = (options = {}) => {
  const data = loadCostCarbonStore(options);
  return { ...data, indexes: buildCostCarbonIndexes(data) };
};

export const persistCostCarbonStore = (data, { storage = null, now = new Date().toISOString() } = {}) => {
  if (!data || !COLLECTIONS.every((key) => Array.isArray(data[key]))) {
    throw new Error(`${COST_CARBON_ERRORS.MIGRATION_FAILED}: Refusing to persist a store with a missing collection.`);
  }
  const next = {
    ...data,
    schemaVersion: CIVIC_AGENT_COST_CARBON_SCHEMA_VERSION,
    updatedAt: now,
    meta: {
      ...(data.meta || {}),
      schemaVersion: CIVIC_AGENT_COST_CARBON_SCHEMA_VERSION,
      lastSavedAt: now,
    },
  };
  safeSetItem(CIVIC_AGENT_COST_CARBON_STORAGE_KEY, JSON.stringify(next), storage);
  return next;
};

/**
 * Transactional write: the mutator receives a detached draft. Nothing is
 * persisted unless it completes. If the mutator throws, storage still holds the
 * previous bundle.
 */
export const runCostCarbonTransaction = (mutator, { storage = null, now } = {}) => {
  const current = loadCostCarbonStore({ storage, now });
  const draft = clone(current);
  let result;
  try {
    result = mutator(draft);
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error(`${COST_CARBON_ERRORS.MIGRATION_FAILED}: The cost-carbon change could not be saved. No records were written.`);
  }
  const persisted = persistCostCarbonStore(draft, { storage, now });
  return { data: persisted, result };
};

export const rollbackCostCarbonStore = ({ storage = null, now } = {}) => {
  safeRemoveItem(CIVIC_AGENT_COST_CARBON_STORAGE_KEY, storage);
  const seeded = createSeedStore({ now });
  persistCostCarbonStore(seeded, { storage, now });
  return { ...seeded, indexes: buildCostCarbonIndexes(seeded) };
};

export const resetCostCarbonStoreToEmpty = ({ storage = null, now } = {}) => {
  safeRemoveItem(CIVIC_AGENT_COST_CARBON_STORAGE_KEY, storage);
  const empty = createEmptyStore({ now });
  persistCostCarbonStore(empty, { storage, now });
  return { ...empty, indexes: buildCostCarbonIndexes(empty) };
};

/**
 * Retention: completed/stopped runs older than retentionDays are archived;
 * their aggregated metadata stays for audit. Calls belonging to archived runs
 * are kept but flagged archived.
 */
export const applyCostCarbonRetentionPolicy = (
  { retentionDays = 90, now = new Date().toISOString() } = {},
  { storage = null } = {}
) => {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - retentionDays);

  return runCostCarbonTransaction(
    (draft) => {
      let archivedRuns = 0;
      const archivedRunIds = new Set();
      draft.runs = draft.runs.map((run) => {
        if (
          [COST_CARBON_STATUS.COMPLETED, COST_CARBON_STATUS.STOPPED, COST_CARBON_STATUS.FAILED].includes(run.status) &&
          new Date(run.updatedAt) < cutoff
        ) {
          archivedRuns += 1;
          archivedRunIds.add(run.id);
          return { ...run, status: 'archived', archivedAt: now, updatedAt: now };
        }
        return run;
      });

      let archivedCalls = 0;
      draft.calls = draft.calls.map((call) => {
        if (archivedRunIds.has(call.runId)) {
          archivedCalls += 1;
          return { ...call, archived: true };
        }
        return call;
      });

      draft.auditEvents.unshift({
        id: `audit-retention-${Date.now()}`,
        action: 'retention.applied',
        entityType: 'costCarbonStore',
        entityId: 'bundle',
        actorRole: 'system',
        actorId: 'costCarbon.retention',
        reason: 'Scheduled retention policy run.',
        details: { archivedRuns, archivedCalls, retentionDays },
        timestamp: now,
        schemaVersion: CIVIC_AGENT_COST_CARBON_SCHEMA_VERSION,
      });

      return { archivedRuns, archivedCalls };
    },
    { storage, now }
  );
};

export const __testables = {
  createEmptyStore,
  createSeedStore,
  isValidStoreShape,
  migrateCostCarbonStore,
  buildCostCarbonIndexes,
  loadCostCarbonStore,
  ensureCostCarbonStore,
  persistCostCarbonStore,
  runCostCarbonTransaction,
  rollbackCostCarbonStore,
  resetCostCarbonStoreToEmpty,
  applyCostCarbonRetentionPolicy,
  isWorkflowId,
  isRunId,
  COLLECTIONS,
  COST_CARBON_STATUS,
  COST_CARBON_ERRORS,
};
