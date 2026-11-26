/**
 * src/data/civicServiceChangeSandboxData.js
 *
 * Versioned, privacy-safe synthetic dataset for the Civic Service Change
 * Sandbox with Shadow Traffic Evaluation (#1181).
 *
 * Maintainers can compare a proposed service workflow against current behavior
 * before publishing it. The sandbox creates versioned staging snapshots, replays
 * synthetic journeys and opt-in anonymized aggregate patterns, compares
 * completion, validation and accessibility outcomes, blocks writes to
 * production during shadow runs, and supports rollback and deterministic replay.
 *
 * All records are synthetic fixtures with zero production PII. No credentials,
 * raw documents, Aadhaar/PAN numbers, phone numbers or sensitive prompts are
 * stored here.
 *
 * Schema version: civic-service-change-sandbox-v1
 */

export const CIVIC_SERVICE_CHANGE_SANDBOX_SCHEMA_VERSION = 'civic-service-change-sandbox-v1';
export const CIVIC_SERVICE_CHANGE_SANDBOX_REVIEW_DATE = '2026-11-22';
export const CIVIC_SERVICE_CHANGE_SANDBOX_STALE_AFTER_DAYS = 180;
export const CIVIC_SERVICE_CHANGE_SANDBOX_DISCLAIMER =
  'Shadow-traffic comparison output is illustrative and untrusted. It must be '
  + 'reviewed by a human before any production change is published. The sandbox '
  + 'never writes to production during shadow runs and never exposes citizen '
  + 'records or credentials.';

/**
 * Service workflow versions. Each version is a reviewed snapshot of a service's
 * steps, documents, validation rules and accessibility metadata.
 */
export const SERVICE_VERSIONS = [
  {
    id: 'svc-income-certificate-v1',
    serviceId: 'service-income-certificate',
    serviceName: 'Income Certificate',
    version: '1.0.0',
    status: 'published',
    publishedAt: '2026-01-15',
    steps: [
      { id: 'step-1', title: 'Submit application form', order: 1, required: true },
      { id: 'step-2', title: 'Upload income proof', order: 2, required: true },
      { id: 'step-3', title: 'Upload address proof', order: 3, required: true },
      { id: 'step-4', title: 'Officer verification', order: 4, required: true },
      { id: 'step-5', title: 'Certificate issuance', order: 5, required: true }
    ],
    documentRequirements: ['aadhaar', 'income-proof', 'address-proof'],
    validationRules: [
      { id: 'rule-1', field: 'aadhaar', rule: 'verhoeff-checksum', severity: 'error' },
      { id: 'rule-2', field: 'income-proof', rule: 'pdf-or-image-max-2mb', severity: 'error' }
    ],
    accessibilityMetadata: {
      contrastCompliant: true,
      keyboardNavigable: true,
      ariaLabelsPresent: true
    },
    isSynthetic: true
  },
  {
    id: 'svc-income-certificate-v2',
    serviceId: 'service-income-certificate',
    serviceName: 'Income Certificate',
    version: '2.0.0',
    status: 'staging',
    publishedAt: null,
    steps: [
      { id: 'step-1', title: 'Submit application form', order: 1, required: true },
      { id: 'step-2', title: 'Upload income proof', order: 2, required: true },
      { id: 'step-2b', title: 'Upload optional bank statement', order: 3, required: false },
      { id: 'step-3', title: 'Upload address proof', order: 4, required: true },
      { id: 'step-4', title: 'Officer verification', order: 5, required: true },
      { id: 'step-5', title: 'Certificate issuance', order: 6, required: true }
    ],
    documentRequirements: ['aadhaar', 'income-proof', 'address-proof', 'bank-statement'],
    validationRules: [
      { id: 'rule-1', field: 'aadhaar', rule: 'verhoeff-checksum', severity: 'error' },
      { id: 'rule-2', field: 'income-proof', rule: 'pdf-or-image-max-2mb', severity: 'error' },
      { id: 'rule-3', field: 'bank-statement', rule: 'pdf-or-image-max-2mb', severity: 'warning' }
    ],
    accessibilityMetadata: {
      contrastCompliant: true,
      keyboardNavigable: true,
      ariaLabelsPresent: true
    },
    isSynthetic: true,
    derivedFrom: 'svc-income-certificate-v1'
  },
  {
    id: 'svc-caste-certificate-v1',
    serviceId: 'service-caste-certificate',
    serviceName: 'Caste Certificate',
    version: '1.0.0',
    status: 'published',
    publishedAt: '2026-02-01',
    steps: [
      { id: 'step-1', title: 'Submit application form', order: 1, required: true },
      { id: 'step-2', title: 'Upload caste attestation', order: 2, required: true },
      { id: 'step-3', title: 'Upload address proof', order: 3, required: true },
      { id: 'step-4', title: 'Officer verification', order: 4, required: true },
      { id: 'step-5', title: 'Certificate issuance', order: 5, required: true }
    ],
    documentRequirements: ['aadhaar', 'caste-attestation', 'address-proof'],
    validationRules: [
      { id: 'rule-1', field: 'aadhaar', rule: 'verhoeff-checksum', severity: 'error' },
      { id: 'rule-2', field: 'caste-attestation', rule: 'pdf-or-image-max-2mb', severity: 'error' }
    ],
    accessibilityMetadata: {
      contrastCompliant: true,
      keyboardNavigable: true,
      ariaLabelsPresent: true
    },
    isSynthetic: true
  }
];

