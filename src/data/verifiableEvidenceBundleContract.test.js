import { describe, it, expect } from 'vitest';
import {
  PROVENANCE_TIERS,
  EVIDENCE_SOURCE_TYPES,
  INTEGRITY_STATUS,
  GENESIS_PREV_HASH,
  canonicalizeJson,
  computeSha256Hex,
  computeEntryHash,
  computeMerkleRoot,
  computeManifestSeal,
  validateBundleEntry,
  validateBundleManifest,
  detectClockSkew,
  detectDuplicateEvidence,
  verifyBundleIntegrity,
  createInitialBundleManifest,
} from './verifiableEvidenceBundleContract.js';

describe('verifiableEvidenceBundleContract (#1160)', () => {
  describe('Canonical JSON & SHA-256 Hashing', () => {
    it('canonicalizes JSON deterministically regardless of key order', () => {
      const objA = { b: 2, a: 1, c: { z: 26, y: 25 } };
      const objB = { a: 1, c: { y: 25, z: 26 }, b: 2 };

      const canonA = canonicalizeJson(objA);
      const canonB = canonicalizeJson(objB);

      expect(canonA).toBe(canonB);
      expect(canonA).toBe('{"a":1,"b":2,"c":{"y":25,"z":26}}');
    });

    it('computes correct SHA-256 hexadecimal digests', async () => {
      const digest = await computeSha256Hex('hello world');
      expect(digest).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
    });

    it('computes consistent entry hashes from canonical payload', async () => {
      const entry = {
        sequence: 1,
        entryId: 'ENT-001',
        timestamp: '2026-11-20T10:00:00.000Z',
        source: EVIDENCE_SOURCE_TYPES.CITIZEN_PHOTO,
        provenanceTier: PROVENANCE_TIERS.CITIZEN_ASSERTION,
        title: 'Water Leakage Photo',
        userAnnotation: 'Severe leakage observed near main pipeline',
        attachment: {
          fileName: 'pipe_leak.jpg',
          mimeType: 'image/jpeg',
          byteSize: 1024,
          sha256: 'a'.repeat(64),
        },
        metadata: { ward: 14 },
        previousEntryHash: GENESIS_PREV_HASH,
      };

      const hash1 = await computeEntryHash(entry);
      const hash2 = await computeEntryHash({ ...entry, entryHash: 'ignore_me_dynamic' });
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Merkle Root Computation', () => {
    it('returns genesis hash for empty array', async () => {
      const root = await computeMerkleRoot([]);
      expect(root).toBe(GENESIS_PREV_HASH);
    });

    it('returns sole hash when single element provided', async () => {
      const single = 'b'.repeat(64);
      const root = await computeMerkleRoot([single]);
      expect(root).toBe(single);
    });

    it('computes balanced binary Merkle tree root for multiple hashes', async () => {
      const h1 = '1'.repeat(64);
      const h2 = '2'.repeat(64);
      const h3 = '3'.repeat(64);

      const root = await computeMerkleRoot([h1, h2, h3]);
      expect(root).toHaveLength(64);
      expect(root).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Validation & Boundary Rules', () => {
    it('validates a correct bundle entry', () => {
      const entry = {
        sequence: 1,
        entryId: 'ENT-001',
        timestamp: '2026-11-20T10:00:00.000Z',
        source: EVIDENCE_SOURCE_TYPES.FEE_RECEIPT,
        provenanceTier: PROVENANCE_TIERS.INDEPENDENT_VERIFICATION,
        title: 'Municipal Challan Receipt',
        userAnnotation: 'Paid 250 INR processing fee',
        attachment: {
          fileName: 'challan_250.pdf',
          byteSize: 2048,
          sha256: 'c'.repeat(64),
        },
        previousEntryHash: GENESIS_PREV_HASH,
      };

      const res = validateBundleEntry(entry);
      expect(res.isValid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it('rejects an invalid entry with multiple errors', () => {
      const entry = {
        sequence: -1,
        entryId: '',
        timestamp: 'invalid-date',
        source: 'INVALID_SOURCE',
        provenanceTier: 'INVALID_TIER',
        title: '',
        attachment: {
          fileName: '',
          byteSize: -50,
          sha256: 'short-hash',
        },
        previousEntryHash: 'not-64-hex',
      };

      const res = validateBundleEntry(entry);
      expect(res.isValid).toBe(false);
      expect(res.errors.length).toBeGreaterThanOrEqual(7);
    });

    it('validates manifest schema limits and structure', () => {
      const manifest = createInitialBundleManifest({
        id: 'GRV-1234',
        title: 'Road Pothole Hazard',
        department: 'PWD Ward 12',
      });

      const res = validateBundleManifest(manifest);
      expect(res.isValid).toBe(true);
    });
  });

  describe('Clock Skew & Duplicate Detection', () => {
    it('detects future-dated timestamps exceeding tolerance window', () => {
      const entries = [
        {
          sequence: 1,
          entryId: 'ENT-1',
          timestamp: '2026-11-25T12:01:00.000Z', // within 5 min tolerance
        },
        {
          sequence: 2,
          entryId: 'ENT-2',
          timestamp: '2026-11-25T13:30:00.000Z', // 90 min future
        },
      ];

      const warnings = detectClockSkew(entries, {
        referenceTime: '2026-11-25T12:00:00.000Z',
        clockSkewToleranceMs: 5 * 60 * 1000,
      });

      expect(warnings).toHaveLength(1);
      expect(warnings[0].code).toBe('FUTURE_TIMESTAMP_DETECTED');
      expect(warnings[0].sequence).toBe(2);
    });

    it('detects retrograde chronological regressions', () => {
      const entries = [
        { sequence: 1, entryId: 'ENT-1', timestamp: '2026-11-20T10:00:00.000Z' },
        { sequence: 2, entryId: 'ENT-2', timestamp: '2026-11-19T08:00:00.000Z' }, // backward in time
      ];

      const warnings = detectClockSkew(entries);
      expect(warnings.some((w) => w.code === 'CHRONOLOGICAL_REGRESSION')).toBe(true);
    });

    it('detects duplicate attachments across entries', () => {
      const entries = [
        {
          sequence: 1,
          entryId: 'ENT-1',
          attachment: { fileName: 'photo1.jpg', sha256: 'd'.repeat(64) },
        },
        {
          sequence: 2,
          entryId: 'ENT-2',
          attachment: { fileName: 'photo1_copy.jpg', sha256: 'd'.repeat(64) },
        },
      ];

      const duplicates = detectDuplicateEvidence(entries);
      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].code).toBe('DUPLICATE_ATTACHMENT');
      expect(duplicates[0].duplicateOfSequence).toBe(1);
    });
  });

  describe('End-to-End Cryptographic Chain Verification', () => {
    it('verifies a valid append-only manifest with 2 chained entries', async () => {
      const manifest = createInitialBundleManifest({
        id: 'GRV-TEST-01',
        title: 'Sewage Overflow Complaint',
        department: 'Water & Sewage Board',
      });

      // Entry 1
      const entry1Data = {
        sequence: 1,
        entryId: 'ENT-001',
        timestamp: '2026-11-20T10:00:00.000Z',
        source: EVIDENCE_SOURCE_TYPES.CITIZEN_PHOTO,
        provenanceTier: PROVENANCE_TIERS.CITIZEN_ASSERTION,
        title: 'Initial Overflow Photo',
        userAnnotation: 'Road flooded with blackwater',
        attachment: {
          fileName: 'overflow.jpg',
          mimeType: 'image/jpeg',
          byteSize: 100,
          sha256: await computeSha256Hex('overflow_photo_binary_content'),
        },
        previousEntryHash: GENESIS_PREV_HASH,
      };
      const hash1 = await computeEntryHash(entry1Data);
      const entry1 = { ...entry1Data, entryHash: hash1 };

      // Entry 2 (chains to Entry 1)
      const entry2Data = {
        sequence: 2,
        entryId: 'ENT-002',
        timestamp: '2026-11-21T11:00:00.000Z',
        source: EVIDENCE_SOURCE_TYPES.PORTAL_ACKNOWLEDGEMENT,
        provenanceTier: PROVENANCE_TIERS.INDEPENDENT_VERIFICATION,
        title: 'Portal Acknowledgment Slip',
        userAnnotation: 'Token CPGRAMS/2026/09812 issued',
        attachment: {
          fileName: 'token_ack.pdf',
          mimeType: 'application/pdf',
          byteSize: 200,
          sha256: await computeSha256Hex('ack_pdf_binary_content'),
        },
        previousEntryHash: hash1,
      };
      const hash2 = await computeEntryHash(entry2Data);
      const entry2 = { ...entry2Data, entryHash: hash2 };

      const merkleRoot = await computeMerkleRoot([hash1, hash2]);

      manifest.entries = [entry1, entry2];
      manifest.chainState = {
        entryCount: 2,
        rootHash: merkleRoot,
        latestEntryHash: hash2,
      };
      manifest.chainState.manifestSeal = await computeManifestSeal(manifest);

      // Verify with raw file bytes
      const rawFiles = {
        'ENT-001': 'overflow_photo_binary_content',
        'ENT-002': 'ack_pdf_binary_content',
      };

      const result = await verifyBundleIntegrity(manifest, rawFiles);
      expect(result.isValid).toBe(true);
      expect(result.status).toBe(INTEGRITY_STATUS.VERIFIED);
      expect(result.errors).toHaveLength(0);
      expect(result.checkedEntriesCount).toBe(2);
    });

    it('detects tampered entry annotation', async () => {
      const manifest = createInitialBundleManifest({ id: 'GRV-TAMPER-01' });

      const entry1Data = {
        sequence: 1,
        entryId: 'ENT-001',
        timestamp: '2026-11-20T10:00:00.000Z',
        source: EVIDENCE_SOURCE_TYPES.CITIZEN_PHOTO,
        provenanceTier: PROVENANCE_TIERS.CITIZEN_ASSERTION,
        title: 'Original Title',
        userAnnotation: 'Original text',
        attachment: null,
        previousEntryHash: GENESIS_PREV_HASH,
      };
      const hash1 = await computeEntryHash(entry1Data);
      const entry1 = { ...entry1Data, entryHash: hash1 };

      manifest.entries = [entry1];
      manifest.chainState = {
        entryCount: 1,
        rootHash: hash1,
        latestEntryHash: hash1,
      };
      manifest.chainState.manifestSeal = await computeManifestSeal(manifest);

      // Tampering attack: someone mutates userAnnotation directly in entry
      entry1.userAnnotation = 'TAMPERED: Altered claims after signing';

      const result = await verifyBundleIntegrity(manifest);
      expect(result.isValid).toBe(false);
      expect(result.status).toBe(INTEGRITY_STATUS.TAMPERED);
      expect(result.errors.some((e) => e.includes('Entry hash mismatch'))).toBe(true);
    });

    it('detects swapped/replaced attachment file bytes', async () => {
      const fileContentOriginal = 'valid_original_receipt_bytes';
      const fileContentTampered = 'MALICIOUS_REPLACED_DOCUMENT';

      const manifest = createInitialBundleManifest({ id: 'GRV-TAMPER-02' });
      const originalSha256 = await computeSha256Hex(fileContentOriginal);

      const entry1Data = {
        sequence: 1,
        entryId: 'ENT-001',
        timestamp: '2026-11-20T10:00:00.000Z',
        source: EVIDENCE_SOURCE_TYPES.FEE_RECEIPT,
        provenanceTier: PROVENANCE_TIERS.INDEPENDENT_VERIFICATION,
        title: 'Challan',
        userAnnotation: 'Challan copy',
        attachment: {
          fileName: 'receipt.pdf',
          byteSize: fileContentOriginal.length,
          sha256: originalSha256,
        },
        previousEntryHash: GENESIS_PREV_HASH,
      };
      const hash1 = await computeEntryHash(entry1Data);
      const entry1 = { ...entry1Data, entryHash: hash1 };

      manifest.entries = [entry1];
      manifest.chainState = {
        entryCount: 1,
        rootHash: hash1,
        latestEntryHash: hash1,
      };
      manifest.chainState.manifestSeal = await computeManifestSeal(manifest);

      // Pass tampered raw file
      const rawFiles = {
        'ENT-001': fileContentTampered,
      };

      const result = await verifyBundleIntegrity(manifest, rawFiles);
      expect(result.isValid).toBe(false);
      expect(result.status).toBe(INTEGRITY_STATUS.TAMPERED);
      expect(result.errors.some((e) => e.includes('Attachment byte corruption'))).toBe(true);
    });

    it('detects a broken chain when an entry is deleted or reordered', async () => {
      const manifest = createInitialBundleManifest({ id: 'GRV-CHAIN-01' });

      // Create two entries properly chained
      const e1Data = {
        sequence: 1,
        entryId: 'ENT-001',
        timestamp: '2026-11-20T10:00:00.000Z',
        source: EVIDENCE_SOURCE_TYPES.CITIZEN_PHOTO,
        provenanceTier: PROVENANCE_TIERS.CITIZEN_ASSERTION,
        title: 'E1',
        previousEntryHash: GENESIS_PREV_HASH,
      };
      const h1 = await computeEntryHash(e1Data);

      const e2Data = {
        sequence: 2,
        entryId: 'ENT-002',
        timestamp: '2026-11-21T10:00:00.000Z',
        source: EVIDENCE_SOURCE_TYPES.CITIZEN_PHOTO,
        provenanceTier: PROVENANCE_TIERS.CITIZEN_ASSERTION,
        title: 'E2',
        previousEntryHash: h1,
      };
      const h2 = await computeEntryHash(e2Data);
      const e2 = { ...e2Data, entryHash: h2 };

      // Adversary removes E1 and puts E2 as first entry
      manifest.entries = [e2];
      manifest.chainState = {
        entryCount: 1,
        rootHash: h2,
        latestEntryHash: h2,
      };

      const result = await verifyBundleIntegrity(manifest);
      expect(result.isValid).toBe(false);
      expect(result.status).toBe(INTEGRITY_STATUS.BROKEN_CHAIN);
      expect(result.errors.some((e) => e.includes('Sequence mismatch'))).toBe(true);
    });
  });
});
