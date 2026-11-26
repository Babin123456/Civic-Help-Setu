/**
 * tests/fixtures/civicSourceFreshnessPredictionSyntheticFixtures.js
 *
 * Synthetic fixtures for the Civic Information Freshness Prediction and Review
 * Prioritization Engine (#1189).
 *
 * These are synthetic, non-citizen records: made-up service ids, resource ids,
 * link health statuses, and fabricated priority scores. No citizen records,
 * credentials, raw documents, or sensitive prompts are included. Safe to commit
 * and share.
 */

import {
  CIVIC_SOURCE_FRESHNESS_SCHEMA_VERSION,
  FRESHNESS_PREDICTION_STATUS,
  PRIORITY_BAND
} from '../src/data/civicSourceFreshnessPredictionConstants.js';

const NOW = '2026-11-24T10:00:00Z';

/** A synthetic service id. */
export function syntheticServiceId(label) {
  return `service-synth-${label}`;
}

/** A synthetic prediction id. */
export function syntheticPredictionId(label) {
  return `fp-synth-${label}`;
}

/** A synthetic prediction record. */
export function syntheticPrediction(overrides = {}) {
  return {
    id: overrides.id || syntheticPredictionId('001'),
    serviceId: overrides.serviceId || syntheticServiceId('ration-card'),
    serviceName: overrides.serviceName || 'Ration Card Service',
    priorityBand: overrides.priorityBand || PRIORITY_BAND.HIGH,
    priorityScore: overrides.priorityScore ?? 75,
    confidence: overrides.confidence ?? 0.82,
    reasons: overrides.reasons || [
      'Not verified for 200 days (exceeds 180d ceiling)',
      'Primary link not working'
    ],
    features: overrides.features || {
      days_since_verification: 1.0,
      link_health: 1.0,
      source_age: 0.4,
      superseded_status: 0.0,
      change_frequency: 0.25,
      gov_domain: 1.0,
      verification_count: 0.17
    },
    status: overrides.status || FRESHNESS_PREDICTION_STATUS.COMPUTED,
    reviewed: overrides.reviewed ?? false,
    reviewerNote: overrides.reviewerNote || '',
    reviewedAt: overrides.reviewedAt || null,
    reviewedBy: overrides.reviewedBy || '',
    computedAt: overrides.computedAt || NOW,
    schemaVersion: CIVIC_SOURCE_FRESHNESS_SCHEMA_VERSION,
    disclaimer: 'Review priority scores are deterministic triage hints derived from source change history, link health and last verification. They are not a truth score, do not constitute official verification, and never trigger an autonomous edit of civic guidance.',
    noCitizenData: true,
    untrusted: true,
    requiresHumanReview: true,
    ...overrides
  };
}

/** A synthetic service record for prediction input. */
export function syntheticService(overrides = {}) {
  return {
    id: overrides.id || syntheticServiceId('service'),
    name: overrides.name || 'Synthetic Service',
    lastVerified: overrides.lastVerified || '2026-05-01',
    officialSources: overrides.officialSources || [
      { name: 'Official Portal', url: 'https://example.gov.in/service' }
    ],
    supersededBy: overrides.supersededBy || null,
    isWithdrawn: overrides.isWithdrawn ?? false,
    changeEvents: overrides.changeEvents || [],
    ...overrides
  };
}

/** A synthetic link health record. */
export function syntheticLinkHealthRecord(overrides = {}) {
  return {
    status: overrides.status || 'unavailable',
    checkedAt: overrides.checkedAt || NOW,
    httpStatus: overrides.httpStatus || 404,
    redirectedTo: overrides.redirectedTo || null,
    reviewed: overrides.reviewed ?? false
  };
}

/** A synthetic drift event. */
export function syntheticDriftEvent(overrides = {}) {
  return {
    id: overrides.id || `drift-synth-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
    serviceId: overrides.serviceId || syntheticServiceId('service'),
    previousScore: overrides.previousScore ?? 0.4,
    currentScore: overrides.currentScore ?? 0.75,
    drift: overrides.drift ?? 0.35,
    reason: overrides.reason || 'Link health deteriorated from reachable to unavailable.',
    recordedAt: overrides.recordedAt || NOW,
    schemaVersion: CIVIC_SOURCE_FRESHNESS_SCHEMA_VERSION
  };
}

/** A synthetic review audit event. */
export function syntheticReviewAuditEvent(overrides = {}) {
  return {
    id: overrides.id || `audit-synth-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
    action: overrides.action || 'freshness.review',
    serviceId: overrides.serviceId || syntheticServiceId('service'),
    decision: overrides.decision || 'reviewed',
    reviewerNote: overrides.reviewerNote || 'Reviewed and confirmed stale.',
    reviewedBy: overrides.reviewedBy || 'maintainer',
    timestamp: overrides.timestamp || NOW,
    schemaVersion: CIVIC_SOURCE_FRESHNESS_SCHEMA_VERSION
  };
}

export {
  NOW,
  CIVIC_SOURCE_FRESHNESS_SCHEMA_VERSION,
  FRESHNESS_PREDICTION_STATUS,
  PRIORITY_BAND
};
