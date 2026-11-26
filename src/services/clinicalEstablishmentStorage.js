/**
 * clinicalEstablishmentStorage.js
 *
 * Client-side offline-first persistence engine for Clinical Establishment grievances,
 * emergency care refusal audits, and hospital overbilling representations.
 *
 * Features:
 * - LocalStorage adapter with resilient in-memory fallback.
 * - Canonical SHA-256 cryptographic seal (computeGrievanceDigest) for court & registering authority evidence.
 * - Tamper detection (verifyGrievanceIntegrity).
 * - DPDP Act 2023 compliant PII minimization for public exports (minimizeForExternal).
 * - Text representation and JSON exports.
 */

import { generateDistrictRegisteringAuthorityComplaint } from './clinicalEstablishmentService.js';

export const PATIENT_GRIEVANCE_STORAGE_KEY = 'civicbridge_patient_grievance_records';

let inMemoryStore = null;

function getStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

/**
 * Computes a deterministic SHA-256 hex seal for a patient grievance record.
 *
 * @param {Object} record
 * @returns {Promise<string>} Hex seal string
 */
export async function computeGrievanceDigest(record) {
  const normalized = {
    hospitalName: record.hospitalName || '',
    district: record.district || '',
    emergencyType: record.emergencyType || '',
    totalInvoicedInr: record.billingAnalysis?.totalInvoicedInr || record.totalInvoicedInr || 0,
    totalOverchargeInr: record.billingAnalysis?.totalOverchargeInr || record.totalOverchargeInr || 0,
    severityScore: record.compliance?.severityScore || record.severityScore || 0,
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
  return 'patient_seal_' + Math.abs(hash).toString(16).padStart(16, '0');
}

/**
 * Verifies grievance record integrity against its stored digital seal.
 *
 * @param {Object} record
 * @returns {Promise<boolean>} True if untouched
 */
export async function verifyGrievanceIntegrity(record) {
  if (!record || !record.digitalSeal) return false;
  const currentDigest = await computeGrievanceDigest(record);
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
    const parts = scrubbed.patient.name.trim().split(' ');
    scrubbed.patient.name = parts.length > 1
      ? `${parts[0]} [REDACTED]`
      : `${scrubbed.patient.name.charAt(0)}*** [REDACTED]`;
  }

  if (scrubbed.patient?.contact) {
    scrubbed.patient.contact = 'XXXXXX' + String(scrubbed.patient.contact).slice(-4);
  }

  if (scrubbed.ipdNumber) {
    scrubbed.ipdNumber = 'IPD-REDACTED-XXXX';
  }

  return scrubbed;
}

/**
 * Loads all grievance records from storage.
 *
 * @returns {Array<Object>} List of records
 */
export function getStoredGrievances() {
  const storage = getStorage();
  if (storage) {
    try {
      const raw = storage.getItem(PATIENT_GRIEVANCE_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
  return inMemoryStore ? [...inMemoryStore] : [];
}

/**
 * Saves a new or updated patient grievance record with digital seal.
 *
 * @param {Object} recordData
 * @returns {Promise<Object>} Saved record with id and digitalSeal
 */
export async function saveGrievance(recordData) {
  const records = getStoredGrievances();
  const id = recordData.id || `ptg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const createdAt = recordData.createdAt || new Date().toISOString();

  const recordToSeal = {
    ...recordData,
    id,
    createdAt,
  };

  const digitalSeal = await computeGrievanceDigest(recordToSeal);
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
      storage.setItem(PATIENT_GRIEVANCE_STORAGE_KEY, JSON.stringify(records));
    } catch {
      inMemoryStore = records;
    }
  } else {
    inMemoryStore = records;
  }

  return completeRecord;
}

/**
 * Retrieves a single grievance record by id.
 *
 * @param {string} id
 * @returns {Object|null}
 */
export function getGrievanceById(id) {
  const records = getStoredGrievances();
  return records.find((r) => r.id === id) || null;
}

/**
 * Deletes a grievance record by id.
 *
 * @param {string} id
 * @returns {boolean} True if deleted
 */
export function deleteGrievance(id) {
  const records = getStoredGrievances();
  const filtered = records.filter((r) => r.id !== id);
  const deleted = filtered.length !== records.length;

  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(PATIENT_GRIEVANCE_STORAGE_KEY, JSON.stringify(filtered));
    } catch {
      inMemoryStore = filtered;
    }
  } else {
    inMemoryStore = filtered;
  }

  return deleted;
}

/**
 * Clears all grievance records.
 */
export function clearAllGrievances() {
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(PATIENT_GRIEVANCE_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
  inMemoryStore = [];
}

/**
 * Generates downloadable JSON of a grievance record.
 *
 * @param {Object} record
 * @param {boolean} [redactPii=false]
 * @returns {string} JSON string
 */
export function exportGrievanceJsonSlip(record, redactPii = false) {
  const data = redactPii ? minimizeForExternal(record) : record;
  return JSON.stringify(data, null, 2);
}

/**
 * Generates downloadable legal complaint text for a grievance record.
 *
 * @param {Object} record
 * @returns {string} Formatted text document
 */
export function exportGrievanceTextSlip(record) {
  return generateDistrictRegisteringAuthorityComplaint(record);
}

// Convenient Aliases
export const listGrievanceRecords = getStoredGrievances;
export const saveGrievanceRecord = saveGrievance;
export const deleteGrievanceRecord = deleteGrievance;
export const exportGrievanceDossierJson = exportGrievanceJsonSlip;

