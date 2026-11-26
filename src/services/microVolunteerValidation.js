/**
 * Validation and sanitisation at the trusted boundary for the Civic
 * Micro-Volunteer Task Board (#759).
 *
 * Client-side form checks are a usability layer only. Every service and API
 * write passes through these helpers before persistence. Error codes are stable
 * so the UI can translate them into plain-language guidance.
 */

import {
  EVIDENCE_FILE_TYPES,
  MICRO_VOLUNTEER_ERROR_CODES,
  MICRO_VOLUNTEER_ERROR_HELP,
  MICRO_VOLUNTEER_LIMITS,
  TASK_CATEGORY_MAP,
  canTransition,
  findPersonalData,
  isSafeHttpsUrl,
  isTaskStatus,
  validateEvidenceInput,
  validateIdempotencyKey,
  validateModerationInput,
  validatePagination,
  validatePreferenceInput,
  validateTaskInput,
} from '../data/microVolunteerContract.js';
import { sanitizePlainText } from '../utils/safeContent.js';

export class MicroVolunteerError extends Error {
  constructor(code, message, details = null) {
    super(message || code);
    this.name = 'MicroVolunteerError';
    this.code = code || MICRO_VOLUNTEER_ERROR_CODES.VALIDATION_ERROR;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

export const toUserMessage = (error) => {
  if (!error) return MICRO_VOLUNTEER_ERROR_HELP[MICRO_VOLUNTEER_ERROR_CODES.VALIDATION_ERROR];
  if (typeof error === 'string') return error;
  return (
    MICRO_VOLUNTEER_ERROR_HELP[error.code] ||
    error.message ||
    'The request could not be completed. Refresh the board and try again.'
  );
};

export const sanitizeText = (value, max = 500) =>
  sanitizePlainText(value, { max, multiline: true });

export const sanitizeSingleLine = (value, max = 160) =>
  sanitizePlainText(value, { max, multiline: false });

const firstError = (errors) =>
  Array.isArray(errors) && errors.length > 0
    ? new MicroVolunteerError(
        MICRO_VOLUNTEER_ERROR_CODES.VALIDATION_ERROR,
        errors[0].message || 'Please correct the highlighted fields.',
        errors
      )
    : null;

export const throwIfErrors = (errors) => {
  const error = firstError(errors);
  if (error) throw error;
};

export const assertTransition = (transitions, from, to, label = 'record') => {
  if (!canTransition(transitions, from, to)) {
    throw new MicroVolunteerError(
      MICRO_VOLUNTEER_ERROR_CODES.INVALID_TRANSITION,
      `A ${label} cannot move from "${from}" to "${to}". Refresh the record and choose an available action.`,
      { from, to }
    );
  }
};

export const normalizeIdempotencyKey = (key) => {
  const message = validateIdempotencyKey(key);
  if (message) {
    throw new MicroVolunteerError(MICRO_VOLUNTEER_ERROR_CODES.VALIDATION_ERROR, message, {
      field: 'idempotencyKey',
    });
  }
  return String(key).trim();
};

export const assertNoPersonalData = (text, fieldLabel = 'notes') => {
  const findings = findPersonalData(text);
  if (findings.length > 0) {
    throw new MicroVolunteerError(
      MICRO_VOLUNTEER_ERROR_CODES.VALIDATION_ERROR,
      `${fieldLabel} appears to contain ${findings.join(', ')}. Remove personal identifiers before saving.`,
      { field: fieldLabel, findings }
    );
  }
};

export const normalizeTaskInput = (input, { now = new Date() } = {}) => {
  if (!input || typeof input !== 'object') {
    throw new MicroVolunteerError(
      MICRO_VOLUNTEER_ERROR_CODES.VALIDATION_ERROR,
      'Task details are required.'
    );
  }
  const category = TASK_CATEGORY_MAP[input.categoryId];
  const cleaned = {
    categoryId: input.categoryId,
    title: sanitizeSingleLine(input.title, MICRO_VOLUNTEER_LIMITS.MAX_TITLE_LENGTH),
    instructions: sanitizeText(input.instructions, MICRO_VOLUNTEER_LIMITS.MAX_INSTRUCTIONS_LENGTH),
    jurisdictionId: String(input.jurisdictionId || '').toUpperCase().trim(),
    locality: sanitizeSingleLine(input.locality, MICRO_VOLUNTEER_LIMITS.MAX_LOCALITY_LENGTH),
    timeEstimateMinutes: Number(input.timeEstimateMinutes),
    dueDate: String(input.dueDate || '').trim(),
    capacity: Number(input.capacity ?? 1),
    evidenceRequirements: Array.isArray(input.evidenceRequirements)
      ? input.evidenceRequirements.map((item) => sanitizeSingleLine(item, 160)).filter(Boolean)
      : category?.defaultEvidenceRequirements || [],
    safetyAcknowledgements: input.safetyAcknowledgements || {},
    safetyNote: sanitizeText(
      input.safetyNote || category?.safetyNote || 'Complete the task from a safe public place.',
      500
    ),
    source: sanitizeSingleLine(input.source || 'Municipal volunteer desk', 160),
    publish: input.publish !== false,
  };

  throwIfErrors(validateTaskInput(cleaned, { now }));
  return cleaned;
};

export const normalizeEvidenceInput = (input) => {
  const source =
    input && typeof input === 'object'
      ? input.evidence && typeof input.evidence === 'object'
        ? input.evidence
        : input
      : {};

  const files = Array.isArray(source.files)
    ? source.files.map((file) => {
        if (!file || typeof file !== 'object') return file;
        return {
          name: sanitizeSingleLine(file.name, 120),
          mimeType: String(file.mimeType || '').toLowerCase(),
          sizeBytes: Number(file.sizeBytes),
          sha256: file.sha256 ? String(file.sha256).toLowerCase() : null,
        };
      })
    : [];

  const cleaned = {
    note: sanitizeText(source.note, MICRO_VOLUNTEER_LIMITS.MAX_EVIDENCE_NOTE_LENGTH),
    link: source.link ? String(source.link).trim() : '',
    files,
  };

  throwIfErrors(validateEvidenceInput(cleaned));
  return cleaned;
};

export const normalizeModerationInput = (input) => {
  const cleaned = {
    decision: input?.decision,
    reason: sanitizeText(input?.reason || '', MICRO_VOLUNTEER_LIMITS.MAX_MODERATION_REASON_LENGTH),
    publicOutcomeNote: sanitizeText(
      input?.publicOutcomeNote || '',
      MICRO_VOLUNTEER_LIMITS.MAX_PUBLIC_OUTCOME_LENGTH
    ),
  };
  throwIfErrors(validateModerationInput(cleaned));
  return cleaned;
};

export const normalizePreferenceInput = (input) => {
  const cleaned = {
    categoryIds: Array.isArray(input?.categoryIds) ? [...new Set(input.categoryIds)] : [],
    jurisdictionId: input?.jurisdictionId
      ? String(input.jurisdictionId).toUpperCase().trim()
      : null,
    availableMinutes:
      input?.availableMinutes != null && input.availableMinutes !== ''
        ? Number(input.availableMinutes)
        : null,
  };
  throwIfErrors(validatePreferenceInput(cleaned));
  return cleaned;
};

export const normalizeSearchFilters = (filters = {}) => {
  const pagination = validatePagination(filters);
  const status = isTaskStatus(filters.status) ? filters.status : null;
  const categoryId = TASK_CATEGORY_MAP[filters.categoryId] ? filters.categoryId : null;
  const search = sanitizeSingleLine(filters.search || '', 80);
  const jurisdictionId = filters.jurisdictionId
    ? String(filters.jurisdictionId).toUpperCase().trim()
    : null;
  const sort = ['due_date', 'created_at', 'updated_at'].includes(filters.sort)
    ? filters.sort
    : 'due_date';

  return {
    ...pagination,
    status,
    categoryId,
    jurisdictionId,
    search,
    sort,
    includeArchived: filters.includeArchived === true,
  };
};

export const validateReason = (reason, { required = true } = {}) => {
  const cleaned = sanitizeText(reason || '', MICRO_VOLUNTEER_LIMITS.MAX_MODERATION_REASON_LENGTH);
  if (required && cleaned.length < MICRO_VOLUNTEER_LIMITS.MIN_MODERATION_REASON_LENGTH) {
    throw new MicroVolunteerError(
      MICRO_VOLUNTEER_ERROR_CODES.VALIDATION_ERROR,
      'A short reason is required for this action.',
      { field: 'reason' }
    );
  }
  assertNoPersonalData(cleaned, 'reason');
  return cleaned;
};

export const validateJurisdictionCode = (value) => {
  const code = String(value || '').toUpperCase().trim();
  if (!/^[A-Z0-9-]{2,40}$/.test(code)) {
    throw new MicroVolunteerError(
      MICRO_VOLUNTEER_ERROR_CODES.VALIDATION_ERROR,
      'A jurisdiction code such as WARD-042 is required.',
      { field: 'jurisdictionId' }
    );
  }
  return code;
};

export const validateEvidencePayload = (input) => normalizeEvidenceInput(input);

export const computeEvidencePayloadHash = ({ claimId, note, link, files }) => {
  const normalised = {
    claimId: String(claimId || '').trim(),
    note: String(note || '').trim(),
    link: String(link || '').trim(),
    files: (Array.isArray(files) ? files : [])
      .map((file) => ({
        name: String(file?.name || '').trim(),
        mimeType: String(file?.mimeType || '').toLowerCase(),
        sizeBytes: Number(file?.sizeBytes),
        sha256: file?.sha256 ? String(file.sha256).toLowerCase() : null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
  const text = JSON.stringify(normalised);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `mvs-${(hash >>> 0).toString(16).padStart(8, '0')}`;
};

export const isAllowedEvidenceType = (mimeType) => EVIDENCE_FILE_TYPES.includes(mimeType);

export const evidenceFileSummary = (files = []) => ({
  count: files.length,
  types: [...new Set(files.map((file) => file.mimeType))],
  totalBytes: files.reduce((sum, file) => sum + Number(file.sizeBytes || 0), 0),
  storage: 'metadata_only',
  note: 'File contents are never stored on the public board; only name, type, size and optional SHA-256 are retained.',
});

export const assertSafeEvidenceLink = (link) => {
  if (link && !isSafeHttpsUrl(link)) {
    throw new MicroVolunteerError(
      MICRO_VOLUNTEER_ERROR_CODES.VALIDATION_ERROR,
      'Evidence link must be a public https:// address.'
    );
  }
};

export const normalizeOpenTaskFields = (updates = {}) => {
  const cleaned = {};
  if (updates.title != null) {
    cleaned.title = sanitizeSingleLine(updates.title, MICRO_VOLUNTEER_LIMITS.MAX_TITLE_LENGTH);
  }
  if (updates.instructions != null) {
    cleaned.instructions = sanitizeText(
      updates.instructions,
      MICRO_VOLUNTEER_LIMITS.MAX_INSTRUCTIONS_LENGTH
    );
  }
  if (updates.locality != null) {
    cleaned.locality = sanitizeSingleLine(
      updates.locality,
      MICRO_VOLUNTEER_LIMITS.MAX_LOCALITY_LENGTH
    );
  }
  if (updates.timeEstimateMinutes != null) {
    cleaned.timeEstimateMinutes = Number(updates.timeEstimateMinutes);
  }
  if (updates.dueDate != null) cleaned.dueDate = String(updates.dueDate).trim();
  if (updates.capacity != null) cleaned.capacity = Number(updates.capacity);
  if (updates.evidenceRequirements != null) {
    cleaned.evidenceRequirements = Array.isArray(updates.evidenceRequirements)
      ? updates.evidenceRequirements.map((item) => sanitizeSingleLine(item, 160)).filter(Boolean)
      : updates.evidenceRequirements;
  }
  if (updates.safetyNote != null) cleaned.safetyNote = sanitizeText(updates.safetyNote, 500);
  if (updates.source != null) cleaned.source = sanitizeSingleLine(updates.source, 160);
  if (updates.status != null) cleaned.status = updates.status;
  return cleaned;
};

export const normalizeDecisionInput = (input) => {
  const cleaned = {
    decision: input?.decision,
    editedCategoryId: input?.editedCategoryId,
    reason: sanitizeText(input?.reason || '', MICRO_VOLUNTEER_LIMITS.MAX_MODERATION_REASON_LENGTH),
  };
  if (!['accept', 'edit', 'reject'].includes(cleaned.decision)) {
    throw new MicroVolunteerError(
      MICRO_VOLUNTEER_ERROR_CODES.VALIDATION_ERROR,
      'Choose accept, edit or reject for the suggestion.'
    );
  }
  if (cleaned.decision === 'edit' && !TASK_CATEGORY_MAP[cleaned.editedCategoryId]) {
    throw new MicroVolunteerError(
      MICRO_VOLUNTEER_ERROR_CODES.VALIDATION_ERROR,
      'Choose a valid category when editing a suggestion.'
    );
  }
  if (cleaned.decision === 'reject' && cleaned.reason.length < 3) {
    throw new MicroVolunteerError(
      MICRO_VOLUNTEER_ERROR_CODES.VALIDATION_ERROR,
      'A short reason is required when rejecting a suggestion.'
    );
  }
  assertNoPersonalData(cleaned.reason, 'reason');
  return cleaned;
};
