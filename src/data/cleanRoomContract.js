/**
 * Privacy-Safe Civic Data Clean Room Contract & Validation Layer (#1164)
 *
 * Defines versioned schemas, allowable aggregate operations, k-anonymity
 * suppression thresholds, query budget policies, differencing detection constants,
 * and trust-boundary validation routines.
 */

export const CLEAN_ROOM_SCHEMA_VERSION = '1.0.0';

/**
 * Workspace lifecycle states
 */
export const WORKSPACE_STATUS = Object.freeze({
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  SUSPENDED: 'suspended',
  EXPIRED: 'expired',
  REJECTED: 'rejected',
});

/**
 * Partner tiers with associated baseline query budgets
 */
export const PARTNER_TIERS = Object.freeze({
  ACADEMIC_RESEARCH: {
    id: 'academic_research',
    label: 'Academic & University Research',
    defaultQueryBudget: 60,
    defaultEpsilonBudget: 6.0,
    maxConcurrentQueries: 3,
  },
  CIVIC_NGO: {
    id: 'civic_ngo',
    label: 'Public Interest Civic NGO',
    defaultQueryBudget: 40,
    defaultEpsilonBudget: 4.0,
    maxConcurrentQueries: 2,
  },
  MUNICIPAL_PLANNING: {
    id: 'municipal_planning',
    label: 'Municipal Planning & Urban Agency',
    defaultQueryBudget: 100,
    defaultEpsilonBudget: 10.0,
    maxConcurrentQueries: 5,
  },
});

/**
 * Allowlisted Clean Room Datasets
 * Note: Raw citizen PII (Aadhaar, Phone, PAN, Name, Street Address, unmasked GPS)
 * is strictly banned by schema design and omitted from Clean Room views.
 */
export const ALLOWED_DATASET_IDS = Object.freeze({
  WARD_SERVICE_DEMAND: 'ward_service_demand',
  WELFARE_SCHEME_REACH: 'welfare_scheme_reach',
  INFRASTRUCTURE_DEFECTS: 'civic_infrastructure_defects',
});

/**
 * Dataset Schema Definitions
 */
export const DATASET_CATALOG = Object.freeze({
  [ALLOWED_DATASET_IDS.WARD_SERVICE_DEMAND]: {
    id: ALLOWED_DATASET_IDS.WARD_SERVICE_DEMAND,
    title: 'Ward Service Demand & Resolution Metrics',
    description: 'Anonymized civic service request volumes, categories, and resolution timelines by municipal ward.',
    dimensions: ['ward_id', 'service_category', 'priority', 'resolution_status', 'fiscal_quarter'],
    metrics: ['resolution_days', 'satisfaction_score'],
    prohibitedColumns: ['citizen_name', 'phone_number', 'aadhaar_sha256', 'raw_address', 'ip_address'],
  },
  [ALLOWED_DATASET_IDS.WELFARE_SCHEME_REACH]: {
    id: ALLOWED_DATASET_IDS.WELFARE_SCHEME_REACH,
    title: 'Welfare Scheme Application Reach & Timelines',
    description: 'Aggregated welfare benefit intake cohorts, processing windows, and statutory resolution categories.',
    dimensions: ['scheme_id', 'district', 'age_cohort', 'applicant_category', 'application_status'],
    metrics: ['processing_days', 'entitlement_amount'],
    prohibitedColumns: ['beneficiary_name', 'bank_account', 'pan_number', 'family_tree_id', 'biometric_hash'],
  },
  [ALLOWED_DATASET_IDS.INFRASTRUCTURE_DEFECTS]: {
    id: ALLOWED_DATASET_IDS.INFRASTRUCTURE_DEFECTS,
    title: 'Civic Infrastructure Defect & Maintenance Registry',
    description: 'De-identified infrastructure defects (road potholes, water leakage, street lighting outages) and repair turnaround.',
    dimensions: ['ward_id', 'asset_type', 'defect_severity', 'repair_status', 'reporting_month'],
    metrics: ['repair_turnaround_days', 'estimated_cost_inr'],
    prohibitedColumns: ['reporter_contact', 'exact_gps_lat', 'exact_gps_lng', 'raw_photo_blob'],
  },
});

/**
 * Allowed Aggregation Functions (Non-Row-Level)
 */
export const ALLOWED_AGGREGATIONS = Object.freeze({
  COUNT: 'COUNT',
  AVG: 'AVG',
  SUM: 'SUM',
  MIN: 'MIN',
  MAX: 'MAX',
  MEDIAN: 'MEDIAN',
});

/**
 * Standard Privacy Thresholds
 */
