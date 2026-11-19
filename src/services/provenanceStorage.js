/**
 * src/services/provenanceStorage.js
 * Persistent storage abstraction for Civic Knowledge Records Lineage & Provenance (#777).
 * Encapsulates localStorage access, seed initialization, atomic updates, and audit logging.
 */

import {
  SEED_KNOWLEDGE_SOURCES,
  SEED_SOURCE_SNAPSHOTS,
  SEED_TRANSFORMATION_RUNS,
  SEED_PROVENANCE_EDGES,
  SEED_EDITORIAL_REVIEWS,
  SEED_SUPERSESSION_LINKS,
} from '../data/provenanceSeedData';

export const STORAGE_KEYS = Object.freeze({
  SOURCES: 'civicbridge_knowledge_sources_v1',
  SNAPSHOTS: 'civicbridge_source_snapshots_v1',
  TRANSFORMATIONS: 'civicbridge_transformation_runs_v1',
  EDGES: 'civicbridge_provenance_edges_v1',
  REVIEWS: 'civicbridge_editorial_reviews_v1',
  SUPERSESSIONS: 'civicbridge_supersession_links_v1',
  AUDIT: 'civicbridge_provenance_audit_v1',
});

// In-memory fallback map for non-browser / test environments
const memoryStore = new Map();

const getStorage = () => {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      return globalThis.localStorage;
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Access denied or not available
  }
  return null;
};

const safeRead = (key, fallback) => {
  const storage = getStorage();
  if (storage) {
    try {
      const raw = storage.getItem(key);
      if (!raw) {
        return memoryStore.has(key) ? memoryStore.get(key) : fallback;
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) || typeof parsed === 'object' ? parsed : fallback;
    } catch {
      // Fall through to memoryStore
    }
  }
  return memoryStore.has(key) ? memoryStore.get(key) : fallback;
};

const safeWrite = (key, val) => {
  memoryStore.set(key, val);
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(key, JSON.stringify(val));
      return true;
    } catch {
      return true; // Still saved in memoryStore
    }
  }
  return true;
};

/**
 * Ensures all collections are seeded if empty.
 */
export const initializeProvenanceStorage = (forceReset = false) => {
  if (forceReset) {
    memoryStore.clear();
  }

  const existingSources = safeRead(STORAGE_KEYS.SOURCES, null);
  if (forceReset || !existingSources) {
    safeWrite(STORAGE_KEYS.SOURCES, SEED_KNOWLEDGE_SOURCES);
  }
  const existingSnapshots = safeRead(STORAGE_KEYS.SNAPSHOTS, null);
  if (forceReset || !existingSnapshots) {
    safeWrite(STORAGE_KEYS.SNAPSHOTS, SEED_SOURCE_SNAPSHOTS);
  }
  const existingTrans = safeRead(STORAGE_KEYS.TRANSFORMATIONS, null);
  if (forceReset || !existingTrans) {
    safeWrite(STORAGE_KEYS.TRANSFORMATIONS, SEED_TRANSFORMATION_RUNS);
  }
  const existingEdges = safeRead(STORAGE_KEYS.EDGES, null);
  if (forceReset || !existingEdges) {
    safeWrite(STORAGE_KEYS.EDGES, SEED_PROVENANCE_EDGES);
  }
  const existingReviews = safeRead(STORAGE_KEYS.REVIEWS, null);
  if (forceReset || !existingReviews) {
    safeWrite(STORAGE_KEYS.REVIEWS, SEED_EDITORIAL_REVIEWS);
  }
  const existingSuper = safeRead(STORAGE_KEYS.SUPERSESSIONS, null);
  if (forceReset || !existingSuper) {
    safeWrite(STORAGE_KEYS.SUPERSESSIONS, SEED_SUPERSESSION_LINKS);
  }
  const existingAudit = safeRead(STORAGE_KEYS.AUDIT, null);
  if (forceReset || !existingAudit) {
    safeWrite(STORAGE_KEYS.AUDIT, []);
  }
};

// Initial run
initializeProvenanceStorage(false);

export const getStoredSources = () => safeRead(STORAGE_KEYS.SOURCES, SEED_KNOWLEDGE_SOURCES);
export const saveStoredSources = (sources) => safeWrite(STORAGE_KEYS.SOURCES, sources);

export const getStoredSnapshots = () => safeRead(STORAGE_KEYS.SNAPSHOTS, SEED_SOURCE_SNAPSHOTS);
export const saveStoredSnapshots = (snapshots) => safeWrite(STORAGE_KEYS.SNAPSHOTS, snapshots);

export const getStoredTransformations = () => safeRead(STORAGE_KEYS.TRANSFORMATIONS, SEED_TRANSFORMATION_RUNS);
export const saveStoredTransformations = (trans) => safeWrite(STORAGE_KEYS.TRANSFORMATIONS, trans);

export const getStoredEdges = () => safeRead(STORAGE_KEYS.EDGES, SEED_PROVENANCE_EDGES);
export const saveStoredEdges = (edges) => safeWrite(STORAGE_KEYS.EDGES, edges);

export const getStoredReviews = () => safeRead(STORAGE_KEYS.REVIEWS, SEED_EDITORIAL_REVIEWS);
export const saveStoredReviews = (reviews) => safeWrite(STORAGE_KEYS.REVIEWS, reviews);

export const getStoredSupersessions = () => safeRead(STORAGE_KEYS.SUPERSESSIONS, SEED_SUPERSESSION_LINKS);
export const saveStoredSupersessions = (links) => safeWrite(STORAGE_KEYS.SUPERSESSIONS, links);

export const getStoredAuditLogs = () => safeRead(STORAGE_KEYS.AUDIT, []);
export const appendAuditLog = (event) => {
  const current = getStoredAuditLogs();
  const entry = {
    id: `audit_prov_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...event,
  };
  const updated = [entry, ...current].slice(0, 500); // capped append-only log
  safeWrite(STORAGE_KEYS.AUDIT, updated);
  return entry;
};
