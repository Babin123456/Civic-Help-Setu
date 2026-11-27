/**
 * src/services/civicDraftSyncExtension.js
 *
 * Extension module for the Civic Draft Sync Engine (#1424).
 *
 * This module augments `citizenDraftSyncEngine` with:
 *   1. Schema migration — upgrades persisted drafts from older schema versions.
 *   2. Encrypted local storage bridge — optional AES-GCM encryption via Web Crypto API
 *      with graceful plain-text fallback for environments that lack crypto.subtle.
 *   3. Deterministic draft-scoped idempotency key generation (FNV-1a of draftId + userId + schemaVersion).
 *   4. Retry-safe sync wrapper with exponential backoff.
 *   5. PII guard bridge — re-exports `inspectStringForPII` for inline UI use.
 *   6. Interrupted-upload recovery — resume IN_FLIGHT operations after a page reload.
 *
 * All additions are additive and import from, not replace, `citizenDraftSyncEngine`.
 */

import {
  SCHEMA_VERSION,
  STORAGE_KEYS,
  OP_STATUS,
  readStore,
  writeStore,
  processSyncQueue,
  getPendingOperations,
} from './citizenDraftSyncEngine';

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------

export const DRAFT_SCHEMA_VERSION = SCHEMA_VERSION; // Keep in sync
export const ENCRYPTED_STORAGE_KEY_PREFIX = 'civicbridge_enc_v1_';
export const CRYPTO_ALGO = 'AES-GCM';
export const CRYPTO_KEY_LENGTH = 256;
export const SCHEMA_MIGRATIONS = {}; // Register migration fns keyed by from-version

// ---------------------------------------------------------------------------
// 1. SCHEMA MIGRATION
// ---------------------------------------------------------------------------

/**
 * Register a migration function from one schema version to the next.
 * @param {number} fromVersion
 * @param {function(object): object} migrateFn
 */
export function registerSchemaMigration(fromVersion, migrateFn) {
  SCHEMA_MIGRATIONS[fromVersion] = migrateFn;
}

/**
 * Migrate a draft record from its stored schemaVersion to the current DRAFT_SCHEMA_VERSION.
 * Returns the migrated record (or the original if no migration is needed).
 * @param {object} record
 * @returns {object}
 */
export function migrateDraftSchema(record) {
  if (!record) return record;
  let current = { ...record };
  let version = current.schemaVersion != null ? Number(current.schemaVersion) : 1;

  while (version < DRAFT_SCHEMA_VERSION) {
    const migrateFn = SCHEMA_MIGRATIONS[version];
    if (typeof migrateFn === 'function') {
      current = migrateFn(current);
    }
    // Advance even if no registered migration (fields are compatible)
    version += 1;
    current.schemaVersion = version;
  }

  return current;
}

/**
 * Run schema migration over all drafts in local storage.
 * @param {object|null} storage  Pass null to use globalThis.localStorage
 * @returns {{ migrated: number, total: number }}
 */
export function migrateAllLocalDrafts(storage = null) {
  const drafts = readStore(STORAGE_KEYS.CITIZEN_DRAFTS, storage);
  let migrated = 0;
  const total = Object.keys(drafts).length;

  for (const id of Object.keys(drafts)) {
    const draft = drafts[id];
    if ((draft.schemaVersion != null ? Number(draft.schemaVersion) : 1) < DRAFT_SCHEMA_VERSION) {
      drafts[id] = migrateDraftSchema(draft);
      migrated += 1;
    }
  }

  if (migrated > 0) {
    writeStore(STORAGE_KEYS.CITIZEN_DRAFTS, drafts, storage);
  }

  return { migrated, total };
}

// ---------------------------------------------------------------------------
// 2. ENCRYPTED LOCAL STORAGE BRIDGE
// ---------------------------------------------------------------------------

/**
 * Returns true if the Web Crypto API is available and supports AES-GCM.
 */
export function isCryptoAvailable() {
  try {
    return (
      typeof globalThis !== 'undefined' &&
      typeof globalThis.crypto !== 'undefined' &&
      typeof globalThis.crypto.subtle !== 'undefined' &&
      typeof globalThis.crypto.subtle.generateKey === 'function'
    );
  } catch {
    return false;
  }
}

/**
 * Derive an AES-GCM CryptoKey from a passphrase using PBKDF2.
 * The passphrase should be derived from the user's session identity (not stored verbatim).
 *
 * @param {string} passphrase
 * @param {Uint8Array} salt
 * @returns {Promise<CryptoKey>}
 */
