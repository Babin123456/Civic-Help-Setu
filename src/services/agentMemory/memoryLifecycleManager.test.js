import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryLifecycleManager } from './memoryLifecycleManager';
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

describe('memoryLifecycleManager', () => {
  let mockStorage;
  let adapter;
  let manager;

  beforeEach(() => {
    mockStorage = createMockStorage();
    adapter = new CaseMemoryStorageAdapter(mockStorage);
    manager = new MemoryLifecycleManager(adapter);
  });

  it('scans all entries and purges expired records across cases', () => {
    const now = 1700000000000;

    // Active entry (expires in the future)
    adapter.saveRecord('tenant1', 'case1', 'active1', {
      id: 'active1',
      expiresAt: now + 50000,
      entryType: 'FACTUAL_NOTE',
    });

    // Expired entry (expires in past)
    adapter.saveRecord('tenant1', 'case1', 'expired1', {
      id: 'expired1',
      expiresAt: now - 1000,
      entryType: 'MODEL_PROPOSAL',
    });

    // Another case expired entry
    adapter.saveRecord('tenant2', 'case2', 'expired2', {
      id: 'expired2',
      expiresAt: now - 5000,
      entryType: 'FACTUAL_NOTE',
    });

    const sweepResult = manager.sweepExpiredMemories(now);

    expect(sweepResult.totalScanned).toBe(3);
    expect(sweepResult.expiredCount).toBe(2);
    expect(sweepResult.affectedCasesCount).toBe(2);

    // Active entry still exists
    expect(adapter.readRecord('tenant1', 'case1', 'active1', 'tenant1', 'case1')).toBeDefined();
    // Expired entries are gone
    expect(adapter.readRecord('tenant1', 'case1', 'expired1', 'tenant1', 'case1')).toBeNull();
    expect(adapter.readRecord('tenant2', 'case2', 'expired2', 'tenant2', 'case2')).toBeNull();
  });
});
