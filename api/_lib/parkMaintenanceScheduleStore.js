/**
 * api/_lib/parkMaintenanceScheduleStore.js
 *
 * Persistent store for Public Park Maintenance & Amenity Inspection Schedule (#1440).
 */

import {
  PARK_SCHEDULE_SCHEMA_VERSION,
  migrateParkMaintenanceState,
} from '../../src/services/parkMaintenanceScheduleService.js';

const MAX_AUDIT_LOG = 200;

export class InMemoryParkScheduleStore {
  constructor(initialState = {}) {
    const migrated = migrateParkMaintenanceState(initialState);
    this.schemaVersion = migrated.schemaVersion || PARK_SCHEDULE_SCHEMA_VERSION;
    this.parks = new Map();
    this.auditLog = migrated.auditLog || [];

    for (const p of migrated.parks) {
      if (p?.parkId) this.parks.set(p.parkId, p);
    }
  }

  async savePark(park) {
    if (!park?.parkId) throw new Error('Park requires parkId');
    this.parks.set(park.parkId, park);
    return park;
  }

  async getPark(parkId) {
    return this.parks.get(parkId) || null;
  }

  async listParks({ wardId = null, jurisdiction = null } = {}) {
    let items = Array.from(this.parks.values());
    if (wardId) items = items.filter((p) => p.wardId === wardId);
    if (jurisdiction) {
      const target = jurisdiction.trim().toLowerCase();
      items = items.filter((p) => String(p.jurisdiction || '').toLowerCase() === target);
    }
    return items;
  }

  async appendAuditLog(entry) {
    const safeEntry = {
      id: `pk-aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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

export function getDefaultParkScheduleStore() {
  if (!defaultStore) defaultStore = new InMemoryParkScheduleStore();
  return defaultStore;
}

export function resetDefaultParkScheduleStoreForTests() {
  defaultStore = null;
}

export async function getProductionParkScheduleStore() {
  return getDefaultParkScheduleStore();
}
