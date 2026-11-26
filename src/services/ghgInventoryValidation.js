/**
 * Input validation & sanitisation for the Greenhouse-Gas Inventory (#753).
 *
 * Every write passes through this module before persistence. Client-side checks are only a
 * usability layer; these checks run again in the service and in the serverless handler.
 */

import {
  ACTIVITY_UNITS,
  ALLOWED_SOURCE_DOCUMENT_TYPES,
  DATA_QUALITY,
  EMISSION_CATEGORIES,
  GHG_ERROR_CODES,
  GHG_LIMITS,
  PERIOD_STATUS,
  SOURCE_STATUS,
  SUBMISSION_STATUS,
} from './ghgInventoryConstants.js';

export class GhgInventoryError extends Error {
  constructor(code, message, details = null) {
    super(message || code);
    this.name = 'GhgInventoryError';
    this.code = code || GHG_ERROR_CODES.VALIDATION_ERROR;
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
    .trim()
    .slice(0, maxLength);
};

const AADHAAR_REGEX = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;
const PHONE_REGEX = /(?<![\d])(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}(?![\d])/;
const DOOR_REGEX =
  /\b(?:flat\s*(?:no\.?|#)?\s*[a-z0-9-]+|door\s*(?:no\.?|#)?\s*[a-z0-9/-]+|house\s*(?:no\.?|#)?\s*[a-z0-9/-]+)\b/i;
const CREDENTIAL_REGEX = /\b(?:password|passwd|secret|api[_-]?key|auth[_-]?token|private[_-]?key)\b/i;

/**
 * Returns a list of plain-language PII findings. Department operational narratives must not
 * contain resident identity or contact data; the original activity value is sufficient.
 */
export const findPersonalData = (text) => {
  if (typeof text !== 'string' || text.length === 0) return [];
  const findings = [];
  if (AADHAAR_REGEX.test(text)) findings.push('an Aadhaar number');
  if (PAN_REGEX.test(text)) findings.push('a PAN number');
  if (PHONE_REGEX.test(text)) findings.push('a personal phone number');
  if (DOOR_REGEX.test(text)) findings.push('an exact flat/door/house number');
  if (CREDENTIAL_REGEX.test(text)) findings.push('a credential or access token');
  return findings;
};

export const assertNoPersonalData = (text, fieldLabel = 'notes') => {
  const findings = findPersonalData(text);
  if (findings.length > 0) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.VALIDATION_ERROR,
      `${fieldLabel} appears to contain ${findings.join(', ')}. Remove personal identifiers; store only municipal operational data.`,
      { field: fieldLabel, findings }
    );
  }
};

export const validateIdempotencyKey = (key) => {
  if (typeof key !== 'string' || key.trim().length < 8 || key.trim().length > 128) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.VALIDATION_ERROR,
      'An idempotency key of 8–128 characters is required so a retried submission is not recorded twice.'
    );
  }
  return key.trim();
};

export const validatePagination = ({ page = 1, pageSize = GHG_LIMITS.DEFAULT_PAGE_SIZE } = {}) => {
  const safePage = Number.isInteger(Number(page)) && Number(page) > 0 ? Number(page) : 1;
  const requestedSize = Number(pageSize);
  const safePageSize =
    Number.isInteger(requestedSize) && requestedSize > 0
      ? Math.min(requestedSize, GHG_LIMITS.MAX_PAGE_SIZE)
      : GHG_LIMITS.DEFAULT_PAGE_SIZE;
  return { page: safePage, pageSize: safePageSize };
};

export const validateSourceDocument = (document) => {
  if (!document) return null;
  if (typeof document !== 'object') {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.VALIDATION_ERROR,
      'Source document must be metadata, not an uploaded file.'
    );
  }
  if (
    document.mimeType &&
    !ALLOWED_SOURCE_DOCUMENT_TYPES.includes(document.mimeType)
  ) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.UNSUPPORTED_FILE,
      `Unsupported source document type "${document.mimeType}". Use PDF, CSV or XLSX.`
    );
  }
  if (document.sizeBytes != null) {
    const size = Number(document.sizeBytes);
    if (!Number.isFinite(size) || size < 0 || size > GHG_LIMITS.MAX_PDF_BYTES) {
      throw new GhgInventoryError(
        GHG_ERROR_CODES.UNSUPPORTED_FILE,
        `Source document size must be between 0 and ${GHG_LIMITS.MAX_PDF_BYTES} bytes.`
      );
    }
  }
  return {
    name: sanitizeText(document.name || '', 160),
    mimeType: document.mimeType || 'application/pdf',
    sizeBytes: document.sizeBytes != null ? Number(document.sizeBytes) : null,
    sha256:
      typeof document.sha256 === 'string' && /^[a-f0-9]{64}$/i.test(document.sha256)
        ? document.sha256.toLowerCase()
        : null,
    storage: 'metadata_only',
    note: 'Original file retained by the submitting department; not uploaded to a public record.',
  };
};

