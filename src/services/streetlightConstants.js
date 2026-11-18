/**
 * Streetlight Outage Clustering and Repair Prioritization Constants (#756).
 * Enums, domain state machines, capability mappings, error codes, and limits.
 */

export const STREETLIGHT_SCHEMA_VERSION = 1;

export const STREETLIGHT_STORAGE_KEYS = {
  ASSETS: 'civic_streetlight_assets_v1',
  REPORTS: 'civic_streetlight_reports_v1',
  CLUSTERS: 'civic_streetlight_clusters_v1',
  WORK_ORDERS: 'civic_streetlight_work_orders_v1',
  REPAIR_EVENTS: 'civic_streetlight_repair_events_v1',
  INSPECTION_SCHEDULES: 'civic_streetlight_inspection_schedules_v1',
  AUDIT_LOGS: 'civic_streetlight_audit_logs_v1',
  MIGRATION_META: 'civic_streetlight_meta_v1',
};

export const STREETLIGHT_ROLES = {
  PUBLIC: 'public',
  CITIZEN: 'citizen',
  OPERATOR: 'operator',
  TECHNICIAN: 'technician',
  REVIEWER: 'reviewer',
  ADMIN: 'admin',
};

export const STAFF_STREETLIGHT_ROLES = [
  STREETLIGHT_ROLES.OPERATOR,
  STREETLIGHT_ROLES.TECHNICIAN,
  STREETLIGHT_ROLES.REVIEWER,
  STREETLIGHT_ROLES.ADMIN,
];

export const ASSET_STATUS = {
  FUNCTIONAL: 'functional',
  FLICKERING: 'flickering',
  DARK: 'dark',
  DAMAGED: 'damaged',
  DECOMMISSIONED: 'decommissioned',
};

export const ASSET_STATUS_LABELS = {
  [ASSET_STATUS.FUNCTIONAL]: 'Fully Operational',
  [ASSET_STATUS.FLICKERING]: 'Intermittent / Flickering',
  [ASSET_STATUS.DARK]: 'Completely Dark',
  [ASSET_STATUS.DAMAGED]: 'Structurally Damaged / Hazard',
  [ASSET_STATUS.DECOMMISSIONED]: 'Decommissioned',
};

export const POLE_TYPES = {
  STANDARD: 'standard',
  HIGH_MAST: 'high_mast',
  SOLAR_STANDALONE: 'solar_standalone',
  HERITAGE: 'heritage',
};

export const LUMINAIRE_TYPES = {
  LED_40W: 'led_40w',
  LED_70W: 'led_70w',
  LED_120W: 'led_120w',
  SODIUM_VAPOR: 'sodium_vapor',
  METAL_HALIDE: 'metal_halide',
};

export const FAULT_CATEGORIES = {
  COMPLETELY_DARK: 'completely_dark',
  FLICKERING_INTERMITTENT: 'flickering_intermittent',
  DAY_BURNING: 'day_burning',
  DAMAGED_POLE: 'damaged_pole',
  EXPOSED_WIRING: 'exposed_wiring',
};

export const FAULT_CATEGORY_LABELS = {
  [FAULT_CATEGORIES.COMPLETELY_DARK]: 'Completely Dark (No Light)',
  [FAULT_CATEGORIES.FLICKERING_INTERMITTENT]: 'Flickering / Cycling On & Off',
  [FAULT_CATEGORIES.DAY_BURNING]: 'Day Burning (Wasting Energy)',
  [FAULT_CATEGORIES.DAMAGED_POLE]: 'Damaged / Leaning Pole Structure',
  [FAULT_CATEGORIES.EXPOSED_WIRING]: 'Exposed Live Wires / Missing Cover (Severe Hazard)',
};

export const REPORT_STATUS = {
  REPORTED: 'reported',
  VERIFIED: 'verified',
  CLUSTERED: 'clustered',
  ASSIGNED: 'assigned',
  RESOLVED: 'resolved',
  DUPLICATE: 'duplicate',
  REJECTED: 'rejected',
};

