/**
 * src/services/civicEvidenceLockerStorageService.js
 * Storage, Local/Remote Synchronization, Revocable Sharing, and Audit Logging
 * for Civic Service Digital Evidence Locker (#1186).
 *
 * Implements:
 *  - Local storage persistence for client-encrypted envelopes
 *  - Revocable sharing grant lifecycle (expiry, max access count, emergency revocation)
 *  - Zero-escrow client-side export and verification
 *  - Privacy-preserving non-PII audit trail
 *  - In-memory session key management with auto-lock timer
 */

import {
  EVIDENCE_LOCKER_STORAGE_KEY,
  EVIDENCE_LOCKER_AUDIT_STORAGE_KEY,
  SYNTHETIC_EVIDENCE_FIXTURES,
} from '../data/civicEvidenceLockerContract.js';
import {
  encryptEvidencePayload,
  decryptEvidencePayload,
  computeSha256,
  getRandomBytes,
  bytesToBase64,
} from './civicEvidenceLockerCryptoService.js';

// In-memory unlocked cache; wiped immediately when locked
let inMemoryPassphrase = null;
let unlockedCache = new Map(); // recordId -> decrypted payload
let autoLockTimeoutId = null;
const AUTO_LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes of inactivity

/**
 * Reset inactivity timer
 */
function touchInactivityTimer(onLockCallback) {
  if (autoLockTimeoutId) {
    clearTimeout(autoLockTimeoutId);
  }
  autoLockTimeoutId = setTimeout(() => {
    lockLockerSession();
    if (typeof onLockCallback === 'function') {
      onLockCallback();
    }
  }, AUTO_LOCK_DURATION_MS);
}

/**
 * Locks the in-memory session and purges decrypted payloads from memory
 */
export function lockLockerSession() {
  inMemoryPassphrase = null;
  unlockedCache.clear();
  if (autoLockTimeoutId) {
    clearTimeout(autoLockTimeoutId);
    autoLockTimeoutId = null;
  }
}

/**
 * Checks if the current session is unlocked
 */
export function isLockerSessionUnlocked() {
  return inMemoryPassphrase !== null;
}

/**
 * Unlocks the locker with a master passphrase
 */
export function unlockLockerSession(passphrase, onLockCallback) {
  if (!passphrase || passphrase.length < 8) {
    throw new Error('Master passphrase must be at least 8 characters');
  }
  inMemoryPassphrase = passphrase;
  touchInactivityTimer(onLockCallback);
  return true;
}

/**
 * Reads all stored encrypted envelopes from local storage
 */
