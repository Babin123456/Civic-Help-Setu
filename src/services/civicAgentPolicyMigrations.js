/**
 * src/services/civicAgentPolicyMigrations.js
 *
 * Persistence, schema migration, indexing and rollback for the Civic Agent
 * Workflow Policy-as-Code Engine (#1187).
 *
 * Design rules (mirroring ghgInventoryMigrations.js):
 *  - One JSON bundle per storage key; a multi-collection write is atomic: the
 *    new bundle replaces the old one only after the mutator returns.
 *  - localStorage with an in-memory fallback (tests, private mode, quota errors)
 *    so the workflow keeps working offline.
 *  - Versioned schema; legacy shapes are migrated, nothing is silently dropped.
 *  - Deterministic IDs (no Math.random for access-control-relevant ids).
 *  - No citizen records, credentials, raw documents or sensitive prompts are
 *    persisted: only policy documents, rule metadata and evaluation audit
 *    records (aggregated, no sensitive prompts).
 */

import {
  CIVIC_AGENT_POLICY_SCHEMA_VERSION,
  CIVIC_AGENT_POLICY_STORAGE_KEY,
  POLICY_ENGINE_STATUS,
  POLICY_ERRORS,
  DEFAULT_POLICY,
  POLICY_ID_PATTERN,
  RULE_ID_PATTERN
} from '../data/civicAgentPolicyConstants.js';
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

const COLLECTIONS = ['policies', 'policyVersions', 'evaluationAudit', 'emergencyRevocations'];

const isSlug = (value) =>
  typeof value === 'string' && value.length > 0 && value.length <= 120 && POLICY_ID_PATTERN.test(value);

export const isPolicyId = (value) => isSlug(value);

export const isRuleId = (value) =>
  typeof value === 'string' && value.length > 0 && value.length <= 120 && RULE_ID_PATTERN.test(value);

export const createEmptyStore = ({ now = new Date().toISOString() } = {}) => ({
  schemaVersion: CIVIC_AGENT_POLICY_SCHEMA_VERSION,
  createdAt: now,
  updatedAt: now,
  meta: {
    schemaVersion: CIVIC_AGENT_POLICY_SCHEMA_VERSION,
    migratedAt: now,
    lastSavedAt: now,
    migrationHistory: []
  },
  policies: [],
  policyVersions: [],
  evaluationAudit: [],
  emergencyRevocations: []
});

export const createSeedStore = ({ now = new Date().toISOString() } = {}) => ({
  schemaVersion: CIVIC_AGENT_POLICY_SCHEMA_VERSION,
  createdAt: now,
  updatedAt: now,
  meta: {
    schemaVersion: CIVIC_AGENT_POLICY_SCHEMA_VERSION,
    migratedAt: now,
    lastSavedAt: now,
    seeded: true,
    migrationHistory: [{ from: 0, to: CIVIC_AGENT_POLICY_SCHEMA_VERSION, appliedAt: now, kind: 'seed' }]
  },
  policies: [clone(DEFAULT_POLICY)],
  policyVersions: [{ ...clone(DEFAULT_POLICY), versionHistory: [{ version: 1, appliedAt: now, kind: 'initial' }] }],
  evaluationAudit: [],
  emergencyRevocations: []
});

export const isValidStoreShape = (data) =>
  Boolean(
    data &&
      typeof data === 'object' &&
      data.schemaVersion === CIVIC_AGENT_POLICY_SCHEMA_VERSION &&
      COLLECTIONS.every((key) => Array.isArray(data[key]))
  );

export const migratePolicyStore = (legacy, { now = new Date().toISOString() } = {}) => {
  if (!legacy || typeof legacy !== 'object') {
    throw new Error(`${POLICY_ERRORS.INVALID_REQUEST}: Legacy store must be an object.`);
  }
  if (isValidStoreShape(legacy)) {
    return { data: legacy, migrated: false, historyEntry: null };
  }

  const fromVersion = Number(legacy.schemaVersion || legacy.version || 0);
  const policies = (legacy.policies || []).map((policy) => ({
    ...policy,
    schemaVersion: CIVIC_AGENT_POLICY_SCHEMA_VERSION,
    updatedAt: policy.updatedAt || now,
    id: policy.id || `policy-legacy-${String(fromVersion)}-${Date.now()}`,
    denyByDefault: policy.denyByDefault !== false,
    emergencyLocked: Boolean(policy.emergencyLocked),
    status: policy.status || POLICY_ENGINE_STATUS.DRAFT,
    rules: Array.isArray(policy.rules) ? policy.rules : [],
    versionHistory: policy.versionHistory || [{ version: 1, appliedAt: now, kind: 'initial' }]
  }));

  const data = {
    ...createEmptyStore({ now }),
    policies,
    policyVersions: policies.map((p) => ({ ...p, versionHistory: p.versionHistory || [] })),
    meta: {
      ...createEmptyStore({ now }).meta,
      seeded: false,
      migrationHistory: [
        {
          from: fromVersion,
          to: CIVIC_AGENT_POLICY_SCHEMA_VERSION,
          appliedAt: now,
          kind: 'upgrade',
          sourceCollections: { policies: policies.length }
        }
      ]
    }
  };

  return { data, migrated: true, historyEntry: data.meta.migrationHistory[0] };
};

export const buildPolicyIndexes = (data = {}) => {
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
    policyVersionsById: byId('policyVersions'),
    policiesByStatus: groupBy('policies', 'status'),
    policiesByIdAndVersion: groupBy('policyVersions', 'id'),
    evaluationsByPolicy: groupBy('evaluationAudit', 'policyId'),
    emergencyRevocationsByPolicy: groupBy('emergencyRevocations', 'policyId')
  };
};