export const validateEmissionSourceInput = (input) => {
  if (!input || typeof input !== 'object') {
    throw new GhgInventoryError(GHG_ERROR_CODES.VALIDATION_ERROR, 'Emission source must be an object.');
  }
  const name = sanitizeText(input.name || '', GHG_LIMITS.MAX_NAME_LENGTH);
  if (name.length < 3) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.VALIDATION_ERROR,
      'Emission source name must be at least 3 characters.'
    );
  }
  if (!Object.values(EMISSION_CATEGORIES).includes(input.category)) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.VALIDATION_ERROR,
      `Emission source category must be one of: ${Object.values(EMISSION_CATEGORIES).join(', ')}.`
    );
  }
  if (!input.defaultFactorId || typeof input.defaultFactorId !== 'string') {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.VALIDATION_ERROR,
      'An emission source must reference a published emission factor.'
    );
  }
  const description = sanitizeText(input.description || '', 500);
  assertNoPersonalData(description, 'source description');
  return {
    name,
    category: input.category,
    department: sanitizeText(input.department || '', 120),
    location: sanitizeText(input.location || '', 160),
    defaultFactorId: input.defaultFactorId.trim(),
    status: Object.values(SOURCE_STATUS).includes(input.status)
      ? input.status
      : SOURCE_STATUS.ACTIVE,
    description,
  };
};

export const validateActivityRecordInput = (input, { source } = {}) => {
  if (!input || typeof input !== 'object') {
    throw new GhgInventoryError(GHG_ERROR_CODES.VALIDATION_ERROR, 'Activity record must be an object.');
  }
  if (!source) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.NOT_FOUND,
      'Activity data must reference an existing emission source.'
    );
  }
  const quantity = typeof input.quantity === 'string' ? Number(input.quantity) : input.quantity;
  if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity < 0) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.VALIDATION_ERROR,
      'Activity quantity must be a non-negative number. Enter the original meter, invoice or weighbridge value.'
    );
  }
  if (quantity > GHG_LIMITS.MAX_QUANTITY) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.VALIDATION_ERROR,
      `Activity quantity exceeds the supported range (${GHG_LIMITS.MAX_QUANTITY}). Check the unit and decimal point.`
    );
  }
  if (!ACTIVITY_UNITS[input.unit]) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.VALIDATION_ERROR,
      `Unsupported activity unit "${input.unit}". Allowed: ${Object.keys(ACTIVITY_UNITS).join(', ')}.`
    );
  }
  if (!Object.values(DATA_QUALITY).includes(input.dataQuality)) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.VALIDATION_ERROR,
      `Data quality must be one of: ${Object.values(DATA_QUALITY).join(', ')}. Measured, estimated and excluded values are stored separately.`
    );
  }
  const correctionNotes = sanitizeText(input.correctionNotes || '', GHG_LIMITS.MAX_NOTE_LENGTH);
  assertNoPersonalData(correctionNotes, 'correction notes');
  return {
    sourceId: source.id,
    category: source.category,
    quantity,
    unit: input.unit,
    dataQuality: input.dataQuality,
    correctionNotes,
    sourceDocument: validateSourceDocument(input.sourceDocument),
    factorId: input.factorId || source.defaultFactorId,
    factorVersionId: input.factorVersionId || null,
    factorAsOf: input.factorAsOf || null,
  };
};

export const validateSubmissionInput = (input, { sources = [], jurisdictionId } = {}) => {
  if (!input || typeof input !== 'object') {
    throw new GhgInventoryError(GHG_ERROR_CODES.VALIDATION_ERROR, 'Department submission must be an object.');
  }
  const title = sanitizeText(input.title || '', 160);
  if (title.length < 5) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.VALIDATION_ERROR,
      'Submission title must be at least 5 characters so reviewers understand what the data covers.'
    );
  }
  const department = sanitizeText(input.department || '', 120);
  if (department.length < 3) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.VALIDATION_ERROR,
      'Department is required on a submission.'
    );
  }
  if (!input.idempotencyKey) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.VALIDATION_ERROR,
      'An idempotency key is required to prevent duplicate submissions.'
    );
  }
  validateIdempotencyKey(input.idempotencyKey);

  if (!Array.isArray(input.records) || input.records.length === 0) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.VALIDATION_ERROR,
      'Add at least one activity record before saving a submission.'
    );
  }
  if (input.records.length > GHG_LIMITS.MAX_RECORDS_PER_SUBMISSION) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.VALIDATION_ERROR,
      `A submission may contain at most ${GHG_LIMITS.MAX_RECORDS_PER_SUBMISSION} activity records. Split it by source or period.`
    );
  }

  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const seenSources = new Set();
  const records = input.records.map((record, index) => {
    const source = sourceById.get(record.sourceId);
    if (!source) {
      throw new GhgInventoryError(
        GHG_ERROR_CODES.NOT_FOUND,
        `Activity row ${index + 1} references an unknown emission source.`
      );
    }
    if (source.jurisdictionId !== jurisdictionId) {
      throw new GhgInventoryError(
        GHG_ERROR_CODES.JURISDICTION_DENIED,
        `Activity row ${index + 1} belongs to another jurisdiction.`
      );
    }
    if (seenSources.has(source.id)) {
      throw new GhgInventoryError(
        GHG_ERROR_CODES.VALIDATION_ERROR,
        `Activity row ${index + 1} repeats the source "${source.name}". Combine values for one source into a single row so totals cannot double-count.`
      );
    }
    seenSources.add(source.id);
    return validateActivityRecordInput(record, { source });
  });

  const correctionNotes = sanitizeText(input.correctionNotes || '', GHG_LIMITS.MAX_NOTE_LENGTH);
  assertNoPersonalData(correctionNotes, 'submission correction notes');

  return { title, department, correctionNotes, records };
};

