/**
 * Public Grievance SLA Forecasting and Bottleneck Analytics Contract (#1175)
 * Strict domain entities, enums, schema validation, zero-PII guarantee, and synthetic fixtures.
 * Version: v1.0.0
 */

export const GRIEVANCE_FORECAST_ENGINE_VERSION = 'v1.0.0-cohort-km';

export const JURISDICTIONS = {
  DELHI_CENTRAL: 'DELHI_CENTRAL',
  MUMBAI_METRO: 'MUMBAI_METRO',
  BENGALURU_URBAN: 'BENGALURU_URBAN',
  PUNE_DISTRICT: 'PUNE_DISTRICT',
  LUCKNOW_DISTRICT: 'LUCKNOW_DISTRICT',
  CHENNAI_CORP: 'CHENNAI_CORP',
};

export const GRIEVANCE_CATEGORIES = {
  RATION_CARD_PDS: 'RATION_CARD_PDS',
  PENSION_SOCIAL_WELFARE: 'PENSION_SOCIAL_WELFARE',
  MUNICIPAL_WATER_SANITATION: 'MUNICIPAL_WATER_SANITATION',
  REVENUE_CERTIFICATES: 'REVENUE_CERTIFICATES',
  ROAD_INFRASTRUCTURE: 'ROAD_INFRASTRUCTURE',
  ELECTRICITY_SUPPLY: 'ELECTRICITY_SUPPLY',
};

export const RESOLUTION_STATUS = {
  RESOLVED: 'RESOLVED',
  PENDING: 'PENDING',
  ESCALATED: 'ESCALATED',
  REJECTED: 'REJECTED',
};

export const BOTTLENECK_STAGES = {
  INTAKE_TRIAGE: 'INTAKE_TRIAGE',
  FIELD_INSPECTION: 'FIELD_INSPECTION',
  DEPARTMENT_REVIEW: 'DEPARTMENT_REVIEW',
  APPELLATE_REVIEW: 'APPELLATE_REVIEW',
  CLOSURE_DISPATCH: 'CLOSURE_DISPATCH',
};

export const ACTION_RECOMMENDATION_STATUS = {
  PROPOSED: 'PROPOSED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  EXECUTED: 'EXECUTED',
};

export const RISK_LEVELS = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
};

/**
 * Statutory SLA benchmarks in calendar days under state Right to Service / Citizens Charter acts.
 */
export const STATUTORY_SLA_DAYS = {
  [GRIEVANCE_CATEGORIES.RATION_CARD_PDS]: 30,
  [GRIEVANCE_CATEGORIES.PENSION_SOCIAL_WELFARE]: 45,
  [GRIEVANCE_CATEGORIES.MUNICIPAL_WATER_SANITATION]: 7,
  [GRIEVANCE_CATEGORIES.REVENUE_CERTIFICATES]: 15,
  [GRIEVANCE_CATEGORIES.ROAD_INFRASTRUCTURE]: 21,
  [GRIEVANCE_CATEGORIES.ELECTRICITY_SUPPLY]: 14,
};

/**
 * Strict threshold for k-anonymity / differential privacy suppression.
 * Cohorts with fewer than MIN_COHORT_SAMPLE_SIZE cases are masked/suppressed.
 */
export const MIN_COHORT_SAMPLE_SIZE = 10;

/**
 * Stage bottleneck benchmark thresholds (in days).
 * Stages exceeding these benchmarks trigger triage recommendations.
 */
export const STAGE_BENCHMARK_DAYS = {
  [BOTTLENECK_STAGES.INTAKE_TRIAGE]: 2,
  [BOTTLENECK_STAGES.FIELD_INSPECTION]: 7,
  [BOTTLENECK_STAGES.DEPARTMENT_REVIEW]: 10,
  [BOTTLENECK_STAGES.APPELLATE_REVIEW]: 15,
  [BOTTLENECK_STAGES.CLOSURE_DISPATCH]: 3,
};

/**
 * Synthetic Historical Grievance Cohorts
 * Fully anonymized, zero individual citizen PII.
 * Contains observed durations (days), missingness indicators, and stage breakdown.
 */
