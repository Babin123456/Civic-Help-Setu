/**
 * api/_lib/waterbodyRestorationStore.js
 *
 * Persistent store for Public Waterbody Restoration Milestone & Evidence Tracker (#1442).
 */

import {
  WATERBODY_SCHEMA_VERSION,
  migrateWaterbodyStoreState,
} from '../../src/services/waterbodyRestorationService.js';

const MAX_AUDIT_LOG = 200;

export class InMemoryWaterbodyRestorationStore {
  constructor(initialState = {}) {
    const migrated = migrateWaterbodyStoreState(initialState);
    this.schemaVersion = migrated.schemaVersion || WATERBODY_SCHEMA_VERSION;
    this.waterbodies = new Map();
    this.auditLog = migrated.auditLog || [];

    for (const wb of migrated.waterbodies) {
      if (wb?.waterbodyId) {
        this.waterbodies.set(wb.waterbodyId, wb);
      }
    }
  }

  async saveWaterbody(wb) {
    if (!wb?.waterbodyId) throw new Error('Waterbody requires waterbodyId');
    this.waterbodies.set(wb.waterbodyId, wb);
    return wb;
  }

  async getWaterbody(waterbodyId) {
    return this.waterbodies.get(waterbodyId) || null;
  }

  async listWaterbodies({ jurisdiction = null } = {}) {
    let items = Array.from(this.waterbodies.values());
    if (jurisdiction) {
      const target = jurisdiction.trim().toLowerCase();
      items = items.filter((w) => String(w.jurisdiction || '').toLowerCase() === target);
    }
    return items;
  }

  async appendAuditLog(entry) {
    const safeEntry = {
      id: `wb-aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      action: String(entry.action || 'UNKNOWN'),
      actorId: String(entry.actorId || 'system'),
      role: String(entry.role || 'unknown'),
      jurisdiction: String(entry.jurisdiction || 'UNSPECIFIED'),
      targetId: entry.targetId ? String(entry.targetId) : null,
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

export function getDefaultWaterbodyStore() {
  if (!defaultStore) {
    defaultStore = new InMemoryWaterbodyRestorationStore();
  }
  return defaultStore;
}

export function resetDefaultWaterbodyStoreForTests() {
  defaultStore = null;
}

export async function getProductionWaterbodyStore() {
  return getDefaultWaterbodyStore();
}
