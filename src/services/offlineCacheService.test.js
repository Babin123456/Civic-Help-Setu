import { describe, it, expect, beforeEach } from 'vitest';
import {
  getOfflineCachedData,
  isServiceCachedOffline,
  cacheServiceOffline,
  removeServiceOffline,
  toggleServiceOffline,
  getCachedService,
  cacheAllSavedGuides,
  getOfflineSnapshotStats,
  clearOfflineCache
} from './offlineCacheService';
import { MOCK_SERVICES } from '../data/services';

describe('offlineCacheService', () => {
  beforeEach(() => {
    clearOfflineCache();
  });

  const testService = {
    id: 'test-caste-cert',
    name: 'Caste Certificate Issuance',
    category: 'Revenue',
    requirements: ['Aadhaar', 'Income Proof']
  };

  it('starts with empty cache', () => {
    const data = getOfflineCachedData();
    expect(data.services).toEqual({});
    expect(isServiceCachedOffline('test-caste-cert')).toBe(false);
    expect(getCachedService('test-caste-cert')).toBeNull();
  });

  it('caches a service offline and records cachedAt timestamp', () => {
    const ok = cacheServiceOffline(testService);
    expect(ok).toBe(true);
    expect(isServiceCachedOffline('test-caste-cert')).toBe(true);

    const cached = getCachedService('test-caste-cert');
    expect(cached).not.toBeNull();
    expect(cached.name).toBe('Caste Certificate Issuance');
    expect(cached.cachedAt).toBeDefined();
  });

  it('removes a service from offline cache safely', () => {
    cacheServiceOffline(testService);
    expect(isServiceCachedOffline('test-caste-cert')).toBe(true);

    const removed = removeServiceOffline('test-caste-cert');
    expect(removed).toBe(true);
    expect(isServiceCachedOffline('test-caste-cert')).toBe(false);
    expect(getCachedService('test-caste-cert')).toBeNull();
  });

  it('toggles service cached status', () => {
    const res1 = toggleServiceOffline(testService);
    expect(res1.cached).toBe(true);
    expect(isServiceCachedOffline('test-caste-cert')).toBe(true);

    const res2 = toggleServiceOffline(testService);
    expect(res2.cached).toBe(false);
    expect(isServiceCachedOffline('test-caste-cert')).toBe(false);
  });

  it('handles invalid service arguments gracefully', () => {
    expect(cacheServiceOffline(null)).toBe(false);
    expect(cacheServiceOffline({})).toBe(false);
    expect(removeServiceOffline(null)).toBe(false);
    expect(toggleServiceOffline(null)).toEqual({ cached: false, success: false });
  });

  it('reports accurate snapshot stats', () => {
    cacheServiceOffline(testService);
    const stats = getOfflineSnapshotStats();

    expect(stats.serviceCount).toBe(1);
    expect(stats.lastSync).not.toBeNull();
  });
});