export const SYNTHETIC_GRIEVANCE_COHORTS = [
  {
    cohortId: 'coh_dl_water_q1_2026',
    jurisdiction: JURISDICTIONS.DELHI_CENTRAL,
    category: GRIEVANCE_CATEGORIES.MUNICIPAL_WATER_SANITATION,
    period: '2026-Q1',
    sampleSize: 85,
    missingDataCount: 3,
    durationsDays: [4, 5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 9, 9, 10, 11, 12, 14, 15],
    stageDurations: {
      [BOTTLENECK_STAGES.INTAKE_TRIAGE]: 1.8,
      [BOTTLENECK_STAGES.FIELD_INSPECTION]: 4.2,
      [BOTTLENECK_STAGES.DEPARTMENT_REVIEW]: 2.1,
      [BOTTLENECK_STAGES.APPELLATE_REVIEW]: 0.5,
      [BOTTLENECK_STAGES.CLOSURE_DISPATCH]: 1.1,
    },
    statutorySlaDays: 7,
    observedBreachRate: 0.38,
  },
  {
    cohortId: 'coh_dl_ration_q1_2026',
    jurisdiction: JURISDICTIONS.DELHI_CENTRAL,
    category: GRIEVANCE_CATEGORIES.RATION_CARD_PDS,
    period: '2026-Q1',
    sampleSize: 120,
    missingDataCount: 8,
    durationsDays: [18, 20, 22, 24, 25, 27, 28, 29, 30, 31, 33, 35, 38, 42, 45],
    stageDurations: {
      [BOTTLENECK_STAGES.INTAKE_TRIAGE]: 3.5,
      [BOTTLENECK_STAGES.FIELD_INSPECTION]: 12.0,
      [BOTTLENECK_STAGES.DEPARTMENT_REVIEW]: 9.5,
      [BOTTLENECK_STAGES.APPELLATE_REVIEW]: 4.0,
      [BOTTLENECK_STAGES.CLOSURE_DISPATCH]: 2.0,
    },
    statutorySlaDays: 30,
    observedBreachRate: 0.42,
  },
  {
    cohortId: 'coh_mum_revenue_q1_2026',
    jurisdiction: JURISDICTIONS.MUMBAI_METRO,
    category: GRIEVANCE_CATEGORIES.REVENUE_CERTIFICATES,
    period: '2026-Q1',
    sampleSize: 95,
    missingDataCount: 2,
    durationsDays: [8, 9, 10, 11, 12, 13, 14, 14, 15, 16, 17, 18, 19, 22],
    stageDurations: {
      [BOTTLENECK_STAGES.INTAKE_TRIAGE]: 1.5,
      [BOTTLENECK_STAGES.FIELD_INSPECTION]: 3.0,
      [BOTTLENECK_STAGES.DEPARTMENT_REVIEW]: 6.5,
      [BOTTLENECK_STAGES.APPELLATE_REVIEW]: 2.0,
      [BOTTLENECK_STAGES.CLOSURE_DISPATCH]: 1.0,
    },
    statutorySlaDays: 15,
    observedBreachRate: 0.28,
  },
  {
    cohortId: 'coh_mum_pension_q1_2026',
    jurisdiction: JURISDICTIONS.MUMBAI_METRO,
    category: GRIEVANCE_CATEGORIES.PENSION_SOCIAL_WELFARE,
    period: '2026-Q1',
    sampleSize: 64,
    missingDataCount: 5,
    durationsDays: [25, 28, 30, 32, 35, 39, 41, 44, 45, 48, 52, 58, 62],
    stageDurations: {
      [BOTTLENECK_STAGES.INTAKE_TRIAGE]: 4.0,
      [BOTTLENECK_STAGES.FIELD_INSPECTION]: 14.5,
      [BOTTLENECK_STAGES.DEPARTMENT_REVIEW]: 16.0,
      [BOTTLENECK_STAGES.APPELLATE_REVIEW]: 5.5,
      [BOTTLENECK_STAGES.CLOSURE_DISPATCH]: 3.0,
    },
    statutorySlaDays: 45,
    observedBreachRate: 0.35,
  },
  {
    cohortId: 'coh_blr_road_q1_2026',
    jurisdiction: JURISDICTIONS.BENGALURU_URBAN,
    category: GRIEVANCE_CATEGORIES.ROAD_INFRASTRUCTURE,
    period: '2026-Q1',
    sampleSize: 110,
    missingDataCount: 4,
    durationsDays: [12, 14, 15, 17, 18, 19, 20, 21, 23, 25, 28, 32, 36],
    stageDurations: {
      [BOTTLENECK_STAGES.INTAKE_TRIAGE]: 2.0,
      [BOTTLENECK_STAGES.FIELD_INSPECTION]: 8.5,
      [BOTTLENECK_STAGES.DEPARTMENT_REVIEW]: 7.0,
      [BOTTLENECK_STAGES.APPELLATE_REVIEW]: 2.5,
      [BOTTLENECK_STAGES.CLOSURE_DISPATCH]: 1.5,
    },
    statutorySlaDays: 21,
    observedBreachRate: 0.31,
  },
  {
    cohortId: 'coh_pune_water_q1_2026',
    jurisdiction: JURISDICTIONS.PUNE_DISTRICT,
    category: GRIEVANCE_CATEGORIES.MUNICIPAL_WATER_SANITATION,
    period: '2026-Q1',
    sampleSize: 52,
    missingDataCount: 1,
    durationsDays: [3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 9, 10, 11],
    stageDurations: {
      [BOTTLENECK_STAGES.INTAKE_TRIAGE]: 1.2,
      [BOTTLENECK_STAGES.FIELD_INSPECTION]: 2.8,
      [BOTTLENECK_STAGES.DEPARTMENT_REVIEW]: 1.5,
      [BOTTLENECK_STAGES.APPELLATE_REVIEW]: 0.5,
      [BOTTLENECK_STAGES.CLOSURE_DISPATCH]: 0.8,
    },
    statutorySlaDays: 7,
    observedBreachRate: 0.22,
  },
  {
    cohortId: 'coh_lucknow_electricity_q1_2026',
    jurisdiction: JURISDICTIONS.LUCKNOW_DISTRICT,
    category: GRIEVANCE_CATEGORIES.ELECTRICITY_SUPPLY,
    period: '2026-Q1',
    sampleSize: 78,
    missingDataCount: 6,
    durationsDays: [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22],
    stageDurations: {
      [BOTTLENECK_STAGES.INTAKE_TRIAGE]: 2.2,
      [BOTTLENECK_STAGES.FIELD_INSPECTION]: 4.5,
      [BOTTLENECK_STAGES.DEPARTMENT_REVIEW]: 4.8,
      [BOTTLENECK_STAGES.APPELLATE_REVIEW]: 1.8,
      [BOTTLENECK_STAGES.CLOSURE_DISPATCH]: 1.2,
    },
    statutorySlaDays: 14,
    observedBreachRate: 0.29,
  },
  {
    cohortId: 'coh_chennai_water_q1_2026',
    jurisdiction: JURISDICTIONS.CHENNAI_CORP,
    category: GRIEVANCE_CATEGORIES.MUNICIPAL_WATER_SANITATION,
    period: '2026-Q1',
    sampleSize: 92,
    missingDataCount: 2,
    durationsDays: [4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 10, 12, 14],
    stageDurations: {
      [BOTTLENECK_STAGES.INTAKE_TRIAGE]: 1.4,
      [BOTTLENECK_STAGES.FIELD_INSPECTION]: 3.6,
      [BOTTLENECK_STAGES.DEPARTMENT_REVIEW]: 2.0,
      [BOTTLENECK_STAGES.APPELLATE_REVIEW]: 0.6,
      [BOTTLENECK_STAGES.CLOSURE_DISPATCH]: 0.9,
    },
    statutorySlaDays: 7,
    observedBreachRate: 0.33,
  },
  {
    // Small cohort to test differential privacy suppression
    cohortId: 'coh_pune_pension_sparse',
    jurisdiction: JURISDICTIONS.PUNE_DISTRICT,
    category: GRIEVANCE_CATEGORIES.PENSION_SOCIAL_WELFARE,
    period: '2026-Q1',
    sampleSize: 6, // < MIN_COHORT_SAMPLE_SIZE
    missingDataCount: 0,
    durationsDays: [30, 35, 40, 42, 46, 50],
    stageDurations: {
      [BOTTLENECK_STAGES.INTAKE_TRIAGE]: 3.0,
      [BOTTLENECK_STAGES.FIELD_INSPECTION]: 12.0,
      [BOTTLENECK_STAGES.DEPARTMENT_REVIEW]: 14.0,
      [BOTTLENECK_STAGES.APPELLATE_REVIEW]: 4.0,
      [BOTTLENECK_STAGES.CLOSURE_DISPATCH]: 2.0,
    },
    statutorySlaDays: 45,
    observedBreachRate: 0.33,
  },
];

