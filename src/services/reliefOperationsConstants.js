/**
 * Relief Operations Workspace — domain contract (#747).
 *
 * AI-assisted disaster relief needs aggregation and resource allocation.
 * This module defines the normalized collections, finite state machines,
 * least-privilege capabilities, stable error codes, and bounded limits that
 * every read and write in the feature must obey.
 *
 * Deliberate boundaries:
 *  - No medical triage decisions are made anywhere in this module.
 *  - Automated recommendations are advisory; a human must approve allocations.
 *  - Public projections expose aggregate or explicitly approved fields only.
 */

export const RELIEF_SCHEMA_VERSION = 1;

/** Ruleset identity is stored with every automated recommendation. */
export const RELIEF_FORECAST_MODEL_VERSION = 'relief-forecast-rules-v1.0.0';
export const RELIEF_FORECAST_RULESET = Object.freeze({
  id: RELIEF_FORECAST_MODEL_VERSION,
  windowDays: 7,
  freshnessHours: 24,
  minReportsForMediumConfidence: 2,
  minReportsForHighConfidence: 4,
  medicalReviewRequired: true,
});

export const RELIEF_STORAGE_KEYS = {
  INCIDENTS: 'civic_relief_incidents_v1',
  NEED_REPORTS: 'civic_relief_need_reports_v1',
  RESOURCE_INVENTORY: 'civic_relief_resource_inventory_v1',
  STOCK_MOVEMENTS: 'civic_relief_stock_movements_v1',
  DISTRIBUTION_SITES: 'civic_relief_distribution_sites_v1',
  ALLOCATION_PROPOSALS: 'civic_relief_allocation_proposals_v1',
  DELIVERY_CONFIRMATIONS: 'civic_relief_delivery_confirmations_v1',
  PARTNER_VERIFICATIONS: 'civic_relief_partner_verifications_v1',
  FORECAST_RUNS: 'civic_relief_forecast_runs_v1',
  AUDIT_LOGS: 'civic_relief_audit_logs_v1',
  ARCHIVE: 'civic_relief_archive_v1',
  MIGRATION_META: 'civic_relief_meta_v1',
};

export const RELIEF_COLLECTIONS = Object.freeze({
  incidents: RELIEF_STORAGE_KEYS.INCIDENTS,
  needs: RELIEF_STORAGE_KEYS.NEED_REPORTS,
  resources: RELIEF_STORAGE_KEYS.RESOURCE_INVENTORY,
  movements: RELIEF_STORAGE_KEYS.STOCK_MOVEMENTS,
  sites: RELIEF_STORAGE_KEYS.DISTRIBUTION_SITES,
  allocations: RELIEF_STORAGE_KEYS.ALLOCATION_PROPOSALS,
  deliveries: RELIEF_STORAGE_KEYS.DELIVERY_CONFIRMATIONS,
  partners: RELIEF_STORAGE_KEYS.PARTNER_VERIFICATIONS,
  forecastRuns: RELIEF_STORAGE_KEYS.FORECAST_RUNS,
  auditLogs: RELIEF_STORAGE_KEYS.AUDIT_LOGS,
  archive: RELIEF_STORAGE_KEYS.ARCHIVE,
});

/** Least-privilege roles. PUBLIC has no account; PARTNER is a verified relief partner. */
export const RELIEF_ROLES = Object.freeze({
  PUBLIC: 'public',
  CITIZEN: 'citizen',
  PARTNER: 'partner',
  OPERATOR: 'operator',
  REVIEWER: 'reviewer',
  ADMIN: 'admin',
});

/** Roles allowed to see operational (non-public) records. */
export const RELIEF_STAFF_ROLES = Object.freeze([
  RELIEF_ROLES.OPERATOR,
  RELIEF_ROLES.REVIEWER,
  RELIEF_ROLES.ADMIN,
]);

export const RELIEF_ROLE_LABELS = Object.freeze({
  [RELIEF_ROLES.PUBLIC]: 'Public visitor',
  [RELIEF_ROLES.CITIZEN]: 'Citizen reporter',
  [RELIEF_ROLES.PARTNER]: 'Verified relief partner',
  [RELIEF_ROLES.OPERATOR]: 'Relief operations operator',
  [RELIEF_ROLES.REVIEWER]: 'Allocation reviewer',
  [RELIEF_ROLES.ADMIN]: 'Relief administrator',
});

