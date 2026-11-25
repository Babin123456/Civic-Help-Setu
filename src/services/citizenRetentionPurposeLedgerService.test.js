import { describe, it, expect, beforeEach } from 'vitest';
import {
  CIVIC_PURPOSE_REGISTRY,
  getPurposeLedger,
  applyLegalHold,
  releaseLegalHold,
  isLegalHoldActive,
  generateAccessReceipt,
  executePurposeRetentionAction,
  evaluateAndEnforcePurposeRetention,
  verifyReceiptIntegrity,
  getStoredReceipts,
  PURPOSE_LEDGER_STORAGE_KEY,
} from './citizenRetentionPurposeLedgerService.js';

describe('citizenRetentionPurposeLedgerService', () => {
  beforeEach(() => {
    if (globalThis.__mockPrivacyStorage) {
      globalThis.__mockPrivacyStorage.clear();
    }
    if (globalThis.__mockPurposeStorage) {
      globalThis.__mockPurposeStorage.clear();
    }
    if (globalThis.__mockPurposeSessionStorage) {
      globalThis.__mockPurposeSessionStorage.clear();
    }
    if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.clear === 'function') {
      localStorage.clear();
    }
    if (typeof sessionStorage !== 'undefined' && sessionStorage && typeof sessionStorage.clear === 'function') {
      sessionStorage.clear();
    }
  });

  function setTestItem(key, value) {
    if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.setItem === 'function') {
      localStorage.setItem(key, value);
    }
    if (!globalThis.__mockPurposeStorage) {
      globalThis.__mockPurposeStorage = new Map();
    }
    globalThis.__mockPurposeStorage.set(key, String(value));
    if (!globalThis.__mockPrivacyStorage) {
      globalThis.__mockPrivacyStorage = new Map();
    }
    globalThis.__mockPrivacyStorage.set(key, String(value));
  }

  function getTestItem(key) {
    if (globalThis.__mockPurposeStorage && globalThis.__mockPurposeStorage.has(key)) {
      return globalThis.__mockPurposeStorage.get(key);
    }
    if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.getItem === 'function') {
      return localStorage.getItem(key);
    }
    return null;
  }

  it('initializes default purpose ledger with all lawful civic purposes', () => {
    const ledger = getPurposeLedger();
    expect(ledger.length).toBe(Object.keys(CIVIC_PURPOSE_REGISTRY).length);

    const eligibility = ledger.find((e) => e.purposeId === 'CIVIC_ELIGIBILITY_ASSESSMENT');
    expect(eligibility).toBeDefined();
    expect(eligibility.retentionDays).toBe(45);
    expect(eligibility.lawfulBasis).toContain('DPDP Act 2023');
    expect(new Date(eligibility.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('calculates and generates cryptographic access receipt with valid SHA-256 integrity digest', () => {
    setTestItem(
      'civicbridge_eligibility_assessments',
      JSON.stringify([{ id: 'test_assessment_1' }, { id: 'test_assessment_2' }])
    );

    const receipt = generateAccessReceipt('CIVIC_ELIGIBILITY_ASSESSMENT');
    expect(receipt.receiptType).toBe('ACCESS_RECEIPT');
    expect(receipt.recordCount).toBe(2);
    expect(receipt.integrityDigest).toHaveLength(64);

    const verification = verifyReceiptIntegrity(receipt);
    expect(verification.valid).toBe(true);
    expect(verification.digest).toBe(receipt.integrityDigest);
  });

  it('detects tampering in receipt payload', () => {
    const receipt = generateAccessReceipt('CONVERSATIONAL_ASSISTANCE');
    const tampered = { ...receipt, recordCount: 9999 };
    const verification = verifyReceiptIntegrity(tampered);
    expect(verification.valid).toBe(false);
    expect(verification.reason).toBe('DIGEST_MISMATCH');
  });

  it('executes targeted granular deletion and produces valid deletion receipt', () => {
    setTestItem(
      'civicbridge_offline_cache',
      JSON.stringify({ cachedAt: Date.now(), guides: ['guide_1'] })
    );

    const receipt = executePurposeRetentionAction('OFFLINE_RESILIENCE_CACHE');
    expect(receipt.receiptType).toBe('DELETION_RECEIPT');
    expect(receipt.purgedStores).toContain('civicbridge_offline_cache');
    expect(receipt.integrityDigest).toHaveLength(64);

    expect(getTestItem('civicbridge_offline_cache')).toBeNull();

    const receipts = getStoredReceipts();
    expect(receipts.length).toBeGreaterThan(0);
    expect(receipts[0].receiptId).toBe(receipt.receiptId);
  });

  it('enforces legal holds and blocks deletion requests unless explicitly overridden', () => {
    const hold = applyLegalHold({
      purposeId: 'GRIEVANCE_REDRESSAL',
      statutoryReference: 'Consumer Protection / Municipal Grievance Act §4',
      reason: 'Active escalated complaint under statutory ombudsman review',
    });

    expect(isLegalHoldActive('GRIEVANCE_REDRESSAL')).toBe(true);

    expect(() => {
      executePurposeRetentionAction('GRIEVANCE_REDRESSAL');
    }).toThrowError(/Cannot purge data under active statutory legal hold/);

    // Release hold
    releaseLegalHold(hold.holdId);
    expect(isLegalHoldActive('GRIEVANCE_REDRESSAL')).toBe(false);

    // Deletion should now succeed
    expect(() => {
      executePurposeRetentionAction('GRIEVANCE_REDRESSAL');
    }).not.toThrow();
  });

  it('automatically evaluates expired purposes and enforces deletion without affecting unexpired or held scopes', () => {
    const ledger = getPurposeLedger();
    // Simulate expired entry
    const pastDate = new Date(Date.now() - 10000).toISOString();
    ledger[0].expiresAt = pastDate;
    setTestItem(PURPOSE_LEDGER_STORAGE_KEY, JSON.stringify(ledger));

    // Put hold on the second purpose even if expired
    ledger[1].expiresAt = pastDate;
    setTestItem(PURPOSE_LEDGER_STORAGE_KEY, JSON.stringify(ledger));
    applyLegalHold({
      purposeId: ledger[1].purposeId,
      statutoryReference: 'Test Stat',
      reason: 'Test hold',
    });

    const enforcement = evaluateAndEnforcePurposeRetention();
    expect(enforcement.expiredCount).toBe(2);
    expect(enforcement.purgedPurposes.length).toBe(1);
    expect(enforcement.heldPurposes).toContain(ledger[1].purposeId);
  });
});