/**
 * Validates external inputs for grievance forecast query.
 */
export function validateGrievanceForecastQuery(query) {
  const errors = [];
  if (!query || typeof query !== 'object') {
    return { isValid: false, errors: ['Query must be a non-null object'] };
  }

  const { jurisdiction, category } = query;

  if (!jurisdiction || !Object.values(JURISDICTIONS).includes(jurisdiction)) {
    errors.push(`Invalid jurisdiction: '${jurisdiction}'. Supported: ${Object.values(JURISDICTIONS).join(', ')}`);
  }

  if (!category || !Object.values(GRIEVANCE_CATEGORIES).includes(category)) {
    errors.push(`Invalid category: '${category}'. Supported: ${Object.values(GRIEVANCE_CATEGORIES).join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates bottleneck action proposal inputs (Human-in-the-loop gate)
 */
export function validateBottleneckActionInput(action) {
  const errors = [];
  if (!action || typeof action !== 'object') {
    return { isValid: false, errors: ['Action must be an object'] };
  }

  if (!action.stage || !Object.values(BOTTLENECK_STAGES).includes(action.stage)) {
    errors.push(`Invalid stage '${action.stage}'. Must be one of: ${Object.values(BOTTLENECK_STAGES).join(', ')}`);
  }

  if (!action.title || typeof action.title !== 'string' || action.title.trim().length < 5) {
    errors.push('Action title must be a descriptive string of at least 5 characters');
  }

  if (!action.recommendedBy || typeof action.recommendedBy !== 'string') {
    errors.push('Action must specify recommendation origin or officer ID');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
