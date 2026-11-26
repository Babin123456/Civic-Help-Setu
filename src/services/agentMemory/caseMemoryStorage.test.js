import { describe, it, expect, beforeEach } from 'vitest';
import { CaseMemoryStorageAdapter } from './caseMemoryStorage';
import { CaseBoundaryViolationError } from './caseIsolationGuard';

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

describe('caseMemoryStorage', () => {
  let mockStorage;
  let adapter;

  beforeEach(() => {
    mockStorage = createMockStorage();
    adapter = new CaseMemoryStorageAdapter(mockStorage);
  });

  it('saves and reads records strictly within case scope', () => {
    const record = { id: 'entry1', content: 'test data' };
    const key = adapter.saveRecord('tenantA', 'case1', 'entry1', record);

    expect(key).toBe('chsetu:mem:tenantA:case1:entry1');

    const read = adapter.readRecord('tenantA', 'case1', 'entry1', 'tenantA', 'case1');
    expect(read).toEqual(record);
  });

  it('blocks cross-case reads with CaseBoundaryViolationError', () => {
    adapter.saveRecord('tenantA', 'case1', 'entry1', { secret: 'case1 data' });

    expect(() =>
      adapter.readRecord('tenantA', 'case1', 'entry1', 'tenantA', 'case2')
    ).toThrow(CaseBoundaryViolationError);
  });

  it('lists records belonging solely to the specified case', () => {
    adapter.saveRecord('tenantA', 'case1', 'entry1', { id: 'entry1' });
    adapter.saveRecord('tenantA', 'case1', 'entry2', { id: 'entry2' });
    adapter.saveRecord('tenantA', 'case2', 'entryX', { id: 'entryX' });

    const case1Records = adapter.listRecordsForCase('tenantA', 'case1', 'tenantA', 'case1');
    expect(case1Records.length).toBe(2);
    expect(case1Records.map((r) => r.id).sort()).toEqual(['entry1', 'entry2']);

    const case2Records = adapter.listRecordsForCase('tenantA', 'case2', 'tenantA', 'case2');
    expect(case2Records.length).toBe(1);
    expect(case2Records[0].id).toBe('entryX');
  });

  it('deletes records and clears all records for a given case without affecting other cases', () => {
    adapter.saveRecord('tenantA', 'case1', 'entry1', { id: '1' });
    adapter.saveRecord('tenantA', 'case1', 'entry2', { id: '2' });
    adapter.saveRecord('tenantA', 'case2', 'entryOther', { id: 'other' });

    const deleted = adapter.deleteRecord('tenantA', 'case1', 'entry1', 'tenantA', 'case1');
    expect(deleted).toBe(true);

    const clearedCount = adapter.clearCaseMemories('tenantA', 'case1', 'tenantA', 'case1');
    expect(clearedCount).toBe(1); // remaining entry2

    expect(adapter.listRecordsForCase('tenantA', 'case1', 'tenantA', 'case1')).toEqual([]);
    expect(adapter.listRecordsForCase('tenantA', 'case2', 'tenantA', 'case2').length).toBe(1);
  });
});
