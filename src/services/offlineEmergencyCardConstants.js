/**
 * Offline Emergency Civic Information Card with Verified Local Contacts (#761).
 *
 * Domain constants shared by the trusted service boundary, the persistence layer
 * and the presentation components. The UI never invents a status, category or
 * transition: it imports these values and asks the service to perform actions.
 *
 * Safety rule: emergency numbers are never generated. A contact can only be
 * published after an operator links it to an official source and a reviewer
 * records a manual verification.
 */

export const OFFLINE_CARD_SCHEMA_VERSION = 1;
export const OFFLINE_CARD_RULESET_VERSION = 'emergency-card-review-rules-2026.1';
export const OFFLINE_CARD_EXPORT_SCHEMA_VERSION = 'offline-emergency-card-export/v1';

/** One atomic bundle keeps multi-collection writes transactional in browser storage. */
export const OFFLINE_CARD_STORAGE_KEY = 'civic_offline_emergency_card_v1';
export const OFFLINE_CARD_BACKUP_KEY = 'civic_offline_emergency_card_v1_backup';

export const OFFLINE_CARD_ROLES = Object.freeze({
  PUBLIC: 'public',
  CITIZEN: 'citizen',
  OPERATOR: 'operator',
  REVIEWER: 'reviewer',
  ADMIN: 'admin',
});

export const STAFF_OFFLINE_CARD_ROLES = Object.freeze([
  OFFLINE_CARD_ROLES.OPERATOR,
  OFFLINE_CARD_ROLES.REVIEWER,
  OFFLINE_CARD_ROLES.ADMIN,
]);

export const OFFLINE_CARD_JURISDICTIONS = Object.freeze([
  {
    id: 'NATIONAL',
    name: 'All India',
    state: 'India',
    type: 'national',
    description: 'National public emergency helplines that work across every State and Union Territory.',
  },
  {
    id: 'LKO',
    name: 'Lucknow',
    state: 'Uttar Pradesh',
    type: 'district',
    description: 'Verified public emergency and civic service contacts for Lucknow district.',
  },
]);

export const OFFLINE_CARD_CATEGORIES = Object.freeze({
  EMERGENCY: 'emergency',
  POLICE: 'police',
  FIRE: 'fire',
  MEDICAL: 'medical',
  DISASTER: 'disaster',
  WOMEN: 'women',
  CHILD: 'child',
  SENIOR: 'senior',
  CYBER: 'cyber',
  MENTAL_HEALTH: 'mental_health',
  ANTI_CORRUPTION: 'anti_corruption',
  MUNICIPAL: 'municipal',
  UTILITY: 'utility',
  OTHER: 'other',
});

export const OFFLINE_CARD_CATEGORY_LABELS = Object.freeze({
  [OFFLINE_CARD_CATEGORIES.EMERGENCY]: 'All-in-one emergency',
  [OFFLINE_CARD_CATEGORIES.POLICE]: 'Police',
  [OFFLINE_CARD_CATEGORIES.FIRE]: 'Fire and rescue',
  [OFFLINE_CARD_CATEGORIES.MEDICAL]: 'Medical and ambulance',
  [OFFLINE_CARD_CATEGORIES.DISASTER]: 'Disaster response',
  [OFFLINE_CARD_CATEGORIES.WOMEN]: 'Women safety',
  [OFFLINE_CARD_CATEGORIES.CHILD]: 'Child protection',
  [OFFLINE_CARD_CATEGORIES.SENIOR]: 'Senior citizens',
  [OFFLINE_CARD_CATEGORIES.CYBER]: 'Cyber and financial fraud',
  [OFFLINE_CARD_CATEGORIES.MENTAL_HEALTH]: 'Mental health support',
  [OFFLINE_CARD_CATEGORIES.ANTI_CORRUPTION]: 'Anti-corruption',
  [OFFLINE_CARD_CATEGORIES.MUNICIPAL]: 'Municipal services',
  [OFFLINE_CARD_CATEGORIES.UTILITY]: 'Water, power and utilities',
  [OFFLINE_CARD_CATEGORIES.OTHER]: 'Other public service',
});