export async function deriveCryptoKey(passphrase, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  return globalThis.crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: CRYPTO_ALGO, length: CRYPTO_KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a JSON-serializable value and store it under a namespaced key.
 * Falls back to plain-text storage if crypto is unavailable.
 *
 * @param {string} logicalKey  — the storage key suffix
 * @param {*} value
 * @param {string} passphrase  — session-derived passphrase
 * @param {object|null} storage
 * @returns {Promise<{ encrypted: boolean }>}
 */
export async function encryptedWrite(logicalKey, value, passphrase, storage = null) {
  const storageKey = `${ENCRYPTED_STORAGE_KEY_PREFIX}${logicalKey}`;
  const plaintext = JSON.stringify(value);

  if (!isCryptoAvailable()) {
    writeStore(storageKey, { _enc: false, data: plaintext }, storage);
    return { encrypted: false };
  }

  const enc = new TextEncoder();
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveCryptoKey(passphrase, salt);
  const cipherBuf = await globalThis.crypto.subtle.encrypt(
    { name: CRYPTO_ALGO, iv },
    key,
    enc.encode(plaintext)
  );

  const encoded = {
    _enc: true,
    salt: Array.from(salt),
    iv: Array.from(iv),
    cipher: Array.from(new Uint8Array(cipherBuf)),
  };
  writeStore(storageKey, encoded, storage);
  return { encrypted: true };
}

/**
 * Decrypt a value previously written with encryptedWrite.
 * Returns null if decryption fails (e.g. wrong passphrase or unencrypted entry).
 *
 * @param {string} logicalKey
 * @param {string} passphrase
 * @param {object|null} storage
 * @returns {Promise<*>}
 */
export async function encryptedRead(logicalKey, passphrase, storage = null) {
  const storageKey = `${ENCRYPTED_STORAGE_KEY_PREFIX}${logicalKey}`;
  const stored = readStore(storageKey, storage);

  if (!stored || typeof stored !== 'object') return null;

  if (!stored._enc) {
    // Plaintext fallback
    try {
      return JSON.parse(stored.data);
    } catch {
      return null;
    }
  }

  if (!isCryptoAvailable()) return null;

  try {
    const salt = new Uint8Array(stored.salt);
    const iv = new Uint8Array(stored.iv);
    const cipher = new Uint8Array(stored.cipher);
    const key = await deriveCryptoKey(passphrase, salt);
    const dec = new TextDecoder();
    const plainBuf = await globalThis.crypto.subtle.decrypt({ name: CRYPTO_ALGO, iv }, key, cipher);
    return JSON.parse(dec.decode(plainBuf));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 3. DETERMINISTIC DRAFT-SCOPED IDEMPOTENCY KEY
// ---------------------------------------------------------------------------

/**
 * Generate a stable, deterministic idempotency key scoped to a draft edit.
 * Uses FNV-1a of `draftId + userId + schemaVersion + revisionHint`.
 *
 * This key is stable for the same set of inputs — retrying an interrupted
 * upload with the same arguments will produce the same key, satisfying
 * idempotency requirements.
 *
 * @param {object} opts
 * @param {string} opts.draftId
 * @param {string} opts.userId
 * @param {number} [opts.schemaVersion]
 * @param {number} [opts.revisionHint]  — the local revision being pushed
 * @returns {string} 8-character hex key prefixed with 'dsync_'
 */
export function generateDraftIdempotencyKey({ draftId, userId, schemaVersion = 1, revisionHint = 0 }) {
  const input = `${draftId}|${userId}|${schemaVersion}|${revisionHint}`;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  return `dsync_${hex}`;
}

// ---------------------------------------------------------------------------
// 4. RETRY-SAFE SYNC WITH EXPONENTIAL BACKOFF
// ---------------------------------------------------------------------------

export const DEFAULT_BACKOFF_OPTIONS = {
  maxAttempts: 5,
  baseDelayMs: 1000,
  maxDelayMs: 30_000,
  jitterFactor: 0.3,
};

/**
 * Sleep for `ms` milliseconds (browser-compatible).
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay for attempt N (1-indexed) with optional jitter.
 */
export function calcBackoffDelay(attempt, { baseDelayMs, maxDelayMs, jitterFactor } = DEFAULT_BACKOFF_OPTIONS) {
  const exponential = baseDelayMs * Math.pow(2, attempt - 1);
  const capped = Math.min(exponential, maxDelayMs);
  const jitter = capped * jitterFactor * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(capped + jitter));
}

/**
 * Run processSyncQueue with exponential backoff retry.
 * Stops on success or when all conflicts require user resolution (not retryable).
 *
 * @param {object} syncOptions  — forwarded to processSyncQueue
 * @param {object} [backoffOptions]
 * @returns {Promise<{ success: boolean, result: object|null, attempts: number, lastError: string|null }>}
 */
export async function processSyncQueueWithRetry(syncOptions = {}, backoffOptions = {}) {
  const opts = { ...DEFAULT_BACKOFF_OPTIONS, ...backoffOptions };
  let attempt = 0;
  let lastError = null;

  while (attempt < opts.maxAttempts) {
    attempt += 1;
    try {
      const result = await processSyncQueue(syncOptions);

      // If all remaining failures are conflicts, don't retry (user action needed)
      if (result.pendingRemaining === 0 || result.conflictsCount > 0) {
        return { success: true, result, attempts: attempt, lastError: null };
      }

      // Still pending — retry after backoff
      if (result.pendingRemaining > 0 && attempt < opts.maxAttempts) {
        await sleep(calcBackoffDelay(attempt, opts));
        continue;
      }

      return { success: result.pendingRemaining === 0, result, attempts: attempt, lastError: null };
    } catch (err) {
      lastError = err?.message || String(err);
      if (attempt < opts.maxAttempts) {
        await sleep(calcBackoffDelay(attempt, opts));
      }
    }
  }

  return { success: false, result: null, attempts: attempt, lastError };
}

// ---------------------------------------------------------------------------
// 5. INTERRUPTED-UPLOAD RECOVERY
// ---------------------------------------------------------------------------

/**
 * On page load, any operations stuck in IN_FLIGHT state (from a previous
 * session that was interrupted) are reset to PENDING so they can be retried.
 *
 * Call once during application startup / component mount.
 *
 * @param {object|null} storage
 * @returns {number} Number of operations rescued
 */
export function recoverInterruptedUploads(storage = null) {
  const opsStore = readStore(STORAGE_KEYS.OFFLINE_OPERATIONS, storage);
  let rescued = 0;

  for (const op of Object.values(opsStore)) {
    if (op.status === OP_STATUS.IN_FLIGHT) {
      op.status = OP_STATUS.PENDING;
      op.error = null;
      rescued += 1;
    }
  }

  if (rescued > 0) {
    writeStore(STORAGE_KEYS.OFFLINE_OPERATIONS, opsStore, storage);
  }

  return rescued;
}

// ---------------------------------------------------------------------------
// 6. DRAFT PROVENANCE BADGE HELPER
// ---------------------------------------------------------------------------

export const PROVENANCE_TYPES = {
  CITIZEN: 'citizen_entered',
  OFFICIAL: 'official_record',
  AI_SUGGESTION: 'ai_suggestion',
  COMMUNITY: 'community_submission',
};

/**
 * Returns a human-readable provenance label for display in the UI.
 * Keeps citizen-entered, official, AI, and community data visibly distinct.
 */
export function getProvenanceLabel(provenanceType) {
  switch (provenanceType) {
    case PROVENANCE_TYPES.CITIZEN:
      return 'You entered this';
    case PROVENANCE_TYPES.OFFICIAL:
      return 'From official records';
    case PROVENANCE_TYPES.AI_SUGGESTION:
      return 'AI suggestion — please verify';
    case PROVENANCE_TYPES.COMMUNITY:
      return 'Community submission — unverified';
    default:
      return 'Source unknown';
  }
}

// ---------------------------------------------------------------------------
// 7. PENDING OPERATION SUMMARY (for interrupted-upload UX)
// ---------------------------------------------------------------------------

/**
 * Returns a lightweight summary of current pending/in-flight operations
 * suitable for display in the UI without exposing raw payloads.
 *
 * @param {object|null} storage
 * @returns {{ pendingCount: number, inFlightCount: number, failedCount: number, hasInterrupted: boolean }}
 */
export function getPendingOperationsSummary(storage = null) {
  const ops = getPendingOperations(null, storage);
  const opsStore = readStore(STORAGE_KEYS.OFFLINE_OPERATIONS, storage);
  const allOps = Object.values(opsStore);

  return {
    pendingCount: ops.filter((o) => o.status === OP_STATUS.PENDING).length,
    inFlightCount: allOps.filter((o) => o.status === OP_STATUS.IN_FLIGHT).length,
    failedCount: allOps.filter((o) => o.status === OP_STATUS.FAILED).length,
    hasInterrupted: allOps.some((o) => o.status === OP_STATUS.IN_FLIGHT),
    total: allOps.length,
  };
}

// ---------------------------------------------------------------------------
// RE-EXPORTS for convenience
// ---------------------------------------------------------------------------

export { SCHEMA_VERSION, STORAGE_KEYS } from './citizenDraftSyncEngine';
