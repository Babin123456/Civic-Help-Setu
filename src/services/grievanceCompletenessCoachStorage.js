/**
 * src/services/grievanceCompletenessCoachStorage.js
 *
 * Local-first storage for Public Grievance Language Quality & Completeness Coach (#1444).
 */

import {
  analyzeGrievanceDraft,
  decideCoachSuggestion,
  migrateCoachStoreState,
} from './grievanceCompletenessCoachService.js';

export const COACH_STORAGE_KEY = 'civicbridge_grievance_completeness_coach_v1';

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

export function loadLocalCoachState() {
  const storage = getStorage();
  if (storage) {
    try {
      const raw = storage.getItem(COACH_STORAGE_KEY);
      if (raw) {
        return migrateCoachStoreState(JSON.parse(raw));
      }
    } catch {
      // Fallback
    }
  }
  if (memoryFallback) {
    return migrateCoachStoreState(memoryFallback);
  }
  const seed = analyzeGrievanceDraft({
    originalText: 'The street light is useless and corrupt contractor has not fixed it.',
    language: 'en',
    jurisdiction: 'IN-UP',
  });
  return migrateCoachStoreState({ drafts: [seed] });
}

export function saveLocalCoachState(state) {
  const migrated = migrateCoachStoreState(state);
  memoryFallback = migrated;
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(COACH_STORAGE_KEY, JSON.stringify(migrated));
    } catch {
      // Ignore
    }
  }
  return migrated;
}

export function resetLocalCoachState() {
  memoryFallback = null;
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(COACH_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
}

export function analyzeAndSaveLocalDraft(params) {
  const draft = analyzeGrievanceDraft(params);
  const state = loadLocalCoachState();
  const next = saveLocalCoachState({
    ...state,
    drafts: [draft, ...state.drafts].slice(0, 50),
  });
  return { draft, state: next };
}

export function decideLocalDraftSuggestion(draftId, params) {
  const state = loadLocalCoachState();
  const target = state.drafts.find((d) => d.draftId === draftId);
  const updated = decideCoachSuggestion(target, params);
  const next = saveLocalCoachState({
    ...state,
    drafts: state.drafts.map((d) => (d.draftId === draftId ? updated : d)),
  });
  return { draft: updated, state: next };
}
