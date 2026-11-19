import { describe, it, expect, beforeEach } from 'vitest';
import {
  readLibraryChecklist,
  saveLibraryChecklist,
  toggleLibraryChecklistItem,
  addCustomLibraryChecklistItem,
  deleteLibraryChecklist,
  LIBRARY_CHECKLIST_KEY,
} from './libraryChecklistStorage';

describe('libraryChecklistStorage (#727)', () => {
  let mockStorage;
  let store;

  beforeEach(() => {
    store = {};
    mockStorage = {
      getItem: (key) => store[key] ?? null,
      setItem: (key, val) => {
        store[key] = String(val);
      },
      removeItem: (key) => {
        delete store[key];
      },
    };
  });

  it('reads empty default state for uninitialized library checklist', () => {
    const res = readLibraryChecklist('dpl-central', mockStorage);
    expect(res.libraryId).toBe('dpl-central');
    expect(res.checked).toEqual([]);
    expect(res.customItems).toEqual([]);
    expect(res.rev).toBe(0);
  });

  it('saves and updates checklist with revision bump', () => {
    const saveRes = saveLibraryChecklist(
      'dpl-central',
      {
        checked: ['Photo ID'],
        customItems: ['Get guarantor signature'],
        selectedCategory: 'general_adult',
      },
      0,
      mockStorage
    );

    expect(saveRes.ok).toBe(true);
    expect(saveRes.state.rev).toBe(1);
    expect(saveRes.state.checked).toEqual(['Photo ID']);
    expect(saveRes.state.customItems).toEqual(['Get guarantor signature']);

    const readRes = readLibraryChecklist('dpl-central', mockStorage);
    expect(readRes.rev).toBe(1);
    expect(readRes.checked).toEqual(['Photo ID']);
  });

  it('detects concurrency conflict when expectedRev is stale', () => {
    saveLibraryChecklist('dpl-central', { checked: ['A'] }, 0, mockStorage);

    // Attempting to write with stale expectedRev 0
    const conflictRes = saveLibraryChecklist('dpl-central', { checked: ['B'] }, 0, mockStorage);
    expect(conflictRes.ok).toBe(false);
    expect(conflictRes.reason).toBe('conflict');
    expect(conflictRes.state.rev).toBe(1);
  });

  it('toggles checklist items accurately', () => {
    // Toggle on
    const toggle1 = toggleLibraryChecklistItem('dpl-central', 'Address Proof', 0, mockStorage);
    expect(toggle1.ok).toBe(true);
    expect(toggle1.state.checked).toContain('Address Proof');

    // Toggle off
    const toggle2 = toggleLibraryChecklistItem('dpl-central', 'Address Proof', 1, mockStorage);
    expect(toggle2.ok).toBe(true);
    expect(toggle2.state.checked).not.toContain('Address Proof');
  });

  it('adds custom checklist items and prevents duplicates', () => {
    const add1 = addCustomLibraryChecklistItem('dpl-central', 'Collect college bonafide', 0, mockStorage);
    expect(add1.ok).toBe(true);
    expect(add1.state.customItems).toContain('Collect college bonafide');

    // Duplicate rejection
    const add2 = addCustomLibraryChecklistItem('dpl-central', 'Collect college bonafide', 1, mockStorage);
    expect(add2.ok).toBe(false);
    expect(add2.reason).toBe('duplicate_item');
  });

  it('allows user to review, edit and delete/clear saved checklist data', () => {
    saveLibraryChecklist('dpl-central', { checked: ['Task 1'], customItems: ['Task 2'] }, 0, mockStorage);
    expect(readLibraryChecklist('dpl-central', mockStorage).checked.length).toBe(1);

    const deleted = deleteLibraryChecklist('dpl-central', mockStorage);
    expect(deleted).toBe(true);

    const resetState = readLibraryChecklist('dpl-central', mockStorage);
    expect(resetState.checked).toEqual([]);
    expect(resetState.customItems).toEqual([]);
    expect(resetState.rev).toBe(0);
  });
});

