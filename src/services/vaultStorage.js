import { isValidVaultRecord } from './vaultValidation';
import { logDiagnostic } from '../utils/diagnostics';
import { minimizeDocumentNumber, minimizeVaultDocuments } from './dataMinimization';
import {
  decryptVaultPayload,
  encryptVaultPayload,
  isEncryptedVaultEnvelope,
  rotateEncryptedEnvelope,
  validateVaultPassphrase,
} from './vaultCryptoService';

const STORAGE_KEY = 'civicbridge_vault_docs';

// Kept strictly in memory while an encrypted vault is unlocked; never written to storage.
let activeSessionPassphrase = null;
let unlockedDocumentsCache = null;

const writeStorageRaw = (rawValue) => {
  try {
    localStorage.setItem(STORAGE_KEY, rawValue);
  } catch (err) {
    const quota = err && (err.name === 'QuotaExceededError' || err.code === 22);
    throw new Error(
      quota
        ? 'Browser storage is full. Delete some documents and try again.'
        : 'Could not save to browser storage.',
      { cause: err }
    );
  }
};

const readStoredEnvelopeOrDocs = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { missing: true, parsed: null };
  const parsed = JSON.parse(raw);
  return { missing: false, parsed, encrypted: isEncryptedVaultEnvelope(parsed) };
};

const clearInMemorySession = () => {
  activeSessionPassphrase = null;
  unlockedDocumentsCache = null;
};

export const lockAtRestVault = () => {
  clearInMemorySession();
};

export const isVaultAtRestEncrypted = () => {
  try {
    const { encrypted } = readStoredEnvelopeOrDocs();
    return Boolean(encrypted);
  } catch {
    return false;
  }
};

export const isEncryptedVaultLocked = () => {
  if (!isVaultAtRestEncrypted()) return false;
  return activeSessionPassphrase === null || unlockedDocumentsCache === null;
};

const persistPlaintext = (docs) => {
  writeStorageRaw(JSON.stringify(docs));
};

const persistEncrypted = async (docs, passphrase) => {
  const minimized = minimizeVaultDocuments(docs);
  const envelope = await encryptVaultPayload(
    {
      format: 'civicbridge-vault-store',
      version: 1,
      documents: minimized,
    },
    passphrase
  );
  writeStorageRaw(JSON.stringify(envelope));
  activeSessionPassphrase = passphrase;
  unlockedDocumentsCache = minimized;
  return minimized;
};

const persist = (docs) => {
  if (isVaultAtRestEncrypted()) {
    if (!activeSessionPassphrase) {
      throw new Error('Vault is encrypted and locked. Unlock with your passphrase first.');
    }
    unlockedDocumentsCache = docs;
    void persistEncrypted(docs, activeSessionPassphrase).catch((err) => {
      logDiagnostic('Failed to persist encrypted vault documents', err);
    });
    return;
  }
  persistPlaintext(docs);
};

const persistAsync = async (docs) => {
  if (isVaultAtRestEncrypted()) {
    if (!activeSessionPassphrase) {
      throw new Error('Vault is encrypted and locked. Unlock with your passphrase first.');
    }
    return persistEncrypted(docs, activeSessionPassphrase);
  }
  persistPlaintext(docs);
  return docs;
};

const DEFAULT_DOCUMENTS = [
  {
    id: 'doc-1',
    type: 'Aadhaar Card',
    category: 'Identity',
    number: 'XXXX 1234',
    issuer: 'UIDAI',
    issueDate: '2018-04-12',
    expiryDate: null,
    verified: true,
    notes: 'Primary demographic proof with verified biometrics.',
    fileName: 'aadhaar_card_masked.pdf',
    fileSize: '420 KB',
    taggedServices: ['birth-certificate', 'pan-card', 'voter-id', 'passport'],
  },
  {
    id: 'doc-2',
    type: 'PAN Card',
    category: 'Finance',
    number: 'XXXX 234F',
    issuer: 'Income Tax Department',
    issueDate: '2019-11-20',
    expiryDate: null,
    verified: true,
    notes: 'Linked to bank account and tax filings.',
    fileName: 'pan_card_copy.pdf',
    fileSize: '280 KB',
    taggedServices: ['income-certificate', 'udyam-registration'],
  },
  {
    id: 'doc-3',
    type: 'Driving License',
    category: 'Transport',
    number: 'XXXX 2019',
    issuer: 'Ministry of Road Transport',
    issueDate: '2022-03-01',
    expiryDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // expiring in 45 days
    verified: false,
    notes: 'Valid for LMV and motorcycle with gear. Needs renewal soon.',
    fileName: 'driving_license.jpg',
    fileSize: '1.2 MB',
    taggedServices: ['driving-license'],
  },
];

