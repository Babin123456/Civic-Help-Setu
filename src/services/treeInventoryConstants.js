/**
 * Domain vocabulary for the Municipal Tree Health Inventory and Preventive
 * Maintenance Planner (#749).
 *
 * The constants in this file are the single source of truth for:
 *  - storage keys and record versions,
 *  - every state a record may hold,
 *  - the transitions the trusted service layer will allow,
 *  - role capabilities and the fields each role may read or write.
 *
 * UI components import labels and transitions from here so a screen cannot
 * invent a state that the service layer does not accept.
 */

export const TREE_INVENTORY_SCHEMA_VERSION = 2;

export const TREE_STORAGE_KEYS = Object.freeze({
  meta: 'civicbridge_tree_inventory_meta_v1',
  trees: 'civicbridge_tree_assets_v1',
  species: 'civicbridge_tree_species_v1',
  inspections: 'civicbridge_tree_inspections_v1',
  workOrders: 'civicbridge_tree_maintenance_orders_v1',
  pruningEvents: 'civicbridge_tree_pruning_events_v1',
  plantingSites: 'civicbridge_tree_planting_sites_v1',
  reportAttachments: 'civicbridge_tree_report_attachments_v1',
  citizenReports: 'civicbridge_tree_citizen_reports_v1',
  audit: 'civicbridge_tree_audit_events_v1',
  idempotency: 'civicbridge_tree_idempotency_v1',
  rateLimit: 'civicbridge_tree_rate_limit_v1',
  triage: 'civicbridge_tree_triage_suggestions_v1',
  migrationBackup: 'civicbridge_tree_migration_backup_v1',
  legacyTrees: 'civicbridge_trees_v1',
  legacyReports: 'civicbridge_tree_reports_v1',
});

export const TREE_COLLECTION_KEYS = Object.freeze([
  TREE_STORAGE_KEYS.trees,
  TREE_STORAGE_KEYS.species,
  TREE_STORAGE_KEYS.inspections,
  TREE_STORAGE_KEYS.workOrders,
  TREE_STORAGE_KEYS.pruningEvents,
  TREE_STORAGE_KEYS.plantingSites,
  TREE_STORAGE_KEYS.reportAttachments,
  TREE_STORAGE_KEYS.citizenReports,
  TREE_STORAGE_KEYS.triage,
  TREE_STORAGE_KEYS.audit,
]);

export const TREE_ROLES = Object.freeze({
  CITIZEN: 'citizen',
  OPERATOR: 'operator',
  ARBORIST: 'arborist',
  REVIEWER: 'reviewer',
  ADMIN: 'admin',
});

export const STAFF_TREE_ROLES = Object.freeze([
  TREE_ROLES.OPERATOR,
  TREE_ROLES.ARBORIST,
  TREE_ROLES.REVIEWER,
  TREE_ROLES.ADMIN,
]);

export const TREE_ROLE_LABELS = Object.freeze({
  [TREE_ROLES.CITIZEN]: 'Citizen',
  [TREE_ROLES.OPERATOR]: 'Field operator',
  [TREE_ROLES.ARBORIST]: 'Certified arborist',
  [TREE_ROLES.REVIEWER]: 'Risk reviewer',
  [TREE_ROLES.ADMIN]: 'Inventory administrator',
});

/**
 * Capability table enforced inside the service layer. `roles` are tree-domain
 * roles; route guards and hidden buttons are presentation only.
 */
