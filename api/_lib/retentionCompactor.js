/**
 * api/_lib/retentionCompactor.js
 *
 * Deterministic Data Retention, Archival & Tombstone Compaction Engine (#1350).
 *
 * Features:
 *  - Declarative per-collection retention policies (`ttlMs`, `archiveBeforeDelete`,
 *    `batchSize`, `legalHoldField`).
 *  - `dry-run` vs `enforce` execution modes.
 *  - Legal-hold / active-dispute exemption so contested records are never purged.
 *  - Privacy-safe cryptographic tombstones (SHA-256 commitment without raw PII).
 *  - Bounded batches, idempotent re-runs, and partial-batch failure resilience.
 */

import { createHash } from 'node:crypto';

export const DEFAULT_RETENTION_POLICIES = Object.freeze({
  privacy_export_artifacts: {
    ttlMs: 7 * 24 * 60 * 60 * 1000,
    archiveBeforeDelete: false,
    batchSize: 100,
  },
  verification_tokens: {
    ttlMs: 24 * 60 * 60 * 1000,
    archiveBeforeDelete: false,
    batchSize: 250,
  },
  civic_submissions_archive: {
    ttlMs: 365 * 24 * 60 * 60 * 1000,
    archiveBeforeDelete: true,
    batchSize: 100,
  },
});

/**
 * Computes a privacy-safe SHA-256 tombstone digest for an expired record.
 * Never embeds raw citizen PII in the tombstone.
 */
export function computeTombstoneHash({ collection, id, createdAt, updatedAt, archivedAt }) {
  const canonical = JSON.stringify({
    collection: String(collection),
    id: String(id),
    createdAt: createdAt ?? null,
    updatedAt: updatedAt ?? null,
    archivedAt: archivedAt ?? null,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

export function isRecordExpired(record, ttlMs, at) {
  const ts = record.expiresAt ?? ((record.updatedAt ?? record.createdAt ?? 0) + ttlMs);
  return Number.isFinite(ts) && ts <= at;
}

export function isUnderLegalHold(record) {
  return Boolean(record?.legalHold === true || record?.activeDispute === true);
}

/**
 * Creates an in-memory store fixture implementing the compaction store contract
 * for tests and local verification.
 */
export function createInMemoryRetentionStore(initialCollections = {}) {
  const data = new Map();
  const tombstones = new Map();
  const archives = [];

  for (const [col, records] of Object.entries(initialCollections)) {
    data.set(col, new Map(records.map((r) => [r.id, { ...r }])));
  }

  return {
    async listCandidates(collection, { limit = 100 } = {}) {
      const colMap = data.get(collection) || new Map();
      return [...colMap.values()].slice(0, limit);
    },
    async hasTombstone(collection, id) {
      return tombstones.has(`${collection}:${id}`);
    },
    async archiveRecord(collection, record) {
      archives.push({ collection, id: record.id, archivedAt: Date.now() });
    },
    async writeTombstone(collection, tombstone) {
      tombstones.set(`${collection}:${tombstone.id}`, tombstone);
    },
    async deleteRecord(collection, id) {
      const colMap = data.get(collection);
      if (colMap) colMap.delete(id);
    },
    getCollection(collection) {
      return [...(data.get(collection)?.values() || [])];
    },
    getTombstones() {
      return [...tombstones.values()];
    },
    getArchives() {
      return [...archives];
    },
  };
}

/**
 * Creates a deterministic retention & tombstone compaction engine.
 */
export function createRetentionCompactor({
  store,
  policies = DEFAULT_RETENTION_POLICIES,
  now = Date.now,
  onAudit = () => {},
} = {}) {
  if (!store) {
    throw new TypeError('createRetentionCompactor requires a store');
  }

  async function runCollection(collection, { mode = 'dry-run' } = {}) {
    const policy = policies[collection];
    if (!policy) {
      throw new Error(`No retention policy configured for collection: ${collection}`);
    }

    const effectiveMode = mode === 'enforce' ? 'enforce' : 'dry-run';
    const at = now();
    const candidates = await store.listCandidates(collection, { limit: policy.batchSize || 100 });

    const summary = {
      collection,
      mode: effectiveMode,
      scanned: candidates.length,
      expiredCandidates: 0,
      archived: 0,
      compacted: 0,
      skippedLegalHold: 0,
      skippedAlreadyTombstoned: 0,
      errors: [],
      runAt: at,
    };

    for (const record of candidates) {
      if (!isRecordExpired(record, policy.ttlMs, at)) {
        continue;
      }
      if (isUnderLegalHold(record)) {
        summary.skippedLegalHold += 1;
        continue;
      }
      if (await store.hasTombstone(collection, record.id)) {
        summary.skippedAlreadyTombstoned += 1;
        continue;
      }

      summary.expiredCandidates += 1;
      if (effectiveMode === 'dry-run') {
        continue;
      }

      try {
        let archivedAt = null;
        if (policy.archiveBeforeDelete) {
          await store.archiveRecord(collection, record);
          archivedAt = at;
          summary.archived += 1;
        }
        const tombstone = {
          id: record.id,
          collection,
          digest: computeTombstoneHash({
            collection,
            id: record.id,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            archivedAt,
          }),
          compactedAt: at,
        };
        await store.writeTombstone(collection, tombstone);
        await store.deleteRecord(collection, record.id);
        summary.compacted += 1;
      } catch (err) {
        summary.errors.push({ id: record.id, error: err.message });
      }
    }

    onAudit({ event: 'retention_compaction_run', ...summary });
    return summary;
  }

  async function runAll({ mode = 'dry-run' } = {}) {
    const results = {};
    for (const collection of Object.keys(policies)) {
      results[collection] = await runCollection(collection, { mode });
    }
    return results;
  }

  return { runCollection, runAll };
}