export const getExpiryStatus = (expiryDate) => {
  if (!expiryDate) return 'none';
  const today = new Date();
  const exp = new Date(expiryDate);
  const diffTime = exp.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'expired';
  if (diffDays <= 60) return 'expiring-soon';
  if (diffDays <= 180) return 'expiring-6m';
  return 'active';
};

export const getDaysUntilExpiry = (expiryDate) => {
  if (!expiryDate) return null;
  const today = new Date();
  const exp = new Date(expiryDate);
  const diffTime = exp.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const getDocuments = () => {
  try {
    const { missing, parsed, encrypted } = readStoredEnvelopeOrDocs();
    if (missing) {
      clearInMemorySession();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_DOCUMENTS));
      } catch {
        // storage unavailable, still show the defaults
      }
      return DEFAULT_DOCUMENTS;
    }

    if (encrypted) {
      return unlockedDocumentsCache !== null ? unlockedDocumentsCache : [];
    }

    clearInMemorySession();
    // Older entries kept the full document number, cut them down once (#212)
    const minimized = minimizeVaultDocuments(parsed);
    if (minimized !== parsed) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(minimized));
      } catch {
        // still return the minimized copy
      }
    }
    return minimized;
  } catch (err) {
    logDiagnostic('Failed to load documents from vault storage', err);
    return DEFAULT_DOCUMENTS;
  }
};

const buildUpdatedDocumentsOnSave = (doc) => {
  const current = getDocuments();
  if (doc.id && current.some((d) => d.id === doc.id)) {
    return current.map((d) =>
      d.id === doc.id ? { ...d, ...doc, number: minimizeDocumentNumber(doc.number ?? d.number) } : d
    );
  }
  const newDoc = {
    ...doc,
    number: minimizeDocumentNumber(doc.number),
    id: doc.id || `doc-${Date.now()}`,
    createdAt: new Date().toISOString(),
    verified: Boolean(doc.verified),
    taggedServices: doc.taggedServices || [],
  };
  return [newDoc, ...current];
};

const assertUnlockedIfEncrypted = () => {
  if (isEncryptedVaultLocked()) {
    throw new Error('Vault is encrypted and locked. Unlock with your passphrase first.');
  }
};

export const saveDocument = (doc) => {
  assertUnlockedIfEncrypted();
  const updated = buildUpdatedDocumentsOnSave(doc);
  persist(updated);
  return updated;
};

export const saveDocumentEncrypted = async (doc) => {
  assertUnlockedIfEncrypted();
  const updated = buildUpdatedDocumentsOnSave(doc);
  return persistAsync(updated);
};

export const deleteDocument = (id) => {
  assertUnlockedIfEncrypted();
  const current = getDocuments();
  const updated = current.filter((d) => d.id !== id);
  persist(updated);
  return updated;
};

export const deleteDocumentEncrypted = async (id) => {
  assertUnlockedIfEncrypted();
  const current = getDocuments();
  const updated = current.filter((d) => d.id !== id);
  return persistAsync(updated);
};

const updateDocumentTags = (docId, updater) => {
  assertUnlockedIfEncrypted();
  const current = getDocuments();
  const target = current.find((d) => d.id === docId);
  if (!target) return { changed: false, updated: current };

  const updated = current.map((d) => (d.id === docId ? { ...d, taggedServices: updater(d.taggedServices || []) } : d));
  return { changed: true, updated };
};

export const tagDocumentToService = (docId, serviceId) => {
  const { changed, updated } = updateDocumentTags(docId, (list) => Array.from(new Set([...list, serviceId])));
  if (changed) persist(updated);
  return updated;
};