/**
 * Staging snapshots capture a proposed service change at a point in time, with
 * a deterministic seed so shadow-traffic replay is reproducible.
 */
export const STAGING_SNAPSHOTS = [
  {
    id: 'snapshot-income-certificate-v2-rollout',
    serviceId: 'service-income-certificate',
    fromVersionId: 'svc-income-certificate-v1',
    toVersionId: 'svc-income-certificate-v2',
    title: 'Income Certificate v2 rollout (optional bank statement)',
    description: 'Adds an optional bank-statement step to the income certificate workflow.',
    status: 'reviewing', // drafting -> reviewing -> approved -> published -> rolled-back
    createdAt: '2026-11-01',
    reviewedAt: null,
    approvedBy: null,
    humanApproved: false,
    productionWriteBlocked: true,
    deterministicSeed: 20261101,
    shadowTrafficEnabled: true,
    isSynthetic: true
  },
  {
    id: 'snapshot-caste-certificate-v1-baseline',
    serviceId: 'service-caste-certificate',
    fromVersionId: 'svc-caste-certificate-v1',
    toVersionId: 'svc-caste-certificate-v1',
    title: 'Caste Certificate v1 baseline (no change)',
    description: 'Baseline shadow run with no proposed change; used for control comparison.',
    status: 'approved',
    createdAt: '2026-10-15',
    reviewedAt: '2026-10-16',
    approvedBy: 'maintainer-reviews',
    humanApproved: true,
    productionWriteBlocked: false,
    deterministicSeed: 20261015,
    shadowTrafficEnabled: true,
    isSynthetic: true
  }
];

/**
 * Synthetic journey patterns used for shadow-traffic replay. Each pattern
 * represents an aggregate of anonymized citizen journeys through a service.
 */
export const SYNTHETIC_JOURNEY_PATTERNS = [
  {
    id: 'journey-income-certificate-complete',
    serviceId: 'service-income-certificate',
    label: 'Complete income certificate journey',
    completionRate: 0.88,
    averageStepsCompleted: 4.4,
    validationFailureRate: 0.06,
    accessibilityIssues: 0,
    documentDropOffRate: 0.12,
    isSynthetic: true
  },
  {
    id: 'journey-income-certificate-abandoned',
    serviceId: 'service-income-certificate',
    label: 'Abandoned income certificate journey',
    completionRate: 0.42,
    averageStepsCompleted: 2.1,
    validationFailureRate: 0.24,
    accessibilityIssues: 2,
    documentDropOffRate: 0.58,
    isSynthetic: true
  },
  {
    id: 'journey-caste-certificate-complete',
    serviceId: 'service-caste-certificate',
    label: 'Complete caste certificate journey',
    completionRate: 0.81,
    averageStepsCompleted: 4.1,
    validationFailureRate: 0.09,
    accessibilityIssues: 0,
    documentDropOffRate: 0.19,
    isSynthetic: true
  }
];

/**
 * Shadow traffic runs replay synthetic journey patterns against a service
 * version and record deterministic outcomes for comparison.
 */
