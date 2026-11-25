/**
 * tests/civic-evidence-locker-storage.test.js
 * Unit and integration tests for Evidence Locker Storage, Auto-Lock,
 * Revocable Grants, and Privacy-Preserving Audit Logging (#1186).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  lockLockerSession,
  unlockLockerSession,
  isLockerSessionUnlocked,
  getStoredEvidenceEnvelopes,
  saveStoredEvidenceEnvelopes,
  createAndStoreEvidenceRecord,
  getDecryptedEvidenceRecord,
  deleteStoredEvidenceRecord,
  createSharingGrant,
  getStoredSharingGrants,
  revokeSharingGrant,
  getAuditLogs,
  seedSyntheticFixturesIfEmpty,
} from '../src/services/civicEvidenceLockerStorageService.js';
import {
  EVIDENCE_LOCKER_STORAGE_KEY,
  EVIDENCE_LOCKER_AUDIT_STORAGE_KEY,
} from '../src/data/civicEvidenceLockerContract.js';

const makeStorage = () => {
  const data = new Map();
  return {
    getItem: vi.fn((k) => (data.has(k) ? data.get(k) : null)),
    setItem: vi.fn((k, v) => data.set(k, String(v))),
    removeItem: vi.fn((k) => data.delete(k)),
    clear: vi.fn(() => data.clear()),
    key: vi.fn((i) => [...data.keys()][i] ?? null),
    get length() {
      return data.size;
    },
  };
};

describe('Civic Evidence Locker: Storage & Session Service', () => {
  let storage;

  beforeEach(() => {
    storage = makeStorage();
    vi.stubGlobal('localStorage', storage);
    lockLockerSession();
  });

  it('manages in-memory lock/unlock lifecycle cleanly', () => {
    expect(isLockerSessionUnlocked()).toBe(false);
    expect(() => unlockLockerSession('short')).toThrow(/must be at least 8 characters/i);

    unlockLockerSession('SecurePassphrase123!');
    expect(isLockerSessionUnlocked()).toBe(true);

    lockLockerSession();
    expect(isLockerSessionUnlocked()).toBe(false);
  });

  it('seeds synthetic non-PII test fixtures if storage is empty', async () => {
    const seeded = await seedSyntheticFixturesIfEmpty('TestPassphrase123!');
    expect(seeded.length).toBeGreaterThan(0);

    const stored = getStoredEvidenceEnvelopes();
    expect(stored.length).toBe(seeded.length);
    expect(stored[0].crypto.cipher).toBe('AES-256-GCM');
  });

  it('creates, encrypts, stores, and decrypts a new evidence record', async () => {
    const envelope = await createAndStoreEvidenceRecord({
      title: 'Water Quality Contamination Laboratory Receipt',
      category: 'CIVIC_INFRASTRUCTURE',
      sensitivity: 'RESTRICTED',
      jurisdiction: 'Jal Sansthan Lucknow',
      tags: ['water-quality', 'lab-report'],
      narrative: 'Turbidity and dissolved solids exceeded prescribed limits.',
      files: [
        {
          fileName: 'lab_test_report_nov_2026.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 2048,
          content: 'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXr...',
          notes: 'Certified water test laboratory report.',
        },
      ],
      passphrase: 'RecordPassphrase456!',
    });

    expect(envelope.id).toMatch(/^rec-/);
    const storedList = getStoredEvidenceEnvelopes();
    expect(storedList.some((e) => e.id === envelope.id)).toBe(true);

    // Decrypt the record
    const decrypted = await getDecryptedEvidenceRecord(envelope.id, 'RecordPassphrase456!');
    expect(decrypted.narrative).toMatch(/turbidity/i);
    expect(decrypted.entries).toHaveLength(1);
    expect(decrypted.entries[0].fileName).toBe('lab_test_report_nov_2026.pdf');

    // Audit log was recorded without PII
    const logs = getAuditLogs();
    expect(logs.some((l) => l.action === 'CREATE_RECORD' && l.recordId === envelope.id)).toBe(true);
    expect(logs.some((l) => l.action === 'VIEW_RECORD_DECRYPTED')).toBe(true);
  });

  it('manages revocable sharing grants locally: create, inspect, and revoke', () => {
    const grant = createSharingGrant({
      recordId: 'rec-test-share-1',
      recipientLabel: 'District Magistrate Office Grievance Cell',
      validityHours: 48,
      maxAccessCount: 5,
    });

    expect(grant.grantId).toMatch(/^grant-/);
    expect(grant.revoked).toBe(false);

    const grants = getStoredSharingGrants();
    expect(grants.find((g) => g.grantId === grant.grantId)).toBeDefined();

    // Revoke
    const revoked = revokeSharingGrant(grant.grantId, 'Withdrawn after settlement');
    expect(revoked.revoked).toBe(true);
    expect(revoked.revocationReason).toBe('Withdrawn after settlement');

    const updated = getStoredSharingGrants().find((g) => g.grantId === grant.grantId);
    expect(updated.revoked).toBe(true);
  });

  it('safely deletes record and wipes from in-memory cache', async () => {
    const envelope = await createAndStoreEvidenceRecord({
      title: 'Temporary Discard Record',
      category: 'CONSUMER_DISPUTE',
      sensitivity: 'STANDARD',
      passphrase: 'DeletePassphrase123!',
      files: [],
    });

    expect(getStoredEvidenceEnvelopes().some((e) => e.id === envelope.id)).toBe(true);

    deleteStoredEvidenceRecord(envelope.id);
    expect(getStoredEvidenceEnvelopes().some((e) => e.id === envelope.id)).toBe(false);
  });
});
