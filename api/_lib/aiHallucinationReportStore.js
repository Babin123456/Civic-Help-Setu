/**
 * api/_lib/aiHallucinationReportStore.js
 *
 * Persistent store for Civic AI Hallucination and Unsupported-Claim Reports (#1448).
 * Enforces bounded retention, regression fixture storage, and redacted audit logging.
 */

import {
  HALLUCINATION_REPORT_SCHEMA_VERSION,
  exportAsRegressionFixture,
  migrateHallucinationStoreState,
} from '../../src/services/aiHallucinationReportService.js';

const MAX_REPORTS = 500;
const MAX_FIXTURES = 200;
const MAX_AUDIT_LOG = 200;

export class InMemoryHallucinationReportStore {
  constructor(initialState = {}) {
    const migrated = migrateHallucinationStoreState(initialState);
    this.schemaVersion = migrated.schemaVersion || HALLUCINATION_REPORT_SCHEMA_VERSION;
    this.reports = new Map();
    this.reportOrder = [];
    this.regressionFixtures = new Map();
    this.auditLog = migrated.auditLog || [];

    for (const r of migrated.reports) {
      if (r?.reportId) {
        this.reports.set(r.reportId, r);
        this.reportOrder.push(r.reportId);
        if (r.regressionFixtureId && r.resolution?.officialSource) {
          const fx = exportAsRegressionFixture(r);
          this.regressionFixtures.set(fx.id, fx);
        }
      }
    }
    for (const fx of migrated.regressionFixtures) {
      if (fx?.id) this.regressionFixtures.set(fx.id, fx);
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

  async listReports({ status = null, riskLevel = null, reporterRef = null, limit = 50 } = {}) {
    let items = Array.from(this.reports.values());
    if (status && status !== 'all') {
      items = items.filter((r) => r.status === status);
    }
    if (riskLevel && riskLevel !== 'all') {
      items = items.filter((r) => r.riskLevel === riskLevel);
    }
    if (reporterRef) {
      items = items.filter((r) => r.reporterRef === reporterRef);
    }
    items.sort((a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0));
    return items.slice(0, Math.min(100, Math.max(1, Number(limit) || 50)));
  }

  async saveRegressionFixture(fixture) {
    if (!fixture?.id) throw new Error('Fixture requires id');
    this.regressionFixtures.set(fixture.id, fixture);
    while (this.regressionFixtures.size > MAX_FIXTURES) {
      const oldestKey = this.regressionFixtures.keys().next().value;
      this.regressionFixtures.delete(oldestKey);
    }
    return fixture;
  }

  async listRegressionFixtures({ limit = 50 } = {}) {
    return Array.from(this.regressionFixtures.values()).slice(0, Math.min(100, Math.max(1, Number(limit) || 50)));
  }

  async appendAuditLog(entry) {
    const safeEntry = {
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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

export function getDefaultHallucinationReportStore() {
  if (!defaultStore) {
    defaultStore = new InMemoryHallucinationReportStore();
  }
  return defaultStore;
}

export function resetDefaultHallucinationReportStoreForTests() {
  defaultStore = null;
}

export async function getProductionHallucinationReportStore() {
  return getDefaultHallucinationReportStore();
}
