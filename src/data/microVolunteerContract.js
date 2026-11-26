/**
 * Civic Micro-Volunteer Task Board contract (#759).
 *
 * A low-risk neighbourhood contribution board: translate a public notice, check a
 * public link, or report an accessibility barrier. These tasks are deliberately
 * separate from official government service applications.
 *
 * This module is pure data and deterministic rules. It is imported by the service
 * layer, the serverless handler and the presentation components so enum values,
 * state transitions and validation never drift between screens and storage.
 */

export const MICRO_VOLUNTEER_SCHEMA_VERSION = 1;
export const MICRO_VOLUNTEER_STORAGE_KEY = 'civic_micro_volunteer_board_v1';
export const MICRO_VOLUNTEER_RULESET_VERSION = 'micro-volunteer-match-2026.1';
export const MICRO_VOLUNTEER_EXPORT_VERSION = 'micro-volunteer-board/v1';

export const MICRO_VOLUNTEER_ROLES = Object.freeze({
  PUBLIC: 'public',
  CITIZEN: 'citizen',
  OPERATOR: 'operator',
  REVIEWER: 'reviewer',
  ADMIN: 'admin',
});

export const MICRO_VOLUNTEER_STAFF_ROLES = Object.freeze([
  MICRO_VOLUNTEER_ROLES.OPERATOR,
  MICRO_VOLUNTEER_ROLES.REVIEWER,
  MICRO_VOLUNTEER_ROLES.ADMIN,
]);

export const MICRO_VOLUNTEER_CAPABILITIES = Object.freeze({
  'task.view_public': {
    roles: ['public', 'citizen', 'operator', 'reviewer', 'admin'],
    description: 'Read the public task board and aggregate progress.',
  },
  'task.create': {
    roles: ['operator', 'admin'],
    description: 'Publish or edit low-risk micro-volunteer tasks.',
  },
  'task.claim': {
    roles: ['citizen', 'admin'],
    description: 'Claim an open task for the signed-in contributor.',
  },
  'submission.create': {
    roles: ['citizen', 'admin'],
    description: 'Submit completion evidence for a claim.',
  },
  'task.moderate': {
    roles: ['reviewer', 'admin'],
    description: 'Approve, reject, request changes or reopen a completion.',
  },
  'task.archive': {
    roles: ['admin'],
    description: 'Archive a task without deleting its moderation history.',
  },
  'recommendation.view': {
    roles: ['citizen', 'admin'],
    description: 'View deterministic, explainable task suggestions.',
  },
  'recommendation.decide': {
    roles: ['citizen', 'admin'],
    description: 'Accept, edit or reject a suggestion produced by the ruleset.',
  },
  'audit.read': {
    roles: ['reviewer', 'admin'],
    description: 'Read the append-only moderation and workflow events.',
  },
  'retention.run': {
    roles: ['admin'],
    description: 'Apply the documented retention and archival policy.',
  },
});

export const TASK_CATEGORY_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: 'notice_translation',
    label: 'Translate a public notice',
    shortLabel: 'Notice translation',
    description:
      'Translate a short public notice into a local language so more neighbours can understand it.',
    defaultInstructions:
      'Open the official notice link, translate the headline and the key dates into the requested language, and keep place names unchanged.',
    defaultEvidenceRequirements: [
      'The translated text, or a clear photo of the handwritten translation',
      'The notice date and the ward or locality it applies to',
    ],
    estimatedMinutesRange: [15, 60],
    riskLevel: 'low',
    safetyNote: 'Do not collect identity documents, phone numbers or home addresses.',
  }),
  Object.freeze({
    id: 'link_check',
    label: 'Check a public link',
    shortTitle: 'Link check',
    shortLabel: 'Link check',
    description:
      'Check that an official public link still opens, names the right office, and shows the expected notice or form.',
    defaultInstructions:
      'Open the link in a private window, confirm the page title and office name, and describe anything that is broken or out of date.',
    defaultEvidenceRequirements: [
      'The public link that was checked',
      'What the page showed, including any error message',
    ],
    estimatedMinutesRange: [5, 20],
    riskLevel: 'low',
    safetyNote: 'Never enter a password, OTP or personal detail on a page you are checking.',
  }),
  Object.freeze({
    id: 'accessibility_barrier_report',
    label: 'Report an accessibility barrier',
    shortLabel: 'Accessibility barrier',
    description:
      'Record a public barrier such as a blocked footpath, missing ramp or broken tactile paving.',
    defaultInstructions:
      'From a safe public place, note the barrier, the nearest public landmark, and whether a wheelchair user could pass. Do not block traffic or enter private property.',
    defaultEvidenceRequirements: [
      'A short description of the barrier and the nearest public landmark',
      'A photo only if it can be taken safely from a public place',
    ],
    estimatedMinutesRange: [10, 30],
    riskLevel: 'low',
    safetyNote:
      'Stay on the footpath, do not step into traffic, and do not photograph people or private homes.',
  }),
  Object.freeze({
    id: 'public_information_verification',
    label: 'Verify public information',
    shortLabel: 'Information check',
    description:
      'Compare a civic notice board, helpline card or ward display with the official online source.',
    defaultInstructions:
      'Compare the printed public information with the official source, then record which dates, office names or phone numbers differ.',
    defaultEvidenceRequirements: [
      'The official source you compared against',
      'The exact field that differs and the date you checked it',
    ],
    estimatedMinutesRange: [10, 30],
    riskLevel: 'low',
    safetyNote: 'Record only public office information, never a citizen’s personal details.',
  }),
]);

export const TASK_CATEGORY_IDS = Object.freeze(
  TASK_CATEGORY_DEFINITIONS.map((category) => category.id)
);

