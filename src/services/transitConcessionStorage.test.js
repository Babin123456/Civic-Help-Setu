import { describe, expect, it } from 'vitest';
import {
  deleteTransitChecklist,
  readTransitChecklist,
  readTransitChecklists,
  saveTransitChecklist,
  TRANSIT_CHECKLIST_STORAGE_KEY,
} from './transitConcessionStorage';
import {
  getTransitCities,
  getTransitOperators,
  getTransitStates,
  isTransitRecordStale,
  TRANSIT_CONCESSION_RECORDS,
  validateTransitConcessionRecord,
} from '../data/transitConcessions';

class MockStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

describe('transit concession directory data', () => {
  it('switches jurisdictions and only offers operators for the selected city', () => {
    expect(getTransitStates()).toContain('Delhi (NCT)');
    expect(getTransitCities('Karnataka')).toEqual(['Bengaluru']);
    expect(getTransitOperators('Karnataka', 'Bengaluru').map(({ id }) => id)).toEqual([
      'karnataka-bmtc-bus',
      'karnataka-bmrcl-metro',
    ]);
    expect(getTransitOperators('Karnataka', 'Delhi')).toEqual([]);
    expect(getTransitOperators('Tamil Nadu', 'Chennai').map(({ mode }) => mode)).toEqual([
      'bus',
      'metro',
      'suburban_rail',
    ]);
  });

  it('keeps concession claims unavailable until a dated official rule is verified', () => {
    expect(TRANSIT_CONCESSION_RECORDS.every((record) => validateTransitConcessionRecord(record))).toBe(true);
    expect(TRANSIT_CONCESSION_RECORDS.every((record) =>
      record.status === 'unverified' &&
      record.sourceDate === null &&
      record.effectiveDate === null &&
      record.verifiedAt === null &&
      record.eligibility === null &&
      record.fees === null &&
      record.validity === null
    )).toBe(true);
  });

  it('refuses verified records without dated source evidence and marks old records stale', () => {
    const [unverified] = TRANSIT_CONCESSION_RECORDS;
    expect(validateTransitConcessionRecord({ ...unverified, status: 'verified' })).toBe(false);
    expect(isTransitRecordStale(unverified, Date.parse('2026-11-23T00:00:00.000Z'))).toBe(true);

    const verified = {
      ...unverified,
      status: 'verified',
      sourceDate: '2026-11-20',
      verifiedAt: '2026-11-23T00:00:00.000Z',
      officialInstructions: { title: 'Official notice', content: 'Officially verified instructions.' },
      eligibility: 'As stated in the notice.',
    };
    expect(validateTransitConcessionRecord(verified)).toBe(true);
    expect(isTransitRecordStale(verified, Date.parse('2026-11-23T00:00:00.000Z'))).toBe(false);
    expect(isTransitRecordStale(verified, Date.parse('2027-06-01T00:00:00.000Z'))).toBe(true);
  });
});

describe('transit checklist storage', () => {
  it('saves, reopens, edits, and deletes a checklist per operator without server transmission', () => {
    const storage = new MockStorage();
    saveTransitChecklist('karnataka-bmtc-bus', {
      renewalDate: '2026-12-01',
      completed: { eligibility: true },
      notes: 'Ask the operator about renewal.',
    }, storage);
    expect(readTransitChecklist('karnataka-bmtc-bus', storage)).toEqual({
      renewalDate: '2026-12-01',
      completed: { eligibility: true },
      notes: 'Ask the operator about renewal.',
    });

    saveTransitChecklist('karnataka-bmtc-bus', {
      ...readTransitChecklist('karnataka-bmtc-bus', storage),
      notes: 'Updated note',
    }, storage);
    expect(readTransitChecklist('karnataka-bmtc-bus', storage).notes).toBe('Updated note');

    deleteTransitChecklist('karnataka-bmtc-bus', storage);
    expect(readTransitChecklists(storage)).toEqual({});
    expect(storage.getItem(TRANSIT_CHECKLIST_STORAGE_KEY)).toBeNull();
  });

  it('rejects invalid IDs and sanitizes unexpected stored values', () => {
    const storage = new MockStorage();
    expect(() => saveTransitChecklist('../other', {}, storage)).toThrow('valid transport operator');
    storage.setItem(TRANSIT_CHECKLIST_STORAGE_KEY, JSON.stringify({
      'karnataka-bmtc-bus': { renewalDate: 'not-a-date', completed: { eligibility: 'yes' }, notes: 12 },
    }));
    expect(readTransitChecklist('karnataka-bmtc-bus', storage)).toEqual({
      renewalDate: '',
      completed: {},
      notes: '',
    });
  });
});
