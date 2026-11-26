import { describe, it, expect, beforeEach } from 'vitest';
import { CaseMemoryEngine } from './caseMemoryEngine';
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

describe('Negative Security: Case Cross-Contamination & Boundary Attack', () => {
  let mockStorage;
  let engine;

  beforeEach(() => {
    mockStorage = createMockStorage();
    engine = new CaseMemoryEngine(new CaseMemoryStorageAdapter(mockStorage));
  });

  it('strictly blocks queries across cases even when guessing valid IDs', async () => {
    // Case 1: Sensitive Grievance against local ward officer
    await engine.recordFactualNote({
      tenantId: 'tenant1',
      caseId: 'case-grievance-44',
      title: 'Confidential Grievance Record',
      text: 'Citizen filed bribery allegation against Ward 12 officer.',
      requestingContext: { tenantId: 'tenant1', caseId: 'case-grievance-44' },
    });

    // Case 2: Standard Voter ID application for another citizen
    await engine.recordFactualNote({
      tenantId: 'tenant1',
      caseId: 'case-voter-88',
      title: 'Voter Application Note',
      text: 'Applying for EPIC card renewal.',
      requestingContext: { tenantId: 'tenant1', caseId: 'case-voter-88' },
    });

    // An agent operating in context of case-voter-88 attempts to query case-grievance-44
    await expect(
      engine.queryCaseMemory(
        'tenant1',
        'case-grievance-44',
        {},
        { tenantId: 'tenant1', caseId: 'case-voter-88' } // requesting context mismatch
      )
    ).rejects.toThrow(CaseBoundaryViolationError);
  });

  it('guarantees zero memory bleed during concurrent inter-case writes and purges', async () => {
    const caseA = 'case-concurrent-A';
    const caseB = 'case-concurrent-B';

    // Interleaved writes
    await Promise.all([
      engine.recordFactualNote({
        tenantId: 't1',
        caseId: caseA,
        title: 'Note A1',
        text: 'Text for Case A.',
      }),
      engine.recordFactualNote({
        tenantId: 't1',
        caseId: caseB,
        title: 'Note B1',
        text: 'Text for Case B.',
      }),
      engine.recordModelProposal({
        tenantId: 't1',
        caseId: caseA,
        title: 'Prop A2',
        text: 'Suggestion for Case A.',
      }),
      engine.recordModelProposal({
        tenantId: 't1',
        caseId: caseB,
        title: 'Prop B2',
        text: 'Suggestion for Case B.',
      }),
    ]);

    const memsA = await engine.queryCaseMemory('t1', caseA);
    const memsB = await engine.queryCaseMemory('t1', caseB);

    expect(memsA.length).toBe(2);
    expect(memsB.length).toBe(2);

    expect(memsA.every((m) => m.caseId === caseA)).toBe(true);
    expect(memsB.every((m) => m.caseId === caseB)).toBe(true);

    // Purging Case A must leave Case B completely untouched
    engine.purgeCaseMemory('t1', caseA);

    const memsAAfter = await engine.queryCaseMemory('t1', caseA);
    const memsBAfter = await engine.queryCaseMemory('t1', caseB);

    expect(memsAAfter).toEqual([]);
    expect(memsBAfter.length).toBe(2);
  });
});
