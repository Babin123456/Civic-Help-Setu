/**
 * api/_lib/grievanceCompletenessCoachStore.js
 *
 * Persistent store for Public Grievance Language Quality & Completeness Coach (#1444).
 */

import {
  COACH_SCHEMA_VERSION,
  migrateCoachStoreState,
} from '../../src/services/grievanceCompletenessCoachService.js';

const MAX_DRAFTS = 300;
const MAX_AUDIT_LOG = 200;

export class InMemoryGrievanceCoachStore {
  constructor(initialState = {}) {
    const migrated = migrateCoachStoreState(initialState);
    this.schemaVersion = migrated.schemaVersion || COACH_SCHEMA_VERSION;
    this.drafts = new Map();
    this.draftOrder = [];
    this.auditLog = migrated.auditLog || [];

    for (const d of migrated.drafts) {
      if (d?.draftId) {
        this.drafts.set(d.draftId, d);
        this.draftOrder.push(d.draftId);
      }
    }
  }

  async saveDraft(draft) {
    if (!draft?.draftId) throw new Error('Draft requires draftId');
    if (!this.drafts.has(draft.draftId)) {
      this.draftOrder.push(draft.draftId);
      while (this.draftOrder.length > MAX_DRAFTS) {
        const oldest = this.draftOrder.shift();
        this.drafts.delete(oldest);
      }
    }
    this.drafts.set(draft.draftId, draft);
    return draft;
  }

  async getDraft(draftId) {
    return this.drafts.get(draftId) || null;
  }

  async listDrafts({ ownerId = null, limit = 50 } = {}) {
    let items = Array.from(this.drafts.values());
    if (ownerId) {
      items = items.filter((d) => d.ownerId === ownerId);
    }
    items.sort((a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0));
    return items.slice(0, Math.min(100, Math.max(1, Number(limit) || 50)));
  }

  async appendAuditLog(entry) {
    const safeEntry = {
      id: `cqc-aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      action: String(entry.action || 'UNKNOWN'),
      actorId: String(entry.actorId || 'system'),
      role: String(entry.role || 'unknown'),
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

export function getDefaultGrievanceCoachStore() {
  if (!defaultStore) {
    defaultStore = new InMemoryGrievanceCoachStore();
  }
  return defaultStore;
}

export function resetDefaultGrievanceCoachStoreForTests() {
  defaultStore = null;
}

export async function getProductionGrievanceCoachStore() {
  return getDefaultGrievanceCoachStore();
}
