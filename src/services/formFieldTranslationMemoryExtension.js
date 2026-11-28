/**
 * src/services/formFieldTranslationMemoryExtension.js
 *
 * Multilingual Civic Form Field Translation Memory (#1423).
 *
 * Extends `civicTranslationMemory.js` (#1114) with:
 *   1. Form-field terminology registry storing sourcePhrase, approvedTranslation,
 *      language, script, reviewer, and monotonic version.
 *   2. Deterministic fallback to original wording when no approved translation exists.
 *   3. Mandatory human review for legal/statutory terms (no machine auto-publish).
 *   4. Zero-PII enforcement & PII-free audit log.
 */

export const FORM_TM_STORAGE_KEY = 'civicbridge_form_field_tm_v1';
export const FORM_TM_AUDIT_KEY = 'civicbridge_form_field_tm_audit_v1';

export const SUPPORTED_LANGUAGES = Object.freeze([
  { code: 'hi', label: 'Hindi', script: 'Devanagari' },
  { code: 'bn', label: 'Bengali', script: 'Bengali' },
  { code: 'ta', label: 'Tamil', script: 'Tamil' },
  { code: 'mr', label: 'Marathi', script: 'Devanagari' },
  { code: 'te', label: 'Telugu', script: 'Telugu' },
  { code: 'kn', label: 'Kannada', script: 'Kannada' },
  { code: 'en', label: 'English', script: 'Latin' },
]);

const LEGAL_TERM_PATTERN = /\b(affidavit|encumbrance|domicile|mutation|gazette|challan|attestation|power of attorney|indemnity|statutory|tribunal|caste certificate|no-dues)\b/i;
const AADHAAR_RE = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_RE = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;

export function hasForbiddenPII(input) {
  const s = typeof input === 'string' ? input : JSON.stringify(input || {});
  return AADHAAR_RE.test(s) || PAN_RE.test(s);
}

export function isLegalOrStatutoryTerm(phrase = '') {
  return LEGAL_TERM_PATTERN.test(String(phrase || ''));
}

export const DEFAULT_FORM_FIELD_GLOSSARY = Object.freeze([
  {
    entryId: 'tm-income-cert',
    sourcePhrase: 'Annual Family Income',
    approvedTranslation: 'वार्षिक पारिवारिक आय',
    language: 'hi',
    script: 'Devanagari',
    reviewer: 'reviewer_revenue_1',
    version: 1,
    status: 'approved',
    isLegalTerm: false,
    jurisdiction: 'All India',
    effectiveDate: '2026-04-01',
    lastVerifiedAt: '2026-11-15T10:00:00.000Z',
    provenance: 'official_record',
  },
  {
    entryId: 'tm-domicile-affidavit',
    sourcePhrase: 'Domicile Affidavit',
    approvedTranslation: 'निवास शपथ पत्र',
    language: 'hi',
    script: 'Devanagari',
    reviewer: 'legal_reviewer_1',
    version: 2,
    status: 'approved',
    isLegalTerm: true,
    jurisdiction: 'All India',
    effectiveDate: '2026-04-01',
    lastVerifiedAt: '2026-11-15T10:00:00.000Z',
    provenance: 'reviewer_approved',
  },
]);

const memoryFallback = new Map();
const fallbackStorage = {
  getItem: (k) => (memoryFallback.has(k) ? memoryFallback.get(k) : null),
  setItem: (k, v) => memoryFallback.set(k, String(v)),
};

function getStorage(customStorage = null) {
  if (customStorage) return customStorage;
  try {
    if (globalThis.localStorage) return globalThis.localStorage;
  } catch {
    // ignore
  }
  return fallbackStorage;
}

