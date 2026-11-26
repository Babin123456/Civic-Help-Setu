/**
 * Municipal Greenhouse-Gas Inventory & Emissions Reporting Constants (#753).
 *
 * Enums, domain state machines, capability mappings, error codes and limits.
 * The UI and the service layer import these values instead of duplicating strings,
 * so an invalid state or unit is rejected by the trusted boundary rather than the screen.
 */

export const GHG_SCHEMA_VERSION = 1;

/** One atomic bundle keeps multi-collection writes transactional in browser storage. */
export const GHG_STORAGE_KEYS = Object.freeze({
  BUNDLE: 'civic_ghg_inventory_v1',
});

export const GHG_METHODOLOGY_VERSION = 'ghg-methodology-2026.1';
export const GHG_RULESET_VERSION = 'ghg-forecast-rules-2026.1';
export const GHG_ROUNDING_DECIMALS = 4;

export const GHG_ROLES = Object.freeze({
  PUBLIC: 'public',
  CITIZEN: 'citizen',
  OPERATOR: 'operator',
  REVIEWER: 'reviewer',
  ADMIN: 'admin',
});

export const STAFF_GHG_ROLES = Object.freeze([
  GHG_ROLES.OPERATOR,
  GHG_ROLES.REVIEWER,
  GHG_ROLES.ADMIN,
]);

export const EMISSION_CATEGORIES = Object.freeze({
  PUBLIC_BUILDING_ENERGY: 'public_building_energy',
  FLEET_FUEL: 'fleet_fuel',
  STREET_LIGHTING: 'street_lighting',
  WASTE_OPERATIONS: 'waste_operations',
});

export const EMISSION_CATEGORY_LABELS = Object.freeze({
  [EMISSION_CATEGORIES.PUBLIC_BUILDING_ENERGY]: 'Public building energy',
  [EMISSION_CATEGORIES.FLEET_FUEL]: 'Fleet fuel',
  [EMISSION_CATEGORIES.STREET_LIGHTING]: 'Street lighting',
  [EMISSION_CATEGORIES.WASTE_OPERATIONS]: 'Waste operations',
});

export const EMISSION_CATEGORY_ICONS = Object.freeze({
  [EMISSION_CATEGORIES.PUBLIC_BUILDING_ENERGY]: 'building',
  [EMISSION_CATEGORIES.FLEET_FUEL]: 'truck',
  [EMISSION_CATEGORIES.STREET_LIGHTING]: 'lightbulb',
  [EMISSION_CATEGORIES.WASTE_OPERATIONS]: 'recycle',
});

export const DATA_QUALITY = Object.freeze({
  MEASURED: 'measured',
  ESTIMATED: 'estimated',
  EXCLUDED: 'excluded',
});

export const DATA_QUALITY_LABELS = Object.freeze({
  [DATA_QUALITY.MEASURED]: 'Measured (meter or invoice)',
  [DATA_QUALITY.ESTIMATED]: 'Estimated (labelled, not measured)',
  [DATA_QUALITY.EXCLUDED]: 'Excluded (outside inventory boundary)',
});

export const GHG_SCOPES = Object.freeze({
  SCOPE_1: 'scope_1',
  SCOPE_2: 'scope_2',
  SCOPE_3: 'scope_3',
});

export const GHG_SCOPE_LABELS = Object.freeze({
  [GHG_SCOPES.SCOPE_1]: 'Scope 1 — direct emissions',
  [GHG_SCOPES.SCOPE_2]: 'Scope 2 — purchased energy',
  [GHG_SCOPES.SCOPE_3]: 'Scope 3 — value-chain emissions',
});

export const SOURCE_STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ARCHIVED: 'archived',
});

export const SUBMISSION_STATUS = Object.freeze({
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'under_review',
  CHANGES_REQUESTED: 'changes_requested',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  LOCKED: 'locked',
});

export const SUBMISSION_STATUS_LABELS = Object.freeze({
  [SUBMISSION_STATUS.DRAFT]: 'Draft — department still editing',
  [SUBMISSION_STATUS.SUBMITTED]: 'Submitted — waiting for reviewer',
  [SUBMISSION_STATUS.UNDER_REVIEW]: 'Under review',
  [SUBMISSION_STATUS.CHANGES_REQUESTED]: 'Changes requested — department must correct',
  [SUBMISSION_STATUS.APPROVED]: 'Approved — eligible for totals',
  [SUBMISSION_STATUS.REJECTED]: 'Rejected — reason recorded',
  [SUBMISSION_STATUS.LOCKED]: 'Locked — retained for audit',
});

