/**
 * src/services/pmKisanExceptionGuideService.js
 *
 * PM-KISAN Installment Exception Diagnosis Guide (#1418).
 *
 * Extends `checklistStorage.js` and `checklistExportService.js`:
 *   - Versioned status mappings for e-KYC, land-seeding, bank/NPCI validation, and record mismatches
 *   - Clear unknown-state handling (marked UNVERIFIED)
 *   - Printable help-desk checklist with zero credential/PII collection
 *   - Auditable admin/reviewer governance for status mappings
 *   - Distinct provenance: official_record | citizen_entered | ai_suggestion
 */

import { readChecklist, writeChecklist } from './checklistStorage.js';
import { checklistExportService } from './checklistExportService.js';

export const PM_KISAN_STORAGE_KEY = 'civicbridge_pmkisan_diagnosis_v1';
export const PM_KISAN_MAPPING_VERSION = '2026.1';

export const PM_KISAN_STATUS_MAPPINGS = Object.freeze({
  ekyc_pending: {
    code: 'ekyc_pending',
    version: PM_KISAN_MAPPING_VERSION,
    portalMessage: 'e-KYC Status: Pending / Not Completed',
    plainExplanation: 'Installment is held until mandatory e-KYC is completed through an official channel.',
    officialChannels: [
      { label: 'PM-KISAN Portal e-KYC Corner', url: 'https://pmkisan.gov.in/' },
      { label: 'Nearest Common Service Centre (CSC) Biometric Counter', url: 'https://pmkisan.gov.in/' },
    ],
    documentsToCarry: [
      'PM-KISAN Beneficiary Registration Number (printed slip)',
      'Original Photo ID (bring to CSC counter; do NOT enter Aadhaar/OTP here)',
      'Registered mobile phone for in-person official verification',
    ],
    sourceUrl: 'https://pmkisan.gov.in/',
    jurisdiction: 'India (Ministry of Agriculture & Farmers Welfare)',
    effectiveDate: '2022-05-31',
    lastVerifiedAt: '2026-02-01',
    verificationStatus: 'VERIFIED',
    provenance: 'official_record',
  },
  land_seeding_no: {
    code: 'land_seeding_no',
    version: PM_KISAN_MAPPING_VERSION,
    portalMessage: 'Land Seeding: NO',
    plainExplanation: 'Cultivable land ownership record is not yet verified/seeded in the state land portal.',
    officialChannels: [
      { label: 'Tehsil / Patwari / Block Agriculture Office', url: 'https://pmkisan.gov.in/' },
    ],
    documentsToCarry: [
      'Certified copy of Land Record (Khatauni / RoR / Jamabandi)',
      'PM-KISAN Registration Acknowledgement Slip',
      'Self-declaration form if requested by Block Agriculture Officer',
    ],
    sourceUrl: 'https://pmkisan.gov.in/',
    jurisdiction: 'India (State Revenue & Agriculture Nodal Office)',
    effectiveDate: '2022-09-01',
    lastVerifiedAt: '2026-02-01',
    verificationStatus: 'VERIFIED',
    provenance: 'official_record',
  },
  bank_aadhaar_seeding_pending: {
    code: 'bank_aadhaar_seeding_pending',
    version: PM_KISAN_MAPPING_VERSION,
    portalMessage: 'FTO Not Generated / Bank DBT Validation Pending',
    plainExplanation: 'Bank account is not yet mapped for Direct Benefit Transfer (NPCI DBT mapper).',
    officialChannels: [
      { label: 'Home Bank Branch (NPCI DBT Mapping Desk)', url: 'https://pmkisan.gov.in/' },
      { label: 'India Post Payments Bank (IPPB) DBT Account', url: 'https://www.ippbonline.com/' },
    ],
    documentsToCarry: [
      'Bank Passbook (carry physically; do NOT enter account number online here)',
      'Bank DBT Consent Form at branch counter',
      'PM-KISAN Status Printout',
    ],
    sourceUrl: 'https://pmkisan.gov.in/',
    jurisdiction: 'India (NPCI / Department of Agriculture)',
    effectiveDate: '2023-04-01',
    lastVerifiedAt: '2026-02-01',
    verificationStatus: 'VERIFIED',
    provenance: 'official_record',
  },
  beneficiary_record_mismatch: {
    code: 'beneficiary_record_mismatch',
    version: PM_KISAN_MAPPING_VERSION,
    portalMessage: 'Beneficiary Name / Demographic Record Mismatch',
    plainExplanation: 'Name or demographic details on the PM-KISAN record differ from bank or land records.',
    officialChannels: [
      { label: 'PM-KISAN Name Correction / Farmer Corner', url: 'https://pmkisan.gov.in/' },
      { label: 'District Agriculture Nodal Officer Help-Desk', url: 'https://pmkisan.gov.in/' },
    ],
    documentsToCarry: [
      'PM-KISAN Registration Printout showing current spelling',
      'Land Record copy & Bank Passbook for comparison at help-desk',
    ],
    sourceUrl: 'https://pmkisan.gov.in/',
    jurisdiction: 'India (Ministry of Agriculture & Farmers Welfare)',
    effectiveDate: '2021-01-01',
    lastVerifiedAt: '2026-02-01',
    verificationStatus: 'VERIFIED',
    provenance: 'official_record',
  },
});