/** Categories a complete local card should cover. Missing categories become review recommendations. */
export const CRITICAL_CARD_CATEGORIES = Object.freeze([
  OFFLINE_CARD_CATEGORIES.EMERGENCY,
  OFFLINE_CARD_CATEGORIES.POLICE,
  OFFLINE_CARD_CATEGORIES.FIRE,
  OFFLINE_CARD_CATEGORIES.MEDICAL,
  OFFLINE_CARD_CATEGORIES.DISASTER,
]);

export const CONTACT_SOURCE_TYPES = Object.freeze({
  OFFICIAL_PORTAL: 'official_portal',
  GOVERNMENT_GAZETTE: 'government_gazette',
  OFFICIAL_DIRECTORY: 'official_directory',
  HELPLINE_PAGE: 'helpline_page',
  DISTRICT_WEBSITE: 'district_website',
});

export const CONTACT_SOURCE_TYPE_LABELS = Object.freeze({
  [CONTACT_SOURCE_TYPES.OFFICIAL_PORTAL]: 'Official government portal',
  [CONTACT_SOURCE_TYPES.GOVERNMENT_GAZETTE]: 'Government gazette or notification',
  [CONTACT_SOURCE_TYPES.OFFICIAL_DIRECTORY]: 'Official directory',
  [CONTACT_SOURCE_TYPES.HELPLINE_PAGE]: 'Official helpline page',
  [CONTACT_SOURCE_TYPES.DISTRICT_WEBSITE]: 'District administration website',
});

export const SOURCE_STATUS = Object.freeze({
  ACTIVE: 'active',
  ARCHIVED: 'archived',
});

export const CONTACT_STATUS = Object.freeze({
  DRAFT: 'draft',
  PENDING_REVIEW: 'pending_review',
  CHANGES_REQUESTED: 'changes_requested',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
});

export const CONTACT_STATUS_LABELS = Object.freeze({
  [CONTACT_STATUS.DRAFT]: 'Draft — not visible on the public card',
  [CONTACT_STATUS.PENDING_REVIEW]: 'Awaiting manual verification',
  [CONTACT_STATUS.CHANGES_REQUESTED]: 'Changes requested — correct and resubmit',
  [CONTACT_STATUS.PUBLISHED]: 'Published — shown on the public card',
  [CONTACT_STATUS.ARCHIVED]: 'Archived — hidden from the public card',
});

export const CONTACT_TRANSITIONS = Object.freeze({
  [CONTACT_STATUS.DRAFT]: [CONTACT_STATUS.PENDING_REVIEW, CONTACT_STATUS.ARCHIVED],
  [CONTACT_STATUS.PENDING_REVIEW]: [
    CONTACT_STATUS.PUBLISHED,
    CONTACT_STATUS.CHANGES_REQUESTED,
    CONTACT_STATUS.ARCHIVED,
  ],
  [CONTACT_STATUS.CHANGES_REQUESTED]: [CONTACT_STATUS.PENDING_REVIEW, CONTACT_STATUS.ARCHIVED],
  [CONTACT_STATUS.PUBLISHED]: [CONTACT_STATUS.PENDING_REVIEW, CONTACT_STATUS.ARCHIVED],
  [CONTACT_STATUS.ARCHIVED]: [CONTACT_STATUS.DRAFT],
});

export const CONTACT_ACTION = Object.freeze({
  SUBMIT: 'submit',
  APPROVE: 'approve',
  REQUEST_CHANGES: 'request_changes',
  ARCHIVE: 'archive',
  RESTORE: 'restore',
});

export const CONTACT_ACTION_LABELS = Object.freeze({
  [CONTACT_ACTION.SUBMIT]: 'Submit for verification',
  [CONTACT_ACTION.APPROVE]: 'Verify and publish',
  [CONTACT_ACTION.REQUEST_CHANGES]: 'Request changes',
  [CONTACT_ACTION.ARCHIVE]: 'Archive contact',
  [CONTACT_ACTION.RESTORE]: 'Restore as draft',
});

