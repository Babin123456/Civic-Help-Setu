import { describe, it, expect, beforeEach } from 'vitest';
import {
  verifyStoreRegistryCoverage,
  calculatePayloadBytes,
  validateRecordPayload,
  auditLocalStorageSyncReadiness,
} from './cloudRecordSyncVerificationService';
import { MAX_RECORD_BYTES } from './cloudRecords';

describe('cloudRecordSyncVerificationService (#428)', () => {
  let mockStorage = {};

  beforeEach(() => {
    mockStorage = {};
  });

  it('confirms that 100% of privacy registry stores are classified without gaps or duplicates', () => {
    const coverage = verifyStoreRegistryCoverage();
    expect(coverage.isValid).toBe(true);
    expect(coverage.hasDuplicates).toBe(false);
    expect(coverage.unclassifiedKeys).toHaveLength(0);
    expect(coverage.obsoleteKeys).toHaveLength(0);
    expect(coverage.cloudStoresCount).toBeGreaterThan(15);
    expect(coverage.deviceOnlyStoresCount).toBeGreaterThan(5);
  });

  it('accurately computes payload byte sizes for strings and structured objects', () => {
    expect(calculatePayloadBytes(null)).toBe(0);
    expect(calculatePayloadBytes('test')).toBe(6); // JSON.stringify('"test"') has 6 chars
    expect(calculatePayloadBytes({ a: 1 })).toBe(7); // '{"a":1}' has 7 bytes
  });

  it('validates record payload against kind and size limits', () => {
    // Valid list store
    const validList = validateRecordPayload('civicbridge_applications', [
      { id: 'APP-101', serviceName: 'Income Certificate' },
    ]);
    expect(validList.isValid).toBe(true);
    expect(validList.isCloudEligible).toBe(true);
    expect(validList.storeKind).toBe('list');

    // Invalid list store (non-array passed)
    const invalidList = validateRecordPayload('civicbridge_applications', { id: 'APP-101' });
    expect(invalidList.isValid).toBe(false);
    expect(invalidList.reason).toContain('configured as \'list\'');

    // Device-only store rejection
    const deviceOnly = validateRecordPayload('civicbridge_vault_pin', '1234');
    expect(deviceOnly.isValid).toBe(false);
    expect(deviceOnly.isCloudEligible).toBe(false);
    expect(deviceOnly.reason).toContain('device-only');
  });

  it('rejects oversized payloads exceeding the maximum record limit', () => {
    // Large payload exceeding 900 KiB
    const oversizedString = 'x'.repeat(MAX_RECORD_BYTES + 1024);
    const result = validateRecordPayload('civic_compared_services', { large: oversizedString });
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('exceeds the maximum allowed limit');
  });

  it('audits local storage readiness across all cloud stores', () => {
    const fakeStorage = {
      getItem: (key) => mockStorage[key] ?? null,
      setItem: (key, val) => {
        mockStorage[key] = String(val);
      },
    };

    fakeStorage.setItem('civicbridge_saved', JSON.stringify(['srv-1', 'srv-2']));
    fakeStorage.setItem('civicbridge_applications', JSON.stringify([{ id: 'APP-1' }]));

    const audit = auditLocalStorageSyncReadiness(fakeStorage);
    expect(audit.isReady).toBe(true);
    expect(audit.activeStoresCount).toBe(2);
    expect(audit.totalStagedBytes).toBeGreaterThan(10);
    expect(audit.errors).toHaveLength(0);
  });
});
