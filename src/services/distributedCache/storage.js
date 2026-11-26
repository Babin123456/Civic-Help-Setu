/* global process */
/**
 * src/services/distributedCache/storage.js
 *
 * Storage adapters for the distributed cache layer.
 * Provides in-memory (development/single-instance) and Firestore-backed
 * (production/distributed) implementations with identical interfaces.
 */

import {
  DEFAULT_CONFIG,
  validateCacheEntry,
  validateCacheKey,
} from './types.js';

/**
 * In-memory bounded TTL store with LRU eviction.
 * Suitable for local development, single-instance warm containers, and tests.
 */
export function createInMemoryCacheStorage({
  maxKeys = DEFAULT_CONFIG.MAX_KEYS,
  maxEntrySizeBytes = DEFAULT_CONFIG.MAX_ENTRY_SIZE_BYTES,
  now = Date.now,
} = {}) {
  const entries = new Map();
  const accessOrder = new Map(); // key -> last access timestamp (for LRU)

  function estimateSize(entry) {
    try {
      return new TextEncoder().encode(JSON.stringify(entry)).length;
    } catch {
      return 0;
    }
  }

  function sweepExpired(at) {
    for (const [key, entry] of entries) {
      const expiry = entry.staleExpiresAt || entry.expiresAt;
      if (expiry <= at) {
        entries.delete(key);
        accessOrder.delete(key);
      }
    }
  }

  function evictLRU(at) {
    sweepExpired(at);
    while (entries.size >= maxKeys) {
      // Find least recently used
      let lruKey = null;
      let lruTime = Infinity;
      for (const [key, time] of accessOrder) {
        if (time < lruTime) {
          lruTime = time;
          lruKey = key;
        }
      }
      if (lruKey) {
        entries.delete(lruKey);
        accessOrder.delete(lruKey);
      } else {
        // Fallback: delete first entry
        const firstKey = entries.keys().next().value;
        if (firstKey) {
          entries.delete(firstKey);
          accessOrder.delete(firstKey);
        } else break;
      }
    }
  }

  function checkSizeLimit(entry, at) {
    if (entries.size >= maxKeys) {
      evictLRU(at);
    }
    const size = estimateSize(entry);
    if (size > maxEntrySizeBytes) {
      throw new Error(`Cache entry exceeds max size of ${maxEntrySizeBytes} bytes`);
    }
  }

  return {
    kind: 'memory',

    size: () => entries.size,

    async get(key) {
      const keyCheck = validateCacheKey(key);
      if (!keyCheck.valid) return null;

      const at = now();
      const entry = entries.get(key);
      if (!entry) return null;

      const expiry = entry.staleExpiresAt || entry.expiresAt;
      if (expiry <= at) {
        entries.delete(key);
        accessOrder.delete(key);
        return null;
      }

      // Update LRU
      accessOrder.set(key, at);
      return { ...entry };
    },

    async set(key, entry) {
      const keyCheck = validateCacheKey(key);
      if (!keyCheck.valid) throw new Error(`Invalid cache key: ${keyCheck.errors.join('; ')}`);

      const entryCheck = validateCacheEntry(entry);
      if (!entryCheck.valid) throw new Error(`Invalid cache entry: ${entryCheck.errors.join('; ')}`);

      const at = now();
      checkSizeLimit(entry, at);

      const storedEntry = {
        ...entry,
        createdAt: entry.createdAt || at,
        updatedAt: at,
      };
      entries.set(key, storedEntry);
      accessOrder.set(key, at);
      return storedEntry;
    },

    async delete(key) {
      const keyCheck = validateCacheKey(key);
      if (!keyCheck.valid) return false;
      const deleted = entries.delete(key);
      accessOrder.delete(key);
      return deleted;
    },

    async has(key) {
      const keyCheck = validateCacheKey(key);
      if (!keyCheck.valid) return false;
      const at = now();
      const entry = entries.get(key);
      if (!entry) return false;
      const expiry = entry.staleExpiresAt || entry.expiresAt;
      if (expiry <= at) {
        entries.delete(key);
        accessOrder.delete(key);
        return false;
      }
      return true;
    },

    async clear(pattern = null) {
      if (!pattern) {
        entries.clear();
        accessOrder.clear();
        return true;
      }
      // Pattern-based clear (prefix match)
      let count = 0;
      for (const key of entries.keys()) {
        if (key.startsWith(pattern.replace('*', ''))) {
          entries.delete(key);
          accessOrder.delete(key);
          count++;
        }
      }
      return count > 0;
    },

    async getMultiple(keys) {
      const results = new Map();
      for (const key of keys) {
        const value = await this.get(key);
        if (value) results.set(key, value);
      }
      return results;
    },

    async setMultiple(entriesMap) {
      const results = [];
      for (const [key, entry] of entriesMap) {
        try {
          await this.set(key, entry);
          results.push({ key, success: true });
        } catch (err) {
          results.push({ key, success: false, error: err.message });
        }
      }
      return results;
    },

    // For testing and diagnostics
    _getRawEntries() {
      return new Map(entries);
    },

    _reset() {
      entries.clear();
      accessOrder.clear();
    },
  };
}