export const TREE_CAPABILITIES = Object.freeze({
  'tree.public.read': {
    roles: STAFF_TREE_ROLES.concat(TREE_ROLES.CITIZEN),
    description: 'Read approved public tree facts and aggregate ward totals',
  },
  'tree.staff.read': {
    roles: STAFF_TREE_ROLES,
    description: 'Read the staff inventory, including private notes and coordinates',
  },
  'tree.create': { roles: [TREE_ROLES.ARBORIST, TREE_ROLES.ADMIN], description: 'Register a public tree asset' },
  'tree.update': { roles: [TREE_ROLES.ARBORIST, TREE_ROLES.ADMIN], description: 'Correct tree asset details' },
  'tree.risk.propose': { roles: [TREE_ROLES.ARBORIST, TREE_ROLES.ADMIN], description: 'Propose a tree risk designation' },
  'tree.risk.confirm': { roles: [TREE_ROLES.REVIEWER, TREE_ROLES.ADMIN], description: 'Confirm or reject a risk designation' },
  'tree.status.transition': { roles: [TREE_ROLES.ARBORIST, TREE_ROLES.ADMIN], description: 'Move a tree through its lifecycle states' },
  'inspection.schedule': { roles: [TREE_ROLES.OPERATOR, TREE_ROLES.ARBORIST, TREE_ROLES.ADMIN], description: 'Schedule a tree inspection' },
  'inspection.complete': { roles: [TREE_ROLES.OPERATOR, TREE_ROLES.ARBORIST, TREE_ROLES.ADMIN], description: 'Record inspection findings and evidence' },
  'inspection.verify': { roles: [TREE_ROLES.REVIEWER, TREE_ROLES.ADMIN], description: 'Verify a completed inspection' },
  'order.manage': { roles: [TREE_ROLES.OPERATOR, TREE_ROLES.ARBORIST, TREE_ROLES.ADMIN], description: 'Create, assign and update maintenance orders' },
  'order.close': { roles: [TREE_ROLES.ARBORIST, TREE_ROLES.REVIEWER, TREE_ROLES.ADMIN], description: 'Close a maintenance order with evidence' },
  'report.submit': { roles: STAFF_TREE_ROLES.concat(TREE_ROLES.CITIZEN), description: 'Submit a citizen tree observation' },
  'report.triage': { roles: [TREE_ROLES.OPERATOR, TREE_ROLES.ARBORIST, TREE_ROLES.REVIEWER, TREE_ROLES.ADMIN], description: 'Triage a citizen tree observation' },
  'report.review': { roles: [TREE_ROLES.ARBORIST, TREE_ROLES.REVIEWER, TREE_ROLES.ADMIN], description: 'Accept, reject or resolve a citizen report' },
  'triage.review': { roles: [TREE_ROLES.ARBORIST, TREE_ROLES.REVIEWER, TREE_ROLES.ADMIN], description: 'Accept, edit or reject an automated triage suggestion' },
  'inventory.import': { roles: [TREE_ROLES.ADMIN], description: 'Validate and apply a bulk tree CSV import' },
  'audit.read': { roles: [TREE_ROLES.REVIEWER, TREE_ROLES.ADMIN], description: 'Read the append-only tree audit trail' },
  'retention.manage': { roles: [TREE_ROLES.ADMIN], description: 'Apply retention and archival policy' },
  'inventory.migrate': { roles: [TREE_ROLES.ADMIN], description: 'Run, inspect or roll back a schema migration' },
});

export const TREE_CONDITIONS = Object.freeze({
  HEALTHY: 'healthy',
  FAIR: 'fair',
  POOR: 'poor',
  CRITICAL: 'critical',
  DEAD: 'dead',
  UNKNOWN: 'unknown',
});

export const TREE_CONDITION_LABELS = Object.freeze({
  [TREE_CONDITIONS.HEALTHY]: 'Healthy',
  [TREE_CONDITIONS.FAIR]: 'Fair / monitor',
  [TREE_CONDITIONS.POOR]: 'Poor / treatment needed',
  [TREE_CONDITIONS.CRITICAL]: 'Critical / expert review',
  [TREE_CONDITIONS.DEAD]: 'Dead',
  [TREE_CONDITIONS.UNKNOWN]: 'Not assessed',
});

export const TREE_STATUS = Object.freeze({
  ACTIVE: 'active',
  PENDING_REVIEW: 'pending_review',
  REMOVAL_APPROVED: 'removal_approved',
  REMOVED: 'removed',
  ARCHIVED: 'archived',
});

