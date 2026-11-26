/**
 * api/_lib/civicRecommendationExperimentationSchemas.test.js
 */

import { describe, it, expect } from 'vitest';
import {
  validateUpsertExperiment,
  validateAssignVariant,
  validateRecordMetric,
  validateRollback,
  schemaVersion
} from './civicRecommendationExperimentationSchemas.js';

describe('civicRecommendationExperimentationSchemas', () => {
  it('returns schema version 1', () => {
    expect(schemaVersion()).toBe(1);
  });

  describe('validateUpsertExperiment', () => {
    it('accepts valid experiment input', () => {
      const input = {
        id: 'exp-valid-test',
        name: 'Valid Experiment',
        status: 'active',
        variants: [{ id: 'control', name: 'Control', weight: 50 }]
      };
      const res = validateUpsertExperiment(input);
      expect(res.valid).toBe(true);
      expect(res.value.id).toBe('exp-valid-test');
    });

    it('rejects unknown fields to prevent mass-assignment', () => {
      const input = {
        id: 'exp-valid-test',
        name: 'Valid Experiment',
        maliciousExtraField: 'bypass'
      };
      const res = validateUpsertExperiment(input);
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain('Unknown field');
    });

    it('rejects prohibited sensitive targeting attributes', () => {
      const input = {
        id: 'exp-sensitive',
        name: 'Sensitive targeting',
        audienceCriteria: { religion: 'minority' }
      };
      const res = validateUpsertExperiment(input);
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain('Prohibited sensitive attribute');
    });
  });

  describe('validateAssignVariant', () => {
    it('accepts valid assignment payload', () => {
      const input = {
        experimentId: 'exp-valid-test',
        citizenId: 'user_456',
        context: { preferredLanguage: 'ta' },
        optIn: true
      };
      const res = validateAssignVariant(input);
      expect(res.valid).toBe(true);
      expect(res.value.optIn).toBe(true);
    });

    it('rejects prohibited attributes in citizen context', () => {
      const input = {
        experimentId: 'exp-valid-test',
        context: { casteCategory: 'sc' }
      };
      const res = validateAssignVariant(input);
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain('Prohibited sensitive attribute');
    });
  });

  describe('validateRecordMetric', () => {
    it('validates score range and variant id', () => {
      const valid = validateRecordMetric({
        experimentId: 'exp-valid',
        variantId: 'control',
        relevanceScore: 0.85
      });
      expect(valid.valid).toBe(true);

      const invalidScore = validateRecordMetric({
        experimentId: 'exp-valid',
        variantId: 'control',
        relevanceScore: 1.5
      });
      expect(invalidScore.valid).toBe(false);
    });
  });

  describe('validateRollback', () => {
    it('validates rollback payload', () => {
      const res = validateRollback({
        experimentId: 'exp-rollback-target',
        reason: 'Detected high latency'
      });
      expect(res.valid).toBe(true);
      expect(res.value.reason).toBe('Detected high latency');
    });
  });
});
