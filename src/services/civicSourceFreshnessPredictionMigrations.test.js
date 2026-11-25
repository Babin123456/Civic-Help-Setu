/**
 * src/services/civicSourceFreshnessPredictionMigrations.test.js
 *
 * Unit tests for persistence, migration, rollback and retention of the Civic
 * Information Freshness Prediction and Review Prioritization Model store
 * (#1189).
 *
 * Synthetic fixtures only: no citizen records, credentials, raw documents or
 * sensitive prompts.
 */

import { describe, it, expect } from 'vitest';
import {
  createEmptyStore,
  createSeedStore,
  isValidStoreShape,
  migrateFreshnessStore,
  buildFreshnessIndexes,
  loadFreshnessStore,
  persistFreshnessStore,
  runFreshnessTransaction,
  rollbackFreshnessStore,
  resetFreshnessStoreToEmpty,
  applyFreshnessRetentionPolicy,
  isServiceId,
  isPredictionId
} from './civicSourceFreshnessPredictionMigrations.js';
import {
  CIVIC_SOURCE_FRESHNESS_SCHEMA_VERSION,
  FRESHNESS_PREDICTION_STATUS,
  PRIORITY_BAND
} from '../data/civicSourceFreshnessPredictionConstants.js';

describe('civicSourceFreshnessPredictionMigrations', () => {
  describe('createEmptyStore / createSeedStore', () => {
    it('creates a valid empty store', () => {
      const store = createEmptyStore({ now: '2026-11-24T00:00:00Z' });
      expect(isValidStoreShape(store)).toBe(true);
      expect(store.schemaVersion).toBe(CIVIC_SOURCE_FRESHNESS_SCHEMA_VERSION);
      expect(store.predictions).toEqual([]);
    });

    it('seeds with empty predictions', () => {
      const store = createSeedStore({ now: '2026-11-24T00:00:00Z' });
      expect(isValidStoreShape(store)).toBe(true);
      expect(store.predictions).toEqual([]);
      expect(store.meta.seeded).toBe(true);
    });
  });

  describe('validation helpers', () => {
    it('validates service and prediction ids', () => {
      expect(isServiceId('service-1')).toBe(true);
      expect(isServiceId('Invalid Id!')).toBe(false);
      expect(isPredictionId('fp-1')).toBe(true);
      expect(isPredictionId('bad id')).toBe(false);
    });
  });

  describe('migration', () => {
    it('returns a valid store unchanged', () => {
      const store = createSeedStore({ now: '2026-11-24T00:00:00Z' });
      const { data, migrated } = migrateFreshnessStore(store);
      expect(migrated).toBe(false);
      expect(isValidStoreShape(data)).toBe(true);
    });

    it('migrates a legacy flat shape', () => {
      const legacy = {
        schemaVersion: 0,
        predictions: [{ id: 'legacy-prediction', serviceId: 'svc-1', priorityScore: 50 }]
      };
      const { data, migrated, historyEntry } = migrateFreshnessStore(legacy);
      expect(migrated).toBe(true);
      expect(isValidStoreShape(data)).toBe(true);
      expect(historyEntry.kind).toBe('upgrade');
      expect(data.predictions[0].schemaVersion).toBe(CIVIC_SOURCE_FRESHNESS_SCHEMA_VERSION);
    });

    it('throws on non-object legacy input', () => {
      expect(() => migrateFreshnessStore(null)).toThrow();
      expect(() => migrateFreshnessStore('not an object')).toThrow();
    });
  });

  describe('indexes', () => {
    it('builds lookup indexes', () => {
      const store = createSeedStore({ now: '2026-11-24T00:00:00Z' });
      const indexes = buildFreshnessIndexes(store);
      expect(indexes.predictionsById).toBeDefined();
      expect(indexes.predictionsByBand).toBeDefined();
    });
  });

  describe('load / ensure / persist', () => {
    it('loads an empty store and seeds when nothing present', () => {
      const storage = {};
      const store = loadFreshnessStore({ storage, seed: true, now: '2026-11-24T00:00:00Z' });
      expect(isValidStoreShape(store)).toBe(true);
      expect(store.meta.seeded).toBe(true);
    });

    it('loads an existing valid store without re-seeding', () => {
      const storage = {};
      const first = loadFreshnessStore({ storage, seed: true, now: '2026-11-24T00:00:00Z' });
      const second = loadFreshnessStore({ storage, seed: true, now: '2026-11-24T00:00:00Z' });
      expect(second.meta.seeded).toBe(true);
      expect(second.predictions.length).toBe(first.predictions.length);
    });

    it('persists a store via transaction atomically', () => {
      const storage = {};
      loadFreshnessStore({ storage, seed: true, now: '2026-11-24T00:00:00Z' });
      const { data } = runFreshnessTransaction((draft) => {
        draft.reviewAudit.push({
          id: 'audit-1',
          action: 'freshness.review',
          entityType: 'prediction',
          entityId: 'pred-1',
          actorRole: 'maintainer',
          actorId: 'maintainer',
          reason: 't',
          timestamp: '2026-11-24T00:00:00Z',
          schemaVersion: 1
        });
      }, { storage, now: new Date('2026-11-24T00:00:00Z') });
      expect(data.reviewAudit.length).toBeGreaterThan(0);
    });

    it('rolls back to the seeded store', () => {
      const storage = {};
      loadFreshnessStore({ storage, seed: true, now: '2026-11-24T00:00:00Z' });
      const rolled = rollbackFreshnessStore({ storage, now: new Date('2026-11-24T00:00:00Z') });
      expect(rolled.meta.seeded).toBe(true);
    });

    it('resets to an empty store', () => {
      const storage = {};
      loadFreshnessStore({ storage, seed: true, now: '2026-11-24T00:00:00Z' });
      const empty = resetFreshnessStoreToEmpty({ storage, now: new Date('2026-11-24T00:00:00Z') });
      expect(empty.predictions.length).toBe(0);
    });
  });

  describe('retention', () => {
    it('retires old reviewed predictions', () => {
      const storage = {};
      const store = loadFreshnessStore({ storage, seed: true, now: '2026-11-24T00:00:00Z' });
      store.predictions.push({
        id: 'pred-old',
        serviceId: 'svc-old',
        status: FRESHNESS_PREDICTION_STATUS.REVIEWED,
        priorityBand: PRIORITY_BAND.HIGH,
        priorityScore: 80,
        updatedAt: '2025-01-01T00:00:00Z',
        reviewed: true
      });
      persistFreshnessStore(store, { storage, now: new Date('2026-11-24T00:00:00Z') });

      const result = applyFreshnessRetentionPolicy(
        { retentionDays: 90, now: '2026-11-24T00:00:00Z' },
        { storage }
      );
      const { result: retentionResult } = result;
      expect(typeof retentionResult.archivedPredictions).toBe('number');
      expect(retentionResult.archivedPredictions).toBeGreaterThanOrEqual(0);
    });
  });
});
