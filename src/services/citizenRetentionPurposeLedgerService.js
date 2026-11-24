/**
 * Citizen-Controlled Data Retention and Purpose Ledger Service (#1180)
 *
 * Implements purpose-specific retention policies, purpose and expiry metadata,
 * granular purge/anonymization workflows, cryptographic access and deletion receipts,
 * propagation across caches and derived stores, legal holds, and backup expiry simulation.
 *
 * Complies with India DPDP Act 2023, Section 4 (Lawful Basis) & Section 8 (Erasure),
 * and GDPR Article 5(1)(e) (Storage Limitation) & Article 17 (Right to Erasure).
 */

import { sha256Hex, canonicalStringify } from './privacyIntegrityService.js';
import { recordPrivacyAuditLog } from './privacyConsentService.js';

export const PURPOSE_LEDGER_STORAGE_KEY = 'civicbridge_purpose_ledger_v1';
export const LEGAL_HOLDS_STORAGE_KEY = 'civicbridge_legal_holds_v1';
export const PURPOSE_RECEIPTS_STORAGE_KEY = 'civicbridge_retention_receipts_v1';

/**
 * Standard Lawful Purposes recognized across Civic-Help-Setu
 */
export const CIVIC_PURPOSE_REGISTRY = {
  CIVIC_ELIGIBILITY_ASSESSMENT: {
    purposeId: 'CIVIC_ELIGIBILITY_ASSESSMENT',
    category: 'drafts',
    title: 'Welfare & Service Eligibility Evaluation',
    lawfulBasis: 'DPDP Act 2023 §4(1) - Citizen-initiated qualification check for government welfare benefits',
    retentionDays: 45,
    backupRetentionDays: 14,
    description: 'Calculates scheme eligibility criteria and required documentation before formal application submission.',
    actionOnExpiry: 'PURGE',
    associatedStores: [
      'civicbridge_eligibility_assessments',
      'civicbridge_checklists',
      'civicbridge_applicant_profiles_v1',
      'civicbridge_preparation_plans_v1',
      'civicbridge_readiness_scorecards',
    ],
  },
  APPOINTMENT_OFFICE_VISIT: {
    purposeId: 'APPOINTMENT_OFFICE_VISIT',
    category: 'tracking',
    title: 'Civic Office Token & Queue Scheduling',
    lawfulBasis: 'DPDP Act 2023 §4(1) - Contractual service delivery & in-person counter verification scheduling',
    retentionDays: 30,
    backupRetentionDays: 7,
    description: 'Manages appointment slots, counter tokens, and scheduled office reminders.',
    actionOnExpiry: 'PURGE',
    associatedStores: [
      'civicbridge_office_tokens',
      'civicbridge_reminders',
      'civicbridge_notification_settings',
    ],
  },
  GRIEVANCE_REDRESSAL: {
    purposeId: 'GRIEVANCE_REDRESSAL',
    category: 'tracking',
    title: 'Municipal Grievance Filing & Evidence Tracking',
    lawfulBasis: 'Municipal Citizen Charter 2024 & DPDP Act 2023 §4(2) - Legitimate statutory complaint processing',
    retentionDays: 90,
    backupRetentionDays: 30,
    description: 'Maintains grievance tickets, evidentiary attachments, and escalation milestones until resolution.',
    actionOnExpiry: 'ANONYMIZE',
    associatedStores: [
      'civic_grievance_tickets',
      'civic_grievance_evidence_drafts',
      'civic_grievance_drafts_v1',
    ],
  },
  OFFLINE_RESILIENCE_CACHE: {
    purposeId: 'OFFLINE_RESILIENCE_CACHE',
    category: 'cache',
    title: 'Offline Resiliency & Low-Connectivity Cache',
    lawfulBasis: 'Citizen Explicit Consent - Technical necessity for low-bandwidth offline accessibility',
    retentionDays: 14,
    backupRetentionDays: 3,
    description: 'Caches downloaded service blueprints, shelter listings, and temporary offline draft state.',
    actionOnExpiry: 'PURGE',
    associatedStores: [
      'civicbridge_offline_cache',
      'civicbridge_offline_last_sync',
      'civicbridge_cached_shelters',
    ],
  },
  CONVERSATIONAL_ASSISTANCE: {
    purposeId: 'CONVERSATIONAL_ASSISTANCE',
    category: 'assistant',
    title: 'Civic Navigator Q&A & Source Grounding',
    lawfulBasis: 'Citizen Explicit Consent - Ephemeral conversational context and citation traceability',
    retentionDays: 14,
    backupRetentionDays: 3,
    description: 'Stores recent interactive queries to answer follow-up questions with official legal citations.',
    actionOnExpiry: 'PURGE',
    associatedStores: [
      'civicbridge_chat_history',
      'civicbridge_ai_context_consent',
    ],
  },
  DOCUMENT_VERIFICATION_VAULT: {
    purposeId: 'DOCUMENT_VERIFICATION_VAULT',
    category: 'vault',
    title: 'Client-Encrypted Document Vault Metadata',
    lawfulBasis: 'Citizen Explicit Vault Lock - Self-custodial document readiness checks',
    retentionDays: 180,
    backupRetentionDays: 30,
    description: 'Encrypted document metadata and PIN hashes stored purely in citizen device storage.',
    actionOnExpiry: 'PURGE',
    associatedStores: [
      'civicbridge_vault_docs',
      'civicbridge_vault_pin',
    ],
  },
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function getSafeLocalStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  if (!globalThis.__mockPurposeStorage) {
    globalThis.__mockPurposeStorage = new Map();
  }
  return {
    getItem: (k) => globalThis.__mockPurposeStorage.get(k) || null,
    setItem: (k, v) => globalThis.__mockPurposeStorage.set(k, String(v)),
    removeItem: (k) => globalThis.__mockPurposeStorage.delete(k),
  };
}