export const RELIEF_CATEGORIES = Object.freeze({
  SHELTER: 'shelter',
  FOOD: 'food',
  WATER: 'water',
  MEDICINE: 'medicine',
  TRANSPORT: 'transport',
  SANITATION: 'sanitation',
  POWER: 'power',
});

export const RELIEF_CATEGORY_LABELS = Object.freeze({
  [RELIEF_CATEGORIES.SHELTER]: 'Shelter & temporary housing',
  [RELIEF_CATEGORIES.FOOD]: 'Food & dry rations',
  [RELIEF_CATEGORIES.WATER]: 'Drinking water',
  [RELIEF_CATEGORIES.MEDICINE]: 'Medicine & medical supplies',
  [RELIEF_CATEGORIES.TRANSPORT]: 'Transport & evacuation',
  [RELIEF_CATEGORIES.SANITATION]: 'Sanitation & hygiene',
  [RELIEF_CATEGORIES.POWER]: 'Power & lighting',
});

/** Categories where the system must never infer a diagnosis or triage decision. */
export const MEDICAL_REVIEW_CATEGORIES = Object.freeze([RELIEF_CATEGORIES.MEDICINE]);

export const RELIEF_DISASTER_TYPES = Object.freeze({
  FLOOD: 'flood',
  HEATWAVE: 'heatwave',
  CYCLONE: 'cyclone',
  EARTHQUAKE: 'earthquake',
  LANDSLIDE: 'landslide',
  FIRE: 'fire',
  OTHER: 'other',
});

export const RELIEF_DISASTER_TYPE_LABELS = Object.freeze({
  [RELIEF_DISASTER_TYPES.FLOOD]: 'Flood',
  [RELIEF_DISASTER_TYPES.HEATWAVE]: 'Heatwave',
  [RELIEF_DISASTER_TYPES.CYCLONE]: 'Cyclone',
  [RELIEF_DISASTER_TYPES.EARTHQUAKE]: 'Earthquake',
  [RELIEF_DISASTER_TYPES.LANDSLIDE]: 'Landslide',
  [RELIEF_DISASTER_TYPES.FIRE]: 'Fire',
  [RELIEF_DISASTER_TYPES.OTHER]: 'Other emergency',
});

export const URGENCY_LEVELS = Object.freeze({
  LOW: 'low',
  MODERATE: 'moderate',
  HIGH: 'high',
  IMMEDIATE: 'immediate',
});

export const URGENCY_LEVEL_LABELS = Object.freeze({
  [URGENCY_LEVELS.LOW]: 'Low urgency',
  [URGENCY_LEVELS.MODERATE]: 'Moderate urgency',
  [URGENCY_LEVELS.HIGH]: 'High urgency',
  [URGENCY_LEVELS.IMMEDIATE]: 'Immediate life-safety need',
});

// ── Incidents ────────────────────────────────────────────────────────────────

export const INCIDENT_STATUS = Object.freeze({
  DRAFT: 'draft',
  ACTIVE: 'active',
  CONTAINMENT: 'containment',
  CLOSED: 'closed',
  ARCHIVED: 'archived',
});

export const INCIDENT_STATUS_LABELS = Object.freeze({
  [INCIDENT_STATUS.DRAFT]: 'Draft (not public)',
  [INCIDENT_STATUS.ACTIVE]: 'Active emergency',
  [INCIDENT_STATUS.CONTAINMENT]: 'Relief in containment phase',
  [INCIDENT_STATUS.CLOSED]: 'Closed',
  [INCIDENT_STATUS.ARCHIVED]: 'Archived',
});

export const INCIDENT_TRANSITIONS = Object.freeze({
  [INCIDENT_STATUS.DRAFT]: [INCIDENT_STATUS.ACTIVE, INCIDENT_STATUS.ARCHIVED],
  [INCIDENT_STATUS.ACTIVE]: [INCIDENT_STATUS.CONTAINMENT, INCIDENT_STATUS.CLOSED],
  [INCIDENT_STATUS.CONTAINMENT]: [INCIDENT_STATUS.CLOSED, INCIDENT_STATUS.ACTIVE],
  [INCIDENT_STATUS.CLOSED]: [INCIDENT_STATUS.ARCHIVED, INCIDENT_STATUS.ACTIVE],
  [INCIDENT_STATUS.ARCHIVED]: [],
});

// ── Need reports ─────────────────────────────────────────────────────────────