export const TASK_CATEGORY_LABELS = Object.freeze(
  Object.fromEntries(TASK_CATEGORY_DEFINITIONS.map((category) => [category.id, category.label]))
);

export const TASK_CATEGORY_MAP = Object.freeze(
  Object.fromEntries(TASK_CATEGORY_DEFINITIONS.map((category) => [category.id, category]))
);

export const TASK_STATUS = Object.freeze({
  DRAFT: 'draft',
  OPEN: 'open',
  ASSIGNED: 'assigned',
  AWAITING_REVIEW: 'awaiting_review',
  COMPLETED: 'completed',
  REOPENED: 'reopened',
  ARCHIVED: 'archived',
});

export const TASK_STATUS_LABELS = Object.freeze({
  [TASK_STATUS.DRAFT]: 'Draft — not visible to citizens',
  [TASK_STATUS.OPEN]: 'Open for claims',
  [TASK_STATUS.ASSIGNED]: 'Claimed — more places may be open',
  [TASK_STATUS.AWAITING_REVIEW]: 'Completion submitted — waiting for a moderator',
  [TASK_STATUS.COMPLETED]: 'Completed and approved',
  [TASK_STATUS.REOPENED]: 'Reopened — needs another attempt',
  [TASK_STATUS.ARCHIVED]: 'Archived — kept for audit',
});

export const TASK_TRANSITIONS = Object.freeze({
  [TASK_STATUS.DRAFT]: [TASK_STATUS.OPEN, TASK_STATUS.ARCHIVED],
  [TASK_STATUS.OPEN]: [TASK_STATUS.ASSIGNED, TASK_STATUS.ARCHIVED],
  [TASK_STATUS.ASSIGNED]: [
    TASK_STATUS.OPEN,
    TASK_STATUS.AWAITING_REVIEW,
    TASK_STATUS.REOPENED,
    TASK_STATUS.ARCHIVED,
  ],
  [TASK_STATUS.AWAITING_REVIEW]: [
    TASK_STATUS.COMPLETED,
    TASK_STATUS.REOPENED,
    TASK_STATUS.ARCHIVED,
  ],
  [TASK_STATUS.COMPLETED]: [TASK_STATUS.REOPENED, TASK_STATUS.ARCHIVED],
  [TASK_STATUS.REOPENED]: [
    TASK_STATUS.OPEN,
    TASK_STATUS.ASSIGNED,
    TASK_STATUS.AWAITING_REVIEW,
    TASK_STATUS.COMPLETED,
    TASK_STATUS.ARCHIVED,
  ],
  [TASK_STATUS.ARCHIVED]: [],
});

export const CLAIM_STATUS = Object.freeze({
  ACTIVE: 'active',
  SUBMITTED: 'submitted',
  CHANGES_REQUESTED: 'changes_requested',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  REOPENED: 'reopened',
  WITHDRAWN: 'withdrawn',
  EXPIRED: 'expired',
});

export const CLAIM_STATUS_LABELS = Object.freeze({
  [CLAIM_STATUS.ACTIVE]: 'Claimed — evidence not submitted yet',
  [CLAIM_STATUS.SUBMITTED]: 'Evidence submitted — waiting for moderation',
  [CLAIM_STATUS.CHANGES_REQUESTED]: 'Changes requested — resubmit evidence',
  [CLAIM_STATUS.APPROVED]: 'Approved',
  [CLAIM_STATUS.REJECTED]: 'Rejected — reason recorded',
  [CLAIM_STATUS.REOPENED]: 'Reopened — submit a new completion',
  [CLAIM_STATUS.WITHDRAWN]: 'Withdrawn by the contributor',
  [CLAIM_STATUS.EXPIRED]: 'Expired before completion',
});

export const CLAIM_TRANSITIONS = Object.freeze({
  [CLAIM_STATUS.ACTIVE]: [
    CLAIM_STATUS.SUBMITTED,
    CLAIM_STATUS.WITHDRAWN,
    CLAIM_STATUS.EXPIRED,
  ],
  [CLAIM_STATUS.SUBMITTED]: [
    CLAIM_STATUS.APPROVED,
    CLAIM_STATUS.REJECTED,
    CLAIM_STATUS.CHANGES_REQUESTED,
  ],
  [CLAIM_STATUS.CHANGES_REQUESTED]: [
    CLAIM_STATUS.SUBMITTED,
    CLAIM_STATUS.WITHDRAWN,
    CLAIM_STATUS.REOPENED,
  ],
  [CLAIM_STATUS.APPROVED]: [CLAIM_STATUS.REOPENED],
  [CLAIM_STATUS.REJECTED]: [CLAIM_STATUS.REOPENED],
  [CLAIM_STATUS.REOPENED]: [CLAIM_STATUS.SUBMITTED, CLAIM_STATUS.WITHDRAWN],
  [CLAIM_STATUS.WITHDRAWN]: [],
  [CLAIM_STATUS.EXPIRED]: [],
});

export const COMPLETION_STATUS = Object.freeze({
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'under_review',
  CHANGES_REQUESTED: 'changes_requested',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  REOPENED: 'reopened',
  WITHDRAWN: 'withdrawn',
});

export const COMPLETION_STATUS_LABELS = Object.freeze({
  [COMPLETION_STATUS.SUBMITTED]: 'Submitted — waiting for a moderator',
  [COMPLETION_STATUS.UNDER_REVIEW]: 'Under review',
  [COMPLETION_STATUS.CHANGES_REQUESTED]: 'Changes requested',
  [COMPLETION_STATUS.APPROVED]: 'Approved — counted in completed tasks',
  [COMPLETION_STATUS.REJECTED]: 'Rejected — reason recorded',
  [COMPLETION_STATUS.REOPENED]: 'Reopened by a moderator',
  [COMPLETION_STATUS.WITHDRAWN]: 'Withdrawn',
});