export const REPORT_STATUS_LABELS = {
  [REPORT_STATUS.REPORTED]: 'Report Submitted',
  [REPORT_STATUS.VERIFIED]: 'Verified by System',
  [REPORT_STATUS.CLUSTERED]: 'Grouped in Outage Corridor',
  [REPORT_STATUS.ASSIGNED]: 'Technician Dispatched',
  [REPORT_STATUS.RESOLVED]: 'Repaired & Operational',
  [REPORT_STATUS.DUPLICATE]: 'Merged Duplicate',
  [REPORT_STATUS.REJECTED]: 'Closed (Invalid / Non-Civic)',
};

export const CLUSTER_STATUS = {
  OPEN: 'open',
  TRIAGED: 'triaged',
  WORK_ORDER_CREATED: 'work_order_created',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
};

export const CLUSTER_STATUS_LABELS = {
  [CLUSTER_STATUS.OPEN]: 'Open (Awaiting Triage)',
  [CLUSTER_STATUS.TRIAGED]: 'Triaged & Prioritized',
  [CLUSTER_STATUS.WORK_ORDER_CREATED]: 'Work Order Dispatched',
  [CLUSTER_STATUS.IN_PROGRESS]: 'Repair In Progress',
  [CLUSTER_STATUS.RESOLVED]: 'Resolved & Verified',
};

export const WORK_ORDER_STATUS = {
  DRAFT: 'draft',
  DISPATCHED: 'dispatched',
  ACKNOWLEDGED: 'acknowledged',
  ON_SITE: 'on_site',
  PARTS_PENDING: 'parts_pending',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
};

export const WORK_ORDER_STATUS_LABELS = {
  [WORK_ORDER_STATUS.DRAFT]: 'Draft Assignment',
  [WORK_ORDER_STATUS.DISPATCHED]: 'Dispatched to Field Crew',
  [WORK_ORDER_STATUS.ACKNOWLEDGED]: 'Crew Acknowledged',
  [WORK_ORDER_STATUS.ON_SITE]: 'Crew On-Site',
  [WORK_ORDER_STATUS.PARTS_PENDING]: 'Pending Parts / Procurement',
  [WORK_ORDER_STATUS.RESOLVED]: 'Repair Completed (Field)',
  [WORK_ORDER_STATUS.CLOSED]: 'Audited & Closed',
};

export const PRIORITY_TIERS = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};

export const PRIORITY_TIER_LABELS = {
  [PRIORITY_TIERS.CRITICAL]: 'Critical (Urgent Safety Risk)',
  [PRIORITY_TIERS.HIGH]: 'High Priority',
  [PRIORITY_TIERS.MEDIUM]: 'Medium Priority',
  [PRIORITY_TIERS.LOW]: 'Low / Routine',
};

export const RESOLUTION_ACTIONS = {
  BULB_DRIVER_REPLACED: 'bulb_driver_replaced',
  CABLE_FAULT_RECTIFIED: 'cable_fault_rectified',
  FIXTURE_REPLACED: 'fixture_replaced',
  POLE_REPAIRED: 'pole_repaired',
  GRID_POWER_RESTORED: 'grid_power_restored',
};

export const RESOLUTION_ACTION_LABELS = {
  [RESOLUTION_ACTIONS.BULB_DRIVER_REPLACED]: 'Replaced Luminaire / LED Driver',
  [RESOLUTION_ACTIONS.CABLE_FAULT_RECTIFIED]: 'Repaired Underground / Overhead Cable Fault',
  [RESOLUTION_ACTIONS.FIXTURE_REPLACED]: 'Replaced Full Fixture / Weatherproof Housing',
  [RESOLUTION_ACTIONS.POLE_REPAIRED]: 'Secured Pole Structure / Replaced Junction Box Cover',
  [RESOLUTION_ACTIONS.GRID_POWER_RESTORED]: 'Restored Grid Feeder / Reset MCB',
};

/**
 * State Transition Maps
 */
