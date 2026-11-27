/**
 * src/services/parkMaintenanceScheduleStorage.js
 *
 * Offline-first storage for Public Park Maintenance & Amenity Inspection Schedule (#1440).
 */

import {
  migrateParkMaintenanceState,
  submitResidentParkObservation,
} from './parkMaintenanceScheduleService.js';

export const PARK_SCHEDULE_STORAGE_KEY = 'civicbridge_park_maintenance_schedule_v1';

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

export function loadLocalParkScheduleState() {
  const storage = getStorage();
  if (storage) {
    try {
      const raw = storage.getItem(PARK_SCHEDULE_STORAGE_KEY);
      if (raw) {
        return migrateParkMaintenanceState(JSON.parse(raw));
      }
    } catch {
      // Fallback
    }
  }
  if (memoryFallback) {
    return migrateParkMaintenanceState(memoryFallback);
  }
  return migrateParkMaintenanceState({});
}

export function saveLocalParkScheduleState(state) {
  const migrated = migrateParkMaintenanceState(state);
  memoryFallback = migrated;
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(PARK_SCHEDULE_STORAGE_KEY, JSON.stringify(migrated));
    } catch {
      // Ignore
    }
  }
  return migrated;
}

export function resetLocalParkScheduleState() {
  memoryFallback = null;
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(PARK_SCHEDULE_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
}

export function addLocalParkObservation(parkId, input, actorId = 'local-resident') {
  const state = loadLocalParkScheduleState();
  const target = state.parks.find((p) => p.parkId === parkId);
  const updated = submitResidentParkObservation(target, input, actorId);
  const next = saveLocalParkScheduleState({
    ...state,
    parks: state.parks.map((p) => (p.parkId === parkId ? updated : p)),
  });
  return { park: updated, state: next };
}
