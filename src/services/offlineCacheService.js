/**
 * Service to manage local caching of civic guides, checklists,
 * and active application tokens for offline office visits.
 */
import { MOCK_SERVICES } from '../data/services.js';
import { logDiagnostic } from '../utils/diagnostics';

const CACHE_KEY = 'civicbridge_offline_cache';
const LAST_SYNC_KEY = 'civicbridge_offline_last_sync';
const SAVED_RICH_KEY = 'civicbridge_saved_rich';
const SAVED_LEGACY_KEY = 'civicbridge_saved';

// In-memory fallback if localStorage is unavailable
let memoryStore = {};

const getStorage = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return {
    getItem: (key) => memoryStore[key] || null,
    setItem: (key, val) => { memoryStore[key] = String(val); },
    removeItem: (key) => { delete memoryStore[key]; },
    clear: () => { memoryStore = {}; }
  };
};

/**
 * Returns all currently cached data
 */
export const getOfflineCachedData = () => {
  try {
    const storage = getStorage();
    const raw = storage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : { services: {}, applications: [], emergencyContacts: [] };
  } catch {
    return { services: {}, applications: [], emergencyContacts: [] };
  }
};

/**
 * Checks whether a specific service is cached for offline access
 */
export const isServiceCachedOffline = (serviceId) => {
  if (!serviceId) return false;
  const current = getOfflineCachedData();
  return Boolean(current.services && current.services[serviceId]);
};

/**
 * Retrieves a single cached service by its ID
 */
export const getCachedService = (serviceId) => {
  if (!serviceId) return null;
  const current = getOfflineCachedData();
  return current.services?.[serviceId] || null;
};

/**
 * Cache a specific service for offline access
 */
export const cacheServiceOffline = (service) => {
  if (!service || !service.id) return false;
  try {
    const storage = getStorage();
    const current = getOfflineCachedData();
    current.services[service.id] = {
      ...service,
      cachedAt: new Date().toISOString()
    };
    storage.setItem(CACHE_KEY, JSON.stringify(current));
    storage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    return true;
  } catch (e) {
    logDiagnostic('Error caching service offline:', e);
    return false;
  }
};

/**
 * Removes a specific service from offline cache
 */
export const removeServiceOffline = (serviceId) => {
  if (!serviceId) return false;
  try {
    const storage = getStorage();
    const current = getOfflineCachedData();
    if (current.services && current.services[serviceId]) {
      delete current.services[serviceId];
      storage.setItem(CACHE_KEY, JSON.stringify(current));
      storage.setItem(LAST_SYNC_KEY, new Date().toISOString());
      return true;
    }
    return false;
  } catch (e) {
    logDiagnostic('Error removing service from offline cache:', e);
    return false;
  }
};

/**
 * Toggles offline cached state for a service
 */
export const toggleServiceOffline = (service) => {
  if (!service || !service.id) return { cached: false, success: false };
  if (isServiceCachedOffline(service.id)) {
    const success = removeServiceOffline(service.id);
    return { cached: false, success };
  } else {
    const success = cacheServiceOffline(service);
    return { cached: true, success };
  }
};

/**
 * Sync all user bookmarked/saved guides into offline cache.
 * Supports both rich and legacy storage keys and maps serviceId or id.
 */
export const cacheAllSavedGuides = () => {
  try {
    const storage = getStorage();
    const rawSaved = storage.getItem(SAVED_RICH_KEY) || storage.getItem(SAVED_LEGACY_KEY) || '[]';
    const saved = JSON.parse(rawSaved);
    const current = getOfflineCachedData();

    let count = 0;
    if (Array.isArray(saved)) {
      saved.forEach((savedItem) => {
        const targetId = savedItem.serviceId || savedItem.id;
        const fullService = MOCK_SERVICES.find((s) => s.id === targetId);
        if (fullService) {
          current.services[fullService.id] = {
            ...fullService,
            cachedAt: new Date().toISOString()
          };
          count++;
        }
      });
    }

    // Also cache applications
    try {
      const apps = JSON.parse(storage.getItem('civicbridge_applications') || '[]');
      current.applications = apps;
    } catch {
      current.applications = [];
    }

    storage.setItem(CACHE_KEY, JSON.stringify(current));
    storage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    return { success: true, count };
  } catch (e) {
    logDiagnostic('Failed to cache saved guides:', e);
    return { success: false, count: 0 };
  }
};

/**
 * Get offline storage snapshot statistics
 */
export const getOfflineSnapshotStats = () => {
  try {
    const storage = getStorage();
    const cache = getOfflineCachedData();
    const serviceCount = Object.keys(cache.services || {}).length;
    const applicationCount = (cache.applications || []).length;
    const raw = storage.getItem(CACHE_KEY) || '';
    const sizeInKb = (new Blob([raw]).size / 1024).toFixed(1);
    const lastSync = storage.getItem(LAST_SYNC_KEY) || null;

    return {
      serviceCount,
      applicationCount,
      sizeInKb,
      lastSync
    };
  } catch {
    return {
      serviceCount: 0,
      applicationCount: 0,
      sizeInKb: '0.0',
      lastSync: null
    };
  }
};

/**
 * Clears the offline cache
 */
export const clearOfflineCache = () => {
  try {
    const storage = getStorage();
    storage.removeItem(CACHE_KEY);
    storage.removeItem(LAST_SYNC_KEY);
    return true;
  } catch {
    return false;
  }
};