export const TREE_STATUS_LABELS = Object.freeze({
  [TREE_STATUS.ACTIVE]: 'Active public tree',
  [TREE_STATUS.PENDING_REVIEW]: 'Pending expert review',
  [TREE_STATUS.REMOVAL_APPROVED]: 'Removal approved',
  [TREE_STATUS.REMOVED]: 'Removed',
  [TREE_STATUS.ARCHIVED]: 'Archived record',
});

export const TREE_STATUS_TRANSITIONS = Object.freeze({
  [TREE_STATUS.ACTIVE]: [TREE_STATUS.PENDING_REVIEW, TREE_STATUS.ARCHIVED],
  [TREE_STATUS.PENDING_REVIEW]: [TREE_STATUS.ACTIVE, TREE_STATUS.REMOVAL_APPROVED, TREE_STATUS.ARCHIVED],
  [TREE_STATUS.REMOVAL_APPROVED]: [TREE_STATUS.REMOVED, TREE_STATUS.ARCHIVED],
  [TREE_STATUS.REMOVED]: [TREE_STATUS.ARCHIVED],
  [TREE_STATUS.ARCHIVED]: [TREE_STATUS.ACTIVE],
});

export const INSPECTION_STATES = Object.freeze({
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  VERIFIED: 'verified',
  MISSED: 'missed',
  CANCELLED: 'cancelled',
});

export const INSPECTION_STATE_LABELS = Object.freeze({
  [INSPECTION_STATES.SCHEDULED]: 'Scheduled',
  [INSPECTION_STATES.IN_PROGRESS]: 'In progress',
  [INSPECTION_STATES.COMPLETED]: 'Completed — awaiting verification',
  [INSPECTION_STATES.VERIFIED]: 'Verified',
  [INSPECTION_STATES.MISSED]: 'Missed',
  [INSPECTION_STATES.CANCELLED]: 'Cancelled',
});

export const INSPECTION_STATE_TRANSITIONS = Object.freeze({
  [INSPECTION_STATES.SCHEDULED]: [INSPECTION_STATES.IN_PROGRESS, INSPECTION_STATES.COMPLETED, INSPECTION_STATES.MISSED, INSPECTION_STATES.CANCELLED],
  [INSPECTION_STATES.IN_PROGRESS]: [INSPECTION_STATES.COMPLETED, INSPECTION_STATES.CANCELLED],
  [INSPECTION_STATES.COMPLETED]: [INSPECTION_STATES.VERIFIED],
  [INSPECTION_STATES.VERIFIED]: [],
  [INSPECTION_STATES.MISSED]: [INSPECTION_STATES.SCHEDULED, INSPECTION_STATES.CANCELLED],
  [INSPECTION_STATES.CANCELLED]: [INSPECTION_STATES.SCHEDULED],
});

export const INSPECTION_TYPES = Object.freeze({
  ROUTINE: 'routine',
  RISK: 'risk',
  POST_STORM: 'post_storm',
  PLANTING_FOLLOW_UP: 'planting_follow_up',
  CITIZEN_REPORT: 'citizen_report',
});

export const INSPECTION_TYPE_LABELS = Object.freeze({
  [INSPECTION_TYPES.ROUTINE]: 'Routine health check',
  [INSPECTION_TYPES.RISK]: 'Risk assessment',
  [INSPECTION_TYPES.POST_STORM]: 'Post-storm damage check',
  [INSPECTION_TYPES.PLANTING_FOLLOW_UP]: 'Planting follow-up',
  [INSPECTION_TYPES.CITIZEN_REPORT]: 'Citizen report follow-up',
});

export const WORK_ORDER_STATES = Object.freeze({
  DRAFT: 'draft',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  BLOCKED: 'blocked',
  COMPLETED: 'completed',
  VERIFIED: 'verified',
  CANCELLED: 'cancelled',
});

