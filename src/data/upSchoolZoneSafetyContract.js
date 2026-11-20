/**
 * Uttar Pradesh School-Zone Road Safety Hazard & Safe-Crossing Audit Contract
 * Grounded in IRC:SP:88, IRC:99 (Traffic Calming), and RTE Act 2009 Section 21
 */

export const UP_SCHOOL_ZONE_SCHEMA_VERSION = 1;

export const UP_SCHOOL_ZONE_STORAGE_KEYS = {
  SCHOOLS: 'civicbridge_up_school_zones_v1',
  AUDITS: 'civicbridge_up_school_audits_v1',
  REPORTERS: 'civicbridge_up_school_reporters_v1',
  OVERRIDES: 'civicbridge_up_jurisdiction_overrides_v1',
};

/**
 * Audit Hazard Categories (IRC:SP:88 & Safe School Zone Guidelines)
 */
export const HAZARD_TYPES = {
  MISSING_ZEBRA_CROSSING: 'missing_zebra_crossing',
  BLOCKED_FOOTPATH: 'blocked_footpath',
  SPEEDING_TRAFFIC_NO_CALMING: 'speeding_traffic_no_calming',
  ABSENT_SIGNAGE: 'absent_signage',
  POOR_VISIBILITY: 'poor_visibility',
  DRAINAGE_WATERLOGGING: 'drainage_waterlogging',
  PICKUP_DROPOFF_CONFLICT: 'pickup_dropoff_conflict',
};

export const HAZARD_TYPE_LABELS = {
  [HAZARD_TYPES.MISSING_ZEBRA_CROSSING]: 'Missing or Faded Zebra Crossing',
  [HAZARD_TYPES.BLOCKED_FOOTPATH]: 'Blocked, Broken or Absent Footpath',
  [HAZARD_TYPES.SPEEDING_TRAFFIC_NO_CALMING]: 'Speeding Traffic & Missing Speed Breaker / Calming',
  [HAZARD_TYPES.ABSENT_SIGNAGE]: 'Absent School-Zone Warning & 25 km/h Speed Limit Signage',
  [HAZARD_TYPES.POOR_VISIBILITY]: 'Poor Visibility, Blind Curve or Obstructed Sightlines',
  [HAZARD_TYPES.DRAINAGE_WATERLOGGING]: 'Drainage Overflow / Waterlogging Outside School Gate',
  [HAZARD_TYPES.PICKUP_DROPOFF_CONFLICT]: 'Unsafe School-Gate Pickup/Drop-Off Conflicts',
};

export const HAZARD_TYPE_DESCRIPTIONS = {
  [HAZARD_TYPES.MISSING_ZEBRA_CROSSING]:
    'Pedestrian crossing marks are either absent, severely faded, or lack designated refuge islands across multi-lane carriage-ways.',
  [HAZARD_TYPES.BLOCKED_FOOTPATH]:
    'Continuous walking pavement is absent, obstructed by debris/encroachments, or pavers are broken, forcing children into motorized traffic lanes.',
  [HAZARD_TYPES.SPEEDING_TRAFFIC_NO_CALMING]:
    'Motor vehicles travel at unrestricted speeds near the school entrance due to absent rumble strips, table-top crossings, or speed humps.',
  [HAZARD_TYPES.ABSENT_SIGNAGE]:
    'IRC standard triangular school-ahead warning boards, flashing caution beacons, or 25 km/h school-approach speed boards are missing.',
  [HAZARD_TYPES.POOR_VISIBILITY]:
    'Drivers cannot see crossing children in time due to sharp blind curves, overgrown trees, or parked commercial trucks and buses.',
  [HAZARD_TYPES.DRAINAGE_WATERLOGGING]:
    'Rainwater or wastewater pools across the school entrance approach, hiding open drains and potholes and preventing safe pedestrian crossing.',
  [HAZARD_TYPES.PICKUP_DROPOFF_CONFLICT]:
    'Chaotic mix of school vans, auto-rickshaws, e-rickshaws, and two-wheelers jostling with high-speed through-traffic at opening and bell times.',
};

/**
 * Severity Levels and Weights
 */
export const HAZARD_SEVERITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

