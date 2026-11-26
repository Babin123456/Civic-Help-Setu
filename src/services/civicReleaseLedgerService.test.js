import { describe, it, expect, beforeEach } from 'vitest';
import {
  canonicalizeJson,
  validateReleaseManifest,
  validateLedgerEntry,
  RELEASE_PROVENANCE_SCHEMA_VERSION,
  APPROVER_ROLES,
  LEDGER_ENTRY_TYPES,
} from '../data/civicReleaseProvenanceContract.js';
import {
  computeSha256Hex,
  generateSigningKeyPair,
  signData,
  verifySignature,
} from '../services/civicCryptoService.js';
import {
  createReleaseManifest,
  appendReleaseToLedger,
  recordKeyLifecycleEvent,
  verifyLedgerIntegrity,
  initializeSyntheticReleaseLedger,
  getStoredLedger,
  saveStoredLedger,
  getStoredKeyring,
  saveStoredKeyring,
} from '../services/civicReleaseLedgerService.js';

describe('Civic Release Provenance & Tamper-Evident Ledger', () => {
  let activeSigningKey;

  beforeEach(async () => {
    // Clear storage mocks
    saveStoredLedger([]);
    saveStoredKeyring([]);
    activeSigningKey = await generateSigningKeyPair('test-key-dept-01', {
      department: 'Department of Revenue',
    });
    saveStoredKeyring([activeSigningKey]);
  });

  describe('Contract & Canonicalization', () => {
    it('canonicalizeJson ensures deterministic key ordering', () => {
      const objA = { b: 2, a: 1, c: { z: 9, y: 8 } };
      const objB = { a: 1, c: { y: 8, z: 9 }, b: 2 };
      expect(canonicalizeJson(objA)).toBe(canonicalizeJson(objB));
    });

    it('validateReleaseManifest catches invalid or incomplete payloads', () => {
      const emptyErrors = validateReleaseManifest({});
      expect(emptyErrors.length).toBeGreaterThan(0);
      expect(emptyErrors).toContain('manifestId is required and must be a string.');

      const invalidVersion = validateReleaseManifest({
        schemaVersion: '99.0.0',
        manifestId: 'm1',
        guidanceId: 'g1',
        version: '1.0.0',
        publishedAt: 'invalid-date',
        contentDigest: 'not-hex',
        sources: [],
        approvals: [],
      });
      expect(invalidVersion).toContain(`Invalid schemaVersion. Expected "${RELEASE_PROVENANCE_SCHEMA_VERSION}".`);
      expect(invalidVersion).toContain('contentDigest must be a 64-character hex string.');
    });
  });

  describe('Cryptographic Operations', () => {
    it('generates ECDSA P-256 keypair with valid fingerprint', async () => {
      expect(activeSigningKey.keyId).toBe('test-key-dept-01');
      expect(activeSigningKey.fingerprint).toHaveLength(64);
      expect(activeSigningKey.publicKeyJwk.crv).toBe('P-256');
    });

    it('signs and verifies payload correctly', async () => {
      const message = { civicRule: 'Tree cutting prohibited without municipal permit' };
      const hash = await computeSha256Hex(message);
      const signature = await signData(activeSigningKey.privateKeyJwk, hash);
      expect(typeof signature).toBe('string');
      expect(signature.length).toBeGreaterThan(32);

      const isValid = await verifySignature(activeSigningKey.publicKeyJwk, signature, hash);
      expect(isValid).toBe(true);

      const isInvalid = await verifySignature(activeSigningKey.publicKeyJwk, signature, 'tampered-hash');
      expect(isInvalid).toBe(false);
    });
  });

  describe('Release Manifest & Ledger Chain', () => {
    it('creates a cryptographically signed release manifest with source snapshots and human approval', async () => {
      const content = { title: 'Birth Certificate Expedited SLA', fee: 100 };
      const manifest = await createReleaseManifest({
        guidanceId: 'birth-cert-sla',
        version: '1.0.0',
        contentPayload: content,
        sources: [
          {
            sourceId: 'gazette-2026-09',
            sourceUrl: 'https://gazette.gov.in/notif/2026-09.pdf',
            publisher: 'Ministry of Home & Vital Statistics',
            snapshotDigest: 'a'.repeat(64),
          },
        ],
        approvals: [
          {
            reviewerId: 'rev-legal-99',
            role: APPROVER_ROLES.LEGAL_REVIEWER,
            approvedAt: new Date().toISOString(),
          },
        ],
        signingKey: activeSigningKey,
      });

      expect(manifest.manifestId).toContain('rel-birth-cert-sla-v1.0.0');
      expect(manifest.contentDigest).toHaveLength(64);
      expect(manifest.signatureBlock.signatureHex).toBeTruthy();
      expect(manifest.approvals[0].role).toBe(APPROVER_ROLES.LEGAL_REVIEWER);
    });

    it('appends release manifest to ledger and chains block hashes', async () => {
      const manifest = await createReleaseManifest({
        guidanceId: 'water-tanker-sla',
        version: '1.0.0',
        contentPayload: { standardTimeHrs: 24 },
        sources: [
          {
            sourceId: 'water-board-rule-2025',
            sourceUrl: 'https://waterboard.gov.in/rules/tankers.pdf',
            snapshotDigest: 'b'.repeat(64),
          },
        ],
        approvals: [
          {
            reviewerId: 'admin-water-01',
            role: APPROVER_ROLES.DEPARTMENT_ADMIN,
            approvedAt: new Date().toISOString(),
          },
        ],
        signingKey: activeSigningKey,
      });

      const block = await appendReleaseToLedger(manifest, [activeSigningKey]);
      expect(block.index).toBe(1);
      expect(block.entryType).toBe(LEDGER_ENTRY_TYPES.RELEASE);
      expect(block.previousHash).toBeTruthy();
      expect(block.blockHash).toHaveLength(64);

      const integrity = await verifyLedgerIntegrity(null, [activeSigningKey]);
      expect(integrity.isValid).toBe(true);
      expect(integrity.brokenBlocks).toHaveLength(0);
    });

    it('detects tampering in ledger entries or previous hash chain', async () => {
      await initializeSyntheticReleaseLedger();
      const initialIntegrity = await verifyLedgerIntegrity();
      expect(initialIntegrity.isValid).toBe(true);

      const ledger = getStoredLedger();
      // Tamper block 1 content payload
      ledger[1].manifest.contentDigest = '0'.repeat(64);
      saveStoredLedger(ledger);

      const tamperedIntegrity = await verifyLedgerIntegrity();
      expect(tamperedIntegrity.isValid).toBe(false);
      expect(tamperedIntegrity.brokenBlocks.length).toBeGreaterThan(0);
    });

    it('supports key rotation and detects revoked/compromised signing keys', async () => {
      await initializeSyntheticReleaseLedger();
      const newKey = await generateSigningKeyPair('authority-key-dept-rev-2027', {
        department: 'Revenue & Municipal Administration',
      });
      const currentKeyring = getStoredKeyring();
      currentKeyring.push(newKey);
      saveStoredKeyring(currentKeyring);

      // Rotate old key to new key
      const { updatedKey } = await recordKeyLifecycleEvent({
        event: 'ROTATION',
        keyId: 'authority-key-dept-rev-2026',
        reason: 'Scheduled annual cryptographic key rotation',
        newKeyId: newKey.keyId,
        actorId: 'admin-chief-crypto-officer',
      });
      expect(updatedKey.status).toBe('rotated');

      // Revoke an old key as compromised
      await recordKeyLifecycleEvent({
        event: 'REVOCATION',
        keyId: 'authority-key-legal-audit-2026',
        reason: 'Compromised signing hardware token simulation',
        actorId: 'secops-incident-responder',
      });

      const integrity = await verifyLedgerIntegrity();
      // Integrity flags compromised keys used in blocks
      expect(integrity.compromisedKeyBlocks.length).toBeGreaterThan(0);
      expect(integrity.compromisedKeyBlocks[0].keyId).toBe('authority-key-legal-audit-2026');
    });
  });
});
