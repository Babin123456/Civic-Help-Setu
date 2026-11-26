/**
 * src/services/civicSourceFreshnessPredictionEngine.test.js
 *
 * Unit tests for the Civic Information Freshness Prediction and Review
 * Prioritization Engine (#1189).
 * Covers deny-by-default, prediction scoring, feature extraction, review,
 * drift detection, and confidence.
 *
 * Synthetic fixtures only: no citizen records, credentials, raw documents or
 * sensitive prompts.
 */

import { describe, it, expect } from 'vitest';
import { createFreshnessPredictionEngine } from './civicSourceFreshnessPredictionEngine.js';
import {
  resetFreshnessStoreToEmpty,
  createSeedStore,
  persistFreshnessStore
} from './civicSourceFreshnessPredictionMigrations.js';
import {
  FRESHNESS_PREDICTION_ERRORS
} from '../data/civicSourceFreshnessPredictionConstants.js';

const FIXED_NOW = new Date('2026-11-24T10:00:00Z');

function freshEngine() {
  resetFreshnessStoreToEmpty({ now: FIXED_NOW });
  const seeded = createSeedStore({ now: FIXED_NOW });
  persistFreshnessStore(seeded, { now: FIXED_NOW });
  return createFreshnessPredictionEngine({ now: () => FIXED_NOW.getTime() });
}