export const SEVERITY_LEVEL_LABELS = {
  [HAZARD_SEVERITY_LEVELS.LOW]: 'Low Priority (Advisory / Maintenance)',
  [HAZARD_SEVERITY_LEVELS.MEDIUM]: 'Moderate Hazard (Intervention Required)',
  [HAZARD_SEVERITY_LEVELS.HIGH]: 'High Hazard (Immediate Risk during Bell Times)',
  [HAZARD_SEVERITY_LEVELS.CRITICAL]: 'Critical Danger (Active Vulnerability to Child Pedestrians)',
};

/**
 * Road Ownership Classifications for Uttar Pradesh
 */
export const ROAD_AUTHORITIES = {
  MUNICIPAL_CORPORATION: 'municipal_corporation',
  UP_PWD: 'up_pwd',
  NHAI: 'nhai',
  DEVELOPMENT_AUTHORITY: 'development_authority',
  GRAM_PANCHAYAT: 'gram_panchayat',
  OTHER_UNKNOWN: 'other_unknown',
};

export const ROAD_AUTHORITY_METADATA = {
  [ROAD_AUTHORITIES.MUNICIPAL_CORPORATION]: {
    label: 'Municipal Corporation (Nagar Nigam / Urban Local Body)',
    shortName: 'Nagar Nigam',
    department: 'Civil Engineering & Traffic Infrastructure Cell',
    scope: 'Urban internal ward streets, municipal colony roads, and local feeder lanes',
    defaultEscalationDays: 14,
  },
  [ROAD_AUTHORITIES.UP_PWD]: {
    label: 'Uttar Pradesh Public Works Department (UP PWD)',
    shortName: 'UP PWD',
    department: 'Provincial Division / Road Safety Cell',
    scope: 'Major District Roads (MDR), Other District Roads (ODR), and State Highways (SH)',
    defaultEscalationDays: 21,
  },
  [ROAD_AUTHORITIES.NHAI]: {
    label: 'National Highways Authority of India (NHAI)',
    shortName: 'NHAI',
    department: 'Project Implementation Unit (PIU)',
    scope: 'National Highways, grade-separated corridors, and designated highway service bypasses',
    defaultEscalationDays: 30,
  },
  [ROAD_AUTHORITIES.DEVELOPMENT_AUTHORITY]: {
    label: 'Urban Development Authority (e.g. LDA, KDA)',
    shortName: 'Development Authority',
    department: 'Engineering & Master Planning Wing',
    scope: 'Planned urban development sector roads prior to municipal handover',
    defaultEscalationDays: 21,
  },
  [ROAD_AUTHORITIES.GRAM_PANCHAYAT]: {
    label: 'Gram Panchayat & Rural Engineering Department (RED)',
    shortName: 'Gram Panchayat / RED',
    department: 'Panchayati Raj Rural Road Wing / PMGSY Cell',
    scope: 'Village approach link roads, hamlet tracks, and rural school access routes',
    defaultEscalationDays: 28,
  },
  [ROAD_AUTHORITIES.OTHER_UNKNOWN]: {
    label: 'Other / Multi-Agency Disputed Jurisdiction',
    shortName: 'Inter-Agency',
    department: 'District Road Safety Committee (DRSC)',
    scope: 'Unclassified or contested boundary corridors',
    defaultEscalationDays: 15,
  },
};

/**
 * Audit Lifecycle State Machine
 */
export const AUDIT_STATUSES = {
  REPORTED: 'reported',
  ACKNOWLEDGED: 'acknowledged',
  INSPECTION_SCHEDULED: 'inspection_scheduled',
  INSPECTED: 'inspected',
  INTERIM_MEASURE_IMPLEMENTED: 'interim_measure_implemented',
  RESOLVED: 'resolved',
  TRANSFERRED: 'transferred',
};

export const AUDIT_STATUS_LABELS = {
  [AUDIT_STATUSES.REPORTED]: 'Audit Submitted',
  [AUDIT_STATUSES.ACKNOWLEDGED]: 'Acknowledged by Road Authority',
  [AUDIT_STATUSES.INSPECTION_SCHEDULED]: 'Field Inspection Scheduled',
  [AUDIT_STATUSES.INSPECTED]: 'Site Inspection Completed',
  [AUDIT_STATUSES.INTERIM_MEASURE_IMPLEMENTED]: 'Interim Safety Measure Implemented',
  [AUDIT_STATUSES.RESOLVED]: 'Permanently Resolved',
  [AUDIT_STATUSES.TRANSFERRED]: 'Jurisdiction Transferred',
};

