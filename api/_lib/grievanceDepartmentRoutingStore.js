/**
 * api/_lib/grievanceDepartmentRoutingStore.js
 *
 * Persistent store for AI-Assisted Grievance Department Routing (#1445).
 */

import {
  ROUTING_SCHEMA_VERSION,
  migrateGrievanceRoutingState,
} from '../../src/services/grievanceDepartmentRoutingService.js';

const MAX_CASES = 300;
const MAX_AUDIT_LOG = 200;

export class InMemoryGrievanceRoutingStore {
  constructor(initialState = {}) {
    const migrated = migrateGrievanceRoutingState(initialState);
    this.schemaVersion = migrated.schemaVersion || ROUTING_SCHEMA_VERSION;
    this.cases = new Map();
    this.caseOrder = [];
    this.auditLog = migrated.auditLog || [];

    for (const c of migrated.cases) {
      if (c?.caseId) {
        this.cases.set(c.caseId, c);
        this.caseOrder.push(c.caseId);
      }
    }
  }

  async saveCase(routingCase) {
    if (!routingCase?.caseId) throw new Error('Case requires caseId');
    if (!this.cases.has(routingCase.caseId)) {
      this.caseOrder.push(routingCase.caseId);
      while (this.caseOrder.length > MAX_CASES) {
        const oldest = this.caseOrder.shift();
        this.cases.delete(oldest);
      }
    }
    this.cases.set(routingCase.caseId, routingCase);
    return routingCase;
  }

  async getCase(caseId) {
    return this.cases.get(caseId) || null;
  }

  async listCases({ status = null, limit = 50 } = {}) {
    let items = Array.from(this.cases.values());
    if (status && status !== 'all') {
      items = items.filter((c) => c.status === status);
    }
    items.sort((a, b) => Date.parse(b.evaluatedAt || 0) - Date.parse(a.evaluatedAt || 0));
    return items.slice(0, Math.min(100, Math.max(1, Number(limit) || 50)));
  }

  async appendAuditLog(entry) {
    const safeEntry = {
      id: `rt-aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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

export function getDefaultGrievanceRoutingStore() {
  if (!defaultStore) {
    defaultStore = new InMemoryGrievanceRoutingStore();
  }
  return defaultStore;
}

export function resetDefaultGrievanceRoutingStoreForTests() {
  defaultStore = null;
}

export async function getProductionGrievanceRoutingStore() {
  return getDefaultGrievanceRoutingStore();
}