export const NEED_STATUS = Object.freeze({
  SUBMITTED: 'submitted',
  VERIFIED: 'verified',
  TRIAGED: 'triaged',
  ALLOCATED: 'allocated',
  FULFILLED: 'fulfilled',
  REJECTED: 'rejected',
  DUPLICATE: 'duplicate',
});

export const NEED_STATUS_LABELS = Object.freeze({
  [NEED_STATUS.SUBMITTED]: 'Submitted (awaiting verification)',
  [NEED_STATUS.VERIFIED]: 'Verified by operator',
  [NEED_STATUS.TRIAGED]: 'Triaged for allocation',
  [NEED_STATUS.ALLOCATED]: 'Allocated to a delivery',
  [NEED_STATUS.FULFILLED]: 'Need fulfilled',
  [NEED_STATUS.REJECTED]: 'Rejected (not eligible / invalid)',
  [NEED_STATUS.DUPLICATE]: 'Merged duplicate report',
});

export const NEED_TRANSITIONS = Object.freeze({
  [NEED_STATUS.SUBMITTED]: [
    NEED_STATUS.VERIFIED,
    NEED_STATUS.REJECTED,
    NEED_STATUS.DUPLICATE,
  ],
  [NEED_STATUS.VERIFIED]: [
    NEED_STATUS.TRIAGED,
    NEED_STATUS.REJECTED,
    NEED_STATUS.DUPLICATE,
  ],
  [NEED_STATUS.TRIAGED]: [
    NEED_STATUS.ALLOCATED,
    NEED_STATUS.REJECTED,
    NEED_STATUS.DUPLICATE,
  ],
  [NEED_STATUS.ALLOCATED]: [NEED_STATUS.FULFILLED],
  [NEED_STATUS.FULFILLED]: [],
  [NEED_STATUS.REJECTED]: [NEED_STATUS.SUBMITTED],
  [NEED_STATUS.DUPLICATE]: [],
});

// ── Resource inventory & stock movements ─────────────────────────────────────

export const RESOURCE_STATUS = Object.freeze({
  AVAILABLE: 'available',
  RESERVED: 'reserved',
  DEPLETED: 'depleted',
  EXPIRED: 'expired',
  QUARANTINED: 'quarantined',
});

export const RESOURCE_STATUS_LABELS = Object.freeze({
  [RESOURCE_STATUS.AVAILABLE]: 'Available',
  [RESOURCE_STATUS.RESERVED]: 'Partly reserved',
  [RESOURCE_STATUS.DEPLETED]: 'Depleted',
  [RESOURCE_STATUS.EXPIRED]: 'Expired / unfit',
  [RESOURCE_STATUS.QUARANTINED]: 'Quarantined',
});

export const STOCK_MOVEMENT_TYPES = Object.freeze({
  RECEIPT: 'receipt',
  RESERVATION: 'reservation',
  RELEASE: 'release',
  ISSUE: 'issue',
  ADJUSTMENT: 'adjustment',
  RETURN: 'return',
  EXPIRY: 'expiry',
});

export const STOCK_MOVEMENT_LABELS = Object.freeze({
  [STOCK_MOVEMENT_TYPES.RECEIPT]: 'Stock received',
  [STOCK_MOVEMENT_TYPES.RESERVATION]: 'Reserved for allocation',
  [STOCK_MOVEMENT_TYPES.RELEASE]: 'Reservation released',
  [STOCK_MOVEMENT_TYPES.ISSUE]: 'Issued to distribution site',
  [STOCK_MOVEMENT_TYPES.ADJUSTMENT]: 'Manual adjustment',
  [STOCK_MOVEMENT_TYPES.RETURN]: 'Stock returned',
  [STOCK_MOVEMENT_TYPES.EXPIRY]: 'Written off (expired)',
});

// ── Allocation proposals ─────────────────────────────────────────────────────

export const ALLOCATION_STATUS = Object.freeze({
  DRAFT: 'draft',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  RESERVED: 'reserved',
  DISPATCHED: 'dispatched',
  DELIVERED: 'delivered',
  CONFIRMED: 'confirmed',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
});

