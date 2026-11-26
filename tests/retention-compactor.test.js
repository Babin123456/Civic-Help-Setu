import { describe, it, expect, vi } from 'vitest';
import {
  createInMemoryRetentionStore,
  createRetentionCompactor,
  computeTombstoneHash,
} from '../api/_lib/retentionCompactor.js';

describe('Deterministic Data Retention & Tombstone Compaction (#1350)', () => {
  it('supports dry-run reporting without mutating records and compacts on enforce', async () => {
    const nowMs = 1_000_000_000;
    const store = createInMemoryRetentionStore({
      verification_tokens: [
        { id: 'tok-expired', createdAt: nowMs - 200_000_000, email: 'pii@example.com' },
        { id: 'tok-fresh', createdAt: nowMs - 1_000 },
      ],
    });

    const compactor = createRetentionCompactor({
      store,
      policies: {
        verification_tokens: { ttlMs: 86_400_000, archiveBeforeDelete: false, batchSize: 50 },
      },
      now: () => nowMs,
    });

    const dryRun = await compactor.runCollection('verification_tokens', { mode: 'dry-run' });
    expect(dryRun.expiredCandidates).toBe(1);
    expect(dryRun.compacted).toBe(0);
    expect(store.getCollection('verification_tokens')).toHaveLength(2);

    const enforced = await compactor.runCollection('verification_tokens', { mode: 'enforce' });
    expect(enforced.compacted).toBe(1);
    expect(store.getCollection('verification_tokens').map((r) => r.id)).toEqual(['tok-fresh']);

    const tombstones = store.getTombstones();
    expect(tombstones).toHaveLength(1);
    expect(tombstones[0].digest).toBe(
      computeTombstoneHash({
        collection: 'verification_tokens',
        id: 'tok-expired',
        createdAt: nowMs - 200_000_000,
        updatedAt: undefined,
        archivedAt: null,
      }),
    );
    expect(JSON.stringify(tombstones[0])).not.toContain('pii@example.com');
  });

  it('protects legal-hold and active-dispute records and archives before deletion when configured', async () => {
    const nowMs = 2_000_000_000;
    const store = createInMemoryRetentionStore({
      civic_submissions_archive: [
        { id: 'sub-old', createdAt: nowMs - 500_000_000 },
        { id: 'sub-hold', createdAt: nowMs - 500_000_000, legalHold: true },
        { id: 'sub-dispute', createdAt: nowMs - 500_000_000, activeDispute: true },
      ],
    });

    const compactor = createRetentionCompactor({
      store,
      policies: {
        civic_submissions_archive: { ttlMs: 100_000, archiveBeforeDelete: true, batchSize: 10 },
      },
      now: () => nowMs,
    });

    const res = await compactor.runCollection('civic_submissions_archive', { mode: 'enforce' });
    expect(res.archived).toBe(1);
    expect(res.compacted).toBe(1);
    expect(res.skippedLegalHold).toBe(2);
    expect(store.getCollection('civic_submissions_archive').map((r) => r.id)).toEqual(['sub-hold', 'sub-dispute']);
    expect(store.getArchives()).toHaveLength(1);
  });

  it('handles partial-batch archive failures without aborting remaining records', async () => {
    const nowMs = 3_000_000_000;
    const baseStore = createInMemoryRetentionStore({
      civic_submissions_archive: [
        { id: 'rec-fail', createdAt: nowMs - 500_000 },
        { id: 'rec-ok', createdAt: nowMs - 500_000 },
      ],
    });
    const originalArchive = baseStore.archiveRecord.bind(baseStore);
    baseStore.archiveRecord = vi.fn(async (col, rec) => {
      if (rec.id === 'rec-fail') throw new Error('cold storage unavailable');
      return originalArchive(col, rec);
    });

    const compactor = createRetentionCompactor({
      store: baseStore,
      policies: {
        civic_submissions_archive: { ttlMs: 1000, archiveBeforeDelete: true, batchSize: 10 },
      },
      now: () => nowMs,
    });

    const res = await compactor.runCollection('civic_submissions_archive', { mode: 'enforce' });
    expect(res.errors).toHaveLength(1);
    expect(res.errors[0].id).toBe('rec-fail');
    expect(res.compacted).toBe(1);
    expect(baseStore.getCollection('civic_submissions_archive').map((r) => r.id)).toEqual(['rec-fail']);
  });
});