/** Actions that must record a written reason in the append-only audit trail. */
export const REASON_REQUIRED_ACTIONS = Object.freeze([
  CONTACT_ACTION.REQUEST_CHANGES,
  CONTACT_ACTION.ARCHIVE,
  CONTACT_ACTION.RESTORE,
]);

export const CONTACT_FRESHNESS = Object.freeze({
  FRESH: 'fresh',
  REVIEW_DUE: 'review_due',
  STALE: 'stale',
  UNVERIFIED: 'unverified',
});

export const CONTACT_FRESHNESS_LABELS = Object.freeze({
  [CONTACT_FRESHNESS.FRESH]: 'Recently verified',
  [CONTACT_FRESHNESS.REVIEW_DUE]: 'Review due soon',
  [CONTACT_FRESHNESS.STALE]: 'Outdated — verify before relying on it',
  [CONTACT_FRESHNESS.UNVERIFIED]: 'Not verified',
});

/** Contacts older than this need a fresh manual check. */
export const CONTACT_REVIEW_INTERVAL_DAYS = 180;
/** Contacts older than this are clearly marked outdated on the card. */
export const CONTACT_STALE_AFTER_DAYS = 365;
/** A saved card older than this is flagged for a refresh. */
export const CARD_REFRESH_AFTER_DAYS = 30;
/** A saved card older than this is marked expired. */
export const CARD_EXPIRY_AFTER_DAYS = 180;

export const RECOMMENDATION_STATUS = Object.freeze({
  PENDING: 'pending',
  EDITED: 'edited',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
});

export const RECOMMENDATION_STATUS_LABELS = Object.freeze({
  [RECOMMENDATION_STATUS.PENDING]: 'Awaiting human decision',
  [RECOMMENDATION_STATUS.EDITED]: 'Edited — still awaiting a decision',
  [RECOMMENDATION_STATUS.ACCEPTED]: 'Accepted — review task acknowledged',
  [RECOMMENDATION_STATUS.REJECTED]: 'Rejected with a recorded reason',
});

export const RECOMMENDATION_TRANSITIONS = Object.freeze({
  [RECOMMENDATION_STATUS.PENDING]: [
    RECOMMENDATION_STATUS.EDITED,
    RECOMMENDATION_STATUS.ACCEPTED,
    RECOMMENDATION_STATUS.REJECTED,
  ],
  [RECOMMENDATION_STATUS.EDITED]: [
    RECOMMENDATION_STATUS.ACCEPTED,
    RECOMMENDATION_STATUS.REJECTED,
  ],
  [RECOMMENDATION_STATUS.ACCEPTED]: [],
  [RECOMMENDATION_STATUS.REJECTED]: [],
});

export const RECOMMENDATION_RULES = Object.freeze({
  REVIEW_DUE: 'contact_review_due',
  STALE: 'contact_stale',
  SOURCE_OLD: 'source_retrieval_old',
  CATEGORY_GAP: 'jurisdiction_category_gap',
});

export const RECOMMENDATION_RULE_LABELS = Object.freeze({
  [RECOMMENDATION_RULES.REVIEW_DUE]: 'Manual re-verification is due',
  [RECOMMENDATION_RULES.STALE]: 'Published contact is outdated',
  [RECOMMENDATION_RULES.SOURCE_OLD]: 'Official source has not been re-checked',
  [RECOMMENDATION_RULES.CATEGORY_GAP]: 'Critical category has no verified local contact',
});

export const SYNC_EVENT_TYPE = Object.freeze({
  INSTALL: 'install',
  REFRESH: 'refresh',
  NO_CHANGE: 'no_change',
  PREFERENCES: 'preferences',
  OFFLINE_OPEN: 'offline_open',
  EXPORT: 'export',
  DELETE: 'delete',
  CONFLICT: 'conflict',
});

export const SYNC_EVENT_STATUS = Object.freeze({
  SUCCESS: 'success',
  FAILED: 'failed',
  CONFLICT: 'conflict',
  SKIPPED: 'skipped',
});