export const tagDocumentToServiceEncrypted = async (docId, serviceId) => {
  const { changed, updated } = updateDocumentTags(docId, (list) => Array.from(new Set([...list, serviceId])));
  if (changed) return persistAsync(updated);
  return updated;
};

export const untagDocumentFromService = (docId, serviceId) => {
  const { changed, updated } = updateDocumentTags(docId, (list) => list.filter((s) => s !== serviceId));
  if (changed) persist(updated);
  return updated;
};

export const untagDocumentFromServiceEncrypted = async (docId, serviceId) => {
  const { changed, updated } = updateDocumentTags(docId, (list) => list.filter((s) => s !== serviceId));
  if (changed) return persistAsync(updated);
  return updated;
};

export const getExpiringDocuments = () => {
  const all = getDocuments();
  return all
    .map((doc) => ({
      doc,
      daysLeft: getDaysUntilExpiry(doc.expiryDate),
      status: getExpiryStatus(doc.expiryDate),
    }))
    .filter((item) => item.status === 'expired' || item.status === 'expiring-soon' || item.status === 'expiring-6m')
    .sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999));
};

/**
 * Enables AES-256-GCM at-rest encryption for stored vault documents.
 */
export const enableAtRestEncryption = async (passphrase) => {
  if (isVaultAtRestEncrypted()) {
    throw new Error('Vault at-rest encryption is already enabled. Use passphrase rotation to change your key.');
  }
  const check = validateVaultPassphrase(passphrase);
  if (!check.valid) {
    throw new Error(check.error);
  }
  const docs = getDocuments();
  await persistEncrypted(docs, passphrase);
  return { encrypted: true, count: docs.length };
};

/**
 * Unlocks an at-rest encrypted vault in memory using the user's passphrase.
 */
export const unlockAtRestVault = async (passphrase) => {
  const { missing, parsed, encrypted } = readStoredEnvelopeOrDocs();
  if (missing || !encrypted) {
    return getDocuments();
  }
  const decrypted = await decryptVaultPayload(parsed, passphrase);
  const docs = Array.isArray(decrypted?.documents) ? decrypted.documents : decrypted;
  if (!Array.isArray(docs)) {
    throw new Error('Encrypted vault storage format is invalid.');
  }
  const minimized = minimizeVaultDocuments(docs.filter((item) => isValidVaultRecord(item)));
  activeSessionPassphrase = passphrase;
  unlockedDocumentsCache = minimized;
  return minimized;
};

/**
 * Rotates the at-rest encryption passphrase with a fresh salt and IV.
 */
export const rotateAtRestPassphrase = async (currentPassphrase, newPassphrase) => {
  const { missing, parsed, encrypted } = readStoredEnvelopeOrDocs();
  if (missing || !encrypted) {
    throw new Error('At-rest vault encryption is not currently enabled.');
  }
  const rotatedEnvelope = await rotateEncryptedEnvelope(parsed, currentPassphrase, newPassphrase);
  writeStorageRaw(JSON.stringify(rotatedEnvelope));
  activeSessionPassphrase = newPassphrase;
  if (unlockedDocumentsCache === null) {
    const decrypted = await decryptVaultPayload(rotatedEnvelope, newPassphrase);
    const docs = Array.isArray(decrypted?.documents) ? decrypted.documents : [];
    unlockedDocumentsCache = minimizeVaultDocuments(docs.filter((item) => isValidVaultRecord(item)));
  }
  return { rotated: true };
};

/**
 * Decrypts and disables at-rest encryption, returning storage to minimized JSON array format.
 */
export const disableAtRestEncryption = async (passphrase) => {
  const { missing, parsed, encrypted } = readStoredEnvelopeOrDocs();
  if (missing || !encrypted) {
    return { encrypted: false };
  }
  const decrypted = await decryptVaultPayload(parsed, passphrase);
  const docs = Array.isArray(decrypted?.documents) ? decrypted.documents : [];
  const minimized = minimizeVaultDocuments(docs.filter((item) => isValidVaultRecord(item)));
  clearInMemorySession();
  persistPlaintext(minimized);
  return { encrypted: false, count: minimized.length };
};

