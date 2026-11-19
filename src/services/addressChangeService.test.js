import { describe, it, expect } from 'vitest';
import {
  filterRecordsForPlan,
  sortRecordsByDependency,
  calculatePlanReadiness,
  getConditionalMoveRules,
} from './addressChangeService';
import { VERIFIED_ADDRESS_CHANGE_RECORDS } from '../data/addressChangeRecords';

describe('addressChangeService domain logic (#725)', () => {
  it('filters records by moveType and search query', () => {
    const allSameCity = filterRecordsForPlan(VERIFIED_ADDRESS_CHANGE_RECORDS, {
      moveType: 'same_city',
    });
    expect(allSameCity.length).toBeGreaterThan(0);

    const searchAadhaar = filterRecordsForPlan(VERIFIED_ADDRESS_CHANGE_RECORDS, {
      moveType: 'same_city',
      searchQuery: 'Aadhaar',
    });
    expect(searchAadhaar.length).toBeGreaterThan(0);
    expect(searchAadhaar.some((r) => r.id === 'aadhaar-address-update')).toBe(true);

    const selectedOnly = filterRecordsForPlan(VERIFIED_ADDRESS_CHANGE_RECORDS, {
      moveType: 'inter_state',
      selectedRecordIds: ['aadhaar-address-update', 'driving-licence-address-change'],
    });
    expect(selectedOnly.length).toBe(2);
    expect(selectedOnly.map((r) => r.id)).toEqual(['aadhaar-address-update', 'driving-licence-address-change']);
  });

  it('sorts records in correct prerequisite sequence (Aadhaar first)', () => {
    const sorted = sortRecordsByDependency(VERIFIED_ADDRESS_CHANGE_RECORDS);
    expect(sorted[0].id).toBe('aadhaar-address-update');
    expect(sorted[0].dependencyOrder).toBe(1);

    for (let i = 0; i < sorted.length - 1; i += 1) {
      expect(sorted[i].dependencyOrder).toBeLessThanOrEqual(sorted[i + 1].dependencyOrder);
    }
  });

  it('calculates plan readiness score and flags blocked prerequisites', () => {
    const testRecords = [
      { id: 'aadhaar-address-update', name: 'Aadhaar', dependencyOrder: 1, prerequisites: [] },
      { id: 'voter-electoral-roll-shifting', name: 'Voter ID', dependencyOrder: 2, prerequisites: ['aadhaar-address-update'] },
    ];

    // Case 1: Initial state (not started)
    const initial = calculatePlanReadiness(testRecords, {});
    expect(initial.total).toBe(2);
    expect(initial.notStarted).toBe(2);
    expect(initial.percentage).toBe(0);
    expect(initial.blockedRecords.length).toBe(1);
    expect(initial.blockedRecords[0].recordId).toBe('voter-electoral-roll-shifting');

    // Case 2: Aadhaar completed -> Voter ID unblocked
    const progressing = calculatePlanReadiness(testRecords, {
      'aadhaar-address-update': { status: 'completed' },
      'voter-electoral-roll-shifting': { status: 'documents_prepared' },
    });
    expect(progressing.completed).toBe(1);
    expect(progressing.documentsPrepared).toBe(1);
    expect(progressing.percentage).toBeGreaterThan(50);
    expect(progressing.blockedRecords.length).toBe(0);
  });

  it('generates appropriate conditional relocation rules for different move scopes', () => {
    const interStateRules = getConditionalMoveRules('inter_state', 'Maharashtra', 'Karnataka');
    expect(interStateRules.some((r) => r.title.includes('NOC Requirement (Form 28)'))).toBe(true);
    expect(interStateRules.some((r) => r.title.includes('Maharashtra to Karnataka'))).toBe(true);

    const sameCityRules = getConditionalMoveRules('same_city');
    expect(sameCityRules.some((r) => r.title.includes('Fast-Track Local Address Intimation'))).toBe(true);

    const interDistrictRules = getConditionalMoveRules('inter_district');
    expect(interDistrictRules.some((r) => r.title.includes('Intra-State RTO Change'))).toBe(true);
  });
});

