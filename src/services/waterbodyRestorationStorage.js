/**
 * src/services/waterbodyRestorationStorage.js
 *
 * Offline-first storage for Public Waterbody Restoration Milestone & Evidence Tracker (#1442).
 */

import {
  addCommunityObservation,
  migrateWaterbodyStoreState,
  recordMilestoneCorrection,
} from './waterbodyRestorationService.js';

export const WATERBODY_STORAGE_KEY = 'civicbridge_waterbody_restoration_v1';

let memoryFallback = null;

function getStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Ignore
  }
  return null;
}

export function loadLocalWaterbodyState() {
  const storage = getStorage();
  if (storage) {
    try {
      const raw = storage.getItem(WATERBODY_STORAGE_KEY);
      if (raw) {
        return migrateWaterbodyStoreState(JSON.parse(raw));
      }
    } catch {
      // Fallback
    }
  }
  if (memoryFallback) {
    return migrateWaterbodyStoreState(memoryFallback);
  }
  return migrateWaterbodyStoreState({});
}

export function saveLocalWaterbodyState(state) {
  const migrated = migrateWaterbodyStoreState(state);
  memoryFallback = migrated;
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(WATERBODY_STORAGE_KEY, JSON.stringify(migrated));
    } catch {
      // Ignore
    }
  }
  return migrated;
}

export function resetLocalWaterbodyState() {
  memoryFallback = null;
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(WATERBODY_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
}

export function addLocalWaterbodyObservation(waterbodyId, input, actorId = 'local-citizen') {
  const state = loadLocalWaterbodyState();
  const target = state.waterbodies.find((w) => w.waterbodyId === waterbodyId);
  const updated = addCommunityObservation(target, input, actorId);
  const next = saveLocalWaterbodyState({
    ...state,
    waterbodies: state.waterbodies.map((w) => (w.waterbodyId === waterbodyId ? updated : w)),
  });
  return { waterbody: updated, state: next };
}

export function recordLocalMilestoneCorrection(waterbodyId, params) {
  const state = loadLocalWaterbodyState();
  const target = state.waterbodies.find((w) => w.waterbodyId === waterbodyId);
  const updated = recordMilestoneCorrection(target, params);
  const next = saveLocalWaterbodyState({
    ...state,
    waterbodies: state.waterbodies.map((w) => (w.waterbodyId === waterbodyId ? updated : w)),
  });
  return { waterbody: updated, state: next };
}
