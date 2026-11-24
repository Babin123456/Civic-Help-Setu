import { logDiagnostic } from '../../src/utils/diagnostics.js';
import { getFirestoreAdmin } from './firebaseAdmin.js';

export const MANIFEST_SCHEMA_VERSION = 'partner_manifest_v1';
export const INGESTION_POLICY_VERSION = 'ingestion_boundary_v1';

export const DATA_CLASSIFICATIONS = Object.freeze({
  PUBLIC: 'PUBLIC',
  OFFICIAL: 'OFFICIAL',
  RESTRICTED: 'RESTRICTED',
});

export const BATCH_STATUS = Object.freeze({
  ACCEPTED: 'ACCEPTED',
  QUARANTINED: 'QUARANTINED',
  PROMOTED: 'PROMOTED',
});

export const REASON_CODES = Object.freeze({
  // Step 1: Schema version & required fields
  ERR_SCHEMA_INVALID: 'ERR_SCHEMA_INVALID',
  ERR_REQUIRED_FIELD_MISSING: 'ERR_REQUIRED_FIELD_MISSING',

  // Step 2: Signature verification
  ERR_SIGNATURE_INVALID: 'ERR_SIGNATURE_INVALID',
  ERR_SIGNATURE_MALFORMED: 'ERR_SIGNATURE_MALFORMED',

  // Step 3: Partner + key status & revocation check
  ERR_PARTNER_UNKNOWN: 'ERR_PARTNER_UNKNOWN',
  ERR_PARTNER_INACTIVE: 'ERR_PARTNER_INACTIVE',
  ERR_KEY_NOT_FOUND: 'ERR_KEY_NOT_FOUND',
  ERR_KEY_REVOKED: 'ERR_KEY_REVOKED',

  // Step 4: Manifest validity window & expiry
  ERR_MANIFEST_NOT_YET_VALID: 'ERR_MANIFEST_NOT_YET_VALID',
  ERR_MANIFEST_EXPIRED: 'ERR_MANIFEST_EXPIRED',
  ERR_VALIDITY_WINDOW_EXCEEDED: 'ERR_VALIDITY_WINDOW_EXCEEDED',

  // Step 5: Atomic nonce replay check & consume
  ERR_NONCE_REPLAYED: 'ERR_NONCE_REPLAYED',

  // Step 6: Per-file SHA-256 checksum & size verification
  ERR_FILE_MISSING: 'ERR_FILE_MISSING',
  ERR_FILE_SIZE_MISMATCH: 'ERR_FILE_SIZE_MISMATCH',
  ERR_FILE_CHECKSUM_MISMATCH: 'ERR_FILE_CHECKSUM_MISMATCH',

  // Step 7: Declared data classification check
  ERR_DATA_CLASSIFICATION_INVALID: 'ERR_DATA_CLASSIFICATION_INVALID',
  ERR_DATA_CLASSIFICATION_UNAUTHORIZED: 'ERR_DATA_CLASSIFICATION_UNAUTHORIZED',

  // Promotion guards
  ERR_PROMOTION_QUARANTINED: 'ERR_PROMOTION_QUARANTINED',
  ERR_DURABLE_STORAGE_REQUIRED: 'ERR_DURABLE_STORAGE_REQUIRED',
});

/**
 * Computes SHA-256 hex digest using Web Crypto (crypto.subtle).
 */
