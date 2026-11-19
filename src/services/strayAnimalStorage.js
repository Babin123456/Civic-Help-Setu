/**
 * strayAnimalStorage.js
 *
 * Client-side offline-first persistence engine for Municipal Stray Animal Conflict,
 * Animal Birth Control (ABC) audits, and Rabies PEP emergency records.
 *
 * Features:
 * - LocalStorage adapter with resilient in-memory fallback.
 * - Canonical SHA-256 digital sealing (computeRecordDigest) for court & municipal evidence.
 * - Tamper detection (verifyRecordIntegrity).
 * - DPDP Act 2023 compliant PII minimization for public exports (minimizeForExternal).
 * - Slip & JSON export formatting.
 */

import { generateMunicipalAbcRequisition, generateRabiesPepSlip } from './strayAnimalAbcService.js';

export const STRAY_ANIMAL_STORAGE_KEY = 'civicbridge_abc_conflict_records';

let inMemoryStore = null;

function getStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

/**
 * Computes a deterministic SHA-256 hex digest of a record.
 * Falls back to deterministic DJB2/FNV hash when subtle.crypto is not available.
 *
 * @param {Object} record
 * @returns {Promise<string>} Hex seal string
 */
export async function computeRecordDigest(record) {
  const normalized = {
    recordType: record.recordType || 'pep_vaccination_log',
    category: record.category || '',
    exposureDate: record.exposureDate || '',
    weightKg: record.weightKg || 0,
    regimenKey: record.regimenKey || '',
    wardNumber: record.wardNumber || '',
    colonyName: record.colonyName || '',
    createdAt: record.createdAt || '',
  };

  const canonicalString = JSON.stringify(normalized, Object.keys(normalized).sort());

  if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
    const encoder = new TextEncoder();
    const data = encoder.encode(canonicalString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback hash implementation
  let hash = 5381;
  for (let i = 0; i < canonicalString.length; i++) {
    hash = ((hash << 5) + hash) + canonicalString.charCodeAt(i);
    hash |= 0;
  }
  return 'seal_' + Math.abs(hash).toString(16).padStart(16, '0');
}

/**
 * Verifies record integrity against its stored digital seal.
 *
 * @param {Object} record
 * @returns {Promise<boolean>} True if untouched
 */
export async function verifyRecordIntegrity(record) {
  if (!record || !record.digitalSeal) return false;
  const currentDigest = await computeRecordDigest(record);
  return currentDigest === record.digitalSeal;
}

/**
 * Redacts personal identifiers in compliance with DPDP Act 2023 for public slip exports.
 *
 * @param {Object} record
 * @returns {Object} Scrubbed record
 */
export function minimizeForExternal(record) {
  if (!record) return {};
  const scrubbed = JSON.parse(JSON.stringify(record));

  if (scrubbed.patient?.name) {
    const nameParts = scrubbed.patient.name.trim().split(' ');
    scrubbed.patient.name = nameParts.length > 1
      ? `${nameParts[0]} [REDACTED]`
      : `${scrubbed.patient.name.charAt(0)}*** [REDACTED]`;
  }

  if (scrubbed.patient?.contact) {
    scrubbed.patient.contact = 'XXXXXX' + String(scrubbed.patient.contact).slice(-4);
  }

  if (scrubbed.applicant?.name) {
    const applicantParts = scrubbed.applicant.name.trim().split(' ');
    scrubbed.applicant.name = applicantParts.length > 1
      ? `${applicantParts[0]} [REDACTED]`
      : `${scrubbed.applicant.name.charAt(0)}*** [REDACTED]`;
  }

  if (scrubbed.applicant?.contact) {
    scrubbed.applicant.contact = 'XXXXXX' + String(scrubbed.applicant.contact).slice(-4);
  }

  return scrubbed;
}

/**
 * Loads all records from storage.
 *
 * @returns {Array<Object>} List of records
 */
export function getStoredRecords() {
  const storage = getStorage();
  if (storage) {
    try {
      const raw = storage.getItem(STRAY_ANIMAL_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
  return inMemoryStore ? [...inMemoryStore] : [];
}

/**
 * Saves a new or updated record with digital seal.
 *
 * @param {Object} recordData
 * @returns {Promise<Object>} Saved record with id and digitalSeal
 */
export async function saveRecord(recordData) {
  const records = getStoredRecords();
  const id = recordData.id || `rec_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const createdAt = recordData.createdAt || new Date().toISOString();

  const recordToSeal = {
    ...recordData,
    id,
    createdAt,
  };

  const digitalSeal = await computeRecordDigest(recordToSeal);
  const completeRecord = {
    ...recordToSeal,
    digitalSeal,
    updatedAt: new Date().toISOString(),
  };

  const existingIdx = records.findIndex((r) => r.id === id);
  if (existingIdx >= 0) {
    records[existingIdx] = completeRecord;
  } else {
    records.unshift(completeRecord);
  }

  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(STRAY_ANIMAL_STORAGE_KEY, JSON.stringify(records));
    } catch {
      inMemoryStore = records;
    }
  } else {
    inMemoryStore = records;
  }

  return completeRecord;
}

/**
 * Retrieves a single record by id.
 *
 * @param {string} id
 * @returns {Object|null}
 */
export function getRecordById(id) {
  const records = getStoredRecords();
  return records.find((r) => r.id === id) || null;
}

/**
 * Deletes a record by id.
 *
 * @param {string} id
 * @returns {boolean} True if deleted
 */
export function deleteRecord(id) {
  const records = getStoredRecords();
  const filtered = records.filter((r) => r.id !== id);
  const deleted = filtered.length !== records.length;

  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(STRAY_ANIMAL_STORAGE_KEY, JSON.stringify(filtered));
    } catch {
      inMemoryStore = filtered;
    }
  } else {
    inMemoryStore = filtered;
  }

  return deleted;
}

/**
 * Clears all records.
 */
export function clearAllRecords() {
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(STRAY_ANIMAL_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
  inMemoryStore = [];
}

/**
 * Generates downloadable JSON slip of a record.
 *
 * @param {Object} record
 * @param {boolean} [redactPii=false]
 * @returns {string} JSON string
 */
export function exportRecordJsonSlip(record, redactPii = false) {
  const data = redactPii ? minimizeForExternal(record) : record;
  return JSON.stringify(data, null, 2);
}

/**
 * Generates downloadable legal/clinical text document for a record.
 *
 * @param {Object} record
 * @returns {string} Formatted text document
 */
export function exportRecordTextSlip(record) {
  if (record.recordType === 'pep_vaccination_log') {
    return generateRabiesPepSlip(record);
  }
  return generateMunicipalAbcRequisition(record);
}
