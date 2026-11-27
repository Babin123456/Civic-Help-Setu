/**
 * api/_lib/leaseCoordinator.js
 *
 * Distributed Lease & Leader Election Coordinator with Fencing Tokens (#1461).
 *
 * Prevents overlapping serverless cron/background job executions from double-running
 * or corrupting shared civic collections. Supports both an in-memory atomic store
 * (for tests and single-instance dev) and a transactional Firestore lease store.
 */

export const DEFAULT_LEASE_TTL_MS = 30_000;
export const DEFAULT_CLOCK_SKEW_BUFFER_MS = 1_000;

/**
 * In-memory atomic lease store with monotonically increasing fencing tokens.
 */
export function createInMemoryLeaseStore({ now = Date.now } = {}) {
  const leases = new Map();

  return {
    kind: 'memory',

    async acquire(leaseKey, { holderId, ttlMs = DEFAULT_LEASE_TTL_MS } = {}) {
      const at = now();
      const existing = leases.get(leaseKey);
      if (existing && existing.expiresAt > at && existing.holderId !== holderId) {
        return {
          acquired: false,
          holderId: existing.holderId,
          fencingToken: existing.fencingToken,
          expiresAt: existing.expiresAt,
        };
      }
      const nextToken = (existing?.fencingToken || 0) + 1;
      const record = {
        leaseKey,
        holderId,
        fencingToken: nextToken,
        acquiredAt: at,
        expiresAt: at + ttlMs,
      };
      leases.set(leaseKey, record);
      return { acquired: true, ...record };
    },

    async renew(leaseKey, { holderId, fencingToken, ttlMs = DEFAULT_LEASE_TTL_MS } = {}) {
      const at = now();
      const existing = leases.get(leaseKey);
      if (!existing || existing.expiresAt <= at) {
        return { renewed: false, reason: 'lease_expired' };
      }
      if (existing.holderId !== holderId || existing.fencingToken !== fencingToken) {
        return { renewed: false, reason: 'fenced_out' };
      }
      existing.expiresAt = at + ttlMs;
      return { renewed: true, ...existing };
    },

    async release(leaseKey, { holderId, fencingToken } = {}) {
      const existing = leases.get(leaseKey);
      if (!existing) return { released: false, reason: 'not_found' };
      if (existing.holderId !== holderId || existing.fencingToken !== fencingToken) {
        return { released: false, reason: 'fenced_out' };
      }
      leases.delete(leaseKey);
      return { released: true };
    },

    async inspect(leaseKey) {
      return leases.get(leaseKey) || null;
    },
  };
}

/**
 * Transactional Firestore-backed lease store.
 */
export function createFirestoreLeaseStore({
  db,
  collectionName = 'distributed_job_leases',
  now = Date.now,
} = {}) {
  if (!db) {
    throw new TypeError('createFirestoreLeaseStore requires a Firestore db instance');
  }
  const col = () => db.collection(collectionName);

  return {
    kind: 'firestore',

    async acquire(leaseKey, { holderId, ttlMs = DEFAULT_LEASE_TTL_MS } = {}) {
      const ref = col().doc(leaseKey);
      const at = now();
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const existing = snap.exists ? snap.data() : null;
        if (existing && existing.expiresAt > at && existing.holderId !== holderId) {
          return {
            acquired: false,
            holderId: existing.holderId,
            fencingToken: existing.fencingToken,
            expiresAt: existing.expiresAt,
          };
        }
        const nextToken = (existing?.fencingToken || 0) + 1;
        const record = {
          leaseKey,
          holderId,
          fencingToken: nextToken,
          acquiredAt: at,
          expiresAt: at + ttlMs,
        };
        tx.set(ref, record);
        return { acquired: true, ...record };
      });
    },

    async renew(leaseKey, { holderId, fencingToken, ttlMs = DEFAULT_LEASE_TTL_MS } = {}) {
      const ref = col().doc(leaseKey);
      const at = now();
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) return { renewed: false, reason: 'lease_expired' };
        const existing = snap.data();
        if (existing.expiresAt <= at) return { renewed: false, reason: 'lease_expired' };
        if (existing.holderId !== holderId || existing.fencingToken !== fencingToken) {
          return { renewed: false, reason: 'fenced_out' };
        }
        const expiresAt = at + ttlMs;
        tx.update(ref, { expiresAt });
        return { renewed: true, ...existing, expiresAt };
      });
    },

    async release(leaseKey, { holderId, fencingToken } = {}) {
      const ref = col().doc(leaseKey);
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) return { released: false, reason: 'not_found' };
        const existing = snap.data();
        if (existing.holderId !== holderId || existing.fencingToken !== fencingToken) {
          return { released: false, reason: 'fenced_out' };
        }
        tx.delete(ref);
        return { released: true };
      });
    },
  };
}

/**
 * High-level coordinator with fencing validation, clock-skew guard, and `withLease`.
 */
export function createLeaseCoordinator({
  store = createInMemoryLeaseStore(),
  defaultTtlMs = DEFAULT_LEASE_TTL_MS,
  clockSkewBufferMs = DEFAULT_CLOCK_SKEW_BUFFER_MS,
  onMetric = () => {},
} = {}) {
  const highestSeenTokenByKey = new Map();

  function validateFencingToken(leaseKey, fencingToken) {
    const prev = highestSeenTokenByKey.get(leaseKey) || 0;
    if (fencingToken < prev) {
      onMetric({ event: 'lease_fenced_out', leaseKey, fencingToken, highestSeen: prev });
      return false;
    }
    highestSeenTokenByKey.set(leaseKey, fencingToken);
    return true;
  }

  async function withLease(leaseKey, holderId, work, { ttlMs = defaultTtlMs } = {}) {
    let acquisition;
    try {
      acquisition = await store.acquire(leaseKey, { holderId, ttlMs });
    } catch (err) {
      onMetric({ event: 'lease_store_error', leaseKey, phase: 'acquire', error: err.message });
      return { executed: false, reason: 'store_unavailable', error: err.message };
    }

    if (!acquisition.acquired) {
      onMetric({ event: 'lease_contention_skipped', leaseKey, holderId, activeHolder: acquisition.holderId });
      return { executed: false, reason: 'held_by_other', activeHolder: acquisition.holderId };
    }

    validateFencingToken(leaseKey, acquisition.fencingToken);
    onMetric({ event: 'lease_acquired', leaseKey, holderId, fencingToken: acquisition.fencingToken });

    const effectiveDeadline = acquisition.expiresAt - clockSkewBufferMs;
    const context = {
      leaseKey,
      holderId,
      fencingToken: acquisition.fencingToken,
      effectiveDeadline,
      renew: () => store.renew(leaseKey, { holderId, fencingToken: acquisition.fencingToken, ttlMs }),
    };

    try {
      const result = await work(context);
      return { executed: true, fencingToken: acquisition.fencingToken, result };
    } finally {
      await store.release(leaseKey, { holderId, fencingToken: acquisition.fencingToken }).catch((err) => {
        onMetric({ event: 'lease_store_error', leaseKey, phase: 'release', error: err.message });
      });
    }
  }

  return {
    store,
    validateFencingToken,
    withLease,
    acquire: (leaseKey, opts) => store.acquire(leaseKey, opts),
    renew: (leaseKey, opts) => store.renew(leaseKey, opts),
    release: (leaseKey, opts) => store.release(leaseKey, opts),
  };
}
