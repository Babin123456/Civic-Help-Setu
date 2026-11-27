/**
 * src/services/schoolDefectRegisterStorage.js
 *
 * Offline-first storage for Public School Infrastructure Defect & Follow-Up Register (#1437).
 */

import {
  createSchoolDefectReport,
  migrateSchoolDefectStoreState,
} from './schoolDefectRegisterService.js';

export const SCHOOL_DEFECT_STORAGE_KEY = 'civicbridge_school_defect_register_v1';

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

export function loadLocalSchoolDefectState() {
  const storage = getStorage();
  if (storage) {
    try {
      const raw = storage.getItem(SCHOOL_DEFECT_STORAGE_KEY);
      if (raw) {
        return migrateSchoolDefectStoreState(JSON.parse(raw));
      }
    } catch {
      // Fallback
    }
  }
  if (memoryFallback) {
    return migrateSchoolDefectStoreState(memoryFallback);
  }
  return migrateSchoolDefectStoreState({});
}

export function saveLocalSchoolDefectState(state) {
  const migrated = migrateSchoolDefectStoreState(state);
  memoryFallback = migrated;
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(SCHOOL_DEFECT_STORAGE_KEY, JSON.stringify(migrated));
    } catch {
      // Ignore
    }
  }
  return migrated;
}

export function resetLocalSchoolDefectState() {
  memoryFallback = null;
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(SCHOOL_DEFECT_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
}

export function addLocalSchoolDefectReport(input, actorId = 'local-parent') {
  const created = createSchoolDefectReport(input, actorId);
  if (!created.valid) {
    throw new Error(created.errors.join(' '));
  }
  const state = loadLocalSchoolDefectState();
  const next = saveLocalSchoolDefectState({
    ...state,
    reports: [created.report, ...state.reports],
  });
  return { report: created.report, state: next };
}
