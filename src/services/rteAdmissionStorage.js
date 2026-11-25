/**
 * rteAdmissionStorage.js
 *
 * Client-side offline-first persistence engine for RTE Section 12(1)(c) quota grievances,
 * illegal screening / capitation fee audits, and formal Section 32 representations.
 *
 * Features:
 * - LocalStorage adapter with resilient in-memory fallback.
 * - Canonical SHA-256 cryptographic seal (computeRteGrievanceDigest).
 * - Tamper detection (verifyRteGrievanceIntegrity).
 * - DPDP Act 2023 compliant PII minimization for public exports (minimizeRteGrievanceForExternal).
 * - JSON and Text petition exports.
 */

import { generateRteSection32Petition } from './rteAdmissionService.js';

export const RTE_GRIEVANCE_STORAGE_KEY = 'civicbridge_rte_grievance_vault';

let inMemoryStore = null;

function getStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

/**
 * Computes a deterministic SHA-256 hex seal for an RTE grievance record.
 *
 * @param {Object} record
 * @returns {Promise<string>} Hex seal string
 */
export async function computeRteGrievanceDigest(record) {
  const normalized = {
    schoolName: record.schoolName || '',
    districtName: record.districtName || '',
    allotmentSlipId: record.allotmentSlipId || '',
    targetGrade: record.targetGrade || '',
    category: record.category || '',
    statutoryPenalLiabilityInr: record.screeningAnalysis?.totalStatutoryPenalLiabilityInr || record.totalStatutoryPenalLiabilityInr || 0,
    totalIllegalOverchargeInr: record.billingAnalysis?.totalIllegalOverchargeInr || record.totalIllegalOverchargeInr || 0,
    statutoryScore: record.eligibility?.statutoryScore || record.statutoryScore || 0,
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

  // Fallback hash implementation for environments lacking Web Crypto Subtle
  let hash = 5381;
  for (let i = 0; i < canonicalString.length; i++) {
    hash = ((hash << 5) + hash) + canonicalString.charCodeAt(i);
    hash |= 0;
  }
  return `fallback-${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

/**
 * Reads all stored RTE grievance records.
 *
 * @returns {Array<Object>} List of records
 */
export function listRteGrievanceRecords() {
  const storage = getStorage();
  try {
    if (storage) {
      const raw = storage.getItem(RTE_GRIEVANCE_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    }
  } catch {
    // Fallback on in-memory store
  }
  return inMemoryStore ? [...inMemoryStore] : [];
}

/**
 * Retrieves a single RTE grievance record by ID.
 *
 * @param {string} id
 * @returns {Object|null}
 */
export function getRteGrievanceById(id) {
  const records = listRteGrievanceRecords();
  return records.find((r) => r.id === id) || null;
}

/**
 * Persists an RTE grievance record with an immutable SHA-256 digital seal.
 *
 * @param {Object} draft - Record without seal
 * @returns {Promise<Object>} Persisted record with id, createdAt and sha256Seal
 */
export async function saveRteGrievanceRecord(draft) {
  const records = listRteGrievanceRecords();

  const id = draft.id || `RTE-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  const createdAt = draft.createdAt || new Date().toISOString();

  const candidate = {
    ...draft,
    id,
    createdAt,
    updatedAt: new Date().toISOString(),
  };

  const sha256Seal = await computeRteGrievanceDigest(candidate);
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
      storage.setItem(RTE_GRIEVANCE_STORAGE_KEY, JSON.stringify(updated));
    }
  } catch {
    // LocalStorage quota or access error
  }
  inMemoryStore = updated;

  return finalRecord;
}

/**
 * Verifies the integrity of a stored RTE grievance record by recomputing its seal.
 *
 * @param {Object} record
 * @returns {Promise<boolean>} True if digest matches
 */
export async function verifyRteGrievanceIntegrity(record) {
  if (!record || !record.sha256Seal) return false;
  const recomputed = await computeRteGrievanceDigest(record);
  return recomputed === record.sha256Seal;
}