export const SUBMISSION_TRANSITIONS = Object.freeze({
  [SUBMISSION_STATUS.DRAFT]: [SUBMISSION_STATUS.SUBMITTED],
  [SUBMISSION_STATUS.SUBMITTED]: [
    SUBMISSION_STATUS.UNDER_REVIEW,
    SUBMISSION_STATUS.CHANGES_REQUESTED,
    SUBMISSION_STATUS.REJECTED,
  ],
  [SUBMISSION_STATUS.UNDER_REVIEW]: [
    SUBMISSION_STATUS.APPROVED,
    SUBMISSION_STATUS.CHANGES_REQUESTED,
    SUBMISSION_STATUS.REJECTED,
  ],
  [SUBMISSION_STATUS.CHANGES_REQUESTED]: [SUBMISSION_STATUS.SUBMITTED, SUBMISSION_STATUS.DRAFT],
  [SUBMISSION_STATUS.APPROVED]: [SUBMISSION_STATUS.CHANGES_REQUESTED, SUBMISSION_STATUS.LOCKED],
  [SUBMISSION_STATUS.REJECTED]: [SUBMISSION_STATUS.DRAFT],
  [SUBMISSION_STATUS.LOCKED]: [],
});

export const PERIOD_STATUS = Object.freeze({
  DRAFT: 'draft',
  OPEN: 'open',
  REVIEW: 'review',
  APPROVED: 'approved',
  LOCKED: 'locked',
  ARCHIVED: 'archived',
});

export const PERIOD_STATUS_LABELS = Object.freeze({
  [PERIOD_STATUS.DRAFT]: 'Draft reporting period',
  [PERIOD_STATUS.OPEN]: 'Open for department activity data',
  [PERIOD_STATUS.REVIEW]: 'Review and approval in progress',
  [PERIOD_STATUS.APPROVED]: 'Approved municipal inventory',
  [PERIOD_STATUS.LOCKED]: 'Locked after publication',
  [PERIOD_STATUS.ARCHIVED]: 'Archived (retained for audit)',
});

export const PERIOD_TRANSITIONS = Object.freeze({
  [PERIOD_STATUS.DRAFT]: [PERIOD_STATUS.OPEN, PERIOD_STATUS.ARCHIVED],
  [PERIOD_STATUS.OPEN]: [PERIOD_STATUS.REVIEW, PERIOD_STATUS.APPROVED, PERIOD_STATUS.ARCHIVED],
  [PERIOD_STATUS.REVIEW]: [PERIOD_STATUS.OPEN, PERIOD_STATUS.APPROVED, PERIOD_STATUS.ARCHIVED],
  [PERIOD_STATUS.APPROVED]: [PERIOD_STATUS.LOCKED, PERIOD_STATUS.REVIEW],
  [PERIOD_STATUS.LOCKED]: [PERIOD_STATUS.ARCHIVED],
  [PERIOD_STATUS.ARCHIVED]: [],
});

export const ACTIVITY_STATUS = Object.freeze({
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  VALIDATED: 'validated',
  NEEDS_CORRECTION: 'needs_correction',
  REJECTED: 'rejected',
  LOCKED: 'locked',
});

export const ACTIVITY_TRANSITIONS = Object.freeze({
  [ACTIVITY_STATUS.DRAFT]: [ACTIVITY_STATUS.SUBMITTED, ACTIVITY_STATUS.LOCKED],
  [ACTIVITY_STATUS.SUBMITTED]: [
    ACTIVITY_STATUS.VALIDATED,
    ACTIVITY_STATUS.NEEDS_CORRECTION,
    ACTIVITY_STATUS.REJECTED,
  ],
  [ACTIVITY_STATUS.VALIDATED]: [ACTIVITY_STATUS.LOCKED, ACTIVITY_STATUS.NEEDS_CORRECTION],
  [ACTIVITY_STATUS.NEEDS_CORRECTION]: [ACTIVITY_STATUS.SUBMITTED, ACTIVITY_STATUS.REJECTED],
  [ACTIVITY_STATUS.REJECTED]: [ACTIVITY_STATUS.DRAFT],
  [ACTIVITY_STATUS.LOCKED]: [],
});

export const CALCULATION_STATUS = Object.freeze({
  QUEUED: 'queued',
  COMPLETED: 'completed',
  FAILED: 'failed',
  SUPERSEDED: 'superseded',
});

export const CALCULATION_TRANSITIONS = Object.freeze({
  [CALCULATION_STATUS.QUEUED]: [CALCULATION_STATUS.COMPLETED, CALCULATION_STATUS.FAILED],
  [CALCULATION_STATUS.COMPLETED]: [CALCULATION_STATUS.SUPERSEDED],
  [CALCULATION_STATUS.FAILED]: [CALCULATION_STATUS.QUEUED],
  [CALCULATION_STATUS.SUPERSEDED]: [],
});

export const RECOMMENDATION_STATUS = Object.freeze({
  PENDING: 'pending',
  EDITED: 'edited',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
});

