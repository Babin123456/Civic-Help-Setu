import { describe, it, expect, beforeEach } from 'vitest';
import {
  readAddressChangePlan,
  saveAddressChangePlan,
  updateRecordProgress,
  deleteAddressChangePlan,
  DEFAULT_PLAN_STATE,
  ADDRESS_CHANGE_STORAGE_KEY,
} from './addressChangeStorage';

class MockStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] ?? null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

describe('addressChangeStorage service (#725)', () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = new MockStorage();
  });

  it('returns default plan state when storage is empty', () => {
    const plan = readAddressChangePlan(mockStorage);
    expect(plan.moveType).toBe('same_city');
    expect(plan.rev).toBe(0);
    expect(plan.selectedRecordIds.length).toBeGreaterThan(0);
  });

  it('saves and reads back plan with incremented revision', () => {
    const saveRes = saveAddressChangePlan(
      {
        moveType: 'inter_state',
        originState: 'Maharashtra',
        destinationState: 'Karnataka',
        selectedRecordIds: ['aadhaar-address-update', 'driving-licence-address-change'],
        items: {},
      },
      { expectedRev: 0 },
      mockStorage
    );

    expect(saveRes.success).toBe(true);
    expect(saveRes.rev).toBe(1);

    const reloaded = readAddressChangePlan(mockStorage);
    expect(reloaded.moveType).toBe('inter_state');
    expect(reloaded.originState).toBe('Maharashtra');
    expect(reloaded.destinationState).toBe('Karnataka');
    expect(reloaded.rev).toBe(1);
    expect(reloaded.updatedAt).toBeTruthy();
  });

  it('rejects stale writes when expectedRev conflicts with current revision', () => {
    saveAddressChangePlan({ moveType: 'inter_district' }, { expectedRev: 0 }, mockStorage);

    const staleAttempt = saveAddressChangePlan(
      { moveType: 'same_city' },
      { expectedRev: 0 },
      mockStorage
    );

    expect(staleAttempt.success).toBe(false);
    expect(staleAttempt.conflict).toBe(true);
  });

  it('updates progress of a specific record item', () => {
    const updateRes = updateRecordProgress(
      'aadhaar-address-update',
      {
        status: 'submitted',
        acknowledgementRef: 'URN-1234567890',
        submissionDate: '2026-03-02',
      },
      mockStorage
    );

    expect(updateRes.success).toBe(true);
    const plan = readAddressChangePlan(mockStorage);
    expect(plan.items['aadhaar-address-update']).toEqual({
      status: 'submitted',
      acknowledgementRef: 'URN-1234567890',
      submissionDate: '2026-03-02',
      notes: '',
      completedProofs: [],
    });
  });

  it('deletes plan data cleanly from storage', () => {
    saveAddressChangePlan({ moveType: 'inter_state' }, { expectedRev: 0 }, mockStorage);
    expect(mockStorage.getItem(ADDRESS_CHANGE_STORAGE_KEY)).toBeTruthy();

    const deleteRes = deleteAddressChangePlan(mockStorage);
    expect(deleteRes).toBe(true);
    expect(mockStorage.getItem(ADDRESS_CHANGE_STORAGE_KEY)).toBeNull();
  });
});