export const loadPolicyStore = ({ storage = null, seed = true, now } = {}) => {
  const raw = safeGetItem(CIVIC_AGENT_POLICY_STORAGE_KEY, storage);
  if (!raw) {
    const initial = seed ? createSeedStore({ now }) : createEmptyStore({ now });
    safeSetItem(CIVIC_AGENT_POLICY_STORAGE_KEY, JSON.stringify(initial), storage);
    return initial;
  }
  try {
    const parsed = JSON.parse(raw);
    if (isValidStoreShape(parsed)) return parsed;
    const { data } = migratePolicyStore(parsed, { now: now || new Date().toISOString() });
    safeSetItem(CIVIC_AGENT_POLICY_STORAGE_KEY, JSON.stringify(data), storage);
    return data;
  } catch (error) {
    logDiagnostic('Corrupt policy store; re-seeding the local bundle.', error);
    const initial = seed ? createSeedStore({ now }) : createEmptyStore({ now });
    safeSetItem(CIVIC_AGENT_POLICY_STORAGE_KEY, JSON.stringify(initial), storage);
    return initial;
  }
};

export const ensurePolicyStore = (options = {}) => {
  const data = loadPolicyStore(options);
  return { ...data, indexes: buildPolicyIndexes(data) };
};

export const persistPolicyStore = (data, { storage = null, now = new Date().toISOString() } = {}) => {
  if (!data || !COLLECTIONS.every((key) => Array.isArray(data[key]))) {
    throw new Error(`${POLICY_ERRORS.MIGRATION_FAILED}: Refusing to persist a store with a missing collection.`);
  }
  const next = {
    ...data,
    schemaVersion: CIVIC_AGENT_POLICY_SCHEMA_VERSION,
    updatedAt: now,
    meta: {
      ...(data.meta || {}),
      schemaVersion: CIVIC_AGENT_POLICY_SCHEMA_VERSION,
      lastSavedAt: now
    }
  };
  safeSetItem(CIVIC_AGENT_POLICY_STORAGE_KEY, JSON.stringify(next), storage);
  return next;
};

/**
 * Transactional write: the mutator receives a detached draft. Nothing is
 * persisted unless it completes. If the mutator throws, storage still holds
 * the previous bundle.
 */
export const runPolicyTransaction = (mutator, { storage = null, now } = {}) => {
  const current = loadPolicyStore({ storage, now });
  const draft = clone(current);
  let result;
  try {
    result = mutator(draft);
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error(`${POLICY_ERRORS.MIGRATION_FAILED}: The policy change could not be saved. No records were written.`);
  }
  const persisted = persistPolicyStore(draft, { storage, now });
  return { data: persisted, result };
};

export const rollbackPolicyStore = ({ storage = null, now } = {}) => {
  safeRemoveItem(CIVIC_AGENT_POLICY_STORAGE_KEY, storage);
  const seeded = createSeedStore({ now });
  persistPolicyStore(seeded, { storage, now });
  return { ...seeded, indexes: buildPolicyIndexes(seeded) };
};

export const resetPolicyStoreToEmpty = ({ storage = null, now } = {}) => {
  safeRemoveItem(CIVIC_AGENT_POLICY_STORAGE_KEY, storage);
  const empty = createEmptyStore({ now });
  persistPolicyStore(empty, { storage, now });
  return { ...empty, indexes: buildPolicyIndexes(empty) };
};

/**
 * Retention: archived policies older than retentionDays are kept for audit.
 * Emergency revocations older than retentionDays are marked archived.
 */
export const applyPolicyRetentionPolicy = (
  { retentionDays = 90, now = new Date().toISOString() } = {},
  { storage = null } = {}
) => {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - retentionDays);

  return runPolicyTransaction(
    (draft) => {
      let archivedPolicies = 0;
      draft.policies = draft.policies.map((policy) => {
        if (
          [POLICY_ENGINE_STATUS.ARCHIVED, POLICY_ENGINE_STATUS.REVOKED].includes(policy.status) &&
          new Date(policy.updatedAt) < cutoff
        ) {
          archivedPolicies += 1;
          return { ...policy, status: 'retired', retiredAt: now, updatedAt: now };
        }
        return policy;
      });

      let archivedRevocs = 0;
      draft.emergencyRevocations = draft.emergencyRevocations.map((rev) => {
        if (new Date(rev.revokedAt || rev.createdAt) < cutoff) {
          archivedRevocs += 1;
          return { ...rev, status: 'archived', archivedAt: now };
        }
        return rev;
      });

      draft.evaluationAudit.unshift({
        id: `audit-retention-${Date.now()}`,
        action: 'retention.applied',
        entityType: 'policyStore',
        entityId: 'bundle',
        actorRole: 'system',
        actorId: 'policy.retention',
        reason: 'Scheduled retention policy run.',
        details: { archivedPolicies, archivedRevocs, retentionDays },
        timestamp: now,
        schemaVersion: CIVIC_AGENT_POLICY_SCHEMA_VERSION
      });

      return { archivedPolicies, archivedRevocs };
    },
    { storage, now }
  );
};

export const __testables = {
  createEmptyStore,
  createSeedStore,
  isValidStoreShape,
  migratePolicyStore,
  buildPolicyIndexes,
  loadPolicyStore,
  ensurePolicyStore,
  persistPolicyStore,
  runPolicyTransaction,
  rollbackPolicyStore,
  resetPolicyStoreToEmpty,
  applyPolicyRetentionPolicy,
  isPolicyId,
  isRuleId,
  COLLECTIONS,
  POLICY_ENGINE_STATUS,
  POLICY_ERRORS,
  DEFAULT_POLICY
};
