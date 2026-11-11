import { describe, it, expect } from 'vitest';
import {
  VAULT_CRYPTO_FORMAT,
  VAULT_CRYPTO_VERSION,
  VAULT_CRYPTO_ERROR_CODE,
  VaultCryptoError,
  validateVaultPassphrase,
  isEncryptedVaultEnvelope,
  encryptVaultPayload,
  decryptVaultPayload,
  rotateEncryptedEnvelope,
} from './vaultCryptoService';

const STRONG_PASS = 'CivicBridge#Vault2026!';
const ALT_PASS = 'NewPassphrase$2026!';

describe('vaultCryptoService', () => {
  describe('validateVaultPassphrase', () => {
    it('rejects empty, whitespace-only, and short passphrases', () => {
      expect(validateVaultPassphrase('')).toMatchObject({ valid: false });
      expect(validateVaultPassphrase('        ')).toMatchObject({ valid: false });
      expect(validateVaultPassphrase('short7')).toMatchObject({ valid: false });
      expect(validateVaultPassphrase(null)).toMatchObject({ valid: false });
    });

    it('accepts valid passphrases and scores complexity', () => {
      expect(validateVaultPassphrase('simplepass')).toMatchObject({ valid: true, strength: 'moderate' });
      expect(validateVaultPassphrase('SimplePass1')).toMatchObject({ valid: true, strength: 'fair' });
      expect(validateVaultPassphrase(STRONG_PASS)).toMatchObject({ valid: true, strength: 'strong' });
    });
  });

  describe('encryptVaultPayload & decryptVaultPayload', () => {
    it('encrypts and decrypts structured civic vault payloads including unicode', async () => {
      const sample = {
        app: 'CivicBridge Vault',
        documents: [
          { id: 'doc-1', type: 'Aadhaar Card — आधार', number: 'XXXX 1234', verified: true },
          { id: 'doc-2', type: 'PAN Card', number: 'XXXX 234F', notes: 'Income tax & KYC' },
        ],
      };

      const envelope = await encryptVaultPayload(sample, STRONG_PASS);
      expect(isEncryptedVaultEnvelope(envelope)).toBe(true);
      expect(envelope.format).toBe(VAULT_CRYPTO_FORMAT);
      expect(envelope.version).toBe(VAULT_CRYPTO_VERSION);
      expect(envelope.kdf.algorithm).toBe('PBKDF2');
      expect(envelope.kdf.hash).toBe('SHA-256');
      expect(envelope.cipher.algorithm).toBe('AES-GCM');
      expect(envelope.cipher.keyLength).toBe(256);

      // Plaintext document identifiers must not leak into ciphertext JSON
      const serialized = JSON.stringify(envelope);
      expect(serialized).not.toContain('Aadhaar');
      expect(serialized).not.toContain('XXXX 1234');
      expect(serialized).not.toContain(STRONG_PASS);

      const decrypted = await decryptVaultPayload(serialized, STRONG_PASS);
      expect(decrypted).toEqual(sample);
    });

    it('produces distinct random salts, IVs, and ciphertexts for identical payloads', async () => {
      const payload = { documents: [{ id: 'd1', number: 'XXXX 9999' }] };
      const first = await encryptVaultPayload(payload, STRONG_PASS);
      const second = await encryptVaultPayload(payload, STRONG_PASS);

      expect(first.kdf.salt).not.toBe(second.kdf.salt);
      expect(first.cipher.iv).not.toBe(second.cipher.iv);
      expect(first.ciphertext).not.toBe(second.ciphertext);
    });

    it('rejects an incorrect passphrase cleanly', async () => {
      const envelope = await encryptVaultPayload({ documents: [{ id: 'd1' }] }, STRONG_PASS);

      await expect(decryptVaultPayload(envelope, 'WrongPassphrase123!')).rejects.toMatchObject({
        name: 'VaultCryptoError',
        code: VAULT_CRYPTO_ERROR_CODE.WRONG_PASSPHRASE_OR_TAMPERED,
      });
    });

    it('rejects tampered ciphertext, tampered IV, and tampered KDF iterations via AAD', async () => {
      const envelope = await encryptVaultPayload({ documents: [{ id: 'd1' }] }, STRONG_PASS);

      // Flip characters in ciphertext
      const badCiphertext = {
        ...envelope,
        ciphertext: `${envelope.ciphertext.slice(0, -4)}AAAA`,
      };
      await expect(decryptVaultPayload(badCiphertext, STRONG_PASS)).rejects.toBeInstanceOf(VaultCryptoError);

      // Tamper KDF iterations (bound in AAD)
      const badIterations = {
        ...envelope,
        kdf: { ...envelope.kdf, iterations: envelope.kdf.iterations + 1 },
      };
      await expect(decryptVaultPayload(badIterations, STRONG_PASS)).rejects.toMatchObject({
        code: VAULT_CRYPTO_ERROR_CODE.WRONG_PASSPHRASE_OR_TAMPERED,
      });

      // Tamper IV
      const bytes = Uint8Array.from(atob(envelope.cipher.iv), (c) => c.charCodeAt(0));
      bytes[0] ^= 0xff;
      const badIv = {
        ...envelope,
        cipher: { ...envelope.cipher, iv: btoa(String.fromCharCode(...bytes)) },
      };
      await expect(decryptVaultPayload(badIv, STRONG_PASS)).rejects.toMatchObject({
        code: VAULT_CRYPTO_ERROR_CODE.WRONG_PASSPHRASE_OR_TAMPERED,
      });
    });

    it('rejects malformed envelopes and unsupported versions', async () => {
      expect(isEncryptedVaultEnvelope(null)).toBe(false);
      expect(isEncryptedVaultEnvelope('not json')).toBe(false);
      expect(isEncryptedVaultEnvelope({ documents: [] })).toBe(false);

      await expect(decryptVaultPayload({ documents: [] }, STRONG_PASS)).rejects.toMatchObject({
        code: VAULT_CRYPTO_ERROR_CODE.INVALID_ENVELOPE,
      });

      const envelope = await encryptVaultPayload({ ok: true }, STRONG_PASS);
      await expect(decryptVaultPayload({ ...envelope, version: 99 }, STRONG_PASS)).rejects.toMatchObject({
        code: VAULT_CRYPTO_ERROR_CODE.UNSUPPORTED_VERSION,
      });
    });
  });

  describe('rotateEncryptedEnvelope', () => {
    it('re-encrypts payload with new passphrase, salt, and IV while invalidating old passphrase', async () => {
      const originalData = { documents: [{ id: 'doc-99', type: 'Passport', number: 'XXXX 4567' }] };
      const initial = await encryptVaultPayload(originalData, STRONG_PASS);

      const rotated = await rotateEncryptedEnvelope(initial, STRONG_PASS, ALT_PASS);
      expect(rotated.kdf.salt).not.toBe(initial.kdf.salt);
      expect(rotated.cipher.iv).not.toBe(initial.cipher.iv);

      await expect(decryptVaultPayload(rotated, STRONG_PASS)).rejects.toMatchObject({
        code: VAULT_CRYPTO_ERROR_CODE.WRONG_PASSPHRASE_OR_TAMPERED,
      });

      const decrypted = await decryptVaultPayload(rotated, ALT_PASS);
      expect(decrypted).toEqual(originalData);
    });

    it('fails rotation when current passphrase is wrong or new passphrase is weak', async () => {
      const initial = await encryptVaultPayload({ ok: true }, STRONG_PASS);

      await expect(rotateEncryptedEnvelope(initial, STRONG_PASS, 'short')).rejects.toMatchObject({
        code: VAULT_CRYPTO_ERROR_CODE.WEAK_PASSPHRASE,
      });

      await expect(rotateEncryptedEnvelope(initial, 'WrongCurrent123!', ALT_PASS)).rejects.toMatchObject({
        code: VAULT_CRYPTO_ERROR_CODE.WRONG_PASSPHRASE_OR_TAMPERED,
      });
    });
  });
});