export const WORK_ORDER_STATE_LABELS = Object.freeze({
  [WORK_ORDER_STATES.DRAFT]: 'Draft',
  [WORK_ORDER_STATES.ASSIGNED]: 'Assigned',
  [WORK_ORDER_STATES.IN_PROGRESS]: 'In progress',
  [WORK_ORDER_STATES.BLOCKED]: 'Blocked',
  [WORK_ORDER_STATES.COMPLETED]: 'Completed — awaiting closure review',
  [WORK_ORDER_STATES.VERIFIED]: 'Closed and verified',
  [WORK_ORDER_STATES.CANCELLED]: 'Cancelled',
});

export const WORK_ORDER_STATE_TRANSITIONS = Object.freeze({
  [WORK_ORDER_STATES.DRAFT]: [WORK_ORDER_STATES.ASSIGNED, WORK_ORDER_STATES.CANCELLED],
  [WORK_ORDER_STATES.ASSIGNED]: [WORK_ORDER_STATES.IN_PROGRESS, WORK_ORDER_STATES.BLOCKED, WORK_ORDER_STATES.COMPLETED, WORK_ORDER_STATES.CANCELLED],
  [WORK_ORDER_STATES.IN_PROGRESS]: [WORK_ORDER_STATES.BLOCKED, WORK_ORDER_STATES.COMPLETED, WORK_ORDER_STATES.CANCELLED],
  [WORK_ORDER_STATES.BLOCKED]: [WORK_ORDER_STATES.IN_PROGRESS, WORK_ORDER_STATES.CANCELLED],
  [WORK_ORDER_STATES.COMPLETED]: [WORK_ORDER_STATES.VERIFIED],
  [WORK_ORDER_STATES.VERIFIED]: [],
  [WORK_ORDER_STATES.CANCELLED]: [],
});

export const WORK_ORDER_TYPES = Object.freeze({
  PRUNE: 'prune',
  REMOVE: 'remove',
  TREAT: 'treat',
  STAKE: 'stake',
  WATER: 'water',
  ROOT_CARE: 'root_care',
});

export const WORK_ORDER_TYPE_LABELS = Object.freeze({
  [WORK_ORDER_TYPES.PRUNE]: 'Structural / safety pruning',
  [WORK_ORDER_TYPES.REMOVE]: 'Removal',
  [WORK_ORDER_TYPES.TREAT]: 'Pest or disease treatment',
  [WORK_ORDER_TYPES.STAKE]: 'Staking and support',
  [WORK_ORDER_TYPES.WATER]: 'Watering / irrigation',
  [WORK_ORDER_TYPES.ROOT_CARE]: 'Root-zone care',
});

export const WORK_ORDER_PRIORITIES = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
});

export const WORK_ORDER_PRIORITY_LABELS = Object.freeze({
  [WORK_ORDER_PRIORITIES.LOW]: 'Low',
  [WORK_ORDER_PRIORITIES.MEDIUM]: 'Medium',
  [WORK_ORDER_PRIORITIES.HIGH]: 'High',
  [WORK_ORDER_PRIORITIES.URGENT]: 'Urgent — same day',
});

export const CITIZEN_REPORT_STATES = Object.freeze({
  SUBMITTED: 'submitted',
  TRIAGED: 'triaged',
  UNDER_REVIEW: 'under_review',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  DUPLICATE: 'duplicate',
});

export const CITIZEN_REPORT_STATE_LABELS = Object.freeze({
  [CITIZEN_REPORT_STATES.SUBMITTED]: 'Submitted — awaiting triage',
  [CITIZEN_REPORT_STATES.TRIAGED]: 'Triaged — awaiting expert review',
  [CITIZEN_REPORT_STATES.UNDER_REVIEW]: 'Under expert review',
  [CITIZEN_REPORT_STATES.ACCEPTED]: 'Accepted for inspection',
  [CITIZEN_REPORT_STATES.REJECTED]: 'Not accepted',
  [CITIZEN_REPORT_STATES.DUPLICATE]: 'Linked to an existing report',
});

