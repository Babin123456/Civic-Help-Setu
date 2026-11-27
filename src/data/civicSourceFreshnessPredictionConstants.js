/**
 * src/data/civicSourceFreshnessPredictionConstants.js
 *
 * Versioned schema, enums, error codes, storage keys and feature weights for the
 * Civic Information Freshness Prediction and Review Prioritization Model (#1189).
 *
 * Purpose: help maintainers transparently prioritize which service pages and
 * official sources deserve review first, based on deterministic features
 * (source change history, link health, last verification). Outputs a review
 * priority score with reasons and uncertainty — never a public "truth score",
 * never an autonomous edit, denial or approval.
 *
 * All figures are model outputs for triage only. No citizen records, credentials,
 * raw documents or sensitive prompts are referenced.
 */

export const CIVIC_SOURCE_FRESHNESS_SCHEMA_VERSION = 1;
export const CIVIC_SOURCE_FRESHNESS_STORAGE_KEY = 'civicbridge_source_freshness_predictions_v1';
export const CIVIC_SOURCE_FRESHNESS_REVIEW_DATE = '2026-11-24';
export const CIVIC_SOURCE_FRESHNESS_STALE_AFTER_DAYS = 90;
export const CIVIC_SOURCE_FRESHNESS_DISCLAIMER =
  'Review priority scores are deterministic triage hints derived from source ' +
  'change history, link health and last verification. They are not a truth score, ' +
  'do not constitute official verification, and never trigger an autonomous edit ' +
  'of civic guidance.';

export const FRESHNESS_PREDICTION_STATUS = Object.freeze({
  PENDING: 'pending',
  COMPUTED: 'computed',
  STALE: 'stale',
  REVIEWED: 'reviewed',
  SUPERSEDED: 'superseded',
  WITHDRAWN: 'withdrawn'
});

export const PRIORITY_BAND = Object.freeze({
  LOW: 'low',          // routine review
  MEDIUM: 'medium',    // schedule within normal cycle
  HIGH: 'high',        // prioritize in next review batch
  CRITICAL: 'critical' // review before next publication cycle
});

export const FRESHNESS_PREDICTION_ERRORS = Object.freeze({
  INVALID_REQUEST: 'FP_INVALID_REQUEST',
  INVALID_TYPE: 'FP_INVALID_TYPE',
  SERVICE_NOT_FOUND: 'FP_SERVICE_NOT_FOUND',
  PREDICTION_NOT_FOUND: 'FP_PREDICTION_NOT_FOUND',
  VALIDATION_FAILED: 'FP_VALIDATION_FAILED',
  STORAGE_UNAVAILABLE: 'FP_STORAGE_UNAVAILABLE',
  CONCURRENT_WRITE: 'FP_CONCURRENT_WRITE',
  STALE_DATA: 'FP_STALE_DATA',
  DRIFT_EXCEEDED: 'FP_DRIFT_EXCEEDED'
});

export const FEATURE_NAME = Object.freeze({
  DAYS_SINCE_VERIFICATION: 'days_since_verification',
  LINK_HEALTH: 'link_health',
  SOURCE_AGE: 'source_age',
  SUPERSEDED_STATUS: 'superseded_status',
  CHANGE_FREQUENCY: 'change_frequency',
  GOV_DOMAIN: 'gov_domain',
  VERIFICATION_COUNT: 'verification_count'
});

/**
 * Default feature weights. All weights are deterministic and interpretable;
 * they sum to a baseline that is mapped into a 0-100 priority score. Operators
 * may adjust them, but must record the change and re-evaluate baselines.
 */
export const DEFAULT_FEATURE_WEIGHTS = Object.freeze({
  [FEATURE_NAME.DAYS_SINCE_VERIFICATION]: 0.30,
  [FEATURE_NAME.LINK_HEALTH]: 0.25,
  [FEATURE_NAME.SOURCE_AGE]: 0.15,
  [FEATURE_NAME.SUPERSEDED_STATUS]: 0.10,
  [FEATURE_NAME.CHANGE_FREQUENCY]: 0.10,
  [FEATURE_NAME.GOV_DOMAIN]: -0.05,   // government domains are slightly de-weighted
  [FEATURE_NAME.VERIFICATION_COUNT]: -0.05
});

/**
 * Thresholds mapping a raw 0-1 score to a priority band.
 */
export const PRIORITY_THRESHOLDS = Object.freeze({
  CRITICAL: 0.70,
  HIGH: 0.50,
  MEDIUM: 0.30,
  LOW: 0.00
});

/**
 * Default verification staleness ceiling in days. A source never verified or
 * verified beyond this window is a candidate for review.
 */
export const DEFAULT_VERIFICATION_STALE_DAYS = 180;

/**
 * Source age threshold in days beyond which a source is considered "old" for
 * feature purposes (not a legal expiry — that is handled separately).
 */
export const DEFAULT_SOURCE_AGE_STALE_DAYS = 730; // 2 years

/**
 * Maximum change-frequency events counted before saturation.
 */
export const MAX_CHANGE_EVENTS = 12;

export const MAX_INPUT_BYTES = 64 * 1024;
export const MAX_CONCURRENT_PREDICTIONS = 50;
export const SERVICE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const PREDICTION_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const SENSITIVE_KEY_PATTERN =
  /(password|passwd|otp|one.?time|token|secret|credential|api.?key|private.?key|aadhaar.?number|aadhaar.?no|pan.?number|document.?content|file.?content|file.?data|base64|biometric|passphrase|authorization|salary|income.?amount|mobile.?number|phone.?number)/i;

export const AADHAAR_NUMBER_PATTERN = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
export const PAN_NUMBER_PATTERN = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/;
export const OTP_PATTERN = /\b(?:otp|one[- ]time password)\b\s*[:#-]?\s*\d{4,8}\b/i;

/**
 * Default prediction record (computed per service).
 */
export const DEFAULT_PREDICTION = Object.freeze({
  serviceId: '',
  priorityBand: PRIORITY_BAND.LOW,
  priorityScore: 0,
  confidence: 0,
  reasons: [],
  features: {},
  status: FRESHNESS_PREDICTION_STATUS.PENDING,
  reviewed: false,
  reviewerNote: '',
  reviewedAt: null,
  reviewedBy: '',
  computedAt: '',
  schemaVersion: CIVIC_SOURCE_FRESHNESS_SCHEMA_VERSION,
  disclaimer: CIVIC_SOURCE_FRESHNESS_DISCLAIMER,
  noCitizenData: true,
  untrusted: true,
  requiresHumanReview: true
});

export const __testables = {
  CIVIC_SOURCE_FRESHNESS_SCHEMA_VERSION,
  DEFAULT_FEATURE_WEIGHTS,
  PRIORITY_THRESHOLDS,
  PRIORITY_BAND,
  FRESHNESS_PREDICTION_STATUS,
  FRESHNESS_PREDICTION_ERRORS,
  DEFAULT_PREDICTION,
  FEATURE_NAME,
  DEFAULT_VERIFICATION_STALE_DAYS,
  DEFAULT_SOURCE_AGE_STALE_DAYS,
  MAX_CHANGE_EVENTS
};
