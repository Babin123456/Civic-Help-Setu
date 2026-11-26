import { describe, it, expect } from 'vitest';
import {
  JURISDICTIONS,
  GRIEVANCE_CATEGORIES,
  BOTTLENECK_STAGES,
  STATUTORY_SLA_DAYS,
  MIN_COHORT_SAMPLE_SIZE,
  SYNTHETIC_GRIEVANCE_COHORTS,
  validateGrievanceForecastQuery,
  validateBottleneckActionInput,
} from './grievanceSlaContract';

describe('grievanceSlaContract (#1175)', () => {
  it('defines valid jurisdictions and grievance categories', () => {
    expect(Object.keys(JURISDICTIONS).length).toBeGreaterThanOrEqual(4);
    expect(Object.keys(GRIEVANCE_CATEGORIES).length).toBeGreaterThanOrEqual(5);
    expect(STATUTORY_SLA_DAYS[GRIEVANCE_CATEGORIES.MUNICIPAL_WATER_SANITATION]).toBe(7);
    expect(MIN_COHORT_SAMPLE_SIZE).toBe(10);
  });

  it('contains valid synthetic cohorts with zero PII', () => {
    expect(SYNTHETIC_GRIEVANCE_COHORTS.length).toBeGreaterThan(0);
    SYNTHETIC_GRIEVANCE_COHORTS.forEach((cohort) => {
      expect(cohort.cohortId).toBeDefined();
      expect(cohort.jurisdiction).toBeDefined();
      expect(cohort.category).toBeDefined();
      expect(Array.isArray(cohort.durationsDays)).toBe(true);
      expect(cohort.sampleSize).toBeGreaterThan(0);
      expect(typeof cohort.missingDataCount).toBe('number');
      // Verify no citizen names, phone numbers, or docket PII
      expect(cohort).not.toHaveProperty('citizenName');
      expect(cohort).not.toHaveProperty('phone');
      expect(cohort).not.toHaveProperty('aadhaar');
    });
  });

  it('validates forecast queries correctly at trust boundaries', () => {
    const valid = validateGrievanceForecastQuery({
      jurisdiction: JURISDICTIONS.DELHI_CENTRAL,
      category: GRIEVANCE_CATEGORIES.MUNICIPAL_WATER_SANITATION,
    });
    expect(valid.isValid).toBe(true);
    expect(valid.errors).toHaveLength(0);

    const invalid = validateGrievanceForecastQuery({
      jurisdiction: 'INVALID_ZONE',
      category: 'UNKNOWN_SERVICE',
    });
    expect(invalid.isValid).toBe(false);
    expect(invalid.errors.length).toBeGreaterThanOrEqual(2);

    const empty = validateGrievanceForecastQuery(null);
    expect(empty.isValid).toBe(false);
  });

  it('validates bottleneck action proposal inputs for human approval gate', () => {
    const valid = validateBottleneckActionInput({
      stage: BOTTLENECK_STAGES.FIELD_INSPECTION,
      title: 'Deploy additional junior engineers to Ward 4',
      recommendedBy: 'AI_BOTTLENECK_ENGINE',
    });
    expect(valid.isValid).toBe(true);

    const invalid = validateBottleneckActionInput({
      stage: 'INVALID_STAGE',
      title: 'Fix',
      recommendedBy: '',
    });
    expect(invalid.isValid).toBe(false);
    expect(invalid.errors.length).toBeGreaterThanOrEqual(2);
  });
});