export const ALLOWED_REPORT_TRANSITIONS = {
  [REPORT_STATUS.REPORTED]: [REPORT_STATUS.VERIFIED, REPORT_STATUS.CLUSTERED, REPORT_STATUS.DUPLICATE, REPORT_STATUS.REJECTED],
  [REPORT_STATUS.VERIFIED]: [REPORT_STATUS.CLUSTERED, REPORT_STATUS.DUPLICATE, REPORT_STATUS.REJECTED],
  [REPORT_STATUS.CLUSTERED]: [REPORT_STATUS.ASSIGNED, REPORT_STATUS.RESOLVED, REPORT_STATUS.REJECTED],
  [REPORT_STATUS.ASSIGNED]: [REPORT_STATUS.RESOLVED, REPORT_STATUS.REJECTED],
  [REPORT_STATUS.RESOLVED]: [],
  [REPORT_STATUS.DUPLICATE]: [],
  [REPORT_STATUS.REJECTED]: [REPORT_STATUS.REPORTED],
};

export const ALLOWED_CLUSTER_TRANSITIONS = {
  [CLUSTER_STATUS.OPEN]: [CLUSTER_STATUS.TRIAGED, CLUSTER_STATUS.WORK_ORDER_CREATED, CLUSTER_STATUS.RESOLVED],
  [CLUSTER_STATUS.TRIAGED]: [CLUSTER_STATUS.WORK_ORDER_CREATED, CLUSTER_STATUS.IN_PROGRESS, CLUSTER_STATUS.RESOLVED],
  [CLUSTER_STATUS.WORK_ORDER_CREATED]: [CLUSTER_STATUS.IN_PROGRESS, CLUSTER_STATUS.RESOLVED],
  [CLUSTER_STATUS.IN_PROGRESS]: [CLUSTER_STATUS.RESOLVED],
  [CLUSTER_STATUS.RESOLVED]: [CLUSTER_STATUS.OPEN],
};

export const ALLOWED_WORK_ORDER_TRANSITIONS = {
  [WORK_ORDER_STATUS.DRAFT]: [WORK_ORDER_STATUS.DISPATCHED, WORK_ORDER_STATUS.CLOSED],
  [WORK_ORDER_STATUS.DISPATCHED]: [WORK_ORDER_STATUS.ACKNOWLEDGED, WORK_ORDER_STATUS.PARTS_PENDING, WORK_ORDER_STATUS.CLOSED],
  [WORK_ORDER_STATUS.ACKNOWLEDGED]: [WORK_ORDER_STATUS.ON_SITE, WORK_ORDER_STATUS.PARTS_PENDING, WORK_ORDER_STATUS.CLOSED],
  [WORK_ORDER_STATUS.ON_SITE]: [WORK_ORDER_STATUS.PARTS_PENDING, WORK_ORDER_STATUS.RESOLVED, WORK_ORDER_STATUS.CLOSED],
  [WORK_ORDER_STATUS.PARTS_PENDING]: [WORK_ORDER_STATUS.ON_SITE, WORK_ORDER_STATUS.DISPATCHED, WORK_ORDER_STATUS.CLOSED],
  [WORK_ORDER_STATUS.RESOLVED]: [WORK_ORDER_STATUS.CLOSED],
  [WORK_ORDER_STATUS.CLOSED]: [],
};

/**
 * Stable Error Codes
 */
export const STREETLIGHT_ERROR_CODES = {
  NOT_FOUND: 'STREETLIGHT_NOT_FOUND',
  VALIDATION_ERROR: 'STREETLIGHT_VALIDATION_ERROR',
  PERMISSION_DENIED: 'STREETLIGHT_PERMISSION_DENIED',
  UNAUTHENTICATED: 'STREETLIGHT_UNAUTHENTICATED',
  INVALID_STATE_TRANSITION: 'STREETLIGHT_INVALID_STATE_TRANSITION',
  DUPLICATE_REPORT: 'STREETLIGHT_DUPLICATE_REPORT',
  RATE_LIMITED: 'STREETLIGHT_RATE_LIMITED',
  IDEMPOTENCY_CONFLICT: 'STREETLIGHT_IDEMPOTENCY_CONFLICT',
  ROLLBACK_ERROR: 'STREETLIGHT_ROLLBACK_ERROR',
};

