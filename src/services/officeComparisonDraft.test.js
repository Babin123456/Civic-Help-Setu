import { describe, it, expect } from 'vitest';
import {
  COMPARISON_DRAFT_KEY,
  COMPARISON_DRAFT_VERSION,
  clearComparisonDraft,
  hasMeaningfulComparisonDraft,
  normalizeComparisonDraft,
  readComparisonDraft,
  writeComparisonDraft,
} from './officeComparisonDraft';

const fakeStorage = () => {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
};

describe('officeComparisonDraft (#824)', () => {
  it('keeps only the non-sensitive service/locality filters and office IDs', () => {
    const draft = normalizeComparisonDraft({
      serviceId: 'driving-license',
      state: 'Delhi',
      district: 'South Delhi',
      locality: 'Saket',
      channel: 'in-person',
      onlyWheelchairAccessible: true,
      radiusKm: 50,
      selectedOfficeIds: ['office-a', 'office-a', 'office-b', 'office-c', 'office-d'],
      viewMode: 'table',
      name: 'Citizen Name',
      phone: '+91 99999 99999',
      aadhaar: '1234 5678 9012',
    });

    expect(draft).toEqual({
      version: COMPARISON_DRAFT_VERSION,
      serviceId: 'driving-license',
      state: 'Delhi',
      district: 'South Delhi',
      locality: 'Saket',
      channel: 'in-person',
      onlyWheelchairAccessible: true,
      radiusKm: 50,
      selectedOfficeIds: ['office-a', 'office-b', 'office-c'],
      viewMode: 'table',
    });
    expect(draft).not.toHaveProperty('name');
    expect(draft).not.toHaveProperty('phone');
    expect(draft).not.toHaveProperty('aadhaar');
  });

  it('rejects invalid or oversized values instead of storing them', () => {
    const draft = normalizeComparisonDraft({
      serviceId: 'not a slug!',
      state: 'x'.repeat(200),
      selectedOfficeIds: 'office-a',
      viewMode: 'canvas',
      channel: 'fax',
      onlyWheelchairAccessible: 'yes',
      radiusKm: 999,
    });
    expect(draft.serviceId).toBe('');
    expect(draft.state).toHaveLength(80);
    expect(draft.selectedOfficeIds).toEqual([]);
    expect(draft.viewMode).toBe('cards');
    expect(draft.channel).toBe('all');
    expect(draft.onlyWheelchairAccessible).toBe(false);
    expect(draft.radiusKm).toBe(100);
  });

  it('writes, reads and clears a versioned draft', () => {
    const storage = fakeStorage();
    expect(writeComparisonDraft({ serviceId: 'passport', selectedOfficeIds: ['a'] }, storage)).toBe(true);
    expect(storage.getItem(COMPARISON_DRAFT_KEY)).toContain('passport');

    const restored = readComparisonDraft(storage);
    expect(restored.serviceId).toBe('passport');
    expect(restored.selectedOfficeIds).toEqual(['a']);

    expect(clearComparisonDraft(storage)).toBe(true);
    expect(readComparisonDraft(storage)).toBeNull();
  });

  it('treats only non-default filters, selections or view mode as worth keeping', () => {
    expect(hasMeaningfulComparisonDraft(null)).toBe(false);
    expect(hasMeaningfulComparisonDraft({})).toBe(false);
    expect(hasMeaningfulComparisonDraft({ viewMode: 'cards' })).toBe(false);
    expect(hasMeaningfulComparisonDraft({ viewMode: 'table' })).toBe(true);
    expect(hasMeaningfulComparisonDraft({ serviceId: 'passport' })).toBe(true);
    expect(hasMeaningfulComparisonDraft({ radiusKm: 50 })).toBe(true);
    expect(hasMeaningfulComparisonDraft({ selectedOfficeIds: ['a'] })).toBe(true);
  });

  it('ignores corrupt, old-version, and unavailable storage', () => {
    const corrupt = fakeStorage();
    corrupt.setItem(COMPARISON_DRAFT_KEY, '{not json');
    expect(readComparisonDraft(corrupt)).toBeNull();

    const oldVersion = fakeStorage();
    oldVersion.setItem(COMPARISON_DRAFT_KEY, JSON.stringify({ version: 0, serviceId: 'passport' }));
    expect(readComparisonDraft(oldVersion)).toBeNull();

    expect(readComparisonDraft(undefined)).toBeNull();
    expect(writeComparisonDraft(null, fakeStorage())).toBe(false);

    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readComparisonDraft(blocked)).toBeNull();
    expect(writeComparisonDraft({ serviceId: 'passport' }, blocked)).toBe(false);
    expect(clearComparisonDraft(blocked)).toBe(false);
  });
});
