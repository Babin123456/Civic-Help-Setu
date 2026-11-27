/**
 * src/services/anganwadiCalendarStorage.js
 *
 * Offline-first storage for Public Anganwadi Service Availability & Nutrition-Day Calendar (#1438).
 */

import {
  migrateAnganwadiCalendarState,
  submitCommunityCentreStatus,
} from './anganwadiCalendarService.js';

export const ANGANWADI_CALENDAR_STORAGE_KEY = 'civicbridge_anganwadi_calendar_v1';

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

export function loadLocalAnganwadiState() {
  const storage = getStorage();
  if (storage) {
    try {
      const raw = storage.getItem(ANGANWADI_CALENDAR_STORAGE_KEY);
      if (raw) {
        return migrateAnganwadiCalendarState(JSON.parse(raw));
      }
    } catch {
      // Fallback
    }
  }
  if (memoryFallback) {
    return migrateAnganwadiCalendarState(memoryFallback);
  }
  return migrateAnganwadiCalendarState({});
}

export function saveLocalAnganwadiState(state) {
  const migrated = migrateAnganwadiCalendarState(state);
  memoryFallback = migrated;
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(ANGANWADI_CALENDAR_STORAGE_KEY, JSON.stringify(migrated));
    } catch {
      // Ignore
    }
  }
  return migrated;
}

export function resetLocalAnganwadiState() {
  memoryFallback = null;
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(ANGANWADI_CALENDAR_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
}

export function submitLocalCommunityStatus(centreId, input, actorId = 'local-citizen') {
  const state = loadLocalAnganwadiState();
  const target = state.centres.find((c) => c.centreId === centreId);
  const updated = submitCommunityCentreStatus(target, input, actorId);
  const next = saveLocalAnganwadiState({
    ...state,
    centres: state.centres.map((c) => (c.centreId === centreId ? updated : c)),
  });
  return { centre: updated, state: next };
}
