/**
 * api/_lib/accessibilityBarrierSlaStore.js
 *
 * Persistent store for Accessibility Barrier Resolution SLA Dashboard (#1443).
 */

import {
  BARRIER_SLA_SCHEMA_VERSION,
  migrateBarrierSlaState,
} from '../../src/services/accessibilityBarrierSlaService.js';

const MAX_REPORTS = 500;
const MAX_AUDIT_LOG = 200;

export class InMemoryBarrierSlaStore {
  constructor(initialState = {}) {
    const migrated = migrateBarrierSlaState(initialState);
    this.schemaVersion = migrated.schemaVersion || BARRIER_SLA_SCHEMA_VERSION;
    this.reports = new Map();
    this.reportOrder = [];
    this.auditLog = migrated.auditLog || [];

    for (const r of migrated.reports) {
      if (r?.reportId) {
        this.reports.set(r.reportId, r);
        this.reportOrder.push(r.reportId);
      }
    }
  }

  async saveReport(report) {
    if (!report?.reportId) throw new Error('Report requires reportId');
    if (!this.reports.has(report.reportId)) {
      this.reportOrder.push(report.reportId);
      while (this.reportOrder.length > MAX_REPORTS) {
        const oldest = this.reportOrder.shift();
        this.reports.delete(oldest);
      }
    }
    this.reports.set(report.reportId, report);
    return report;
  }

  async getReport(reportId) {
    return this.reports.get(reportId) || null;
  }

  async listReports() {
    return Array.from(this.reports.values());
  }

  async appendAuditLog(entry) {
    const safeEntry = {
      id: `sla-aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      action: String(entry.action || 'UNKNOWN'),
      actorRef: String(entry.actorRef || 'system'),
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

export function getDefaultBarrierSlaStore() {
  if (!defaultStore) {
    defaultStore = new InMemoryBarrierSlaStore();
  }
  return defaultStore;
}

export function resetDefaultBarrierSlaStoreForTests() {
  defaultStore = null;
}

export async function getProductionBarrierSlaStore() {
  return getDefaultBarrierSlaStore();
}
