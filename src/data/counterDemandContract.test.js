import { describe, it, expect } from 'vitest';
import {
  CAPACITY_PLAN_STATUSES,
  ALLOWED_PLAN_TRANSITIONS,
  MOCK_OFFICE_CAPACITIES,
  MOCK_SERVICE_CATEGORIES,
  MOCK_HOLIDAY_CALENDAR,
  OPERATING_HOURS,
  generateSyntheticDemandAggregates,
  validateDemandAggregate,
  validateCapacityPlan,
  validatePlanStateTransition,
} from './counterDemandContract.js';

describe('counterDemandContract', () => {
  it('defines valid statuses and allowed transition rules', () => {
    expect(ALLOWED_PLAN_TRANSITIONS[CAPACITY_PLAN_STATUSES.DRAFT]).toContain(
      CAPACITY_PLAN_STATUSES.SUBMITTED
    );
    expect(ALLOWED_PLAN_TRANSITIONS[CAPACITY_PLAN_STATUSES.SUBMITTED]).toContain(
      CAPACITY_PLAN_STATUSES.APPROVED
    );
    expect(ALLOWED_PLAN_TRANSITIONS[CAPACITY_PLAN_STATUSES.APPROVED]).not.toContain(
      CAPACITY_PLAN_STATUSES.DRAFT
    );
    expect(ALLOWED_PLAN_TRANSITIONS[CAPACITY_PLAN_STATUSES.ARCHIVED]).toHaveLength(0);
  });

  it('validates state transitions accurately', () => {
    const valid = validatePlanStateTransition(
      CAPACITY_PLAN_STATUSES.DRAFT,
      CAPACITY_PLAN_STATUSES.SUBMITTED
    );
    expect(valid.valid).toBe(true);

    const invalid = validatePlanStateTransition(
      CAPACITY_PLAN_STATUSES.APPROVED,
      CAPACITY_PLAN_STATUSES.DRAFT
    );
    expect(invalid.valid).toBe(false);
    expect(invalid.error).toContain('Invalid transition');
  });

  it('generates valid synthetic aggregates with zero PII', () => {
    const records = generateSyntheticDemandAggregates('off_delhi_south_01', 10);
    expect(records.length).toBeGreaterThan(0);

    for (const rec of records) {
      expect(rec.officeId).toBe('off_delhi_south_01');
      expect(rec.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(rec).not.toHaveProperty('citizenName');
      expect(rec).not.toHaveProperty('applicantName');
      expect(rec).not.toHaveProperty('phone');
      expect(rec).not.toHaveProperty('applicationId');
      expect(validateDemandAggregate(rec).valid).toBe(true);
    }
  });

  it('strictly rejects any demand aggregate containing citizen PII', () => {
    const withName = {
      officeId: 'off_delhi_south_01',
      date: '2026-11-15',
      totalFootfall: 25,
      citizenName: 'Dev Sharma',
    };
    const res = validateDemandAggregate(withName);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('Zero-PII violation');
  });

  it('validates capacity plan structure', () => {
    const validPlan = {
      officeId: 'off_delhi_south_01',
      planDate: '2026-11-16',
      status: CAPACITY_PLAN_STATUSES.DRAFT,
      hourlyStaffing: [{ hour: '09:00', allocatedCounters: 4 }],
    };
    expect(validateCapacityPlan(validPlan).valid).toBe(true);

    const invalidPlan = {
      officeId: 'off_delhi_south_01',
      status: 'NON_EXISTENT_STATUS',
      hourlyStaffing: [],
    };
    expect(validateCapacityPlan(invalidPlan).valid).toBe(false);
  });

  it('exports populated mock offices and service categories with constraints', () => {
    expect(MOCK_OFFICE_CAPACITIES.length).toBeGreaterThanOrEqual(4);
    expect(MOCK_SERVICE_CATEGORIES.length).toBeGreaterThanOrEqual(4);
    expect(MOCK_HOLIDAY_CALENDAR.length).toBeGreaterThanOrEqual(4);
    expect(OPERATING_HOURS).toEqual([
      '09:00',
      '10:00',
      '11:00',
      '12:00',
      '13:00',
      '14:00',
      '15:00',
      '16:00',
    ]);
  });
});