export const validateReason = (reason, { required = false, fieldLabel = 'reason' } = {}) => {
  const cleaned = sanitizeText(reason || '', 500);
  if (required && cleaned.length < 10) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.VALIDATION_ERROR,
      `A ${fieldLabel} of at least 10 characters is required for this action so the audit trail explains the decision.`
    );
  }
  assertNoPersonalData(cleaned, fieldLabel);
  return cleaned;
};

export const validatePeriodInput = (input) => {
  if (!input || typeof input !== 'object') {
    throw new GhgInventoryError(GHG_ERROR_CODES.VALIDATION_ERROR, 'Reporting period must be an object.');
  }
  const label = sanitizeText(input.label || '', 80);
  if (label.length < 4) {
    throw new GhgInventoryError(GHG_ERROR_CODES.VALIDATION_ERROR, 'Reporting period label is required.');
  }
  const start = new Date(input.startDate);
  const end = new Date(input.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.VALIDATION_ERROR,
      'Reporting period start and end dates must be valid ISO dates.'
    );
  }
  if (start >= end) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.VALIDATION_ERROR,
      'Reporting period start date must be before the end date.'
    );
  }
  if (end.getTime() - start.getTime() > 400 * 24 * 60 * 60 * 1000) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.VALIDATION_ERROR,
      'A reporting period may not exceed 400 days. Use an annual or half-yearly period.'
    );
  }
  return {
    label,
    startDate: input.startDate,
    endDate: input.endDate,
    status: Object.values(PERIOD_STATUS).includes(input.status) ? input.status : PERIOD_STATUS.DRAFT,
  };
};

export const validateFactorVersionInput = (input, { factor } = {}) => {
  if (!factor) {
    throw new GhgInventoryError(GHG_ERROR_CODES.NOT_FOUND, 'Emission factor not found.');
  }
  const factorValue = Number(input?.factorValue);
  if (!Number.isFinite(factorValue) || factorValue <= 0) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.VALIDATION_ERROR,
      'Factor value must be a positive number expressed in tCO2e per activity unit.'
    );
  }
  const uncertaintyPercent = Number(input?.uncertaintyPercent ?? 0);
  if (!Number.isFinite(uncertaintyPercent) || uncertaintyPercent < 0 || uncertaintyPercent > 100) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.VALIDATION_ERROR,
      'Uncertainty must be between 0 and 100 percent.'
    );
  }
  const effectiveFrom = input?.effectiveFrom || new Date().toISOString().slice(0, 10);
  if (Number.isNaN(new Date(effectiveFrom).getTime())) {
    throw new GhgInventoryError(GHG_ERROR_CODES.VALIDATION_ERROR, 'effectiveFrom must be a valid date.');
  }
  if (input?.effectiveTo && new Date(input.effectiveTo) < new Date(effectiveFrom)) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.VALIDATION_ERROR,
      'effectiveTo cannot be earlier than effectiveFrom.'
    );
  }
  const changeNote = sanitizeText(input?.changeNote || '', 500);
  if (changeNote.length < 10) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.VALIDATION_ERROR,
      'A change note of at least 10 characters is required for a new factor version.'
    );
  }
  return {
    factorValue,
    activityUnit: input?.activityUnit || factor.activityUnit,
    effectiveFrom,
    effectiveTo: input?.effectiveTo || null,
    uncertaintyPercent,
    methodology: sanitizeText(input?.methodology || factor.sourceName, 500),
    changeNote,
  };
};

export const validateSubmissionStatusFilter = (status) => {
  if (!status || status === 'all') return null;
  if (!Object.values(SUBMISSION_STATUS).includes(status)) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.VALIDATION_ERROR,
      `Unknown submission status filter "${status}".`
    );
  }
  return status;
};
