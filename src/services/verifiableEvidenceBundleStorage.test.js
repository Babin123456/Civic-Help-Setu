import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadAllBundles,
  saveBundle,
  getBundleById,
  deleteBundle,
  storeAttachmentFile,
  getAttachmentFile,
  deleteAttachmentFile,
  recordAuditVerification,
  getAuditVerifications,
  clearAllEvidenceData,
} from './verifiableEvidenceBundleStorage.js';

describe('verifiableEvidenceBundleStorage (#1160)', () => {
  beforeEach(() => {
    clearAllEvidenceData();
  });

  it('saves, loads, and filters bundles by user scoping', () => {
    const bundleUser1 = {
      bundleId: 'VEB-001',
      complaintId: 'GRV-001',
      complaintTitle: 'Road Defect',
    };
    const bundleUser2 = {
      bundleId: 'VEB-002',
      complaintId: 'GRV-002',
      complaintTitle: 'Water Shortage',
    };

    saveBundle(bundleUser1, 'citizen_asha');
    saveBundle(bundleUser2, 'citizen_ramesh');

    const ashaBundles = loadAllBundles('citizen_asha');
    expect(ashaBundles).toHaveLength(1);
    expect(ashaBundles[0].bundleId).toBe('VEB-001');

    const rameshBundles = loadAllBundles('citizen_ramesh');
    expect(rameshBundles).toHaveLength(1);
    expect(rameshBundles[0].bundleId).toBe('VEB-002');

    // Cross-user retrieval returns null
    const crossFetch = getBundleById('VEB-001', 'citizen_ramesh');
    expect(crossFetch).toBeNull();
  });

  it('stores and retrieves raw attachment payloads', () => {
    const filePayload = 'data:image/jpeg;base64,ZmFrZV9pbWFnZV9ieXRlcw==';
    const entryId = 'ENT-TEST-FILE-01';

    const stored = storeAttachmentFile(entryId, filePayload);
    expect(stored).toBe(true);

    const retrieved = getAttachmentFile(entryId);
    expect(retrieved).toBe(filePayload);

    const deleted = deleteAttachmentFile(entryId);
    expect(deleted).toBe(true);
    expect(getAttachmentFile(entryId)).toBeNull();
  });

  it('deleting a bundle removes associated attachment files', () => {
    const entryId = 'ENT-FILE-CASCADE';
    storeAttachmentFile(entryId, 'sample_bytes');

    const bundle = {
      bundleId: 'VEB-CASCADE-01',
      complaintId: 'GRV-003',
      entries: [{ entryId }],
    };

    saveBundle(bundle, 'citizen_asha');
    expect(getAttachmentFile(entryId)).toBe('sample_bytes');

    const deleted = deleteBundle('VEB-CASCADE-01', 'citizen_asha');
    expect(deleted).toBe(true);

    expect(getBundleById('VEB-CASCADE-01', 'citizen_asha')).toBeNull();
    expect(getAttachmentFile(entryId)).toBeNull();
  });

  it('records and retrieves verification audit records with bounds', () => {
    const bundleId = 'VEB-AUDIT-01';
    const verificationResult = {
      status: 'VERIFIED',
      isValid: true,
      checkedEntriesCount: 3,
      errors: [],
      warnings: [],
      verifiedAt: '2026-11-25T14:00:00.000Z',
    };

    recordAuditVerification(bundleId, verificationResult);
    const audits = getAuditVerifications(bundleId);

    expect(audits).toHaveLength(1);
    expect(audits[0].bundleId).toBe(bundleId);
    expect(audits[0].status).toBe('VERIFIED');
    expect(audits[0].isValid).toBe(true);
  });
});
