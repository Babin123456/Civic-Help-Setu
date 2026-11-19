/**
 * streetVendorStorage.js
 *
 * Client-side offline-first persistence engine for Street Vendor rights,
 * Section 3(3) eviction immunity audits, Section 19 seizure reconciliations,
 * and Section 20 Grievance Redressal Committee appeals.
 *
 * Features:
 * - LocalStorage adapter with resilient in-memory fallback.
 * - Canonical SHA-256 cryptographic seal (computeVendorRightsDigest).
 * - Tamper detection (verifyVendorRightsIntegrity).
 * - DPDP Act 2023 compliant PII minimization for external exports.
 * - JSON dossier and printable legal appeal text slips.
 */

import { generateSection20GrievancePetition } from './streetVendorService.js';

export const VENDOR_RIGHTS_STORAGE_KEY = 'civicbridge_vendor_rights_vault';

let inMemoryStore = null;

function getStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

/**
 * Computes a deterministic SHA-256 hex seal for a vendor rights record.
 *
 * @param {Object} record
 * @returns {Promise<string>} Hex seal string
 */
export async function computeVendorRightsDigest(record) {
  const normalized = {
    vendingCategory: record.vendingCategory || '',
    vendingPitchLocation: record.vendingPitchLocation || '',
    municipalityName: record.municipalityName || '',
    wardNumber: record.wardNumber || '',
    hasAbsoluteImmunity: Boolean(record.immunityAnalysis?.hasAbsoluteStatutoryImmunity),
    totalSeizedAssetValueInr: record.seizureAnalysis?.totalSeizedAssetValueInr || 0,
    totalRestitutionClaimInr: record.seizureAnalysis?.totalRestitutionClaimInr || 0,
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
 * Reads all stored vendor grievance records.
 *
 * @returns {Array<Object>}
 */
export function listVendorRightsRecords() {
  const storage = getStorage();
  try {
    if (storage) {
      const raw = storage.getItem(VENDOR_RIGHTS_STORAGE_KEY);
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
export function getVendorRightsById(id) {
  const records = listVendorRightsRecords();
  return records.find((r) => r.id === id) || null;
}

/**
 * Persists a vendor grievance record with an immutable SHA-256 seal.
 *
 * @param {Object} draft
 * @returns {Promise<Object>}
 */
export async function saveVendorRightsRecord(draft) {
  const records = listVendorRightsRecords();

  const id = draft.id || `VEND-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  const createdAt = draft.createdAt || new Date().toISOString();

  const candidate = {
    ...draft,
    id,
    createdAt,
    updatedAt: new Date().toISOString(),
  };

  const sha256Seal = await computeVendorRightsDigest(candidate);
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
      storage.setItem(VENDOR_RIGHTS_STORAGE_KEY, JSON.stringify(updated));
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
export async function verifyVendorRightsIntegrity(record) {
  if (!record || !record.sha256Seal) return false;
  const recomputed = await computeVendorRightsDigest(record);
  return recomputed === record.sha256Seal;
}

/**
 * Deletes a record by ID.
 *
 * @param {string} id
 * @returns {boolean}
 */
export function deleteVendorRightsRecord(id) {
  const records = listVendorRightsRecords();
  const filtered = records.filter((r) => r.id !== id);

  const storage = getStorage();
  try {
    if (storage) {
      storage.setItem(VENDOR_RIGHTS_STORAGE_KEY, JSON.stringify(filtered));
    }
  } catch {
    // fallback
  }
  inMemoryStore = filtered;
  return filtered.length < records.length;
}

/**
 * Clears all stored vendor records.
 */
export function clearAllVendorRightsRecords() {
  const storage = getStorage();
  try {
    if (storage) {
      storage.removeItem(VENDOR_RIGHTS_STORAGE_KEY);
    }
  } catch {
    // fallback
  }
  inMemoryStore = [];
}

/**
 * Sanitizes and scrubs personal vendor details under DPDP Act 2023.
 *
 * @param {Object} record
 * @returns {Object}
 */
export function minimizeVendorRightsForExternal(record) {
  if (!record) return null;

  const sanitizeString = (str) => {
    if (!str || typeof str !== 'string') return '';
    if (str.length <= 4) return 'XXXX';
    return `${str.slice(0, 2)}***${str.slice(-2)}`;
  };

  return {
    id: record.id,
    createdAt: record.createdAt,
    municipalityName: record.municipalityName || 'Municipal Corporation',
    wardNumber: record.wardNumber || 'Ward',
    vendingCategory: record.vendingCategory || 'Street Vendor',
    vendorNameRedacted: sanitizeString(record.vendorName),
    contactPhoneRedacted: record.contactPhone ? `XXXXXX${record.contactPhone.slice(-4)}` : 'XXXXXXXXXX',
    vendingPitchLocationRedacted: sanitizeString(record.vendingPitchLocation),
    hasAbsoluteImmunity: Boolean(record.immunityAnalysis?.hasAbsoluteStatutoryImmunity),
    totalSeizedAssetValueInr: record.seizureAnalysis?.totalSeizedAssetValueInr || 0,
    totalRestitutionClaimInr: record.seizureAnalysis?.totalRestitutionClaimInr || 0,
    sha256Seal: record.sha256Seal,
    complianceStatus: 'DPDP-2023-MINIMIZED-CIVIC-RECORD',
  };
}

/**
 * Exports vendor grievance dossier as a JSON string.
 *
 * @param {Object} record
 * @param {boolean} [minimize=true]
 * @returns {string}
 */
export function exportVendorRightsDossierJson(record, minimize = true) {
  const payload = minimize ? minimizeVendorRightsForExternal(record) : record;
  return JSON.stringify(payload, null, 2);
}

/**
 * Exports full printable statutory Section 20 appeal text slip.
 *
 * @param {Object} record
 * @returns {string}
 */
export function exportVendorRightsTextSlip(record) {
  return generateSection20GrievancePetition({
    vendorName: record.vendorName,
    vendingCategory: record.vendingCategory,
    vendingPitchLocation: record.vendingPitchLocation,
    yearsActive: record.yearsActive,
    wardNumber: record.wardNumber,
    zoneName: record.zoneName,
    municipalityName: record.municipalityName,
    contactPhone: record.contactPhone,
    immunityData: record.immunityAnalysis,
    goodsSeizureData: record.seizureAnalysis,
    relocationData: record.relocationAnalysis,
    grievanceSummary: record.grievanceSummary,
  });
}