export const CITIZEN_REPORT_STATE_TRANSITIONS = Object.freeze({
  [CITIZEN_REPORT_STATES.SUBMITTED]: [CITIZEN_REPORT_STATES.TRIAGED, CITIZEN_REPORT_STATES.UNDER_REVIEW],
  [CITIZEN_REPORT_STATES.TRIAGED]: [CITIZEN_REPORT_STATES.UNDER_REVIEW, CITIZEN_REPORT_STATES.ACCEPTED, CITIZEN_REPORT_STATES.REJECTED, CITIZEN_REPORT_STATES.DUPLICATE],
  [CITIZEN_REPORT_STATES.UNDER_REVIEW]: [CITIZEN_REPORT_STATES.ACCEPTED, CITIZEN_REPORT_STATES.REJECTED, CITIZEN_REPORT_STATES.DUPLICATE],
  [CITIZEN_REPORT_STATES.ACCEPTED]: [],
  [CITIZEN_REPORT_STATES.REJECTED]: [],
  [CITIZEN_REPORT_STATES.DUPLICATE]: [],
});

export const CITIZEN_REPORT_CATEGORIES = Object.freeze({
  VISIBLE_DAMAGE: 'visible_damage',
  FALLEN_BRANCH: 'fallen_branch',
  PEST_OR_DISEASE: 'pest_or_disease',
  ROOT_DAMAGE: 'root_damage',
  ILLEGAL_PRUNING: 'illegal_pruning',
  PLANTING_SITE: 'planting_site',
});

export const CITIZEN_REPORT_CATEGORY_LABELS = Object.freeze({
  [CITIZEN_REPORT_CATEGORIES.VISIBLE_DAMAGE]: 'Visible trunk or canopy damage',
  [CITIZEN_REPORT_CATEGORIES.FALLEN_BRANCH]: 'Fallen branch or obstruction',
  [CITIZEN_REPORT_CATEGORIES.PEST_OR_DISEASE]: 'Pest or disease symptoms',
  [CITIZEN_REPORT_CATEGORIES.ROOT_DAMAGE]: 'Root or soil damage',
  [CITIZEN_REPORT_CATEGORIES.ILLEGAL_PRUNING]: 'Illegal pruning or felling',
  [CITIZEN_REPORT_CATEGORIES.PLANTING_SITE]: 'Empty planting site',
});

export const RISK_LEVELS = Object.freeze({
  NONE: 'none',
  LOW: 'low',
  MODERATE: 'moderate',
  HIGH: 'high',
  CRITICAL: 'critical',
});

export const RISK_LEVEL_LABELS = Object.freeze({
  [RISK_LEVELS.NONE]: 'No elevated risk recorded',
  [RISK_LEVELS.LOW]: 'Low risk',
  [RISK_LEVELS.MODERATE]: 'Moderate risk',
  [RISK_LEVELS.HIGH]: 'High risk',
  [RISK_LEVELS.CRITICAL]: 'Critical risk — expert confirmation required',
});

export const RISK_DESIGNATION_STATES = Object.freeze({
  NONE: 'none',
  PROPOSED: 'proposed',
  CONFIRMED: 'confirmed',
  REJECTED: 'rejected',
});

export const PLANTING_SITE_STATES = Object.freeze({
  AVAILABLE: 'available',
  PLANNED: 'planned',
  OCCUPIED: 'occupied',
  RETIRED: 'retired',
});

export const PLANTING_SITE_STATE_LABELS = Object.freeze({
  [PLANTING_SITE_STATES.AVAILABLE]: 'Available for planting',
  [PLANTING_SITE_STATES.PLANNED]: 'Planned planting',
  [PLANTING_SITE_STATES.OCCUPIED]: 'Occupied by a tree',
  [PLANTING_SITE_STATES.RETIRED]: 'Retired site',
});

