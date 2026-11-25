/* global process */
/**
 * api/_lib/idempotencyStore.js
 *
 * Bounded in-memory and Firestore-backed idempotency record store for
 * Civic Help Setu serverless write APIs (#1335).
 */

import { getFirestoreAdmin } from './firebaseAdmin.js';

export const DEFAULT_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_MAX_KEYS = 5000;
export const DEFAULT_COLLECTION = 'api_idempotency_keys';

/**
 * In-memory bounded TTL store for local development, single-instance warm
 * containers, and deterministic unit/concurrency tests.
 */
export function createInMemoryIdempotencyStore({
  ttlMs = DEFAULT_IDEMPOTENCY_TTL_MS,
  maxKeys = DEFAULT_MAX_KEYS,
  now = Date.now,
} = {}) {
  const records = new Map();

  function sweepExpired(at) {
    for (const [key, entry] of records) {
      if (entry.expiresAt <= at) {
        records.delete(key);
      }
    }
    while (records.size >= maxKeys) {
      records.delete(records.keys().next().value);
    }
  }

  return {
    kind: 'memory',
    size: () => records.size,

    async get(scopedKey) {
      const at = now();
      const entry = records.get(scopedKey);
      if (!entry) return null;
      if (entry.expiresAt <= at) {
        records.delete(scopedKey);
        return null;
      }
      return entry;
    },

    async acquireLock(scopedKey, { payloadHash, lockTtlMs = 30_000 } = {}) {
      const at = now();
      const existing = records.get(scopedKey);
      if (existing && existing.expiresAt > at) {
        return { acquired: false, existing };
      }
      if (!existing && records.size >= maxKeys) {
        sweepExpired(at);
      }
      const record = {
        status: 'in_flight',
        payloadHash,
        createdAt: at,
        expiresAt: at + lockTtlMs,
      };
      records.set(scopedKey, record);
      return { acquired: true, existing: null };
    },

    async complete(scopedKey, { payloadHash, response, ttlOverrideMs } = {}) {
      const at = now();
      const effectiveTtl = Number.isFinite(ttlOverrideMs) && ttlOverrideMs > 0 ? ttlOverrideMs : ttlMs;
      if (!records.has(scopedKey) && records.size >= maxKeys) {
        sweepExpired(at);
      }
      const record = {
        status: 'completed',
        payloadHash,
        response,
        createdAt: at,
        expiresAt: at + effectiveTtl,
      };
      records.set(scopedKey, record);
      return record;
    },

    async release(scopedKey) {
      const entry = records.get(scopedKey);
      if (entry && entry.status === 'in_flight') {
        records.delete(scopedKey);
      }
    },
  };
}

/**
 * Firestore-backed idempotency store for cross-instance serverless persistence.
 */
export function createFirestoreIdempotencyStore({
  db,
  collectionName = DEFAULT_COLLECTION,
  ttlMs = DEFAULT_IDEMPOTENCY_TTL_MS,
  now = Date.now,
} = {}) {
  if (!db) {
    throw new TypeError('createFirestoreIdempotencyStore requires a Firestore db instance');
  }

  const col = () => db.collection(collectionName);

  return {
    kind: 'firestore',

    async get(scopedKey) {
      const snap = await col().doc(scopedKey).get();
      if (!snap.exists) return null;
      const data = snap.data();
      if (!data || data.expiresAt <= now()) {
        return null;
      }
      return data;
    },

    async acquireLock(scopedKey, { payloadHash, lockTtlMs = 30_000 } = {}) {
      const docRef = col().doc(scopedKey);
      const at = now();
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(docRef);
        if (snap.exists) {
          const data = snap.data();
          if (data && data.expiresAt > at) {
            return { acquired: false, existing: data };
          }
        }
        tx.set(docRef, {
          status: 'in_flight',
          payloadHash,
          createdAt: at,
          expiresAt: at + lockTtlMs,
        });
        return { acquired: true, existing: null };
      });
    },

    async complete(scopedKey, { payloadHash, response, ttlOverrideMs } = {}) {
      const at = now();
      const effectiveTtl = Number.isFinite(ttlOverrideMs) && ttlOverrideMs > 0 ? ttlOverrideMs : ttlMs;
      const record = {
        status: 'completed',
        payloadHash,
        response,
        createdAt: at,
        expiresAt: at + effectiveTtl,
      };
      await col().doc(scopedKey).set(record);
      return record;
    },

    async release(scopedKey) {
      const docRef = col().doc(scopedKey);
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(docRef);
        if (snap.exists && snap.data()?.status === 'in_flight') {
          tx.delete(docRef);
        }
      });
    },
  };
}

/**
 * Resolves the default idempotency store (Firestore when configured, else memory).
 */
export function createIdempotencyStore(options = {}) {
  if (options.store) return options.store;
  const useFirestore = options.useFirestore ?? process.env.IDEMPOTENCY_STORE === 'firestore';
  if (useFirestore && options.db) {
    return createFirestoreIdempotencyStore({ db: options.db, ...options });
  }
  if (useFirestore) {
    // Lazy-resolve Firestore on first call, falling back to memory if unconfigured.
    const memoryFallback = createInMemoryIdempotencyStore(options);
    let resolvedStorePromise = null;
    const resolveStore = async () => {
      if (!resolvedStorePromise) {
        resolvedStorePromise = getFirestoreAdmin()
          .then((db) => (db ? createFirestoreIdempotencyStore({ db, ...options }) : memoryFallback))
          .catch(() => memoryFallback);
      }
      return resolvedStorePromise;
    };
    return {
      kind: 'auto',
      get: async (k) => (await resolveStore()).get(k),
      acquireLock: async (k, opts) => (await resolveStore()).acquireLock(k, opts),
      complete: async (k, opts) => (await resolveStore()).complete(k, opts),
      release: async (k) => (await resolveStore()).release(k),
    };
  }
  return createInMemoryIdempotencyStore(options);
}
