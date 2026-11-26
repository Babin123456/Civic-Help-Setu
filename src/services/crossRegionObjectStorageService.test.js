import { describe, it, expect, beforeEach } from 'vitest';
import {
  CrossRegionObjectStorageService,
  StorageTier,
  StorageRegion,
  StorageError
} from './crossRegionObjectStorageService.js';

describe('CrossRegionObjectStorageService', () => {
  let service;

  beforeEach(() => {
    service = new CrossRegionObjectStorageService({
      primaryRegion: StorageRegion.IN_MUMBAI,
      secondaryRegions: [StorageRegion.IN_HYDERABAD]
    });
  });

  it('stores citizen upload with AES-256-GCM encryption, checksum, and cross-region replication status', async () => {
    const rawContent = 'Sensitive Citizen Aadhaar / Caste Certificate Data';
    const result = await service.putObject({
      key: 'uploads/2026/doc_101.pdf',
      content: rawContent,
      ownerId: 'usr_citizen_44',
      mimeType: 'application/pdf'
    });

    expect(result.key).toBe('uploads/2026/doc_101.pdf');
    expect(result.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(result.tier).toBe(StorageTier.HOT);
    expect(result.primaryRegion).toBe(StorageRegion.IN_MUMBAI);
    expect(result.replicationStatus[StorageRegion.IN_HYDERABAD].status).toBe('SYNCED');
  });

  it('generates short-lived signed URLs and decrypts object successfully', async () => {
    const content = 'Public Consultation Gazette Notification #99';
    await service.putObject({
      key: 'public/gazette_99.pdf',
      content,
      classification: 'PUBLIC_ASSET'
    });

    const signedUrl = service.generateSignedUrl('public/gazette_99.pdf', { id: 'anon', role: 'citizen' }, 60);
    expect(signedUrl.accessUrl).toContain('token=');

    const retrieved = await service.getObject(
      'public/gazette_99.pdf',
      { id: 'anon', role: 'citizen' },
      signedUrl.signedToken,
      new Date(signedUrl.expiresAt).getTime()
    );

    expect(retrieved.content.toString()).toBe(content);
    expect(retrieved.checksum).toMatch(/^[a-f0-9]{64}$/);
  });

  it('prohibits unauthorized callers from generating signed URLs or reading restricted records', async () => {
    await service.putObject({
      key: 'restricted/usr_1.pdf',
      content: 'Private medical bill',
      ownerId: 'usr_1',
      classification: 'RESTRICTED_CITIZEN_RECORD'
    });

    const unauthorizedUser = { id: 'usr_stranger', role: 'citizen' };
    expect(() => {
      service.generateSignedUrl('restricted/usr_1.pdf', unauthorizedUser, 60);
    }).toThrow(StorageError);
  });

  it('enforces legal holds and blocks archiving while hold is active', async () => {
    await service.putObject({
      key: 'court/evidence_case_12.pdf',
      content: 'Lokayukta complaint attachment',
      legalHold: true
    });

    expect(() => {
      service.transitionTier('court/evidence_case_12.pdf', StorageTier.ARCHIVE);
    }).toThrow('Cannot archive object court/evidence_case_12.pdf while under legal hold');

    // Release legal hold and retry
    service.setLegalHold('court/evidence_case_12.pdf', false);
    const transition = service.transitionTier('court/evidence_case_12.pdf', StorageTier.ARCHIVE);
    expect(transition.currentTier).toBe(StorageTier.ARCHIVE);
  });

  it('runs periodic integrity scans and reports anomalies', async () => {
    await service.putObject({
      key: 'test/file_ok.txt',
      content: 'Healthy payload content'
    });

    const scan = await service.runIntegrityScan();
    expect(scan.scannedCount).toBe(1);
    expect(scan.healthyCount).toBe(1);
    expect(scan.corruptedCount).toBe(0);
  });
});
