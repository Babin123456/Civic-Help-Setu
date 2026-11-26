import { describe, it, expect, beforeEach } from 'vitest';
import {
  createNewBundle,
  getBundle,
  listBundles,
  deleteExistingBundle,
  addEvidenceEntry,
  verifyExistingBundle,
  exportBundleAsJson,
  exportBundleAsMarkdownDossier,
  importBundleArchive,
} from './verifiableEvidenceBundleService.js';

import { clearAllEvidenceData } from './verifiableEvidenceBundleStorage.js';
import { PROVENANCE_TIERS, EVIDENCE_SOURCE_TYPES, INTEGRITY_STATUS } from '../data/verifiableEvidenceBundleContract.js';

describe('verifiableEvidenceBundleService (#1160)', () => {
  const USER_ID = 'test_citizen_priya';

  beforeEach(() => {
    clearAllEvidenceData();
  });

  it('creates and retrieves a new civic complaint evidence bundle', () => {
    const bundle = createNewBundle(
      {
        id: 'GRV-WATER-001',
        title: 'Contaminated Tap Water Supply',
        department: 'Delhi Jal Board',
        officialReferenceNumbers: ['DJB-TKT-9921'],
      },
      USER_ID
    );

    expect(bundle).toBeDefined();
    expect(bundle.bundleId).toMatch(/^VEB-/);
    expect(bundle.complaintTitle).toBe('Contaminated Tap Water Supply');
    expect(bundle.entries).toHaveLength(0);
    expect(bundle.chainState.entryCount).toBe(0);

    const fetched = getBundle(bundle.bundleId, USER_ID);
    expect(fetched).not.toBeNull();
    expect(fetched.bundleId).toBe(bundle.bundleId);

    const list = listBundles(USER_ID);
    expect(list).toHaveLength(1);
  });

  it('appends multiple evidence entries forming a continuous cryptographic chain', async () => {
    const bundle = createNewBundle({ title: 'Illegal Sand Mining Complaint' }, USER_ID);

    // Entry 1: Photo
    const rawPhoto = 'data:image/jpeg;base64,cGhvdG9fYnl0ZXNfZGF0YQ==';
    const res1 = await addEvidenceEntry(
      bundle.bundleId,
      {
        title: 'Truck Encroachment Photograph',
        userAnnotation: 'Trucks operating at riverbank at 2 AM',
        source: EVIDENCE_SOURCE_TYPES.CITIZEN_PHOTO,
        provenanceTier: PROVENANCE_TIERS.CITIZEN_ASSERTION,
        attachment: { fileName: 'trucks.jpg', mimeType: 'image/jpeg' },
      },
      USER_ID,
      rawPhoto
    );

    expect(res1.bundle.entries).toHaveLength(1);
    expect(res1.addedEntry.sequence).toBe(1);
    expect(res1.addedEntry.previousEntryHash).toBe('0'.repeat(64));
    expect(res1.addedEntry.entryHash).toHaveLength(64);
    expect(res1.verification.isValid).toBe(true);

    // Entry 2: Official Fee Receipt
    const rawReceipt = 'data:application/pdf;base64,cmVjZWlwdF9wZGY=';
    const res2 = await addEvidenceEntry(
      bundle.bundleId,
      {
        title: 'RTI Application Fee Challan',
        userAnnotation: '10 INR postal order deposited',
        source: EVIDENCE_SOURCE_TYPES.FEE_RECEIPT,
        provenanceTier: PROVENANCE_TIERS.INDEPENDENT_VERIFICATION,
        attachment: { fileName: 'challan.pdf', mimeType: 'application/pdf' },
      },
      USER_ID,
      rawReceipt
    );

    expect(res2.bundle.entries).toHaveLength(2);
    expect(res2.addedEntry.sequence).toBe(2);
    expect(res2.addedEntry.previousEntryHash).toBe(res1.addedEntry.entryHash);
    expect(res2.verification.isValid).toBe(true);
    expect(res2.bundle.chainState.rootHash).toHaveLength(64);
  });

  it('runs verification and confirms integrity of valid bundle with local files', async () => {
    const bundle = createNewBundle({ title: 'Damaged Drainage System' }, USER_ID);

    await addEvidenceEntry(
      bundle.bundleId,
      {
        title: 'Drainage blockage photo',
        source: EVIDENCE_SOURCE_TYPES.CITIZEN_PHOTO,
        provenanceTier: PROVENANCE_TIERS.CITIZEN_ASSERTION,
      },
      USER_ID,
      'fake_photo_bytes'
    );

    const verification = await verifyExistingBundle(bundle.bundleId, USER_ID);
    expect(verification.isValid).toBe(true);
    expect(verification.status).toBe(INTEGRITY_STATUS.VERIFIED);
    expect(verification.checkedEntriesCount).toBe(1);
    expect(verification.errors).toHaveLength(0);
  });

  it('exports and round-trips bundle as portable JSON archive', async () => {
    const bundle = createNewBundle(
      {
        id: 'GRV-EXP-01',
        title: 'Pothole on Main Market Road',
        department: 'PWD Ward 8',
      },
      USER_ID
    );

    await addEvidenceEntry(
      bundle.bundleId,
      {
        title: 'Pothole Measurement Photo',
        source: EVIDENCE_SOURCE_TYPES.CITIZEN_PHOTO,
        provenanceTier: PROVENANCE_TIERS.CITIZEN_ASSERTION,
        userAnnotation: 'Depth approx 15cm',
      },
      USER_ID,
      'binary_photo_data_123'
    );

    const exported = exportBundleAsJson(bundle.bundleId, USER_ID);
    expect(exported.jsonString).toBeTypeOf('string');
    expect(exported.fileName).toContain('pothole');

    // Import into another user session
    const OTHER_USER = 'officer_verma';
    const importRes = await importBundleArchive(exported.jsonString, OTHER_USER);

    expect(importRes.success).toBe(true);
    expect(importRes.bundle).not.toBeNull();
    expect(importRes.bundle.complaintTitle).toBe('Pothole on Main Market Road');
    expect(importRes.verification.isValid).toBe(true);

    const importedBundle = getBundle(bundle.bundleId, OTHER_USER);
    expect(importedBundle).not.toBeNull();
  });

  it('rejects import of tampered archive with corrupted entry data', async () => {
    const bundle = createNewBundle({ title: 'Tamper Test Complaint' }, USER_ID);
    await addEvidenceEntry(
      bundle.bundleId,
      {
        title: 'Original Receipt',
        source: EVIDENCE_SOURCE_TYPES.FEE_RECEIPT,
        provenanceTier: PROVENANCE_TIERS.INDEPENDENT_VERIFICATION,
      },
      USER_ID,
      'good_receipt_content'
    );

    const exported = exportBundleAsJson(bundle.bundleId, USER_ID);
    const parsed = JSON.parse(exported.jsonString);

    // Tamper attack: modify title in manifest without updating cryptographic hashes
    parsed.manifest.entries[0].title = 'TAMPERED RECEIPT TITLE';

    const tamperedJson = JSON.stringify(parsed);
    const importRes = await importBundleArchive(tamperedJson, 'auditor_user');

    expect(importRes.success).toBe(false);
    expect(importRes.bundle).toBeNull();
    expect(importRes.verification.isValid).toBe(false);
    expect(importRes.verification.status).toBe(INTEGRITY_STATUS.TAMPERED);
  });

  it('exports formatted Markdown dossier with disclaimers and provenance tags', async () => {
    const bundle = createNewBundle(
      {
        id: 'GRV-MD-01',
        title: 'Streetlight Failure in Sector 4',
        department: 'Electricity Distribution Company',
        officialReferenceNumbers: ['DISCOM/2026/771'],
      },
      USER_ID
    );

    await addEvidenceEntry(
      bundle.bundleId,
      {
        title: 'Dark Alley Night Photo',
        userAnnotation: 'Pole #43 not working for 3 weeks',
        source: EVIDENCE_SOURCE_TYPES.CITIZEN_PHOTO,
        provenanceTier: PROVENANCE_TIERS.CITIZEN_ASSERTION,
      },
      USER_ID
    );

    await addEvidenceEntry(
      bundle.bundleId,
      {
        title: 'Customer Care Complaint Token',
        userAnnotation: 'Registered online via helpline',
        source: EVIDENCE_SOURCE_TYPES.PORTAL_ACKNOWLEDGEMENT,
        provenanceTier: PROVENANCE_TIERS.INDEPENDENT_VERIFICATION,
      },
      USER_ID
    );

    const markdown = exportBundleAsMarkdownDossier(bundle.bundleId, USER_ID);
    expect(markdown).toContain('# CIVIC COMPLAINT VERIFIABLE EVIDENCE DOSSIER');
    expect(markdown).toContain('DISCOM/2026/771');
    expect(markdown).toContain('Civic Help Setu Verifiable Evidence Bundles establish mathematical data integrity');
    expect(markdown).toContain('Citizen Assertion (Unverified Claim)');
    expect(markdown).toContain('Independently Verified Record');
    expect(markdown).toContain('Instructions for Formal Redressal:');
  });

  it('safely deletes an existing bundle', () => {
    const bundle = createNewBundle({ title: 'To Be Deleted' }, USER_ID);
    expect(getBundle(bundle.bundleId, USER_ID)).not.toBeNull();

    const deleted = deleteExistingBundle(bundle.bundleId, USER_ID);
    expect(deleted).toBe(true);
    expect(getBundle(bundle.bundleId, USER_ID)).toBeNull();
  });
});
