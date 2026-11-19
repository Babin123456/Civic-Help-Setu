/**
 * src/services/openContractingStorage.js
 * Persistent storage abstraction for Open Contracting Red-Flag Analytics (#751).
 *
 * Supports:
 * - LocalStorage persistence with memory fallback (for SSR/node test environments).
 * - Automatic seed hydration on initial load.
 * - Append-only audit logs.
 * - Offline action queue for network resilience.
 * - Reset and migration primitives.
 */

import { OPEN_CONTRACTING_SEED_DATA } from '../data/openContractingSeed.js';

export const STORAGE_KEYS = Object.freeze({
  NOTICES: 'civic_open_contracting_notices_v1',
  BIDS: 'civic_open_contracting_bids_v1',
  AWARDS: 'civic_open_contracting_awards_v1',
  AMENDMENTS: 'civic_open_contracting_amendments_v1',
  VENDORS: 'civic_open_contracting_vendors_v1',
  REVIEWS: 'civic_open_contracting_reviews_v1',
  AUDIT_LOGS: 'civic_open_contracting_audit_logs_v1',
  OFFLINE_QUEUE: 'civic_open_contracting_offline_queue_v1',
});

// Memory cache fallback for tests/SSR
const memoryStore = new Map();

const isStorageAvailable = () => {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
};

const getItem = (key) => {
  if (isStorageAvailable()) {
    try {
      const val = window.localStorage.getItem(key);
      return val ? JSON.parse(val) : null;
    } catch {
      return memoryStore.get(key) || null;
    }
  }
  return memoryStore.get(key) || null;
};

const setItem = (key, value) => {
  const serialized = JSON.stringify(value);
  if (isStorageAvailable()) {
    try {
      window.localStorage.setItem(key, serialized);
    } catch {
      // Fallback on memory if storage quota exceeded
      memoryStore.set(key, value);
    }
  }
  memoryStore.set(key, value);
};

export const loadStoredNotices = () => {
  const existing = getItem(STORAGE_KEYS.NOTICES);
  if (existing && Array.isArray(existing)) return existing;
  setItem(STORAGE_KEYS.NOTICES, OPEN_CONTRACTING_SEED_DATA.notices);
  return OPEN_CONTRACTING_SEED_DATA.notices;
};

export const saveStoredNotices = (notices) => {
  setItem(STORAGE_KEYS.NOTICES, notices);
};

export const loadStoredBids = () => {
  const existing = getItem(STORAGE_KEYS.BIDS);
  if (existing && Array.isArray(existing)) return existing;
  setItem(STORAGE_KEYS.BIDS, OPEN_CONTRACTING_SEED_DATA.bids);
  return OPEN_CONTRACTING_SEED_DATA.bids;
};

export const loadStoredAwards = () => {
  const existing = getItem(STORAGE_KEYS.AWARDS);
  if (existing && Array.isArray(existing)) return existing;
  setItem(STORAGE_KEYS.AWARDS, OPEN_CONTRACTING_SEED_DATA.awards);
  return OPEN_CONTRACTING_SEED_DATA.awards;
};

export const loadStoredAmendments = () => {
  const existing = getItem(STORAGE_KEYS.AMENDMENTS);
  if (existing && Array.isArray(existing)) return existing;
  setItem(STORAGE_KEYS.AMENDMENTS, OPEN_CONTRACTING_SEED_DATA.amendments);
  return OPEN_CONTRACTING_SEED_DATA.amendments;
};

export const loadStoredVendors = () => {
  const existing = getItem(STORAGE_KEYS.VENDORS);
  if (existing && Array.isArray(existing)) return existing;
  setItem(STORAGE_KEYS.VENDORS, OPEN_CONTRACTING_SEED_DATA.vendors);
  return OPEN_CONTRACTING_SEED_DATA.vendors;
};

export const loadStoredReviews = () => {
  const existing = getItem(STORAGE_KEYS.REVIEWS);
  if (existing && Array.isArray(existing)) return existing;
  setItem(STORAGE_KEYS.REVIEWS, OPEN_CONTRACTING_SEED_DATA.reviews);
  return OPEN_CONTRACTING_SEED_DATA.reviews;
};

export const saveStoredReviews = (reviews) => {
  setItem(STORAGE_KEYS.REVIEWS, reviews);
};

export const loadAuditLogs = () => {
  const logs = getItem(STORAGE_KEYS.AUDIT_LOGS);
  return Array.isArray(logs) ? logs : [];
};

export const appendAuditLog = (entry) => {
  const current = loadAuditLogs();
  const updated = [
    {
      id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    },
    ...current,
  ];
  setItem(STORAGE_KEYS.AUDIT_LOGS, updated);
  return updated;
};

export const loadOfflineQueue = () => {
  const queue = getItem(STORAGE_KEYS.OFFLINE_QUEUE);
  return Array.isArray(queue) ? queue : [];
};

export const enqueueOfflineAction = (action) => {
  const current = loadOfflineQueue();
  const updated = [...current, { ...action, queuedAt: new Date().toISOString() }];
  setItem(STORAGE_KEYS.OFFLINE_QUEUE, updated);
  return updated;
};

export const clearOfflineQueue = () => {
  setItem(STORAGE_KEYS.OFFLINE_QUEUE, []);
};

export const resetOpenContractingData = () => {
  memoryStore.clear();
  if (isStorageAvailable()) {
    Object.values(STORAGE_KEYS).forEach((k) => {
      try {
        window.localStorage.removeItem(k);
      } catch {
        // Ignore
      }
    });
  }
};