export const PRIVACY_THRESHOLDS = Object.freeze({
  /** Minimum bucket count for k-anonymity. Counts below this are suppressed. */
  MIN_K_ANONYMITY: 10,
  /** Minimum cardinality difference between successive queries to prevent differencing attacks */
  MIN_DIFFERENCING_DELTA: 5,
  /** Default epsilon consumption per executed query template */
  DEFAULT_EPSILON_PER_QUERY: 0.1,
  /** Maximum allowable history window (in queries) inspected for differencing */
  DIFFERENCING_WINDOW_SIZE: 20,
});

/**
 * Clean Room Error Codes
 */
export const CLEAN_ROOM_ERROR_CODES = Object.freeze({
  WORKSPACE_NOT_FOUND: 'CLEAN_ROOM_WORKSPACE_NOT_FOUND',
  WORKSPACE_NOT_ACTIVE: 'CLEAN_ROOM_WORKSPACE_NOT_ACTIVE',
  DATASET_NOT_PERMITTED: 'CLEAN_ROOM_DATASET_NOT_PERMITTED',
  TEMPLATE_NOT_PERMITTED: 'CLEAN_ROOM_TEMPLATE_NOT_PERMITTED',
  INVALID_PARAMETERS: 'CLEAN_ROOM_INVALID_PARAMETERS',
  BUDGET_EXHAUSTED: 'CLEAN_ROOM_BUDGET_EXHAUSTED',
  DIFFERENCING_ATTACK_DETECTED: 'CLEAN_ROOM_DIFFERENCING_ATTACK_DETECTED',
  THRESHOLD_VIOLATION: 'CLEAN_ROOM_THRESHOLD_VIOLATION',
  APPROVAL_REQUIRED: 'CLEAN_ROOM_APPROVAL_REQUIRED',
  RE_IDENTIFICATION_RISK: 'CLEAN_ROOM_RE_IDENTIFICATION_RISK',
});

/**
 * Approved Query Templates
 */
export const QUERY_TEMPLATES = Object.freeze([
  {
    id: 'TPL_WARD_SERVICE_SUMMARY',
    title: 'Ward Service Demand by Category',
    description: 'Computes total request count and average resolution days grouped by ward and service category.',
    datasetId: ALLOWED_DATASET_IDS.WARD_SERVICE_DEMAND,
    groupDimensions: ['ward_id', 'service_category'],
    aggregations: [
      { field: 'record_id', func: ALLOWED_AGGREGATIONS.COUNT, alias: 'total_requests' },
      { field: 'resolution_days', func: ALLOWED_AGGREGATIONS.AVG, alias: 'avg_resolution_days' },
    ],
    supportedFilters: [
      { key: 'ward_id', label: 'Municipal Ward', type: 'select_multiple' },
      { key: 'fiscal_quarter', label: 'Fiscal Quarter', type: 'select_single' },
      { key: 'resolution_status', label: 'Status', type: 'select_single' },
    ],
    epsilonCost: 0.1,
  },
  {
    id: 'TPL_WELFARE_PROCESSING_TIMES',
    title: 'Welfare Processing Times by Scheme & District',
    description: 'Computes total applications and median processing days across districts and welfare schemes.',
    datasetId: ALLOWED_DATASET_IDS.WELFARE_SCHEME_REACH,
    groupDimensions: ['scheme_id', 'district'],
    aggregations: [
      { field: 'record_id', func: ALLOWED_AGGREGATIONS.COUNT, alias: 'applicant_count' },
      { field: 'processing_days', func: ALLOWED_AGGREGATIONS.MEDIAN, alias: 'median_processing_days' },
    ],
    supportedFilters: [
      { key: 'scheme_id', label: 'Welfare Scheme', type: 'select_multiple' },
      { key: 'applicant_category', label: 'Cohort Category', type: 'select_single' },
      { key: 'district', label: 'District', type: 'select_multiple' },
    ],
    epsilonCost: 0.15,
  },
  {
    id: 'TPL_INFRASTRUCTURE_SEVERITY_OVERVIEW',
    title: 'Infrastructure Defects by Asset & Severity',
    description: 'Computes reported defect count and average turnaround days grouped by asset type and defect severity.',
    datasetId: ALLOWED_DATASET_IDS.INFRASTRUCTURE_DEFECTS,
    groupDimensions: ['asset_type', 'defect_severity'],
    aggregations: [
      { field: 'record_id', func: ALLOWED_AGGREGATIONS.COUNT, alias: 'defect_count' },
      { field: 'repair_turnaround_days', func: ALLOWED_AGGREGATIONS.AVG, alias: 'avg_turnaround_days' },
    ],
    supportedFilters: [
      { key: 'ward_id', label: 'Ward', type: 'select_multiple' },
      { key: 'defect_severity', label: 'Severity Level', type: 'select_single' },
      { key: 'repair_status', label: 'Repair Status', type: 'select_single' },
    ],
    epsilonCost: 0.1,
  },
]);

