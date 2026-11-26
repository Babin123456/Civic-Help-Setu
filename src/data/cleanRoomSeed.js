/**
 * Synthetic Seed Data for Civic Data Clean Room (#1164)
 *
 * CRITICAL PRIVACY INVARIANT:
 * All records here are strictly SYNTHETIC and contain ZERO citizen PII,
 * real names, real contact numbers, biometric markers, or raw credentials.
 */

import {
  ALLOWED_DATASET_IDS,
  PARTNER_TIERS,
  WORKSPACE_STATUS,
} from './cleanRoomContract.js';

// Deterministic Pseudo-random Generator for synthetic distribution
function createSeededRandom(seed = 1164) {
  let s = seed;
  return function () {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const rng = createSeededRandom(42);

const WARDS = ['Ward-101', 'Ward-102', 'Ward-103', 'Ward-104', 'Ward-105', 'Ward-106', 'Ward-107', 'Ward-108'];
const SERVICE_CATEGORIES = ['sanitation', 'water_supply', 'street_lighting', 'road_maintenance', 'drainage', 'public_health'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const STATUSES = ['resolved', 'in_progress', 'escalated'];
const QUARTERS = ['Q1-2026', 'Q2-2026', 'Q3-2026', 'Q4-2026'];

// Generate 180 synthetic ward service demand records
export const SYNTHETIC_WARD_SERVICE_DEMAND = Array.from({ length: 180 }, (_, i) => {
  const ward = WARDS[Math.floor(rng() * WARDS.length)];
  const category = SERVICE_CATEGORIES[Math.floor(rng() * SERVICE_CATEGORIES.length)];
  const priority = PRIORITIES[Math.floor(rng() * PRIORITIES.length)];
  const status = STATUSES[Math.floor(rng() * STATUSES.length)];
  const quarter = QUARTERS[Math.floor(rng() * QUARTERS.length)];
  const resolutionDays = Math.floor(rng() * 25) + 2;
  const satisfactionScore = Math.floor(rng() * 4) + 2; // 2 to 5

  return {
    record_id: `SR-SYNTH-${String(i + 1).padStart(4, '0')}`,
    ward_id: ward,
    service_category: category,
    priority,
    resolution_status: status,
    fiscal_quarter: quarter,
    resolution_days: resolutionDays,
    satisfaction_score: satisfactionScore,
  };
});

const SCHEMES = ['pm_awas_urban', 'national_disability_pension', 'widow_pension_yojana', 'ration_food_security', 'ayushman_bharat_cards'];
const DISTRICTS = ['Bengaluru Urban', 'Bengaluru Rural', 'Mysuru', 'Dharwad', 'Belagavi'];
const AGE_COHORTS = ['18-35', '36-50', '51-65', '65+'];
const APPLICANT_CATEGORIES = ['general', 'sc_st', 'obc', 'ews'];
const APP_STATUSES = ['approved', 'under_scrutiny', 'rejected_deficiency'];

// Generate 150 synthetic welfare scheme records
export const SYNTHETIC_WELFARE_SCHEME_REACH = Array.from({ length: 150 }, (_, i) => {
  const scheme = SCHEMES[Math.floor(rng() * SCHEMES.length)];
  const district = DISTRICTS[Math.floor(rng() * DISTRICTS.length)];
  const ageCohort = AGE_COHORTS[Math.floor(rng() * AGE_COHORTS.length)];
  const category = APPLICANT_CATEGORIES[Math.floor(rng() * APPLICANT_CATEGORIES.length)];
  const status = APP_STATUSES[Math.floor(rng() * APP_STATUSES.length)];
  const processingDays = Math.floor(rng() * 40) + 5;
  const entitlementAmount = (Math.floor(rng() * 10) + 1) * 1000;

  return {
    record_id: `WLF-SYNTH-${String(i + 1).padStart(4, '0')}`,
    scheme_id: scheme,
    district,
    age_cohort: ageCohort,
    applicant_category: category,
    application_status: status,
    processing_days: processingDays,
    entitlement_amount: entitlementAmount,
  };
});

const ASSET_TYPES = ['pothole', 'water_pipe_leak', 'street_light_outage', 'open_manhole', 'footpath_encroachment'];
const DEFECT_SEVERITIES = ['minor', 'moderate', 'severe', 'critical'];
const REPAIR_STATUSES = ['reported', 'work_in_progress', 'completed'];
const MONTHS = ['2026-01', '2026-02', '2026-03', '2026-04'];

// Generate 140 synthetic infrastructure defect records
export const SYNTHETIC_INFRASTRUCTURE_DEFECTS = Array.from({ length: 140 }, (_, i) => {
  const ward = WARDS[Math.floor(rng() * WARDS.length)];
  const asset = ASSET_TYPES[Math.floor(rng() * ASSET_TYPES.length)];
  const severity = DEFECT_SEVERITIES[Math.floor(rng() * DEFECT_SEVERITIES.length)];
  const status = REPAIR_STATUSES[Math.floor(rng() * REPAIR_STATUSES.length)];
  const month = MONTHS[Math.floor(rng() * MONTHS.length)];
  const turnaroundDays = Math.floor(rng() * 20) + 1;
  const cost = Math.floor(rng() * 50000) + 5000;

  return {
    record_id: `INF-SYNTH-${String(i + 1).padStart(4, '0')}`,
    ward_id: ward,
    asset_type: asset,
    defect_severity: severity,
    repair_status: status,
    reporting_month: month,
    repair_turnaround_days: turnaroundDays,
    estimated_cost_inr: cost,
  };
});

export const SEED_DATASETS = Object.freeze({
  [ALLOWED_DATASET_IDS.WARD_SERVICE_DEMAND]: SYNTHETIC_WARD_SERVICE_DEMAND,
  [ALLOWED_DATASET_IDS.WELFARE_SCHEME_REACH]: SYNTHETIC_WELFARE_SCHEME_REACH,
  [ALLOWED_DATASET_IDS.INFRASTRUCTURE_DEFECTS]: SYNTHETIC_INFRASTRUCTURE_DEFECTS,
});

/**
 * Seed Partner Workspaces
 */
export const SEED_WORKSPACES = [
  {
    workspaceId: 'ws-urban-inst-01',
    partnerName: 'Prof. Alok Verma',
    partnerOrg: 'Urban Governance & Public Policy Institute',
    partnerEmail: 'alok.verma@urbangov.res.in',
    tier: PARTNER_TIERS.ACADEMIC_RESEARCH.id,
    status: WORKSPACE_STATUS.APPROVED,
    approvedDatasets: [
      ALLOWED_DATASET_IDS.WARD_SERVICE_DEMAND,
      ALLOWED_DATASET_IDS.WELFARE_SCHEME_REACH,
      ALLOWED_DATASET_IDS.INFRASTRUCTURE_DEFECTS,
    ],
    queryBudgetTotal: 60,
    queryBudgetRemaining: 55,
    epsilonBudgetTotal: 6.0,
    epsilonBudgetRemaining: 5.5,
    expiresAt: '2026-12-31T23:59:59.000Z',
    createdAt: '2026-01-15T10:00:00.000Z',
    approvedBy: 'municipal_steward_01',
    approvalNotes: 'Approved under State University Civic Analytics Partnership',
  },
  {
    workspaceId: 'ws-civic-trans-02',
    partnerName: 'Deepa Krishnan',
    partnerOrg: 'Public Mobility & Infrastructure Alliance',
    partnerEmail: 'deepa@civicmobility.org',
    tier: PARTNER_TIERS.CIVIC_NGO.id,
    status: WORKSPACE_STATUS.APPROVED,
    approvedDatasets: [
      ALLOWED_DATASET_IDS.WARD_SERVICE_DEMAND,
      ALLOWED_DATASET_IDS.INFRASTRUCTURE_DEFECTS,
    ],
    queryBudgetTotal: 40,
    queryBudgetRemaining: 15,
    epsilonBudgetTotal: 4.0,
    epsilonBudgetRemaining: 1.5,
    expiresAt: '2026-09-30T23:59:59.000Z',
    createdAt: '2026-02-01T11:30:00.000Z',
    approvedBy: 'municipal_steward_02',
    approvalNotes: 'Approved for pedestrian safety and ward pothole remediation research',
  },
  {
    workspaceId: 'ws-pending-ngo-03',
    partnerName: 'Karthik Rao',
    partnerOrg: 'Centre for Welfare Entitlements & Equity',
    partnerEmail: 'karthik.rao@welfareequity.in',
    tier: PARTNER_TIERS.CIVIC_NGO.id,
    status: WORKSPACE_STATUS.PENDING_APPROVAL,
    approvedDatasets: [ALLOWED_DATASET_IDS.WELFARE_SCHEME_REACH],
    queryBudgetTotal: 40,
    queryBudgetRemaining: 40,
    epsilonBudgetTotal: 4.0,
    epsilonBudgetRemaining: 4.0,
    expiresAt: '2026-12-31T23:59:59.000Z',
    createdAt: '2026-11-20T14:15:00.000Z',
    approvedBy: null,
    approvalNotes: 'Pending municipal review of research charter',
  },
  {
    workspaceId: 'ws-exhausted-04',
    partnerName: 'Sunita Mehra',
    partnerOrg: 'Metropolitan Civic Data Lab',
    partnerEmail: 'sunita@metrodata.org',
    tier: PARTNER_TIERS.ACADEMIC_RESEARCH.id,
    status: WORKSPACE_STATUS.APPROVED,
    approvedDatasets: [
      ALLOWED_DATASET_IDS.WARD_SERVICE_DEMAND,
      ALLOWED_DATASET_IDS.INFRASTRUCTURE_DEFECTS,
    ],
    queryBudgetTotal: 50,
    queryBudgetRemaining: 0,
    epsilonBudgetTotal: 5.0,
    epsilonBudgetRemaining: 0.0,
    expiresAt: '2026-12-31T23:59:59.000Z',
    createdAt: '2026-03-10T09:00:00.000Z',
    approvedBy: 'municipal_steward_01',
    approvalNotes: 'All allocated query tokens consumed for fiscal cycle Q1',
  },
];

/**
 * Seed Audit Logs
 */
export const SEED_AUDIT_LOGS = [
  {
    auditId: 'AUD-SYNTH-001',
    timestamp: '2026-04-10T12:00:00.000Z',
    workspaceId: 'ws-urban-inst-01',
    action: 'QUERY_EXECUTED',
    templateId: 'TPL_WARD_SERVICE_SUMMARY',
    parameterDigest: 'sha256-param-digest-01',
    resultDigest: 'sha256-result-digest-01',
    epsilonCost: 0.1,
    budgetRemaining: 55,
    status: 'SUCCESS',
  },
  {
    auditId: 'AUD-SYNTH-002',
    timestamp: '2026-04-12T14:30:00.000Z',
    workspaceId: 'ws-civic-trans-02',
    action: 'QUERY_BLOCKED_DIFFERENCING',
    templateId: 'TPL_INFRASTRUCTURE_SEVERITY_OVERVIEW',
    parameterDigest: 'sha256-param-diff-attempt',
    resultDigest: null,
    epsilonCost: 0.0,
    budgetRemaining: 15,
    status: 'BLOCKED_DIFFERENCING_GUARD',
  },
];