export const TRIAGE_DECISIONS = Object.freeze({
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  EDITED: 'edited',
  REJECTED: 'rejected',
});

export const TRIAGE_DECISION_LABELS = Object.freeze({
  [TRIAGE_DECISIONS.PENDING]: 'Awaiting expert decision',
  [TRIAGE_DECISIONS.ACCEPTED]: 'Accepted by expert',
  [TRIAGE_DECISIONS.EDITED]: 'Edited and accepted by expert',
  [TRIAGE_DECISIONS.REJECTED]: 'Rejected by expert',
});

export const AUDIT_ACTIONS = Object.freeze({
  TREE_CREATED: 'tree.created',
  TREE_UPDATED: 'tree.updated',
  TREE_STATUS_CHANGED: 'tree.status_changed',
  TREE_RISK_PROPOSED: 'tree.risk_proposed',
  TREE_RISK_CONFIRMED: 'tree.risk_confirmed',
  TREE_ARCHIVED: 'tree.archived',
  INSPECTION_SCHEDULED: 'inspection.scheduled',
  INSPECTION_COMPLETED: 'inspection.completed',
  INSPECTION_VERIFIED: 'inspection.verified',
  WORK_ORDER_CREATED: 'work_order.created',
  WORK_ORDER_UPDATED: 'work_order.updated',
  WORK_ORDER_CLOSED: 'work_order.closed',
  REPORT_SUBMITTED: 'report.submitted',
  REPORT_TRIAGED: 'report.triaged',
  REPORT_REVIEWED: 'report.reviewed',
  TRIAGE_SUGGESTION_REVIEWED: 'triage_suggestion.reviewed',
  IMPORT_APPLIED: 'import.applied',
  RETENTION_APPLIED: 'retention.applied',
  MIGRATION_RUN: 'migration.run',
  MIGRATION_ROLLED_BACK: 'migration.rolled_back',
});

export const TREE_ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: 'TREE_VALIDATION_ERROR',
  INVALID_COORDINATES: 'TREE_INVALID_COORDINATES',
  INVALID_TRANSITION: 'TREE_INVALID_TRANSITION',
  DUPLICATE_TREE: 'TREE_DUPLICATE',
  NOT_FOUND: 'TREE_NOT_FOUND',
  REFERENCE_NOT_FOUND: 'TREE_REFERENCE_NOT_FOUND',
  PERMISSION_DENIED: 'TREE_PERMISSION_DENIED',
  JURISDICTION_FORBIDDEN: 'TREE_JURISDICTION_FORBIDDEN',
  UNAUTHENTICATED: 'TREE_UNAUTHENTICATED',
  IDEMPOTENCY_CONFLICT: 'TREE_IDEMPOTENCY_CONFLICT',
  RATE_LIMITED: 'TREE_RATE_LIMITED',
  UNSAFE_ATTACHMENT: 'TREE_UNSAFE_ATTACHMENT',
  STORAGE_ERROR: 'TREE_STORAGE_ERROR',
  IMPORT_INVALID: 'TREE_IMPORT_INVALID',
  EXPERT_CONFIRMATION_REQUIRED: 'TREE_EXPERT_CONFIRMATION_REQUIRED',
  MIGRATION_UNAVAILABLE: 'TREE_MIGRATION_UNAVAILABLE',
});

export const TREE_API_LIMITS = Object.freeze({
  maxTreesPerPage: 50,
  defaultPageSize: 12,
  maxSearchLength: 120,
  maxNotesLength: 2000,
  maxReasonLength: 500,
  maxAttachmentsPerReport: 3,
  maxAttachmentBytes: 5 * 1024 * 1024,
  maxCsvBytes: 256 * 1024,
  maxCsvRows: 500,
  reportRateLimit: 3,
  reportRateWindowMs: 60 * 60 * 1000,
  duplicateReportCooldownMs: 10 * 60 * 1000,
  duplicateTreeRadiusMeters: 15,
  inspectionReminderDays: 30,
});

