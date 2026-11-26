/**
 * Verifiable Evidence Bundle Storage Service (#1160)
 *
 * Provides scoped client persistence for evidence bundle manifests,
 * local raw attachment payloads, and verification audit logs.
 * Includes in-memory fallback, storage quota error mitigation,
 * and user session isolation.
 */

export const STORAGE_KEYS = Object.freeze({
  BUNDLES: 'civic_evidence_bundles_v1',
  FILES: 'civic_evidence_bundle_files_v1',
  AUDITS: 'civic_evidence_bundle_audits_v1',
});

// In-memory store fallback for SSR, test environments, or restricted storage
const memoryStore = new Map();

/**
 * Reads an item from storage safely with fallback.
 * @param {string} key
 * @param {Storage} [customStorage]
 * @returns {string|null}
 */
export const safeGetItem = (key, customStorage) => {
  try {
    const storage = customStorage || (typeof window !== 'undefined' ? window.localStorage : null);
    if (storage) {
      return storage.getItem(key);
    }
  } catch {
    // Fall back to memoryStore
  }
  return memoryStore.get(key) || null;
};

/**
 * Writes an item to storage safely with fallback.
 * @param {string} key
 * @param {string} value
 * @param {Storage} [customStorage]
 * @returns {boolean}
 */
export const safeSetItem = (key, value, customStorage) => {
  try {
    const storage = customStorage || (typeof window !== 'undefined' ? window.localStorage : null);
    if (storage) {
      storage.setItem(key, value);
      return true;
    }
  } catch {
    // Fall back to memoryStore
  }
  memoryStore.set(key, value);
  return true;
};

/**
 * Loads all bundle manifests from storage.
 *
 * @param {string} [userId='anonymous_local']
 * @param {Storage} [customStorage]
 * @returns {Array<Object>}
 */
export function loadAllBundles(userId = 'anonymous_local', customStorage) {
  const raw = safeGetItem(STORAGE_KEYS.BUNDLES, customStorage);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const cleanUser = userId || 'anonymous_local';
    return parsed.filter((b) => (b.userId || 'anonymous_local') === cleanUser);
  } catch {
    return [];
  }
}

/**
 * Saves all bundle manifests to storage.
 *
 * @param {Array<Object>} bundles
 * @param {Storage} [customStorage]
 * @returns {boolean}
 */
export function saveAllBundles(bundles = [], customStorage) {
  return safeSetItem(STORAGE_KEYS.BUNDLES, JSON.stringify(bundles), customStorage);
}

/**
 * Retrieves a single bundle manifest by ID.
 *
 * @param {string} bundleId
 * @param {string} [userId='anonymous_local']
 * @param {Storage} [customStorage]
 * @returns {Object|null}
 */
export function getBundleById(bundleId, userId = 'anonymous_local', customStorage) {
  if (!bundleId) return null;
  const list = loadAllBundles(userId, customStorage);
  return list.find((b) => b.bundleId === bundleId) || null;
}

/**
 * Saves or updates a bundle manifest.
 *
 * @param {Object} bundle
 * @param {string} [userId='anonymous_local']
 * @param {Storage} [customStorage]
 * @returns {Object} Saved bundle
 */
export function saveBundle(bundle, userId = 'anonymous_local', customStorage) {
  if (!bundle || !bundle.bundleId) {
    throw new Error('Cannot save invalid bundle manifest: missing bundleId.');
  }

  const raw = safeGetItem(STORAGE_KEYS.BUNDLES, customStorage);
  let all;
  try {
    all = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(all)) all = [];
  } catch {
    all = [];
  }

  const cleanUser = userId || 'anonymous_local';
  const bundleWithUser = {
    ...bundle,
    userId: cleanUser,
    updatedAt: new Date().toISOString(),
  };

  const idx = all.findIndex((b) => b.bundleId === bundle.bundleId && (b.userId || 'anonymous_local') === cleanUser);
  if (idx >= 0) {
    all[idx] = bundleWithUser;
  } else {
    all.unshift(bundleWithUser);
  }

  saveAllBundles(all, customStorage);
  return bundleWithUser;
}

/**
 * Deletes a bundle manifest and its associated local files.
 *
 * @param {string} bundleId
 * @param {string} [userId='anonymous_local']
 * @param {Storage} [customStorage]
 * @returns {boolean} Success
 */
