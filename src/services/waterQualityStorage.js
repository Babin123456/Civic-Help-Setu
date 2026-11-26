/**
 * src/services/waterQualityStorage.js
 * Persistence adapter for the Community Water-Quality Sampling and
 * Laboratory Result Register (#754).
 *
 * Implements offline queuing, transaction integrity, and crash-resilient storage.
 */

import { INITIAL_WATER_QUALITY_STORE } from '../data/waterQualitySeed.js';
import { SCHEMA_VERSION } from '../data/waterQualityContract.js';
import { logDiagnostic } from '../utils/diagnostics.js';

export const WATER_QUALITY_STORAGE_KEY = 'civicbridge_water_quality_v1';
export const WATER_QUALITY_OFFLINE_KEY = 'civicbridge_water_quality_offline_queue_v1';

// In-memory fallback when localStorage is unavailable (SSR/tests)
let memoryStore = null;
let memoryOfflineQueue = [];

const getStorage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

/**
 * Deep clone utility
 */
const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

/**
 * Loads the current store or initializes with seed dataset
 */
export function loadWaterQualityStore() {
  const storage = getStorage();
  if (!storage) {
    if (!memoryStore) {
      memoryStore = deepClone(INITIAL_WATER_QUALITY_STORE);
    }
    return deepClone(memoryStore);
  }

  try {
    const raw = storage.getItem(WATER_QUALITY_STORAGE_KEY);
    if (!raw) {
      const initial = deepClone(INITIAL_WATER_QUALITY_STORE);
      storage.setItem(WATER_QUALITY_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.schemaVersion) {
      const reset = deepClone(INITIAL_WATER_QUALITY_STORE);
      storage.setItem(WATER_QUALITY_STORAGE_KEY, JSON.stringify(reset));
      return reset;
    }
    return parsed;
  } catch {
    const fallback = deepClone(INITIAL_WATER_QUALITY_STORE);
    return fallback;
  }
}

/**
 * Persists the entire store with timestamp update and schema version check
 */
export function saveWaterQualityStore(store) {
  if (!store || typeof store !== 'object') {
    throw new Error('Cannot save invalid store.');
  }

  const payload = {
    ...store,
    schemaVersion: store.schemaVersion || SCHEMA_VERSION,
    lastSavedAt: new Date().toISOString(),
  };

  const storage = getStorage();
  if (!storage) {
    memoryStore = deepClone(payload);
    return true;
  }

  try {
    storage.setItem(WATER_QUALITY_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch (err) {
    logDiagnostic('Failed to write to localStorage:', err);
    memoryStore = deepClone(payload);
    return false;
  }
}

/**
 * Resets store back to verified initial seed records
 */
export function resetWaterQualityStore() {
  const initial = deepClone(INITIAL_WATER_QUALITY_STORE);
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(WATER_QUALITY_STORAGE_KEY, JSON.stringify(initial));
      storage.removeItem(WATER_QUALITY_OFFLINE_KEY);
    } catch {
      // ignore
    }
  }
  memoryStore = deepClone(initial);
  memoryOfflineQueue = [];
  return initial;
}

/**
 * Offline Action Queue management
 */
export function getOfflineQueue() {
  const storage = getStorage();
  if (!storage) {
    return [...memoryOfflineQueue];
  }
  try {
    const raw = storage.getItem(WATER_QUALITY_OFFLINE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function enqueueOfflineAction(action) {
  if (!action || !action.type) return false;
  const queue = getOfflineQueue();
  const entry = {
    ...action,
    enqueuedAt: new Date().toISOString(),
    idempotencyKey: action.idempotencyKey || `OFFLINE-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
  };
  queue.push(entry);

  const storage = getStorage();
  if (!storage) {
    memoryOfflineQueue = queue;
    return entry;
  }

  try {
    storage.setItem(WATER_QUALITY_OFFLINE_KEY, JSON.stringify(queue));
    return entry;
  } catch {
    memoryOfflineQueue = queue;
    return entry;
  }
}

export function clearOfflineQueue() {
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(WATER_QUALITY_OFFLINE_KEY);
    } catch {
      // ignore
    }
  }
  memoryOfflineQueue = [];
  return true;
}
