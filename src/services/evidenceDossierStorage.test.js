import { describe, it, expect, vi, beforeEach } from 'vitest';
import { webcrypto } from 'node:crypto';
import {
  listSavedDossiers,
  getSavedDossierById,
  saveDossier,
  deleteSavedDossier,
  verifySavedDossierIntegrity,
  exportDossierJson,
  importDossierJson,
  EVIDENCE_DOSSIERS_STORAGE_KEY,
} from './evidenceDossierStorage.js';

class MockStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

describe('evidenceDossierStorage', () => {
  let mockStorage;

  beforeEach(() => {
    vi.stubGlobal('crypto', webcrypto);
    mockStorage = new MockStorage();
  });

  const validSampleDossier = {
    title: 'Consumer Complaint Evidence',
    caseReference: 'CC-2026-9812',
    notes: 'Invoices and communication with delivery vendor',
    entries: [
      {
        name: 'invoice.pdf',
        size: 1024,
        type: 'application/pdf',
        lastModified: 1700000000000,
        description: 'Payment challan',
        category: 'Fee / Challan Payment Receipt',
        sha256: 'a'.repeat(64),
      },
    ],
  };

  it('saves and lists evidence dossiers', async () => {
    expect(listSavedDossiers(mockStorage)).toEqual([]);

    const saved = await saveDossier(validSampleDossier, mockStorage);
    expect(saved.id).toBeDefined();
    expect(saved.storageSeal).toBeDefined();
    expect(saved.title).toBe('Consumer Complaint Evidence');

    const list = listSavedDossiers(mockStorage);
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(saved.id);
  });

  it('retrieves saved dossier by ID', async () => {
    const saved = await saveDossier(validSampleDossier, mockStorage);
    const retrieved = getSavedDossierById(saved.id, mockStorage);
    expect(retrieved).not.toBeNull();
    expect(retrieved.title).toBe('Consumer Complaint Evidence');

    expect(getSavedDossierById('non-existent-id', mockStorage)).toBeNull();
  });

  it('updates an existing dossier without duplicating', async () => {
    const saved = await saveDossier(validSampleDossier, mockStorage);
    const updated = await saveDossier(
      {
        ...saved,
        notes: 'Updated notes with follow-up call details',
      },
      mockStorage
    );

    const list = listSavedDossiers(mockStorage);
    expect(list.length).toBe(1);
    expect(updated.notes).toBe('Updated notes with follow-up call details');
  });

  it('deletes saved dossier', async () => {
    const saved = await saveDossier(validSampleDossier, mockStorage);
    expect(listSavedDossiers(mockStorage).length).toBe(1);

    const deleted = deleteSavedDossier(saved.id, mockStorage);
    expect(deleted).toBe(true);
    expect(listSavedDossiers(mockStorage).length).toBe(0);

    // Deleting again returns false
    expect(deleteSavedDossier(saved.id, mockStorage)).toBe(false);
  });

  it('verifies tamper seal integrity correctly', async () => {
    const saved = await saveDossier(validSampleDossier, mockStorage);
    const check1 = await verifySavedDossierIntegrity(saved);
    expect(check1.isIntact).toBe(true);

    // Simulate tampering with an entry's hash or size
    const tampered = {
      ...saved,
      entries: [
        {
          ...saved.entries[0],
          size: 2048,
        },
      ],
    };
    const check2 = await verifySavedDossierIntegrity(tampered);
    expect(check2.isIntact).toBe(false);
  });

  it('rejects saving empty dossiers', async () => {
    await expect(saveDossier({ title: 'Empty', entries: [] }, mockStorage)).rejects.toThrow(
      'Cannot save an empty evidence dossier'
    );
  });

  it('exports and imports dossier json correctly', () => {
    const jsonStr = exportDossierJson(validSampleDossier);
    expect(typeof jsonStr).toBe('string');
    const imported = importDossierJson(jsonStr);
    expect(imported.title).toBe(validSampleDossier.title);
    expect(imported.entries.length).toBe(1);
    expect(imported.entries[0].name).toBe('invoice.pdf');
  });

  it('handles corrupted localStorage gracefully', () => {
    mockStorage.setItem(EVIDENCE_DOSSIERS_STORAGE_KEY, '{ invalid json');
    expect(listSavedDossiers(mockStorage)).toEqual([]);
  });
});
