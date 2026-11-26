import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  RECONCILIATION_STORAGE_KEY,
  MAX_EVIDENCE_PER_APPLICATION,
  computeRecordSeal,
  verifyRecordIntegrity,
  getReconciliationRecord,
  saveReconciliationEvidence,
  removeEvidenceItem,
  purgeReconciliationRecord,
  purgeAllReconciliationRecords,
} from './statusEvidenceStorage.js';
import { ingestStatusEvidence } from './statusReconciliationEngine.js';

describe('statusEvidenceStorage', () => {
  let store = {};

  beforeEach(() => {
    store = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((k) => store[k] || null),
      setItem: vi.fn((k, v) => {
        store[k] = String(v);
      }),
      removeItem: vi.fn((k) => {
        delete store[k];
      }),
      clear: vi.fn(() => {
        store = {};
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('Integrity Seals', () => {
    it('computes deterministic SHA-256 seal for record payload', () => {
      const seal1 = computeRecordSeal('APP-1', [{ id: '1' }], { confidenceScore: 80 });
      const seal2 = computeRecordSeal('APP-1', [{ id: '1' }], { confidenceScore: 80 });
      expect(seal1).toBe(seal2);
      expect(seal1).toHaveLength(64);
    });

    it('verifies integrity successfully for untampered record', () => {
      const evidence = [{ id: '1', normalizedStatus: 'SUBMITTED' }];
      const report = { confidenceScore: 90 };
      const record = {
        applicationId: 'APP-1',
        evidenceList: evidence,
        lastReport: report,
        integrityHash: computeRecordSeal('APP-1', evidence, report),
      };

      expect(verifyRecordIntegrity(record)).toBe(true);
    });

    it('detects tampering when payload fields are modified post-creation', () => {
      const evidence = [{ id: '1', normalizedStatus: 'SUBMITTED' }];
      const report = { confidenceScore: 90 };
      const record = {
        applicationId: 'APP-1',
        evidenceList: evidence,
        lastReport: report,
        integrityHash: computeRecordSeal('APP-1', evidence, report),
      };

      // Tamper with evidenceList
      record.evidenceList = [{ id: '1', normalizedStatus: 'APPROVED' }];
      expect(verifyRecordIntegrity(record)).toBe(false);
    });
  });

  describe('Storage CRUD operations', () => {
    it('saves and retrieves evidence with valid integrity', () => {
      const evidence = ingestStatusEvidence({
        rawText: 'SMS: Application APP-100 approved',
        sourceType: 'SMS',
        referenceId: 'APP-100',
      });

      const saved = saveReconciliationEvidence('APP-100', evidence);
      expect(saved.applicationId).toBe('APP-100');
      expect(saved.evidenceList).toHaveLength(1);
      expect(saved.lastReport).toBeDefined();

      const retrieved = getReconciliationRecord('APP-100');
      expect(retrieved).not.toBeNull();
      expect(retrieved.isTampered).toBe(false);
      expect(retrieved.evidenceList[0].id).toBe(evidence.id);
    });

    it('flags isTampered: true if localStorage data was altered externally', () => {
      const evidence = ingestStatusEvidence({
        rawText: 'Portal status: under review',
        sourceType: 'PORTAL_EXPORT',
        referenceId: 'APP-200',
      });

      saveReconciliationEvidence('APP-200', evidence);

      // Alter directly in localStorage
      const raw = JSON.parse(localStorage.getItem(RECONCILIATION_STORAGE_KEY));
      raw['APP-200'].lastReport.confidenceScore = 999;
      localStorage.setItem(RECONCILIATION_STORAGE_KEY, JSON.stringify(raw));

      const retrieved = getReconciliationRecord('APP-200');
      expect(retrieved.isTampered).toBe(true);
    });

    it('removes an evidence item and updates the report and seal', () => {
      const e1 = ingestStatusEvidence({ rawText: 'SMS 1', sourceType: 'SMS', referenceId: 'APP-300' });
      const e2 = ingestStatusEvidence({ rawText: 'Portal 2', sourceType: 'PORTAL_EXPORT', referenceId: 'APP-300' });

      saveReconciliationEvidence('APP-300', e1);
      saveReconciliationEvidence('APP-300', e2);

      const updated = removeEvidenceItem('APP-300', e1.id);
      expect(updated.evidenceList).toHaveLength(1);
      expect(updated.evidenceList[0].id).toBe(e2.id);

      const retrieved = getReconciliationRecord('APP-300');
      expect(retrieved.evidenceList).toHaveLength(1);
      expect(retrieved.isTampered).toBe(false);
    });

    it('purges specific record and purges all records', () => {
      const e1 = ingestStatusEvidence({ rawText: 'SMS 1', sourceType: 'SMS' });
      saveReconciliationEvidence('APP-A', e1);
      saveReconciliationEvidence('APP-B', e1);

      purgeReconciliationRecord('APP-A');
      expect(getReconciliationRecord('APP-A')).toBeNull();
      expect(getReconciliationRecord('APP-B')).not.toBeNull();

      purgeAllReconciliationRecords();
      expect(getReconciliationRecord('APP-B')).toBeNull();
    });

    it('enforces MAX_EVIDENCE_PER_APPLICATION boundary limit', () => {
      for (let i = 0; i < MAX_EVIDENCE_PER_APPLICATION + 5; i += 1) {
        const item = ingestStatusEvidence({
          rawText: `Evidence entry ${i}`,
          sourceType: 'USER_NOTE',
          referenceId: 'BOUNDED-APP',
        });
        saveReconciliationEvidence('BOUNDED-APP', item);
      }

      const rec = getReconciliationRecord('BOUNDED-APP');
      expect(rec.evidenceList.length).toBe(MAX_EVIDENCE_PER_APPLICATION);
    });
  });
});
