/**
 * src/data/civicRecommendationExperimentationConstants.test.js
 */

import { describe, it, expect } from 'vitest';
import {
  CIVIC_EXPERIMENTATION_SCHEMA_VERSION,
  CIVIC_EXPERIMENTATION_STORAGE_KEY,
  CIVIC_EXPERIMENTATION_DISCLAIMER,
  EXPERIMENT_STATUS,
  EXPERIMENTATION_ERRORS,
  GUARDRAIL_METRIC_TYPE,
  PROHIBITED_TARGETING_ATTRIBUTES,
  DEFAULT_GUARDRAILS,
  DEFAULT_VARIANT,
  DEFAULT_EXPERIMENT,
  EXPERIMENT_ID_PATTERN,
  VARIANT_ID_PATTERN,
  CITIZEN_ID_PATTERN
} from './civicRecommendationExperimentationConstants.js';

describe('civicRecommendationExperimentationConstants', () => {
  it('defines positive schema version and valid storage key', () => {
    expect(CIVIC_EXPERIMENTATION_SCHEMA_VERSION).toBe(1);
    expect(typeof CIVIC_EXPERIMENTATION_STORAGE_KEY).toBe('string');
    expect(CIVIC_EXPERIMENTATION_STORAGE_KEY.length).toBeGreaterThan(0);
    expect(CIVIC_EXPERIMENTATION_DISCLAIMER).toContain('deterministic');
  });

  it('defines experiment status enums', () => {
    expect(EXPERIMENT_STATUS.DRAFT).toBe('draft');
    expect(EXPERIMENT_STATUS.ACTIVE).toBe('active');
    expect(EXPERIMENT_STATUS.PAUSED).toBe('paused');
    expect(EXPERIMENT_STATUS.CONCLUDED).toBe('concluded');
    expect(EXPERIMENT_STATUS.ROLLED_BACK).toBe('rolled_back');
  });

  it('defines standardized error codes prefixed with RE_', () => {
    for (const [key, code] of Object.entries(EXPERIMENTATION_ERRORS)) {
      expect(key).toBeDefined();
      expect(code.startsWith('RE_')).toBe(true);
    }
  });

  it('defines guardrail metric types', () => {
    expect(GUARDRAIL_METRIC_TYPE.MIN_RELEVANCE).toBe('min_relevance');
    expect(GUARDRAIL_METRIC_TYPE.MIN_LANGUAGE_COVERAGE).toBe('min_language_coverage');
    expect(GUARDRAIL_METRIC_TYPE.MAX_ERROR_RATE).toBe('max_error_rate');
    expect(GUARDRAIL_METRIC_TYPE.MIN_COHORT_SIZE).toBe('min_cohort_size');
  });

  it('lists critical prohibited targeting attributes', () => {
    expect(PROHIBITED_TARGETING_ATTRIBUTES).toContain('caste');
    expect(PROHIBITED_TARGETING_ATTRIBUTES).toContain('religion');
    expect(PROHIBITED_TARGETING_ATTRIBUTES).toContain('gender');
    expect(PROHIBITED_TARGETING_ATTRIBUTES).toContain('aadhaar');
    expect(PROHIBITED_TARGETING_ATTRIBUTES).toContain('pan');
  });

  it('provides sensible default guardrails', () => {
    expect(DEFAULT_GUARDRAILS.minRelevanceScore).toBeGreaterThan(0);
    expect(DEFAULT_GUARDRAILS.minLanguageCoverage).toBeGreaterThan(0);
    expect(DEFAULT_GUARDRAILS.maxErrorRate).toBeLessThan(0.2);
    expect(DEFAULT_GUARDRAILS.minCohortSize).toBeGreaterThanOrEqual(10);
  });

  it('provides valid default variant and experiment', () => {
    expect(DEFAULT_VARIANT.id).toBe('control');
    expect(DEFAULT_VARIANT.weight).toBe(50);
    expect(DEFAULT_EXPERIMENT.variants.length).toBe(2);
    expect(DEFAULT_EXPERIMENT.optInRequired).toBe(true);
    expect(DEFAULT_EXPERIMENT.noCitizenData).toBe(true);
  });

  it('validates slug and id patterns', () => {
    expect(EXPERIMENT_ID_PATTERN.test('exp-local-boost')).toBe(true);
    expect(EXPERIMENT_ID_PATTERN.test('EXP-INVALID')).toBe(false);
    expect(EXPERIMENT_ID_PATTERN.test('with space')).toBe(false);

    expect(VARIANT_ID_PATTERN.test('control')).toBe(true);
    expect(VARIANT_ID_PATTERN.test('treatment-1')).toBe(true);

    expect(CITIZEN_ID_PATTERN.test('user_12345')).toBe(true);
    expect(CITIZEN_ID_PATTERN.test('citizen-abc-xyz')).toBe(true);
  });
});