export const ALLOCATION_STATUS_LABELS = Object.freeze({
  [ALLOCATION_STATUS.DRAFT]: 'Draft proposal',
  [ALLOCATION_STATUS.PENDING_APPROVAL]: 'Awaiting human approval',
  [ALLOCATION_STATUS.APPROVED]: 'Approved',
  [ALLOCATION_STATUS.RESERVED]: 'Stock reserved (transactional)',
  [ALLOCATION_STATUS.DISPATCHED]: 'Delivery team dispatched',
  [ALLOCATION_STATUS.DELIVERED]: 'Delivery reported',
  [ALLOCATION_STATUS.CONFIRMED]: 'Distribution confirmed',
  [ALLOCATION_STATUS.REJECTED]: 'Rejected by reviewer',
  [ALLOCATION_STATUS.CANCELLED]: 'Cancelled',
  [ALLOCATION_STATUS.EXPIRED]: 'Expired without approval',
});

export const ALLOCATION_TRANSITIONS = Object.freeze({
  [ALLOCATION_STATUS.DRAFT]: [
    ALLOCATION_STATUS.PENDING_APPROVAL,
    ALLOCATION_STATUS.CANCELLED,
  ],
  [ALLOCATION_STATUS.PENDING_APPROVAL]: [
    ALLOCATION_STATUS.APPROVED,
    ALLOCATION_STATUS.REJECTED,
    ALLOCATION_STATUS.CANCELLED,
    ALLOCATION_STATUS.EXPIRED,
  ],
  [ALLOCATION_STATUS.APPROVED]: [
    ALLOCATION_STATUS.RESERVED,
    ALLOCATION_STATUS.CANCELLED,
  ],
  [ALLOCATION_STATUS.RESERVED]: [
    ALLOCATION_STATUS.DISPATCHED,
    ALLOCATION_STATUS.CANCELLED,
  ],
  [ALLOCATION_STATUS.DISPATCHED]: [
    ALLOCATION_STATUS.DELIVERED,
    ALLOCATION_STATUS.CANCELLED,
  ],
  [ALLOCATION_STATUS.DELIVERED]: [ALLOCATION_STATUS.CONFIRMED],
  [ALLOCATION_STATUS.CONFIRMED]: [],
  [ALLOCATION_STATUS.REJECTED]: [],
  [ALLOCATION_STATUS.CANCELLED]: [],
  [ALLOCATION_STATUS.EXPIRED]: [],
});

// ── Deliveries ───────────────────────────────────────────────────────────────

export const DELIVERY_STATUS = Object.freeze({
  PENDING: 'pending',
  EN_ROUTE: 'en_route',
  DELIVERED: 'delivered',
  CONFIRMED: 'confirmed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
});

export const DELIVERY_STATUS_LABELS = Object.freeze({
  [DELIVERY_STATUS.PENDING]: 'Awaiting dispatch',
  [DELIVERY_STATUS.EN_ROUTE]: 'Team en route',
  [DELIVERY_STATUS.DELIVERED]: 'Delivered (awaiting confirmation)',
  [DELIVERY_STATUS.CONFIRMED]: 'Distribution confirmed',
  [DELIVERY_STATUS.FAILED]: 'Delivery failed',
  [DELIVERY_STATUS.CANCELLED]: 'Delivery cancelled',
});

export const DELIVERY_TRANSITIONS = Object.freeze({
  [DELIVERY_STATUS.PENDING]: [DELIVERY_STATUS.EN_ROUTE, DELIVERY_STATUS.CANCELLED],
  [DELIVERY_STATUS.EN_ROUTE]: [
    DELIVERY_STATUS.DELIVERED,
    DELIVERY_STATUS.CONFIRMED,
    DELIVERY_STATUS.FAILED,
    DELIVERY_STATUS.CANCELLED,
  ],
  [DELIVERY_STATUS.DELIVERED]: [DELIVERY_STATUS.CONFIRMED, DELIVERY_STATUS.FAILED],
  [DELIVERY_STATUS.CONFIRMED]: [],
  [DELIVERY_STATUS.FAILED]: [DELIVERY_STATUS.EN_ROUTE, DELIVERY_STATUS.CANCELLED],
  [DELIVERY_STATUS.CANCELLED]: [],
});

// ── Partner verifications ────────────────────────────────────────────────────

export const PARTNER_STATUS = Object.freeze({
  PENDING: 'pending',
  VERIFIED: 'verified',
  SUSPENDED: 'suspended',
  REVOKED: 'revoked',
});

export const PARTNER_STATUS_LABELS = Object.freeze({
  [PARTNER_STATUS.PENDING]: 'Verification pending',
  [PARTNER_STATUS.VERIFIED]: 'Verified relief partner',
  [PARTNER_STATUS.SUSPENDED]: 'Suspended',
  [PARTNER_STATUS.REVOKED]: 'Verification revoked',
});