const AADHAAR_RE = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_RE = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;
const SENSITIVE_KEY_RE = /\b(aadhaar|password|otp|biometric|fingerprint|iris|bankaccount|ifsc|pin)\b/i;

export function hasForbiddenPII(input) {
  if (!input) return false;
  if (typeof input === 'string') {
    return AADHAAR_RE.test(input) || PAN_RE.test(input);
  }
  if (typeof input === 'object') {
    for (const [k, v] of Object.entries(input)) {
      if (SENSITIVE_KEY_RE.test(k) && v !== undefined && v !== null && String(v).trim() !== '') {
        return true;
      }
      if (hasForbiddenPII(v)) return true;
    }
  }
  return false;
}

const getDefaultStorage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

function readStore(storage = getDefaultStorage()) {
  if (!storage) return { sessions: {}, mappingOverrides: {}, auditLog: [] };
  try {
    const raw = storage.getItem(PM_KISAN_STORAGE_KEY);
    if (!raw) return { sessions: {}, mappingOverrides: {}, auditLog: [] };
    const parsed = JSON.parse(raw);
    return {
      sessions: parsed?.sessions && typeof parsed.sessions === 'object' ? parsed.sessions : {},
      mappingOverrides: parsed?.mappingOverrides && typeof parsed.mappingOverrides === 'object' ? parsed.mappingOverrides : {},
      auditLog: Array.isArray(parsed?.auditLog) ? parsed.auditLog : [],
    };
  } catch {
    return { sessions: {}, mappingOverrides: {}, auditLog: [] };
  }
}

