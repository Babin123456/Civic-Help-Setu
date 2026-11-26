import { describe, it, expect, beforeEach } from 'vitest';
import {
  CivicCatalogueReleaseManifestService,
  computeCatalogueItemDigest,
  deriveCatalogueMerkleRoot
} from './civicCatalogueReleaseManifestService.js';

describe('civicCatalogueReleaseManifestService', () => {
  const mockServices = [
    { id: 'ration-card', name: 'Ration Card Scheme', category: 'Food & Supplies', checksum: 'sha_rc_1' },
    { id: 'voter-id', name: 'Voter Registration', category: 'Elections', checksum: 'sha_vt_2' },
    { id: 'pension', name: 'Disability Pension', category: 'Social Welfare', checksum: 'sha_pn_3' }
  ];

  describe('computeCatalogueItemDigest & deriveCatalogueMerkleRoot', () => {
    it('computes deterministic leaf hash and Merkle root regardless of order', () => {
      const h1 = computeCatalogueItemDigest(mockServices[0]);
      const h2 = computeCatalogueItemDigest(mockServices[0]);
      expect(h1).toBe(h2);
      expect(h1).toMatch(/^leaf_[a-f0-9]{8}$/);

      const leavesA = mockServices.map(computeCatalogueItemDigest);
      const leavesB = [...mockServices].reverse().map(computeCatalogueItemDigest);

      const rootA = deriveCatalogueMerkleRoot(leavesA);
      const rootB = deriveCatalogueMerkleRoot(leavesB);
      expect(rootA).toBe(rootB);
      expect(rootA).toMatch(/^catroot_[a-f0-9]{8}$/);
    });
  });

  describe('CivicCatalogueReleaseManifestService', () => {
    let service;

    beforeEach(() => {
      service = new CivicCatalogueReleaseManifestService();
    });

    it('generates canonical release manifest with Merkle root', () => {
      const manifest = service.generateReleaseManifest({
        versionTag: 'catalogue-2026.11',
        items: mockServices
      });

      expect(manifest.versionTag).toBe('catalogue-2026.11');
      expect(manifest.totalServices).toBe(3);
      expect(manifest.merkleRoot).toMatch(/^catroot_/);
      expect(manifest.entries.length).toBe(3);
    });

    it('successfully verifies genuine untampered catalogue snapshot', () => {
      service.generateReleaseManifest({
        versionTag: 'v1.0',
        items: mockServices
      });

      const verification = service.verifyCatalogueSnapshot('v1.0', mockServices);
      expect(verification.verified).toBe(true);
      expect(verification.proof).toContain('matches canonical release manifest');
    });

    it('detects tampering when service names or attributes are altered', () => {
      service.generateReleaseManifest({
        versionTag: 'v1.0',
        items: mockServices
      });

      const tampered = [
        mockServices[0],
        { ...mockServices[1], name: 'Tampered Voter Name' },
        mockServices[2]
      ];

      const verification = service.verifyCatalogueSnapshot('v1.0', tampered);
      expect(verification.verified).toBe(false);
      expect(verification.reason).toContain('Merkle root mismatch');
    });

    it('detects missing or extraneous services in snapshot', () => {
      service.generateReleaseManifest({
        versionTag: 'v1.0',
        items: mockServices
      });

      const incomplete = [mockServices[0], mockServices[1]]; // Only 2 items
      const verification = service.verifyCatalogueSnapshot('v1.0', incomplete);
      expect(verification.verified).toBe(false);
      expect(verification.reason).toContain('Service count mismatch');
    });
  });
});
