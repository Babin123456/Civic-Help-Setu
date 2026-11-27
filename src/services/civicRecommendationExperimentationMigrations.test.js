/**
 * src/services/civicRecommendationExperimentationMigrations.test.js
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createEmptyStore,
  createSeedStore,
  validateStoreShape,
  migrateExperimentationStore,
  loadExperimentationStore,
  persistExperimentationStore,
  runExperimentationTransaction,
  rollbackExperimentationStore,
  resetExperimentationStoreToEmpty,
  applyExperimentationRetentionPolicy,
  isExperimentId,
  isVariantId
} from './civicRecommendationExperimentationMigrations.js';
import {
  CIVIC_EXPERIMENTATION_SCHEMA_VERSION,
  EXPERIMENT_STATUS
} from '../data/civicRecommendationExperimentationConstants.js';

describe('civicRecommendationExperimentationMigrations', () => {
  let mockStorage;
  const mockNow = '2026-11-25T10:00:00.000Z';

  beforeEach(() => {
    const mem = new Map();
    mockStorage = {
      getItem: (k) => mem.get(k) || null,
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: (k) => mem.delete(k),
      clear: () => mem.clear()
    };
  });

  it('creates a valid empty store with version 1', () => {
    const store = createEmptyStore({ now: mockNow });
    expect(store.schemaVersion).toBe(CIVIC_EXPERIMENTATION_SCHEMA_VERSION);
    expect(store.experiments).toEqual([]);
    expect(store.auditLog).toEqual([]);
    expect(validateStoreShape(store)).toBe(true);
  });

  it('creates a seed store with initial sample experiment', () => {
    const store = createSeedStore({ now: mockNow });
    expect(store.experiments.length).toBe(1);
    expect(store.experiments[0].status).toBe(EXPERIMENT_STATUS.ACTIVE);
    expect(store.auditLog.length).toBeGreaterThan(0);
    expect(validateStoreShape(store)).toBe(true);
  });

  it('migrates legacy shape without losing existing experiments', () => {
    const legacy = {
      schemaVersion: 0,
      experiments: [{ id: 'legacy-exp-1', name: 'Legacy' }],
      metricsLog: [],
      auditLog: []
    };
    const migrated = migrateExperimentationStore(legacy, { now: mockNow });
    expect(migrated.schemaVersion).toBe(CIVIC_EXPERIMENTATION_SCHEMA_VERSION);
    expect(migrated.experiments.length).toBe(1);
    expect(migrated.meta.migrationHistory.length).toBe(1);
    expect(migrated.meta.migrationHistory[0].from).toBe(0);
  });

  it('loads and persists store to custom storage provider', () => {
    const initial = loadExperimentationStore({ storage: mockStorage, now: mockNow });
    expect(initial.experiments.length).toBe(1);

    initial.experiments.push({ id: 'new-exp', name: 'New Exp', variants: [], guardrails: {} });
    persistExperimentationStore(initial, { storage: mockStorage, now: mockNow });

    const reloaded = loadExperimentationStore({ storage: mockStorage, now: mockNow });
    expect(reloaded.experiments.length).toBe(2);
  });

  it('handles atomic transactions and rolls back on error', () => {
    loadExperimentationStore({ storage: mockStorage, now: mockNow });

    expect(() => {
      runExperimentationTransaction((draft) => {
        draft.experiments.push({ id: 'will-fail' });
        throw new Error('Simulation crash');
      }, { storage: mockStorage, now: mockNow });
    }).toThrow('Simulation crash');

    const clean = loadExperimentationStore({ storage: mockStorage, now: mockNow });
    expect(clean.experiments.some((e) => e.id === 'will-fail')).toBe(false);
  });

  it('rolls back to seeded store and resets to empty', () => {
    rollbackExperimentationStore({ storage: mockStorage, now: mockNow });
    let store = loadExperimentationStore({ storage: mockStorage, now: mockNow });
    expect(store.experiments.length).toBe(1);

    resetExperimentationStoreToEmpty({ storage: mockStorage, now: mockNow });
    store = loadExperimentationStore({ storage: mockStorage, now: mockNow });
    expect(store.experiments.length).toBe(0);
  });

  it('prunes metrics and audit log beyond retention threshold', () => {
    const store = createEmptyStore({ now: mockNow });
    store.metricsLog = [
      { id: 'recent', timestamp: '2026-11-20T00:00:00Z' },
      { id: 'ancient', timestamp: '2025-01-01T00:00:00Z' }
    ];
    store.auditLog = Array.from({ length: 1050 }, (_, i) => ({ id: `audit-${i}`, timestamp: mockNow }));

    const pruned = applyExperimentationRetentionPolicy(store, { retentionDays: 90, now: mockNow });
    expect(pruned.metricsLog.length).toBe(1);
    expect(pruned.metricsLog[0].id).toBe('recent');
    expect(pruned.auditLog.length).toBe(1000);
  });

  it('validates experiment and variant slug identifiers', () => {
    expect(isExperimentId('exp-boost-1')).toBe(true);
    expect(isExperimentId('INVALID_UPPER')).toBe(false);
    expect(isVariantId('control')).toBe(true);
    expect(isVariantId('treatment-a')).toBe(true);
    expect(isVariantId('invalid space')).toBe(false);
  });
});
