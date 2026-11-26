/**
 * src/services/distributedCache/invalidation.js
 *
 * Cache invalidation event system using the event outbox pattern.
 * Provides distributed cache coherence across multiple instances.
 */

import { createEventOutbox } from '../../../api/_lib/eventOutbox.js';
import {
  INVALIDATION_EVENT_TYPES,
  DEFAULT_CONFIG,
  CACHE_NAMESPACES,
} from './types.js';
import { parseCacheKey, keyMatchesPattern, buildInvalidationPattern } from './cacheKey.js';

/**
 * Creates an invalidation event payload.
 */
function createInvalidationEvent(type, payload, { eventId, sourceInstance = 'unknown', now = Date.now } = {}) {
  const timestamp = typeof now === 'function' ? now() : now;
  return {
    eventId: eventId || `inv_${timestamp}_${Math.random().toString(36).slice(2, 10)}`,
    type,
    timestamp: new Date(timestamp).toISOString(),
    sourceInstance,
    payload,
    schemaVersion: '1.0.0',
  };
}

/**
 * Invalidation event handlers for the local cache engine.
 */
export function createInvalidationHandlers(cacheEngine) {
  return {
    async handleKeyInvalidated(event) {
      const { key } = event.payload;
      if (!key) return { success: false, reason: 'missing_key' };
      await cacheEngine.invalidate(key);
      return { success: true, key };
    },

    async handleNamespaceInvalidated(event) {
      const { namespace } = event.payload;
      if (!namespace) return { success: false, reason: 'missing_namespace' };
      const pattern = buildInvalidationPattern(namespace, '');
      await cacheEngine.invalidatePattern(pattern);
      return { success: true, namespace, pattern };
    },

    async handlePatternInvalidated(event) {
      const { pattern } = event.payload;
      if (!pattern) return { success: false, reason: 'missing_pattern' };
      await cacheEngine.invalidatePattern(pattern);
      return { success: true, pattern };
    },

    async handleFullFlush() {
      await cacheEngine.storage.clear();
      return { success: true };
    },
  };
}

/**
 * Maps event types to handlers.
 */
const EVENT_HANDLERS = {
  [INVALIDATION_EVENT_TYPES.KEY_INVALIDATED]: 'handleKeyInvalidated',
  [INVALIDATION_EVENT_TYPES.NAMESPACE_INVALIDATED]: 'handleNamespaceInvalidated',
  [INVALIDATION_EVENT_TYPES.PATTERN_INVALIDATED]: 'handlePatternInvalidated',
  [INVALIDATION_EVENT_TYPES.FULL_FLUSH]: 'handleFullFlush',
};

/**
 * Creates an invalidation subscriber that processes events from the outbox.
 */
