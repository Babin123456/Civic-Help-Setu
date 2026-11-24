import { logDiagnostic } from '../../src/utils/diagnostics.js';
import { safeHttpUrl } from '../../src/utils/safeContent.js';
import { getFirestoreAdmin } from './firebaseAdmin.js';

export const OUTBOX_STATUS = Object.freeze({
  PENDING: 'pending',
  IN_FLIGHT: 'in_flight',
  DELIVERED: 'delivered',
  QUARANTINED: 'quarantined',
});

const adminRoles = new Set(['admin', 'reviewer', 'official']);
export const isAdminRole = (role) => adminRoles.has(role);

/**
 * Creates an in-memory storage adapter matching the read/write/remove contract.
 * Backed by a Map or plain object, serializing copies to emulate storage boundaries.
 */
export const createMemoryStorageAdapter = (state = new Map()) => ({
  read: async (key) => (state.has(key) ? JSON.parse(JSON.stringify(state.get(key))) : null),
  write: async (key, val) => {
    state.set(key, JSON.parse(JSON.stringify(val)));
    return true;
  },
  remove: async (key) => state.delete(key),
  raw: state,
});

/**
 * Validates and wraps a custom durable storage adapter.
 */
export const createOutboxStorageAdapter = ({ read, write, remove }) => {
  if (typeof read !== 'function' || typeof write !== 'function') {
    throw new TypeError('An outbox storage adapter requires read and write functions.');
  }
  return {
    read,
    write,
    remove: typeof remove === 'function' ? remove : async () => {},
  };
};

/**
 * Creates a Firestore-backed outbox storage adapter with automatic fallback
 * to an in-memory adapter when credentials/Firestore are unavailable.
 */
export const createFirestoreOutboxStorageAdapter = ({
  db = null,
  getDb = getFirestoreAdmin,
  collectionName = 'applicationEventOutbox',
  fallback = createMemoryStorageAdapter(),
} = {}) => {
  const resolveDb = async () => {
    if (db) return db;
    if (typeof getDb === 'function') {
      try {
        return await getDb();
      } catch (err) {
        logDiagnostic('Failed resolving Firestore instance for event outbox', err);
        return null;
      }
    }
    return null;
  };

  return {
    async read(key) {
      const firestore = await resolveDb();
      if (!firestore) return fallback.read(key);
      try {
        const snap = await firestore.collection(collectionName).doc(key).get();
        if (!snap.exists) return null;
        const payload = snap.data();
        return payload?.data !== undefined ? payload.data : payload;
      } catch (err) {
        logDiagnostic('Firestore outbox read error', err);
        return fallback.read(key);
      }
    },
    async write(key, val) {
      const firestore = await resolveDb();
      if (!firestore) return fallback.write(key, val);
      try {
        await firestore.collection(collectionName).doc(key).set({
          data: JSON.parse(JSON.stringify(val)),
          updatedAt: new Date().toISOString(),
        });
        return true;
      } catch (err) {
        logDiagnostic('Firestore outbox write error', err);
        return fallback.write(key, val);
      }
    },
    async remove(key) {
      const firestore = await resolveDb();
      if (!firestore) return fallback.remove(key);
      try {
        await firestore.collection(collectionName).doc(key).delete();
        return true;
      } catch (err) {
        logDiagnostic('Firestore outbox remove error', err);
        return fallback.remove(key);
      }
    },
  };
};

/**
 * Creates an HTTP webhook delivery sink for event publication.
 */
export const createWebhookDeliverySink = ({
  url = typeof globalThis.process !== 'undefined' ? globalThis.process.env?.EVENT_DELIVERY_WEBHOOK_URL : null,
  fetchFn = globalThis.fetch,
  headers = {},
  timeoutMs = 10000,
} = {}) => {
  const targetUrl = safeHttpUrl(url);
  if (!targetUrl) return null;

  return async (event, { deliveryKey, isReplay = false } = {}) => {
    if (typeof fetchFn !== 'function') {
      throw new Error('Fetch function not available for webhook delivery');
    }
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const response = await fetchFn(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Delivery-Key': deliveryKey || '',
          'X-Is-Replay': String(Boolean(isReplay)),
          ...headers,
        },
        body: JSON.stringify({ event, deliveryKey, isReplay: Boolean(isReplay) }),
        signal: controller?.signal,
      });
      if (!response.ok) {
        throw new Error(`Webhook delivery failed with HTTP ${response.status}`);
      }
      return true;
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
};

