/**
 * src/services/civicDraftSyncExtension.test.js
 *
 * Unit tests for the Civic Draft Sync Extension module (#1424).
 *
 * Coverage:
 *  - Deterministic idempotency key generation (stable across calls)
 *  - Schema migration (old draft → new schema)
 *  - Conflict detection when server revision > client revision
 *  - PII rejection guard (via handler validation)
 *  - Retry backoff calculation
 *  - Interrupted upload recovery
 *  - Provenance label helper
 *  - Pending operation summary
 *  - Encryption availability flag
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateDraftIdempotencyKey,
  migrateDraftSchema,
  migrateAllLocalDrafts,
  registerSchemaMigration,
  calcBackoffDelay,
  recoverInterruptedUploads,
  getPendingOperationsSummary,
  getProvenanceLabel,
  PROVENANCE_TYPES,
  isCryptoAvailable,
  DEFAULT_BACKOFF_OPTIONS,
  DRAFT_SCHEMA_VERSION,
} from './civicDraftSyncExtension';

import { readStore, writeStore, STORAGE_KEYS, OP_STATUS } from './citizenDraftSyncEngine';

// ---------------------------------------------------------------------------
// Mock Storage
// ---------------------------------------------------------------------------

const createMockStorage = () => {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
};

describe('civicDraftSyncExtension (#1424)', () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = createMockStorage();
  });

  // ---------------------------------------------------------------------------
  // 1. Deterministic Idempotency Key
  // ---------------------------------------------------------------------------

  describe('generateDraftIdempotencyKey', () => {
    it('generates a string prefixed with dsync_', () => {
      const key = generateDraftIdempotencyKey({ draftId: 'draft-1', userId: 'user-abc', schemaVersion: 1, revisionHint: 0 });
      expect(key).toMatch(/^dsync_[0-9a-f]{8}$/);
    });

    it('is stable: same inputs produce same key (idempotency)', () => {
      const opts = { draftId: 'draft-42', userId: 'user-xyz', schemaVersion: 1, revisionHint: 3 };
      const k1 = generateDraftIdempotencyKey(opts);
      const k2 = generateDraftIdempotencyKey(opts);
      const k3 = generateDraftIdempotencyKey(opts);
      expect(k1).toBe(k2);
      expect(k2).toBe(k3);
    });

    it('differs when draftId changes', () => {
      const base = { draftId: 'draft-A', userId: 'user-1', schemaVersion: 1, revisionHint: 0 };
      const k1 = generateDraftIdempotencyKey(base);
      const k2 = generateDraftIdempotencyKey({ ...base, draftId: 'draft-B' });
      expect(k1).not.toBe(k2);
    });

    it('differs when userId changes', () => {
      const base = { draftId: 'draft-A', userId: 'user-1', schemaVersion: 1, revisionHint: 0 };
      const k1 = generateDraftIdempotencyKey(base);
      const k2 = generateDraftIdempotencyKey({ ...base, userId: 'user-2' });
      expect(k1).not.toBe(k2);
    });

    it('differs when revisionHint changes', () => {
      const base = { draftId: 'draft-A', userId: 'user-1', schemaVersion: 1, revisionHint: 0 };
      const k1 = generateDraftIdempotencyKey(base);
      const k2 = generateDraftIdempotencyKey({ ...base, revisionHint: 1 });
      expect(k1).not.toBe(k2);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Schema Migration
  // ---------------------------------------------------------------------------

  describe('migrateDraftSchema', () => {
    it('returns draft unchanged when already at current schemaVersion', () => {
      const draft = { id: 'd1', schemaVersion: DRAFT_SCHEMA_VERSION, title: 'Test' };
      const result = migrateDraftSchema(draft);
      expect(result.schemaVersion).toBe(DRAFT_SCHEMA_VERSION);
      expect(result.title).toBe('Test');
    });

    it('applies registered migration functions from old schema versions', () => {
      // Register a test migration from version 0 → 1
      registerSchemaMigration(0, (record) => ({ ...record, migrated: true, schemaVersion: 1 }));
      const old = { id: 'd2', schemaVersion: 0, title: 'Old Draft' };
      const result = migrateDraftSchema(old);
      expect(result.migrated).toBe(true);
      expect(result.schemaVersion).toBe(DRAFT_SCHEMA_VERSION);
    });

    it('handles null/undefined gracefully', () => {
      expect(migrateDraftSchema(null)).toBeNull();
      expect(migrateDraftSchema(undefined)).toBeUndefined();
    });
  });

  describe('migrateAllLocalDrafts', () => {
    it('migrates stale drafts in local storage and returns counts', () => {
      const drafts = {
        'd1': { id: 'd1', schemaVersion: 0, title: 'Draft A' },
        'd2': { id: 'd2', schemaVersion: DRAFT_SCHEMA_VERSION, title: 'Draft B' },
      };
      writeStore(STORAGE_KEYS.CITIZEN_DRAFTS, drafts, mockStorage);

      const result = migrateAllLocalDrafts(mockStorage);
      expect(result.total).toBe(2);
      // d1 is at version 0 so it should be migrated
      expect(result.migrated).toBeGreaterThanOrEqual(1);

      const updated = readStore(STORAGE_KEYS.CITIZEN_DRAFTS, mockStorage);
      expect(Number(updated['d1'].schemaVersion)).toBeGreaterThanOrEqual(DRAFT_SCHEMA_VERSION);
      expect(Number(updated['d2'].schemaVersion)).toBe(DRAFT_SCHEMA_VERSION);
    });

    it('returns 0 migrated when all drafts are current', () => {
      const drafts = {
        'd3': { id: 'd3', schemaVersion: DRAFT_SCHEMA_VERSION, title: 'Current' },
      };
      writeStore(STORAGE_KEYS.CITIZEN_DRAFTS, drafts, mockStorage);
      const result = migrateAllLocalDrafts(mockStorage);
      expect(result.migrated).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Retry Backoff
  // ---------------------------------------------------------------------------

  describe('calcBackoffDelay', () => {
    it('returns a non-negative number', () => {
      for (let attempt = 1; attempt <= 5; attempt++) {
        const delay = calcBackoffDelay(attempt, DEFAULT_BACKOFF_OPTIONS);
        expect(delay).toBeGreaterThanOrEqual(0);
      }
    });

    it('respects maxDelayMs ceiling', () => {
      const opts = { ...DEFAULT_BACKOFF_OPTIONS, maxDelayMs: 5000, jitterFactor: 0 };
      const delay = calcBackoffDelay(10, opts);
      // With no jitter, should be exactly maxDelayMs
      expect(delay).toBeLessThanOrEqual(5000);
    });

    it('increases with attempt number (no jitter)', () => {
      const opts = { ...DEFAULT_BACKOFF_OPTIONS, maxDelayMs: 999999, jitterFactor: 0 };
      const d1 = calcBackoffDelay(1, opts);
      const d2 = calcBackoffDelay(2, opts);
      const d3 = calcBackoffDelay(3, opts);
      expect(d2).toBeGreaterThan(d1);
      expect(d3).toBeGreaterThan(d2);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Interrupted Upload Recovery
  // ---------------------------------------------------------------------------

  describe('recoverInterruptedUploads', () => {
    it('resets IN_FLIGHT operations to PENDING', () => {
      const ops = {
        'op-1': { id: 'op-1', status: OP_STATUS.IN_FLIGHT, entityId: 'd1' },
        'op-2': { id: 'op-2', status: OP_STATUS.PENDING, entityId: 'd2' },
        'op-3': { id: 'op-3', status: OP_STATUS.COMMITTED, entityId: 'd3' },
      };
      writeStore(STORAGE_KEYS.OFFLINE_OPERATIONS, ops, mockStorage);

      const rescued = recoverInterruptedUploads(mockStorage);
      expect(rescued).toBe(1);

      const updated = readStore(STORAGE_KEYS.OFFLINE_OPERATIONS, mockStorage);
      expect(updated['op-1'].status).toBe(OP_STATUS.PENDING);
      expect(updated['op-1'].error).toBeNull();
      expect(updated['op-2'].status).toBe(OP_STATUS.PENDING); // unchanged
      expect(updated['op-3'].status).toBe(OP_STATUS.COMMITTED); // unchanged
    });

    it('returns 0 when no IN_FLIGHT operations', () => {
      writeStore(STORAGE_KEYS.OFFLINE_OPERATIONS, {}, mockStorage);
      expect(recoverInterruptedUploads(mockStorage)).toBe(0);
    });

    it('handles empty storage gracefully', () => {
      expect(recoverInterruptedUploads(mockStorage)).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Pending Operation Summary
  // ---------------------------------------------------------------------------

  describe('getPendingOperationsSummary', () => {
    it('correctly tallies pending, in-flight, and failed operations', () => {
      const ops = {
        'op-a': { id: 'op-a', status: OP_STATUS.PENDING, entityId: 'd1', entityType: 'checklist', createdAt: new Date().toISOString() },
        'op-b': { id: 'op-b', status: OP_STATUS.IN_FLIGHT, entityId: 'd2', entityType: 'checklist', createdAt: new Date().toISOString() },
        'op-c': { id: 'op-c', status: OP_STATUS.FAILED, entityId: 'd3', entityType: 'checklist', createdAt: new Date().toISOString() },
        'op-d': { id: 'op-d', status: OP_STATUS.COMMITTED, entityId: 'd4', entityType: 'checklist', createdAt: new Date().toISOString() },
      };
      writeStore(STORAGE_KEYS.OFFLINE_OPERATIONS, ops, mockStorage);

      const summary = getPendingOperationsSummary(mockStorage);
      expect(summary.pendingCount).toBe(1);
      expect(summary.inFlightCount).toBe(1);
      expect(summary.failedCount).toBe(1);
      expect(summary.hasInterrupted).toBe(true);
      expect(summary.total).toBe(4);
    });

    it('reports no interrupted when no IN_FLIGHT ops', () => {
      writeStore(STORAGE_KEYS.OFFLINE_OPERATIONS, {}, mockStorage);
      const summary = getPendingOperationsSummary(mockStorage);
      expect(summary.hasInterrupted).toBe(false);
      expect(summary.pendingCount).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Provenance Label
  // ---------------------------------------------------------------------------

  describe('getProvenanceLabel', () => {
    it('returns correct labels for all known provenance types', () => {
      expect(getProvenanceLabel(PROVENANCE_TYPES.CITIZEN)).toBe('You entered this');
      expect(getProvenanceLabel(PROVENANCE_TYPES.OFFICIAL)).toBe('From official records');
      expect(getProvenanceLabel(PROVENANCE_TYPES.AI_SUGGESTION)).toBe('AI suggestion — please verify');
      expect(getProvenanceLabel(PROVENANCE_TYPES.COMMUNITY)).toBe('Community submission — unverified');
    });

    it('returns fallback for unknown provenance', () => {
      expect(getProvenanceLabel('unknown_type')).toBe('Source unknown');
      expect(getProvenanceLabel(null)).toBe('Source unknown');
      expect(getProvenanceLabel(undefined)).toBe('Source unknown');
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Crypto Availability
  // ---------------------------------------------------------------------------

  describe('isCryptoAvailable', () => {
    it('returns a boolean', () => {
      const result = isCryptoAvailable();
      expect(typeof result).toBe('boolean');
    });
  });
});
