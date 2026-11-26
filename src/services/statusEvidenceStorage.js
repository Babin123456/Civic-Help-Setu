/**
 * statusEvidenceStorage.js
 *
 * Tamper-evident client-side persistence for the Cross-Portal Application
 * Status Reconciliation Assistant (#1158).
 * Enforces bounded evidence lists, CSPRNG identifiers, and canonical SHA-256 integrity seals.
 */

import { sha256Hex, canonicalStringify } from './privacyIntegrityService.js';
import { reconcileApplicationStatus } from './statusReconciliationEngine.js';
import { logDiagnostic } from '../utils/diagnostics.js';

export const RECONCILIATION_STORAGE_KEY = 'civicbridge_status_reconciliation_v1';
export const MAX_EVIDENCE_PER_APPLICATION = 50;

/**
 * Computes deterministic SHA-256 seal for an application's reconciliation record.
 */
export function computeRecordSeal(applicationId, evidenceList, lastReport) {
  const payload = {
    version: 1,
    applicationId: String(applicationId || '').trim(),
    evidenceList: Array.isArray(evidenceList) ? evidenceList : [],
    lastReport: lastReport || null,
  };
  return sha256Hex(canonicalStringify(payload));
}

/**
 * Verifies if a stored reconciliation record's integrity seal matches its contents.
 */
export function verifyRecordIntegrity(record) {
  if (!record || typeof record !== 'object') return false;
  if (!record.integrityHash || typeof record.integrityHash !== 'string') return false;

  const expected = computeRecordSeal(
    record.applicationId,
    record.evidenceList,
    record.lastReport
  );

  return expected === record.integrityHash;
}

function getLocalStorage() {
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
    return globalThis.localStorage;
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return undefined;
}

/**
 * Safely reads raw storage map from localStorage.
 */
function readStorageMap() {
  const storage = getLocalStorage();
  if (!storage) {
    return {};
  }
  try {
    const raw = storage.getItem(RECONCILIATION_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Safely persists storage map to localStorage.
 */
function writeStorageMap(map) {
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    storage.setItem(RECONCILIATION_STORAGE_KEY, JSON.stringify(map));
  } catch (err) {
    logDiagnostic('Failed to write status reconciliation record to localStorage', err);
  }
}

/**
 * Retrieves the reconciliation record for an application.
 * Returns null if not found, or returns record with `isTampered: true` if seal check fails.
 *
 * @param {string} applicationId
 * @returns {Object|null}
 */
export function getReconciliationRecord(applicationId) {
  if (!applicationId) return null;
  const map = readStorageMap();
  const rawRecord = map[applicationId];
  if (!rawRecord) return null;

  const isIntact = verifyRecordIntegrity(rawRecord);
  return {
    ...rawRecord,
    isTampered: !isIntact,
  };
}

/**
 * Appends or updates an evidence item in an application's record,
 * re-evaluates the reconciliation report, seals the record, and persists it.
 *
 * @param {string} applicationId
 * @param {Object} evidenceItem - Ingested StatusEvidence item
 * @param {Object} [baseMetadata={}] - Optional base details (baseSubmittedDate, slaDays)
 * @returns {Object} Updated sealed record
 */
export function saveReconciliationEvidence(applicationId, evidenceItem, baseMetadata = {}) {
  if (!applicationId || !evidenceItem) {
    throw new Error('Application ID and evidence item are required.');
  }

  const cleanAppId = String(applicationId).trim();
  const map = readStorageMap();
  const existing = map[cleanAppId] || {
    applicationId: cleanAppId,
    evidenceList: [],
    lastReport: null,
    createdAt: new Date().toISOString(),
  };

  let list = Array.isArray(existing.evidenceList) ? [...existing.evidenceList] : [];

  // Upsert by item.id
  const idx = list.findIndex((e) => e.id === evidenceItem.id);
  if (idx >= 0) {
    list[idx] = evidenceItem;
  } else {
    if (list.length >= MAX_EVIDENCE_PER_APPLICATION) {
      // Drop oldest evidence item to keep list bounded
      list.shift();
    }
    list.push(evidenceItem);
  }

  // Recalculate reconciliation report
  const report = reconcileApplicationStatus({
    applicationId: cleanAppId,
    baseSubmittedDate: baseMetadata.baseSubmittedDate || null,
    evidenceList: list,
    slaDays: baseMetadata.slaDays || 30,
  });

  const updatedRecord = {
    version: 1,
    applicationId: cleanAppId,
    evidenceList: list,
    lastReport: report,
    createdAt: existing.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    integrityHash: computeRecordSeal(cleanAppId, list, report),
  };

  map[cleanAppId] = updatedRecord;
  writeStorageMap(map);

  return updatedRecord;
}

/**
 * Deletes a specific evidence item from an application's record.
 */
export function removeEvidenceItem(applicationId, evidenceId, baseMetadata = {}) {
  if (!applicationId || !evidenceId) return null;
  const cleanAppId = String(applicationId).trim();
  const map = readStorageMap();
  const existing = map[cleanAppId];
  if (!existing || !Array.isArray(existing.evidenceList)) return null;

  const filtered = existing.evidenceList.filter((e) => e.id !== evidenceId);

  const report = reconcileApplicationStatus({
    applicationId: cleanAppId,
    baseSubmittedDate: baseMetadata.baseSubmittedDate || null,
    evidenceList: filtered,
    slaDays: baseMetadata.slaDays || 30,
  });

  const updatedRecord = {
    version: 1,
    applicationId: cleanAppId,
    evidenceList: filtered,
    lastReport: report,
    createdAt: existing.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    integrityHash: computeRecordSeal(cleanAppId, filtered, report),
  };

  map[cleanAppId] = updatedRecord;
  writeStorageMap(map);

  return updatedRecord;
}

/**
 * Purges the reconciliation record for a single application.
 */
export function purgeReconciliationRecord(applicationId) {
  if (!applicationId) return;
  const cleanAppId = String(applicationId).trim();
  const map = readStorageMap();
  if (map[cleanAppId]) {
    delete map[cleanAppId];
    writeStorageMap(map);
  }
}

/**
 * Completely purges all stored reconciliation records.
 */
export function purgeAllReconciliationRecords() {
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    storage.removeItem(RECONCILIATION_STORAGE_KEY);
  } catch (err) {
    logDiagnostic('Failed to purge reconciliation storage', err);
  }
}
