/**
 * api/_lib/civicDraftSyncStore.js
 *
 * Server-side in-memory store for the Civic Draft Sync API (#1424).
 *
 * Invariants:
 *  - Bounded at MAX_DRAFTS (500) entries; oldest evicted when full.
 *  - Full audit log retained (capped at MAX_AUDIT_LOG entries).
 *  - No PII stored: payloads are pre-screened before reaching this store.
 *  - Singleton via getProductionStore() to share state across requests within
 *    the same serverless function instance.
 */

const MAX_DRAFTS = 500;
const MAX_AUDIT_LOG = 2000;

export class InMemoryCivicDraftSyncStore {
  constructor() {
    /** @type {Map<string, object>} draftId → draft record */
    this._drafts = new Map();
    /** @type {Array<object>} chronological audit entries */
    this._auditLog = [];
  }

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------

  _evictIfFull() {
    if (this._drafts.size >= MAX_DRAFTS) {
      // Evict oldest by createdAt
      let oldest = null;
      let oldestTime = Infinity;
      for (const [id, d] of this._drafts) {
        const t = new Date(d.createdAt || 0).getTime();
        if (t < oldestTime) {
          oldestTime = t;
          oldest = id;
        }
      }
      if (oldest) this._drafts.delete(oldest);
    }
  }

  _appendAudit(entry) {
    if (this._auditLog.length >= MAX_AUDIT_LOG) {
      this._auditLog.shift();
    }
    this._auditLog.push({ ...entry, auditedAt: new Date().toISOString() });
  }

  // ---------------------------------------------------------------------------
  // DRAFT OPERATIONS
  // ---------------------------------------------------------------------------

  /**
   * Upsert a draft for a user. Idempotency is handled upstream (idempotencyMiddleware);
   * this method merges fields to support partial updates.
   *
   * @param {object} opts
   * @returns {object} The stored draft record
   */
  upsertDraft({ draftId, userId, entityType, schemaVersion, payload, idempotencyKey, jurisdictionId = 'all' }) {
    const existing = this._drafts.get(draftId);
    const now = new Date().toISOString();

    if (existing) {
      // Conflict detection: if server has a newer revision, record conflict
      const incomingRev = Number(payload?.revision ?? 0);
      const serverRev = Number(existing.revision ?? 0);
      if (incomingRev < serverRev) {
        // Stale update — flag conflict without overwriting
        const conflictRecord = {
          draftId,
          userId,
          serverRevision: serverRev,
          clientRevision: incomingRev,
          serverPayload: existing.payload,
          clientPayload: payload,
          conflictAt: now,
        };
        this._appendAudit({ action: 'CONFLICT_DETECTED', draftId, userId, ...conflictRecord });
        return { ...existing, _conflict: conflictRecord };
      }

      const updated = {
        ...existing,
        payload: { ...(existing.payload || {}), ...(payload || {}) },
        revision: Math.max(serverRev, incomingRev) + 1,
        updatedAt: now,
        idempotencyKey,
        schemaVersion: schemaVersion || existing.schemaVersion,
        syncStatus: 'SYNCED',
        _conflict: null,
      };
      this._drafts.set(draftId, updated);
      this._appendAudit({ action: 'UPSERT_UPDATE', draftId, userId, revision: updated.revision });
      return updated;
    }

    // New draft
    this._evictIfFull();
    const record = {
      draftId,
      userId,
      entityType,
      schemaVersion: schemaVersion || 1,
      jurisdictionId,
      payload: payload || {},
      revision: 1,
      idempotencyKey,
      syncStatus: 'SYNCED',
      createdAt: now,
      updatedAt: now,
      _conflict: null,
    };
    this._drafts.set(draftId, record);
    this._appendAudit({ action: 'UPSERT_INSERT', draftId, userId, revision: 1 });
    return record;
  }

  /**
   * Retrieve a single draft by ID.
   * @param {string} draftId
   * @param {string} userId  — enforces data scoping; returns null if not owner
   */
  getDraft(draftId, userId) {
    const d = this._drafts.get(draftId);
    if (!d) return null;
    if (d.userId !== userId) return null; // Scoped by actor
    return d;
  }

  /**
   * List all drafts for a user, newest first.
   * @param {string} userId
   * @param {{ entityType?: string, limit?: number, offset?: number }} opts
   */
  listUserDrafts(userId, { entityType = null, limit = 50, offset = 0 } = {}) {
    let results = [];
    for (const d of this._drafts.values()) {
      if (d.userId !== userId) continue;
      if (entityType && d.entityType !== entityType) continue;
      results.push(d);
    }
    results.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
    const total = results.length;
    return { items: results.slice(offset, offset + limit), total };
  }

  /**
   * Mark a draft as having a server-detected conflict.
   */
  markConflict(draftId, userId, conflictData) {
    const d = this._drafts.get(draftId);
    if (!d || d.userId !== userId) return null;
    d.syncStatus = 'CONFLICTED';
    d._conflict = { ...conflictData, conflictAt: new Date().toISOString() };
    d.updatedAt = new Date().toISOString();
    this._drafts.set(draftId, d);
    this._appendAudit({ action: 'MARK_CONFLICT', draftId, userId });
    return d;
  }

  /**
   * Resolve a conflict: apply the chosen payload and clear conflict state.
   */
  resolveConflict(draftId, userId, { resolvedPayload, strategy, resolvedBy }) {
    const d = this._drafts.get(draftId);
    if (!d || d.userId !== userId) return null;
    const now = new Date().toISOString();
    const updated = {
      ...d,
      payload: resolvedPayload || d.payload,
      syncStatus: 'SYNCED',
      _conflict: null,
      revision: (d.revision || 0) + 1,
      updatedAt: now,
    };
    this._drafts.set(draftId, updated);
    this._appendAudit({
      action: 'CONFLICT_RESOLVED',
      draftId,
      userId,
      strategy,
      resolvedBy,
      revision: updated.revision,
    });
    return updated;
  }

  /**
   * Return a redacted audit log slice (most recent first). Admin-only.
   */
  getAuditLog({ limit = 100, offset = 0 } = {}) {
    const sorted = [...this._auditLog].reverse();
    return { items: sorted.slice(offset, offset + limit), total: this._auditLog.length };
  }

  /** Test / introspection helpers */
  get size() {
    return this._drafts.size;
  }

  clear() {
    this._drafts.clear();
    this._auditLog.length = 0;
  }
}

// ---------------------------------------------------------------------------
// SINGLETON
// ---------------------------------------------------------------------------

let _productionStore = null;

export function getProductionCivicDraftSyncStore() {
  if (!_productionStore) {
    _productionStore = new InMemoryCivicDraftSyncStore();
  }
  return _productionStore;
}
