/**
 * api/_lib/recommendationFairnessAuditStore.js
 *
 * Persistent store contract for the Civic Recommendation Fairness and
 * Coverage Audit Suite (#1449).
 * Uses safe schema migration, bounded retention, and redacted audit logging.
 */

import {
  AUDIT_SCHEMA_VERSION,
  DEFAULT_AUDIT_POLICY,
  migrateAuditStoreState,
} from '../../src/services/recommendationFairnessAuditContract.js';
import { getBuiltInOfflineEvaluationDatasets } from '../../src/services/recommendationFairnessAuditService.js';

const MAX_RUNS = 50;
const MAX_AUDIT_LOG = 200;

export class InMemoryFairnessAuditStore {
  constructor(initialState = {}) {
    const migrated = migrateAuditStoreState(initialState);
    this.schemaVersion = migrated.schemaVersion || AUDIT_SCHEMA_VERSION;
    this.datasets = new Map();
    for (const ds of getBuiltInOfflineEvaluationDatasets()) {
      this.datasets.set(ds.id, ds);
    }
    for (const ds of migrated.datasets) {
      if (ds?.id) this.datasets.set(ds.id, ds);
    }
    this.runs = new Map();
    this.runOrder = [];
    for (const run of migrated.runs) {
      if (run?.runId) {
        this.runs.set(run.runId, run);
        this.runOrder.push(run.runId);
      }
    }
    this.policy = migrated.policy || { ...DEFAULT_AUDIT_POLICY };
    this.auditLog = migrated.auditLog || [];
  }

  async listDatasets({ jurisdiction = null } = {}) {
    let items = Array.from(this.datasets.values());
    if (jurisdiction) {
      const target = jurisdiction.trim().toLowerCase();
      items = items.filter(
        (ds) => String(ds.provenance?.jurisdiction || '').toLowerCase() === target
      );
    }
    return items.map((ds) => ({
      schemaVersion: ds.schemaVersion,
      id: ds.id,
      name: ds.name,
      version: ds.version,
      consentMode: ds.consentMode,
      recordOrigin: ds.recordOrigin,
      provenance: ds.provenance,
      recordCount: Array.isArray(ds.records) ? ds.records.length : 0,
      createdAt: ds.createdAt,
    }));
  }

  async getDataset(datasetId) {
    return this.datasets.get(datasetId) || null;
  }

  async saveDataset(dataset) {
    if (!dataset?.id) throw new Error('Dataset requires id');
    this.datasets.set(dataset.id, dataset);
    return dataset;
  }

  async saveRun(run) {
    if (!run?.runId) throw new Error('Audit run requires runId');
    if (!this.runs.has(run.runId)) {
      this.runOrder.push(run.runId);
      while (this.runOrder.length > MAX_RUNS) {
        const oldest = this.runOrder.shift();
        this.runs.delete(oldest);
      }
    }
    this.runs.set(run.runId, run);
    return run;
  }

  async getRun(runId) {
    return this.runs.get(runId) || null;
  }

  async listRuns({ limit = 25, datasetId = null, cohortAxis = null, jurisdiction = null } = {}) {
    let items = Array.from(this.runs.values());
    if (datasetId) {
      items = items.filter((r) => r.datasetId === datasetId);
    }
    if (cohortAxis) {
      items = items.filter((r) => r.cohortAxis === cohortAxis);
    }
    if (jurisdiction) {
      const target = jurisdiction.trim().toLowerCase();
      items = items.filter(
        (r) => String(r.provenance?.jurisdiction || '').toLowerCase() === target
      );
    }
    items.sort((a, b) => Date.parse(b.evaluatedAt || 0) - Date.parse(a.evaluatedAt || 0));
    return items.slice(0, Math.min(50, Math.max(1, Number(limit) || 25)));
  }

  async getPolicy() {
    return { ...this.policy };
  }

  async setPolicy(nextPolicy) {
    this.policy = {
      ...this.policy,
      ...nextPolicy,
      provenance: {
        ...this.policy.provenance,
        ...(nextPolicy?.provenance || {}),
      },
    };
    return { ...this.policy };
  }

  async appendAuditLog(entry) {
    const safeEntry = {
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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

export function getDefaultFairnessAuditStore() {
  if (!defaultStore) {
    defaultStore = new InMemoryFairnessAuditStore();
  }
  return defaultStore;
}

export function resetDefaultFairnessAuditStoreForTests() {
  defaultStore = null;
}

export async function getProductionFairnessAuditStore() {
  return getDefaultFairnessAuditStore();
}

