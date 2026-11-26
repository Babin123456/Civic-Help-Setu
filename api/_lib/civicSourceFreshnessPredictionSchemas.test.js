/**
 * api/_lib/civicSourceFreshnessPredictionSchemas.test.js
 *
 * Unit tests for versioned request/response validation contracts of the Civic
 * Information Freshness Prediction and Review Prioritization Engine API (#1189).
 */

import { describe, it, expect } from 'vitest';
import {
  validatePredict,
  validateReviewPrediction,
  validateListQuery,
  validateDriftEvent,
  schemaVersion
} from './civicSourceFreshnessPredictionSchemas.js';

describe('civicSourceFreshnessPredictionSchemas', () => {
  it('reports the schema version', () => {
    expect(schemaVersion()).toBe(1);
  });

  describe('validatePredict', () => {
    it('accepts a valid predict request', () => {
      const v = validatePredict({
        serviceId: 'service-1',
        service: { id: 'service-1', name: 'Service', officialSources: [] },
        linkHealthRecords: {},
        verificationHistory: [],
        forceRecompute: false
      });
      expect(v.valid).toBe(true);
    });

    it('rejects invalid serviceId', () => {
      const v = validatePredict({ serviceId: 'Bad Id' });
      expect(v.valid).toBe(false);
    });

    it('rejects non-object service', () => {
      const v = validatePredict({ serviceId: 'service-1', service: 'not-an-object' });
      expect(v.valid).toBe(false);
    });

    it('rejects non-array verificationHistory', () => {
      const v = validatePredict({ serviceId: 'service-1', verificationHistory: 'not-an-array' });
      expect(v.valid).toBe(false);
    });
  });

  describe('validateReviewPrediction', () => {
    it('accepts a valid review prediction request', () => {
      const v = validateReviewPrediction({
        serviceId: 'service-1',
        reviewerNote: 'Confirmed stale.',
        reviewedBy: 'maintainer',
        decision: 'reviewed'
      });
      expect(v.valid).toBe(true);
    });

    it('rejects invalid serviceId', () => {
      const v = validateReviewPrediction({ serviceId: 'Bad Id' });
      expect(v.valid).toBe(false);
    });

    it('rejects invalid decision', () => {
      const v = validateReviewPrediction({ serviceId: 'service-1', decision: 'not-a-status' });
      expect(v.valid).toBe(false);
    });
  });

  describe('validateListQuery', () => {
    it('accepts a valid list query', () => {
      const v = validateListQuery({ band: 'high', limit: 10 });
      expect(v.valid).toBe(true);
    });

    it('rejects invalid band', () => {
      const v = validateListQuery({ band: 'not-a-band' });
      expect(v.valid).toBe(false);
    });

    it('rejects limit out of range', () => {
      const v = validateListQuery({ limit: 0 });
      expect(v.valid).toBe(false);
    });
  });

  describe('validateDriftEvent', () => {
    it('accepts a valid drift event', () => {
      const v = validateDriftEvent({
        serviceId: 'service-1',
        previousScore: 0.4,
        currentScore: 0.75,
        reason: 'Link health deteriorated.'
      });
      expect(v.valid).toBe(true);
    });

    it('rejects invalid serviceId', () => {
      const v = validateDriftEvent({ serviceId: 'Bad Id' });
      expect(v.valid).toBe(false);
    });

    it('rejects score out of range', () => {
      const v = validateDriftEvent({ serviceId: 'service-1', previousScore: 1.5 });
      expect(v.valid).toBe(false);
    });
  });
});