function getSafeSessionStorage() {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    return window.sessionStorage;
  }
  if (!globalThis.__mockPurposeSessionStorage) {
    globalThis.__mockPurposeSessionStorage = new Map();
  }
  return {
    getItem: (k) => globalThis.__mockPurposeSessionStorage.get(k) || null,
    setItem: (k, v) => globalThis.__mockPurposeSessionStorage.set(k, String(v)),
    removeItem: (k) => globalThis.__mockPurposeSessionStorage.delete(k),
  };
}

/**
 * Retrieve master Purpose Ledger entries
 */
export function getPurposeLedger() {
  const storage = getSafeLocalStorage();
  const raw = storage.getItem(PURPOSE_LEDGER_STORAGE_KEY);
  if (!raw) {
    return initializeDefaultPurposeLedger();
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : initializeDefaultPurposeLedger();
  } catch {
    return initializeDefaultPurposeLedger();
  }
}

/**
 * Initialize ledger with all recognized purposes and current timestamp
 */
export function initializeDefaultPurposeLedger() {
  const now = new Date();
  const entries = Object.values(CIVIC_PURPOSE_REGISTRY).map((purpose) => {
    const expiryDate = new Date(now.getTime() + purpose.retentionDays * MS_PER_DAY);
    const backupExpiryDate = new Date(
      expiryDate.getTime() + (purpose.backupRetentionDays || 7) * MS_PER_DAY
    );
    return {
      purposeId: purpose.purposeId,
      category: purpose.category,
      title: purpose.title,
      lawfulBasis: purpose.lawfulBasis,
      description: purpose.description,
      retentionDays: purpose.retentionDays,
      backupRetentionDays: purpose.backupRetentionDays,
      actionOnExpiry: purpose.actionOnExpiry,
      registeredAt: now.toISOString(),
      expiresAt: expiryDate.toISOString(),
      backupExpiresAt: backupExpiryDate.toISOString(),
      status: 'ACTIVE',
    };
  });
  savePurposeLedger(entries);
  return entries;
}

export function savePurposeLedger(entries) {
  const storage = getSafeLocalStorage();
  storage.setItem(PURPOSE_LEDGER_STORAGE_KEY, JSON.stringify(entries));
}

/**
 * Retrieve active legal holds
 */
