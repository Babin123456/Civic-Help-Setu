import { describe, it, expect, beforeEach } from 'vitest';
import {
  initializeCounterDemandStorage,
  createDraftCapacityPlan,
  transitionCapacityPlanStatus,
  recordDemandAggregate,
  getOfficeAggregates,
  getCapacityPlans,
} from './counterDemandForecastingService.js';
import { CAPACITY_PLAN_STATUSES, validateDemandAggregate } from '../data/counterDemandContract.js';

describe('Counter Demand Security & Authorization Tests (#764)', () => {
  beforeEach(() => {
    initializeCounterDemandStorage(true);
  });

  describe('Role-Based Access Control (RBAC) & Scope Guarding', () => {
    it('permits operators to create drafts and submit for review', () => {
      const plan = createDraftCapacityPlan({
        officeId: 'off_delhi_south_01',
        planDate: '2026-11-20',
        userId: 'operator_12',
        userRole: 'operator',
      });

      expect(plan.status).toBe(CAPACITY_PLAN_STATUSES.DRAFT);
      expect(plan.createdRole).toBe('operator');

      const submitted = transitionCapacityPlanStatus({
        planId: plan.planId,
        targetStatus: CAPACITY_PLAN_STATUSES.SUBMITTED,
        userId: 'operator_12',
        userRole: 'operator',
      });
      expect(submitted.status).toBe(CAPACITY_PLAN_STATUSES.SUBMITTED);
    });

    it('denies citizen and guest roles from approving capacity plans', () => {
      const plan = createDraftCapacityPlan({
        officeId: 'off_delhi_south_01',
        planDate: '2026-11-20',
        userId: 'operator_12',
        userRole: 'operator',
      });

      transitionCapacityPlanStatus({
        planId: plan.planId,
        targetStatus: CAPACITY_PLAN_STATUSES.SUBMITTED,
        userId: 'operator_12',
        userRole: 'operator',
      });

      // Citizen approval attempt
      expect(() => {
        transitionCapacityPlanStatus({
          planId: plan.planId,
          targetStatus: CAPACITY_PLAN_STATUSES.APPROVED,
          userId: 'citizen_guest',
          userRole: 'citizen',
        });
      }).toThrow(/Unauthorized: Only administrators or centre managers/);
    });

    it('permits centre managers and administrators to approve submitted plans', () => {
      const plan = createDraftCapacityPlan({
        officeId: 'off_delhi_south_01',
        planDate: '2026-11-20',
      });

      transitionCapacityPlanStatus({
        planId: plan.planId,
        targetStatus: CAPACITY_PLAN_STATUSES.SUBMITTED,
      });

      const approved = transitionCapacityPlanStatus({
        planId: plan.planId,
        targetStatus: CAPACITY_PLAN_STATUSES.APPROVED,
        userId: 'admin_officer',
        userRole: 'admin',
      });

      expect(approved.status).toBe(CAPACITY_PLAN_STATUSES.APPROVED);
      expect(approved.approvedBy).toBe('admin_officer');
    });

    it('requires a clear rejection reason when a reviewer rejects a submitted plan', () => {
      const plan = createDraftCapacityPlan({
        officeId: 'off_delhi_south_01',
        planDate: '2026-11-20',
      });

      transitionCapacityPlanStatus({
        planId: plan.planId,
        targetStatus: CAPACITY_PLAN_STATUSES.SUBMITTED,
      });

      expect(() => {
        transitionCapacityPlanStatus({
          planId: plan.planId,
          targetStatus: CAPACITY_PLAN_STATUSES.REJECTED,
          userRole: 'manager',
          reason: '',
        });
      }).toThrow(/Rejection reason is required/);

      const rejected = transitionCapacityPlanStatus({
        planId: plan.planId,
        targetStatus: CAPACITY_PLAN_STATUSES.REJECTED,
        userRole: 'manager',
        reason: 'Counter 2 staffing overlaps with scheduled regional biometric training.',
      });

      expect(rejected.status).toBe(CAPACITY_PLAN_STATUSES.REJECTED);
      expect(rejected.rejectionReason).toContain('biometric training');
    });
  });

  describe('Zero-PII & Threat Modeling Safeguards', () => {
    it('defends against citizen identification enumeration by stripping and blocking PII fields', () => {
      const maliciousRecords = [
        {
          officeId: 'off_delhi_south_01',
          date: '2026-11-20',
          totalFootfall: 20,
          citizenName: 'Sneha Roy',
        },
        {
          officeId: 'off_delhi_south_01',
          date: '2026-11-20',
          totalFootfall: 20,
          phone: '9876543210',
        },
        {
          officeId: 'off_delhi_south_01',
          date: '2026-11-20',
          totalFootfall: 20,
          aadhaar: '1234 5678 9012',
        },
        {
          officeId: 'off_delhi_south_01',
          date: '2026-11-20',
          totalFootfall: 20,
          applicationId: 'APP-10293847',
        },
      ];

      for (const rec of maliciousRecords) {
        const validation = validateDemandAggregate(rec);
        expect(validation.valid).toBe(false);
        expect(validation.error).toMatch(/Zero-PII violation/);
      }
    });

    it('enforces k-anonymity small-group suppression for arrival counts < 5', () => {
      const rec = recordDemandAggregate({
        aggregateId: 'agg_suppress_test_01',
        officeId: 'off_delhi_south_01',
        date: '2026-11-21',
        timeSlot: '16:00-17:00',
        hourIndex: 7,
        categoryId: 'cat_aadhaar',
        appointmentCount: 2,
        walkInCount: 1,
        totalFootfall: 3,
        avgServiceDurationMinutes: 14,
        noShowCount: 0,
        isHoliday: false,
      });

      expect(rec.isSuppressed).toBe(true);
      expect(rec.totalFootfall).toBe(0);
      expect(rec.appointmentCount).toBe(0);
      expect(rec.walkInCount).toBe(0);
    });

    it('handles database migration resilience against both empty storage and populated dataset', () => {
      // Empty storage migration
      initializeCounterDemandStorage(true);
      const emptyPlans = getCapacityPlans();
      expect(Array.isArray(emptyPlans)).toBe(true);

      const delAggs = getOfficeAggregates('off_delhi_south_01');
      expect(delAggs.length).toBeGreaterThanOrEqual(400);

      // Subsequent initialization preserves existing plans
      createDraftCapacityPlan({
        officeId: 'off_delhi_south_01',
        planDate: '2026-11-22',
      });
      initializeCounterDemandStorage(false);
      expect(getCapacityPlans('off_delhi_south_01').length).toBe(1);
    });
  });
});
