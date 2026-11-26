/**
 * src/services/distributedCache/__tests__/invalidation.test.js
 *
 * Unit tests for cache invalidation system.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createInvalidationSystem,
  createInvalidationPublisher,
  createInvalidationSubscriber,
  createEventOutbox,
  createMemoryStorageAdapter,
  createInMemoryCacheStorage,
  createCacheEngine,
  INVALIDATION_EVENT_TYPES,
  shouldInvalidateEntry,
  CACHE_NAMESPACES,
} from '../index.js';

describe('Cache Invalidation', () => {
  let cacheEngine;
  let storage;
  let outbox;
  let memoryAdapter;
  const now = () => 1000000;

  beforeEach(() => {
    storage = createInMemoryCacheStorage({ now, maxKeys: 1000 });
    cacheEngine = createCacheEngine({ storage, now });
    memoryAdapter = createMemoryStorageAdapter();
    outbox = createEventOutbox({ storage: memoryAdapter });
  });

  afterEach(async () => {
    await cacheEngine.shutdown();
    await storage._reset?.();
  });

  describe('createInvalidationPublisher', () => {
    let publisher;

    beforeEach(() => {
      publisher = createInvalidationPublisher({ outbox, sourceInstance: 'test-instance', now });
    });

    it('publishes key invalidation event', async () => {
      const result = await publisher.invalidateKey('svc_cat:services/driving-license');
      expect(result.status).toBe('staged');

      const record = await outbox.getRecord(result.record.eventId);
      expect(record).not.toBeNull();
      expect(record.event.type).toBe(INVALIDATION_EVENT_TYPES.KEY_INVALIDATED);
      expect(record.event.payload.key).toBe('svc_cat:services/driving-license');
      expect(record.event.sourceInstance).toBe('test-instance');
    });

    it('publishes namespace invalidation event', async () => {
      const result = await publisher.invalidateNamespace(CACHE_NAMESPACES.SERVICE_CATALOGUE);
      expect(result.status).toBe('staged');

      const record = await outbox.getRecord(result.record.eventId);
      expect(record.event.type).toBe(INVALIDATION_EVENT_TYPES.NAMESPACE_INVALIDATED);
      expect(record.event.payload.namespace).toBe(CACHE_NAMESPACES.SERVICE_CATALOGUE);
    });

    it('publishes pattern invalidation event', async () => {
      const result = await publisher.invalidatePattern('svc_cat:services/*');
      expect(result.status).toBe('staged');

      const record = await outbox.getRecord(result.record.eventId);
      expect(record.event.type).toBe(INVALIDATION_EVENT_TYPES.PATTERN_INVALIDATED);
      expect(record.event.payload.pattern).toBe('svc_cat:services/*');
    });

    it('publishes full flush event', async () => {
      const result = await publisher.flushAll();
      expect(result.status).toBe('staged');

      const record = await outbox.getRecord(result.record.eventId);
      expect(record.event.type).toBe(INVALIDATION_EVENT_TYPES.FULL_FLUSH);
    });

    it('publishes service invalidation', async () => {
      const result = await publisher.invalidateService('driving-license');
      expect(result.status).toBe('staged');

      const record = await outbox.getRecord(result.record.eventId);
      expect(record.event.type).toBe(INVALIDATION_EVENT_TYPES.PATTERN_INVALIDATED);
      expect(record.event.payload.pattern).toBe('svc_cat:services/driving-license*');
    });

    it('publishes service catalogue invalidation', async () => {
      const result = await publisher.invalidateServiceCatalogue();
      expect(result.status).toBe('staged');

      const record = await outbox.getRecord(result.record.eventId);
      expect(record.event.type).toBe(INVALIDATION_EVENT_TYPES.NAMESPACE_INVALIDATED);
      expect(record.event.payload.namespace).toBe(CACHE_NAMESPACES.SERVICE_CATALOGUE);
    });

    it('publishes public reference invalidation', async () => {
      const result = await publisher.invalidatePublicReference('jurisdictions', 'all');
      expect(result.status).toBe('staged');

      const record = await outbox.getRecord(result.record.eventId);
      expect(record.event.type).toBe(INVALIDATION_EVENT_TYPES.KEY_INVALIDATED);
      expect(record.event.payload.key).toBe('pub_ref:jurisdictions/all');
    });

    it('publishes public reference type invalidation', async () => {
      const result = await publisher.invalidatePublicReferenceType('jurisdictions');
      expect(result.status).toBe('staged');

      const record = await outbox.getRecord(result.record.eventId);
      expect(record.event.type).toBe(INVALIDATION_EVENT_TYPES.PATTERN_INVALIDATED);
      expect(record.event.payload.pattern).toBe('pub_ref:jurisdictions*');
    });
  });

  describe('createInvalidationSubscriber', () => {
    let publisher;
    let subscriber;

    beforeEach(() => {
      publisher = createInvalidationPublisher({ outbox, sourceInstance: 'publisher-instance', now });
      subscriber = createInvalidationSubscriber({
        cacheEngine,
        outbox,
        sourceInstance: 'subscriber-instance',
        now,
        pollIntervalMs: 100, // Fast polling for tests
      });
    });

    it('processes key invalidation event', async () => {
      // Pre-populate cache
      await cacheEngine.set('svc_cat:services/driving-license', {
        value: { data: 'test' },
        expiresAt: now() + 60000,
        staleExpiresAt: now() + 120000,
      });

      expect(await cacheEngine.has('svc_cat:services/driving-license')).toBe(true);

      // Publish invalidation
      await publisher.invalidateKey('svc_cat:services/driving-license');

      // Process events
      await subscriber.processOnce();

      // Key should be invalidated
      expect(await cacheEngine.has('svc_cat:services/driving-license')).toBe(false);
    });

    it('processes namespace invalidation event', async () => {
      await cacheEngine.set('svc_cat:services/a', { value: 'a', expiresAt: now() + 60000, staleExpiresAt: now() + 120000 });
      await cacheEngine.set('svc_cat:services/b', { value: 'b', expiresAt: now() + 60000, staleExpiresAt: now() + 120000 });
      await cacheEngine.set('pub_ref:other', { value: 'c', expiresAt: now() + 60000, staleExpiresAt: now() + 120000 });

      await publisher.invalidateNamespace(CACHE_NAMESPACES.SERVICE_CATALOGUE);
      await subscriber.processOnce();

      expect(await cacheEngine.has('svc_cat:services/a')).toBe(false);
      expect(await cacheEngine.has('svc_cat:services/b')).toBe(false);
      expect(await cacheEngine.has('pub_ref:other')).toBe(true); // Different namespace
    });

    it('processes pattern invalidation event', async () => {
      await cacheEngine.set('svc_cat:services/a', { value: 'a', expiresAt: now() + 60000, staleExpiresAt: now() + 120000 });
      await cacheEngine.set('svc_cat:services/b', { value: 'b', expiresAt: now() + 60000, staleExpiresAt: now() + 120000 });
      await cacheEngine.set('svc_cat:other/c', { value: 'c', expiresAt: now() + 60000, staleExpiresAt: now() + 120000 });

      await publisher.invalidatePattern('svc_cat:services*');
      await subscriber.processOnce();

      expect(await cacheEngine.has('svc_cat:services/a')).toBe(false);
      expect(await cacheEngine.has('svc_cat:services/b')).toBe(false);
      expect(await cacheEngine.has('svc_cat:other/c')).toBe(true); // Doesn't match pattern
    });

    it('processes full flush event', async () => {
      await cacheEngine.set('key1', { value: '1', expiresAt: now() + 60000, staleExpiresAt: now() + 120000 });
      await cacheEngine.set('key2', { value: '2', expiresAt: now() + 60000, staleExpiresAt: now() + 120000 });

      await publisher.flushAll();
      await subscriber.processOnce();

      expect(await cacheEngine.has('key1')).toBe(false);
      expect(await cacheEngine.has('key2')).toBe(false);
    });

    it('does not process events from same instance', async () => {
      const localPublisher = createInvalidationPublisher({ outbox, sourceInstance: 'subscriber-instance', now });
      const localSubscriber = createInvalidationSubscriber({
        cacheEngine,
        outbox,
        sourceInstance: 'subscriber-instance',
        now,
      });

      await cacheEngine.set('key1', { value: '1', expiresAt: now() + 60000, staleExpiresAt: now() + 120000 });
      await localPublisher.invalidateKey('key1');
      await localSubscriber.processOnce();

      // Should not be invalidated because it's from the same instance
      expect(await cacheEngine.has('key1')).toBe(true);
    });

    it('handles unknown event types gracefully', async () => {
      // Manually add an event with unknown type
      await outbox.stageEvent({
        eventId: 'test-unknown',
        type: 'cache.unknown_type',
        timestamp: new Date(now()).toISOString(),
        sourceInstance: 'other-instance',
        payload: {},
      });

      await subscriber.processOnce();

      // Should not crash
      expect(true).toBe(true);
    });
  });

  describe('createInvalidationSystem', () => {
    it('creates publisher and subscriber', () => {
      const system = createInvalidationSystem({
        cacheEngine,
        outbox,
        sourceInstance: 'system-instance',
      });

      expect(system.publisher).toBeDefined();
      expect(system.subscriber).toBeDefined();
      expect(typeof system.start).toBe('function');
      expect(typeof system.stop).toBe('function');
    });

    it('starts and stops subscriber', async () => {
      const system = createInvalidationSystem({
        cacheEngine,
        outbox,
        sourceInstance: 'system-instance',
        subscriberOptions: { pollIntervalMs: 100 },
      });

      system.start();
      await new Promise(r => setTimeout(r, 50));
      system.stop();

      // Should not crash
      expect(true).toBe(true);
    });
  });

  describe('shouldInvalidateEntry', () => {
    it('returns true for full flush', () => {
      const entry = { key: 'any:key' };
      const event = { type: INVALIDATION_EVENT_TYPES.FULL_FLUSH, payload: {} };
      expect(shouldInvalidateEntry(entry, event)).toBe(true);
    });

    it('returns true for matching key invalidation', () => {
      const entry = { key: 'svc_cat:services/driving-license' };
      const event = { type: INVALIDATION_EVENT_TYPES.KEY_INVALIDATED, payload: { key: 'svc_cat:services/driving-license' } };
      expect(shouldInvalidateEntry(entry, event)).toBe(true);
    });

    it('returns false for non-matching key invalidation', () => {
      const entry = { key: 'svc_cat:services/driving-license' };
      const event = { type: INVALIDATION_EVENT_TYPES.KEY_INVALIDATED, payload: { key: 'svc_cat:services/other' } };
      expect(shouldInvalidateEntry(entry, event)).toBe(false);
    });

    it('returns true for matching namespace invalidation', () => {
      const entry = { key: 'svc_cat:services/driving-license' };
      const event = { type: INVALIDATION_EVENT_TYPES.NAMESPACE_INVALIDATED, payload: { namespace: 'svc_cat' } };
      expect(shouldInvalidateEntry(entry, event)).toBe(true);
    });

    it('returns false for non-matching namespace invalidation', () => {
      const entry = { key: 'pub_ref:jurisdictions/all' };
      const event = { type: INVALIDATION_EVENT_TYPES.NAMESPACE_INVALIDATED, payload: { namespace: 'svc_cat' } };
      expect(shouldInvalidateEntry(entry, event)).toBe(false);
    });

    it('returns true for matching pattern invalidation', () => {
      const entry = { key: 'svc_cat:services/driving-license' };
      const event = { type: INVALIDATION_EVENT_TYPES.PATTERN_INVALIDATED, payload: { pattern: 'svc_cat:services*' } };
      expect(shouldInvalidateEntry(entry, event)).toBe(true);
    });

    it('returns false for non-matching pattern invalidation', () => {
      const entry = { key: 'pub_ref:jurisdictions/all' };
      const event = { type: INVALIDATION_EVENT_TYPES.PATTERN_INVALIDATED, payload: { pattern: 'svc_cat:services*' } };
      expect(shouldInvalidateEntry(entry, event)).toBe(false);
    });

    it('returns false for null entry or event', () => {
      expect(shouldInvalidateEntry(null, {})).toBe(false);
      expect(shouldInvalidateEntry({}, null)).toBe(false);
    });
  });
});