export const computeSha256Hex = async (data) => {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

/**
 * Produces canonical sorted JSON string of a manifest (excluding signature).
 */
export const canonicalizeManifest = (manifest = {}) => {
  const clone = { ...manifest };
  delete clone.signature;
  const sortedKeys = Object.keys(clone).sort();
  const sortedObj = {};
  for (const k of sortedKeys) {
    sortedObj[k] = clone[k];
  }
  return JSON.stringify(sortedObj);
};

/**
 * Signs canonical manifest string using HMAC-SHA256 via Web Crypto.
 */
export const signManifestHmac = async (canonicalStr, secretKey) => {
  const enc = new TextEncoder();
  const keyBytes = typeof secretKey === 'string' ? enc.encode(secretKey) : secretKey;
  const cryptoKey = await globalThis.crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await globalThis.crypto.subtle.sign('HMAC', cryptoKey, enc.encode(canonicalStr));
  return Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

/**
 * Verifies manifest signature using HMAC-SHA256 via Web Crypto.
 */
export const verifyManifestHmac = async (canonicalStr, signatureHex, secretKey) => {
  try {
    if (typeof signatureHex !== 'string' || !/^[0-9a-fA-F]+$/.test(signatureHex) || signatureHex.length % 2 !== 0) {
      return false;
    }
    const enc = new TextEncoder();
    const keyBytes = typeof secretKey === 'string' ? enc.encode(secretKey) : secretKey;
    const cryptoKey = await globalThis.crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const sigBytes = new Uint8Array(
      signatureHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
    );
    return await globalThis.crypto.subtle.verify('HMAC', cryptoKey, sigBytes, enc.encode(canonicalStr));
  } catch {
    return false;
  }
};

/**
 * In-memory storage adapter for partner key registry, nonces, and batches.
 * Process-local only: has `isDurable: false`.
 */
export const createMemoryStorageAdapter = ({ now = () => Date.now() } = {}) => {
  const partners = new Map();
  const keys = new Map(); // `${partnerId}:${keyId}` -> keyRecord
  const nonces = new Map(); // `${partnerId}:${nonce}` -> expiresAtMs
  const batches = new Map();

  return {
    isDurable: false,

    async getPartner(partnerId) {
      return partners.get(partnerId) || null;
    },
    async registerPartner(partner) {
      partners.set(partner.partnerId, { status: 'ACTIVE', ...partner });
      return true;
    },

    async getKey(partnerId, keyId) {
      return keys.get(`${partnerId}:${keyId}`) || null;
    },
    async registerKey(keyRecord) {
      keys.set(`${keyRecord.partnerId}:${keyRecord.keyId}`, {
        status: 'ACTIVE',
        revoked: false,
        ...keyRecord,
      });
      return true;
    },
    async revokeKey(partnerId, keyId) {
      const rec = keys.get(`${partnerId}:${keyId}`);
      if (rec) {
        rec.revoked = true;
        rec.status = 'REVOKED';
        keys.set(`${partnerId}:${keyId}`, rec);
      }
      return true;
    },

    /**
     * Atomically checks and consumes a nonce. Returns false if already consumed.
     */
    async consumeNonce(partnerId, nonce, expiresAtMs, checkTime = now()) {
      const compoundKey = `${partnerId}:${nonce}`;
      const currentTime = typeof checkTime === 'number' ? checkTime : now();
      // Purge if expired
      if (nonces.has(compoundKey) && nonces.get(compoundKey) < currentTime) {
        nonces.delete(compoundKey);
      }
      if (nonces.has(compoundKey)) {
        return false;
      }
      nonces.set(compoundKey, expiresAtMs);
      return true;
    },

    async getBatch(batchId) {
      return batches.get(batchId) || null;
    },
    async saveBatch(batch) {
      batches.set(batch.batchId, JSON.parse(JSON.stringify(batch)));
      return true;
    },

    async read(key) {
      return batches.get(key) || null;
    },
    async write(key, val) {
      batches.set(key, JSON.parse(JSON.stringify(val)));
      return true;
    },
    async remove(key) {
      return batches.delete(key);
    },
  };
};

/**
 * Validates and wraps a durable storage adapter.
 */
export const createIngestionStorageAdapter = (adapter) => {
  if (
    !adapter ||
    typeof adapter.read !== 'function' ||
    typeof adapter.write !== 'function' ||
    typeof adapter.consumeNonce !== 'function'
  ) {
    throw new TypeError('Ingestion storage adapter requires read, write, and consumeNonce functions.');
  }
  return {
    ...adapter,
    isDurable: true,
  };
};

/**
 * Durable Firestore storage adapter for partner ingestion (#1275 Slice 2).
 * Reuses Firebase Admin patterns, safely falls back to memory adapter when unconfigured or failing.
 */
export const createFirestoreIngestionStorageAdapter = ({
  getDb = getFirestoreAdmin,
  db = null,
  collectionPrefix = 'partnerIngestion',
  now = () => Date.now(),
  fallbackToMemory = true,
} = {}) => {
  let firestoreInstance = db;
  let initAttempted = Boolean(db);
  const memoryFallback = createMemoryStorageAdapter({ now });

  const resolveDb = async () => {
    if (initAttempted) return firestoreInstance;
    initAttempted = true;
    try {
      if (typeof getDb === 'function') {
        firestoreInstance = await getDb();
      }
    } catch (err) {
      logDiagnostic('Failed initializing Firestore for partner ingestion', err);
      firestoreInstance = null;
    }
    if (!firestoreInstance && fallbackToMemory) {
      logDiagnostic('Firestore not configured for partner ingestion; operating in memory fallback mode');
    }
    return firestoreInstance;
  };

  const sanitizeDocId = (id) => String(id).replace(/[/]/g, '_');

  return {
    get isDurable() {
      return Boolean(firestoreInstance);
    },

    async getPartner(partnerId) {
      const database = await resolveDb();
      if (!database) return memoryFallback.getPartner(partnerId);
      try {
        const snap = await database.collection(`${collectionPrefix}_partners`).doc(sanitizeDocId(partnerId)).get();
        if (!snap.exists) return null;
        return snap.data();
      } catch (err) {
        logDiagnostic('Firestore error getting partner', err);
        return memoryFallback.getPartner(partnerId);
      }
    },

    async registerPartner(partner) {
      const database = await resolveDb();
      if (!database) return memoryFallback.registerPartner(partner);
      try {
        const docRef = database.collection(`${collectionPrefix}_partners`).doc(sanitizeDocId(partner.partnerId));
        const data = { status: 'ACTIVE', ...partner };
        await docRef.set(data);
        return true;
      } catch (err) {
        logDiagnostic('Firestore error registering partner', err);
        return memoryFallback.registerPartner(partner);
      }
    },

    async getKey(partnerId, keyId) {
      const database = await resolveDb();
      if (!database) return memoryFallback.getKey(partnerId, keyId);
      try {
        const docId = sanitizeDocId(`${partnerId}:${keyId}`);
        const snap = await database.collection(`${collectionPrefix}_keys`).doc(docId).get();
        if (!snap.exists) return null;
        return snap.data();
      } catch (err) {
        logDiagnostic('Firestore error getting key', err);
        return memoryFallback.getKey(partnerId, keyId);
      }
    },

    async registerKey(keyRecord) {
      const database = await resolveDb();
      if (!database) return memoryFallback.registerKey(keyRecord);
      try {
        const docId = sanitizeDocId(`${keyRecord.partnerId}:${keyRecord.keyId}`);
        const data = { status: 'ACTIVE', revoked: false, ...keyRecord };
        await database.collection(`${collectionPrefix}_keys`).doc(docId).set(data);
        return true;
      } catch (err) {
        logDiagnostic('Firestore error registering key', err);
        return memoryFallback.registerKey(keyRecord);
      }
    },

    async revokeKey(partnerId, keyId) {
      const database = await resolveDb();
      if (!database) return memoryFallback.revokeKey(partnerId, keyId);
      try {
        const docId = sanitizeDocId(`${partnerId}:${keyId}`);
        const ref = database.collection(`${collectionPrefix}_keys`).doc(docId);
        const snap = await ref.get();
        if (snap.exists) {
          await ref.update({ revoked: true, status: 'REVOKED' });
        }
        return true;
      } catch (err) {
        logDiagnostic('Firestore error revoking key', err);
        return memoryFallback.revokeKey(partnerId, keyId);
      }
    },

    async consumeNonce(partnerId, nonce, expiresAtMs, checkTime = now()) {
      const database = await resolveDb();
      if (!database) return memoryFallback.consumeNonce(partnerId, nonce, expiresAtMs, checkTime);
      const docId = sanitizeDocId(`${partnerId}:${nonce}`);
      const ref = database.collection(`${collectionPrefix}_nonces`).doc(docId);
      const currentTime = typeof checkTime === 'number' ? checkTime : now();

      try {
        if (typeof database.runTransaction === 'function') {
          return await database.runTransaction(async (transaction) => {
            const snap = await transaction.get(ref);
            if (snap.exists) {
              const existing = snap.data();
              if (existing && existing.expiresAtMs && existing.expiresAtMs >= currentTime) {
                return false; // Replay detected!
              }
            }
            transaction.set(ref, {
              partnerId,
              nonce,
              expiresAtMs,
              consumedAt: currentTime,
            });
            return true;
          });
        }

        const snap = await ref.get();
        if (snap.exists) {
          const existing = snap.data();
          if (existing && existing.expiresAtMs && existing.expiresAtMs >= currentTime) {
            return false;
          }
        }
        await ref.set({
          partnerId,
          nonce,
          expiresAtMs,
          consumedAt: currentTime,
        });
        return true;
      } catch (err) {
        logDiagnostic('Firestore error consuming nonce', err);
        return memoryFallback.consumeNonce(partnerId, nonce, expiresAtMs, checkTime);
      }
    },

    async getBatch(batchId) {
      const database = await resolveDb();
      if (!database) return memoryFallback.getBatch(batchId);
      try {
        const snap = await database.collection(`${collectionPrefix}_batches`).doc(sanitizeDocId(batchId)).get();
        if (!snap.exists) return null;
        return snap.data();
      } catch (err) {
        logDiagnostic('Firestore error getting batch', err);
        return memoryFallback.getBatch(batchId);
      }
    },

    async saveBatch(batch) {
      const database = await resolveDb();
      if (!database) return memoryFallback.saveBatch(batch);
      try {
        await database.collection(`${collectionPrefix}_batches`).doc(sanitizeDocId(batch.batchId)).set(batch);
        return true;
      } catch (err) {
        logDiagnostic('Firestore error saving batch', err);
        return memoryFallback.saveBatch(batch);
      }
    },

    async read(key) {
      return this.getBatch(key);
    },
    async write(key, val) {
      return this.saveBatch({ batchId: key, ...val });
    },
    async remove(key) {
      const database = await resolveDb();
      if (!database) return memoryFallback.remove(key);
      try {
        await database.collection(`${collectionPrefix}_batches`).doc(sanitizeDocId(key)).delete();
        return true;
      } catch (err) {
        logDiagnostic('Firestore error deleting record', err);
        return memoryFallback.remove(key);
      }
    },
  };
};

/**
 * Secure Partner Data Ingestion Boundary Engine.
 */
export const createPartnerIngestionBoundary = ({
  storage = createMemoryStorageAdapter(),
  maxValidityWindowMs = 24 * 60 * 60 * 1000, // 24 hours
  audit = () => {},
  now = () => Date.now(),
} = {}) => {
  let queue = Promise.resolve();
  const withLock = (fn) => {
    const next = queue.then(fn, fn);
    queue = next.catch(() => {});
    return next;
  };

  const metrics = {
    totalProcessed: 0,
    acceptedCount: 0,
    quarantinedCount: 0,
    replaysPrevented: 0,
    revokedKeyAttempts: 0,
    reasonCodeCounts: {},
  };

  const recordReasonMetric = (code) => {
    metrics.reasonCodeCounts[code] = (metrics.reasonCodeCounts[code] || 0) + 1;
    if (code === REASON_CODES.ERR_NONCE_REPLAYED) metrics.replaysPrevented += 1;
    if (code === REASON_CODES.ERR_KEY_REVOKED) metrics.revokedKeyAttempts += 1;
  };

  return {
    /**
     * Verifies an incoming partner package following the fixed 7-step order.
     */
    async verifyAndIngestPackage(pkg = {}) {
      const currentTime = now();
      const manifest = pkg.manifest || {};
      const files = pkg.files || {};
      const signature = pkg.signature || manifest.signature;

      metrics.totalProcessed += 1;

      return withLock(async () => {
        let manifestDigest = 'unknown_digest';
        try {
          manifestDigest = await computeSha256Hex(canonicalizeManifest(manifest));
        } catch {
          // Keep fallback digest
        }

        const batchId = manifest.manifestId ? `pkg_${manifest.manifestId}` : `pkg_err_${currentTime}`;

        const makeDecision = async (step, reasonCode, message, details = {}) => {
          recordReasonMetric(reasonCode);
          metrics.quarantinedCount += 1;

          const batchRecord = {
            batchId,
            manifestDigest,
            partnerId: manifest.partnerId || 'unknown',
            keyId: manifest.keyId || 'unknown',
            schemaVersion: manifest.schemaVersion || 'unknown',
            policyVersion: INGESTION_POLICY_VERSION,
            status: BATCH_STATUS.QUARANTINED,
            decision: 'QUARANTINED',
            failureStep: step,
            reasonCodes: [reasonCode],
            message,
            details,
            receivedAt: new Date(currentTime).toISOString(),
            verifiedAt: new Date(currentTime).toISOString(),
            promotedAt: null,
            // Strictly non-PII: sensitive payload content and keys are omitted
          };

          try {
            await storage.saveBatch(batchRecord);
          } catch (err) {
            logDiagnostic('Failed saving quarantined batch record', err);
          }

          audit({
            action: 'PARTNER_PACKAGE_QUARANTINED',
            batchId,
            manifestDigest,
            partnerId: batchRecord.partnerId,
            keyId: batchRecord.keyId,
            failureStep: step,
            reasonCodes: [reasonCode],
            recordedAt: batchRecord.verifiedAt,
          });

          return {
            ok: false,
            status: 400,
            decision: 'QUARANTINED',
            batchId,
            failureStep: step,
            reasonCodes: [reasonCode],
            message,
          };
        };

        // -------------------------------------------------------------
        // STEP 1: Schema version & required fields
        // -------------------------------------------------------------
        if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
          return makeDecision(1, REASON_CODES.ERR_SCHEMA_INVALID, 'Manifest must be a JSON object.');
        }

        if (manifest.schemaVersion !== MANIFEST_SCHEMA_VERSION) {
          return makeDecision(1, REASON_CODES.ERR_SCHEMA_INVALID, `Unsupported schemaVersion: ${manifest.schemaVersion}. Expected ${MANIFEST_SCHEMA_VERSION}.`);
        }

        const requiredFields = [
          'manifestId',
          'partnerId',
          'keyId',
          'issuedAt',
          'expiresAt',
          'nonce',
          'files',
          'dataClassification',
        ];
        for (const field of requiredFields) {
          if (!manifest[field]) {
            return makeDecision(1, REASON_CODES.ERR_REQUIRED_FIELD_MISSING, `Missing required manifest field: ${field}.`, { missingField: field });
          }
        }

        if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
          return makeDecision(1, REASON_CODES.ERR_SCHEMA_INVALID, 'Manifest `files` must be a non-empty array of file descriptors.');
        }

        for (const fileDesc of manifest.files) {
          if (!fileDesc.name || !fileDesc.sha256 || typeof fileDesc.sizeBytes !== 'number') {
            return makeDecision(1, REASON_CODES.ERR_SCHEMA_INVALID, 'Each file descriptor must include name, sha256, and sizeBytes.');
          }
        }

        // -------------------------------------------------------------
        // STEP 2: Signature verification
        // -------------------------------------------------------------
        if (
          !signature ||
          typeof signature !== 'string' ||
          signature.length % 2 !== 0 ||
          !/^[0-9a-f]+$/i.test(signature)
        ) {
          return makeDecision(2, REASON_CODES.ERR_SIGNATURE_MALFORMED, 'Missing or malformed manifest signature.');
        }

        let keyRecord = null;
        try {
          keyRecord = await storage.getKey(manifest.partnerId, manifest.keyId);
        } catch (err) {
          logDiagnostic('Failed reading key from storage', err);
        }

        if (!keyRecord || !keyRecord.secretKey) {
          return makeDecision(2, REASON_CODES.ERR_SIGNATURE_INVALID, 'Signature verification failed; matching key not available.');
        }

        const canonicalStr = canonicalizeManifest(manifest);
        const signatureValid = await verifyManifestHmac(canonicalStr, signature, keyRecord.secretKey);
        if (!signatureValid) {
          return makeDecision(2, REASON_CODES.ERR_SIGNATURE_INVALID, 'Cryptographic signature verification failed.');
        }

        // -------------------------------------------------------------
        // STEP 3: Partner + key status & revocation check
        // -------------------------------------------------------------
        let partnerRecord = null;
        try {
          partnerRecord = await storage.getPartner(manifest.partnerId);
        } catch (err) {
          logDiagnostic('Failed reading partner from storage', err);
        }

        if (!partnerRecord) {
          return makeDecision(3, REASON_CODES.ERR_PARTNER_UNKNOWN, `Partner ${manifest.partnerId} is not registered.`);
        }
        if (partnerRecord.status !== 'ACTIVE') {
          return makeDecision(3, REASON_CODES.ERR_PARTNER_INACTIVE, `Partner ${manifest.partnerId} is not active.`);
        }

        if (keyRecord.revoked || keyRecord.status === 'REVOKED') {
          return makeDecision(3, REASON_CODES.ERR_KEY_REVOKED, `Key ${manifest.keyId} for partner ${manifest.partnerId} has been revoked.`);
        }

        // -------------------------------------------------------------
        // STEP 4: Manifest validity window/expiry
        // -------------------------------------------------------------
        const issuedAtMs = Date.parse(manifest.issuedAt);
        const expiresAtMs = Date.parse(manifest.expiresAt);

        if (Number.isNaN(issuedAtMs) || Number.isNaN(expiresAtMs)) {
          return makeDecision(4, REASON_CODES.ERR_SCHEMA_INVALID, 'issuedAt or expiresAt is not a valid ISO date string.');
        }

        if (currentTime < issuedAtMs) {
          return makeDecision(4, REASON_CODES.ERR_MANIFEST_NOT_YET_VALID, 'Manifest is not yet valid.');
        }

        if (currentTime > expiresAtMs) {
          return makeDecision(4, REASON_CODES.ERR_MANIFEST_EXPIRED, 'Manifest has expired.');
        }

        if (expiresAtMs - issuedAtMs > maxValidityWindowMs) {
          return makeDecision(4, REASON_CODES.ERR_VALIDITY_WINDOW_EXCEEDED, `Manifest validity window exceeds maximum allowed of ${maxValidityWindowMs}ms.`);
        }

        // -------------------------------------------------------------
        // STEP 5: Atomic nonce replay check & consume
        // -------------------------------------------------------------
        let nonceConsumed = false;
        try {
          nonceConsumed = await storage.consumeNonce(manifest.partnerId, manifest.nonce, expiresAtMs, currentTime);
        } catch (err) {
          logDiagnostic('Failed consuming nonce in storage', err);
        }

        if (!nonceConsumed) {
          return makeDecision(5, REASON_CODES.ERR_NONCE_REPLAYED, `Nonce ${manifest.nonce} has already been consumed for partner ${manifest.partnerId}.`);
        }

        // -------------------------------------------------------------
        // STEP 6: Per-file SHA-256 checksum & size verification
        // -------------------------------------------------------------
        for (const fileDesc of manifest.files) {
          const fileData = typeof files.get === 'function' ? files.get(fileDesc.name) : files[fileDesc.name];
          if (fileData === undefined || fileData === null) {
            return makeDecision(6, REASON_CODES.ERR_FILE_MISSING, `Package is missing required file: ${fileDesc.name}.`, { fileName: fileDesc.name });
          }

          const fileBytes = typeof fileData === 'string' ? new TextEncoder().encode(fileData) : fileData;
          if (fileBytes.byteLength !== fileDesc.sizeBytes) {
            return makeDecision(6, REASON_CODES.ERR_FILE_SIZE_MISMATCH, `File ${fileDesc.name} size (${fileBytes.byteLength} bytes) does not match manifest (${fileDesc.sizeBytes} bytes).`, { fileName: fileDesc.name });
          }

          const actualSha256 = await computeSha256Hex(fileBytes);
          if (actualSha256.toLowerCase() !== fileDesc.sha256.toLowerCase()) {
            return makeDecision(6, REASON_CODES.ERR_FILE_CHECKSUM_MISMATCH, `File ${fileDesc.name} SHA-256 checksum mismatch.`, { fileName: fileDesc.name });
          }
        }

        // -------------------------------------------------------------
        // STEP 7: Declared data classification check
        // -------------------------------------------------------------
        if (!DATA_CLASSIFICATIONS[manifest.dataClassification]) {
          return makeDecision(7, REASON_CODES.ERR_DATA_CLASSIFICATION_INVALID, `Invalid data classification: ${manifest.dataClassification}.`);
        }

        const allowedClassifications = partnerRecord.allowedClassifications || Object.values(DATA_CLASSIFICATIONS);
        if (!allowedClassifications.includes(manifest.dataClassification)) {
          return makeDecision(7, REASON_CODES.ERR_DATA_CLASSIFICATION_UNAUTHORIZED, `Partner ${manifest.partnerId} is not authorized for classification: ${manifest.dataClassification}.`);
        }

        // -------------------------------------------------------------
        // SUCCESS: All 7 steps verified
        // -------------------------------------------------------------
        metrics.acceptedCount += 1;

        const acceptedRecord = {
          batchId,
          manifestDigest,
          partnerId: manifest.partnerId,
          keyId: manifest.keyId,
          schemaVersion: manifest.schemaVersion,
          policyVersion: INGESTION_POLICY_VERSION,
          dataClassification: manifest.dataClassification,
          status: BATCH_STATUS.ACCEPTED,
          decision: 'PROMOTE_ELIGIBLE',
          failureStep: null,
          reasonCodes: [],
          fileCount: manifest.files.length,
          receivedAt: new Date(currentTime).toISOString(),
          verifiedAt: new Date(currentTime).toISOString(),
          promotedAt: null,
        };

        try {
          await storage.saveBatch(acceptedRecord);
        } catch (err) {
          logDiagnostic('Failed saving accepted batch record', err);
        }

        audit({
          action: 'PARTNER_PACKAGE_ACCEPTED',
          batchId,
          manifestDigest,
          partnerId: manifest.partnerId,
          keyId: manifest.keyId,
          dataClassification: manifest.dataClassification,
          recordedAt: acceptedRecord.verifiedAt,
        });

        return {
          ok: true,
          status: 200,
          decision: 'PROMOTE_ELIGIBLE',
          batchId,
          manifestDigest,
          record: acceptedRecord,
        };
      });
    },

    /**
     * Promotes a verified batch to downstream ingestion.
     * Enforces the fail-closed production rule: blocks promotion if in-memory
     * storage is used in production.
     */
    async promoteBatch(batchId, {
      environment = (typeof globalThis.process !== 'undefined' ? globalThis.process.env?.NODE_ENV : 'development'),
      allowMemoryInProduction = false,
    } = {}) {
      const currentTime = now();

      return withLock(async () => {
        let batch = null;
        try {
          batch = await storage.getBatch(batchId);
        } catch (err) {
          logDiagnostic('Failed reading batch from storage', err);
        }

        if (!batch) {
          return { ok: false, status: 404, error: 'batch_not_found', message: `Batch ${batchId} not found.` };
        }

        // Quarantined batches can never be promoted
        if (batch.status !== BATCH_STATUS.ACCEPTED) {
          return {
            ok: false,
            status: 400,
            error: 'cannot_promote_quarantined_batch',
            reasonCode: REASON_CODES.ERR_PROMOTION_QUARANTINED,
            message: 'Quarantined or rejected partner batches can never be promoted.',
          };
        }

        // Fail-closed production enforcement
        const isProduction = environment === 'production';
        if (isProduction && !storage.isDurable && !allowMemoryInProduction) {
          throw new Error('FAIL_CLOSED_PRODUCTION_DURABLE_STORAGE_REQUIRED: In-memory storage is process-local and cannot guarantee replay safety in production. A durable storage adapter is required.');
        }

        batch.status = BATCH_STATUS.PROMOTED;
        batch.promotedAt = new Date(currentTime).toISOString();
        batch.decision = 'PROMOTED';

        try {
          await storage.saveBatch(batch);
        } catch (err) {
          logDiagnostic('Failed saving promoted batch', err);
        }

        audit({
          action: 'PARTNER_BATCH_PROMOTED',
          batchId: batch.batchId,
          manifestDigest: batch.manifestDigest,
          partnerId: batch.partnerId,
          keyId: batch.keyId,
          recordedAt: batch.promotedAt,
        });

        return { ok: true, batch };
      });
    },

    /**
     * Retrieve batch record by batchId (strictly non-PII).
     */
    async getBatchRecord(batchId) {
      try {
        return await storage.getBatch(batchId);
      } catch (err) {
        logDiagnostic('Failed reading batch from storage', err);
        return null;
      }
    },

    /**
     * Returns observability metrics snapshot.
     */
    getMetrics() {
      return {
        ...metrics,
        reasonCodeCounts: { ...metrics.reasonCodeCounts },
      };
    },

    /**
     * Storage access helper.
     */
    getStorage() {
      return storage;
    },
  };
};

