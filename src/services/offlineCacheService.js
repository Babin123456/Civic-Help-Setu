/**
 * Service to manage local caching of civic guides, checklists,
 * emergency packs, and active application tokens for offline access.
 */
import { MOCK_SERVICES } from '../data/services.js';
import { EMERGENCY_PACK_STORAGE_KEY, EMERGENCY_PACK_META } from '../data/emergencyPacks.js';
import { logDiagnostic } from '../utils/diagnostics';

const CACHE_KEY = 'civicbridge_offline_cache';
const PACK_CACHE_KEY = 'civicbridge_emergency_pack_cache';
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
 * Get offline storage snapshot statistics including emergency packs
 */
export const getOfflineSnapshotStats = () => {
  try {
    const storage = getStorage();
    const cache = getOfflineCachedData();
    const serviceCount = Object.keys(cache.services || {}).length;
    const applicationCount = (cache.applications || []).length;
    const packCount = Object.keys(cache.services || {}).filter(
      (key) => key.startsWith('emergency-pack-')
    ).length;
    const raw = storage.getItem(CACHE_KEY) || '';
    const sizeInKb = (new Blob([raw]).size / 1024).toFixed(1);
    const lastSync = storage.getItem(LAST_SYNC_KEY) || null;

    return {
      serviceCount,
      applicationCount,
      packCount,
      sizeInKb,
      lastSync
    };
  } catch {
    return {
      serviceCount: 0,
      applicationCount: 0,
      packCount: 0,
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
    storage.removeItem(PACK_CACHE_KEY);
    return true;
  } catch {
    return false;
  }
};

/**
 * Cache an emergency pack for offline access
 */
export const cacheEmergencyPackOffline = (pack) => {
  if (!pack || !pack.state) return false;
  try {
    const storage = getStorage();
    const current = getOfflineCachedData();
    current.services = current.services || {};
    current.services[`emergency-pack-${pack.state.replace(/\s+/g, '-').toLowerCase()}`] = {
      ...pack,
      cachedAt: new Date().toISOString(),
      packType: 'emergency'
    };
    storage.setItem(CACHE_KEY, JSON.stringify(current));
    storage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    storage.setItem(PACK_CACHE_KEY, JSON.stringify(current.services));
    return true;
  } catch (e) {
    logDiagnostic('Error caching emergency pack offline:', e);
    return false;
  }
};

/**
 * Remove an emergency pack from offline cache
 */
export const removeEmergencyPackOffline = (stateName) => {
  if (!stateName) return false;
  try {
    const storage = getStorage();
    const current = getOfflineCachedData();
    const packKey = `emergency-pack-${stateName.replace(/\s+/g, '-').toLowerCase()}`;
    if (current.services && current.services[packKey]) {
      delete current.services[packKey];
      storage.setItem(CACHE_KEY, JSON.stringify(current));
      storage.setItem(LAST_SYNC_KEY, new Date().toISOString());
      storage.setItem(PACK_CACHE_KEY, JSON.stringify(current.services));
      return true;
    }
    return false;
  } catch (e) {
    logDiagnostic('Error removing emergency pack from offline cache:', e);
    return false;
  }
};

/**
 * Get a cached emergency pack by state name
 */
export const getCachedEmergencyPack = (stateName) => {
  if (!stateName) return null;
  try {
    const storage = getStorage();
    const current = getOfflineCachedData();
    const packKey = `emergency-pack-${stateName.replace(/\s+/g, '-').toLowerCase()}`;
    return current.services?.[packKey] || null;
  } catch (e) {
    logDiagnostic('Error getting cached emergency pack:', e);
    return null;
  }
};

/**
 * Cache all emergency packs for offline access
 */
export const cacheAllEmergencyPacks = () => {
  try {
    const storage = getStorage();
    const current = getOfflineCachedData();

    INDIAN_STATES_AND_UTS.forEach((state) => {
      const pack = EMERGENCY_PACKS[state];
      if (pack) {
        current.services = current.services || {};
        current.services[`emergency-pack-${state.replace(/\s+/g, '-').toLowerCase()}`] = {
          ...pack,
          cachedAt: new Date().toISOString(),
          packType: 'emergency'
        };
      }
    });

    storage.setItem(CACHE_KEY, JSON.stringify(current));
    storage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    storage.setItem(PACK_CACHE_KEY, JSON.stringify(current.services));
    return { success: true, count: INDIAN_STATES_AND_UTS.length };
  } catch (e) {
    logDiagnostic('Failed to cache all emergency packs:', e);
    return { success: false, count: 0 };
  }
};