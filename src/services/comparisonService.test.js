import { describe, it, expect, beforeEach } from 'vitest';
import { comparisonService, MAX_COMPARE_LIMIT } from './comparisonService';
import { services } from '../data/services';

const installStorage = () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
};

describe('comparisonService selection', () => {
  beforeEach(() => {
    installStorage();
  });

  it('caps the selection at the limit', () => {
    const ids = services.slice(0, MAX_COMPARE_LIMIT + 1).map((s) => s.id);
    ids.slice(0, MAX_COMPARE_LIMIT).forEach((id) => {
      expect(comparisonService.addService(id).success).toBe(true);
    });
    const res = comparisonService.addService(ids[MAX_COMPARE_LIMIT]);
    expect(res.success).toBe(false);
    expect(res.reason).toBe('limit_reached');
    expect(comparisonService.getComparedIds()).toHaveLength(MAX_COMPARE_LIMIT);
  });

  it('ignores duplicates and unknown ids', () => {
    const id = services[0].id;
    comparisonService.addService(id);
    expect(comparisonService.addService(id).reason).toBe('already_added');
    expect(comparisonService.addService('does-not-exist').reason).toBe('unknown_service');
    expect(comparisonService.getComparedIds()).toEqual([id]);
  });

  it('removes one item and clears all', () => {
    const [a, b] = services;
    comparisonService.addService(a.id);
    comparisonService.addService(b.id);
    expect(comparisonService.removeService(a.id)).toEqual([b.id]);
    expect(comparisonService.getComparedServices().map((s) => s.id)).toEqual([b.id]);
    comparisonService.clearAll();
    expect(comparisonService.getComparedIds()).toEqual([]);
  });

  it('survives corrupt storage', () => {
    localStorage.setItem('civic_compared_services', '{not json');
    expect(comparisonService.getComparedIds()).toEqual([]);
    localStorage.setItem('civic_compared_services', '"string"');
    expect(comparisonService.getComparedIds()).toEqual([]);
  });
});

describe('buildComparisonMatrix', () => {
  it('returns nothing for an empty selection', () => {
    expect(comparisonService.buildComparisonMatrix([])).toEqual([]);
  });

  it('uses only real fields and leaves empty arrays for missing data', () => {
    const complete = services[0];
    const incomplete = { id: 'x', name: 'Bare Service' };
    const matrix = comparisonService.buildComparisonMatrix([complete, incomplete]);
    const row = (name) => matrix.find((r) => r.attribute === name);

    expect(row('Fees').values[0]).toEqual([complete.fees]);
    expect(row('Fees').values[1]).toEqual([]);
    expect(row('Required documents').values[0]).toEqual(complete.documents);
    expect(row('Required documents').values[1]).toEqual([]);
    expect(row('Official sources').values[1]).toEqual([]);
    matrix.forEach((r) => expect(r.values).toHaveLength(2));
  });

  it('does not invent defaults for blank or malformed values', () => {
    const odd = { id: 'y', name: 'Odd', fees: '   ', eligibility: 'not-an-array', documents: ['', 'ID proof'] };
    const matrix = comparisonService.buildComparisonMatrix([odd]);
    const get = (name) => matrix.find((r) => r.attribute === name).values[0];
    expect(get('Fees')).toEqual([]);
    expect(get('Eligibility')).toEqual([]);
    expect(get('Required documents')).toEqual(['ID proof']);
  });
});

describe('getDifferencesSummary', () => {
  it('returns zeroes when less than 2 services are compared', () => {
    expect(comparisonService.getDifferencesSummary([])).toEqual({ totalRows: 0, differingRows: 0, identicalRows: 0 });
    expect(comparisonService.getDifferencesSummary([services[0]])).toEqual({ totalRows: 0, differingRows: 0, identicalRows: 0 });
  });

  it('accurately tallies differing and identical attributes between two services', () => {
    const summary = comparisonService.getDifferencesSummary([services[0], services[1]]);
    expect(summary.totalRows).toBe(10);
    expect(summary.differingRows).toBeGreaterThan(0);
    expect(summary.totalRows).toBe(summary.differingRows + summary.identicalRows);
  });
});
