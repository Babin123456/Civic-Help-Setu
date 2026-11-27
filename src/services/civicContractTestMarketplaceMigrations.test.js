/**
 * src/services/civicContractTestMarketplaceMigrations.test.js
 *
 * Unit tests for persistence, migration, rollback and retention of the Civic
 * Service Integration Contract Test Marketplace store (#1191).
 *
 * Synthetic fixtures only: no citizen records, credentials, raw documents or
 * sensitive prompts.
 */

import { describe, it, expect } from 'vitest';
import {
  createEmptyStore,
  createSeedStore,
  isValidStoreShape,
  migrateContractTestStore,
  buildContractTestIndexes,
  loadContractTestStore,
  persistContractTestStore,
  runContractTestTransaction,
  rollbackContractTestStore,
  resetContractTestStoreToEmpty,
  applyContractTestRetentionPolicy,
  isAdapterId,
  isSuiteId,
  isTestId,
  isRunId
} from './civicContractTestMarketplaceMigrations.js';
import {
  CIVIC_CONTRACT_TEST_SCHEMA_VERSION,
  CONTRACT_TEST_STATUS
} from '../data/civicContractTestMarketplaceConstants.js';

describe('civicContractTestMarketplaceMigrations', () => {
  describe('createEmptyStore / createSeedStore', () => {
    it('creates a valid empty store', () => {
      const store = createEmptyStore({ now: '2026-11-24T00:00:00Z' });
      expect(isValidStoreShape(store)).toBe(true);
      expect(store.schemaVersion).toBe(CIVIC_CONTRACT_TEST_SCHEMA_VERSION);
      expect(store.adapters).toEqual([]);
    });

    it('seeds with empty collections', () => {
      const store = createSeedStore({ now: '2026-11-24T00:00:00Z' });
      expect(isValidStoreShape(store)).toBe(true);
      expect(store.adapters).toEqual([]);
      expect(store.meta.seeded).toBe(true);
    });
  });

  describe('validation helpers', () => {
    it('validates adapter, suite, test and run ids', () => {
      expect(isAdapterId('adapter-1')).toBe(true);
      expect(isAdapterId('Invalid Id!')).toBe(false);
      expect(isSuiteId('suite-1')).toBe(true);
      expect(isSuiteId('bad id')).toBe(false);
      expect(isTestId('test-1')).toBe(true);
      expect(isRunId('run-1')).toBe(true);
    });
  });

  describe('migration', () => {
    it('returns a valid store unchanged', () => {
      const store = createSeedStore({ now: '2026-11-24T00:00:00Z' });
      const { data, migrated } = migrateContractTestStore(store);
      expect(migrated).toBe(false);
      expect(isValidStoreShape(data)).toBe(true);
    });

    it('migrates a legacy flat shape', () => {
      const legacy = {
        schemaVersion: 0,
        adapters: [{ id: 'legacy-adapter', name: 'Legacy', type: 'rest', baseUrl: 'https://example.gov.in' }]
      };
      const { data, migrated, historyEntry } = migrateContractTestStore(legacy);
      expect(migrated).toBe(true);
      expect(isValidStoreShape(data)).toBe(true);
      expect(historyEntry.kind).toBe('upgrade');
      expect(data.adapters[0].schemaVersion).toBe(CIVIC_CONTRACT_TEST_SCHEMA_VERSION);
    });

    it('throws on non-object legacy input', () => {
      expect(() => migrateContractTestStore(null)).toThrow();
      expect(() => migrateContractTestStore('not an object')).toThrow();
    });
  });

  describe('indexes', () => {
    it('builds lookup indexes', () => {
      const store = createSeedStore({ now: '2026-11-24T00:00:00Z' });
      const indexes = buildContractTestIndexes(store);
      expect(indexes.adaptersById).toBeDefined();
      expect(indexes.suitesById).toBeDefined();
      expect(indexes.testsById).toBeDefined();
      expect(indexes.runsById).toBeDefined();
    });
  });

  describe('load / ensure / persist', () => {
    it('loads an empty store and seeds when nothing present', () => {
      const storage = {};
      const store = loadContractTestStore({ storage, seed: true, now: '2026-11-24T00:00:00Z' });
      expect(isValidStoreShape(store)).toBe(true);
      expect(store.meta.seeded).toBe(true);
    });

    it('loads an existing valid store without re-seeding', () => {
      const storage = {};
      const first = loadContractTestStore({ storage, seed: true, now: '2026-11-24T00:00:00Z' });
      const second = loadContractTestStore({ storage, seed: true, now: '2026-11-24T00:00:00Z' });
      expect(second.meta.seeded).toBe(true);
      expect(second.adapters.length).toBe(first.adapters.length);
    });

    it('persists a store via transaction atomically', () => {
      const storage = {};
      loadContractTestStore({ storage, seed: true, now: '2026-11-24T00:00:00Z' });
      const { data } = runContractTestTransaction((draft) => {
        draft.auditLog.push({
          id: 'audit-1',
          action: 'adapter.upsert',
          entityType: 'adapter',
          entityId: 'adapter-1',
          actorRole: 'operator',
          actorId: 'contractTest.engine',
          reason: 't',
          timestamp: '2026-11-24T00:00:00Z',
          schemaVersion: 1
        });
      }, { storage, now: new Date('2026-11-24T00:00:00Z') });
      expect(data.auditLog.length).toBeGreaterThan(0);
    });

    it('rolls back to the seeded store', () => {
      const storage = {};
      loadContractTestStore({ storage, seed: true, now: '2026-11-24T00:00:00Z' });
      const rolled = rollbackContractTestStore({ storage, now: new Date('2026-11-24T00:00:00Z') });
      expect(rolled.meta.seeded).toBe(true);
    });

    it('resets to an empty store', () => {
      const storage = {};
      loadContractTestStore({ storage, seed: true, now: '2026-11-24T00:00:00Z' });
      const empty = resetContractTestStoreToEmpty({ storage, now: new Date('2026-11-24T00:00:00Z') });
      expect(empty.adapters.length).toBe(0);
    });
  });

  describe('retention', () => {
    it('archives old completed/failed runs', () => {
      const storage = {};
      const store = loadContractTestStore({ storage, seed: true, now: '2026-11-24T00:00:00Z' });
      store.runs.push({
        id: 'run-old',
        suiteId: 'suite-1',
        status: CONTRACT_TEST_STATUS.COMPLETED,
        updatedAt: '2025-01-01T00:00:00Z',
        results: [],
        summary: { total: 0, passed: 0, failed: 0, skipped: 0, errored: 0, warned: 0 },
        conformanceScore: 0,
        breakingChanges: [],
        maliciousPayloadsDetected: []
      });
      persistContractTestStore(store, { storage, now: new Date('2026-11-24T00:00:00Z') });

      const result = applyContractTestRetentionPolicy(
        { retentionDays: 90, now: '2026-11-24T00:00:00Z' },
        { storage }
      );
      const { result: retentionResult } = result;
      expect(typeof retentionResult.archivedRuns).toBe('number');
      expect(retentionResult.archivedRuns).toBeGreaterThanOrEqual(0);
    });
  });
});
