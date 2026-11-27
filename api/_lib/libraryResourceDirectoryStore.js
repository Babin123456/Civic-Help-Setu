/**
 * api/_lib/libraryResourceDirectoryStore.js
 *
 * Persistent store for Public Library & Community Learning Resource Directory (#1439).
 */

import {
  LIBRARY_DIR_SCHEMA_VERSION,
  migrateLibraryDirectoryState,
} from '../../src/services/libraryResourceDirectoryService.js';

const MAX_AUDIT_LOG = 200;

export class InMemoryLibraryDirectoryStore {
  constructor(initialState = {}) {
    const migrated = migrateLibraryDirectoryState(initialState);
    this.schemaVersion = migrated.schemaVersion || LIBRARY_DIR_SCHEMA_VERSION;
    this.facilities = new Map();
    this.auditLog = migrated.auditLog || [];

    for (const f of migrated.facilities) {
      if (f?.facilityId) this.facilities.set(f.facilityId, f);
    }
  }

  async saveFacility(facility) {
    if (!facility?.facilityId) throw new Error('Facility requires facilityId');
    this.facilities.set(facility.facilityId, facility);
    return facility;
  }

  async getFacility(facilityId) {
    return this.facilities.get(facilityId) || null;
  }

  async listFacilities() {
    return Array.from(this.facilities.values());
  }

  async appendAuditLog(entry) {
    const safeEntry = {
      id: `lib-aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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

export function getDefaultLibraryDirectoryStore() {
  if (!defaultStore) defaultStore = new InMemoryLibraryDirectoryStore();
  return defaultStore;
}

export function resetDefaultLibraryDirectoryStoreForTests() {
  defaultStore = null;
}

export async function getProductionLibraryDirectoryStore() {
  return getDefaultLibraryDirectoryStore();
}
