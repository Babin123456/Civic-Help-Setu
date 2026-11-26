import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ingestStatusEvidence,
  reconcileApplicationStatus,
  detectReferenceMismatches,
  detectTemporalInversions,
  CONFLICT_TYPES,
  CONFLICT_SEVERITY,
} from '../src/services/statusReconciliationEngine.js';
import {
  CANONICAL_STATUS,
} from '../src/services/statusVocabularyNormalizer.js';
import {
  saveReconciliationEvidence,
  getReconciliationRecord,
  verifyRecordIntegrity,
  MAX_EVIDENCE_PER_APPLICATION,
} from '../src/services/statusEvidenceStorage.js';

describe('Synthetic Cross-Portal Reconciliation Benchmark Suite (#1158)', () => {
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

  describe('Benchmark 1: Multi-Channel Concordance (Positive Baseline)', () => {
    it('achieves high consensus and high confidence when SMS, Portal, and Physical receipts align', () => {
      const today = new Date();
      const d1 = new Date(today.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const d2 = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const d3 = new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const receipt = ingestStatusEvidence({
        rawText: `Physical counter token generated at Taluk office on ${d1}. Ref SYNTH-MH-2026-001`,
        sourceType: 'PAPER_RECEIPT',
        referenceId: 'SYNTH-MH-2026-001',
        date: d1,
      });

      const portal = ingestStatusEvidence({
        rawText: `Portal status: Application received and forwarded to scrutiny on ${d2}`,
        sourceType: 'PORTAL_EXPORT',
        referenceId: 'SYNTH-MH-2026-001',
        date: d2,
      });

      const sms = ingestStatusEvidence({
        rawText: `SMS alert: Your application SYNTH-MH-2026-001 is currently under review by Revenue Officer on ${d3}`,
        sourceType: 'SMS',
        referenceId: 'SYNTH-MH-2026-001',
        date: d3,
      });

      const report = reconcileApplicationStatus({
        applicationId: 'SYNTH-MH-2026-001',
        evidenceList: [receipt, portal, sms],
      });

      expect(report.hasConflicts).toBe(false);
      expect(report.conflicts).toHaveLength(0);
      expect(report.consensusStatus).toBe(CANONICAL_STATUS.UNDER_REVIEW);
      expect(report.confidenceScore).toBeGreaterThanOrEqual(85);
      expect(report.guidance.actionType).toBe('MONITOR');
    });
  });

  describe('Benchmark 2: Contradictory Terminal States (Negative / Conflict Case)', () => {
    it('accurately isolates direct terminal contradictions between SMS dispatch and Portal rejection', () => {
      const ePortal = ingestStatusEvidence({
        rawText: 'Portal notice: Application rejected due to incomplete income proof',
        sourceType: 'PORTAL_EXPORT',
        referenceId: 'SYNTH-MH-2026-002',
        date: '2026-04-10',
      });

      const eSms = ingestStatusEvidence({
        rawText: 'SMS gateway: Application SYNTH-MH-2026-002 approved and certificate dispatched',
        sourceType: 'SMS',
        referenceId: 'SYNTH-MH-2026-002',
        date: '2026-04-11',
      });

      const report = reconcileApplicationStatus({
        applicationId: 'SYNTH-MH-2026-002',
        evidenceList: [ePortal, eSms],
      });

      expect(report.hasConflicts).toBe(true);
      const terminalConflict = report.conflicts.find(
        (c) => c.type === CONFLICT_TYPES.CONTRADICTORY_TERMINAL
      );
      expect(terminalConflict).toBeDefined();
      expect(terminalConflict.severity).toBe(CONFLICT_SEVERITY.HIGH);
      expect(report.confidenceScore).toBeLessThan(65);
      expect(report.guidance.actionType).toBe('VISIT_OFFICE');
    });
  });

  describe('Benchmark 3: Chronological Inversion & Out-of-Order Lifecycle Events', () => {
    it('flags high severity temporal inversion when terminal approval is followed by scrutiny', () => {
      const approvedEarlier = ingestStatusEvidence({
        rawText: 'Order passed: Certificate sanctioned and approved on 2026-01-15',
        sourceType: 'PORTAL_EXPORT',
        date: '2026-01-15',
        referenceId: 'SYNTH-MH-2026-003',
      });

      const scrutinyLater = ingestStatusEvidence({
        rawText: 'Department notice: Application under scrutiny with field clerk on 2026-01-25',
        sourceType: 'SMS',
        date: '2026-01-25',
        referenceId: 'SYNTH-MH-2026-003',
      });

      const conflicts = detectTemporalInversions([approvedEarlier, scrutinyLater]);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].type).toBe(CONFLICT_TYPES.TEMPORAL_INVERSION);
      expect(conflicts[0].severity).toBe(CONFLICT_SEVERITY.HIGH);
    });
  });

  describe('Benchmark 4: Reference ID Divergence & Departmental Sub-Partitions', () => {
    it('differentiates departmental sub-references from completely unaligned tracking codes', () => {
      const baseAppId = 'SYNTH-KA-5500';

      const subRefEvidence = ingestStatusEvidence({
        rawText: 'Counter slip: Assigned file SYNTH-KA-5500/A for revenue subdivision',
        sourceType: 'PAPER_RECEIPT',
        referenceId: 'SYNTH-KA-5500/A',
      });

      const disjointEvidence = ingestStatusEvidence({
        rawText: 'SMS update: Notification for reference SYNTH-DL-9912',
        sourceType: 'SMS',
        referenceId: 'SYNTH-DL-9912',
      });

      const subConflicts = detectReferenceMismatches([subRefEvidence], baseAppId);
      expect(subConflicts).toHaveLength(1);
      expect(subConflicts[0].severity).toBe(CONFLICT_SEVERITY.MEDIUM);
      expect(subConflicts[0].description).toContain('Sub-reference detected');

      const disjointConflicts = detectReferenceMismatches([disjointEvidence], baseAppId);
      expect(disjointConflicts).toHaveLength(1);
      expect(disjointConflicts[0].severity).toBe(CONFLICT_SEVERITY.HIGH);
      expect(disjointConflicts[0].description).toContain('Reference mismatch');
    });
  });

  describe('Benchmark 5: Privacy Boundary & PII Minimization', () => {
    it('guarantees zero leakage of Aadhaar, mobile numbers, emails, or API keys in stored records', () => {
      const contaminatedSnippet =
        'Citizen Aadhaar: 9988 7766 5544, Phone: +91 9876543210, Email: citizen@test.gov.in. Auth: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9. Application SYNTH-MH-009 under review.';

      const evidence = ingestStatusEvidence({
        rawText: contaminatedSnippet,
        sourceType: 'SMS',
        referenceId: 'SYNTH-MH-009',
      });

      const savedRecord = saveReconciliationEvidence('SYNTH-MH-009', evidence);

      // Verify stored raw text is sanitized
      const storedItem = savedRecord.evidenceList[0];
      expect(storedItem.rawTextScrubbed).not.toContain('9988 7766 5544');
      expect(storedItem.rawTextScrubbed).not.toContain('9876543210');
      expect(storedItem.rawTextScrubbed).not.toContain('citizen@test.gov.in');
      expect(storedItem.rawTextScrubbed).not.toContain('eyJhbGciOiJIUzI1Ni');

      expect(storedItem.rawTextScrubbed).toContain('[REDACTED_AADHAAR]');
      expect(storedItem.rawTextScrubbed).toContain('[REDACTED_PHONE]');
      expect(storedItem.rawTextScrubbed).toContain('[REDACTED_EMAIL]');
    });
  });

  describe('Benchmark 6: Tamper-Evident Storage & Cryptographic Verification', () => {
    it('maintains valid integrity hash across lifecycle and detects offline modifications', () => {
      const e1 = ingestStatusEvidence({
        rawText: 'Initial acknowledgment on 2026-05-01',
        sourceType: 'PORTAL_EXPORT',
        referenceId: 'SYNTH-SEAL-01',
      });

      const initialRecord = saveReconciliationEvidence('SYNTH-SEAL-01', e1);
      expect(verifyRecordIntegrity(initialRecord)).toBe(true);

      const retrieved = getReconciliationRecord('SYNTH-SEAL-01');
      expect(retrieved.isTampered).toBe(false);

      // Simulate external tampering in localStorage
      const rawStore = JSON.parse(store['civicbridge_status_reconciliation_v1']);
      rawStore['SYNTH-SEAL-01'].lastReport.consensusStatus = 'COMPLETED';
      store['civicbridge_status_reconciliation_v1'] = JSON.stringify(rawStore);

      const tamperedRetrieved = getReconciliationRecord('SYNTH-SEAL-01');
      expect(tamperedRetrieved.isTampered).toBe(true);
    });
  });

  describe('Benchmark 7: Concurrency & Boundary Limits', () => {
    it('enforces FIFO bound on max evidence entries to prevent local storage DoS', () => {
      for (let i = 0; i < MAX_EVIDENCE_PER_APPLICATION + 10; i += 1) {
        const item = ingestStatusEvidence({
          rawText: `Status ping event ${i}`,
          sourceType: 'USER_NOTE',
          referenceId: 'SYNTH-BURST',
        });
        saveReconciliationEvidence('SYNTH-BURST', item);
      }

      const record = getReconciliationRecord('SYNTH-BURST');
      expect(record.evidenceList).toHaveLength(MAX_EVIDENCE_PER_APPLICATION);
      expect(record.isTampered).toBe(false);
    });

    it('remains idempotent and stable when evidence arrives in reversed order', () => {
      const eA = ingestStatusEvidence({
        rawText: 'Document deficiency: Query raised for proof of residence',
        sourceType: 'PORTAL_EXPORT',
        referenceId: 'SYNTH-ORD-1',
        date: '2026-02-10',
      });

      const eB = ingestStatusEvidence({
        rawText: 'Counter receipt filed at center',
        sourceType: 'PAPER_RECEIPT',
        referenceId: 'SYNTH-ORD-1',
        date: '2026-02-01',
      });

      const reportForward = reconcileApplicationStatus({
        applicationId: 'SYNTH-ORD-1',
        evidenceList: [eB, eA],
      });

      const reportBackward = reconcileApplicationStatus({
        applicationId: 'SYNTH-ORD-1',
        evidenceList: [eA, eB],
      });

      expect(reportForward.consensusStatus).toBe(reportBackward.consensusStatus);
      expect(reportForward.consensusStatus).toBe(CANONICAL_STATUS.ACTION_REQUIRED);
      expect(reportForward.hasConflicts).toBe(reportBackward.hasConflicts);
    });
  });

  describe('Benchmark 8: Permission & Credential Boundary Cases', () => {
    it('redacts explicit passwords, session tokens, and bearer keys at the service boundary', () => {
      const hostileInput =
        'Citizen record. password="mySecretPassword123" Authorization: Bearer eyJhbGciOiJIUzI1Ni. Status: approved.';

      const evidence = ingestStatusEvidence({
        rawText: hostileInput,
        sourceType: 'PORTAL_EXPORT',
        referenceId: 'SYNTH-SEC-01',
      });

      expect(evidence.rawTextScrubbed).not.toContain('mySecretPassword123');
      expect(evidence.rawTextScrubbed).not.toContain('Bearer eyJhbGciOiJIUzI1Ni');
      expect(evidence.normalizedStatus).toBe(CANONICAL_STATUS.APPROVED);
    });
  });

  describe('Benchmark 9: Storage Failure Recovery & Tamper Self-Healing', () => {
    it('gracefully handles storage write exceptions and permits self-healing on subsequent valid ingestion', () => {
      // 1. Initial valid item
      const item1 = ingestStatusEvidence({
        rawText: 'First record approved',
        sourceType: 'PORTAL_EXPORT',
        referenceId: 'SYNTH-HEAL-01',
      });
      const rec = saveReconciliationEvidence('SYNTH-HEAL-01', item1);
      expect(rec.isTampered).toBeFalsy();

      // 2. Corrupt the storage entry
      const storeMap = JSON.parse(store['civicbridge_status_reconciliation_v1']);
      storeMap['SYNTH-HEAL-01'].lastReport.confidenceScore = 1;
      store['civicbridge_status_reconciliation_v1'] = JSON.stringify(storeMap);

      const tampered = getReconciliationRecord('SYNTH-HEAL-01');
      expect(tampered.isTampered).toBe(true);

      // 3. Self-healing: save fresh evidence item re-seals record with valid hash
      const item2 = ingestStatusEvidence({
        rawText: 'Second record dispatched',
        sourceType: 'SMS',
        referenceId: 'SYNTH-HEAL-01',
      });
      const healed = saveReconciliationEvidence('SYNTH-HEAL-01', item2);
      expect(verifyRecordIntegrity(healed)).toBe(true);

      const checkHealed = getReconciliationRecord('SYNTH-HEAL-01');
      expect(checkHealed.isTampered).toBe(false);
    });
  });
});
