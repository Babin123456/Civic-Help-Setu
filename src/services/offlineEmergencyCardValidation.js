/**
 * Input validation and sanitisation for the Offline Emergency Civic Information
 * Card (#761).
 *
 * Every write is validated here before it reaches the persistence layer. The
 * form performs the same checks for quick feedback, but the service boundary is
 * authoritative. No emergency number is ever generated: callers must supply a
 * number and an official source that a reviewer can check manually.
 */

import {
  CONTACT_ACTION,
  CONTACT_SOURCE_TYPES,
  OFFLINE_CARD_CATEGORIES,
  OFFLINE_CARD_ERROR_CODES,
  OFFLINE_CARD_JURISDICTIONS,
  OFFLINE_CARD_LIMITS,
  RECOMMENDATION_STATUS,
} from './offlineEmergencyCardConstants.js';

export class OfflineEmergencyCardError extends Error {
  constructor(code, message, details = null) {
    super(message || code);
    this.name = 'OfflineEmergencyCardError';
    this.code = code || OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

export const sanitizeText = (value, maxLength = 500) => {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
};

const AADHAAR_REGEX = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;
const PERSONAL_PHONE_REGEX = /(?<!\d)(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}(?!\d)/;
const PERSONAL_EMAIL_REGEX = /\b[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}\b/i;
const CREDENTIAL_REGEX = /\b(?:password|passwd|secret|api[_-]?key|auth[_-]?token|private[_-]?key|otp)\b/i;
const MEDICAL_RECORD_REGEX =
  /\b(?:medical\s*record|patient\s*id|prescription|diagnosis|blood\s*group|health\s*insurance\s*(?:number|id)|discharge\s*summary)\b/i;

/**
 * Plain-language findings for free text that must stay non-sensitive.
 * @returns {string[]}
 */
export const findSensitiveData = (text) => {
  if (typeof text !== 'string' || text.length === 0) return [];
  const findings = [];
  if (AADHAAR_REGEX.test(text)) findings.push('an Aadhaar number');
  if (PAN_REGEX.test(text)) findings.push('a PAN number');
  if (PERSONAL_PHONE_REGEX.test(text)) findings.push('a personal phone number');
  if (PERSONAL_EMAIL_REGEX.test(text)) findings.push('a personal email address');
  if (CREDENTIAL_REGEX.test(text)) findings.push('a password, OTP or access token');
  if (MEDICAL_RECORD_REGEX.test(text)) findings.push('a medical record detail');
  return findings;
};

export const assertNoSensitiveData = (text, fieldLabel = 'personal note') => {
  const findings = findSensitiveData(text);
  if (findings.length > 0) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.SENSITIVE_CONTENT,
      `${fieldLabel} appears to contain ${findings.join(', ')}. Store only non-sensitive instructions.`,
      { field: fieldLabel, findings }
    );
  }
};

export const isHttpUrl = (value) => {
  if (typeof value !== 'string' || value.length > OFFLINE_CARD_LIMITS.MAX_URL_LENGTH) return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export const isPhoneNumber = (value) => {
  const text = String(value || '').trim();
  if (!text || text.length > 24) return false;
  if (!/^\+?[\d\s\-().]+$/.test(text)) return false;
  const digits = text.replace(/\D/g, '');
  return digits.length >= 3 && digits.length <= 15;
};

const EMAIL_REGEX = /^[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]{2,}$/;
export const isEmail = (value) => EMAIL_REGEX.test(String(value || '').trim());

export const isIsoTimestamp = (value) => {
  if (typeof value !== 'string' || !value.trim()) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && value.includes('T');
};

export const isIsoDate = (value) => {
  if (typeof value !== 'string') return false;
  const text = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
};

export const isIsoDateOrTimestamp = (value) => isIsoDate(value) || isIsoTimestamp(value);

export const jurisdictionById = (jurisdictionId) =>
  OFFLINE_CARD_JURISDICTIONS.find(
    (jurisdiction) => jurisdiction.id === String(jurisdictionId || '').toUpperCase()
  ) || null;

export const assertValidJurisdiction = (jurisdictionId) => {
  const found = jurisdictionById(jurisdictionId);
  if (!found) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR,
      `Unknown jurisdiction "${jurisdictionId}". Choose one of: ${OFFLINE_CARD_JURISDICTIONS.map((j) => j.id).join(', ')}.`
    );
  }
  return found.id;
};

