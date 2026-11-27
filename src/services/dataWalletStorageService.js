/**
 * Local-First Encrypted Storage Service for Citizen Data Wallet (#1159)
 *
 * Implements client-side encrypted credential storage, locked/unlocked state management,
 * and zero-escrow passphrase-derived backup export/restore.
 */

import { SEED_CREDENTIALS } from '../data/walletSeedFixtures';
import { validateCredential } from '../data/walletContracts';
import {
  encryptVaultPayload,
  decryptVaultPayload,
  validateVaultPassphrase,
  isEncryptedVaultEnvelope,
  isWebCryptoAvailable
} from './vaultCryptoService';

export const WALLET_STORAGE_KEY = 'civicbridge_citizen_wallet_credentials';
export const WALLET_ENCRYPTED_KEY = 'civicbridge_wallet_encrypted_envelope';
export const WALLET_BACKUP_FORMAT = 'civicbridge-citizen-wallet-backup';

let inMemoryCredentialsCache = null;
let inMemoryPassphrase = null;
const memoryStore = new Map();

const getStorage = () => {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage && typeof globalThis.localStorage.getItem === 'function') {
      globalThis.localStorage.getItem('__probe__');
      return globalThis.localStorage;
    }
  } catch {
    // Fallback to in-memory map
  }
  return {
    getItem: (k) => (memoryStore.has(k) ? memoryStore.get(k) : null),
    setItem: (k, v) => memoryStore.set(k, String(v)),
    removeItem: (k) => memoryStore.delete(k),
    clear: () => memoryStore.clear()
  };
};

/**
 * Checks if the wallet is currently encrypted at rest.
 */
export function isWalletAtRestEncrypted() {
  const storage = getStorage();
  const envelope = storage.getItem(WALLET_ENCRYPTED_KEY);
  return Boolean(envelope && isEncryptedVaultEnvelope(envelope));
}

/**
 * Checks if the wallet is currently locked (requires passphrase to read).
 */
export function isWalletLocked() {
  return isWalletAtRestEncrypted() && inMemoryCredentialsCache === null;
}

/**
 * Clears in-memory keys and decrypted records.
 */
export function lockWallet() {
  inMemoryCredentialsCache = null;
  inMemoryPassphrase = null;
}

/**
 * Unlocks an encrypted wallet using the citizen's passphrase.
 */
export async function unlockWallet(passphrase) {
  const storage = getStorage();
  const rawEnvelope = storage.getItem(WALLET_ENCRYPTED_KEY);
  if (!rawEnvelope) {
    return { success: true, credentials: getWalletCredentials() };
  }

  const envelope = JSON.parse(rawEnvelope);
  const decrypted = await decryptVaultPayload(envelope, passphrase);

  inMemoryCredentialsCache = Array.isArray(decrypted) ? decrypted : [];
  inMemoryPassphrase = passphrase;

  return { success: true, credentials: inMemoryCredentialsCache };
}

/**
 * Retrieves all stored verifiable credentials.
 * If storage is empty and unencrypted, initializes with synthetic demo fixtures.
 */