export const OFFLINE_CARD_ERROR_CODES = Object.freeze({
  NOT_FOUND: 'OFFLINE_CARD_NOT_FOUND',
  VALIDATION_ERROR: 'OFFLINE_CARD_VALIDATION_ERROR',
  PERMISSION_DENIED: 'OFFLINE_CARD_PERMISSION_DENIED',
  UNAUTHENTICATED: 'OFFLINE_CARD_UNAUTHENTICATED',
  JURISDICTION_DENIED: 'OFFLINE_CARD_JURISDICTION_DENIED',
  INVALID_STATE_TRANSITION: 'OFFLINE_CARD_INVALID_STATE_TRANSITION',
  VERSION_CONFLICT: 'OFFLINE_CARD_VERSION_CONFLICT',
  IDEMPOTENCY_CONFLICT: 'OFFLINE_CARD_IDEMPOTENCY_CONFLICT',
  RATE_LIMITED: 'OFFLINE_CARD_RATE_LIMITED',
  STALE_DATA: 'OFFLINE_CARD_STALE_DATA',
  OFFLINE: 'OFFLINE_CARD_OFFLINE',
  STORAGE_UNAVAILABLE: 'OFFLINE_CARD_STORAGE_UNAVAILABLE',
  CARD_TOO_LARGE: 'OFFLINE_CARD_TOO_LARGE',
  SENSITIVE_CONTENT: 'OFFLINE_CARD_SENSITIVE_CONTENT',
  MIGRATION_FAILED: 'OFFLINE_CARD_MIGRATION_FAILED',
  UNSUPPORTED_FILE: 'OFFLINE_CARD_UNSUPPORTED_FILE',
});

/** Plain-language guidance keyed by stable error code. The UI translates, never guesses. */
export const OFFLINE_CARD_ERROR_HELP = Object.freeze({
  [OFFLINE_CARD_ERROR_CODES.NOT_FOUND]:
    'The record could not be found. It may have been archived or removed on another device. Refresh and try again.',
  [OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR]:
    'Some details are missing or invalid. Check the highlighted fields and save again.',
  [OFFLINE_CARD_ERROR_CODES.PERMISSION_DENIED]:
    'Your role does not allow this action. Ask a municipal administrator for the correct access.',
  [OFFLINE_CARD_ERROR_CODES.UNAUTHENTICATED]:
    'Sign in with an operator, reviewer or administrator account to manage verified contacts.',
  [OFFLINE_CARD_ERROR_CODES.JURISDICTION_DENIED]:
    'This record belongs to a jurisdiction outside your assigned scope.',
  [OFFLINE_CARD_ERROR_CODES.INVALID_STATE_TRANSITION]:
    'This contact has already moved to another state. Reload it to see the available actions.',
  [OFFLINE_CARD_ERROR_CODES.VERSION_CONFLICT]:
    'Someone else changed this contact after you opened it. Reload the latest version before saving so their update is not overwritten.',
  [OFFLINE_CARD_ERROR_CODES.IDEMPOTENCY_CONFLICT]:
    'This retry key was already used for a different request. Start a new action instead of retrying the old one.',
  [OFFLINE_CARD_ERROR_CODES.RATE_LIMITED]:
    'Too many changes were attempted in a short time. Wait a few minutes and try again.',
  [OFFLINE_CARD_ERROR_CODES.STALE_DATA]:
    'The information is older than the review interval. Refresh it online and check the official source before relying on it.',
  [OFFLINE_CARD_ERROR_CODES.OFFLINE]:
    'You are offline. The saved card still works, but records cannot be refreshed until the connection returns.',
  [OFFLINE_CARD_ERROR_CODES.STORAGE_UNAVAILABLE]:
    'This browser could not save the card to device storage. The card stays available for this visit only. Free some space or allow local storage, then install again.',
  [OFFLINE_CARD_ERROR_CODES.CARD_TOO_LARGE]:
    'The selected contacts exceed the safe offline card size. Select fewer contacts and try again.',
  [OFFLINE_CARD_ERROR_CODES.SENSITIVE_CONTENT]:
    'Personal notes must not contain Aadhaar, medical records, credentials or personal phone numbers. Remove that information and save again.',
  [OFFLINE_CARD_ERROR_CODES.MIGRATION_FAILED]:
    'The saved card data could not be upgraded safely. The previous data was kept. Export a copy and contact support.',
  [OFFLINE_CARD_ERROR_CODES.UNSUPPORTED_FILE]:
    'Only source metadata is accepted. Do not upload documents, identity papers or screenshots.',
});

