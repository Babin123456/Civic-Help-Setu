/**
 * Solid Waste Dumping & NGT Compensation Audit Storage Service
 *
 * Client-side offline-first persistence for municipal solid waste audits,
 * bulk generator evaluations, and NGT representations with automated PII
 * sanitization and canonical SHA-256 digital seals.
 */

import { sha256Hex, canonicalStringify } from './privacyIntegrityService.js';
import { generateRule15StatutoryNotice } from './solidWasteAuditService.js';

export const STORAGE_KEY = 'civicbridge_solid_waste_audits';

function getStorage(storage) {
  if (storage && typeof storage.getItem === 'function') {
    return storage;
  }
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
    return globalThis.localStorage;
  }
  return null;
}

function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Computes canonical SHA-256 digest over a solid waste audit record.
 *
 * @param {Object} auditRecord
 * @returns {string} 64-character lowercase hex digest
 */
export const computeAuditDigest = (auditRecord) => {
  if (!auditRecord || typeof auditRecord !== 'object') {
    return '0'.repeat(64);
  }

  const canonicalPayload = {
    version: 1,
    auditType: String(auditRecord.auditType || 'MUNICIPAL_DUMPING'),
    location: {
      address: String(auditRecord.location?.address || ''),
      ward: String(auditRecord.location?.ward || ''),
      city: String(auditRecord.location?.city || ''),
      state: String(auditRecord.location?.state || ''),
    },
    complainant: {
      name: String(auditRecord.complainant?.name || ''),
      address: String(auditRecord.complainant?.address || ''),
      contact: String(auditRecord.complainant?.contact || ''),
    },
    dumpDimensions: {
      lengthM: Number(auditRecord.dumpDimensions?.lengthM || 0),
      widthM: Number(auditRecord.dumpDimensions?.widthM || 0),
      avgDepthM: Number(auditRecord.dumpDimensions?.avgDepthM || 0),
    },
    wasteCategory: String(auditRecord.wasteCategory || 'UNCOMPACTED_MIXED_MSW'),
    defaultDays: Number(auditRecord.defaultDays || 0),
    estimatedTonnage: Number(auditRecord.estimatedTonnage || 0),
    environmentalCompensationInr: Number(auditRecord.environmentalCompensationInr || 0),
    activeBurningObserved: Boolean(auditRecord.activeBurningObserved),
  };

  return sha256Hex(canonicalStringify(canonicalPayload));
};

/**
 * Sanitizes PII before external sharing or download.
 *
 * @param {Object} auditRecord
 * @returns {Object} Sanitized audit record
 */
export function minimizeForExternal(auditRecord) {
  if (!auditRecord || typeof auditRecord !== 'object') {
    return {};
  }

  const maskPhone = (phone) => {
    if (!phone || typeof phone !== 'string') return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.length >= 10) {
      return `XXXXXX${digits.slice(-4)}`;
    }
    return 'REDACTED';
  };

  return {
    ...auditRecord,
    complainant: {
      ...auditRecord.complainant,
      name: auditRecord.complainant?.name
        ? `${auditRecord.complainant.name.slice(0, 1)}*** (Citizen Rep)`
        : '[Masked Resident]',
      contact: maskPhone(auditRecord.complainant?.contact),
      address: '[Masked Locality, Redacted for Privacy]',
    },
    isRedacted: true,
  };
}

/**
 * Verifies SHA-256 integrity seal of a solid waste audit.
 *
 * @param {Object} auditRecord
 * @returns {boolean} True if digital seal matches exactly
 */
export function verifyAuditIntegrity(auditRecord) {
  if (!auditRecord || typeof auditRecord.digest !== 'string') {
    return false;
  }
  const expectedDigest = computeAuditDigest(auditRecord);
  return constantTimeEqual(auditRecord.digest, expectedDigest);
}

/**
 * Lists all stored solid waste audits.
 *
 * @param {Storage} [storageEngine]
 * @returns {Array} List of audit records
 */
export function listSolidWasteAudits(storageEngine) {
  const store = getStorage(storageEngine);
  if (!store) return [];

  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Retrieves a single audit record by ID.
 *
 * @param {string} id
 * @param {Storage} [storageEngine]
 * @returns {Object|null}
 */
export function getSolidWasteAudit(id, storageEngine) {
  if (!id) return null;
  const list = listSolidWasteAudits(storageEngine);
  return list.find((a) => a.id === id) || null;
}

/**
 * Saves or updates a solid waste audit in client-side storage.
 *
 * @param {Object} auditData
 * @param {Storage} [storageEngine]
 * @returns {Object} Saved record with ID, timestamp, and digest seal
 */
export function saveSolidWasteAudit(auditData = {}, storageEngine) {
  const store = getStorage(storageEngine);
  if (!store) {
    throw new Error('Local storage is unavailable in this environment.');
  }

  const existingList = listSolidWasteAudits(storageEngine);
  const now = new Date().toISOString();
  const id = auditData.id || `msw_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const recordToSave = {
    ...auditData,
    id,
    updatedAt: now,
    createdAt: auditData.createdAt || now,
  };

  recordToSave.digest = computeAuditDigest(recordToSave);

  const existingIndex = existingList.findIndex((a) => a.id === id);
  let updatedList;
  if (existingIndex >= 0) {
    updatedList = [...existingList];
    updatedList[existingIndex] = recordToSave;
  } else {
    updatedList = [recordToSave, ...existingList];
  }

  store.setItem(STORAGE_KEY, JSON.stringify(updatedList));
  return recordToSave;
}

/**
 * Deletes a stored audit by ID.
 *
 * @param {string} id
 * @param {Storage} [storageEngine]
 * @returns {boolean} True if deleted
 */
export function deleteSolidWasteAudit(id, storageEngine) {
  if (!id) return false;
  const store = getStorage(storageEngine);
  if (!store) return false;

  const existingList = listSolidWasteAudits(storageEngine);
  const filtered = existingList.filter((a) => a.id !== id);
  if (filtered.length === existingList.length) {
    return false;
  }

  store.setItem(STORAGE_KEY, JSON.stringify(filtered));
  return true;
}

/**
 * Exports audit record as a signed JSON dossier.
 */
export function exportAuditDossierJson(auditRecord, { redact = false } = {}) {
  const target = redact ? minimizeForExternal(auditRecord) : auditRecord;
  return JSON.stringify(target, null, 2);
}

/**
 * Exports audit record as plain text legal representation notice.
 */
export function exportAuditTextSlip(auditRecord) {
  return generateRule15StatutoryNotice(auditRecord);
}