function writeStore(store, storage = getDefaultStorage()) {
  if (!storage) return false;
  storage.setItem(PM_KISAN_STORAGE_KEY, JSON.stringify(store));
  return true;
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function listVersionedMappings(storage = getDefaultStorage()) {
  const store = readStore(storage);
  return Object.values(PM_KISAN_STATUS_MAPPINGS).map((m) => ({
    ...m,
    ...(store.mappingOverrides[m.code] || {}),
  }));
}

export function diagnosePmKisanStatus({
  actorId,
  statusCode = 'unknown',
  customPortalMessage = '',
  jurisdiction = '',
  storage = getDefaultStorage(),
}) {
  if (!actorId) return { ok: false, code: 401, error: 'Authentication required.' };
  if (hasForbiddenPII({ statusCode, customPortalMessage, jurisdiction })) {
    return { ok: false, code: 400, error: 'Do not enter Aadhaar numbers, PAN, OTPs, passwords, or bank account numbers.' };
  }

  const store = readStore(storage);
  const baseMapping = PM_KISAN_STATUS_MAPPINGS[statusCode];
  const override = baseMapping ? store.mappingOverrides[statusCode] : null;
  const resolved = baseMapping ? { ...baseMapping, ...(override || {}) } : null;

  const isUnknown = !resolved;
  const sessionId = makeId('pmk');
  const checklistKey = `pmkisan:${actorId}:${sessionId}`;

  const diagnosis = isUnknown
    ? {
        code: 'unknown',
        version: PM_KISAN_MAPPING_VERSION,
        unknownState: true,
        portalMessage: String(customPortalMessage || 'Unrecognized / Unknown Portal Status').trim(),
        plainExplanation:
          'This portal message does not match a verified rule in our registry. Do not share credentials with anyone; carry your status printout to an official help-desk.',
        officialChannels: [
          { label: 'Official PM-KISAN Portal', url: 'https://pmkisan.gov.in/' },
          { label: 'Block / District Agriculture Help-Desk', url: 'https://pmkisan.gov.in/' },
        ],
        documentsToCarry: [
          'Printed screenshot or slip of the PM-KISAN portal status message',
          'PM-KISAN Registration Number slip',
          'Land record copy & Bank Passbook (for in-person verification only)',
        ],
        sourceUrl: null,
        jurisdiction: jurisdiction || 'UNVERIFIED',
        effectiveDate: null,
        lastVerifiedAt: null,
        verificationStatus: 'UNVERIFIED',
        provenance: 'citizen_entered',
      }
    : {
        ...resolved,
        unknownState: false,
        jurisdiction: jurisdiction || resolved.jurisdiction,
      };

  const printableChecklistText = typeof window !== 'undefined'
    ? checklistExportService.formatTextSummary({
        id: `pm-kisan-${diagnosis.code}`,
        name: `PM-KISAN Help-Desk Checklist (${diagnosis.portalMessage})`,
        category: diagnosis.jurisdiction,
        fees: 'Nil (Official Government Help-Desk)',
        processingTime: 'Varies by state nodal verification',
        documents: diagnosis.documentsToCarry,
      })
    : [
        `PM-KISAN Help-Desk Checklist (${diagnosis.portalMessage})`,
        `Jurisdiction: ${diagnosis.jurisdiction}`,
        `Status: ${diagnosis.verificationStatus}`,
        'Documents to Carry:',
        ...diagnosis.documentsToCarry.map((d, i) => `${i + 1}. [ ] ${d}`),
      ].join('\n');

  const session = {
    sessionId,
    actorId,
    checklistKey,
    diagnosis,
    printableChecklistText,
    createdAt: new Date().toISOString(),
  };

  store.sessions[sessionId] = session;
  writeChecklist(checklistKey, [], 0, storage);
  writeStore(store, storage);

  return { ok: true, session };
}

export function toggleHelpDeskChecklistItem({
  sessionId,
  actorId,
  itemLabel,
  checked,
  storage = getDefaultStorage(),
}) {
  if (!actorId) return { ok: false, code: 401, error: 'Authentication required.' };
  const store = readStore(storage);
  const session = store.sessions[sessionId];
  if (!session) return { ok: false, code: 404, error: 'Diagnosis session not found.' };
  if (session.actorId !== actorId) {
    return { ok: false, code: 403, error: 'Unauthorized access to another user checklist.' };
  }

  const current = readChecklist(session.checklistKey, storage);
  const next = new Set(current.checked);
  if (checked) next.add(itemLabel);
  else next.delete(itemLabel);

  const res = writeChecklist(session.checklistKey, [...next], current.rev, storage);
  if (!res.ok) return { ok: false, code: 409, error: 'Checklist save conflict.' };
  return { ok: true, state: res.state };
}

export function updateStatusMappingGovernance({
  mappingCode,
  actorId,
  role = 'citizen',
  sourceUrl,
  jurisdiction,
  effectiveDate,
  lastVerifiedAt,
  storage = getDefaultStorage(),
}) {
  if (!actorId) return { ok: false, code: 401, error: 'Authentication required.' };
  if (!['admin', 'reviewer'].includes(role)) {
    return { ok: false, code: 403, error: 'Only admin or reviewer roles can update official status mappings.' };
  }
  if (!PM_KISAN_STATUS_MAPPINGS[mappingCode]) {
    return { ok: false, code: 404, error: 'Status mapping code not found.' };
  }
  if (hasForbiddenPII({ sourceUrl, jurisdiction })) {
    return { ok: false, code: 400, error: 'Sensitive PII is forbidden.' };
  }

  const store = readStore(storage);
  const verified = Boolean(sourceUrl && effectiveDate && lastVerifiedAt);
  store.mappingOverrides[mappingCode] = {
    sourceUrl: sourceUrl || PM_KISAN_STATUS_MAPPINGS[mappingCode].sourceUrl,
    jurisdiction: jurisdiction || PM_KISAN_STATUS_MAPPINGS[mappingCode].jurisdiction,
    effectiveDate: effectiveDate || null,
    lastVerifiedAt: lastVerifiedAt || null,
    verificationStatus: verified ? 'VERIFIED' : 'UNVERIFIED',
    updatedBy: actorId,
    updatedAt: new Date().toISOString(),
  };

  store.auditLog.push({
    auditId: makeId('aud'),
    timestamp: new Date().toISOString(),
    actorId,
    role,
    action: 'update_mapping',
    mappingCode,
    verificationStatus: store.mappingOverrides[mappingCode].verificationStatus,
  });

  writeStore(store, storage);
  return { ok: true, mapping: { ...PM_KISAN_STATUS_MAPPINGS[mappingCode], ...store.mappingOverrides[mappingCode] } };
}

export function getGovernanceAuditLog({ actorId, role = 'citizen', storage = getDefaultStorage() }) {
  if (!actorId) return { ok: false, code: 401, error: 'Authentication required.' };
  if (!['admin', 'reviewer'].includes(role)) {
    return { ok: false, code: 403, error: 'Only admin or reviewer roles can read the governance audit log.' };
  }
  const store = readStore(storage);
  return { ok: true, entries: store.auditLog };
}
