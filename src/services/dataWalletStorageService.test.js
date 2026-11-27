import { describe, it, expect, beforeEach } from 'vitest';
import {
  getWalletCredentials,
  saveWalletCredential,
  deleteWalletCredential,
  enableWalletAtRestEncryption,
  disableWalletAtRestEncryption,
  isWalletAtRestEncrypted,
  isWalletLocked,
  lockWallet,
  unlockWallet,
  exportEncryptedWalletBackup,
  importEncryptedWalletBackup,
  resetWalletStorage
} from './dataWalletStorageService';
import { CREDENTIAL_SCHEMA_TYPES, TRUST_TIERS } from '../data/walletContracts';

describe('dataWalletStorageService', () => {
  beforeEach(() => {
    resetWalletStorage();
  });

  it('initializes with synthetic seed credentials on first read', () => {
    const creds = getWalletCredentials();
    expect(creds.length).toBeGreaterThan(0);
    expect(creds[0].id).toBeDefined();
    expect(creds[0].schemaType).toBeDefined();
  });

  it('saves and updates credentials in storage', async () => {
    const newCred = {
      id: 'cred_test_custom_001',
      schemaType: CREDENTIAL_SCHEMA_TYPES.RESIDENCE_PROOF,
      trustTier: TRUST_TIERS.SELF_ASSERTED,
      createdAt: new Date().toISOString(),
      claims: {
        fullName: 'Test Citizen',
        wardNumber: 'Ward 5',
        city: 'Mumbai',
        district: 'Mumbai Suburban',
        state: 'Maharashtra',
        pincode: '400001'
      }
    };

    await saveWalletCredential(newCred);
    const creds = getWalletCredentials();
    const found = creds.find((c) => c.id === 'cred_test_custom_001');
    expect(found).toBeDefined();
    expect(found.claims.fullName).toBe('Test Citizen');
  });

  it('deletes credentials by id', async () => {
    const creds = getWalletCredentials();
    const firstId = creds[0].id;
    await deleteWalletCredential(firstId);

    const remaining = getWalletCredentials();
    expect(remaining.find((c) => c.id === firstId)).toBeUndefined();
  });

  it('supports at-rest encryption, lock, and unlock workflows', async () => {
    const passphrase = 'SecurePassphrase2026!';
    expect(isWalletAtRestEncrypted()).toBe(false);

    await enableWalletAtRestEncryption(passphrase);
    expect(isWalletAtRestEncrypted()).toBe(true);
    expect(isWalletLocked()).toBe(false); // Unlocked in current session

    lockWallet();
    expect(isWalletLocked()).toBe(true);
    expect(getWalletCredentials()).toEqual([]); // Locked returns empty

    const unlockRes = await unlockWallet(passphrase);
    expect(unlockRes.success).toBe(true);
    expect(isWalletLocked()).toBe(false);
    expect(getWalletCredentials().length).toBeGreaterThan(0);

    // Disable encryption
    const disableRes = await disableWalletAtRestEncryption(passphrase);
    expect(disableRes.success).toBe(true);
    expect(isWalletAtRestEncrypted()).toBe(false);
  });

  it('exports and imports encrypted wallet backups', async () => {
    const passphrase = 'ExportTestPassphrase123!';
    const backupEnvelope = await exportEncryptedWalletBackup(passphrase);

    expect(backupEnvelope.format).toBe('civicbridge-vault-encrypted');
    expect(backupEnvelope.ciphertext).toBeDefined();

    // Wipe storage
    resetWalletStorage();

    const importRes = await importEncryptedWalletBackup(backupEnvelope, passphrase);
    expect(importRes.success).toBe(true);
    expect(importRes.count).toBeGreaterThan(0);

    const restored = getWalletCredentials();
    expect(restored.length).toBe(importRes.count);
  });
});