export const OFFLINE_CARD_CAPABILITIES = Object.freeze({
  'card.view_public': {
    roles: [
      OFFLINE_CARD_ROLES.PUBLIC,
      OFFLINE_CARD_ROLES.CITIZEN,
      OFFLINE_CARD_ROLES.OPERATOR,
      OFFLINE_CARD_ROLES.REVIEWER,
      OFFLINE_CARD_ROLES.ADMIN,
    ],
    description: 'Read the approved public emergency card',
  },
  'card.install': {
    roles: [
      OFFLINE_CARD_ROLES.PUBLIC,
      OFFLINE_CARD_ROLES.CITIZEN,
      OFFLINE_CARD_ROLES.OPERATOR,
      OFFLINE_CARD_ROLES.REVIEWER,
      OFFLINE_CARD_ROLES.ADMIN,
    ],
    description: 'Install or replace the card saved on this device',
  },
  'card.refresh': {
    roles: [
      OFFLINE_CARD_ROLES.PUBLIC,
      OFFLINE_CARD_ROLES.CITIZEN,
      OFFLINE_CARD_ROLES.OPERATOR,
      OFFLINE_CARD_ROLES.REVIEWER,
      OFFLINE_CARD_ROLES.ADMIN,
    ],
    description: 'Refresh the saved card from approved records',
  },
  'preferences.write': {
    roles: [
      OFFLINE_CARD_ROLES.PUBLIC,
      OFFLINE_CARD_ROLES.CITIZEN,
      OFFLINE_CARD_ROLES.OPERATOR,
      OFFLINE_CARD_ROLES.REVIEWER,
      OFFLINE_CARD_ROLES.ADMIN,
    ],
    description: 'Save card preferences and a non-sensitive personal note on this device',
  },
  'card.delete': {
    roles: [
      OFFLINE_CARD_ROLES.PUBLIC,
      OFFLINE_CARD_ROLES.CITIZEN,
      OFFLINE_CARD_ROLES.OPERATOR,
      OFFLINE_CARD_ROLES.REVIEWER,
      OFFLINE_CARD_ROLES.ADMIN,
    ],
    description: 'Delete the card and preferences saved on this device',
  },
  'contact.read_staff': {
    roles: [
      OFFLINE_CARD_ROLES.OPERATOR,
      OFFLINE_CARD_ROLES.REVIEWER,
      OFFLINE_CARD_ROLES.ADMIN,
    ],
    description: 'Read draft, review and archived contact records',
  },
  'contact.create': {
    roles: [OFFLINE_CARD_ROLES.OPERATOR, OFFLINE_CARD_ROLES.ADMIN],
    description: 'Create a draft contact backed by an official source',
  },
  'contact.update': {
    roles: [OFFLINE_CARD_ROLES.OPERATOR, OFFLINE_CARD_ROLES.ADMIN],
    description: 'Edit a draft or returned contact and submit a revision',
  },
  'contact.submit': {
    roles: [OFFLINE_CARD_ROLES.OPERATOR, OFFLINE_CARD_ROLES.ADMIN],
    description: 'Submit a draft or corrected contact for manual verification',
  },
  'contact.review': {
    roles: [OFFLINE_CARD_ROLES.REVIEWER, OFFLINE_CARD_ROLES.ADMIN],
    description: 'Verify, publish, return or archive a contact',
  },
  'contact.restore': {
    roles: [OFFLINE_CARD_ROLES.ADMIN],
    description: 'Restore an archived contact as a draft',
  },
  'source.read_staff': {
    roles: [
      OFFLINE_CARD_ROLES.OPERATOR,
      OFFLINE_CARD_ROLES.REVIEWER,
      OFFLINE_CARD_ROLES.ADMIN,
    ],
    description: 'Read official contact sources',
  },
  'source.manage': {
    roles: [OFFLINE_CARD_ROLES.OPERATOR, OFFLINE_CARD_ROLES.ADMIN],
    description: 'Add, update or archive an official contact source',
  },
  'recommendation.generate': {
    roles: [OFFLINE_CARD_ROLES.REVIEWER, OFFLINE_CARD_ROLES.ADMIN],
    description: 'Generate deterministic review recommendations',
  },
  'recommendation.decide': {
    roles: [OFFLINE_CARD_ROLES.REVIEWER, OFFLINE_CARD_ROLES.ADMIN],
    description: 'Accept, edit or reject a review recommendation',
  },
  'audit.read': {
    roles: [OFFLINE_CARD_ROLES.REVIEWER, OFFLINE_CARD_ROLES.ADMIN],
    description: 'Read the append-only card audit trail',
  },
  'migration.run': {
    roles: [OFFLINE_CARD_ROLES.ADMIN],
    description: 'Roll back or reset the local card store',
  },
  'retention.run': {
    roles: [OFFLINE_CARD_ROLES.ADMIN],
    description: 'Apply the documented retention policy',
  },
});