/**
 * Capabilities mapping for Role-Based Access Control
 */
export const STREETLIGHT_CAPABILITIES = {
  'report.submit': {
    roles: [STREETLIGHT_ROLES.PUBLIC, STREETLIGHT_ROLES.CITIZEN, STREETLIGHT_ROLES.OPERATOR, STREETLIGHT_ROLES.TECHNICIAN, STREETLIGHT_ROLES.REVIEWER, STREETLIGHT_ROLES.ADMIN],
    description: 'Submit an outage report',
  },
  'report.track': {
    roles: [STREETLIGHT_ROLES.PUBLIC, STREETLIGHT_ROLES.CITIZEN, STREETLIGHT_ROLES.OPERATOR, STREETLIGHT_ROLES.TECHNICIAN, STREETLIGHT_ROLES.REVIEWER, STREETLIGHT_ROLES.ADMIN],
    description: 'Track outage status via tracking token',
  },
  'report.view_public': {
    roles: [STREETLIGHT_ROLES.PUBLIC, STREETLIGHT_ROLES.CITIZEN, STREETLIGHT_ROLES.OPERATOR, STREETLIGHT_ROLES.TECHNICIAN, STREETLIGHT_ROLES.REVIEWER, STREETLIGHT_ROLES.ADMIN],
    description: 'View public anonymized outage map and statistics',
  },
  'cluster.triage': {
    roles: [STREETLIGHT_ROLES.OPERATOR, STREETLIGHT_ROLES.REVIEWER, STREETLIGHT_ROLES.ADMIN],
    description: 'Triage, group, and adjust cluster priorities',
  },
  'cluster.override': {
    roles: [STREETLIGHT_ROLES.OPERATOR, STREETLIGHT_ROLES.REVIEWER, STREETLIGHT_ROLES.ADMIN],
    description: 'Override automated cluster priority scoring with explicit reason',
  },
  'workOrder.create': {
    roles: [STREETLIGHT_ROLES.OPERATOR, STREETLIGHT_ROLES.ADMIN],
    description: 'Create and dispatch repair work orders',
  },
  'workOrder.update': {
    roles: [STREETLIGHT_ROLES.TECHNICIAN, STREETLIGHT_ROLES.OPERATOR, STREETLIGHT_ROLES.ADMIN],
    description: 'Update work order status (acknowledge, on site, parts pending)',
  },
  'workOrder.reassign': {
    roles: [STREETLIGHT_ROLES.OPERATOR, STREETLIGHT_ROLES.ADMIN],
    description: 'Reassign work order to another crew or technician',
  },
  'inspection.manage': {
    roles: [STREETLIGHT_ROLES.OPERATOR, STREETLIGHT_ROLES.REVIEWER, STREETLIGHT_ROLES.ADMIN],
    description: 'Schedule and manage periodic streetlight inspection patrols',
  },
  'repair.record': {
    roles: [STREETLIGHT_ROLES.TECHNICIAN, STREETLIGHT_ROLES.OPERATOR, STREETLIGHT_ROLES.ADMIN],
    description: 'Record repair completion, parts used, and outcome evidence',
  },
  'asset.manage': {
    roles: [STREETLIGHT_ROLES.OPERATOR, STREETLIGHT_ROLES.ADMIN],
    description: 'Add or modify pole assets in municipal inventory',
  },
  'admin.migration': {
    roles: [STREETLIGHT_ROLES.ADMIN],
    description: 'Run data migrations, rebuild indexes, and trigger rollbacks',
  },
  'audit.read': {
    roles: [STREETLIGHT_ROLES.REVIEWER, STREETLIGHT_ROLES.ADMIN],
    description: 'Read the full tamper-evident audit trail',
  },
};
