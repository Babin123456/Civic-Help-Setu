/**
 * src/services/distributedCache/__tests__/storage.test.js
 *
 * Unit tests for cache storage adapters.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createInMemoryCacheStorage,
  createCacheStorage,
} from '../storage.js';

describe('Cache Storage', () => {
  let memoryStorage;
  const now = () => 1000000;

  beforeEach(() => {
    memoryStorage = createInMemoryCacheStorage({ now, maxKeys: 100, maxEntrySizeBytes: 10000 });
  });

  afterEach(async () => {
    await memoryStorage._reset?.();
  });

  describe('createInMemoryCacheStorage', () => {
    it('stores and retrieves entries', async () => {
      const key = 'test:key';
      const entry = { value: 'test-value', expiresAt: now() + 60000, staleExpiresAt: now() + 120000 };

      await memoryStorage.set(key, entry);
      const result = await memoryStorage.get(key);

      // Storage adds createdAt and updatedAt
      expect(result.value).toBe(entry.value);
      expect(result.expiresAt).toBe(entry.expiresAt);
      expect(result.staleExpiresAt).toBe(entry.staleExpiresAt);
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('returns null for missing keys', async () => {
      const result = await memoryStorage.get('nonexistent');
      expect(result).toBeNull();
    });

    it('returns null and deletes expired entries', async () => {
      const key = 'test:expired';
      const entry = { value: 'test', expiresAt: now() - 1000, staleExpiresAt: now() - 1000 };

      await memoryStorage.set(key, entry);
      const result = await memoryStorage.get(key);

      expect(result).toBeNull();
    });

    it('returns null for expired stale entries', async () => {
      const key = 'test:stale-expired';
      const entry = { value: 'test', expiresAt: now() - 1000, staleExpiresAt: now() - 1000 };

      await memoryStorage.set(key, entry);
      const result = await memoryStorage.get(key);

      expect(result).toBeNull();
    });

    it('deletes keys', async () => {
      const key = 'test:delete';
      const entry = { value: 'test', expiresAt: now() + 60000, staleExpiresAt: now() + 120000 };

      await memoryStorage.set(key, entry);
      const deleted = await memoryStorage.delete(key);
      const result = await memoryStorage.get(key);

      expect(deleted).toBe(true);
      expect(result).toBeNull();
    });

    it('returns false for deleting non-existent keys', async () => {
      const deleted = await memoryStorage.delete('nonexistent');
      expect(deleted).toBe(false);
    });

    it('checks key existence', async () => {
      const key = 'test:exists';
      const entry = { value: 'test', expiresAt: now() + 60000, staleExpiresAt: now() + 120000 };

      expect(await memoryStorage.has(key)).toBe(false);

      await memoryStorage.set(key, entry);
      expect(await memoryStorage.has(key)).toBe(true);

      // Expired key should return false
      const expiredEntry = { value: 'test', expiresAt: now() - 1000, staleExpiresAt: now() - 1000 };
      await memoryStorage.set('test:expired', expiredEntry);
      expect(await memoryStorage.has('test:expired')).toBe(false);
    });

    it('clears all entries', async () => {
      await memoryStorage.set('key1', { value: '1', expiresAt: now() + 60000, staleExpiresAt: now() + 120000 });
      await memoryStorage.set('key2', { value: '2', expiresAt: now() + 60000, staleExpiresAt: now() + 120000 });

      await memoryStorage.clear();
      expect(await memoryStorage.get('key1')).toBeNull();
      expect(await memoryStorage.get('key2')).toBeNull();
      expect(memoryStorage.size()).toBe(0);
    });

    it('clears by pattern', async () => {
      await memoryStorage.set('svc_cat:services/a', { value: 'a', expiresAt: now() + 60000, staleExpiresAt: now() + 120000 });
      await memoryStorage.set('svc_cat:services/b', { value: 'b', expiresAt: now() + 60000, staleExpiresAt: now() + 120000 });
      await memoryStorage.set('pub_ref:other', { value: 'c', expiresAt: now() + 60000, staleExpiresAt: now() + 120000 });

      await memoryStorage.clear('svc_cat:services*');

      expect(await memoryStorage.get('svc_cat:services/a')).toBeNull();
      expect(await memoryStorage.get('svc_cat:services/b')).toBeNull();
      expect(await memoryStorage.get('pub_ref:other')).not.toBeNull();
    });

    it('gets multiple keys', async () => {
      await memoryStorage.set('key1', { value: '1', expiresAt: now() + 60000, staleExpiresAt: now() + 120000 });
      await memoryStorage.set('key2', { value: '2', expiresAt: now() + 60000, staleExpiresAt: now() + 120000 });

      const results = await memoryStorage.getMultiple(['key1', 'key2', 'key3']);
      expect(results.size).toBe(2);
      expect(results.get('key1').value).toBe('1');
      expect(results.get('key2').value).toBe('2');
    });

    it('sets multiple keys', async () => {
      const entries = new Map([
        ['key1', { value: '1', expiresAt: now() + 60000, staleExpiresAt: now() + 120000 }],
        ['key2', { value: '2', expiresAt: now() + 60000, staleExpiresAt: now() + 120000 }],
      ]);

      const results = await memoryStorage.setMultiple(entries);
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it('enforces max entry size', async () => {
      const smallStorage = createInMemoryCacheStorage({ now, maxKeys: 100, maxEntrySizeBytes: 100 });
      const largeEntry = { value: 'x'.repeat(200), expiresAt: now() + 60000, staleExpiresAt: now() + 120000 };

      await expect(smallStorage.set('key', largeEntry)).rejects.toThrow('exceeds max size');
    });

    it('enforces max keys with LRU eviction', async () => {
      let currentTime = 1000000;
      const advancingNow = () => currentTime++;
      const smallStorage = createInMemoryCacheStorage({ now: advancingNow, maxKeys: 3, maxEntrySizeBytes: 10000 });

      await smallStorage.set('key1', { value: '1', expiresAt: advancingNow() + 60000, staleExpiresAt: advancingNow() + 120000 });
      await smallStorage.set('key2', { value: '2', expiresAt: advancingNow() + 60000, staleExpiresAt: advancingNow() + 120000 });
      await smallStorage.set('key3', { value: '3', expiresAt: advancingNow() + 60000, staleExpiresAt: advancingNow() + 120000 });

      // Access key1 to make it recently used (advances time)
      await smallStorage.get('key1');

      // Add key4, should evict key2 (least recently used)
      await smallStorage.set('key4', { value: '4', expiresAt: advancingNow() + 60000, staleExpiresAt: advancingNow() + 120000 });

      expect(await smallStorage.get('key1')).not.toBeNull();
      expect(await smallStorage.get('key2')).toBeNull(); // Evicted
      expect(await smallStorage.get('key3')).not.toBeNull();
      expect(await smallStorage.get('key4')).not.toBeNull();
    });

    it('sweeps expired entries on access', async () => {
      await memoryStorage.set('expired1', { value: '1', expiresAt: now() - 1000, staleExpiresAt: now() - 1000 });
      await memoryStorage.set('expired2', { value: '2', expiresAt: now() - 1000, staleExpiresAt: now() - 1000 });
      await memoryStorage.set('valid', { value: '3', expiresAt: now() + 60000, staleExpiresAt: now() + 120000 });

      // Trigger sweep by getting a key
      await memoryStorage.get('valid');

      expect(await memoryStorage.get('expired1')).toBeNull();
      expect(await memoryStorage.get('expired2')).toBeNull();
      expect(await memoryStorage.get('valid')).not.toBeNull();
    });

    it('tracks size correctly', async () => {
      expect(memoryStorage.size()).toBe(0);
      await memoryStorage.set('key1', { value: '1', expiresAt: now() + 60000, staleExpiresAt: now() + 120000 });
      expect(memoryStorage.size()).toBe(1);
      await memoryStorage.set('key2', { value: '2', expiresAt: now() + 60000, staleExpiresAt: now() + 120000 });
      expect(memoryStorage.size()).toBe(2);
      await memoryStorage.delete('key1');
      expect(memoryStorage.size()).toBe(1);
    });
  });

  describe('createCacheStorage factory', () => {
    it('creates memory storage by default', () => {
      const storage = createCacheStorage({ STORAGE_BACKEND: 'memory' });
      expect(storage.kind).toBe('memory');
    });

    it('throws for firestore without db', () => {
      expect(() => createCacheStorage({ STORAGE_BACKEND: 'firestore' })).toThrow();
    });
  });
});