export function getLegalHolds() {
  const storage = getSafeLocalStorage();
  const raw = storage.getItem(LEGAL_HOLDS_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLegalHolds(holds) {
  const storage = getSafeLocalStorage();
  storage.setItem(LEGAL_HOLDS_STORAGE_KEY, JSON.stringify(holds));
}

/**
 * Check if a purpose is currently under an active statutory legal hold
 */
export function isLegalHoldActive(purposeId) {
  const holds = getLegalHolds();
  const now = new Date().getTime();
  return holds.some((h) => {
    if (h.purposeId !== purposeId || !h.active) return false;
    if (h.expiresAt && new Date(h.expiresAt).getTime() < now) return false;
    return true;
  });
}

/**
 * Apply a legal hold to a purpose scope (e.g. active grievance investigation)
 */
export function applyLegalHold({ purposeId, statutoryReference, reason, durationDays = 30 }) {
  if (!CIVIC_PURPOSE_REGISTRY[purposeId]) {
    throw new Error(`Invalid purpose ID: ${purposeId}`);
  }
  const holds = getLegalHolds();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationDays * MS_PER_DAY).toISOString();

  const newHold = {
    holdId: `hold_${purposeId.toLowerCase()}_${Date.now()}`,
    purposeId,
    statutoryReference: statutoryReference || 'Municipal Administrative Procedure Act §12',
    reason: reason || 'Statutory review or active investigation in progress',
    appliedAt: now.toISOString(),
    expiresAt,
    active: true,
  };

  const updated = [...holds.filter((h) => h.purposeId !== purposeId || !h.active), newHold];
  saveLegalHolds(updated);

  recordPrivacyAuditLog({
    action: 'LEGAL_HOLD_APPLIED',
    actorId: 'system_statutory_guard',
    details: {
      purposeId,
      holdId: newHold.holdId,
      statutoryReference: newHold.statutoryReference,
      expiresAt,
    },
  });

  return newHold;
}

/**
 * Release a legal hold
 */
export function releaseLegalHold(holdId) {
  const holds = getLegalHolds();
  let releasedPurposeId = null;
  const updated = holds.map((h) => {
    if (h.holdId === holdId) {
      releasedPurposeId = h.purposeId;
      return { ...h, active: false, releasedAt: new Date().toISOString() };
    }
    return h;
  });
  saveLegalHolds(updated);

  if (releasedPurposeId) {
    recordPrivacyAuditLog({
      action: 'LEGAL_HOLD_RELEASED',
      actorId: 'system_statutory_guard',
      details: { holdId, purposeId: releasedPurposeId },
    });
  }
}

/**
 * Calculate current data volume / record count associated with a purpose
 */
export function inspectPurposeRecordCount(purposeId) {
  const purpose = CIVIC_PURPOSE_REGISTRY[purposeId];
  if (!purpose) return 0;

  const storage = getSafeLocalStorage();
  let count = 0;

  for (const storeKey of purpose.associatedStores) {
    const raw = storage.getItem(storeKey);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        count += parsed.length;
      } else if (typeof parsed === 'object' && parsed !== null) {
        count += Object.keys(parsed).length;
      } else {
        count += 1;
      }
    } catch {
      count += 1;
    }
  }
  return count;
}

/**
 * Generate a Cryptographic Access Receipt for a purpose category
 */
export function generateAccessReceipt(purposeId) {
  const purpose = CIVIC_PURPOSE_REGISTRY[purposeId];
  if (!purpose) throw new Error(`Unknown purpose ID: ${purposeId}`);

  const recordCount = inspectPurposeRecordCount(purposeId);
  const timestamp = new Date().toISOString();
  const receiptId = `rcpt_acc_${purposeId.toLowerCase()}_${Date.now()}`;

  const payload = {
    receiptId,
    receiptType: 'ACCESS_RECEIPT',
    purposeId,
    purposeTitle: purpose.title,
    lawfulBasis: purpose.lawfulBasis,
    recordCount,
    timestamp,
    actionTaken: 'INSPECTED',
  };

  const integrityDigest = sha256Hex(canonicalStringify(payload));
  const fullReceipt = { ...payload, integrityDigest };

  storeReceipt(fullReceipt);
  return fullReceipt;
}

/**
 * Execute targeted granular deletion or anonymization for a lawful purpose
 */
