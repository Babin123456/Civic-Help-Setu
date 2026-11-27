/**
 * src/services/aiHallucinationReportStorage.js
 *
 * Offline-first persistence and API client wrapper for the Civic AI Hallucination
 * and Unsupported-Claim Reporting Workflow (#1448).
 */

import {
  createHallucinationReport,
  exportAsRegressionFixture,
  migrateHallucinationStoreState,
  resolveHallucinationReport,
  withdrawHallucinationReport,
} from './aiHallucinationReportService.js';

export const HALLUCINATION_STORAGE_KEY = 'civicbridge_ai_hallucination_reports_v1';

let memoryFallback = null;

function getStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Ignore restricted storage environments
  }
  return null;
}

export function loadLocalHallucinationState() {
  const storage = getStorage();
  if (storage) {
    try {
      const raw = storage.getItem(HALLUCINATION_STORAGE_KEY);
      if (raw) {
        return migrateHallucinationStoreState(JSON.parse(raw));
      }
    } catch {
      // Fallback to defaults on parse failure
    }
  }
  if (memoryFallback) {
    return migrateHallucinationStoreState(memoryFallback);
  }
  const initial = migrateHallucinationStoreState({});
  const fixtures = initial.reports
    .filter((r) => r.regressionFixtureId && r.resolution?.officialSource)
    .map((r) => exportAsRegressionFixture(r));
  return { ...initial, regressionFixtures: fixtures };
}

export function saveLocalHallucinationState(state) {
  const migrated = migrateHallucinationStoreState(state);
  memoryFallback = migrated;
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(HALLUCINATION_STORAGE_KEY, JSON.stringify(migrated));
    } catch {
      // Ignore quota exceeded
    }
  }
  return migrated;
}

export function resetLocalHallucinationState() {
  memoryFallback = null;
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(HALLUCINATION_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
}

export function submitLocalHallucinationReport(input, actorId = 'local-citizen') {
  const created = createHallucinationReport(input, actorId);
  if (!created.valid) {
    throw new Error(created.errors.join(' '));
  }
  const state = loadLocalHallucinationState();
  const next = saveLocalHallucinationState({
    ...state,
    reports: [created.report, ...state.reports],
  });
  return { report: created.report, state: next };
}

export function withdrawLocalHallucinationReport(reportId, { actorId = 'local-citizen', role = 'citizen', reason = '' } = {}) {
  const state = loadLocalHallucinationState();
  const target = state.reports.find((r) => r.reportId === reportId);
  const updated = withdrawHallucinationReport(target, { actorId, role, reason });
  const next = saveLocalHallucinationState({
    ...state,
    reports: state.reports.map((r) => (r.reportId === reportId ? updated : r)),
  });
  return { report: updated, state: next };
}

export function resolveLocalHallucinationReport(reportId, params) {
  const state = loadLocalHallucinationState();
  const target = state.reports.find((r) => r.reportId === reportId);
  const { report: updated, fixture } = resolveHallucinationReport(target, params);
  const nextFixtures = fixture ? [fixture, ...state.regressionFixtures] : state.regressionFixtures;
  const next = saveLocalHallucinationState({
    ...state,
    reports: state.reports.map((r) => (r.reportId === reportId ? updated : r)),
    regressionFixtures: nextFixtures,
  });
  return { report: updated, fixture, state: next };
}