export const OFFLINE_CARD_LIMITS = Object.freeze({
  MAX_CONTACTS_PER_CARD: 100,
  MAX_SELECTED_CONTACTS: 100,
  MAX_NOTE_LENGTH: 500,
  MAX_NAME_LENGTH: 120,
  MAX_ORGANIZATION_LENGTH: 160,
  MAX_DESCRIPTION_LENGTH: 600,
  MAX_ADDRESS_LENGTH: 240,
  MAX_REASON_LENGTH: 500,
  MAX_URL_LENGTH: 500,
  MAX_LANGUAGES: 6,
  MAX_LANGUAGE_LENGTH: 40,
  MAX_PAGE_SIZE: 50,
  DEFAULT_PAGE_SIZE: 20,
  MAX_SNAPSHOT_BYTES: 192 * 1024,
  SYNC_WINDOW_MS: 10 * 60 * 1000,
  MAX_SYNC_ACTIONS_PER_WINDOW: 12,
  SYNC_EVENT_RETENTION_DAYS: 180,
  PREFERENCE_RETENTION_DAYS: 365,
  AUDIT_RETENTION_DAYS: 730,
  ARCHIVED_CONTACT_RETENTION_DAYS: 1095,
});

export const OFFLINE_CARD_RETENTION = Object.freeze({
  syncEventsDays: OFFLINE_CARD_LIMITS.SYNC_EVENT_RETENTION_DAYS,
  inactivePreferencesDays: OFFLINE_CARD_LIMITS.PREFERENCE_RETENTION_DAYS,
  auditEventsDays: OFFLINE_CARD_LIMITS.AUDIT_RETENTION_DAYS,
  archivedContactsDays: OFFLINE_CARD_LIMITS.ARCHIVED_CONTACT_RETENTION_DAYS,
  publishedContacts:
    'Published emergency contacts are retained indefinitely; outdated records stay visible with an explicit warning instead of disappearing.',
  personalNotes:
    'Personal notes stay on this device only and are removed immediately when the user deletes the card.',
});

export const OFFLINE_CARD_METHODOLOGY_NOTE =
  'Emergency numbers are never generated by AI. Every published contact links to an official source and carries the date a human last verified it. Automated review suggestions use deterministic rules, are versioned, and never change a contact without a reviewer decision.';

export const OFFLINE_CARD_SYNC_ACTIONS = Object.freeze([
  'install',
  'refresh',
  'preferences',
  'export',
  'delete',
]);

export const OFFLINE_CARD_ACCESSIBILITY_NOTE =
  'This card is designed for keyboard-only use, screen readers and narrow mobile screens. Status is written in text as well as colour. A table view is available for every contact list.';