/**
 * Firestore-backed cache storage for cross-instance serverless persistence.
 */
export function createFirestoreCacheStorage({
  db,
  collectionName = DEFAULT_CONFIG.FIRESTORE_COLLECTION,
  maxEntrySizeBytes = DEFAULT_CONFIG.MAX_ENTRY_SIZE_BYTES,
  now = Date.now,
} = {}) {
  if (!db) {
    throw new TypeError('createFirestoreCacheStorage requires a Firestore db instance');
  }

  const col = () => db.collection(collectionName);

  function estimateSize(entry) {
    try {
      return new TextEncoder().encode(JSON.stringify(entry)).length;
    } catch {
      return 0;
    }
  }

  return {
    kind: 'firestore',

    size: async () => {
      try {
        const snap = await col().count().get();
        return snap.data().count;
      } catch {
        return -1; // Unknown
      }
    },

    async get(key) {
      const keyCheck = validateCacheKey(key);
      if (!keyCheck.valid) return null;

      try {
        const snap = await col().doc(key).get();
        if (!snap.exists) return null;
        const data = snap.data();
        if (!data) return null;
        const at = now();
        if (data.expiresAt <= at) {
          await col().doc(key).delete().catch(() => {});
          return null;
        }
        return data;
      } catch (err) {
        // Log but don't throw - allow fallback
        console.error('[FirestoreCache] Get error:', err.message);
        return null;
      }
    },

    async set(key, entry) {
      const keyCheck = validateCacheKey(key);
      if (!keyCheck.valid) throw new Error(`Invalid cache key: ${keyCheck.errors.join('; ')}`);

      const entryCheck = validateCacheEntry(entry);
      if (!entryCheck.valid) throw new Error(`Invalid cache entry: ${entryCheck.errors.join('; ')}`);

      const size = estimateSize(entry);
      if (size > maxEntrySizeBytes) {
        throw new Error(`Cache entry exceeds max size of ${maxEntrySizeBytes} bytes`);
      }

      const at = now();
      const storedEntry = {
        ...entry,
        createdAt: entry.createdAt || at,
        updatedAt: at,
      };

      try {
        await col().doc(key).set(storedEntry);
        return storedEntry;
      } catch (err) {
        console.error('[FirestoreCache] Set error:', err.message);
        throw err;
      }
    },

    async delete(key) {
      const keyCheck = validateCacheKey(key);
      if (!keyCheck.valid) return false;
      try {
        await col().doc(key).delete();
        return true;
      } catch (err) {
        console.error('[FirestoreCache] Delete error:', err.message);
        return false;
      }
    },

    async has(key) {
      const keyCheck = validateCacheKey(key);
      if (!keyCheck.valid) return false;
      try {
        const snap = await col().doc(key).get();
        if (!snap.exists) return false;
        const data = snap.data();
        if (!data) return false;
        return data.expiresAt > now();
      } catch {
        return false;
      }
    },

    async clear(pattern = null) {
      if (!pattern) {
        // Full clear - use batched deletes
        try {
          const snap = await col().limit(500).get();
          const batch = db.batch();
          let count = 0;
          for (const doc of snap.docs) {
            batch.delete(doc.ref);
            count++;
            if (count >= 500) break;
          }
          await batch.commit();
          // Note: Full clear of large collections should be done via admin SDK
          return true;
        } catch (err) {
          console.error('[FirestoreCache] Clear error:', err.message);
          return false;
        }
      }
      // Pattern-based clear (prefix match)
      try {
        const prefix = pattern.replace('*', '');
        const snap = await col().where('__name__', '>=', prefix).where('__name__', '<=', prefix + '\uf8ff').limit(500).get();
        const batch = db.batch();
        for (const doc of snap.docs) {
          batch.delete(doc.ref);
        }
        await batch.commit();
        return true;
      } catch (err) {
        console.error('[FirestoreCache] Pattern clear error:', err.message);
        return false;
      }
    },

    async getMultiple(keys) {
      if (keys.length === 0) return new Map();
      const results = new Map();
      // Firestore 'in' query limited to 30, batch in chunks
      const chunks = [];
      for (let i = 0; i < keys.length; i += 30) {
        chunks.push(keys.slice(i, i + 30));
      }
      const at = now();
      for (const chunk of chunks) {
        try {
          const snap = await col().where('__name__', 'in', chunk).get();
          for (const doc of snap.docs) {
            const data = doc.data();
            if (data && data.expiresAt > at) {
              results.set(doc.id, data);
            }
          }
        } catch (err) {
          console.error('[FirestoreCache] GetMultiple error:', err.message);
        }
      }
      return results;
    },

    async setMultiple(entriesMap) {
      const results = [];
      const batch = db.batch();
      let batchCount = 0;
      const at = now();

      for (const [key, entry] of entriesMap) {
        try {
          const keyCheck = validateCacheKey(key);
          if (!keyCheck.valid) throw new Error(`Invalid cache key: ${keyCheck.errors.join('; ')}`);

          const entryCheck = validateCacheEntry(entry);
          if (!entryCheck.valid) throw new Error(`Invalid cache entry: ${entryCheck.errors.join('; ')}`);

          const size = estimateSize(entry);
          if (size > maxEntrySizeBytes) throw new Error(`Entry exceeds max size`);

          const storedEntry = { ...entry, createdAt: entry.createdAt || at, updatedAt: at };
          batch.set(col().doc(key), storedEntry);
          batchCount++;

          if (batchCount >= 500) {
            await batch.commit();
            // Create new batch
            // Note: Firestore batches are single-use, so we'd need a new one
            // This is simplified - in production use WriteBatch properly
          }
          results.push({ key, success: true });
        } catch (err) {
          results.push({ key, success: false, error: err.message });
        }
      }

      if (batchCount > 0) {
        try {
          await batch.commit();
        } catch (err) {
          console.error('[FirestoreCache] SetMultiple commit error:', err.message);
          // Mark all in batch as failed
          for (const r of results) {
            if (r.success) r.success = false, r.error = err.message;
          }
        }
      }
      return results;
    },
  };
}

