/**
 * src/data/civicRecommendationExperimentationConstants.js
 *
 * Versioned schema, enums, error codes, storage keys, guardrail thresholds,
 * and default configuration for the Civic Service Recommendation
 * Experimentation Platform with Guardrails (#1193).
 *
 * Purpose: Maintainers need to compare recommendation strategies without
 * exposing citizens to unsafe or unfair experiments. This module defines the
 * machine-readable schema for deterministic feature flags, opt-in experiments,
 * guardrail metrics, and privacy-safe aggregation.
 *
 * All recommendation scores are deterministic hints with provenance. They
 * never autonomously file applications, deny benefits, or claim official
 * verification. No citizen records, credentials, raw documents, or sensitive
 * prompts are stored or logged. Prohibited sensitive attributes (caste, religion,
 * gender, biometric/national IDs) cannot be targeted or segmented.
 */

export const CIVIC_EXPERIMENTATION_SCHEMA_VERSION = 1;
export const CIVIC_EXPERIMENTATION_STORAGE_KEY = 'civicbridge_recommendation_experimentation_v1';
export const CIVIC_EXPERIMENTATION_REVIEW_DATE = '2026-11-25';
export const CIVIC_EXPERIMENTATION_STALE_AFTER_DAYS = 90;
export const CIVIC_EXPERIMENTATION_DISCLAIMER =
  'Recommendation experimentation metrics and variant allocations are deterministic ' +
  'diagnostic models for maintainers to evaluate algorithmic fairness and relevance. ' +
  'They are not official certifications, do not alter legal entitlement, and never ' +
  'trigger autonomous modifications to civic benefits.';

export const EXPERIMENT_STATUS = Object.freeze({
  DRAFT: 'draft',
  ACTIVE: 'active',
  PAUSED: 'paused',
  CONCLUDED: 'concluded',
  ROLLED_BACK: 'rolled_back'
});

export const EXPERIMENTATION_ERRORS = Object.freeze({
  INVALID_REQUEST: 'RE_INVALID_REQUEST',
  INVALID_TYPE: 'RE_INVALID_TYPE',
  EXPERIMENT_NOT_FOUND: 'RE_EXPERIMENT_NOT_FOUND',
  VARIANT_NOT_FOUND: 'RE_VARIANT_NOT_FOUND',
  VALIDATION_FAILED: 'RE_VALIDATION_FAILED',
  STORAGE_UNAVAILABLE: 'RE_STORAGE_UNAVAILABLE',
  CONCURRENT_WRITE: 'RE_CONCURRENT_WRITE',
  GUARDRAIL_BREACHED: 'RE_GUARDRAIL_BREACHED',
  PROHIBITED_ATTRIBUTE_TARGETING: 'RE_PROHIBITED_ATTRIBUTE_TARGETING',
  MINIMUM_COHORT_NOT_MET: 'RE_MINIMUM_COHORT_NOT_MET',
  PERMISSION_DENIED: 'RE_PERMISSION_DENIED',
  EXPERIMENT_INACTIVE: 'RE_EXPERIMENT_INACTIVE'
});

export const GUARDRAIL_METRIC_TYPE = Object.freeze({
  MIN_RELEVANCE: 'min_relevance',
  MIN_LANGUAGE_COVERAGE: 'min_language_coverage',
  MAX_ERROR_RATE: 'max_error_rate',
  MIN_COHORT_SIZE: 'min_cohort_size'
});

export const PROHIBITED_TARGETING_ATTRIBUTES = Object.freeze([
  'caste',
  'subcaste',
  'religion',
  'faith',
  'gender',
  'sex',
  'sexual_orientation',
  'aadhaar',
  'pan',
  'voter_id',
  'passport_number',
  'biometric',
  'health_condition',
  'disability_type',
  'political_affiliation',
  'exact_income',
  'bank_account'
]);

export const DEFAULT_GUARDRAILS = Object.freeze({
  minRelevanceScore: 0.60,       // Mean recommendation relevance score floor (0-1)
  minLanguageCoverage: 0.80,    // Minimum fraction of services available in user's language
  maxErrorRate: 0.05,           // Maximum allowable execution error rate (5%)
  minCohortSize: 20             // Minimum samples before displaying comparative results
});

export const DEFAULT_VARIANT = Object.freeze({
  id: 'control',
  name: 'Standard Rule-Based',
  weight: 50,
  strategyConfig: {
    intentWeight: 0.35,
    documentWeight: 0.25,
    eligibilityWeight: 0.20,
    speedWeight: 0.10,
    feeWeight: 0.10,
    localPriorityBoost: 0.0
  },
  description: 'Baseline explainable recommendation algorithm'
});

export const DEFAULT_EXPERIMENT = Object.freeze({
  id: '',
  name: '',
  description: '',
  status: EXPERIMENT_STATUS.DRAFT,
  variants: [
    { ...DEFAULT_VARIANT },
    {
      id: 'treatment-local-boost',
      name: 'Local Service Prioritization',
      weight: 50,
      strategyConfig: {
        intentWeight: 0.30,
        documentWeight: 0.20,
        eligibilityWeight: 0.20,
        speedWeight: 0.10,
        feeWeight: 0.10,
        localPriorityBoost: 0.10
      },
      description: 'Treatment with slight boost for ward-level services'
    }
  ],
  guardrails: { ...DEFAULT_GUARDRAILS },
  audienceCriteria: {},
  optInRequired: true,
  salt: 'salt-civic-recs',
  metrics: {
    control: { assignments: 0, relevanceSum: 0, languageCoverageSum: 0, errorCount: 0 },
    'treatment-local-boost': { assignments: 0, relevanceSum: 0, languageCoverageSum: 0, errorCount: 0 }
  },
  guardrailBreaches: [],
  rollbackReason: null,
  rolledBackAt: null,
  createdAt: '',
  updatedAt: '',
  schemaVersion: CIVIC_EXPERIMENTATION_SCHEMA_VERSION,
  noCitizenData: true,
  untrusted: true,
  requiresHumanReview: true
});

export const MAX_INPUT_BYTES = 64 * 1024;
export const MAX_EXPERIMENTS = 100;
export const MAX_VARIANTS_PER_EXPERIMENT = 10;
export const MAX_GUARDRAIL_BREACHES = 200;
export const EXPERIMENT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const VARIANT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const CITIZEN_ID_PATTERN = /^[a-z0-9_\-.:@]+$/i;