export const bearerToken = (headers = {}) => {
  const key = Object.keys(headers || {}).find((name) => name.toLowerCase() === 'authorization');
  const value = key ? headers[key] : '';
  const match =
    typeof value === 'string'
      ? /^Bearer ([A-Za-z0-9._~+/=-]{10,4096})$/.exec(value.trim())
      : null;
  return match ? match[1] : null;
};

const jsonResponse = (status, body, extra = {}) => ({
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
  body,
});

/**
 * Creates the HTTP handler for the partner ingestion boundary route (#1275 Slice 2).
 */
export const createPartnerIngestionHandler = ({
  boundary = createPartnerIngestionBoundary(),
  verifySession = null,
  ipLimiter = null,
  environment = 'development',
} = {}) => {
  return async ({ method, headers = {}, body = {}, query = {} } = {}) => {
    // 1. Rate limiting
    if (ipLimiter) {
      const address =
        (headers['x-vercel-forwarded-for'] || headers['x-forwarded-for'] || '')
          .split(',')[0]
          .trim() || 'unknown';
      const verdict = ipLimiter.take(address);
      if (!verdict.allowed) {
        return jsonResponse(429, { error: 'rate_limited', retryAfterSeconds: verdict.retryAfterSeconds }, {
          'Retry-After': String(verdict.retryAfterSeconds),
        });
      }
    }

    // 2. Authentication extraction
    const token = bearerToken(headers);
    let session = null;
    if (token && typeof verifySession === 'function') {
      try {
        session = await verifySession(token);
      } catch {
        session = null;
      }
    }

    // 3. GET routes
    if (method === 'GET') {
      if (query && query.metrics === 'true') {
        if (!session || session.role !== 'admin') {
          return jsonResponse(403, { error: 'forbidden', details: ['Admin authorization required to view ingestion metrics.'] });
        }
        return jsonResponse(200, { ok: true, metrics: boundary.getMetrics() });
      }

      if (query && query.batchId) {
        if (!session) {
          return jsonResponse(401, { error: 'unauthorized', details: ['Authentication required to inspect batch records.'] });
        }
        const record = await boundary.getBatchRecord(query.batchId);
        if (!record) {
          return jsonResponse(404, { error: 'batch_not_found', details: [`Batch ${query.batchId} not found.`] });
        }
        return jsonResponse(200, { ok: true, batch: { ...record } });
      }

      return jsonResponse(400, {
        error: 'invalid_request',
        details: ['Provide ?batchId=<id> to lookup a batch or ?metrics=true with admin authorization.'],
      });
    }

    // 4. POST routes
    if (method === 'POST') {
      // Admin batch promotion
      if (body && body.action === 'promote') {
        if (!session || session.role !== 'admin') {
          return jsonResponse(403, { error: 'forbidden', details: ['Admin authorization required to promote batches.'] });
        }
        if (!body.batchId) {
          return jsonResponse(400, { error: 'validation_failed', details: ['batchId is required for promotion.'] });
        }
        try {
          const result = await boundary.promoteBatch(body.batchId, { environment });
          if (!result.ok) {
            return jsonResponse(result.status || 400, {
              error: result.error || 'promotion_failed',
              reasonCode: result.reasonCode,
              message: result.message,
            });
          }
          return jsonResponse(200, { ok: true, batch: result.batch });
        } catch (err) {
          if (err.message && err.message.includes('FAIL_CLOSED_PRODUCTION_DURABLE_STORAGE_REQUIRED')) {
            return jsonResponse(500, {
              error: 'durable_storage_required',
              reasonCode: REASON_CODES.FAIL_CLOSED_PRODUCTION_DURABLE_STORAGE_REQUIRED,
              message: err.message,
            });
          }
          return jsonResponse(500, { error: 'internal_error', message: err.message });
        }
      }

      // Partner package ingestion & verification
      const result = await boundary.verifyAndIngestPackage(body);
      if (!result.ok) {
        return jsonResponse(400, {
          ok: false,
          decision: result.decision,
          batchId: result.batchId,
          failureStep: result.failureStep,
          reasonCodes: result.reasonCodes,
          message: result.message,
        });
      }

      return jsonResponse(200, {
        ok: true,
        decision: result.decision,
        batchId: result.batchId,
        record: result.record,
      });
    }

    return jsonResponse(405, { error: 'method_not_allowed' }, { Allow: 'GET, POST' });
  };
};
