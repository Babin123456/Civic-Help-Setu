/**
 * src/services/pedestrianBarrierStorage.js
 * Persistent local storage, in-memory fallback, and offline mutation queue
 * for Accessible Pedestrian Route Barrier Map (#757).
 */

import {
  INITIAL_INTERSECTION_NODES,
  INITIAL_PEDESTRIAN_SEGMENTS,
  INITIAL_CROSSING_ASSETS,
  INITIAL_BARRIER_OBSERVATIONS,
  INITIAL_TEMPORARY_OBSTRUCTIONS,
  INITIAL_VERIFICATION_EVENTS,
} from '../data/pedestrianBarrierSeed.js';
import { DEFAULT_ROUTE_PREFERENCES } from '../data/pedestrianBarrierContract.js';
import { logDiagnostic } from '../utils/diagnostics.js';

const STORAGE_KEY_NODES = 'civicbridge_pedestrian_nodes_v1';
const STORAGE_KEY_SEGMENTS = 'civicbridge_pedestrian_segments_v1';
const STORAGE_KEY_CROSSINGS = 'civicbridge_pedestrian_crossings_v1';
const STORAGE_KEY_OBSERVATIONS = 'civicbridge_pedestrian_observations_v1';
const STORAGE_KEY_OBSTRUCTIONS = 'civicbridge_pedestrian_obstructions_v1';
const STORAGE_KEY_AUDIT_EVENTS = 'civicbridge_pedestrian_audit_events_v1';
const STORAGE_KEY_PREFERENCES = 'civicbridge_pedestrian_preferences_v1';
const STORAGE_KEY_OFFLINE_QUEUE = 'civicbridge_pedestrian_offline_queue_v1';

const inMemoryStore = new Map();

const safeGetItem = (key, fallback) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    }
    if (inMemoryStore.has(key)) {
      return inMemoryStore.get(key);
    }
    return fallback;
  } catch (err) {
    logDiagnostic(`[pedestrianBarrierStorage] Error reading ${key}:`, err);
    return fallback;
  }
};

const safeSetItem = (key, value) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
    inMemoryStore.set(key, JSON.parse(JSON.stringify(value)));
  } catch (err) {
    logDiagnostic(`[pedestrianBarrierStorage] Error saving ${key}:`, err);
  }
};

export const loadStoredNodes = () => {
  return safeGetItem(STORAGE_KEY_NODES, INITIAL_INTERSECTION_NODES);
};

export const saveStoredNodes = (nodes) => {
  safeSetItem(STORAGE_KEY_NODES, nodes);
};

export const loadStoredSegments = () => {
  return safeGetItem(STORAGE_KEY_SEGMENTS, INITIAL_PEDESTRIAN_SEGMENTS);
};

export const saveStoredSegments = (segments) => {
  safeSetItem(STORAGE_KEY_SEGMENTS, segments);
};

export const loadStoredCrossings = () => {
  return safeGetItem(STORAGE_KEY_CROSSINGS, INITIAL_CROSSING_ASSETS);
};

export const saveStoredCrossings = (crossings) => {
  safeSetItem(STORAGE_KEY_CROSSINGS, crossings);
};

export const loadStoredObservations = () => {
  return safeGetItem(STORAGE_KEY_OBSERVATIONS, INITIAL_BARRIER_OBSERVATIONS);
};

export const saveStoredObservations = (observations) => {
  safeSetItem(STORAGE_KEY_OBSERVATIONS, observations);
};

export const loadStoredObstructions = () => {
  return safeGetItem(STORAGE_KEY_OBSTRUCTIONS, INITIAL_TEMPORARY_OBSTRUCTIONS);
};

export const saveStoredObstructions = (obstructions) => {
  safeSetItem(STORAGE_KEY_OBSTRUCTIONS, obstructions);
};

export const loadStoredAuditEvents = () => {
  return safeGetItem(STORAGE_KEY_AUDIT_EVENTS, INITIAL_VERIFICATION_EVENTS);
};

export const saveStoredAuditEvents = (events) => {
  safeSetItem(STORAGE_KEY_AUDIT_EVENTS, events);
};

export const loadStoredRoutePreferences = () => {
  return safeGetItem(STORAGE_KEY_PREFERENCES, DEFAULT_ROUTE_PREFERENCES);
};

export const saveStoredRoutePreferences = (preferences) => {
  safeSetItem(STORAGE_KEY_PREFERENCES, preferences);
};

export const loadOfflineQueue = () => {
  return safeGetItem(STORAGE_KEY_OFFLINE_QUEUE, []);
};

export const enqueueOfflineAction = (action) => {
  const queue = loadOfflineQueue();
  const enqueued = {
    ...action,
    enqueuedAt: new Date().toISOString(),
    idempotencyKey: action.idempotencyKey || `IDEM-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
  queue.push(enqueued);
  safeSetItem(STORAGE_KEY_OFFLINE_QUEUE, queue);
  return enqueued;
};

export const clearOfflineQueue = () => {
  safeSetItem(STORAGE_KEY_OFFLINE_QUEUE, []);
};

/**
 * Resets all tables to initial seed data (for testing and manual reset).
 */
export const resetPedestrianBarrierData = () => {
  safeSetItem(STORAGE_KEY_NODES, INITIAL_INTERSECTION_NODES);
  safeSetItem(STORAGE_KEY_SEGMENTS, INITIAL_PEDESTRIAN_SEGMENTS);
  safeSetItem(STORAGE_KEY_CROSSINGS, INITIAL_CROSSING_ASSETS);
  safeSetItem(STORAGE_KEY_OBSERVATIONS, INITIAL_BARRIER_OBSERVATIONS);
  safeSetItem(STORAGE_KEY_OBSTRUCTIONS, INITIAL_TEMPORARY_OBSTRUCTIONS);
  safeSetItem(STORAGE_KEY_AUDIT_EVENTS, INITIAL_VERIFICATION_EVENTS);
  safeSetItem(STORAGE_KEY_PREFERENCES, DEFAULT_ROUTE_PREFERENCES);
  safeSetItem(STORAGE_KEY_OFFLINE_QUEUE, []);
};