export const RECOMMENDATION_STATUS_LABELS = Object.freeze({
  [RECOMMENDATION_STATUS.PENDING]: 'Awaiting human decision',
  [RECOMMENDATION_STATUS.EDITED]: 'Edited — still awaiting acceptance',
  [RECOMMENDATION_STATUS.ACCEPTED]: 'Accepted and labelled estimated',
  [RECOMMENDATION_STATUS.REJECTED]: 'Rejected by reviewer',
});

export const RECOMMENDATION_TRANSITIONS = Object.freeze({
  [RECOMMENDATION_STATUS.PENDING]: [
    RECOMMENDATION_STATUS.EDITED,
    RECOMMENDATION_STATUS.ACCEPTED,
    RECOMMENDATION_STATUS.REJECTED,
  ],
  [RECOMMENDATION_STATUS.EDITED]: [RECOMMENDATION_STATUS.ACCEPTED, RECOMMENDATION_STATUS.REJECTED],
  [RECOMMENDATION_STATUS.ACCEPTED]: [],
  [RECOMMENDATION_STATUS.REJECTED]: [],
});

export const FACTOR_STATUS = Object.freeze({
  DRAFT: 'draft',
  PUBLISHED: 'published',
  SUPERSEDED: 'superseded',
  RETIRED: 'retired',
});

export const GHG_ERROR_CODES = Object.freeze({
  NOT_FOUND: 'GHG_NOT_FOUND',
  VALIDATION_ERROR: 'GHG_VALIDATION_ERROR',
  PERMISSION_DENIED: 'GHG_PERMISSION_DENIED',
  UNAUTHENTICATED: 'GHG_UNAUTHENTICATED',
  JURISDICTION_DENIED: 'GHG_JURISDICTION_DENIED',
  INVALID_STATE_TRANSITION: 'GHG_INVALID_STATE_TRANSITION',
  UNIT_MISMATCH: 'GHG_UNIT_MISMATCH',
  FACTOR_UNAVAILABLE: 'GHG_FACTOR_UNAVAILABLE',
  IDEMPOTENCY_CONFLICT: 'GHG_IDEMPOTENCY_CONFLICT',
  RATE_LIMITED: 'GHG_RATE_LIMITED',
  STALE_CALCULATION: 'GHG_STALE_CALCULATION',
  MEASURED_DATA_PROTECTED: 'GHG_MEASURED_DATA_PROTECTED',
  UNSUPPORTED_FILE: 'GHG_UNSUPPORTED_FILE',
  MIGRATION_FAILED: 'GHG_MIGRATION_FAILED',
});

/** Every privileged operation is declared here; the service layer checks before reading or writing. */
export const GHG_CAPABILITIES = Object.freeze({
  'inventory.view_public': {
    roles: [GHG_ROLES.PUBLIC, GHG_ROLES.CITIZEN, GHG_ROLES.OPERATOR, GHG_ROLES.REVIEWER, GHG_ROLES.ADMIN],
    description: 'Read approved aggregate inventory data',
  },
  'inventory.view_staff': {
    roles: [GHG_ROLES.OPERATOR, GHG_ROLES.REVIEWER, GHG_ROLES.ADMIN],
    description: 'Read department submissions, activity records and calculation details',
  },
  'source.manage': {
    roles: [GHG_ROLES.OPERATOR, GHG_ROLES.ADMIN],
    description: 'Add or edit municipal emission sources',
  },
  'submission.create': {
    roles: [GHG_ROLES.OPERATOR, GHG_ROLES.ADMIN],
    description: 'Create a department submission with activity data',
  },
  'submission.update': {
    roles: [GHG_ROLES.OPERATOR, GHG_ROLES.ADMIN],
    description: 'Edit a draft or returned department submission',
  },
  'submission.submit': {
    roles: [GHG_ROLES.OPERATOR, GHG_ROLES.ADMIN],
    description: 'Submit a department submission for review',
  },
  'submission.review': {
    roles: [GHG_ROLES.REVIEWER, GHG_ROLES.ADMIN],
    description: 'Start review, approve, return or reject a submission',
  },
  'calculation.run': {
    roles: [GHG_ROLES.OPERATOR, GHG_ROLES.REVIEWER, GHG_ROLES.ADMIN],
    description: 'Run the deterministic emissions calculation for a period',
  },
  'factor.publish': {
    roles: [GHG_ROLES.ADMIN],
    description: 'Publish a new immutable factor version',
  },
  'period.manage': {
    roles: [GHG_ROLES.ADMIN],
    description: 'Create reporting periods and change period state',
  },
  'recommendation.review': {
    roles: [GHG_ROLES.REVIEWER, GHG_ROLES.ADMIN],
    description: 'Accept, edit or reject an estimated-total recommendation',
  },
  'export.approved': {
    roles: [GHG_ROLES.OPERATOR, GHG_ROLES.REVIEWER, GHG_ROLES.ADMIN],
    description: 'Export a source-linked inventory',
  },
  'audit.read': {
    roles: [GHG_ROLES.REVIEWER, GHG_ROLES.ADMIN],
    description: 'Read the append-only audit trail',
  },
  'migration.run': {
    roles: [GHG_ROLES.ADMIN],
    description: 'Apply or roll back storage migrations',
  },
});

