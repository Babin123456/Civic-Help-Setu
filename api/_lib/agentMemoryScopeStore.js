/**
 * api/_lib/agentMemoryScopeStore.js
 *
 * Persistent tenant- and case-scoped memory partition store (#1447).
 */

import {
  DEFAULT_ALLOWLISTED_CATEGORIES,
  MEMORY_SCOPE_MODES,
  MEMORY_SCOPE_SCHEMA_VERSION,
  migrateMemoryScopeStoreState,
} from '../../src/services/agentMemory/memoryScopeIsolationLayer.js';

const MAX_AUDIT_LOG = 200;

export class InMemoryAgentMemoryScopeStore {
  constructor(initialState = {}) {
    const migrated = migrateMemoryScopeStoreState(initialState);
    this.schemaVersion = migrated.schemaVersion || MEMORY_SCOPE_SCHEMA_VERSION;
    this.partitions = new Map();
    for (const [key, val] of Object.entries(migrated.partitions)) {
      this.partitions.set(key, val);
    }
    this.auditLog = migrated.auditLog || [];
  }

  _key(tenantId, caseId) {
    return `${tenantId}:${caseId}`;
  }

  async getOrCreatePartition(tenantId, caseId) {
    const key = this._key(tenantId, caseId);
    if (!this.partitions.has(key)) {
      this.partitions.set(key, {
        tenantId,
        caseId,
        mode: MEMORY_SCOPE_MODES.CASE_SCOPED_ALLOWLIST,
        allowlistedCategories: [...DEFAULT_ALLOWLISTED_CATEGORIES],
        entries: [],
        updatedAt: new Date().toISOString(),
      });
    }
    return this.partitions.get(key);
  }

  async saveEntry(tenantId, caseId, entry) {
    const partition = await this.getOrCreatePartition(tenantId, caseId);
    partition.entries.unshift(entry);
    partition.updatedAt = new Date().toISOString();
    return entry;
  }

  async setPartitionPolicy(tenantId, caseId, { mode, allowlistedCategories }) {
    const partition = await this.getOrCreatePartition(tenantId, caseId);
    if (mode && Object.values(MEMORY_SCOPE_MODES).includes(mode)) {
      partition.mode = mode;
    }
    if (Array.isArray(allowlistedCategories)) {
      partition.allowlistedCategories = allowlistedCategories.map((c) => String(c).trim()).filter(Boolean);
    }
    partition.updatedAt = new Date().toISOString();
    return partition;
  }

  async deleteEntry(tenantId, caseId, entryId) {
    const partition = await this.getOrCreatePartition(tenantId, caseId);
    const before = partition.entries.length;
    partition.entries = partition.entries.filter((e) => e.entryId !== entryId);
    partition.updatedAt = new Date().toISOString();
    return before !== partition.entries.length;
  }

  async deletePartition(tenantId, caseId) {
    const key = this._key(tenantId, caseId);
    const existed = this.partitions.has(key);
    this.partitions.delete(key);
    return existed;
  }

  async appendAuditLog(entry) {
    const safeEntry = {
      id: `mem-aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      action: String(entry.action || 'UNKNOWN'),
      actorId: String(entry.actorId || 'system'),
      role: String(entry.role || 'unknown'),
      tenantId: String(entry.tenantId || 'unknown'),
      caseId: String(entry.caseId || 'unknown'),
      status: String(entry.status || 'ok'),
      summary: String(entry.summary || '').slice(0, 240),
    };
    this.auditLog.unshift(safeEntry);
    if (this.auditLog.length > MAX_AUDIT_LOG) {
      this.auditLog.length = MAX_AUDIT_LOG;
    }
    return safeEntry;
  }

  async listAuditLog({ limit = 50 } = {}) {
    return this.auditLog.slice(0, Math.min(100, Math.max(1, Number(limit) || 50)));
  }
}

let defaultStore = null;

export function getDefaultAgentMemoryScopeStore() {
  if (!defaultStore) {
    defaultStore = new InMemoryAgentMemoryScopeStore();
  }
  return defaultStore;
}

export function resetDefaultAgentMemoryScopeStoreForTests() {
  defaultStore = null;
}

export async function getProductionAgentMemoryScopeStore() {
  return getDefaultAgentMemoryScopeStore();
}