// ── Priorities & confidence ──────────────────────────────────────────────────

export const PRIORITY_TIERS = Object.freeze({
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
});

export const PRIORITY_TIER_LABELS = Object.freeze({
  [PRIORITY_TIERS.CRITICAL]: 'Critical',
  [PRIORITY_TIERS.HIGH]: 'High',
  [PRIORITY_TIERS.MEDIUM]: 'Medium',
  [PRIORITY_TIERS.LOW]: 'Low',
});

export const CONFIDENCE_LEVELS = Object.freeze({
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
});

export const CONFIDENCE_LABELS = Object.freeze({
  [CONFIDENCE_LEVELS.HIGH]: 'High confidence',
  [CONFIDENCE_LEVELS.MEDIUM]: 'Medium confidence',
  [CONFIDENCE_LEVELS.LOW]: 'Low confidence',
});

export const RECOMMENDATION_DECISIONS = Object.freeze({
  ACCEPTED: 'accepted',
  EDITED: 'edited',
  REJECTED: 'rejected',
});

export const RECOMMENDATION_DECISION_LABELS = Object.freeze({
  [RECOMMENDATION_DECISIONS.ACCEPTED]: 'Recommendation accepted (quantity unchanged)',
  [RECOMMENDATION_DECISIONS.EDITED]: 'Recommendation accepted with operator edits',
  [RECOMMENDATION_DECISIONS.REJECTED]: 'Recommendation rejected',
});

// ── Capabilities (least privilege) ──────────────────────────────────────────

const ALL_ROLES = Object.freeze(Object.values(RELIEF_ROLES));

export const RELIEF_CAPABILITIES = Object.freeze({
  'need.submit': {
    roles: [RELIEF_ROLES.PUBLIC, RELIEF_ROLES.CITIZEN, RELIEF_ROLES.PARTNER, ...RELIEF_STAFF_ROLES],
    description: 'Submit a relief need report',
  },
  'need.track': {
    roles: ALL_ROLES,
    description: 'Track a need report with its public tracking token',
  },
  'need.read_public': {
    roles: ALL_ROLES,
    description: 'Read aggregate public relief status',
  },
  'need.read': {
    roles: RELIEF_STAFF_ROLES,
    description: 'Read operational need records (may contain private notes)',
  },
  'need.verify': {
    roles: [RELIEF_ROLES.OPERATOR, RELIEF_ROLES.ADMIN],
    description: 'Verify, triage or reject a need report',
  },
  'incident.read': {
    roles: ALL_ROLES,
    description: 'Read public incident summaries',
  },
  'incident.manage': {
    roles: [RELIEF_ROLES.OPERATOR, RELIEF_ROLES.ADMIN],
    description: 'Create or transition a relief incident',
  },
  'inventory.read': {
    roles: RELIEF_STAFF_ROLES,
    description: 'Read stock levels and stock movements',
  },
  'inventory.manage': {
    roles: [RELIEF_ROLES.OPERATOR, RELIEF_ROLES.ADMIN],
    description: 'Add stock, adjust stock, and manage distribution sites',
  },
  'allocation.propose': {
    roles: [RELIEF_ROLES.OPERATOR, RELIEF_ROLES.ADMIN],
    description: 'Create an allocation proposal from a recommendation or manually',
  },
  'allocation.read': {
    roles: RELIEF_STAFF_ROLES,
    description: 'Read the allocation queue',
  },
  'allocation.approve': {
    roles: [RELIEF_ROLES.REVIEWER, RELIEF_ROLES.ADMIN],
    description: 'Approve or reject an allocation proposal (human gate)',
  },
  'allocation.dispatch': {
    roles: [RELIEF_ROLES.OPERATOR, RELIEF_ROLES.ADMIN],
    description: 'Assign a delivery team and dispatch reserved stock',
  },
  'delivery.confirm': {
    roles: [RELIEF_ROLES.OPERATOR, RELIEF_ROLES.REVIEWER, RELIEF_ROLES.ADMIN],
    description: 'Record a confirmed distribution of goods',
  },
  'forecast.run': {
    roles: [RELIEF_ROLES.OPERATOR, RELIEF_ROLES.ADMIN],
    description: 'Run the deterministic needs forecast',
  },
  'audit.read': {
    roles: [RELIEF_ROLES.REVIEWER, RELIEF_ROLES.ADMIN],
    description: 'Read the append-only relief audit trail',
  },
  'partner.verify': {
    roles: [RELIEF_ROLES.ADMIN],
    description: 'Verify, suspend or revoke a relief partner',
  },
});

