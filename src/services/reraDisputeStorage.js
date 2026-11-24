/**
 * RERA Homebuyer Dispute & Complaint Storage Service
 *
 * Client-side offline-first persistence for RERA dispute complaints with
 * automated PII sanitization, canonical SHA-256 digital seals, and
 * tamper detection.
 */

import { sha256Hex, canonicalStringify } from './privacyIntegrityService.js';
import {
  draftReraDisputePetition,
  generateSection40ExecutionPetition,
  generateSection35EscrowInvestigationPetition,
  generateReatMemorandumOfAppeal,
} from './reraDisputeService.js';

export const STORAGE_KEY = 'civicbridge_rera_complaints';

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
 * Computes canonical SHA-256 digest over complaint record.
 *
 * @param {Object} complaint
 * @returns {string} 64-character lowercase hex digest
 */
export const computeComplaintDigest = (complaint) => {
  if (!complaint || typeof complaint !== 'object') {
    return '0'.repeat(64);
  }

  const canonicalPayload = {
    version: 1,
    recordType: String(complaint.recordType || 'COMPLAINT'),
    formType: String(complaint.formType || ''),
    jurisdiction: String(complaint.jurisdiction || ''),
    complainant: {
      name: String(complaint.complainant?.name || ''),
      address: String(complaint.complainant?.address || ''),
      contact: String(complaint.complainant?.contact || ''),
    },
    promoter: {
      name: String(complaint.promoter?.name || ''),
      projectName: String(complaint.promoter?.projectName || ''),
      reraRegNo: String(complaint.promoter?.reraRegNo || ''),
      projectLocation: String(complaint.promoter?.projectLocation || ''),
    },
    unitDetails: {
      unitNo: String(complaint.unitDetails?.unitNo || ''),
    },
    committedPossessionDate: String(complaint.committedPossessionDate || ''),
    gracePeriodMonths: Number(complaint.gracePeriodMonths || 0),
    totalPaidInr: Number(complaint.totalPaidInr || 0),
    totalAgreementCostInr: Number(complaint.totalAgreementCostInr || 0),
    annualInterestRate: Number(complaint.annualInterestRate || 0),
    reliefType: String(complaint.reliefType || ''),
    interimReliefs: Array.isArray(complaint.interimReliefs)
      ? complaint.interimReliefs.map((r) => String(r || ''))
      : [],
    orderNumber: String(complaint.orderNumber || ''),
    orderDate: String(complaint.orderDate || ''),
    awardedAmountInr: Number(complaint.awardedAmountInr || 0),
    totalAllotteeCollectionsInr: Number(complaint.totalAllotteeCollectionsInr || 0),
  };

  return sha256Hex(canonicalStringify(canonicalPayload));
};

/**
 * Masks sensitive personal identifiers for external export and sharing
 * in compliance with DPDP principles.
 *
 * @param {Object} complaint
 * @returns {Object} Sanitized complaint
 */
export function minimizeForExternal(complaint) {
  if (!complaint || typeof complaint !== 'object') {
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

  const maskAddress = (addr) => {
    if (!addr || typeof addr !== 'string') return '';
    const parts = addr.split(',');
    if (parts.length > 1) {
      return `[Masked Ward/Street], ${parts[parts.length - 1].trim()}`;
    }
    return '[Masked Location]';
  };

  return {
    ...complaint,
    complainant: {
      ...complaint.complainant,
      name: complaint.complainant?.name
        ? `${complaint.complainant.name.slice(0, 1)}*** (Masked)`
        : '[Masked Allottee]',
      address: maskAddress(complaint.complainant?.address),
      contact: maskPhone(complaint.complainant?.contact),
    },
    unitDetails: {
      ...complaint.unitDetails,
      unitNo: complaint.unitDetails?.unitNo ? '[Masked Unit Number]' : '',
    },
    isRedacted: true,
  };
}

/**
 * Verifies SHA-256 integrity seal of a complaint record.
 *
 * @param {Object} complaint
 * @returns {boolean} True if digital seal matches exactly
 */
export function verifyComplaintIntegrity(complaint) {
  if (!complaint || typeof complaint.digest !== 'string') {
    return false;
  }
  const expectedDigest = computeComplaintDigest(complaint);
  return constantTimeEqual(complaint.digest, expectedDigest);
}

/**
 * Lists all stored RERA complaints.
 *
 * @param {Storage} [storageEngine]
 * @returns {Array} List of complaints
 */
export function listReraComplaints(storageEngine) {
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
 * Retrieves a single complaint by ID.
 *
 * @param {string} id
 * @param {Storage} [storageEngine]
 * @returns {Object|null}
 */
export function getReraComplaint(id, storageEngine) {
  if (!id) return null;
  const list = listReraComplaints(storageEngine);
  return list.find((c) => c.id === id) || null;
}

/**
 * Saves or updates a RERA complaint in client-side storage.
 *
 * @param {Object} complaintData
 * @param {Storage} [storageEngine]
 * @returns {Object} Saved complaint with ID, timestamp, and digest
 */
export function saveReraComplaint(complaintData = {}, storageEngine) {
  const store = getStorage(storageEngine);
  if (!store) {
    throw new Error('Local storage is unavailable in this environment.');
  }

  const existingList = listReraComplaints(storageEngine);
  const now = new Date().toISOString();
  const id = complaintData.id || `rera_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const complaintToSave = {
    ...complaintData,
    id,
    updatedAt: now,
    createdAt: complaintData.createdAt || now,
  };

  complaintToSave.digest = computeComplaintDigest(complaintToSave);

  const existingIndex = existingList.findIndex((c) => c.id === id);
  let updatedList;
  if (existingIndex >= 0) {
    updatedList = [...existingList];
    updatedList[existingIndex] = complaintToSave;
  } else {
    updatedList = [complaintToSave, ...existingList];
  }

  store.setItem(STORAGE_KEY, JSON.stringify(updatedList));
  return complaintToSave;
}

/**
 * Deletes a stored complaint by ID.
 *
 * @param {string} id
 * @param {Storage} [storageEngine]
 * @returns {boolean} True if deleted
 */
export function deleteReraComplaint(id, storageEngine) {
  if (!id) return false;
  const store = getStorage(storageEngine);
  if (!store) return false;

  const existingList = listReraComplaints(storageEngine);
  const filtered = existingList.filter((c) => c.id !== id);
  if (filtered.length === existingList.length) {
    return false;
  }

  store.setItem(STORAGE_KEY, JSON.stringify(filtered));
  return true;
}

/**
 * Exports complaint as a signed JSON dossier.
 */
export function exportComplaintDossierJson(complaint, { redact = false } = {}) {
  const target = redact ? minimizeForExternal(complaint) : complaint;
  return JSON.stringify(target, null, 2);
}

/**
 * Exports complaint as plain text legal memorandum.
 */
export function exportComplaintTextSlip(complaint) {
  if (!complaint) return '';
  if (complaint.recordType === 'EXECUTION_PETITION') {
    return generateSection40ExecutionPetition(complaint);
  }
  if (complaint.recordType === 'ESCROW_AUDIT') {
    return generateSection35EscrowInvestigationPetition(complaint);
  }
  if (complaint.recordType === 'REAT_APPEAL') {
    return generateReatMemorandumOfAppeal(complaint);
  }
  return draftReraDisputePetition(complaint);
}
