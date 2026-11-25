/**
 * noisePollutionStorage.js
 *
 * Client-side offline-first persistence engine for Ambient Noise Pollution decibel logs,
 * curfew infractions, and SDM statutory notices.
 *
 * Features:
 * - LocalStorage adapter with in-memory fallback.
 * - Canonical SHA-256 digital seals (computeNoiseLogDigest) for court & SDM evidence.
 * - Tamper detection (verifyNoiseLogIntegrity).
 * - DPDP Act 2023 compliant PII minimization for public exports (minimizeForExternal).
 * - Text memorandum and JSON exports.
 */

import { generateRule7ComplaintMemorandum } from './noisePollutionService.js';

export const NOISE_STORAGE_KEY = 'civicbridge_noise_pollution_logs';

let inMemoryStore = null;

function getStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

/**
 * Computes a deterministic SHA-256 hex seal for a noise log.
 *
 * @param {Object} record
 * @returns {Promise<string>} Hex seal string
 */
export async function computeNoiseLogDigest(record) {
  const normalized = {
    observedDbA: record.observedDbA || 0,
    zoneKey: record.zoneKey || '',
    exceedanceDbA: record.exceedanceDbA || 0,
    sourceType: record.sourceType || '',
    hourOfDay: record.hourOfDay || 0,
    incidentLocation: record.location?.incidentLocation || record.incidentLocation || '',
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

  // Deterministic DJB2 hash fallback
  let hash = 5381;
  for (let i = 0; i < canonicalString.length; i++) {
    hash = ((hash << 5) + hash) + canonicalString.charCodeAt(i);
    hash |= 0;
  }
  return 'noise_seal_' + Math.abs(hash).toString(16).padStart(16, '0');
}

/**
 * Verifies noise log integrity against its stored digital seal.
 *
 * @param {Object} record
 * @returns {Promise<boolean>} True if untouched
 */
export async function verifyNoiseLogIntegrity(record) {
  if (!record || !record.digitalSeal) return false;
  const currentDigest = await computeNoiseLogDigest(record);
  return currentDigest === record.digitalSeal;
}

/**
 * Redacts personal identifiers in compliance with DPDP Act 2023 for public slip exports.
 *
 * @param {Object} record
 * @returns {Object} Redacted record
 */
export function minimizeForExternal(record) {
  if (!record) return {};
  const scrubbed = JSON.parse(JSON.stringify(record));

  if (scrubbed.complainant?.name) {
    const parts = scrubbed.complainant.name.trim().split(' ');
    scrubbed.complainant.name = parts.length > 1
      ? `${parts[0]} [REDACTED]`
      : `${scrubbed.complainant.name.charAt(0)}*** [REDACTED]`;
  }

  if (scrubbed.complainant?.contact) {
    scrubbed.complainant.contact = 'XXXXXX' + String(scrubbed.complainant.contact).slice(-4);
  }

  return scrubbed;
}

/**
 * Loads all noise logs from storage.
 *
 * @returns {Array<Object>} List of records
 */
export function getStoredNoiseLogs() {
  const storage = getStorage();
  if (storage) {
    try {
      const raw = storage.getItem(NOISE_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
  return inMemoryStore ? [...inMemoryStore] : [];
}

/**
 * Saves a new or updated noise log with digital seal.
 *
 * @param {Object} recordData
 * @returns {Promise<Object>} Saved record with id and digitalSeal
 */
export async function saveNoiseLog(recordData) {
  const records = getStoredNoiseLogs();
  const id = recordData.id || `noise_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const createdAt = recordData.createdAt || new Date().toISOString();

  const recordToSeal = {
    ...recordData,
    id,
    createdAt,
  };

  const digitalSeal = await computeNoiseLogDigest(recordToSeal);
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
      storage.setItem(NOISE_STORAGE_KEY, JSON.stringify(records));
    } catch {
      inMemoryStore = records;
    }
  } else {
    inMemoryStore = records;
  }

  return completeRecord;
}

/**
 * Retrieves a single noise log by id.
 *
 * @param {string} id
 * @returns {Object|null}
 */
export function getNoiseLogById(id) {
  const records = getStoredNoiseLogs();
  return records.find((r) => r.id === id) || null;
}

/**
 * Deletes a noise log by id.
 *
 * @param {string} id
 * @returns {boolean} True if deleted
 */
export function deleteNoiseLog(id) {
  const records = getStoredNoiseLogs();
  const filtered = records.filter((r) => r.id !== id);
  const deleted = filtered.length !== records.length;

  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(NOISE_STORAGE_KEY, JSON.stringify(filtered));
    } catch {
      inMemoryStore = filtered;
    }
  } else {
    inMemoryStore = filtered;
  }

  return deleted;
}

/**
 * Clears all noise logs.
 */
export function clearAllNoiseLogs() {
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(NOISE_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
  inMemoryStore = [];
}

/**
 * Generates downloadable JSON of a noise log.
 *
 * @param {Object} record
 * @param {boolean} [redactPii=false]
 * @returns {string} JSON string
 */
export function exportNoiseLogJsonSlip(record, redactPii = false) {
  const data = redactPii ? minimizeForExternal(record) : record;
  return JSON.stringify(data, null, 2);
}

/**
 * Generates downloadable legal memorandum text for a noise log.
 *
 * @param {Object} record
 * @returns {string} Formatted text document
 */
export function exportNoiseLogTextSlip(record) {
  return generateRule7ComplaintMemorandum(record);
}
