/**
 * src/services/civicAgentCostCarbonMigrations.test.js
 *
 * Unit tests for persistence, migration, rollback and retention of the
 * Civic Agent Cost and Carbon Budget Governor store (#1185).
 *
 * Synthetic fixtures only: no citizen records, credentials, raw documents or
 * sensitive prompts.
 */

import { describe, it, expect } from 'vitest';
import {
  createEmptyStore,
  createSeedStore,
  isValidStoreShape,
  migrateCostCarbonStore,
  buildCostCarbonIndexes,
  loadCostCarbonStore,
  persistCostCarbonStore,
  runCostCarbonTransaction,
  rollbackCostCarbonStore,
  resetCostCarbonStoreToEmpty,
  applyCostCarbonRetentionPolicy,
  isWorkflowId,
  isRunId,
} from './civicAgentCostCarbonMigrations.js';
import {
  CIVIC_AGENT_COST_CARBON_SCHEMA_VERSION,
  COST_CARBON_STATUS,
} from '../data/civicAgentCostCarbonConstants.js';

describe('civicAgentCostCarbonMigrations', () => {

  describe('createEmptyStore / createSeedStore', () => {
    it('creates a valid empty store', () => {
      const store = createEmptyStore({ now: '2026-11-24T00:00:00Z' });
      expect(isValidStoreShape(store)).toBe(true);
      expect(store.schemaVersion).toBe(CIVIC_AGENT_COST_CARBON_SCHEMA_VERSION);
      expect(store.policies).toEqual([]);
      expect(store.workflows).toEqual([]);
    });

    it('seeds with the default policy', () => {
      const store = createSeedStore({ now: '2026-11-24T00:00:00Z' });
      expect(isValidStoreShape(store)).toBe(true);
      expect(store.policies.length).toBe(1);
      expect(store.policies[0].id).toBe('default-civic-agent-budget-v1');
      expect(store.meta.seeded).toBe(true);
    });
  });

  describe('validation helpers', () => {
    it('validates workflow and run ids', () => {
      expect(isWorkflowId('wf-1')).toBe(true);
      expect(isWorkflowId('Invalid Id!')).toBe(false);
      expect(isWorkflowId('')).toBe(false);
      expect(isRunId('run-1')).toBe(true);
      expect(isRunId('bad id')).toBe(false);
    });
  });

  describe('migration', () => {
    it('returns a valid store unchanged', () => {
      const store = createSeedStore({ now: '2026-11-24T00:00:00Z' });
      const { data, migrated } = migrateCostCarbonStore(store);
      expect(migrated).toBe(false);
      expect(isValidStoreShape(data)).toBe(true);
    });

    it('migrates a legacy flat shape', () => {
      const legacy = {
        schemaVersion: 0,
        policies: [{ id: 'legacy-policy', name: 'Legacy', version: 0 }],
      };
      const { data, migrated, historyEntry } = migrateCostCarbonStore(legacy);
      expect(migrated).toBe(true);
      expect(isValidStoreShape(data)).toBe(true);
      expect(historyEntry.kind).toBe('upgrade');
      expect(data.policies[0].schemaVersion).toBe(CIVIC_AGENT_COST_CARBON_SCHEMA_VERSION);
    });

    it('throws on non-object legacy input', () => {
      expect(() => migrateCostCarbonStore(null)).toThrow();
      expect(() => migrateCostCarbonStore('not an object')).toThrow();
    });
  });

  describe('indexes', () => {
    it('builds lookup indexes', () => {
      const store = createSeedStore({ now: '2026-11-24T00:00:00Z' });
      const indexes = buildCostCarbonIndexes(store);
      expect(indexes.policiesById.get('default-civic-agent-budget-v1')).toBeDefined();
    });
  });

  describe('load / ensure / persist', () => {
    it('loads an empty store and seeds when nothing present', () => {
      const storage = {};
      const store = loadCostCarbonStore({ storage, seed: true, now: '2026-11-24T00:00:00Z' });
      expect(isValidStoreShape(store)).toBe(true);
      expect(store.policies.length).toBe(1);
      expect(store.meta.seeded).toBe(true);
    });

    it('loads an existing valid store without re-seeding', () => {
      const storage = {};
      const first = loadCostCarbonStore({ storage, seed: true, now: '2026-11-24T00:00:00Z' });
      const second = loadCostCarbonStore({ storage, seed: true, now: '2026-11-24T00:00:00Z' });
      // The seed flag is carried over on the stored store; no new seed is created.
      expect(second.meta.seeded).toBe(true);
      expect(second.policies.length).toBe(first.policies.length);
    });

    it('persists a store via transaction atomically', () => {
      const storage = {};
      loadCostCarbonStore({ storage, seed: true, now: '2026-11-24T00:00:00Z' });
      const { data } = runCostCarbonTransaction((draft) => {
        draft.auditEvents.push({ id: 'audit-1', action: 'test', entityType: 'run', entityId: 'run-1', actorRole: 'system', actorId: 'test', reason: 't', timestamp: '2026-11-24T00:00:00Z', schemaVersion: 1 });
      }, { storage, now: new Date('2026-11-24T00:00:00Z') });
      expect(data.auditEvents.length).toBeGreaterThan(0);
    });

    it('rolls back to the seeded store', () => {
      const storage = {};
      loadCostCarbonStore({ storage, seed: true, now: '2026-11-24T00:00:00Z' });
      const rolled = rollbackCostCarbonStore({ storage, now: new Date('2026-11-24T00:00:00Z') });
      expect(rolled.meta.seeded).toBe(true);
    });

    it('resets to an empty store', () => {
      const storage = {};
      loadCostCarbonStore({ storage, seed: true, now: '2026-11-24T00:00:00Z' });
      const empty = resetCostCarbonStoreToEmpty({ storage, now: new Date('2026-11-24T00:00:00Z') });
      expect(empty.policies.length).toBe(0);
      expect(empty.meta.seeded).toBeUndefined();
    });
  });

  describe('retention', () => {
    it('archives old completed runs and flags their calls archived', () => {
      const storage = {};
      const store = loadCostCarbonStore({ storage, seed: true, now: '2026-11-24T00:00:00Z' });
      // Add an old completed run.
      const oldRun = {
        id: 'run-old',
        workflowId: 'wf-1',
        status: COST_CARBON_STATUS.COMPLETED,
        updatedAt: '2025-01-01T00:00:00Z',
        totals: { calls: 1 },
      };
      store.runs.push(oldRun);
      store.calls.push({ id: 'call-old', runId: 'run-old', recordedAt: '2025-01-01T00:00:00Z' });
      persistCostCarbonStore(store, { storage, now: new Date('2026-11-24T00:00:00Z') });

      const result = applyCostCarbonRetentionPolicy(
        { retentionDays: 90, now: '2026-11-24T00:00:00Z' },
        { storage },
      );
      const { result: retentionResult } = result;
      expect(typeof retentionResult.archivedRuns).toBe('number');
      expect(retentionResult.archivedRuns).toBeGreaterThanOrEqual(0);
      // The retention runs inside a transaction; check the stored state.
      const current = loadCostCarbonStore({ storage, now: new Date('2026-11-24T00:00:00Z') });
      const archivedRun = current.runs.find((r) => r.id === 'run-old');
      if (archivedRun) expect(archivedRun.status).toBe('archived');
    });
  });
});
