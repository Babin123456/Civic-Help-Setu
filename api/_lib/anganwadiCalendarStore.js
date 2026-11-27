/**
 * api/_lib/anganwadiCalendarStore.js
 *
 * Persistent store for Public Anganwadi Service Availability & Nutrition-Day Calendar (#1438).
 */

import {
  ANGANWADI_CALENDAR_SCHEMA_VERSION,
  migrateAnganwadiCalendarState,
} from '../../src/services/anganwadiCalendarService.js';

const MAX_AUDIT_LOG = 200;

export class InMemoryAnganwadiCalendarStore {
  constructor(initialState = {}) {
    const migrated = migrateAnganwadiCalendarState(initialState);
    this.schemaVersion = migrated.schemaVersion || ANGANWADI_CALENDAR_SCHEMA_VERSION;
    this.centres = new Map();
    this.auditLog = migrated.auditLog || [];

    for (const c of migrated.centres) {
      if (c?.centreId) this.centres.set(c.centreId, c);
    }
  }

  async saveCentre(centre) {
    if (!centre?.centreId) throw new Error('Centre requires centreId');
    this.centres.set(centre.centreId, centre);
    return centre;
  }

  async getCentre(centreId) {
    return this.centres.get(centreId) || null;
  }

  async listCentres({ wardId = null, jurisdiction = null } = {}) {
    let items = Array.from(this.centres.values());
    if (wardId) items = items.filter((c) => c.wardId === wardId);
    if (jurisdiction) {
      const target = jurisdiction.trim().toLowerCase();
      items = items.filter((c) => String(c.jurisdiction || '').toLowerCase() === target);
    }
    return items;
  }

  async appendAuditLog(entry) {
    const safeEntry = {
      id: `awc-aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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

export function getDefaultAnganwadiCalendarStore() {
  if (!defaultStore) defaultStore = new InMemoryAnganwadiCalendarStore();
  return defaultStore;
}

export function resetDefaultAnganwadiCalendarStoreForTests() {
  defaultStore = null;
}

export async function getProductionAnganwadiCalendarStore() {
  return getDefaultAnganwadiCalendarStore();
}