export const COMPLETION_TRANSITIONS = Object.freeze({
  [COMPLETION_STATUS.SUBMITTED]: [
    COMPLETION_STATUS.UNDER_REVIEW,
    COMPLETION_STATUS.APPROVED,
    COMPLETION_STATUS.REJECTED,
    COMPLETION_STATUS.CHANGES_REQUESTED,
    COMPLETION_STATUS.WITHDRAWN,
  ],
  [COMPLETION_STATUS.UNDER_REVIEW]: [
    COMPLETION_STATUS.APPROVED,
    COMPLETION_STATUS.REJECTED,
    COMPLETION_STATUS.CHANGES_REQUESTED,
  ],
  [COMPLETION_STATUS.CHANGES_REQUESTED]: [
    COMPLETION_STATUS.SUBMITTED,
    COMPLETION_STATUS.WITHDRAWN,
  ],
  [COMPLETION_STATUS.APPROVED]: [COMPLETION_STATUS.REOPENED],
  [COMPLETION_STATUS.REJECTED]: [COMPLETION_STATUS.REOPENED],
  [COMPLETION_STATUS.REOPENED]: [],
  [COMPLETION_STATUS.WITHDRAWN]: [],
});

export const MODERATION_ACTIONS = Object.freeze({
  APPROVE: 'approve',
  REJECT: 'reject',
  REQUEST_CHANGES: 'request_changes',
  REOPEN: 'reopen',
});

export const MODERATION_ACTION_LABELS = Object.freeze({
  [MODERATION_ACTIONS.APPROVE]: 'Approve completion',
  [MODERATION_ACTIONS.REJECT]: 'Reject completion',
  [MODERATION_ACTIONS.REQUEST_CHANGES]: 'Request changes',
  [MODERATION_ACTIONS.REOPEN]: 'Reopen task',
});

export const RECOMMENDATION_STATUS = Object.freeze({
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  EDITED: 'edited',
  REJECTED: 'rejected',
});

export const RECOMMENDATION_STATUS_LABELS = Object.freeze({
  [RECOMMENDATION_STATUS.PENDING]: 'Awaiting your decision',
  [RECOMMENDATION_STATUS.ACCEPTED]: 'Accepted',
  [RECOMMENDATION_STATUS.EDITED]: 'Edited before accepting',
  [RECOMMENDATION_STATUS.REJECTED]: 'Rejected',
});

export const RECOMMENDATION_TRANSITIONS = Object.freeze({
  [RECOMMENDATION_STATUS.PENDING]: [
    RECOMMENDATION_STATUS.ACCEPTED,
    RECOMMENDATION_STATUS.EDITED,
    RECOMMENDATION_STATUS.REJECTED,
  ],
  [RECOMMENDATION_STATUS.ACCEPTED]: [],
  [RECOMMENDATION_STATUS.EDITED]: [],
  [RECOMMENDATION_STATUS.REJECTED]: [],
});

export const EVIDENCE_FILE_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

export const SAFETY_ACKNOWLEDGEMENT_KEYS = Object.freeze([
  'no_private_data',
  'no_enforcement',
  'no_unsafe_activity',
  'separate_from_official_application',
]);

export const SAFETY_ACKNOWLEDGEMENT_LABELS = Object.freeze({
  no_private_data: 'This task never asks for Aadhaar, PAN, phone numbers or home addresses.',
  no_enforcement: 'This task does not ask anyone to enforce a rule, evict, confront or detain.',
  no_unsafe_activity:
    'This task can be done from a safe public place without traffic control, climbing or medical work.',
  separate_from_official_application:
    'This is a neighbourhood contribution, not an official government application or decision.',
});

export const MICRO_VOLUNTEER_LIMITS = Object.freeze({
  MAX_TITLE_LENGTH: 140,
  MIN_TITLE_LENGTH: 8,
  MAX_INSTRUCTIONS_LENGTH: 1600,
  MIN_INSTRUCTIONS_LENGTH: 30,
  MAX_LOCALITY_LENGTH: 100,
  MAX_EVIDENCE_NOTE_LENGTH: 1500,
  MIN_EVIDENCE_NOTE_LENGTH: 15,
  MAX_EVIDENCE_LINK_LENGTH: 2048,
  MAX_EVIDENCE_FILES: 3,
  MAX_EVIDENCE_FILE_BYTES: 2 * 1024 * 1024,
  MAX_MODERATION_REASON_LENGTH: 500,
  MIN_MODERATION_REASON_LENGTH: 5,
  MAX_PUBLIC_OUTCOME_LENGTH: 320,
  MAX_PAGE_SIZE: 20,
  DEFAULT_PAGE_SIZE: 10,
  MAX_TASK_CLAIMS_PER_TASK: 20,
  MAX_CLAIMS_PER_CITIZEN_PER_WINDOW: 5,
  CLAIM_WINDOW_MS: 10 * 60 * 1000,
  MAX_SUBMISSIONS_PER_CITIZEN_PER_WINDOW: 3,
  SUBMISSION_WINDOW_MS: 15 * 60 * 1000,
  MIN_IDEMPOTENCY_KEY_LENGTH: 8,
  MAX_IDEMPOTENCY_KEY_LENGTH: 128,
  MAX_DUE_DAYS_AHEAD: 180,
  STALE_AFTER_DAYS: 30,
});