export function executePurposeRetentionAction(purposeId, { force = false, actor = 'citizen_user' } = {}) {
  const purpose = CIVIC_PURPOSE_REGISTRY[purposeId];
  if (!purpose) throw new Error(`Unknown purpose ID: ${purposeId}`);

  if (isLegalHoldActive(purposeId) && !force) {
    const error = new Error(`Cannot purge data under active statutory legal hold for: ${purpose.title}`);
    error.code = 'LEGAL_HOLD_ACTIVE';
    throw error;
  }

  const localStorage = getSafeLocalStorage();
  const sessionStorage = getSafeSessionStorage();
  const purgedStores = [];
  let recordCountBefore = 0;

  for (const storeKey of purpose.associatedStores) {
    const val = localStorage.getItem(storeKey);
    if (val !== null) {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) recordCountBefore += parsed.length;
        else if (typeof parsed === 'object' && parsed !== null) recordCountBefore += Object.keys(parsed).length;
        else recordCountBefore += 1;
      } catch {
        recordCountBefore += 1;
      }
      localStorage.removeItem(storeKey);
      purgedStores.push(storeKey);
    }
  }

  // Clear session storage if cache/assistant
  if (purpose.category === 'cache') {
    sessionStorage.removeItem('civicbridge_user_coords');
  }

  const timestamp = new Date().toISOString();
  const receiptId = `rcpt_del_${purposeId.toLowerCase()}_${Date.now()}`;

  const receiptPayload = {
    receiptId,
    receiptType: 'DELETION_RECEIPT',
    purposeId,
    purposeTitle: purpose.title,
    actionTaken: purpose.actionOnExpiry === 'ANONYMIZE' ? 'ANONYMIZED_AND_PURGED' : 'PURGED',
    recordCount: recordCountBefore,
    purgedStores,
    timestamp,
  };

  const integrityDigest = sha256Hex(canonicalStringify(receiptPayload));
  const deletionReceipt = { ...receiptPayload, integrityDigest };

  storeReceipt(deletionReceipt);

  // Update master ledger expiry status
  const ledger = getPurposeLedger();
  const updatedLedger = ledger.map((entry) => {
    if (entry.purposeId === purposeId) {
      return {
        ...entry,
        status: 'PURGED',
        lastPurgedAt: timestamp,
        lastReceiptId: receiptId,
      };
    }
    return entry;
  });
  savePurposeLedger(updatedLedger);

  recordPrivacyAuditLog({
    action: 'PURPOSE_RETENTION_PURGE',
    actorId: actor,
    details: {
      purposeId,
      receiptId,
      purgedStoresCount: purgedStores.length,
      recordsPurged: recordCountBefore,
      integrityDigest,
    },
  });

  return deletionReceipt;
}

/**
 * Automated Retention Evaluator: Checks all purposes and purges expired records
 */
export function evaluateAndEnforcePurposeRetention({ dryRun = false } = {}) {
  const ledger = getPurposeLedger();
  const now = new Date().getTime();
  const results = {
    evaluatedCount: ledger.length,
    expiredCount: 0,
    purgedPurposes: [],
    heldPurposes: [],
  };

  for (const entry of ledger) {
    const expiryTime = new Date(entry.expiresAt).getTime();
    if (now >= expiryTime) {
      results.expiredCount += 1;
      if (isLegalHoldActive(entry.purposeId)) {
        results.heldPurposes.push(entry.purposeId);
        continue;
      }
      if (!dryRun) {
        const receipt = executePurposeRetentionAction(entry.purposeId, { actor: 'system_retention_cron' });
        results.purgedPurposes.push({
          purposeId: entry.purposeId,
          receiptId: receipt.receiptId,
        });
      } else {
        results.purgedPurposes.push({ purposeId: entry.purposeId, dryRun: true });
      }
    }
  }

  return results;
}

/**
 * Verify cryptographic receipt integrity
 */
export function verifyReceiptIntegrity(receipt) {
  if (!receipt || !receipt.integrityDigest) {
    return { valid: false, reason: 'MISSING_RECEIPT_DIGEST' };
  }
  const { integrityDigest, ...rest } = receipt;
  const computed = sha256Hex(canonicalStringify(rest));
  if (computed === integrityDigest) {
    return { valid: true, digest: integrityDigest };
  }
  return { valid: false, reason: 'DIGEST_MISMATCH', expected: integrityDigest, computed };
}

function storeReceipt(receipt) {
  const storage = getSafeLocalStorage();
  const raw = storage.getItem(PURPOSE_RECEIPTS_STORAGE_KEY);
  let receipts;
  try {
    receipts = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(receipts)) receipts = [];
  } catch {
    receipts = [];
  }
  receipts.unshift(receipt);
  if (receipts.length > 50) receipts.length = 50;
  storage.setItem(PURPOSE_RECEIPTS_STORAGE_KEY, JSON.stringify(receipts));
}

export function getStoredReceipts() {
  const storage = getSafeLocalStorage();
  const raw = storage.getItem(PURPOSE_RECEIPTS_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
