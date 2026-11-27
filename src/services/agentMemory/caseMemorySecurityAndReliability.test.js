import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  requirePermission,
  setCurrentActor,
  PermissionDeniedError,
} from '../accessControl';
import {
  registerEventConsumer,
  unregisterEventConsumer,
  dispatchPendingOutboxEvents,
  CIVIC_EVENT_TYPE,
  _resetEventBusInternalStores,
} from '../civicDomainEventBusService';
import { CaseMemoryEngine } from './caseMemoryEngine';
import { CaseMemoryStorageAdapter } from './caseMemoryStorage';

const createMockStorage = () => {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
    key: (i) => Array.from(map.keys())[i] || null,
    get length() {
      return map.size;
    },
  };
};

describe('Security & Reliability: Permissions, Retries, and Deletion Propagation', () => {
  let mockStorage;
  let engine;

  beforeEach(() => {
    _resetEventBusInternalStores();
    mockStorage = createMockStorage();
    engine = new CaseMemoryEngine(new CaseMemoryStorageAdapter(mockStorage));
    setCurrentActor(null);
  });

  describe('Permission Boundary Cases', () => {
    it('denies unauthenticated actors from performing administrative memory maintenance', () => {
      setCurrentActor(null);
      expect(() => requirePermission('agentMemory.admin')).toThrow(PermissionDeniedError);
    });

    it('denies citizen role from performing administrative memory maintenance', () => {
      setCurrentActor({ role: 'citizen', id: 'citizen_123' });
      expect(() => requirePermission('agentMemory.admin')).toThrow(PermissionDeniedError);
    });

    it('allows admin role to perform administrative memory operations', () => {
      setCurrentActor({ role: 'admin', id: 'admin_123' });
      expect(() => requirePermission('agentMemory.admin')).not.toThrow();
    });

    it('allows citizen role to read and purge their own scoped case memory', () => {
      setCurrentActor({ role: 'citizen', id: 'citizen_123' });
      expect(() => requirePermission('agentMemory.read')).not.toThrow();
      expect(() => requirePermission('agentMemory.purge')).not.toThrow();
    });
  });

  describe('Retry and Backoff Handling for Memory Domain Events', () => {
    it('schedules retry with exponential backoff on transient failure and resolves upon subsequent dispatch', async () => {
      let attempts = 0;
      const failingConsumer = vi.fn().mockImplementation(() => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error('Transient network glitch in memory audit sink');
        }
        return { success: true };
      });

      registerEventConsumer('retry-audit-sink', [CIVIC_EVENT_TYPE.CASE_MEMORY_CREATED], failingConsumer);

      // Stage memory event
      await engine.recordFactualNote({
        tenantId: 'tenant1',
        caseId: 'case-retry-test',
        title: 'Retry Note',
        text: 'Reliability verification note.',
      });

      // Dispatch 1: Fails and marks FAILED_RETRYABLE
      const firstDispatch = await dispatchPendingOutboxEvents();
      expect(attempts).toBe(1);
      expect(firstDispatch.failedCount).toBe(1);

      // Wait for backoff duration (100ms initial backoff)
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Dispatch 2: Retries and successfully delivers
      const retryDispatch = await dispatchPendingOutboxEvents();
      expect(attempts).toBe(2);
      expect(retryDispatch.deliveredCount).toBe(1);

      unregisterEventConsumer('retry-audit-sink');
    });
  });

  describe('Deletion Propagation and Cache Leakage Verification', () => {
    it('propagates purge events to subscribers and leaves zero cached leakage', async () => {
      const purgeEventsReceived = [];
      const consumerFn = (event) => {
        purgeEventsReceived.push(event);
      };

      registerEventConsumer('downstream-cache-invalidator', [CIVIC_EVENT_TYPE.CASE_MEMORY_PURGED], consumerFn);

      // Create entries in Case A and Case B
      await engine.recordFactualNote({
        tenantId: 'tenant1',
        caseId: 'case-alpha',
        title: 'Secret Alpha',
        text: 'Top secret case note.',
      });

      await engine.recordFactualNote({
        tenantId: 'tenant1',
        caseId: 'case-beta',
        title: 'Note Beta',
        text: 'Public case note.',
      });

      // Purge Case A
      const purgeResult = engine.purgeCaseMemory('tenant1', 'case-alpha');
      expect(purgeResult.clearedCount).toBe(1);

      // Dispatch outbox events to propagate deletion to consumers
      await dispatchPendingOutboxEvents();

      // Deletion event was propagated to subscriber
      expect(purgeEventsReceived.length).toBe(1);
      expect(purgeEventsReceived[0].eventType).toBe(CIVIC_EVENT_TYPE.CASE_MEMORY_PURGED);
      expect(purgeEventsReceived[0].aggregateId).toBe('tenant1:case-alpha');

      // Verify zero cache leakage in storage
      const afterPurgeAlpha = await engine.queryCaseMemory('tenant1', 'case-alpha');
      expect(afterPurgeAlpha).toEqual([]);

      // Verify Case B is completely unimpacted
      const afterPurgeBeta = await engine.queryCaseMemory('tenant1', 'case-beta');
      expect(afterPurgeBeta.length).toBe(1);
      expect(afterPurgeBeta[0].payload.title).toBe('Note Beta');

      unregisterEventConsumer('downstream-cache-invalidator');
    });
  });
});
