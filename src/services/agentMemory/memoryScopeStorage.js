/**
 * src/services/agentMemory/memoryScopeStorage.js
 *
 * Offline-first local partition storage for Civic Agent Memory Scope (#1447).
 */

import {
  DEFAULT_ALLOWLISTED_CATEGORIES,
  MEMORY_ORIGINS,
  MEMORY_SCOPE_MODES,
  createScopedMemoryEntry,
  migrateMemoryScopeStoreState,
  retrieveScopedContext,
} from './memoryScopeIsolationLayer.js';

export const MEMORY_SCOPE_STORAGE_KEY = 'civicbridge_agent_memory_scope_v1';

let memoryFallback = null;

function getStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Ignore restricted storage
  }
  return null;
}

export function loadLocalMemoryScopeState() {
  const storage = getStorage();
  if (storage) {
    try {
      const raw = storage.getItem(MEMORY_SCOPE_STORAGE_KEY);
      if (raw) {
        return migrateMemoryScopeStoreState(JSON.parse(raw));
      }
    } catch {
      // Fallback
    }
  }
  if (memoryFallback) {
    return migrateMemoryScopeStoreState(memoryFallback);
  }
  const now = Date.now();
  const seedEntry = createScopedMemoryEntry({
    tenantId: 'up-lucknow',
    caseId: 'case-passport-01',
    origin: MEMORY_ORIGINS.OFFICIAL_RECORD,
    category: 'document_checklist',
    content: 'Standard passport renewal requires Proof of Address and old passport booklet.',
    sourceReference: {
      source: 'MEA Passport Seva Document Advisor',
      jurisdiction: 'IN-NATIONAL',
      effectiveDate: '2026-01-01',
      lastVerifiedAt: '2026-11-20T00:00:00.000Z',
    },
    nowMs: now,
  });
  return migrateMemoryScopeStoreState({
    partitions: {
      'up-lucknow:case-passport-01': {
        tenantId: 'up-lucknow',
        caseId: 'case-passport-01',
        mode: MEMORY_SCOPE_MODES.CASE_SCOPED_ALLOWLIST,
        allowlistedCategories: [...DEFAULT_ALLOWLISTED_CATEGORIES],
        entries: [seedEntry],
      },
    },
  });
}

export function saveLocalMemoryScopeState(state) {
  const migrated = migrateMemoryScopeStoreState(state);
  memoryFallback = migrated;
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(MEMORY_SCOPE_STORAGE_KEY, JSON.stringify(migrated));
    } catch {
      // Ignore quota
    }
  }
  return migrated;
}

export function resetLocalMemoryScopeState() {
  memoryFallback = null;
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(MEMORY_SCOPE_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
}

export function getPartitionSnapshot(tenantId, caseId) {
  const state = loadLocalMemoryScopeState();
  const key = `${tenantId}:${caseId}`;
  const partition = state.partitions[key] || {
    tenantId,
    caseId,
    mode: MEMORY_SCOPE_MODES.CASE_SCOPED_ALLOWLIST,
    allowlistedCategories: [...DEFAULT_ALLOWLISTED_CATEGORIES],
    entries: [],
  };
  const retrieval = retrieveScopedContext({
    entries: partition.entries,
    tenantId,
    caseId,
    mode: partition.mode,
    allowlistedCategories: partition.allowlistedCategories,
  });
  return { partition, retrieval, state };
}