/**
 * Outbox repository managing transactional outbox records.
 */
export const createEventOutbox = ({
  storage = createMemoryStorageAdapter(),
  storageKey = 'application_event_outbox',
} = {}) => {
  let queue = Promise.resolve();
  const withLock = (fn) => {
    const next = queue.then(fn, fn);
    queue = next.catch(() => {});
    return next;
  };

  const getMap = async () => {
    try {
      const data = await storage.read(storageKey);
      return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
    } catch (err) {
      logDiagnostic('Failed reading outbox from storage', err);
      return {};
    }
  };

  const saveMap = async (map) => {
    try {
      await storage.write(storageKey, map);
      return true;
    } catch (err) {
      logDiagnostic('Failed writing outbox to storage', err);
      return false;
    }
  };

  return {
    async stageEvent(event, { now = Date.now() } = {}) {
      if (!event?.eventId) throw new Error('Event must have an eventId to stage in outbox');
      return withLock(async () => {
        const map = await getMap();

        // Ingest deduplication check by eventId or idempotencyKey
        const existing = Object.values(map).find(
          (r) => r.eventId === event.eventId || (event.idempotencyKey && r.idempotencyKey === event.idempotencyKey)
        );
        if (existing) {
          return { status: 'duplicate', record: existing };
        }

        const isoNow = new Date(now).toISOString();
        const record = {
          outboxId: `outbox_${event.eventId}`,
          eventId: event.eventId,
          idempotencyKey: event.idempotencyKey || event.eventId,
          status: OUTBOX_STATUS.PENDING,
          attempts: 0,
          nextAttemptAt: isoNow,
          lastError: null,
          createdAt: event.createdAt || event.ingestedAt || isoNow,
          deliveredAt: null,
          event: JSON.parse(JSON.stringify(event)),
        };

        map[record.outboxId] = record;
        await saveMap(map);
        return { status: 'staged', record };
      });
    },

    async claimRecord(outboxId) {
      return withLock(async () => {
        const map = await getMap();
        const record = map[outboxId];
        if (!record || record.status !== OUTBOX_STATUS.PENDING) {
          return null;
        }
        record.status = OUTBOX_STATUS.IN_FLIGHT;
        map[outboxId] = record;
        const saved = await saveMap(map);
        return saved ? record : null;
      });
    },

    async getRecord(eventId) {
      const map = await getMap();
      return Object.values(map).find((r) => r.eventId === eventId) || null;
    },

    async listRecords({ status, limit = 100 } = {}) {
      const map = await getMap();
      let records = Object.values(map);
      if (status) {
        records = records.filter((r) => r.status === status);
      }
      return records.slice(0, limit);
    },

    async saveRecord(record) {
      return withLock(async () => {
        const map = await getMap();
        map[record.outboxId] = record;
        return saveMap(map);
      });
    },

    async reset() {
      await storage.remove(storageKey);
    },
  };
};

/**
 * Idempotent publisher with exponential backoff, in-flight locking, poison quarantine, and bounded replay.
 */