export const validatePagination = ({
  page = 1,
  pageSize = OFFLINE_CARD_LIMITS.DEFAULT_PAGE_SIZE,
} = {}) => {
  const safePage = Number.isInteger(Number(page)) && Number(page) > 0 ? Number(page) : 1;
  const requestedSize = Number(pageSize);
  const safePageSize =
    Number.isInteger(requestedSize) && requestedSize > 0
      ? Math.min(requestedSize, OFFLINE_CARD_LIMITS.MAX_PAGE_SIZE)
      : OFFLINE_CARD_LIMITS.DEFAULT_PAGE_SIZE;
  return { page: safePage, pageSize: safePageSize };
};

export const validateIdempotencyKey = (key, { required = false } = {}) => {
  if (key == null || key === '') {
    if (required) {
      throw new OfflineEmergencyCardError(
        OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR,
        'An idempotency key is required so a retried action is not recorded twice.'
      );
    }
    return null;
  }
  const text = String(key).trim();
  if (text.length < 8 || text.length > 128) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR,
      'Idempotency keys must be between 8 and 128 characters.'
    );
  }
  return text;
};

export const validateReason = (reason, { required = false, label = 'reason' } = {}) => {
  const text = sanitizeText(reason, OFFLINE_CARD_LIMITS.MAX_REASON_LENGTH);
  if (required && text.length < 5) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR,
      `A ${label} of at least 5 characters is required and is written to the audit trail.`
    );
  }
  if (text) assertNoSensitiveData(text, label);
  return text;
};

const normalizeLanguages = (languages) => {
  const raw = Array.isArray(languages) ? languages : [];
  const cleaned = raw
    .map((language) => sanitizeText(language, OFFLINE_CARD_LIMITS.MAX_LANGUAGE_LENGTH))
    .filter(Boolean)
    .slice(0, OFFLINE_CARD_LIMITS.MAX_LANGUAGES);
  return [...new Set(cleaned)];
};

const normalizeDate = (value, { fieldLabel = 'date', allowFuture = false } = {}) => {
  if (!value) return null;
  if (!isIsoDateOrTimestamp(value)) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR,
      `${fieldLabel} must be a real date in YYYY-MM-DD or ISO timestamp format.`
    );
  }
  const date = new Date(value);
  if (!allowFuture && date.getTime() > Date.now() + 5 * 60 * 1000) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR,
      `${fieldLabel} cannot be in the future.`
    );
  }
  return date.toISOString();
};

export const validateSourceInput = (input, { partial = false } = {}) => {
  if (!input || typeof input !== 'object') {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR,
      'Contact source must be an object.'
    );
  }
  const title = sanitizeText(input.title, 200);
  if (!partial && title.length < 5) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR,
      'Source title must be at least 5 characters so a reader can identify the official page.'
    );
  }
  const publisher = sanitizeText(input.publisher, 180);
  if (!partial && publisher.length < 2) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR,
      'Publisher is required. Name the government body that owns the source.'
    );
  }
  const officialUrl = String(input.officialUrl || '').trim();
  if (!partial && !isHttpUrl(officialUrl)) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR,
      'Official source URL must be a valid http(s) address.'
    );
  }
  if (officialUrl && !isHttpUrl(officialUrl)) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR,
      'Official source URL must be a valid http(s) address.'
    );
  }
  const sourceType = Object.values(CONTACT_SOURCE_TYPES).includes(input.sourceType)
    ? input.sourceType
    : CONTACT_SOURCE_TYPES.OFFICIAL_PORTAL;
  const jurisdictionId = assertValidJurisdiction(input.jurisdictionId || 'NATIONAL');
  const retrievedAt = normalizeDate(input.retrievedAt || new Date().toISOString(), {
    fieldLabel: 'Source retrieval date',
  });

  return {
    title,
    publisher,
    officialUrl,
    jurisdictionId,
    sourceType,
    retrievedAt,
  };
};

