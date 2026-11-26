/**
 * src/data/civicSourceFreshnessPredictionConstants.test.js
 *
 * Unit tests for versioned schema, enums, error codes and feature weights for
 * the Civic Information Freshness Prediction and Review Prioritization Model
 * (#1189).
 */

import { describe, it, expect } from 'vitest';
import {
  CIVIC_SOURCE_FRESHNESS_SCHEMA_VERSION,
  DEFAULT_PREDICTION,
  FRESHNESS_PREDICTION_STATUS,
  FRESHNESS_PREDICTION_ERRORS,
  PRIORITY_BAND,
  PRIORITY_THRESHOLDS,
  DEFAULT_FEATURE_WEIGHTS,
  FEATURE_NAME
} from './civicSourceFreshnessPredictionConstants.js';

describe('civicSourceFreshnessPredictionConstants', () => {
  it('exposes a schema version', () => {
    expect(CIVIC_SOURCE_FRESHNESS_SCHEMA_VERSION).toBe(1);
  });

  it('default prediction has required fields', () => {
    expect(DEFAULT_PREDICTION.serviceId).toBe('');
    expect(DEFAULT_PREDICTION.priorityBand).toBe(PRIORITY_BAND.LOW);
    expect(DEFAULT_PREDICTION.priorityScore).toBe(0);
    expect(DEFAULT_PREDICTION.disclaimer).toContain('triage hints');
    expect(DEFAULT_PREDICTION.noCitizenData).toBe(true);
    expect(DEFAULT_PREDICTION.untrusted).toBe(true);
    expect(DEFAULT_PREDICTION.requiresHumanReview).toBe(true);
  });

  it('exposes status enums', () => {
    expect(FRESHNESS_PREDICTION_STATUS.COMPUTED).toBe('computed');
    expect(FRESHNESS_PREDICTION_STATUS.PENDING).toBe('pending');
    expect(FRESHNESS_PREDICTION_STATUS.REVIEWED).toBe('reviewed');
  });

  it('exposes priority band enums', () => {
    expect(PRIORITY_BAND.LOW).toBe('low');
    expect(PRIORITY_BAND.MEDIUM).toBe('medium');
    expect(PRIORITY_BAND.HIGH).toBe('high');
    expect(PRIORITY_BAND.CRITICAL).toBe('critical');
  });

  it('exposes error codes', () => {
    expect(FRESHNESS_PREDICTION_ERRORS.INVALID_REQUEST).toBe('FP_INVALID_REQUEST');
    expect(FRESHNESS_PREDICTION_ERRORS.VALIDATION_FAILED).toBe('FP_VALIDATION_FAILED');
    expect(FRESHNESS_PREDICTION_ERRORS.SERVICE_NOT_FOUND).toBe('FP_SERVICE_NOT_FOUND');
  });

  it('exposes priority thresholds', () => {
    expect(PRIORITY_THRESHOLDS.CRITICAL).toBe(0.70);
    expect(PRIORITY_THRESHOLDS.HIGH).toBe(0.50);
    expect(PRIORITY_THRESHOLDS.MEDIUM).toBe(0.30);
    expect(PRIORITY_THRESHOLDS.LOW).toBe(0.00);
  });

  it('feature weights are defined for all feature names', () => {
    expect(DEFAULT_FEATURE_WEIGHTS[FEATURE_NAME.DAYS_SINCE_VERIFICATION]).toBe(0.30);
    expect(DEFAULT_FEATURE_WEIGHTS[FEATURE_NAME.LINK_HEALTH]).toBe(0.25);
    expect(DEFAULT_FEATURE_WEIGHTS[FEATURE_NAME.SOURCE_AGE]).toBe(0.15);
    expect(DEFAULT_FEATURE_WEIGHTS[FEATURE_NAME.SUPERSEDED_STATUS]).toBe(0.10);
    expect(DEFAULT_FEATURE_WEIGHTS[FEATURE_NAME.CHANGE_FREQUENCY]).toBe(0.10);
    expect(DEFAULT_FEATURE_WEIGHTS[FEATURE_NAME.GOV_DOMAIN]).toBe(-0.05);
    expect(DEFAULT_FEATURE_WEIGHTS[FEATURE_NAME.VERIFICATION_COUNT]).toBe(-0.05);
  });
});