/**
 * Validates a Partner Workspace creation or update payload
 */
export function validateWorkspaceContract(workspace) {
  const errors = [];
  if (!workspace || typeof workspace !== 'object') {
    return { valid: false, errors: ['Workspace must be an object'] };
  }

  if (!workspace.partnerName || typeof workspace.partnerName !== 'string' || workspace.partnerName.trim().length < 3) {
    errors.push('Partner name must be at least 3 characters');
  }

  if (!workspace.partnerOrg || typeof workspace.partnerOrg !== 'string' || workspace.partnerOrg.trim().length < 3) {
    errors.push('Partner organization is required');
  }

  if (!workspace.partnerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(workspace.partnerEmail)) {
    errors.push('Valid partner email is required');
  }

  const validTiers = Object.values(PARTNER_TIERS).map((t) => t.id);
  if (!workspace.tier || !validTiers.includes(workspace.tier)) {
    errors.push(`Tier must be one of: ${validTiers.join(', ')}`);
  }

  if (!Array.isArray(workspace.approvedDatasets) || workspace.approvedDatasets.length === 0) {
    errors.push('At least one approved dataset must be requested');
  } else {
    const validDatasets = Object.values(ALLOWED_DATASET_IDS);
    const unknown = workspace.approvedDatasets.filter((d) => !validDatasets.includes(d));
    if (unknown.length > 0) {
      errors.push(`Invalid datasets requested: ${unknown.join(', ')}`);
    }
  }

  if (workspace.queryBudgetTotal !== undefined && (typeof workspace.queryBudgetTotal !== 'number' || workspace.queryBudgetTotal <= 0)) {
    errors.push('queryBudgetTotal must be a positive number');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a query execution request at the trust boundary
 */
export function validateQueryExecutionRequest(request, availableTemplates = QUERY_TEMPLATES, workspace = null) {
  const errors = [];
  if (!request || typeof request !== 'object') {
    return { valid: false, errors: ['Query request must be an object'] };
  }

  if (!request.workspaceId || typeof request.workspaceId !== 'string') {
    errors.push('Valid workspaceId is required');
  }

  if (!request.templateId || typeof request.templateId !== 'string') {
    errors.push('Valid templateId is required');
  }

  const template = availableTemplates.find((t) => t.id === request.templateId);
  if (!template) {
    errors.push(`Template ${request.templateId} is not an authorized query template`);
    return { valid: false, errors };
  }

  // Check workspace dataset authorization if workspace provided
  if (workspace) {
    if (workspace.status !== WORKSPACE_STATUS.APPROVED) {
      errors.push(`Workspace status is ${workspace.status}; only approved workspaces can execute queries`);
    }

    if (!workspace.approvedDatasets?.includes(template.datasetId)) {
      errors.push(`Workspace is not authorized for dataset: ${template.datasetId}`);
    }

    if (workspace.queryBudgetRemaining <= 0) {
      errors.push('Workspace query budget is exhausted');
    }
  }

  // Validate filter parameters against template
  if (request.filters && typeof request.filters !== 'object') {
    errors.push('Filters must be an object if provided');
  } else if (request.filters) {
    const supportedKeys = template.supportedFilters.map((f) => f.key);
    for (const [key, value] of Object.entries(request.filters)) {
      if (!supportedKeys.includes(key)) {
        errors.push(`Filter key '${key}' is not allowed for template ${template.id}`);
        continue;
      }
      if (typeof value === 'string' && value.length > 100) {
        errors.push(`Filter value for '${key}' exceeds max length 100`);
      }
      // Check SQL injection-like patterns
      if (typeof value === 'string' && /('|"|;|--|\/\*|\*\/|UNION|SELECT|DROP|INSERT)/i.test(value)) {
        errors.push(`Potentially unsafe characters detected in filter '${key}'`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    template,
  };
}

/**
 * Validates Data Steward Approval / Rejection Decision
 */
export function validateApprovalDecision(decision) {
  const errors = [];
  if (!decision || typeof decision !== 'object') {
    return { valid: false, errors: ['Decision payload must be an object'] };
  }

  if (!decision.decision || !['approve', 'reject'].includes(decision.decision)) {
    errors.push("Decision must be either 'approve' or 'reject'");
  }

  if (!decision.stewardId || typeof decision.stewardId !== 'string') {
    errors.push('Steward identifier is required');
  }

  if (decision.decision === 'reject' && (!decision.reason || decision.reason.trim().length < 10)) {
    errors.push('A substantive rejection reason (at least 10 chars) is mandatory for auditability');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