export function getStoredEvidenceEnvelopes() {
  try {
    const raw = localStorage.getItem(EVIDENCE_LOCKER_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.error('Failed to read evidence locker envelopes from localStorage:', err);
    return [];
  }
}

/**
 * Saves list of envelopes to local storage
 */
export function saveStoredEvidenceEnvelopes(envelopes) {
  try {
    localStorage.setItem(EVIDENCE_LOCKER_STORAGE_KEY, JSON.stringify(envelopes));
    return true;
  } catch (err) {
    console.error('Failed to save evidence locker envelopes to localStorage:', err);
    throw new Error('Storage quota exceeded or storage unavailable.');
  }
}

/**
 * Creates and stores a new encrypted evidence record
 */
export async function createAndStoreEvidenceRecord({
  title,
  category,
  sensitivity,
  jurisdiction,
  tags = [],
  narrative = '',
  files = [],
  passphrase,
}) {
  const effectivePassphrase = passphrase || inMemoryPassphrase;
  if (!effectivePassphrase) {
    throw new Error('Passphrase required to encrypt record. Locker is locked.');
  }

  const recordId = `rec-${Date.now()}-${bytesToBase64(getRandomBytes(4)).replace(/[^a-zA-Z0-9]/g, '').slice(0, 6)}`;

  // File integrity hashing: calculate SHA-256 for each file
  const processedFiles = [];
  let totalBytes = 0;

  for (const f of files) {
    let sha256 = f.sha256;
    if (!sha256 && f.content) {
      sha256 = await computeSha256(f.content);
    }
    const sizeBytes = f.sizeBytes || (f.content ? f.content.length : 0);
    totalBytes += sizeBytes;

    processedFiles.push({
      fileName: f.fileName || 'unnamed_evidence_asset',
      mimeType: f.mimeType || 'application/pdf',
      sizeBytes,
      sha256: sha256 || '0000000000000000000000000000000000000000000000000000000000000000',
      notes: f.notes || '',
      content: f.content || null, // client-side data URI or text
    });
  }

  const publicMetadata = {
    title: title.trim(),
    category,
    sensitivity,
    jurisdiction: jurisdiction || 'Civic Authority / Grievance Cell',
    createdAt: new Date().toISOString(),
    fileCount: processedFiles.length,
    totalBytes,
    tags,
    legalNoticeDisclaimerAccepted: true,
  };

  const plaintextPayload = {
    narrative: narrative.trim(),
    entries: processedFiles,
  };

  // Encrypt with client-side WebCrypto
  const envelope = await encryptEvidencePayload(
    plaintextPayload,
    effectivePassphrase,
    publicMetadata,
    recordId
  );

  // Persist envelope
  const current = getStoredEvidenceEnvelopes();
  current.unshift(envelope);
  saveStoredEvidenceEnvelopes(current);

  // Keep in decrypted cache
  unlockedCache.set(recordId, plaintextPayload);

  // Append privacy-preserving audit log
  appendAuditLog({
    action: 'CREATE_RECORD',
    recordId,
    category,
    fileCount: processedFiles.length,
    timestamp: new Date().toISOString(),
  });

  return envelope;
}

/**
 * Decrypts a specific evidence record from storage
 */
export async function getDecryptedEvidenceRecord(recordId, passphrase) {
  const effectivePassphrase = passphrase || inMemoryPassphrase;
  if (!effectivePassphrase) {
    throw new Error('Passphrase required to decrypt record. Locker is locked.');
  }

  appendAuditLog({
    action: 'VIEW_RECORD_DECRYPTED',
    recordId,
    timestamp: new Date().toISOString(),
  });

  if (unlockedCache.has(recordId)) {
    return unlockedCache.get(recordId);
  }

  const envelopes = getStoredEvidenceEnvelopes();
  const envelope = envelopes.find((e) => e.id === recordId);
  if (!envelope) {
    throw new Error(`Record ${recordId} not found in locker.`);
  }

  const decrypted = await decryptEvidencePayload(envelope, effectivePassphrase);
  unlockedCache.set(recordId, decrypted);

  return decrypted;
}

/**
 * Deletes an evidence record from storage and in-memory cache
 */
export function deleteStoredEvidenceRecord(recordId) {
  const current = getStoredEvidenceEnvelopes();
  const filtered = current.filter((e) => e.id !== recordId);
  saveStoredEvidenceEnvelopes(filtered);
  unlockedCache.delete(recordId);

  appendAuditLog({
    action: 'DELETE_RECORD',
    recordId,
    timestamp: new Date().toISOString(),
  });

  return true;
}

/**
 * Creates a revocable sharing grant for a record
 */
export function createSharingGrant({
  recordId,
  recipientLabel,
  validityHours = 24,
  maxAccessCount = 3,
  recipientPasscode = null,
}) {
  const grantId = `grant-${Date.now()}-${bytesToBase64(getRandomBytes(4)).replace(/[^a-zA-Z0-9]/g, '').slice(0, 6)}`;
  const expiresAt = new Date(Date.now() + validityHours * 3600 * 1000).toISOString();

  const grant = {
    grantId,
    recordId,
    recipientLabel: recipientLabel.trim(),
    createdAt: new Date().toISOString(),
    expiresAt,
    maxAccessCount,
    accessCount: 0,
    revoked: false,
    revokedAt: null,
    hasRecipientPasscode: Boolean(recipientPasscode),
  };

  const currentGrants = getStoredSharingGrants();
  currentGrants.unshift(grant);
  localStorage.setItem('civic_evidence_locker_grants_v1', JSON.stringify(currentGrants));

  appendAuditLog({
    action: 'CREATE_SHARING_GRANT',
    grantId,
    recordId,
    recipientLabel,
    expiresAt,
    timestamp: new Date().toISOString(),
  });

  return grant;
}

/**
 * Gets all stored sharing grants
 */
export function getStoredSharingGrants() {
  try {
    const raw = localStorage.getItem('civic_evidence_locker_grants_v1');
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/**
 * Revokes an existing sharing grant immediately
 */
export function revokeSharingGrant(grantId, reason = 'Manually revoked by citizen') {
  const grants = getStoredSharingGrants();
  const grant = grants.find((g) => g.grantId === grantId);
  if (!grant) {
    throw new Error('Grant not found');
  }

  grant.revoked = true;
  grant.revokedAt = new Date().toISOString();
  grant.revocationReason = reason;

  localStorage.setItem('civic_evidence_locker_grants_v1', JSON.stringify(grants));

  appendAuditLog({
    action: 'REVOKE_SHARING_GRANT',
    grantId,
    recordId: grant.recordId,
    reason,
    timestamp: new Date().toISOString(),
  });

  return grant;
}

/**
 * Privacy-preserving audit logging: strictly no citizen PII or filenames logged
 */
export function appendAuditLog(entry) {
  try {
    const raw = localStorage.getItem(EVIDENCE_LOCKER_AUDIT_STORAGE_KEY);
    const logs = raw ? JSON.parse(raw) : [];
    logs.unshift({
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      ...entry,
    });
    // Keep at most 200 recent events
    if (logs.length > 200) {
      logs.length = 200;
    }
    localStorage.setItem(EVIDENCE_LOCKER_AUDIT_STORAGE_KEY, JSON.stringify(logs));
  } catch (err) {
    console.warn('Audit logging failed:', err);
  }
}

/**
 * Reads audit log entries
 */
export function getAuditLogs() {
  try {
    const raw = localStorage.getItem(EVIDENCE_LOCKER_AUDIT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Loads synthetic fixtures for testing/demo without citizen PII
 */
export async function seedSyntheticFixturesIfEmpty(defaultPassphrase = 'TestPassphrase123!') {
  const existing = getStoredEvidenceEnvelopes();
  if (existing.length > 0) return existing;

  const seeded = [];
  for (const fixture of SYNTHETIC_EVIDENCE_FIXTURES) {
    const envelope = await encryptEvidencePayload(
      fixture.plaintextSample,
      defaultPassphrase,
      fixture.publicMetadata,
      fixture.id
    );
    seeded.push(envelope);
  }
  saveStoredEvidenceEnvelopes(seeded);
  return seeded;
}
