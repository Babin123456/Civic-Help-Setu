/**
 * DPDP-Compliant Citizen Consent Receipt and Revocation Service (#1159)
 *
 * Implements machine-readable consent receipt generation, auditable logging,
 * and downstream presentation revocation as mandated by the Digital Personal Data Protection Act, 2023.
 */

import { CONSENT_STATUSES, validateConsentReceipt } from '../data/walletContracts';

export const CONSENT_RECEIPTS_KEY = 'civicbridge_wallet_consent_receipts';
export const REVOKED_PRESENTATIONS_KEY = 'civicbridge_wallet_revoked_presentations';

const memoryStore = new Map();

const getStorage = () => {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage && typeof globalThis.localStorage.getItem === 'function') {
      globalThis.localStorage.getItem('__probe__');
      return globalThis.localStorage;
    }
  } catch {
    // Fallback to in-memory map
  }
  return {
    getItem: (k) => (memoryStore.has(k) ? memoryStore.get(k) : null),
    setItem: (k, v) => memoryStore.set(k, String(v)),
    removeItem: (k) => memoryStore.delete(k),
    clear: () => memoryStore.clear()
  };
};

/**
 * Checks if a specific presentation has been revoked.
 */
export function isPresentationRevoked(presentationId) {
  if (!presentationId) return false;
  const storage = getStorage();
  try {
    const rawRevoked = storage.getItem(REVOKED_PRESENTATIONS_KEY);
    const revokedList = rawRevoked ? JSON.parse(rawRevoked) : [];
    if (Array.isArray(revokedList) && revokedList.includes(presentationId)) {
      return true;
    }

    // Also check active receipt statuses
    const rawReceipts = storage.getItem(CONSENT_RECEIPTS_KEY);
    const receipts = rawReceipts ? JSON.parse(rawReceipts) : [];
    const matchingReceipt = receipts.find((r) => r.presentationId === presentationId);
    return matchingReceipt ? matchingReceipt.status === CONSENT_STATUSES.REVOKED : false;
  } catch {
    return false;
  }
}

/**
 * Retrieves all stored consent receipts with dynamic expiration updates.
 */
export function getConsentReceipts(now = Date.now()) {
  const storage = getStorage();
  const raw = storage.getItem(CONSENT_RECEIPTS_KEY);
  if (!raw) return [];

  try {
    const receipts = JSON.parse(raw);
    if (!Array.isArray(receipts)) return [];

    let updated = false;
    const evaluated = receipts.map((receipt) => {
      if (receipt.status === CONSENT_STATUSES.ACTIVE && receipt.validUntil) {
        const expiry = Date.parse(receipt.validUntil);
        if (!Number.isNaN(expiry) && now > expiry) {
          updated = true;
          return { ...receipt, status: CONSENT_STATUSES.EXPIRED };
        }
      }
      return receipt;
    });

    if (updated) {
      storage.setItem(CONSENT_RECEIPTS_KEY, JSON.stringify(evaluated));
    }

    return evaluated.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch {
    return [];
  }
}

/**
 * Retrieves a single consent receipt by id.
 */
export function getConsentReceiptById(receiptId) {
  const receipts = getConsentReceipts();
  return receipts.find((r) => r.receiptId === receiptId) || null;
}

/**
 * Creates and stores a new consent receipt upon issuing a presentation.
 */
export function createConsentReceipt({
  presentationId,
  relyingParty,
  purpose,
  disclosedAttributes = [],
  validUntil,
  now = Date.now()
}) {
  const receiptId = `cr_${Math.random().toString(36).substring(2, 10)}_${Date.now().toString(36)}`;
  const timestamp = new Date(now).toISOString();

  const receipt = {
    receiptId,
    version: '1.0.0',
    timestamp,
    presentationId,
    dataSubjectId: 'citizen:wallet:local',
    relyingParty: typeof relyingParty === 'string' ? { serviceId: relyingParty, name: relyingParty } : relyingParty,
    purpose: purpose || 'Civic verification under citizen consent',
    disclosedAttributes: Array.isArray(disclosedAttributes) ? disclosedAttributes : [],
    validUntil: validUntil || new Date(now + 3600 * 1000).toISOString(),
    status: CONSENT_STATUSES.ACTIVE,
    revokedAt: null,
    revocationReason: null
  };

  const validation = validateConsentReceipt(receipt);
  if (!validation.valid) {
    throw new Error(`Consent receipt validation failed: ${validation.error}`);
  }

  const storage = getStorage();
  const current = getConsentReceipts(now);
  storage.setItem(CONSENT_RECEIPTS_KEY, JSON.stringify([receipt, ...current]));

  return receipt;
}

/**
 * Revokes a previously granted consent receipt and registers presentation in revocation registry.
 */
export function revokeConsentReceipt(receiptId, justification = 'Consent withdrawn by citizen', now = Date.now()) {
  const storage = getStorage();
  const receipts = getConsentReceipts(now);
  const targetIndex = receipts.findIndex((r) => r.receiptId === receiptId);

  if (targetIndex < 0) {
    throw new Error(`Consent receipt not found: ${receiptId}`);
  }

  const target = receipts[targetIndex];
  if (target.status === CONSENT_STATUSES.REVOKED) {
    return target; // Already revoked
  }

  const updatedReceipt = {
    ...target,
    status: CONSENT_STATUSES.REVOKED,
    revokedAt: new Date(now).toISOString(),
    revocationReason: justification
  };

  receipts[targetIndex] = updatedReceipt;
  storage.setItem(CONSENT_RECEIPTS_KEY, JSON.stringify(receipts));

  // Add presentation ID to revocation list
  if (target.presentationId) {
    try {
      const rawRevoked = storage.getItem(REVOKED_PRESENTATIONS_KEY);
      const revokedList = rawRevoked ? JSON.parse(rawRevoked) : [];
      if (!revokedList.includes(target.presentationId)) {
        revokedList.push(target.presentationId);
        storage.setItem(REVOKED_PRESENTATIONS_KEY, JSON.stringify(revokedList));
      }
    } catch {
      storage.setItem(REVOKED_PRESENTATIONS_KEY, JSON.stringify([target.presentationId]));
    }
  }

  return updatedReceipt;
}

/**
 * Resets consent receipt storage for clean test suites.
 */
export function clearConsentReceipts() {
  const storage = getStorage();
  storage.removeItem(CONSENT_RECEIPTS_KEY);
  storage.removeItem(REVOKED_PRESENTATIONS_KEY);
  memoryStore.clear();
}
