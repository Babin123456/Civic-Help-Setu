/**
 * electricityConsumerStorage.js
 *
 * Client-side offline-first persistence engine for Electricity Consumer Rights,
 * SoP compensation claims, disconnection audit records, and CGRF petitions.
 *
 * Features:
 * - LocalStorage adapter with resilient in-memory fallback.
 * - Canonical SHA-256 cryptographic seal (computeElectricityGrievanceDigest).
 * - Tamper detection (verifyElectricityGrievanceIntegrity).
 * - DPDP Act 2023 compliant PII minimization for external exports.
 * - JSON dossier and Section 42(5) text petition exports.
 */

import { generateCgrfPetition } from './electricityConsumerService.js';

export const ELECTRICITY_CGRF_STORAGE_KEY = 'civicbridge_electricity_cgrf_vault';

let inMemoryStore = null;

function getStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

/**
 * Computes a deterministic SHA-256 hex seal for an electricity grievance record.
 *
 * @param {Object} record
 * @returns {Promise<string>} Hex digest string
 */
export async function computeElectricityGrievanceDigest(record) {
  const normalized = {
    caNumber: record.caNumber || '',
    meterNumber: record.meterNumber || '',
    discomName: record.discomName || '',
    districtName: record.districtName || '',
    totalCompensationInr: record.sopAnalysis?.totalCompensationInr || record.totalCompensationInr || 0,
    estimatedRefundInr: record.meterAnalysis?.estimatedRefundInr || record.estimatedRefundInr || 0,
    isIllegalDisconnection: Boolean(record.disconnectionAnalysis?.isIllegalDisconnection),
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
  return `fallback-${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

/**
 * Reads all stored electricity grievance records.
 *
 * @returns {Array<Object>}
 */
export function listElectricityGrievanceRecords() {
  const storage = getStorage();
  try {
    if (storage) {
      const raw = storage.getItem(ELECTRICITY_CGRF_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    }
  } catch {
    // fallback
  }
  return inMemoryStore ? [...inMemoryStore] : [];
}

/**
 * Retrieves a single record by ID.
 *
 * @param {string} id
 * @returns {Object|null}
 */
export function getElectricityGrievanceById(id) {
  const records = listElectricityGrievanceRecords();
  return records.find((r) => r.id === id) || null;
}

/**
 * Persists an electricity grievance record with an immutable SHA-256 seal.
 *
 * @param {Object} draft
 * @returns {Promise<Object>}
 */
export async function saveElectricityGrievanceRecord(draft) {
  const records = listElectricityGrievanceRecords();

  const id = draft.id || `CGRF-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  const createdAt = draft.createdAt || new Date().toISOString();

  const candidate = {
    ...draft,
    id,
    createdAt,
    updatedAt: new Date().toISOString(),
  };

  const sha256Seal = await computeElectricityGrievanceDigest(candidate);
  const finalRecord = { ...candidate, sha256Seal };

  const existingIndex = records.findIndex((r) => r.id === id);
  let updated;
  if (existingIndex >= 0) {
    updated = [...records];
    updated[existingIndex] = finalRecord;
  } else {
    updated = [finalRecord, ...records];
  }

  const storage = getStorage();
  try {
    if (storage) {
      storage.setItem(ELECTRICITY_CGRF_STORAGE_KEY, JSON.stringify(updated));
    }
  } catch {
    // LocalStorage quota or access error
  }
  inMemoryStore = updated;

  return finalRecord;
}

/**
 * Verifies digital seal integrity against tampering.
 *
 * @param {Object} record
 * @returns {Promise<boolean>}
 */
export async function verifyElectricityGrievanceIntegrity(record) {
  if (!record || !record.sha256Seal) return false;
  const recomputed = await computeElectricityGrievanceDigest(record);
  return recomputed === record.sha256Seal;
}

/**
 * Deletes a record by ID.
 *
 * @param {string} id
 * @returns {boolean}
 */
export function deleteElectricityGrievanceRecord(id) {
  const records = listElectricityGrievanceRecords();
  const filtered = records.filter((r) => r.id !== id);

  const storage = getStorage();
  try {
    if (storage) {
      storage.setItem(ELECTRICITY_CGRF_STORAGE_KEY, JSON.stringify(filtered));
    }
  } catch {
    // fallback
  }
  inMemoryStore = filtered;
  return filtered.length < records.length;
}

/**
 * Clears all stored electricity records.
 */
export function clearAllElectricityGrievanceRecords() {
  const storage = getStorage();
  try {
    if (storage) {
      storage.removeItem(ELECTRICITY_CGRF_STORAGE_KEY);
    }
  } catch {
    // fallback
  }
  inMemoryStore = [];
}

/**
 * Sanitizes and scrubs personal consumer data under DPDP Act 2023.
 *
 * @param {Object} record
 * @returns {Object}
 */
export function minimizeElectricityGrievanceForExternal(record) {
  if (!record) return null;

  const sanitizeString = (str) => {
    if (!str || typeof str !== 'string') return '';
    if (str.length <= 4) return 'XXXX';
    return `${str.slice(0, 2)}***${str.slice(-2)}`;
  };

  return {
    id: record.id,
    createdAt: record.createdAt,
    discomName: record.discomName || 'DISCOM',
    divisionOffice: record.divisionOffice || 'Division Office',
    districtName: record.districtName || 'District',
    stateName: record.stateName || 'State',
    consumerNameRedacted: sanitizeString(record.consumerName),
    caNumberRedacted: record.caNumber ? `XXXXXX${record.caNumber.slice(-4)}` : 'XXXXXX',
    meterNumberRedacted: record.meterNumber ? `MTR-***${record.meterNumber.slice(-3)}` : 'MTR-***',
    contactPhoneRedacted: record.contactPhone ? `XXXXXX${record.contactPhone.slice(-4)}` : 'XXXXXXXXXX',
    sanctionedLoadKw: record.sanctionedLoadKw || '3 kW',
    totalCompensationInr: record.sopAnalysis?.totalCompensationInr || 0,
    estimatedRefundInr: record.meterAnalysis?.estimatedRefundInr || 0,
    isIllegalDisconnection: Boolean(record.disconnectionAnalysis?.isIllegalDisconnection),
    sha256Seal: record.sha256Seal,
    complianceStatus: 'DPDP-2023-MINIMIZED-CIVIC-RECORD',
  };
}

/**
 * Exports an electricity grievance dossier as a JSON string.
 *
 * @param {Object} record
 * @param {boolean} [minimize=true]
 * @returns {string}
 */
export function exportElectricityGrievanceDossierJson(record, minimize = true) {
  const payload = minimize ? minimizeElectricityGrievanceForExternal(record) : record;
  return JSON.stringify(payload, null, 2);
}

/**
 * Exports the full printable statutory CGRF representation text.
 *
 * @param {Object} record
 * @returns {string}
 */
export function exportElectricityGrievanceTextSlip(record) {
  return generateCgrfPetition({
    consumerName: record.consumerName,
    caNumber: record.caNumber,
    meterNumber: record.meterNumber,
    sanctionedLoadKw: record.sanctionedLoadKw,
    consumerAddress: record.consumerAddress,
    contactPhone: record.contactPhone,
    discomName: record.discomName,
    divisionOffice: record.divisionOffice,
    districtName: record.districtName,
    stateName: record.stateName,
    sopData: record.sopAnalysis,
    disconnectionData: record.disconnectionAnalysis,
    meterData: record.meterAnalysis,
    grievanceDescription: record.grievanceDescription,
  });
}