/**
 * Valid transitions.
 * Strict Invariant: Cannot move directly from ACKNOWLEDGED to RESOLVED.
 */
export const ALLOWED_STATUS_TRANSITIONS = {
  [AUDIT_STATUSES.REPORTED]: [
    AUDIT_STATUSES.ACKNOWLEDGED,
    AUDIT_STATUSES.TRANSFERRED,
  ],
  [AUDIT_STATUSES.ACKNOWLEDGED]: [
    AUDIT_STATUSES.INSPECTION_SCHEDULED,
    AUDIT_STATUSES.INSPECTED,
    AUDIT_STATUSES.INTERIM_MEASURE_IMPLEMENTED,
    AUDIT_STATUSES.TRANSFERRED,
    // Note: AUDIT_STATUSES.RESOLVED is intentionally excluded here.
  ],
  [AUDIT_STATUSES.INSPECTION_SCHEDULED]: [
    AUDIT_STATUSES.INSPECTED,
    AUDIT_STATUSES.TRANSFERRED,
  ],
  [AUDIT_STATUSES.INSPECTED]: [
    AUDIT_STATUSES.INTERIM_MEASURE_IMPLEMENTED,
    AUDIT_STATUSES.RESOLVED,
    AUDIT_STATUSES.TRANSFERRED,
  ],
  [AUDIT_STATUSES.INTERIM_MEASURE_IMPLEMENTED]: [
    AUDIT_STATUSES.RESOLVED,
    AUDIT_STATUSES.INSPECTION_SCHEDULED,
  ],
  [AUDIT_STATUSES.RESOLVED]: [
    // Terminal unless reopened if hazard returns
    AUDIT_STATUSES.REPORTED,
  ],
  [AUDIT_STATUSES.TRANSFERRED]: [
    AUDIT_STATUSES.ACKNOWLEDGED,
  ],
};

/**
 * Validates state transition according to statutory rules.
 */
export const canTransitionAuditStatus = (currentStatus, targetStatus) => {
  if (!currentStatus || !targetStatus) {
    return {
      allowed: false,
      reason: 'Both currentStatus and targetStatus are required.',
    };
  }

  if (currentStatus === targetStatus) {
    return {
      allowed: false,
      reason: `Audit is already in status "${AUDIT_STATUS_LABELS[currentStatus] || currentStatus}".`,
    };
  }

  // Explicit check for the key Acceptance Criterion rule
  if (currentStatus === AUDIT_STATUSES.ACKNOWLEDGED && targetStatus === AUDIT_STATUSES.RESOLVED) {
    return {
      allowed: false,
      reason:
        'A report cannot be marked resolved solely because it was acknowledged. A verified site inspection or interim safety measure must be documented first.',
    };
  }

  const allowedNext = ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];
  if (!allowedNext.includes(targetStatus)) {
    return {
      allowed: false,
      reason: `Illegal state transition from "${AUDIT_STATUS_LABELS[currentStatus] || currentStatus}" to "${AUDIT_STATUS_LABELS[targetStatus] || targetStatus}".`,
    };
  }

  return { allowed: true };
};

/**
 * Non-accusatory ethical legal notice
 */
export const NON_LEGAL_FAULT_DISCLAIMER =
  'This community safety audit constitutes an empirical civil observation of physical road safety infrastructure for School Management Committees (SMCs) and road-owning authorities. It does not determine legal liability, negligence, or statutory traffic fault.';

/**
 * Indian & UP Vehicle registration number plate regex for text sanitization
 */
export const VEHICLE_PLATE_REGEX =
  /\b(?:UP|DL|HR|MP|BR|RJ|MH|KA|TN|TS|WB|UK|UA|CH|PB)[-\s]?[0-9]{1,2}[-\s]?[A-Z]{1,3}[-\s]?[0-9]{4}\b/gi;

/**
 * Sanitize text descriptions to avoid leaking vehicle registration numbers or phone numbers
 */
export const sanitizeAuditText = (text = '') => {
  if (typeof text !== 'string') return '';
  return text
    .replace(VEHICLE_PLATE_REGEX, '[REDACTED_VEHICLE_NO]')
    .replace(/(?<![\d])(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}(?![\d])/g, '[REDACTED_PHONE]');
};