export const createEventOutboxPublisher = ({
  outbox,
  deliver,
  targetUrl,
  now = () => Date.now(),
  random = () => Math.random(),
  maxAttempts = 5,
  baseBackoffMs = 1000,
  maxBackoffMs = 60000,
  audit = () => {},
} = {}) => {
  if (!outbox) throw new TypeError('createEventOutboxPublisher requires an outbox');

  const resolvedDeliver =
    deliver ||
    (targetUrl ? createWebhookDeliverySink({ url: targetUrl }) : null) ||
    createWebhookDeliverySink() ||
    (async () => {});

  let retryCount = 0;
  let replayCount = 0;
  const deliveryLags = [];

  return {
    /**
     * Dispatches pending records whose nextAttemptAt <= now().
     * In-flight locking prevents concurrent ticks from processing the same record.
     */
    async publishPending({ limit = 50 } = {}) {
      const records = await outbox.listRecords({ limit });
      const currentTime = now();

      const due = records.filter(
        (r) =>
          r.status === OUTBOX_STATUS.PENDING &&
          Date.parse(r.nextAttemptAt || r.createdAt) <= currentTime
      );

      let delivered = 0;
      let failed = 0;
      let quarantined = 0;

      for (const item of due) {
        // In-flight locking: atomically claim the record
        const record = outbox.claimRecord
          ? await outbox.claimRecord(item.outboxId)
          : null;
        if (!record) {
          continue;
        }

        const deliveryKey = `${record.eventId}:${record.attempts + 1}`;
        try {
          await resolvedDeliver(record.event, { deliveryKey });
          record.status = OUTBOX_STATUS.DELIVERED;
          record.deliveredAt = new Date(now()).toISOString();
          record.lastError = null;
          delivered += 1;

          const lag = now() - Date.parse(record.createdAt);
          if (Number.isFinite(lag) && lag >= 0) {
            deliveryLags.push(lag);
            if (deliveryLags.length > 500) deliveryLags.shift();
          }
        } catch (err) {
          record.attempts += 1;
          retryCount += 1;
          record.lastError = err?.message || String(err);

          if (record.attempts >= maxAttempts) {
            record.status = OUTBOX_STATUS.QUARANTINED;
            quarantined += 1;
            audit({
              action: 'EVENT_OUTBOX_QUARANTINED',
              eventId: record.eventId,
              attempts: record.attempts,
              lastError: record.lastError,
              recordedAt: new Date(now()).toISOString(),
            });
          } else {
            failed += 1;
            const backoff = Math.min(maxBackoffMs, baseBackoffMs * (2 ** (record.attempts - 1)));
            const jitter = Math.floor(random() * backoff * 0.2);
            record.nextAttemptAt = new Date(now() + backoff + jitter).toISOString();
            record.status = OUTBOX_STATUS.PENDING;
          }
        }

        await outbox.saveRecord(record);
      }

      return {
        processed: due.length,
        delivered,
        failed,
        quarantined,
      };
    },

    /**
     * Admin-only bounded replay for operational event reprocessing.
     */
    async replay({ eventIds, from, to, limit = 50, actorRole } = {}) {
      if (!isAdminRole(actorRole)) {
        return {
          ok: false,
          status: 403,
          error: 'forbidden',
          details: ['Replay is restricted to administrative roles.'],
        };
      }

      const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
      let records = await outbox.listRecords({ limit: 1000 });

      if (Array.isArray(eventIds) && eventIds.length > 0) {
        const idSet = new Set(eventIds);
        records = records.filter((r) => idSet.has(r.eventId));
      }

      if (from) {
        const fromMs = Date.parse(from);
        if (Number.isFinite(fromMs)) {
          records = records.filter((r) => Date.parse(r.createdAt) >= fromMs);
        }
      }

      if (to) {
        const toMs = Date.parse(to);
        if (Number.isFinite(toMs)) {
          records = records.filter((r) => Date.parse(r.createdAt) <= toMs);
        }
      }

      const bounded = records.slice(0, safeLimit);
      const replayed = [];

      for (const record of bounded) {
        const deliveryKey = `${record.eventId}:replay:${now()}`;
        try {
          await resolvedDeliver(record.event, { deliveryKey, isReplay: true });
          replayCount += 1;
          replayed.push(record.eventId);
        } catch (err) {
          logDiagnostic('Replay delivery failed', err);
        }
      }

      audit({
        action: 'EVENT_OUTBOX_REPLAYED',
        actorRole,
        count: replayed.length,
        requestedCount: bounded.length,
        recordedAt: new Date(now()).toISOString(),
      });

      return {
        ok: true,
        replayedCount: replayed.length,
        eventIds: replayed,
      };
    },

    /**
     * Returns an observability snapshot of the outbox.
     */
    async getMetrics() {
      const records = await outbox.listRecords({ limit: 1000 });
      const counts = {
        [OUTBOX_STATUS.PENDING]: 0,
        [OUTBOX_STATUS.IN_FLIGHT]: 0,
        [OUTBOX_STATUS.DELIVERED]: 0,
        [OUTBOX_STATUS.QUARANTINED]: 0,
      };

      records.forEach((r) => {
        if (counts[r.status] !== undefined) counts[r.status] += 1;
      });

      const avgLag =
        deliveryLags.length > 0
          ? Math.round(deliveryLags.reduce((sum, v) => sum + v, 0) / deliveryLags.length)
          : 0;

      return {
        total: records.length,
        pending: counts[OUTBOX_STATUS.PENDING],
        inFlight: counts[OUTBOX_STATUS.IN_FLIGHT],
        delivered: counts[OUTBOX_STATUS.DELIVERED],
        quarantined: counts[OUTBOX_STATUS.QUARANTINED],
        retries: retryCount,
        replays: replayCount,
        avgDeliveryLagMs: avgLag,
      };
    },
  };
};