export const MICRO_VOLUNTEER_ERROR_CODES = Object.freeze({
  NOT_FOUND: 'MICRO_VOLUNTEER_NOT_FOUND',
  VALIDATION_ERROR: 'MICRO_VOLUNTEER_VALIDATION_ERROR',
  UNAUTHENTICATED: 'MICRO_VOLUNTEER_UNAUTHENTICATED',
  PERMISSION_DENIED: 'MICRO_VOLUNTEER_PERMISSION_DENIED',
  JURISDICTION_DENIED: 'MICRO_VOLUNTEER_JURISDICTION_DENIED',
  INVALID_TRANSITION: 'MICRO_VOLUNTEER_INVALID_TRANSITION',
  DUPLICATE_CLAIM: 'MICRO_VOLUNTEER_DUPLICATE_CLAIM',
  TASK_FULL: 'MICRO_VOLUNTEER_TASK_FULL',
  TASK_CLOSED: 'MICRO_VOLUNTEER_TASK_CLOSED',
  TASK_EXPIRED: 'MICRO_VOLUNTEER_TASK_EXPIRED',
  DUPLICATE_SUBMISSION: 'MICRO_VOLUNTEER_DUPLICATE_SUBMISSION',
  IDEMPOTENCY_CONFLICT: 'MICRO_VOLUNTEER_IDEMPOTENCY_CONFLICT',
  RATE_LIMITED: 'MICRO_VOLUNTEER_RATE_LIMITED',
  SPAM_BLOCKED: 'MICRO_VOLUNTEER_SPAM_BLOCKED',
  UNSUPPORTED_FILE: 'MICRO_VOLUNTEER_UNSUPPORTED_FILE',
  SELF_MODERATION: 'MICRO_VOLUNTEER_SELF_MODERATION',
  STORAGE_UNAVAILABLE: 'MICRO_VOLUNTEER_STORAGE_UNAVAILABLE',
  MIGRATION_FAILED: 'MICRO_VOLUNTEER_MIGRATION_FAILED',
});

export const MICRO_VOLUNTEER_ERROR_HELP = Object.freeze({
  [MICRO_VOLUNTEER_ERROR_CODES.VALIDATION_ERROR]:
    'Check the highlighted fields and try again. Nothing was saved.',
  [MICRO_VOLUNTEER_ERROR_CODES.UNAUTHENTICATED]:
    'Sign in to claim a task or submit completion evidence.',
  [MICRO_VOLUNTEER_ERROR_CODES.PERMISSION_DENIED]:
    'Your role cannot perform this action. Ask a moderator or administrator for help.',
  [MICRO_VOLUNTEER_ERROR_CODES.JURISDICTION_DENIED]:
    'This task belongs to a different ward or jurisdiction. Choose a task in your assigned area.',
  [MICRO_VOLUNTEER_ERROR_CODES.INVALID_TRANSITION]:
    'That status change is not allowed. Refresh the task and choose an available action.',
  [MICRO_VOLUNTEER_ERROR_CODES.DUPLICATE_CLAIM]:
    'You already have an active claim on this task. Open My activity to continue it.',
  [MICRO_VOLUNTEER_ERROR_CODES.TASK_FULL]:
    'Every place on this task is taken. Browse other open tasks or check back later.',
  [MICRO_VOLUNTEER_ERROR_CODES.TASK_CLOSED]:
    'This task is not accepting claims right now. Refresh the board to see its latest status.',
  [MICRO_VOLUNTEER_ERROR_CODES.TASK_EXPIRED]:
    'The due date has passed. A moderator must reopen the task before a new claim can be made.',
  [MICRO_VOLUNTEER_ERROR_CODES.DUPLICATE_SUBMISSION]:
    'This claim already has completion evidence waiting for moderation.',
  [MICRO_VOLUNTEER_ERROR_CODES.IDEMPOTENCY_CONFLICT]:
    'This retry key was already used with different evidence. Start a new submission instead of retrying.',
  [MICRO_VOLUNTEER_ERROR_CODES.RATE_LIMITED]:
    'Too many attempts in a short time. Wait a few minutes before trying again.',
  [MICRO_VOLUNTEER_ERROR_CODES.SPAM_BLOCKED]:
    'The evidence looks like repeated or unsafe content. A moderator must review it manually.',
  [MICRO_VOLUNTEER_ERROR_CODES.UNSUPPORTED_FILE]:
    'Use a JPEG, PNG, WebP or PDF file under 2 MB. File contents are never stored on the public board.',
  [MICRO_VOLUNTEER_ERROR_CODES.SELF_MODERATION]:
    'You cannot moderate your own claim. Ask another reviewer to decide it.',
  [MICRO_VOLUNTEER_ERROR_CODES.STORAGE_UNAVAILABLE]:
    'This device could not save the change. Keep the page open and try again, or use the downloadable backup.',
  [MICRO_VOLUNTEER_ERROR_CODES.MIGRATION_FAILED]:
    'The saved board could not be upgraded safely. Roll back or reset the local board from the admin panel.',
  [MICRO_VOLUNTEER_ERROR_CODES.NOT_FOUND]:
    'That task or claim no longer exists. Refresh the board and try again.',
});