export const UNIT_DIMENSIONS = Object.freeze({
  ENERGY: 'energy',
  VOLUME: 'volume',
  MASS: 'mass',
});

/**
 * Activity units accepted by the validator. `toBase` is a positive multiplier to the
 * canonical unit of the dimension (kWh, litre, kilogram).
 */
export const ACTIVITY_UNITS = Object.freeze({
  kWh: { label: 'Kilowatt-hour', dimension: UNIT_DIMENSIONS.ENERGY, toBase: 1 },
  MWh: { label: 'Megawatt-hour', dimension: UNIT_DIMENSIONS.ENERGY, toBase: 1000 },
  GJ: { label: 'Gigajoule', dimension: UNIT_DIMENSIONS.ENERGY, toBase: 277.777778 },
  L: { label: 'Litre', dimension: UNIT_DIMENSIONS.VOLUME, toBase: 1 },
  kL: { label: 'Kilolitre', dimension: UNIT_DIMENSIONS.VOLUME, toBase: 1000 },
  kg: { label: 'Kilogram', dimension: UNIT_DIMENSIONS.MASS, toBase: 1 },
  t: { label: 'Metric tonne', dimension: UNIT_DIMENSIONS.MASS, toBase: 1000 },
});

export const QUALITY_FLAGS = Object.freeze({
  ZERO_QUANTITY: 'zero_quantity',
  UNIT_CONVERTED: 'unit_converted',
  ESTIMATED_TOTAL: 'estimated_total',
  EXCLUDED_FROM_TOTAL: 'excluded_from_total',
  MISSING_ACTIVITY: 'missing_activity',
  UNCERTAINTY_ABOVE_30_PERCENT: 'uncertainty_above_30_percent',
  STALE_CALCULATION: 'stale_calculation',
});

export const GHG_LIMITS = Object.freeze({
  MAX_RECORDS_PER_SUBMISSION: 100,
  MAX_QUANTITY: 1_000_000_000,
  MAX_NOTE_LENGTH: 1000,
  MAX_NAME_LENGTH: 120,
  MAX_PDF_BYTES: 10 * 1024 * 1024,
  PUBLIC_SUBMISSIONS_PER_WINDOW: 10,
  SUBMISSION_WINDOW_MS: 10 * 60 * 1000,
  MAX_PAGE_SIZE: 100,
  DEFAULT_PAGE_SIZE: 25,
});

export const ALLOWED_SOURCE_DOCUMENT_TYPES = Object.freeze([
  'application/pdf',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

export const SUBMISSION_ACTION = Object.freeze({
  START_REVIEW: 'start_review',
  APPROVE: 'approve',
  REQUEST_CHANGES: 'request_changes',
  REJECT: 'reject',
  LOCK: 'lock',
  REOPEN: 'reopen',
});

export const SUBMISSION_ACTION_TARGET = Object.freeze({
  [SUBMISSION_ACTION.START_REVIEW]: SUBMISSION_STATUS.UNDER_REVIEW,
  [SUBMISSION_ACTION.APPROVE]: SUBMISSION_STATUS.APPROVED,
  [SUBMISSION_ACTION.REQUEST_CHANGES]: SUBMISSION_STATUS.CHANGES_REQUESTED,
  [SUBMISSION_ACTION.REJECT]: SUBMISSION_STATUS.REJECTED,
  [SUBMISSION_ACTION.LOCK]: SUBMISSION_STATUS.LOCKED,
  [SUBMISSION_ACTION.REOPEN]: SUBMISSION_STATUS.CHANGES_REQUESTED,
});

/** Actions that need a written reason; it is stored in the append-only audit trail. */
export const REASON_REQUIRED_ACTIONS = Object.freeze([
  SUBMISSION_ACTION.REQUEST_CHANGES,
  SUBMISSION_ACTION.REJECT,
  SUBMISSION_ACTION.REOPEN,
]);

export const INVENTORY_EXPORT_SCHEMA_VERSION = 'ghg-inventory-export/v1';

export const PUBLIC_METHODOLOGY_NOTE =
  'Totals are calculated deterministically from approved activity data and versioned emission factors. Estimates are labelled separately and are never mixed into measured totals.';
