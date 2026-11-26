import { describe, it, expect, beforeEach } from 'vitest';
import {
  CivicAuthorityKeyRegistry,
  computeKeyFingerprint,
  KEY_STATUS
} from './civicAuthorityKeyRegistryService.js';

describe('civicAuthorityKeyRegistryService', () => {
  describe('computeKeyFingerprint', () => {
    it('computes deterministic key fingerprint prefixed with fp_', () => {
      const pem = '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A\n-----END PUBLIC KEY-----';
      const fp1 = computeKeyFingerprint(pem);
      const fp2 = computeKeyFingerprint(pem);

      expect(fp1).toBe(fp2);
      expect(fp1).toMatch(/^fp_[a-f0-9]{8}$/);
    });

    it('returns default invalid fingerprint for empty input', () => {
      expect(computeKeyFingerprint('')).toBe('fp_invalid');
    });
  });

  describe('CivicAuthorityKeyRegistry', () => {
    let registry;
    const mockPem = 'MOCK_PUBLIC_KEY_PEM_DATA';

    beforeEach(() => {
      registry = new CivicAuthorityKeyRegistry();
    });

    it('registers an authority key and computes fingerprint', () => {
      const record = registry.registerAuthorityKey({
        authorityId: 'dept-food-civil-supplies',
        authorityName: 'Karnataka Food & Civil Supplies',
        publicKeyPem: mockPem
      });

      expect(record.authorityId).toBe('dept-food-civil-supplies');
      expect(record.keyFingerprint).toMatch(/^fp_/);
      expect(record.revoked).toBe(false);
    });

    it('successfully verifies a valid notice signature and attaches legal disclaimer', () => {
      const reg = registry.registerAuthorityKey({
        authorityId: 'bbmp',
        authorityName: 'Bruhat Bengaluru Mahanagara Palike',
        publicKeyPem: mockPem,
        validFrom: 1700000000000,
        validTo: 1800000000000
      });

      const result = registry.verifyNoticeSignature({
        authorityId: 'bbmp',
        keyFingerprint: reg.keyFingerprint,
        documentHash: 'sha256_1234567890abcdef',
        signatureHex: 'sig_valid_hex_1234'
      }, 1750000000000);

      expect(result.verified).toBe(true);
      expect(result.status).toBe(KEY_STATUS.ACTIVE);
      expect(result.legalNotice).toContain('SIGNATURE AUTHENTICATED');
      expect(result.legalNotice).toContain('does NOT guarantee the notice is legally current');
    });

    it('rejects verification if key is revoked', () => {
      const reg = registry.registerAuthorityKey({
        authorityId: 'revenue-dept',
        publicKeyPem: mockPem
      });

      registry.revokeKey('revenue-dept', reg.keyFingerprint, 'Emergency key compromise');

      const result = registry.verifyNoticeSignature({
        authorityId: 'revenue-dept',
        keyFingerprint: reg.keyFingerprint,
        documentHash: 'sha256_hash',
        signatureHex: 'sig_hex_1234'
      });

      expect(result.verified).toBe(false);
      expect(result.status).toBe(KEY_STATUS.REVOKED);
      expect(result.reason).toContain('Emergency key compromise');
    });

    it('rejects verification if key is expired', () => {
      const reg = registry.registerAuthorityKey({
        authorityId: 'bbmp',
        publicKeyPem: mockPem,
        validFrom: 1600000000000,
        validTo: 1650000000000 // Expired
      });

      const result = registry.verifyNoticeSignature({
        authorityId: 'bbmp',
        keyFingerprint: reg.keyFingerprint,
        documentHash: 'sha256_hash',
        signatureHex: 'sig_hex_1234'
      }, 1700000000000); // Evaluated in the future

      expect(result.verified).toBe(false);
      expect(result.status).toBe(KEY_STATUS.EXPIRED);
    });
  });
});
