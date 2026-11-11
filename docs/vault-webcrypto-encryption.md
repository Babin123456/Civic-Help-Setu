# Document Vault WebCrypto Encryption Architecture

## Overview
CivicBridge stores citizen document metadata locally in browser storage (`civicbridge_vault_docs`) and supports local backup export/restore. To ensure confidentiality and tamper resistance without any server-side key escrow, `src/services/vaultCryptoService.js` and `src/services/vaultStorage.js` implement client-side authenticated encryption via the Web Crypto API.

## Cryptographic Design
- **Key Derivation Function:** `PBKDF2` with `HMAC-SHA-256` (`210,000` default iterations, minimum enforced floor `100,000`), using a fresh cryptographically random 16-byte salt (`crypto.getRandomValues`) per encryption operation.
- **Authenticated Cipher:** `AES-256-GCM` with a fresh random 12-byte IV per payload and a 128-bit authentication tag.
- **Header Integrity Binding (AAD):** Envelope metadata (`format|v<version>|<iterations>|<salt>|<iv>`) is passed as Additional Authenticated Data (`additionalData`) during encryption and decryption, ensuring any tampering with KDF parameters, version, salt, IV, or ciphertext fails GCM verification.
- **Non-Extractable Keys:** Derived `CryptoKey` instances are created with `extractable = false` and passphrases are held only in memory while an encrypted vault is unlocked.

## Versioned Envelope Format (`v1`)
```json
{
  "format": "civicbridge-vault-encrypted",
  "version": 1,
  "kdf": {
    "algorithm": "PBKDF2",
    "hash": "SHA-256",
    "iterations": 210000,
    "salt": "<base64>"
  },
  "cipher": {
    "algorithm": "AES-GCM",
    "keyLength": 256,
    "iv": "<base64>"
  },
  "createdAt": "2026-11-11T00:00:00.000Z",
  "ciphertext": "<base64>"
}
```

## Legacy Backup Compatibility
- Backups exported by `exportEncryptedVaultData()` always produce an encrypted `v1` envelope wrapping the `v3.0` backup payload.
- `importEncryptedVaultData()` detects whether uploaded JSON matches the encrypted envelope schema or a legacy `v2.0` unencrypted backup. Legacy `v2.0` backups remain restorable with an explicit user warning recommending re-export with a passphrase.

## Threat Model & Limitations
- **Client-Side Zero-Recovery Boundary:** CivicBridge has no server key escrow. If a user forgets their encryption passphrase, encrypted backups and encrypted local storage cannot be decrypted.
- **Memory & Shared-Device Protection:** Locking the vault (`lockAtRestVault()`) or inactivity timeout clears the in-memory passphrase and unlocked cache immediately, requiring passphrase re-entry to decrypt records again.
- **Step-Up Controls:** Sensitive actions (`BULK_EXPORT`, `PERMANENT_DELETE`, and `RECOVERY_KEYS_CHANGE`) are evaluated through `src/services/vaultRiskBasedAccessService.js`, logging only privacy-safe metadata (`eventType`, `riskLevel`, `timestamp`) and never logging passphrases, filenames, or document numbers.