const mergeDocumentsFromBackup = (incomingDocuments) => {
  assertUnlockedIfEncrypted();
  const current = getDocuments();
  const existingIds = new Set(current.map((d) => d.id));
  const merged = [...current];
  let skipped = 0;

  for (const incoming of incomingDocuments) {
    if (!isValidVaultRecord(incoming)) {
      skipped += 1;
      continue;
    }
    const sanitizedIncoming = { ...incoming, number: minimizeDocumentNumber(incoming.number) };
    if (existingIds.has(incoming.id)) {
      const idx = merged.findIndex((d) => d.id === incoming.id);
      merged[idx] = { ...merged[idx], ...sanitizedIncoming };
    } else {
      merged.push(sanitizedIncoming);
    }
  }

  return { merged, importedCount: incomingDocuments.length - skipped, skipped };
};

export const exportVaultData = () => {
  assertUnlockedIfEncrypted();
  const docs = getDocuments();
  const backup = {
    app: 'CivicBridge Vault',
    version: '2.0',
    exportDate: new Date().toISOString(),
    documentsCount: docs.length,
    checksum: btoa(unescape(encodeURIComponent(JSON.stringify(docs)))).slice(0, 32),
    documents: docs,
  };
  return JSON.stringify(backup, null, 2);
};

/**
 * Exports vault records inside an authenticated AES-256-GCM encrypted backup envelope.
 */
export const exportEncryptedVaultData = async (passphrase) => {
  assertUnlockedIfEncrypted();
  const check = validateVaultPassphrase(passphrase);
  if (!check.valid) {
    throw new Error(check.error);
  }
  const docs = minimizeVaultDocuments(getDocuments());
  const payload = {
    app: 'CivicBridge Vault',
    version: '3.0',
    encrypted: true,
    exportDate: new Date().toISOString(),
    documentsCount: docs.length,
    documents: docs,
  };
  const envelope = await encryptVaultPayload(payload, passphrase);
  return JSON.stringify(envelope, null, 2);
};

export const importVaultData = (jsonString) => {
  try {
    const parsed = JSON.parse(jsonString);
    if (isEncryptedVaultEnvelope(parsed)) {
      throw new Error('This backup is encrypted. Please provide its passphrase to restore.');
    }
    if (!parsed || !Array.isArray(parsed.documents)) {
      throw new Error('Invalid vault backup format.');
    }
    const { merged, importedCount, skipped } = mergeDocumentsFromBackup(parsed.documents);
    persist(merged);
    return { success: true, count: importedCount, skipped };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

/**
 * Imports either an encrypted v3 backup envelope (requires passphrase) or a legacy v2.0 backup
 * (returns legacyUnencrypted: true with an explicit advisory warning).
 */
export const importEncryptedVaultData = async (jsonString, passphrase = '') => {
  try {
    const parsed = JSON.parse(jsonString);

    if (isEncryptedVaultEnvelope(parsed)) {
      if (!passphrase) {
        return {
          success: false,
          needsPassphrase: true,
          error: 'Passphrase is required to decrypt this encrypted backup.',
        };
      }
      const decrypted = await decryptVaultPayload(parsed, passphrase);
      if (!decrypted || !Array.isArray(decrypted.documents)) {
        throw new Error('Decrypted backup payload is missing documents.');
      }
      const { merged, importedCount, skipped } = mergeDocumentsFromBackup(decrypted.documents);
      await persistAsync(merged);
      return {
        success: true,
        encrypted: true,
        legacyUnencrypted: false,
        count: importedCount,
        skipped,
      };
    }

    if (!parsed || !Array.isArray(parsed.documents)) {
      throw new Error('Invalid vault backup format.');
    }

    const { merged, importedCount, skipped } = mergeDocumentsFromBackup(parsed.documents);
    await persistAsync(merged);
    return {
      success: true,
      encrypted: false,
      legacyUnencrypted: true,
      warning:
        'Imported a legacy unencrypted backup (v2.0). Re-export your vault with a passphrase to protect future backups.',
      count: importedCount,
      skipped,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const resetVaultToDefaults = () => {
  clearInMemorySession();
  persistPlaintext(DEFAULT_DOCUMENTS);
  return DEFAULT_DOCUMENTS;
};