// ── Stable error codes ──────────────────────────────────────────────────────

export const RELIEF_ERROR_CODES = Object.freeze({
  NOT_FOUND: 'RELIEF_NOT_FOUND',
  VALIDATION_ERROR: 'RELIEF_VALIDATION_ERROR',
  PERMISSION_DENIED: 'RELIEF_PERMISSION_DENIED',
  UNAUTHENTICATED: 'RELIEF_UNAUTHENTICATED',
  INVALID_STATE_TRANSITION: 'RELIEF_INVALID_STATE_TRANSITION',
  DUPLICATE_REPORT: 'RELIEF_DUPLICATE_REPORT',
  RATE_LIMITED: 'RELIEF_RATE_LIMITED',
  IDEMPOTENCY_CONFLICT: 'RELIEF_IDEMPOTENCY_CONFLICT',
  INSUFFICIENT_STOCK: 'RELIEF_INSUFFICIENT_STOCK',
  STOCK_EXPIRED: 'RELIEF_STOCK_EXPIRED',
  STALE_DATA: 'RELIEF_STALE_DATA',
  SEPARATION_OF_DUTY: 'RELIEF_SEPARATION_OF_DUTY',
  PARTNER_NOT_VERIFIED: 'RELIEF_PARTNER_NOT_VERIFIED',
  TRANSACTION_FAILED: 'RELIEF_TRANSACTION_FAILED',
});

export const RELIEF_LIMITS = Object.freeze({
  maxNeedQuantity: 100000,
  maxPeopleAffected: 500000,
  maxDescriptionLength: 1000,
  maxLocalityLength: 80,
  maxNotesLength: 500,
  maxReasonLength: 300,
  maxTeamNameLength: 80,
  maxVehicleRefLength: 40,
  defaultPageSize: 20,
  maxPageSize: 100,
  publicSubmissionLimit: 10,
  publicSubmissionWindowMs: 10 * 60 * 1000,
  dedupeWindowHours: 12,
  dedupeRadiusMeters: 250,
  allocationApprovalExpiryHours: 48,
});

/**
 * Plain-language guidance keyed by stable error code. The UI translates the
 * code, never the raw server message.
 */
export const RELIEF_ERROR_GUIDANCE = Object.freeze({
  [RELIEF_ERROR_CODES.NOT_FOUND]: 'The record may have been archived or removed. Refresh the list and try again.',
  [RELIEF_ERROR_CODES.VALIDATION_ERROR]: 'Some details are missing or invalid. Check the highlighted fields and resubmit.',
  [RELIEF_ERROR_CODES.PERMISSION_DENIED]: 'Your role cannot perform this action. Ask a relief administrator for the required access.',
  [RELIEF_ERROR_CODES.UNAUTHENTICATED]: 'Sign in with an authorised relief operations account to continue.',
  [RELIEF_ERROR_CODES.INVALID_STATE_TRANSITION]: 'This record has already moved to another stage. Refresh to see its current status.',
  [RELIEF_ERROR_CODES.DUPLICATE_REPORT]: 'A matching report already exists. It has been linked instead of counted twice.',
  [RELIEF_ERROR_CODES.RATE_LIMITED]: 'Too many reports were submitted recently. Wait a few minutes and try again.',
  [RELIEF_ERROR_CODES.IDEMPOTENCY_CONFLICT]: 'This action was already submitted with a different payload. Refresh before retrying.',
  [RELIEF_ERROR_CODES.INSUFFICIENT_STOCK]: 'There is not enough unreserved stock for this allocation. Reduce the quantity or add stock.',
  [RELIEF_ERROR_CODES.STOCK_EXPIRED]: 'This stock batch is expired or quarantined and cannot be allocated.',
  [RELIEF_ERROR_CODES.STALE_DATA]: 'Some figures are older than the freshness limit. Refresh the forecast before approving.',
  [RELIEF_ERROR_CODES.SEPARATION_OF_DUTY]: 'The person who created a proposal cannot approve it. Ask another reviewer.',
  [RELIEF_ERROR_CODES.PARTNER_NOT_VERIFIED]: 'This relief partner is not verified for the selected jurisdiction.',
  [RELIEF_ERROR_CODES.TRANSACTION_FAILED]: 'The change could not be saved completely, so nothing was changed. Try again.',
});