export const TASK_STATUS_BADGE_TONE = Object.freeze({
  [TASK_STATUS.DRAFT]: 'neutral',
  [TASK_STATUS.OPEN]: 'success',
  [TASK_STATUS.ASSIGNED]: 'accent',
  [TASK_STATUS.AWAITING_REVIEW]: 'warning',
  [TASK_STATUS.COMPLETED]: 'success',
  [TASK_STATUS.REOPENED]: 'warning',
  [TASK_STATUS.ARCHIVED]: 'neutral',
});

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,120}$/;
const JURISDICTION_PATTERN = /^[A-Z0-9-]{2,40}$/;
const PUBLIC_REF_PATTERN = /^(?:MVT|MVC|MVS|MVE|REC)-[A-Z0-9-]{3,40}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
const PHONE_PATTERN = /(?<![\d])(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}(?![\d])/;
const AADHAAR_PATTERN = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/;
const PAN_PATTERN = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;
const DOOR_PATTERN =
  /\b(?:flat\s*(?:no\.?|#)?\s*[a-z0-9-]+|door\s*(?:no\.?|#)?\s*[a-z0-9/-]+|house\s*(?:no\.?|#)?\s*[a-z0-9/-]+)\b/i;
const CREDENTIAL_PATTERN = /\b(?:password|passwd|secret|api[_-]?key|auth[_-]?token|private[_-]?key|otp)\b/i;
const COORDINATE_PATTERN = /-?\d{1,3}\.\d{3,}\s*,\s*-?\d{1,3}\.\d{3,}/;

const PROHIBITED_TASK_PATTERNS = Object.freeze([
  {
    id: 'private_data',
    pattern:
      /\b(?:collect|verify|scan|upload|photograph|record)\b[\s\S]{0,50}\b(?:aadhaar|pan|voter|passport|phone|mobile|email|home address|residential address)\b/i,
    message: 'Tasks must not ask for identity documents, contact details or home addresses.',
  },
  {
    id: 'enforcement',
    pattern: /\b(?:enforce|evict|confront|detain|fine|penalise|penalize|seize|remove by force)\b/i,
    message: 'Tasks must not ask a volunteer to enforce a rule or confront a person.',
  },
  {
    id: 'unsafe_physical',
    pattern:
      /\b(?:climb|ladder|roof|electrical|traffic control|first aid|medical|heavy lifting|enter private property)\b/i,
    message: 'Tasks must not require unsafe physical activity, medical work or traffic control.',
  },
]);

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isText = (value) => typeof value === 'string';

export const isIsoDate = (value) => {
  if (!isText(value) || !ISO_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

export const isIsoDateTime = (value) =>
  isText(value) && !Number.isNaN(new Date(value).getTime());

export const isTaskCategory = (value) => TASK_CATEGORY_IDS.includes(value);
export const isTaskStatus = (value) => Object.values(TASK_STATUS).includes(value);
export const isClaimStatus = (value) => Object.values(CLAIM_STATUS).includes(value);
export const isCompletionStatus = (value) => Object.values(COMPLETION_STATUS).includes(value);
export const isModerationAction = (value) => Object.values(MODERATION_ACTIONS).includes(value);

export const isValidId = (value) =>
  isText(value) && (ID_PATTERN.test(value) || PUBLIC_REF_PATTERN.test(value));

export const isJurisdictionCode = (value) =>
  isText(value) && JURISDICTION_PATTERN.test(value.toUpperCase());

export const canTransition = (transitions, from, to) =>
  Boolean(transitions && Array.isArray(transitions[from]) && transitions[from].includes(to));

/**
 * Plain-language personal-data detection used on free text before it is stored.
 * It is deliberately conservative: it blocks the write and asks for a correction.
 */
export const findPersonalData = (text) => {
  if (!isText(text) || text.length === 0) return [];
  const findings = [];
  if (EMAIL_PATTERN.test(text)) findings.push('an email address');
  if (PHONE_PATTERN.test(text)) findings.push('a personal phone number');
  if (AADHAAR_PATTERN.test(text)) findings.push('an Aadhaar number');
  if (PAN_PATTERN.test(text)) findings.push('a PAN number');
  if (DOOR_PATTERN.test(text)) findings.push('an exact flat, door or house number');
  if (CREDENTIAL_PATTERN.test(text)) findings.push('a password, OTP or access token');
  if (COORDINATE_PATTERN.test(text)) findings.push('exact decimal coordinates');
  return findings;
};

export const findProhibitedTaskContent = (text) => {
  if (!isText(text) || text.length === 0) return [];
  return PROHIBITED_TASK_PATTERNS.filter((rule) => rule.pattern.test(text)).map((rule) => ({
    id: rule.id,
    message: rule.message,
  }));
};

export const isSafeHttpsUrl = (value) => {
  if (!isText(value) || value.length === 0 || value.length > MICRO_VOLUNTEER_LIMITS.MAX_EVIDENCE_LINK_LENGTH) {
    return false;
  }
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      Boolean(url.hostname) &&
      !/^(?:localhost|127\.|0\.0\.0\.0|\[::1\])/i.test(url.hostname)
    );
  } catch {
    return false;
  }
};

const push = (errors, field, message) => errors.push({ field, message });

export const validateIdempotencyKey = (key) => {
  if (!isText(key)) return 'An idempotency key is required for retry-safe actions.';
  const length = key.trim().length;
  if (
    length < MICRO_VOLUNTEER_LIMITS.MIN_IDEMPOTENCY_KEY_LENGTH ||
    length > MICRO_VOLUNTEER_LIMITS.MAX_IDEMPOTENCY_KEY_LENGTH
  ) {
    return `The idempotency key must be ${MICRO_VOLUNTEER_LIMITS.MIN_IDEMPOTENCY_KEY_LENGTH}–${MICRO_VOLUNTEER_LIMITS.MAX_IDEMPOTENCY_KEY_LENGTH} characters.`;
  }
  return '';
};

export const validateTaskInput = (input, { now = new Date() } = {}) => {
  const errors = [];
  if (!isObject(input)) {
    push(errors, '(task)', 'Task details must be an object.');
    return errors;
  }

  if (!isTaskCategory(input.categoryId)) {
    push(errors, 'categoryId', `Choose one of: ${TASK_CATEGORY_IDS.join(', ')}.`);
  }

  const title = isText(input.title) ? input.title.trim() : '';
  if (title.length < MICRO_VOLUNTEER_LIMITS.MIN_TITLE_LENGTH) {
    push(errors, 'title', `Title needs at least ${MICRO_VOLUNTEER_LIMITS.MIN_TITLE_LENGTH} characters.`);
  } else if (title.length > MICRO_VOLUNTEER_LIMITS.MAX_TITLE_LENGTH) {
    push(errors, 'title', `Title may be at most ${MICRO_VOLUNTEER_LIMITS.MAX_TITLE_LENGTH} characters.`);
  }

  const instructions = isText(input.instructions) ? input.instructions.trim() : '';
  if (instructions.length < MICRO_VOLUNTEER_LIMITS.MIN_INSTRUCTIONS_LENGTH) {
    push(
      errors,
      'instructions',
      `Instructions need at least ${MICRO_VOLUNTEER_LIMITS.MIN_INSTRUCTIONS_LENGTH} characters so the task is clear.`
    );
  } else if (instructions.length > MICRO_VOLUNTEER_LIMITS.MAX_INSTRUCTIONS_LENGTH) {
    push(
      errors,
      'instructions',
      `Instructions may be at most ${MICRO_VOLUNTEER_LIMITS.MAX_INSTRUCTIONS_LENGTH} characters.`
    );
  }

  if (!isJurisdictionCode(input.jurisdictionId)) {
    push(errors, 'jurisdictionId', 'Choose a ward or jurisdiction code such as WARD-042.');
  }

  const locality = isText(input.locality) ? input.locality.trim() : '';
  if (locality.length < 2 || locality.length > MICRO_VOLUNTEER_LIMITS.MAX_LOCALITY_LENGTH) {
    push(errors, 'locality', 'Use a coarse public locality name, not an exact address.');
  }

  const estimate = Number(input.timeEstimateMinutes);
  if (!Number.isInteger(estimate) || estimate < 5 || estimate > 240) {
    push(errors, 'timeEstimateMinutes', 'Time estimate must be a whole number between 5 and 240 minutes.');
  }

  if (!isIsoDate(input.dueDate)) {
    push(errors, 'dueDate', 'Choose a real due date in YYYY-MM-DD format.');
  } else {
    const due = new Date(`${input.dueDate}T23:59:59.999Z`);
    const today = new Date(now);
    today.setUTCHours(0, 0, 0, 0);
    const maxDue = new Date(today);
    maxDue.setUTCDate(maxDue.getUTCDate() + MICRO_VOLUNTEER_LIMITS.MAX_DUE_DAYS_AHEAD);
    if (due < today) push(errors, 'dueDate', 'The due date must be today or later.');
    if (due > maxDue) {
      push(
        errors,
        'dueDate',
        `The due date must be within ${MICRO_VOLUNTEER_LIMITS.MAX_DUE_DAYS_AHEAD} days.`
      );
    }
  }

  const capacity = Number(input.capacity ?? 1);
  if (
    !Number.isInteger(capacity) ||
    capacity < 1 ||
    capacity > MICRO_VOLUNTEER_LIMITS.MAX_TASK_CLAIMS_PER_TASK
  ) {
    push(
      errors,
      'capacity',
      `Places must be a whole number between 1 and ${MICRO_VOLUNTEER_LIMITS.MAX_TASK_CLAIMS_PER_TASK}.`
    );
  }

  const requirements = input.evidenceRequirements;
  if (!Array.isArray(requirements) || requirements.length === 0) {
    push(errors, 'evidenceRequirements', 'List at least one piece of completion evidence.');
  } else if (requirements.length > 6) {
    push(errors, 'evidenceRequirements', 'List no more than six evidence requirements.');
  } else if (requirements.some((item) => !isText(item) || item.trim().length < 3 || item.trim().length > 160)) {
    push(errors, 'evidenceRequirements', 'Each evidence requirement must be 3–160 characters.');
  }

  const acknowledgements = input.safetyAcknowledgements || {};
  SAFETY_ACKNOWLEDGEMENT_KEYS.forEach((key) => {
    if (acknowledgements[key] !== true) {
      push(errors, `safetyAcknowledgements.${key}`, SAFETY_ACKNOWLEDGEMENT_LABELS[key]);
    }
  });

  const combined = `${title} ${instructions} ${requirements?.join?.(' ') || ''}`;
  findPersonalData(combined).forEach((finding) => {
    push(errors, 'instructions', `Remove ${finding}; this is a public field.`);
  });
  findProhibitedTaskContent(combined).forEach((finding) => {
    push(errors, 'instructions', finding.message);
  });

  if (input.exactAddress || input.exactCoordinates) {
    push(errors, 'locality', 'Exact addresses and coordinates are not accepted on the public board.');
  }

  return errors;
};

export const validateEvidenceFile = (file, index = 0) => {
  const errors = [];
  const prefix = `evidenceFiles[${index}]`;
  if (!isObject(file)) {
    push(errors, prefix, 'File information must be an object.');
    return errors;
  }
  ['data', 'fileData', 'base64', 'content', 'buffer', 'documentData'].forEach((field) => {
    if (file[field] != null) {
      push(errors, prefix, 'File contents are not accepted; send name, type, size and hash metadata only.');
    }
  });
  if (!isText(file.name) || file.name.trim().length < 1 || file.name.trim().length > 120) {
    push(errors, `${prefix}.name`, 'File name must be 1–120 characters.');
  }
  if (!EVIDENCE_FILE_TYPES.includes(file.mimeType)) {
    push(errors, `${prefix}.mimeType`, `Allowed file types: ${EVIDENCE_FILE_TYPES.join(', ')}.`);
  }
  const size = Number(file.sizeBytes);
  if (
    !Number.isFinite(size) ||
    size <= 0 ||
    size > MICRO_VOLUNTEER_LIMITS.MAX_EVIDENCE_FILE_BYTES
  ) {
    push(
      errors,
      `${prefix}.sizeBytes`,
      `File size must be between 1 byte and ${MICRO_VOLUNTEER_LIMITS.MAX_EVIDENCE_FILE_BYTES / (1024 * 1024)} MB.`
    );
  }
  if (file.sha256 != null && !/^[a-f0-9]{64}$/i.test(String(file.sha256))) {
    push(errors, `${prefix}.sha256`, 'SHA-256 must be 64 hexadecimal characters when supplied.');
  }
  return errors;
};

export const validateEvidenceInput = (input) => {
  const errors = [];
  if (!isObject(input)) {
    push(errors, '(evidence)', 'Completion evidence must be an object.');
    return errors;
  }

  const note = isText(input.note) ? input.note.trim() : '';
  if (note.length < MICRO_VOLUNTEER_LIMITS.MIN_EVIDENCE_NOTE_LENGTH) {
    push(
      errors,
      'note',
      `Describe what you did in at least ${MICRO_VOLUNTEER_LIMITS.MIN_EVIDENCE_NOTE_LENGTH} characters.`
    );
  } else if (note.length > MICRO_VOLUNTEER_LIMITS.MAX_EVIDENCE_NOTE_LENGTH) {
    push(
      errors,
      'note',
      `Keep the note under ${MICRO_VOLUNTEER_LIMITS.MAX_EVIDENCE_NOTE_LENGTH} characters.`
    );
  }

  if (input.link && !isSafeHttpsUrl(input.link)) {
    push(errors, 'link', 'Evidence link must be a public https:// address.');
  }

  const files = input.files ?? [];
  if (!Array.isArray(files)) {
    push(errors, 'files', 'Files must be a list of metadata objects.');
  } else if (files.length > MICRO_VOLUNTEER_LIMITS.MAX_EVIDENCE_FILES) {
    push(
      errors,
      'files',
      `Attach at most ${MICRO_VOLUNTEER_LIMITS.MAX_EVIDENCE_FILES} file metadata records.`
    );
  } else {
    files.forEach((file, index) => {
      errors.push(...validateEvidenceFile(file, index));
    });
  }

  findPersonalData(`${note} ${input.link || ''}`).forEach((finding) => {
    push(errors, 'note', `Remove ${finding}; completion evidence is stored as a public-safe record.`);
  });

  return errors;
};

export const validateModerationInput = (input) => {
  const errors = [];
  if (!isObject(input)) {
    push(errors, '(moderation)', 'A moderation decision is required.');
    return errors;
  }
  if (!isModerationAction(input.decision)) {
    push(
      errors,
      'decision',
      `Choose one of: ${Object.values(MODERATION_ACTIONS).join(', ')}.`
    );
  }
  const reason = isText(input.reason) ? input.reason.trim() : '';
  if (
    input.decision &&
    input.decision !== MODERATION_ACTIONS.APPROVE &&
    reason.length < MICRO_VOLUNTEER_LIMITS.MIN_MODERATION_REASON_LENGTH
  ) {
    push(errors, 'reason', 'Explain the decision in at least 5 characters.');
  }
  if (reason.length > MICRO_VOLUNTEER_LIMITS.MAX_MODERATION_REASON_LENGTH) {
    push(errors, 'reason', `Reason may be at most ${MICRO_VOLUNTEER_LIMITS.MAX_MODERATION_REASON_LENGTH} characters.`);
  }
  const outcome = isText(input.publicOutcomeNote) ? input.publicOutcomeNote.trim() : '';
  if (outcome.length > MICRO_VOLUNTEER_LIMITS.MAX_PUBLIC_OUTCOME_LENGTH) {
    push(
      errors,
      'publicOutcomeNote',
      `Public outcome may be at most ${MICRO_VOLUNTEER_LIMITS.MAX_PUBLIC_OUTCOME_LENGTH} characters.`
    );
  }
  findPersonalData(`${reason} ${outcome}`).forEach((finding) => {
    push(errors, 'reason', `Remove ${finding}; moderation notes are retained without personal data.`);
  });
  return errors;
};

export const validatePagination = ({ page = 1, pageSize = MICRO_VOLUNTEER_LIMITS.DEFAULT_PAGE_SIZE } = {}) => {
  const safePage = Number.isInteger(Number(page)) && Number(page) > 0 ? Number(page) : 1;
  const requested = Number(pageSize);
  const safePageSize =
    Number.isInteger(requested) && requested > 0
      ? Math.min(requested, MICRO_VOLUNTEER_LIMITS.MAX_PAGE_SIZE)
      : MICRO_VOLUNTEER_LIMITS.DEFAULT_PAGE_SIZE;
  return { page: safePage, pageSize: safePageSize };
};

export const validatePreferenceInput = (input) => {
  const errors = [];
  if (!isObject(input)) {
    push(errors, '(preferences)', 'Suggestion preferences must be an object.');
    return errors;
  }
  const categories = input.categoryIds ?? [];
  if (!Array.isArray(categories) || categories.some((id) => !isTaskCategory(id))) {
    push(errors, 'categoryIds', `Choose categories from: ${TASK_CATEGORY_IDS.join(', ')}.`);
  }
  if (categories.length > TASK_CATEGORY_IDS.length) {
    push(errors, 'categoryIds', 'Choose no more categories than exist.');
  }
  if (input.jurisdictionId && !isJurisdictionCode(input.jurisdictionId)) {
    push(errors, 'jurisdictionId', 'Use a ward or jurisdiction code such as WARD-042.');
  }
  if (input.availableMinutes != null) {
    const minutes = Number(input.availableMinutes);
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 480) {
      push(errors, 'availableMinutes', 'Available time must be between 5 and 480 minutes.');
    }
  }
  return errors;
};

export const isoDateOnly = (date = new Date()) => {
  const value = date instanceof Date ? date : new Date(date);
  return value.toISOString().slice(0, 10);
};

export const isTaskAcceptingClaims = (task, { now = new Date() } = {}) => {
  if (!task || !isTaskStatus(task.status)) return false;
  if (![TASK_STATUS.OPEN, TASK_STATUS.ASSIGNED, TASK_STATUS.REOPENED].includes(task.status)) {
    return false;
  }
  return isoDateOnly(now) <= task.dueDate;
};

export const maskActorRef = (actorId) => {
  const clean = isText(actorId) ? actorId.replace(/[^A-Za-z0-9]/g, '') : '';
  if (clean.length <= 4) return 'contributor';
  return `contributor-${clean.slice(-4).toLowerCase()}`;
};

/**
 * Deterministic, explainable scoring. There is no opaque volunteer score and no
 * public ranking: the result is shown only to the signed-in contributor.
 */
export const buildTaskRecommendations = (
  tasks = [],
  preferences = {},
  { now = new Date(), rulesetVersion = MICRO_VOLUNTEER_RULESET_VERSION } = {}
) => {
  const categoryIds = new Set(preferences.categoryIds || []);
  const jurisdictionId = preferences.jurisdictionId ? String(preferences.jurisdictionId).toUpperCase() : '';
  const availableMinutes = Number.isFinite(Number(preferences.availableMinutes))
    ? Number(preferences.availableMinutes)
    : null;
  const today = isoDateOnly(now);
  const dueSoonCutoff = new Date(now);
  dueSoonCutoff.setUTCDate(dueSoonCutoff.getUTCDate() + 7);
  const dueSoon = isoDateOnly(dueSoonCutoff);

  const recommendations = tasks
    .filter((task) => isTaskAcceptingClaims(task, { now }))
    .map((task) => {
      const reasons = [];
      let score = 0;

      if (categoryIds.size === 0 || categoryIds.has(task.categoryId)) {
        const points = categoryIds.size === 0 ? 1 : 4;
        score += points;
        reasons.push({
          code: 'category_match',
          label:
            categoryIds.size === 0
              ? 'You have not limited suggestions by category.'
              : `Category matches your interest: ${TASK_CATEGORY_LABELS[task.categoryId] || task.categoryId}.`,
          points,
          fields: ['categoryId'],
        });
      } else {
        reasons.push({
          code: 'category_not_selected',
          label: `Category is outside your selected interests: ${TASK_CATEGORY_LABELS[task.categoryId] || task.categoryId}.`,
          points: 0,
          fields: ['categoryId'],
        });
      }

      if (jurisdictionId && task.jurisdictionId === jurisdictionId) {
        score += 2;
        reasons.push({
          code: 'same_jurisdiction',
          label: `Task is in your selected jurisdiction (${task.jurisdictionId}).`,
          points: 2,
          fields: ['jurisdictionId'],
        });
      } else if (jurisdictionId) {
        reasons.push({
          code: 'different_jurisdiction',
          label: `Task is in ${task.jurisdictionId}, not your selected ${jurisdictionId}.`,
          points: 0,
          fields: ['jurisdictionId'],
        });
      }

      if (availableMinutes != null) {
        if (Number(task.timeEstimateMinutes) <= availableMinutes) {
          score += 2;
          reasons.push({
            code: 'fits_time',
            label: `Estimated ${task.timeEstimateMinutes} minutes fits your ${availableMinutes}-minute window.`,
            points: 2,
            fields: ['timeEstimateMinutes', 'availableMinutes'],
          });
        } else {
          reasons.push({
            code: 'exceeds_time',
            label: `Estimated ${task.timeEstimateMinutes} minutes is longer than your ${availableMinutes}-minute window.`,
            points: 0,
            fields: ['timeEstimateMinutes', 'availableMinutes'],
          });
        }
      }

      if (task.dueDate <= dueSoon && task.dueDate >= today) {
        score += 1;
        reasons.push({
          code: 'due_soon',
          label: `Due soon (${task.dueDate}).`,
          points: 1,
          fields: ['dueDate'],
        });
      }

      if (task.status === TASK_STATUS.REOPENED) {
        score += 1;
        reasons.push({
          code: 'reopened',
          label: 'A moderator reopened this task because a previous attempt was incomplete.',
          points: 1,
          fields: ['status'],
        });
      }

      return {
        taskId: task.id,
        taskPublicRef: task.publicRef,
        title: task.title,
        categoryId: task.categoryId,
        jurisdictionId: task.jurisdictionId,
        timeEstimateMinutes: task.timeEstimateMinutes,
        dueDate: task.dueDate,
        status: task.status,
        score,
        reasons,
        statusOfSuggestion: RECOMMENDATION_STATUS.PENDING,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      return String(a.taskPublicRef).localeCompare(String(b.taskPublicRef));
    });

  return {
    rulesetVersion,
    generatedAt: now.toISOString(),
    inputWindow: {
      evaluatedAt: now.toISOString(),
      dueOnOrAfter: today,
      dueSoonThrough: dueSoon,
      categoryIds: [...categoryIds],
      jurisdictionId: jurisdictionId || null,
      availableMinutes,
    },
    sourceFields: [
      'tasks.status',
      'tasks.dueDate',
      'tasks.categoryId',
      'tasks.jurisdictionId',
      'tasks.timeEstimateMinutes',
    ],
    recommendations,
  };
};