describe('civicSourceFreshnessPredictionEngine', () => {
  describe('validation', () => {
    it('rejects non-object requests', () => {
      const e = freshEngine();
      const v = e.validatePredictionRequest(null);
      expect(v.valid).toBe(false);
      expect(v.errors[0].code).toBe(FRESHNESS_PREDICTION_ERRORS.INVALID_TYPE);
    });

    it('rejects sensitive values', () => {
      const e = freshEngine();
      const v = e.validatePredictionRequest({ serviceId: 'My Aadhaar 1234 5678 9012' });
      expect(v.valid).toBe(false);
      expect(v.errors.some((err) => err.code === FRESHNESS_PREDICTION_ERRORS.INVALID_TYPE)).toBe(true);
    });

    it('accepts a valid minimal request', () => {
      const e = freshEngine();
      const v = e.validatePredictionRequest({ serviceId: 'service-1' });
      expect(v.valid).toBe(true);
    });
  });

  describe('predict', () => {
    it('computes a prediction with deny-by-default for unknown service', async () => {
      const e = freshEngine();
      const result = await e.predict({
        serviceId: 'service-unknown',
        service: { id: 'service-unknown', name: 'Unknown', officialSources: [], lastVerified: null },
        linkHealthRecords: {},
        verificationHistory: [],
        nowIso: FIXED_NOW
      });
      expect(result.ok).toBe(true);
      expect(result.prediction.permitted).toBeUndefined();
      expect(result.prediction.priorityBand).toBeDefined();
      expect(result.prediction.priorityScore).toBeGreaterThanOrEqual(0);
      expect(result.prediction.priorityScore).toBeLessThanOrEqual(100);
      expect(result.prediction.noCitizenData).toBe(true);
      expect(result.prediction.untrusted).toBe(true);
    });

    it('produces higher priority for stale verification', async () => {
      const e = freshEngine();
      const stale = await e.predict({
        serviceId: 'service-stale',
        service: {
          id: 'service-stale',
          name: 'Stale Service',
          officialSources: [{ name: 'Portal', url: 'https://example.gov.in/stale' }],
          lastVerified: '2025-01-01'
        },
        linkHealthRecords: {},
        verificationHistory: [],
        nowIso: FIXED_NOW
      });
      const fresh = await e.predict({
        serviceId: 'service-fresh',
        service: {
          id: 'service-fresh',
          name: 'Fresh Service',
          officialSources: [{ name: 'Portal', url: 'https://example.gov.in/fresh' }],
          lastVerified: '2026-11-01'
        },
        linkHealthRecords: {},
        verificationHistory: [],
        nowIso: FIXED_NOW
      });
      expect(stale.ok).toBe(true);
      expect(fresh.ok).toBe(true);
      expect(stale.prediction.priorityScore).toBeGreaterThan(fresh.prediction.priorityScore);
    });

    it('produces higher priority for unavailable link', async () => {
      const e = freshEngine();
      const baseService = {
        id: 'service-link-available',
        name: 'Link Service',
        officialSources: [{ name: 'Portal', url: 'https://example.gov.in/link' }],
        lastVerified: '2026-11-01'
      };
      const available = await e.predict({
        serviceId: 'service-link-available',
        service: baseService,
        linkHealthRecords: { 'service-link-available:https://example.gov.in/link': { status: 'reachable', checkedAt: FIXED_NOW } },
        verificationHistory: [],
        nowIso: FIXED_NOW
      });
      const unavailableBaseService = {
        id: 'service-link-unavailable',
        name: 'Link Service',
        officialSources: [{ name: 'Portal', url: 'https://example.gov.in/link' }],
        lastVerified: '2026-11-01'
      };
      const unavailable = await e.predict({
        serviceId: 'service-link-unavailable',
        service: unavailableBaseService,
        linkHealthRecords: { 'service-link-unavailable:https://example.gov.in/link': { status: 'unavailable', checkedAt: FIXED_NOW } },
        verificationHistory: [],
        nowIso: FIXED_NOW
      });
      expect(available.ok).toBe(true);
      expect(unavailable.ok).toBe(true);
      expect(unavailable.prediction.priorityScore).toBeGreaterThan(available.prediction.priorityScore);
    });

    it('produces higher priority for superseded source', async () => {
      const e = freshEngine();
      const normal = await e.predict({
        serviceId: 'service-normal',
        service: {
          id: 'service-normal',
          name: 'Normal Service',
          officialSources: [{ name: 'Portal', url: 'https://example.gov.in/normal' }],
          lastVerified: '2026-11-01'
        },
        linkHealthRecords: {},
        verificationHistory: [],
        nowIso: FIXED_NOW
      });
      const superseded = await e.predict({
        serviceId: 'service-superseded',
        service: {
          id: 'service-superseded',
          name: 'Superseded Service',
          officialSources: [{ name: 'Portal', url: 'https://example.gov.in/superseded' }],
          lastVerified: '2026-11-01',
          supersededBy: 'newer-v2'
        },
        linkHealthRecords: {},
        verificationHistory: [],
        nowIso: FIXED_NOW
      });
      expect(superseded.prediction.priorityScore).toBeGreaterThan(normal.prediction.priorityScore);
    });

    it('rejects invalid service id', async () => {
      const e = freshEngine();
      const result = await e.predict({
        serviceId: 'Bad Id',
        service: { id: 'Bad Id', name: 'Bad', officialSources: [] },
        nowIso: FIXED_NOW
      });
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe(FRESHNESS_PREDICTION_ERRORS.VALIDATION_FAILED);
    });
  });

  describe('reviewPrediction', () => {
    it('reviews a prediction and marks it reviewed', async () => {
      const e = freshEngine();
      await e.predict({
        serviceId: 'service-review',
        service: { id: 'service-review', name: 'Review', officialSources: [], lastVerified: null },
        nowIso: FIXED_NOW
      });

      const reviewed = await e.reviewPrediction({
        serviceId: 'service-review',
        reviewerNote: 'Confirmed stale, needs review.',
        reviewedBy: 'maintainer',
        decision: 'reviewed',
        nowIso: FIXED_NOW
      });
      expect(reviewed.ok).toBe(true);
      expect(reviewed.prediction.reviewed).toBe(true);
      expect(reviewed.prediction.reviewedBy).toBe('maintainer');
      expect(reviewed.prediction.reviewerNote).toBe('Confirmed stale, needs review.');
    });

    it('rejects review of missing prediction', async () => {
      const e = freshEngine();
      const reviewed = await e.reviewPrediction({
        serviceId: 'service-missing',
        reviewerNote: 'x',
        reviewedBy: 'maintainer',
        nowIso: FIXED_NOW
      });
      expect(reviewed.ok).toBe(false);
    });
  });

  describe('getPrediction / listPredictions / getReviewAudit / getDriftEvents', () => {
    it('gets a prediction by service id', async () => {
      const e = freshEngine();
      await e.predict({
        serviceId: 'service-get',
        service: { id: 'service-get', name: 'Get', officialSources: [], lastVerified: null },
        nowIso: FIXED_NOW
      });
      const pred = await e.getPrediction('service-get');
      expect(pred).not.toBeNull();
      expect(pred.serviceId).toBe('service-get');
      expect(await e.getPrediction('missing')).toBeNull();
    });

    it('lists predictions', async () => {
      const e = freshEngine();
      await e.predict({
        serviceId: 'service-list-1',
        service: { id: 'service-list-1', name: 'List 1', officialSources: [], lastVerified: null },
        nowIso: FIXED_NOW
      });
      const listed = await e.listPredictions();
      expect(Array.isArray(listed.predictions)).toBe(true);
      expect(listed.predictions.length).toBeGreaterThan(0);
    });

    it('gets review audit', async () => {
      const e = freshEngine();
      await e.predict({
        serviceId: 'service-audit',
        service: { id: 'service-audit', name: 'Audit', officialSources: [], lastVerified: null },
        nowIso: FIXED_NOW
      });
      await e.reviewPrediction({
        serviceId: 'service-audit',
        reviewerNote: 'reviewed',
        reviewedBy: 'maintainer',
        decision: 'reviewed',
        nowIso: FIXED_NOW
      });
      const audit = await e.getReviewAudit({ serviceId: 'service-audit' });
      expect(audit.length).toBeGreaterThan(0);
    });

    it('records and gets drift events', async () => {
      const e = freshEngine();
      const result = e.recordDriftEvent({
        serviceId: 'service-drift',
        previousScore: 0.4,
        currentScore: 0.75,
        reason: 'Link health deteriorated.',
        nowIso: FIXED_NOW
      });
      expect(result.ok).toBe(true);
      expect(result.recorded).toBe(true);
      expect(result.drift).toBe(0.35);

      const drift = await e.getDriftEvents({ serviceId: 'service-drift' });
      expect(drift.length).toBeGreaterThan(0);
    });

    it('does not record drift below threshold', async () => {
      const e = freshEngine();
      const result = e.recordDriftEvent({
        serviceId: 'service-drift-small',
        previousScore: 0.4,
        currentScore: 0.42,
        reason: 'Tiny change.',
        nowIso: FIXED_NOW
      });
      expect(result.ok).toBe(true);
      expect(result.recorded).toBe(false);
    });
  });

  describe('listFeatureWeights', () => {
    it('returns feature weights', async () => {
      const e = freshEngine();
      const weights = e.listFeatureWeights();
      expect(weights['days_since_verification']).toBeDefined();
    });
  });
});
