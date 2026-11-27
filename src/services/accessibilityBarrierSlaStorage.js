/**
 * src/services/accessibilityBarrierSlaStorage.js
 *
 * Offline-first storage for Accessibility Barrier Resolution SLA Dashboard (#1443).
 */

import {
  createBarrierSlaReport,
  migrateBarrierSlaState,
} from './accessibilityBarrierSlaService.js';

export const BARRIER_SLA_STORAGE_KEY = 'civicbridge_accessibility_barrier_sla_v1';

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

export function loadLocalBarrierSlaState() {
  const storage = getStorage();
  if (storage) {
    try {
      const raw = storage.getItem(BARRIER_SLA_STORAGE_KEY);
      if (raw) {
        return migrateBarrierSlaState(JSON.parse(raw));
      }
    } catch {
      // Fallback
    }
  }
  if (memoryFallback) {
    return migrateBarrierSlaState(memoryFallback);
  }
  return migrateBarrierSlaState({});
}

export function saveLocalBarrierSlaState(state) {
  const migrated = migrateBarrierSlaState(state);
  memoryFallback = migrated;
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(BARRIER_SLA_STORAGE_KEY, JSON.stringify(migrated));
    } catch {
      // Ignore
    }
  }
  return migrated;
}

export function resetLocalBarrierSlaState() {
  memoryFallback = null;
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(BARRIER_SLA_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
}

export function addLocalBarrierSlaReport(input, actorId = 'local-citizen') {
  const created = createBarrierSlaReport(input, actorId);
  if (!created.valid) {
    throw new Error(created.errors.join(' '));
  }
  const state = loadLocalBarrierSlaState();
  const next = saveLocalBarrierSlaState({
    ...state,
    reports: [created.report, ...state.reports],
  });
  return { report: created.report, state: next };
}