export function deleteBundle(bundleId, userId = 'anonymous_local', customStorage) {
  if (!bundleId) return false;

  const raw = safeGetItem(STORAGE_KEYS.BUNDLES, customStorage);
  if (!raw) return false;

  try {
    const all = JSON.parse(raw);
    if (!Array.isArray(all)) return false;

    const cleanUser = userId || 'anonymous_local';
    const target = all.find((b) => b.bundleId === bundleId && (b.userId || 'anonymous_local') === cleanUser);
    if (!target) return false;

    // Delete associated attachment files
    if (Array.isArray(target.entries)) {
      target.entries.forEach((e) => {
        if (e.entryId) {
          deleteAttachmentFile(e.entryId, customStorage);
        }
      });
    }

    const filtered = all.filter((b) => !(b.bundleId === bundleId && (b.userId || 'anonymous_local') === cleanUser));
    saveAllBundles(filtered, customStorage);
    return true;
  } catch {
    return false;
  }
}

/**
 * Stores a raw file payload locally (Base64 string or text).
 *
 * @param {string} fileKey entryId or sha256
 * @param {string} payload
 * @param {Storage} [customStorage]
 * @returns {boolean}
 */
export function storeAttachmentFile(fileKey, payload, customStorage) {
  if (!fileKey || typeof payload !== 'string') return false;

  const raw = safeGetItem(STORAGE_KEYS.FILES, customStorage);
  let files;
  try {
    files = raw ? JSON.parse(raw) : {};
  } catch {
    files = {};
  }

  files[fileKey] = payload;
  return safeSetItem(STORAGE_KEYS.FILES, JSON.stringify(files), customStorage);
}

/**
 * Retrieves a raw file payload.
 *
 * @param {string} fileKey
 * @param {Storage} [customStorage]
 * @returns {string|null}
 */
export function getAttachmentFile(fileKey, customStorage) {
  if (!fileKey) return null;
  const raw = safeGetItem(STORAGE_KEYS.FILES, customStorage);
  if (!raw) return null;

  try {
    const files = JSON.parse(raw);
    return files[fileKey] || null;
  } catch {
    return null;
  }
}

/**
 * Deletes a stored file payload.
 *
 * @param {string} fileKey
 * @param {Storage} [customStorage]
 * @returns {boolean}
 */
export function deleteAttachmentFile(fileKey, customStorage) {
  if (!fileKey) return false;
  const raw = safeGetItem(STORAGE_KEYS.FILES, customStorage);
  if (!raw) return false;

  try {
    const files = JSON.parse(raw);
    if (files[fileKey]) {
      delete files[fileKey];
      return safeSetItem(STORAGE_KEYS.FILES, JSON.stringify(files), customStorage);
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Records a verification audit event for traceability.
 *
 * @param {string} bundleId
 * @param {Object} verificationResult
 * @param {Storage} [customStorage]
 * @returns {boolean}
 */
export function recordAuditVerification(bundleId, verificationResult, customStorage) {
  if (!bundleId || !verificationResult) return false;

  const raw = safeGetItem(STORAGE_KEYS.AUDITS, customStorage);
  let audits;
  try {
    audits = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(audits)) audits = [];
  } catch {
    audits = [];
  }

  const record = {
    auditId: `AUDIT-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    bundleId,
    verifiedAt: verificationResult.verifiedAt || new Date().toISOString(),
    status: verificationResult.status,
    isValid: verificationResult.isValid,
    checkedEntriesCount: verificationResult.checkedEntriesCount || 0,
    errors: verificationResult.errors || [],
    warnings: verificationResult.warnings || [],
  };

  audits.unshift(record);
  // Cap audit log to last 100 entries to prevent storage exhaustion
  if (audits.length > 100) audits = audits.slice(0, 100);

  return safeSetItem(STORAGE_KEYS.AUDITS, JSON.stringify(audits), customStorage);
}

/**
 * Retrieves verification audit records for a bundle.
 *
 * @param {string} bundleId
 * @param {Storage} [customStorage]
 * @returns {Array<Object>}
 */
export function getAuditVerifications(bundleId, customStorage) {
  if (!bundleId) return [];
  const raw = safeGetItem(STORAGE_KEYS.AUDITS, customStorage);
  if (!raw) return [];

  try {
    const audits = JSON.parse(raw);
    return Array.isArray(audits) ? audits.filter((a) => a.bundleId === bundleId) : [];
  } catch {
    return [];
  }
}

/**
 * Clears all evidence storage data (for privacy resets or testing).
 *
 * @param {Storage} [customStorage]
 */
export function clearAllEvidenceData(customStorage) {
  safeSetItem(STORAGE_KEYS.BUNDLES, '[]', customStorage);
  safeSetItem(STORAGE_KEYS.FILES, '{}', customStorage);
  safeSetItem(STORAGE_KEYS.AUDITS, '[]', customStorage);
  memoryStore.clear();
}