export function createInvalidationSubscriber({
  cacheEngine,
  outbox,
  sourceInstance = 'unknown',
  handlers = null,
  onError = (err) => console.error('[InvalidationSubscriber]', err),
  onMetric = () => {},
  pollIntervalMs = 5000,
  batchSize = 50,
  now = Date.now,
} = {}) {
  const handlerMap = handlers || createInvalidationHandlers(cacheEngine, { now });
  let pollTimer = null;
  let running = false;

  async function processEvents() {
    if (running) return { processed: 0, total: 0 };
    running = true;

    try {
      const records = await outbox.listRecords({ status: 'pending', limit: batchSize });
      const currentTime = typeof now === 'function' ? now() : now;
      const due = records.filter(r => Date.parse(r.nextAttemptAt || r.createdAt) <= currentTime);
      let processedCount = 0;

      for (const record of due) {
        const event = record.event;
        const handlerName = EVENT_HANDLERS[event.type];
        if (!handlerName) {
          onMetric({ event: 'invalidation_unknown_type', type: event.type });
          continue;
        }

        const handler = handlerMap[handlerName];
        if (!handler) {
          onMetric({ event: 'invalidation_no_handler', type: event.type });
          continue;
        }

        // Skip events from this instance to avoid re-processing
        if (event.sourceInstance === sourceInstance) {
          // Mark as delivered locally
          record.status = 'delivered';
          record.deliveredAt = new Date(currentTime).toISOString();
          await outbox.saveRecord(record);
          continue;
        }

        try {
          const result = await handler(event);
          if (result.success) {
            record.status = 'delivered';
            record.deliveredAt = new Date(currentTime).toISOString();
            onMetric({ event: 'invalidation_processed', type: event.type, ...result });
            processedCount++;
          } else {
            record.status = 'pending';
            record.lastError = result.reason || 'handler_failed';
            onMetric({ event: 'invalidation_failed', type: event.type, reason: record.lastError });
          }
        } catch (err) {
          record.status = 'pending';
          record.lastError = err.message;
          onMetric({ event: 'invalidation_error', type: event.type, error: err.message });
        }
        await outbox.saveRecord(record);
      }
      return { processed: processedCount, total: due.length };
    } catch (err) {
      onError(err);
      return { processed: 0, total: 0, error: err.message };
    } finally {
      running = false;
    }
  }

  return {
    start() {
      if (pollTimer) return;
      pollTimer = setInterval(processEvents, pollIntervalMs);
      // Run once immediately
      processEvents();
    },

    stop() {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    },

    // For testing: process once synchronously
    async processOnce() {
      return await processEvents();
    },

    async processNow() {
      return await processEvents();
    },
  };
}

/**
 * Invalidation publisher - publishes invalidation events to the outbox.
 */
export function createInvalidationPublisher({
  outbox,
  sourceInstance = 'unknown',
  now = Date.now,
} = {}) {
  return {
    /**
     * Invalidate a single key across all instances.
     */
    async invalidateKey(key, { eventId } = {}) {
      const event = createInvalidationEvent(
        INVALIDATION_EVENT_TYPES.KEY_INVALIDATED,
        { key },
        { eventId, sourceInstance, now }
      );
      return await outbox.stageEvent(event, { now: typeof now === 'function' ? now() : now });
    },

    /**
     * Invalidate all keys in a namespace.
     */
    async invalidateNamespace(namespace, { eventId } = {}) {
      const event = createInvalidationEvent(
        INVALIDATION_EVENT_TYPES.NAMESPACE_INVALIDATED,
        { namespace },
        { eventId, sourceInstance, now }
      );
      return await outbox.stageEvent(event, { now: typeof now === 'function' ? now() : now });
    },

    /**
     * Invalidate keys matching a pattern.
     */
    async invalidatePattern(pattern, { eventId } = {}) {
      const event = createInvalidationEvent(
        INVALIDATION_EVENT_TYPES.PATTERN_INVALIDATED,
        { pattern },
        { eventId, sourceInstance, now }
      );
      return await outbox.stageEvent(event, { now: typeof now === 'function' ? now() : now });
    },

    /**
     * Flush entire cache across all instances (use with caution).
     */
    async flushAll({ eventId } = {}) {
      const event = createInvalidationEvent(
        INVALIDATION_EVENT_TYPES.FULL_FLUSH,
        {},
        { eventId, sourceInstance, now }
      );
      return await outbox.stageEvent(event, { now: typeof now === 'function' ? now() : now });
    },

    /**
     * Invalidate a service catalogue entry (all identity variants).
     */
    async invalidateService(serviceId, { eventId } = {}) {
      const pattern = `svc_cat:services/${serviceId}*`;
      return this.invalidatePattern(pattern, { eventId });
    },

    /**
     * Invalidate service catalogue list caches.
     */
    async invalidateServiceCatalogue({ eventId } = {}) {
      return this.invalidateNamespace(CACHE_NAMESPACES.SERVICE_CATALOGUE, { eventId });
    },

    /**
     * Invalidate public reference data.
     */
    async invalidatePublicReference(referenceType, resourceId, { eventId } = {}) {
      const key = `pub_ref:${referenceType}/${resourceId}`;
      return this.invalidateKey(key, { eventId });
    },

    /**
     * Invalidate all public reference data of a type.
     */
    async invalidatePublicReferenceType(referenceType, { eventId } = {}) {
      const pattern = buildInvalidationPattern(CACHE_NAMESPACES.PUBLIC_REFERENCE, referenceType);
      return this.invalidatePattern(pattern, { eventId });
    },
  };
}