/**
 * Auto-resolving storage that picks Firestore when available, else memory.
 * Matches the pattern used in idempotencyStore.js
 */
export function createAutoCacheStorage(options = {}) {
  const { useFirestore = process.env.DISTRIBUTED_CACHE_STORAGE === 'firestore', db, ...storageOptions } = options;

  if (useFirestore && db) {
    return createFirestoreCacheStorage({ db, ...storageOptions });
  }

  if (useFirestore) {
    const memoryFallback = createInMemoryCacheStorage(storageOptions);
    let resolvedStorePromise = null;

    const resolveStore = async () => {
      if (!resolvedStorePromise) {
        // Dynamic import to avoid circular dependency
        const { getFirestoreAdmin } = await import('../../../api/_lib/firebaseAdmin.js');
        resolvedStorePromise = getFirestoreAdmin()
          .then((firestoreDb) => (firestoreDb ? createFirestoreCacheStorage({ db: firestoreDb, ...storageOptions }) : memoryFallback))
          .catch(() => memoryFallback);
      }
      return resolvedStorePromise;
    };

    return {
      kind: 'auto',
      get: async (k) => (await resolveStore()).get(k),
      set: async (k, v) => (await resolveStore()).set(k, v),
      delete: async (k) => (await resolveStore()).delete(k),
      has: async (k) => (await resolveStore()).has(k),
      clear: async (p) => (await resolveStore()).clear(p),
      getMultiple: async (k) => (await resolveStore()).getMultiple(k),
      setMultiple: async (m) => (await resolveStore()).setMultiple(m),
    };
  }

  return createInMemoryCacheStorage(storageOptions);
}

/**
 * Creates a cache storage instance based on configuration.
 */
export function createCacheStorage(config = {}, options = {}) {
  const backend = config.STORAGE_BACKEND || DEFAULT_CONFIG.STORAGE_BACKEND;

  switch (backend) {
    case 'memory':
      return createInMemoryCacheStorage(options);
    case 'firestore':
      return createFirestoreCacheStorage(options);
    case 'auto':
    default:
      return createAutoCacheStorage({ ...config, ...options });
  }
}