export const validateContactInput = (input) => {
  if (!input || typeof input !== 'object') {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR,
      'Emergency contact must be an object.'
    );
  }
  if (input.contactScope && input.contactScope !== 'public_office') {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR,
      'Only public office contacts are allowed. Personal phone numbers, home addresses and private individuals must not be stored.',
      { field: 'contactScope' }
    );
  }

  const name = sanitizeText(input.name, OFFLINE_CARD_LIMITS.MAX_NAME_LENGTH);
  if (name.length < 3) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR,
      'Contact name must be at least 3 characters.'
    );
  }
  const organization = sanitizeText(
    input.organization,
    OFFLINE_CARD_LIMITS.MAX_ORGANIZATION_LENGTH
  );
  if (organization.length < 2) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR,
      'The public office or organisation responsible for the contact is required.'
    );
  }
  const category = Object.values(OFFLINE_CARD_CATEGORIES).includes(input.category)
    ? input.category
    : null;
  if (!category) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR,
      `Choose a valid category: ${Object.values(OFFLINE_CARD_CATEGORIES).join(', ')}.`
    );
  }
  const jurisdictionId = assertValidJurisdiction(input.jurisdictionId);
  const sourceId = sanitizeText(input.sourceId, 120);
  if (!sourceId) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR,
      'An official source is required for every emergency contact.'
    );
  }
  const phone = String(input.phone || '').trim();
  if (!isPhoneNumber(phone)) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR,
      'Enter a valid public phone number (3–15 digits, optionally with +, spaces, hyphens or brackets).'
    );
  }
  const alternatePhone = String(input.alternatePhone || '').trim();
  if (alternatePhone && !isPhoneNumber(alternatePhone)) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR,
      'Alternate phone must be a valid public phone number.'
    );
  }
  const email = String(input.email || '').trim();
  if (email && !isEmail(email)) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR,
      'Enter a valid official email address, or leave the field empty.'
    );
  }
  const website = String(input.website || '').trim();
  if (website && !isHttpUrl(website)) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR,
      'Official website must be a valid http(s) address.'
    );
  }
  const hours = sanitizeText(input.hours, 120);
  if (hours.length < 2) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR,
      'Availability hours are required so a reader knows when the number is staffed.'
    );
  }
  const description = sanitizeText(
    input.description,
    OFFLINE_CARD_LIMITS.MAX_DESCRIPTION_LENGTH
  );
  assertNoSensitiveData(description, 'contact description');
  const address = sanitizeText(input.address, OFFLINE_CARD_LIMITS.MAX_ADDRESS_LENGTH);
  assertNoSensitiveData(address, 'public office address');
  const languages = normalizeLanguages(input.languages);
  if (languages.length === 0) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR,
      'List at least one language the helpline supports.'
    );
  }
  const reviewIntervalDays = Number(input.reviewIntervalDays || 180);
  if (
    !Number.isInteger(reviewIntervalDays) ||
    reviewIntervalDays < 30 ||
    reviewIntervalDays > 365
  ) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR,
      'Review interval must be a whole number between 30 and 365 days.'
    );
  }

  return {
    name,
    organization,
    category,
    jurisdictionId,
    sourceId,
    phone,
    alternatePhone,
    email,
    website,
    address,
    hours,
    languages,
    description,
    contactScope: 'public_office',
    isNational: jurisdictionId === 'NATIONAL',
    reviewIntervalDays,
  };
};

export const validateContactUpdateInput = (input) => {
  const contact = validateContactInput(input);
  const expectedVersion = Number(input.expectedVersion);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR,
      'Reload the contact and try again: an expected version is required to prevent overwriting another reviewer.'
    );
  }
  return {
    ...contact,
    expectedVersion,
    changeReason: validateReason(input.changeReason, { label: 'change reason' }),
  };
};