export const SHADOW_TRAFFIC_RUNS = [
  {
    id: 'run-income-v1-baseline',
    snapshotId: 'snapshot-income-certificate-v2-rollout',
    serviceId: 'service-income-certificate',
    serviceVersionId: 'svc-income-certificate-v1',
    journeyPatternId: 'journey-income-certificate-complete',
    label: 'Baseline: v1 complete journey',
    replayCount: 1000,
    completionRate: 0.88,
    validationFailureRate: 0.06,
    accessibilityIssues: 0,
    averageCompletionTimeSeconds: 240,
    errors: [],
    isSynthetic: true
  },
  {
    id: 'run-income-v2-shadow',
    snapshotId: 'snapshot-income-certificate-v2-rollout',
    serviceId: 'service-income-certificate',
    serviceVersionId: 'svc-income-certificate-v2',
    journeyPatternId: 'journey-income-certificate-complete',
    label: 'Shadow: v2 complete journey',
    replayCount: 1000,
    completionRate: 0.85,
    validationFailureRate: 0.07,
    accessibilityIssues: 0,
    averageCompletionTimeSeconds: 260,
    errors: [],
    isSynthetic: true
  },
  {
    id: 'run-income-v2-abandoned-shadow',
    snapshotId: 'snapshot-income-certificate-v2-rollout',
    serviceId: 'service-income-certificate',
    serviceVersionId: 'svc-income-certificate-v2',
    journeyPatternId: 'journey-income-certificate-abandoned',
    label: 'Shadow: v2 abandoned journey',
    replayCount: 1000,
    completionRate: 0.39,
    validationFailureRate: 0.26,
    accessibilityIssues: 2,
    averageCompletionTimeSeconds: 180,
    errors: [],
    isSynthetic: true
  }
];

/**
 * Comparison results between a baseline and a shadow run, reporting the delta
 * in completion, validation and accessibility outcomes.
 */
export const COMPARISON_RESULTS = [
  {
    id: 'comparison-income-v1-vs-v2',
    snapshotId: 'snapshot-income-certificate-v2-rollout',
    serviceId: 'service-income-certificate',
    baselineRunId: 'run-income-v1-baseline',
    shadowRunId: 'run-income-v2-shadow',
    label: 'Income Certificate v1 vs v2 (complete journey)',
    completionDelta: -0.03,
    validationFailureDelta: 0.01,
    accessibilityIssuesDelta: 0,
    completionTimeDeltaSeconds: 20,
    documentDropOffDelta: 0.02,
    recommendation: 'proceed-with-caution',
    reasoning: 'Minor completion dip and longer completion time; optional step adds friction but no accessibility regression.',
    isSynthetic: true
  }
];

/**
 * Production write block state. During shadow runs, writes to production are
 * blocked to prevent unintended changes while comparison is in progress.
 */
export const PRODUCTION_WRITE_BLOCK_STATE = {
  blocked: true,
  reason: 'Shadow run snapshot-income-certificate-v2-rollout is active',
  blockedAt: '2026-11-01T10:00:00Z',
  blockedBy: 'sandbox-service',
  expiresAt: null
};

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export function getServiceVersion(id) {
  return SERVICE_VERSIONS.find((v) => v.id === id) || null;
}

export function getStagingSnapshot(id) {
  return STAGING_SNAPSHOTS.find((s) => s.id === id) || null;
}

export function getSyntheticJourneyPattern(id) {
  return SYNTHETIC_JOURNEY_PATTERNS.find((j) => j.id === id) || null;
}

export function getShadowTrafficRun(id) {
  return SHADOW_TRAFFIC_RUNS.find((r) => r.id === id) || null;
}

export function getComparisonResult(id) {
  return COMPARISON_RESULTS.find((c) => c.id === id) || null;
}

export function listServiceVersions() {
  return SERVICE_VERSIONS;
}

export function listStagingSnapshots() {
  return STAGING_SNAPSHOTS;
}

export function listSyntheticJourneyPatterns() {
  return SYNTHETIC_JOURNEY_PATTERNS;
}

export function listShadowTrafficRuns() {
  return SHADOW_TRAFFIC_RUNS;
}

export function listComparisonResults() {
  return COMPARISON_RESULTS;
}

export function getProductionWriteBlockState() {
  return PRODUCTION_WRITE_BLOCK_STATE;
}

export const SERVICE_CHANGE_SANDBOX_TESTABLES = {
  getServiceVersion,
  getStagingSnapshot,
  getSyntheticJourneyPattern,
  getShadowTrafficRun,
  getComparisonResult,
  listServiceVersions,
  listStagingSnapshots,
  listSyntheticJourneyPatterns,
  listShadowTrafficRuns,
  listComparisonResults,
  getProductionWriteBlockState
};