export const ALLOWED_ATTACHMENT_MIME_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp']);

export const TREE_INVENTORY_GOVERNANCE_NOTICE =
  'This register separates verified municipal observations from citizen reports. Precise coordinates and inspection notes are restricted to authorised staff. Automated image triage is a suggestion only: pruning, removal and risk designations always require a named human expert to confirm.';

export const TREE_STATE_TRANSITION_MAP = Object.freeze({
  tree: TREE_STATUS_TRANSITIONS,
  inspection: INSPECTION_STATE_TRANSITIONS,
  workOrder: WORK_ORDER_STATE_TRANSITIONS,
  citizenReport: CITIZEN_REPORT_STATE_TRANSITIONS,
});

export function isKnownValue(enumObject, value) {
  return Object.values(enumObject).includes(value);
}

export function canTransition(kind, from, to) {
  const map = TREE_STATE_TRANSITION_MAP[kind];
  if (!map || !map[from]) return false;
  return map[from].includes(to);
}

export function allowedNextStates(kind, from) {
  const map = TREE_STATE_TRANSITION_MAP[kind];
  return map?.[from] ? [...map[from]] : [];
}

/**
 * Readable, translatable error guidance for the UI. The code is stable; the
 * message is what a person sees.
 */
export const TREE_ERROR_MESSAGES = Object.freeze({
  [TREE_ERROR_CODES.VALIDATION_ERROR]: 'Some details are missing or in the wrong format. Check the highlighted fields and try again.',
  [TREE_ERROR_CODES.INVALID_COORDINATES]: 'Enter coordinates as latitude between -90 and 90 and longitude between -180 and 180.',
  [TREE_ERROR_CODES.INVALID_TRANSITION]: 'This change is not allowed from the record’s current state. Refresh and choose one of the offered next steps.',
  [TREE_ERROR_CODES.DUPLICATE_TREE]: 'A tree with the same species already exists at this location. Open the existing record or add a reason to register a second tree.',
  [TREE_ERROR_CODES.NOT_FOUND]: 'The record could not be found. It may have been archived or the link may be out of date.',
  [TREE_ERROR_CODES.REFERENCE_NOT_FOUND]: 'A linked species, tree, inspection or planting site no longer exists. Refresh the list and try again.',
  [TREE_ERROR_CODES.PERMISSION_DENIED]: 'Your role does not include this action. Ask a municipal administrator for the right staff role.',
  [TREE_ERROR_CODES.JURISDICTION_FORBIDDEN]: 'This record belongs to a different municipal jurisdiction. Staff can only change records in their assigned jurisdiction.',
  [TREE_ERROR_CODES.UNAUTHENTICATED]: 'Sign in with a municipal staff account to use this workspace.',
  [TREE_ERROR_CODES.IDEMPOTENCY_CONFLICT]: 'This action was already sent with different details. Reload the record before trying again.',
  [TREE_ERROR_CODES.RATE_LIMITED]: 'Too many submissions were received from this device. Wait a little and try again.',
  [TREE_ERROR_CODES.UNSAFE_ATTACHMENT]: 'The attached file is not a supported, safe image. Use a JPEG, PNG or WebP under 5 MB.',
  [TREE_ERROR_CODES.STORAGE_ERROR]: 'The change could not be saved on this device. Your previous data was restored. Check available storage and retry.',
  [TREE_ERROR_CODES.IMPORT_INVALID]: 'The CSV file has errors. Nothing was imported. Fix the listed rows and preview again.',
  [TREE_ERROR_CODES.EXPERT_CONFIRMATION_REQUIRED]: 'An automated suggestion cannot change a tree’s condition, risk or removal status. A named arborist or reviewer must confirm it.',
  [TREE_ERROR_CODES.MIGRATION_UNAVAILABLE]: 'No migration backup is available to roll back, or the stored data is already at the current version.',
});