export function getWalletCredentials() {
  if (isWalletAtRestEncrypted()) {
    if (inMemoryCredentialsCache !== null) {
      return [...inMemoryCredentialsCache];
    }
    return []; // Locked state
  }

  const storage = getStorage();
  const raw = storage.getItem(WALLET_STORAGE_KEY);
  if (!raw) {
    // Seed initial synthetic credentials for immediate evaluation
    const initial = [...SEED_CREDENTIALS];
    storage.setItem(WALLET_STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Persists credentials to local storage (and re-encrypts if encryption is active).
 */
async function persistCredentials(credentials) {
  const storage = getStorage();
  if (isWalletAtRestEncrypted()) {
    if (!inMemoryPassphrase) {
      throw new Error('Cannot persist to encrypted wallet while locked.');
    }
    inMemoryCredentialsCache = [...credentials];
    const envelope = await encryptVaultPayload(credentials, inMemoryPassphrase);
    storage.setItem(WALLET_ENCRYPTED_KEY, JSON.stringify(envelope));
    storage.removeItem(WALLET_STORAGE_KEY); // Ensure unencrypted records are purged
  } else {
    storage.setItem(WALLET_STORAGE_KEY, JSON.stringify(credentials));
  }
}

/**
 * Saves or updates a verifiable credential in the wallet.
 */
export async function saveWalletCredential(credential) {
  const validation = validateCredential(credential);
  if (!validation.valid) {
    throw new Error(`Invalid credential: ${validation.error}`);
  }

  const current = getWalletCredentials();
  const existingIndex = current.findIndex((c) => c.id === credential.id);

  let updated;
  if (existingIndex >= 0) {
    updated = [...current];
    updated[existingIndex] = credential;
  } else {
    updated = [credential, ...current];
  }

  await persistCredentials(updated);
  return credential;
}

/**
 * Removes a verifiable credential from the wallet by id.
 */
export async function deleteWalletCredential(credentialId) {
  const current = getWalletCredentials();
  const filtered = current.filter((c) => c.id !== credentialId);
  await persistCredentials(filtered);
  return true;
}

/**
 * Enables at-rest WebCrypto authenticated encryption for the wallet.
 */
export async function enableWalletAtRestEncryption(passphrase) {
  const check = validateVaultPassphrase(passphrase);
  if (!check.valid) {
    throw new Error(check.error);
  }
  if (!isWebCryptoAvailable()) {
    throw new Error('WebCrypto is unavailable in this environment.');
  }

  const current = getWalletCredentials();
  const envelope = await encryptVaultPayload(current, passphrase);

  const storage = getStorage();
  storage.setItem(WALLET_ENCRYPTED_KEY, JSON.stringify(envelope));
  storage.removeItem(WALLET_STORAGE_KEY);

  inMemoryCredentialsCache = [...current];
  inMemoryPassphrase = passphrase;

  return { success: true };
}

/**
 * Disables at-rest encryption and reverts to plain local storage.
 */
export async function disableWalletAtRestEncryption(passphrase) {
  const unlockRes = await unlockWallet(passphrase);
  if (!unlockRes.success) {
    throw new Error('Failed to unlock wallet with provided passphrase.');
  }

  const storage = getStorage();
  storage.setItem(WALLET_STORAGE_KEY, JSON.stringify(inMemoryCredentialsCache));
  storage.removeItem(WALLET_ENCRYPTED_KEY);

  const creds = inMemoryCredentialsCache;
  lockWallet();
  return { success: true, credentials: creds };
}

/**
 * Exports an encrypted JSON backup file envelope of all credentials.
 */
export async function exportEncryptedWalletBackup(passphrase) {
  const check = validateVaultPassphrase(passphrase);
  if (!check.valid) {
    throw new Error(check.error);
  }

  const credentials = getWalletCredentials();
  const envelope = await encryptVaultPayload(
    {
      format: WALLET_BACKUP_FORMAT,
      exportedAt: new Date().toISOString(),
      credentials
    },
    passphrase
  );

  return envelope;
}

/**
 * Imports an encrypted JSON backup file into the wallet.
 */
export async function importEncryptedWalletBackup(envelope, passphrase) {
  if (!isEncryptedVaultEnvelope(envelope)) {
    throw new Error('Invalid encrypted backup envelope format.');
  }

  const decrypted = await decryptVaultPayload(envelope, passphrase);
  if (!decrypted || !Array.isArray(decrypted.credentials)) {
    throw new Error('Decrypted backup payload does not contain valid credentials array.');
  }

  for (const cred of decrypted.credentials) {
    const val = validateCredential(cred);
    if (!val.valid) {
      throw new Error(`Corrupted credential in backup: ${val.error}`);
    }
  }

  await persistCredentials(decrypted.credentials);
  return { success: true, count: decrypted.credentials.length };
}

/**
 * Resets storage for clean testing runs.
 */
export function resetWalletStorage() {
  const storage = getStorage();
  storage.removeItem(WALLET_STORAGE_KEY);
  storage.removeItem(WALLET_ENCRYPTED_KEY);
  memoryStore.clear();
  lockWallet();
}
