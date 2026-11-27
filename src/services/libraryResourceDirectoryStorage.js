/**
 * src/services/libraryResourceDirectoryStorage.js
 *
 * Offline-first storage for Public Library & Community Learning Resource Directory (#1439).
 */

import {
  migrateLibraryDirectoryState,
  submitCommunityLibraryUpdate,
} from './libraryResourceDirectoryService.js';

export const LIBRARY_DIR_STORAGE_KEY = 'civicbridge_library_resource_directory_v1';

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

export function loadLocalLibraryDirectoryState() {
  const storage = getStorage();
  if (storage) {
    try {
      const raw = storage.getItem(LIBRARY_DIR_STORAGE_KEY);
      if (raw) {
        return migrateLibraryDirectoryState(JSON.parse(raw));
      }
    } catch {
      // Fallback
    }
  }
  if (memoryFallback) {
    return migrateLibraryDirectoryState(memoryFallback);
  }
  return migrateLibraryDirectoryState({});
}

export function saveLocalLibraryDirectoryState(state) {
  const migrated = migrateLibraryDirectoryState(state);
  memoryFallback = migrated;
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(LIBRARY_DIR_STORAGE_KEY, JSON.stringify(migrated));
    } catch {
      // Ignore
    }
  }
  return migrated;
}

export function resetLocalLibraryDirectoryState() {
  memoryFallback = null;
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(LIBRARY_DIR_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
}

export function submitLocalLibraryUpdate(facilityId, input, actorId = 'local-citizen') {
  const state = loadLocalLibraryDirectoryState();
  const target = state.facilities.find((f) => f.facilityId === facilityId);
  const updated = submitCommunityLibraryUpdate(target, input, actorId);
  const next = saveLocalLibraryDirectoryState({
    ...state,
    facilities: state.facilities.map((f) => (f.facilityId === facilityId ? updated : f)),
  });
  return { facility: updated, state: next };
}
