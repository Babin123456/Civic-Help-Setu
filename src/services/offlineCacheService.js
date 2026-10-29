/**
 * Service to manage local caching of civic guides, checklists,
 * and active application tokens for offline office visits.
 */
import { MOCK_SERVICES } from '../data/services.js';
import { logDiagnostic } from '../utils/diagnostics';

const CACHE_KEY = 'civicbridge_offline_cache';
const LAST_SYNC_KEY = 'civicbridge_offline_last_sync';

/**
 * Returns all currently cached data
 */
export const getOfflineCachedData = () => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : { services: {}, applications: [], emergencyContacts: [] };
  } catch {
    return { services: {}, applications: [], emergencyContacts: [] };
  }
};

/**
 * Cache a specific service for offline access
 */
export const cacheServiceOffline = (service) => {
  if (!service || !service.id) return false;
  try {
    const current = getOfflineCachedData();
    current.services[service.id] = {
      ...service,
      cachedAt: new Date().toISOString()
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(current));
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    return true;
  } catch (e) {
    logDiagnostic('Error caching service offline:', e);
    return false;
  }
};

/**
 * Sync all user bookmarked/saved guides into offline cache
 */
export const cacheAllSavedGuides = () => {
  try {
    const saved = JSON.parse(localStorage.getItem('civicbridge_saved') || '[]');
    const current = getOfflineCachedData();

    let count = 0;
    saved.forEach(savedItem => {
      const fullService = MOCK_SERVICES.find(s => s.id === savedItem.id);
      if (fullService) {
        current.services[fullService.id] = {
          ...fullService,
          cachedAt: new Date().toISOString()
        };
        count++;
      }
    });

    // Also cache applications
    try {
      const apps = JSON.parse(localStorage.getItem('civicbridge_applications') || '[]');
      current.applications = apps;
    } catch {
      current.applications = [];
    }

    localStorage.setItem(CACHE_KEY, JSON.stringify(current));
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
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
    const cache = getOfflineCachedData();
    const serviceCount = Object.keys(cache.services || {}).length;
    const applicationCount = (cache.applications || []).length;
    const raw = localStorage.getItem(CACHE_KEY) || '';
    const sizeInKb = (new Blob([raw]).size / 1024).toFixed(1);
    const lastSync = localStorage.getItem(LAST_SYNC_KEY) || null;

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
      sizeInKb: 0,
      lastSync: null
    };
  }
};

/**
 * Clears the offline cache
 */
export const clearOfflineCache = () => {
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(LAST_SYNC_KEY);
    return true;
  } catch {
    return false;
  }
};