/**
 * Creates a complete invalidation system (publisher + subscriber).
 */
export function createInvalidationSystem({
  cacheEngine,
  outbox,
  sourceInstance = typeof globalThis.process !== 'undefined' && globalThis.process?.pid
    ? `instance_${globalThis.process.pid}_${Date.now()}`
    : `instance_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`,
  publisherOptions = {},
  subscriberOptions = {},
  onError = (err) => console.error('[InvalidationSystem]', err),
  onMetric = () => {},
} = {}) {
  const publisher = createInvalidationPublisher({
    outbox,
    sourceInstance,
    ...publisherOptions,
  });

  const subscriber = createInvalidationSubscriber({
    cacheEngine,
    outbox,
    sourceInstance,
    onError,
    onMetric,
    ...subscriberOptions,
  });

  return {
    publisher,
    subscriber,
    start() {
      subscriber.start();
    },
    stop() {
      subscriber.stop();
    },
  };
}

/**
 * Creates a Firestore-backed outbox for distributed invalidation.
 * Uses the existing event outbox infrastructure.
 */
export function createInvalidationOutbox({
  db,
  collectionName = DEFAULT_CONFIG.FIRESTORE_INVALIDATION_COLLECTION,
  fallback = null,
} = {}) {
  return createEventOutbox({
    storage: db
      ? {
          async read(key) {
            try {
              const snap = await db.collection(collectionName).doc(key).get();
              if (!snap.exists) return null;
              return snap.data();
            } catch (err) {
              console.error('[InvalidationOutbox] Read error:', err);
              return fallback?.read?.(key) ?? null;
            }
          },
          async write(key, val) {
            try {
              await db.collection(collectionName).doc(key).set({
                data: JSON.parse(JSON.stringify(val)),
                updatedAt: new Date().toISOString(),
              });
              return true;
            } catch (err) {
              console.error('[InvalidationOutbox] Write error:', err);
              return fallback?.write?.(key, val) ?? false;
            }
          },
          async remove(key) {
            try {
              await db.collection(collectionName).doc(key).delete();
              return true;
            } catch (err) {
              console.error('[InvalidationOutbox] Remove error:', err);
              return fallback?.remove?.(key) ?? false;
            }
          },
        }
      : fallback || createEventOutbox().storage,
  });
}

/**
 * Utility: Check if a cached entry should be invalidated based on an event.
 * Used for client-side cache validation (e.g., via ETag or version checks).
 */
export function shouldInvalidateEntry(entry, invalidationEvent) {
  if (!entry || !invalidationEvent) return false;

  const { type, payload } = invalidationEvent;

  switch (type) {
    case INVALIDATION_EVENT_TYPES.FULL_FLUSH:
      return true;

    case INVALIDATION_EVENT_TYPES.KEY_INVALIDATED:
      return entry.key === payload.key;

    case INVALIDATION_EVENT_TYPES.NAMESPACE_INVALIDATED: {
      const parsed = parseCacheKey(entry.key);
      return parsed.valid && parsed.namespace === payload.namespace;
    }

    case INVALIDATION_EVENT_TYPES.PATTERN_INVALIDATED:
      return keyMatchesPattern(entry.key, payload.pattern);

    default:
      return false;
  }
}

// Re-export for convenience
export { createMemoryStorageAdapter, createEventOutbox } from '../../../api/_lib/eventOutbox.js';