export const validateVerificationInput = (input = {}) => {
  if (input && typeof input !== 'object') {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR,
      'Verification details must be an object.'
    );
  }
  const verificationMethod = sanitizeText(
    input.verificationMethod || 'Official source checked manually',
    200
  );
  if (verificationMethod.length < 5) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR,
      'Describe how the official source was checked (at least 5 characters).'
    );
  }
  const lastVerifiedAt = normalizeDate(input.lastVerifiedAt || new Date().toISOString(), {
    fieldLabel: 'Last verified date',
  });
  const reason = validateReason(input.reason, { label: 'verification note' });
  return { verificationMethod, lastVerifiedAt, reason };
};

export const validatePreferenceInput = (input = {}) => {
  if (!input || typeof input !== 'object') {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR,
      'Card preferences must be an object.'
    );
  }
  const jurisdictionId = assertValidJurisdiction(input.jurisdictionId || 'LKO');
  const rawRefs = Array.isArray(input.selectedContactRefs)
    ? input.selectedContactRefs
    : Array.isArray(input.selectedContactIds)
      ? input.selectedContactIds
      : [];
  const selectedContactRefs = [...new Set(rawRefs.map((id) => String(id).trim()).filter(Boolean))];
  if (selectedContactRefs.length > OFFLINE_CARD_LIMITS.MAX_SELECTED_CONTACTS) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.CARD_TOO_LARGE,
      `A card can hold at most ${OFFLINE_CARD_LIMITS.MAX_SELECTED_CONTACTS} contacts.`
    );
  }
  for (const ref of selectedContactRefs) {
    if (!/^[a-z0-9][a-z0-9-]{2,119}$/i.test(ref)) {
      throw new OfflineEmergencyCardError(
        OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR,
        'Selected contacts contain an invalid public reference.'
      );
    }
  }
  const note = sanitizeText(input.note, OFFLINE_CARD_LIMITS.MAX_NOTE_LENGTH);
  assertNoSensitiveData(note, 'personal note');
  return {
    jurisdictionId,
    selectedContactRefs,
    note,
    includeNational: input.includeNational !== false,
    largeText: Boolean(input.largeText),
    showTable: Boolean(input.showTable),
    expectedVersion:
      input.expectedVersion == null ? null : Number(input.expectedVersion),
  };
};

export const validateRecommendationDecision = (input = {}) => {
  const action = String(input.action || '');
  if (!['accept', 'edit', 'reject'].includes(action)) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR,
      'Recommendation decision must be accept, edit or reject.'
    );
  }
  const reason = validateReason(input.reason, {
    required: action === 'reject',
    label: 'rejection reason',
  });
  const note = sanitizeText(input.note, OFFLINE_CARD_LIMITS.MAX_NOTE_LENGTH);
  if (action === 'edit' && note.length < 5) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR,
      'An edited recommendation needs a short human note explaining the change.'
    );
  }
  if (note) assertNoSensitiveData(note, 'recommendation note');
  const expectedVersion =
    input.expectedVersion == null ? null : Number(input.expectedVersion);
  return { action, reason, note, expectedVersion };
};

export const isRecommendationStatus = (value) =>
  Object.values(RECOMMENDATION_STATUS).includes(value);

export const isContactAction = (value) => Object.values(CONTACT_ACTION).includes(value);

/**
 * Deterministic, dependency-free content digest used for card versions and
 * idempotency fingerprints. Not a cryptographic signature.
 */
export const stableStringify = (value) => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
};

export const contentDigest = (value) => {
  const text = stableStringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
};

export const slugify = (value, maxLength = 64) =>
  String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength) || 'contact';

/** A public reference that is stable but is not the internal record identifier. */
export const publicRefForContact = (contact) =>
  `${slugify(contact?.name || 'contact', 48)}-${contentDigest(contact?.id || 'unknown').slice(0, 6)}`;

export const bytesOf = (value) => {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length;
  return text.length;
};
