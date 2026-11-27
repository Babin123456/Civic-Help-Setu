/**
 * src/services/grievanceDepartmentRoutingStorage.js
 *
 * Offline-first storage for AI-Assisted Grievance Department Routing (#1445).
 */

import {
  applyHumanRoutingOverride,
  classifyGrievanceDepartments,
  migrateGrievanceRoutingState,
} from './grievanceDepartmentRoutingService.js';

export const GRIEVANCE_ROUTING_STORAGE_KEY = 'civicbridge_grievance_routing_v1';

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

export function loadLocalRoutingState() {
  const storage = getStorage();
  if (storage) {
    try {
      const raw = storage.getItem(GRIEVANCE_ROUTING_STORAGE_KEY);
      if (raw) {
        return migrateGrievanceRoutingState(JSON.parse(raw));
      }
    } catch {
      // Fallback
    }
  }
  if (memoryFallback) {
    return migrateGrievanceRoutingState(memoryFallback);
  }
  const seed = classifyGrievanceDepartments({
    description: 'Broken road pothole and pipeline burst causing dirty water supply near Ward 14.',
    jurisdiction: 'IN-UP',
  });
  return migrateGrievanceRoutingState({ cases: [seed] });
}

export function saveLocalRoutingState(state) {
  const migrated = migrateGrievanceRoutingState(state);
  memoryFallback = migrated;
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(GRIEVANCE_ROUTING_STORAGE_KEY, JSON.stringify(migrated));
    } catch {
      // Ignore
    }
  }
  return migrated;
}

export function resetLocalRoutingState() {
  memoryFallback = null;
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(GRIEVANCE_ROUTING_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
}

export function classifyAndStoreLocalCase(params) {
  const routing = classifyGrievanceDepartments(params);
  const state = loadLocalRoutingState();
  const next = saveLocalRoutingState({
    ...state,
    cases: [routing, ...state.cases].slice(0, 50),
  });
  return { routing, state: next };
}

export function overrideLocalRoutingCase(caseId, params) {
  const state = loadLocalRoutingState();
  const target = state.cases.find((c) => c.caseId === caseId);
  const updated = applyHumanRoutingOverride(target, params);
  const next = saveLocalRoutingState({
    ...state,
    cases: state.cases.map((c) => (c.caseId === caseId ? updated : c)),
  });
  return { routing: updated, state: next };
}
