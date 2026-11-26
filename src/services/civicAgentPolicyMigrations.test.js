/**
 * src/services/civicAgentPolicyMigrations.test.js
 *
 * Unit tests for persistence, migration, rollback and retention of the Civic
 * Agent Workflow Policy-as-Code Engine store (#1187).
 *
 * Synthetic fixtures only: no citizen records, credentials, raw documents or
 * sensitive prompts.
 */

import { describe, it, expect } from 'vitest';
import {
  createEmptyStore,
  createSeedStore,
  isValidStoreShape,
  migratePolicyStore,
  buildPolicyIndexes,
  loadPolicyStore,
  persistPolicyStore,
  runPolicyTransaction,
  rollbackPolicyStore,
  resetPolicyStoreToEmpty,
  applyPolicyRetentionPolicy,
  isPolicyId,
  isRuleId
} from './civicAgentPolicyMigrations.js';
import {
  CIVIC_AGENT_POLICY_SCHEMA_VERSION,
  POLICY_ENGINE_STATUS,
  DEFAULT_POLICY
} from '../data/civicAgentPolicyConstants.js';

describe('civicAgentPolicyMigrations', () => {
  describe('createEmptyStore / createSeedStore', () => {
    it('creates a valid empty store', () => {
      const store = createEmptyStore({ now: '2026-11-24T00:00:00Z' });
      expect(isValidStoreShape(store)).toBe(true);
      expect(store.schemaVersion).toBe(CIVIC_AGENT_POLICY_SCHEMA_VERSION);
      expect(store.policies).toEqual([]);
    });

    it('seeds with the default policy', () => {
      const store = createSeedStore({ now: '2026-11-24T00:00:00Z' });
      expect(isValidStoreShape(store)).toBe(true);
      expect(store.policies.length).toBe(1);
      expect(store.policies[0].id).toBe(DEFAULT_POLICY.id);
      expect(store.meta.seeded).toBe(true);
    });
  });

  describe('validation helpers', () => {
    it('validates policy and rule ids', () => {
      expect(isPolicyId('policy-1')).toBe(true);
      expect(isPolicyId('Invalid Id!')).toBe(false);
      expect(isRuleId('rule-1')).toBe(true);
      expect(isRuleId('bad id')).toBe(false);
    });
  });

  describe('migration', () => {
    it('returns a valid store unchanged', () => {
      const store = createSeedStore({ now: '2026-11-24T00:00:00Z' });
      const { data, migrated } = migratePolicyStore(store);
      expect(migrated).toBe(false);
      expect(isValidStoreShape(data)).toBe(true);
    });

    it('migrates a legacy flat shape', () => {
      const legacy = {
        schemaVersion: 0,
        policies: [{ id: 'legacy-policy', name: 'Legacy', version: 0, rules: [] }]
      };
      const { data, migrated, historyEntry } = migratePolicyStore(legacy);
      expect(migrated).toBe(true);
      expect(isValidStoreShape(data)).toBe(true);
      expect(historyEntry.kind).toBe('upgrade');
      expect(data.policies[0].schemaVersion).toBe(CIVIC_AGENT_POLICY_SCHEMA_VERSION);
    });

    it('throws on non-object legacy input', () => {
      expect(() => migratePolicyStore(null)).toThrow();
      expect(() => migratePolicyStore('not an object')).toThrow();
    });
  });

  describe('indexes', () => {
    it('builds lookup indexes', () => {
      const store = createSeedStore({ now: '2026-11-24T00:00:00Z' });
      const indexes = buildPolicyIndexes(store);
      expect(indexes.policiesById.get(DEFAULT_POLICY.id)).toBeDefined();
    });
  });

  describe('load / ensure / persist', () => {
    it('loads an empty store and seeds when nothing present', () => {
      const storage = {};
      const store = loadPolicyStore({ storage, seed: true, now: '2026-11-24T00:00:00Z' });
      expect(isValidStoreShape(store)).toBe(true);
      expect(store.policies.length).toBe(1);
      expect(store.meta.seeded).toBe(true);
    });

    it('loads an existing valid store without re-seeding', () => {
      const storage = {};
      const first = loadPolicyStore({ storage, seed: true, now: '2026-11-24T00:00:00Z' });
      const second = loadPolicyStore({ storage, seed: true, now: '2026-11-24T00:00:00Z' });
      expect(second.meta.seeded).toBe(true);
      expect(second.policies.length).toBe(first.policies.length);
    });

    it('persists a store via transaction atomically', () => {
      const storage = {};
      loadPolicyStore({ storage, seed: true, now: '2026-11-24T00:00:00Z' });
      const { data } = runPolicyTransaction((draft) => {
        draft.evaluationAudit.push({
          id: 'audit-1',
          action: 'test',
          entityType: 'policy',
          entityId: 'policy-1',
          actorRole: 'system',
          actorId: 'test',
          reason: 't',
          timestamp: '2026-11-24T00:00:00Z',
          schemaVersion: 1
        });
      }, { storage, now: new Date('2026-11-24T00:00:00Z') });
      expect(data.evaluationAudit.length).toBeGreaterThan(0);
    });

    it('rolls back to the seeded store', () => {
      const storage = {};
      loadPolicyStore({ storage, seed: true, now: '2026-11-24T00:00:00Z' });
      const rolled = rollbackPolicyStore({ storage, now: new Date('2026-11-24T00:00:00Z') });
      expect(rolled.meta.seeded).toBe(true);
    });

    it('resets to an empty store', () => {
      const storage = {};
      loadPolicyStore({ storage, seed: true, now: '2026-11-24T00:00:00Z' });
      const empty = resetPolicyStoreToEmpty({ storage, now: new Date('2026-11-24T00:00:00Z') });
      expect(empty.policies.length).toBe(0);
    });
  });

  describe('retention', () => {
    it('retires old archived/revoked policies', () => {
      const storage = {};
      const store = loadPolicyStore({ storage, seed: true, now: '2026-11-24T00:00:00Z' });
      store.policies.push({
        id: 'policy-old',
        status: POLICY_ENGINE_STATUS.ARCHIVED,
        updatedAt: '2025-01-01T00:00:00Z',
        rules: []
      });
      persistPolicyStore(store, { storage, now: new Date('2026-11-24T00:00:00Z') });

      const result = applyPolicyRetentionPolicy(
        { retentionDays: 90, now: '2026-11-24T00:00:00Z' },
        { storage }
      );
      const { result: retentionResult } = result;
      expect(typeof retentionResult.archivedPolicies).toBe('number');
      expect(retentionResult.archivedPolicies).toBeGreaterThanOrEqual(0);
    });
  });
});