export function listFormFieldTranslations(customStorage = null) {
  const store = getStorage(customStorage);
  try {
    const raw = store.getItem(FORM_TM_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fall back
  }
  return DEFAULT_FORM_FIELD_GLOSSARY.map((e) => ({ ...e }));
}

function saveFormFieldTranslations(list, customStorage = null) {
  const store = getStorage(customStorage);
  store.setItem(FORM_TM_STORAGE_KEY, JSON.stringify(list));
}

export function listTranslationAuditLog(customStorage = null) {
  const store = getStorage(customStorage);
  try {
    const raw = store.getItem(FORM_TM_AUDIT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function appendAudit(entry, customStorage = null) {
  const logs = listTranslationAuditLog(customStorage);
  logs.unshift({
    auditId: `tmaud_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  });
  const store = getStorage(customStorage);
  store.setItem(FORM_TM_AUDIT_KEY, JSON.stringify(logs.slice(0, 500)));
}

/**
 * Resolves a form field label in the requested language.
 * Always falls back deterministically to the original `sourcePhrase` when no
 * human-approved translation exists.
 */
export function resolveFormFieldLabel({
  sourcePhrase,
  targetLanguage = 'hi',
  customStorage = null,
}) {
  const clean = String(sourcePhrase || '').trim();
  const entries = listFormFieldTranslations(customStorage);
  const match = entries.find(
    (e) =>
      e.status === 'approved' &&
      e.language === targetLanguage &&
      e.sourcePhrase.toLowerCase() === clean.toLowerCase()
  );

  if (match) {
    return {
      sourcePhrase: clean,
      label: match.approvedTranslation,
      language: match.language,
      script: match.script,
      reviewer: match.reviewer,
      version: match.version,
      isLegalTerm: match.isLegalTerm,
      provenance: match.provenance,
      fallbackUsed: false,
    };
  }

  return {
    sourcePhrase: clean,
    label: clean, // Fallback to original wording
    language: 'en',
    script: 'Latin',
    reviewer: null,
    version: null,
    isLegalTerm: isLegalOrStatutoryTerm(clean),
    provenance: 'original_source',
    fallbackUsed: true,
    fallbackReason: `No approved ${targetLanguage} translation; falling back to original wording.`,
  };
}

export function proposeFormFieldTranslation({
  sourcePhrase,
  proposedTranslation,
  language = 'hi',
  script = null,
  jurisdiction = 'All India',
  proposedBy = 'contributor_local',
  customStorage = null,
}) {
  const cleanSource = String(sourcePhrase || '').trim();
  const cleanTrans = String(proposedTranslation || '').trim();
  if (!cleanSource || !cleanTrans) {
    throw new Error('sourcePhrase and proposedTranslation are required.');
  }
  if (hasForbiddenPII({ cleanSource, cleanTrans })) {
    throw new Error('Translation entry must not contain Aadhaar or PAN numbers.');
  }

  const langMeta = SUPPORTED_LANGUAGES.find((l) => l.code === language);
  if (!langMeta) throw new Error(`Unsupported language code: ${language}`);

  const isLegalTerm = isLegalOrStatutoryTerm(cleanSource);
  const list = listFormFieldTranslations(customStorage);
  const entry = {
    entryId: `tm_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`,
    sourcePhrase: cleanSource,
    proposedTranslation: cleanTrans,
    approvedTranslation: null,
    language,
    script: script || langMeta.script,
    reviewer: null,
    version: 0,
    status: 'pending',
    isLegalTerm,
    requiresLegalHumanReview: isLegalTerm,
    jurisdiction,
    proposedBy,
    provenance: 'community_suggestion',
    createdAt: new Date().toISOString(),
  };

  list.unshift(entry);
  saveFormFieldTranslations(list, customStorage);
  appendAudit({ action: 'TM_PROPOSED', entryId: entry.entryId, actorId: proposedBy, language, isLegalTerm }, customStorage);
  return entry;
}

export function approveFormFieldTranslation({
  entryId,
  reviewerId = 'reviewer_local',
  reviewerRole = 'reviewer',
  decision = 'APPROVE',
  rationale = '',
  customStorage = null,
}) {
  if (!['admin', 'reviewer', 'legal_reviewer'].includes(reviewerRole)) {
    throw new Error('Forbidden: reviewer or admin role required to approve translations.');
  }
  if (hasForbiddenPII(rationale)) {
    throw new Error('Review rationale must not contain Aadhaar or PAN numbers.');
  }

  const list = listFormFieldTranslations(customStorage);
  const entry = list.find((e) => e.entryId === entryId);
  if (!entry) throw new Error('Translation memory entry not found.');
  if (entry.proposedBy && entry.proposedBy === reviewerId) {
    throw new Error('Role separation: contributor cannot approve their own translation.');
  }

  if (decision === 'REJECT') {
    entry.status = 'rejected';
    entry.reviewer = reviewerId;
    entry.reviewRationale = rationale.trim();
    saveFormFieldTranslations(list, customStorage);
    appendAudit({ action: 'TM_REJECTED', entryId, actorId: reviewerId }, customStorage);
    return entry;
  }

  entry.status = 'approved';
  entry.approvedTranslation = entry.proposedTranslation || entry.approvedTranslation;
  entry.reviewer = reviewerId;
  entry.version = Number(entry.version || 0) + 1;
  entry.lastVerifiedAt = new Date().toISOString();
  entry.provenance = 'reviewer_approved';

  saveFormFieldTranslations(list, customStorage);
  appendAudit(
    { action: 'TM_APPROVED', entryId, actorId: reviewerId, version: entry.version, isLegalTerm: entry.isLegalTerm },
    customStorage
  );
  return entry;
}