/**
 * Deletes a stored record by ID.
 *
 * @param {string} id
 * @returns {boolean} True if deleted
 */
export function deleteRteGrievanceRecord(id) {
  const records = listRteGrievanceRecords();
  const filtered = records.filter((r) => r.id !== id);

  const storage = getStorage();
  try {
    if (storage) {
      storage.setItem(RTE_GRIEVANCE_STORAGE_KEY, JSON.stringify(filtered));
    }
  } catch {
    // fallback
  }
  inMemoryStore = filtered;
  return filtered.length < records.length;
}

/**
 * Clears all stored RTE grievance records.
 */
export function clearAllRteGrievanceRecords() {
  const storage = getStorage();
  try {
    if (storage) {
      storage.removeItem(RTE_GRIEVANCE_STORAGE_KEY);
    }
  } catch {
    // fallback
  }
  inMemoryStore = [];
}

/**
 * Creates a sanitized DPDP Act 2023 compliant export record with personal identifiers redacted.
 *
 * @param {Object} record
 * @returns {Object} Redacted record
 */
export function minimizeRteGrievanceForExternal(record) {
  if (!record) return null;

  const sanitizeString = (str) => {
    if (!str || typeof str !== 'string') return '';
    if (str.length <= 4) return 'XXXX';
    return `${str.slice(0, 2)}***${str.slice(-2)}`;
  };

  return {
    id: record.id,
    createdAt: record.createdAt,
    schoolName: record.schoolName || 'Unaided Private School',
    blockName: record.blockName || 'Local Block',
    districtName: record.districtName || 'District',
    stateName: record.stateName || 'State',
    category: record.category || 'EWS',
    targetGrade: record.targetGrade || 'Class 1',
    childNameRedacted: sanitizeString(record.childName),
    guardianNameRedacted: sanitizeString(record.guardianName),
    contactPhoneRedacted: record.contactPhone ? `XXXXXX${record.contactPhone.slice(-4)}` : 'XXXXXXXXXX',
    allotmentSlipId: sanitizeString(record.allotmentSlipId),
    statutoryPenalLiabilityInr: record.screeningAnalysis?.totalStatutoryPenalLiabilityInr || 0,
    totalIllegalOverchargeInr: record.billingAnalysis?.totalIllegalOverchargeInr || 0,
    statutoryScore: record.eligibility?.statutoryScore || 0,
    hasViolations: Boolean(record.screeningAnalysis?.hasViolations),
    hasOvercharges: Boolean(record.billingAnalysis?.hasOvercharges),
    sha256Seal: record.sha256Seal,
    complianceStatus: 'DPDP-2023-MINIMIZED-CIVIC-RECORD',
  };
}

/**
 * Exports an RTE record as a downloadable JSON string.
 *
 * @param {Object} record
 * @param {boolean} [minimize=true] - Whether to apply PII minimization
 * @returns {string} JSON string
 */
export function exportRteGrievanceDossierJson(record, minimize = true) {
  const payload = minimize ? minimizeRteGrievanceForExternal(record) : record;
  return JSON.stringify(payload, null, 2);
}

/**
 * Generates the full printable legal petition text slip for a record.
 *
 * @param {Object} record
 * @returns {string} Printable legal representation
 */
export function exportRteGrievanceTextSlip(record) {
  return generateRteSection32Petition({
    childName: record.childName,
    dateOfBirth: record.dateOfBirth,
    guardianName: record.guardianName,
    contactPhone: record.contactPhone,
    residentialAddress: record.residentialAddress,
    allotmentSlipId: record.allotmentSlipId,
    category: record.category,
    targetGrade: record.targetGrade,
    schoolName: record.schoolName,
    schoolAddress: record.schoolAddress,
    blockName: record.blockName,
    districtName: record.districtName,
    stateName: record.stateName,
    eligibilityData: record.eligibility,
    screeningData: record.screeningAnalysis,
    billingData: record.billingAnalysis,
    denialReason: record.denialReason,
  });
}
