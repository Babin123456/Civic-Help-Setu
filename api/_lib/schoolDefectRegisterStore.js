/**
 * api/_lib/schoolDefectRegisterStore.js
 *
 * Persistent store for Public School Infrastructure Defect & Follow-Up Register (#1437).
 */

import {
  SCHOOL_DEFECT_SCHEMA_VERSION,
  migrateSchoolDefectStoreState,
} from '../../src/services/schoolDefectRegisterService.js';

const MAX_REPORTS = 500;
const MAX_AUDIT_LOG = 200;

export class InMemorySchoolDefectStore {
  constructor(initialState = {}) {
    const migrated = migrateSchoolDefectStoreState(initialState);
    this.schemaVersion = migrated.schemaVersion || SCHOOL_DEFECT_SCHEMA_VERSION;
    this.reports = new Map();
    this.reportOrder = [];
    this.auditLog = migrated.auditLog || [];

    for (const r of migrated.reports) {
      if (r?.defectId) {
        this.reports.set(r.defectId, r);
        this.reportOrder.push(r.defectId);
      }
    }
  }

  async saveReport(report) {
    if (!report?.defectId) throw new Error('Report requires defectId');
    if (!this.reports.has(report.defectId)) {
      this.reportOrder.push(report.defectId);
      while (this.reportOrder.length > MAX_REPORTS) {
        const oldest = this.reportOrder.shift();
        this.reports.delete(oldest);
      }
    }
    this.reports.set(report.defectId, report);
    return report;
  }

  async getReport(defectId) {
    return this.reports.get(defectId) || null;
  }

  async listReports() {
    return Array.from(this.reports.values());
  }

  async appendAuditLog(entry) {
    const safeEntry = {
      id: `sch-aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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

export function getDefaultSchoolDefectStore() {
  if (!defaultStore) defaultStore = new InMemorySchoolDefectStore();
  return defaultStore;
}

export function resetDefaultSchoolDefectStoreForTests() {
  defaultStore = null;
}

export async function getProductionSchoolDefectStore() {
  return getDefaultSchoolDefectStore();
}
