import { describe, it, expect, beforeEach } from 'vitest';
import {
  initializeCounterDemandStorage,
  recordDemandAggregate,
  calculateErlangC,
  calculateAverageWaitMinutes,
  calculateRecommendedCounters,
  forecastHourlyDemand,
  runBacktestEvaluation,
  detectForecastDrift,
  createDraftCapacityPlan,
  updateCapacityPlanAllocations,
  transitionCapacityPlanStatus,
  getCapacityAuditLogs,
} from './counterDemandForecastingService.js';
import { CAPACITY_PLAN_STATUSES } from '../data/counterDemandContract.js';

describe('counterDemandForecastingService', () => {
  beforeEach(() => {
    initializeCounterDemandStorage(true);
  });

  describe('Erlang-C Queueing Theory & Queue Staffing', () => {
    it('calculates Erlang-C delay probability correctly', () => {
      // 10 arrivals per hour, service rate 6 per hour -> A = 1.666
      const pw1 = calculateErlangC(1, 1.666);
      expect(pw1).toBe(1.0); // c <= A -> oversaturated

      const pw2 = calculateErlangC(3, 1.666);
      expect(pw2).toBeGreaterThan(0);
      expect(pw2).toBeLessThan(1.0);

      // Higher capacity reduces delay probability
      const pw4 = calculateErlangC(4, 1.666);
      expect(pw4).toBeLessThan(pw2);
    });

    it('calculates average waiting time in queue', () => {
      // lambda=20, mu=5, c=5 -> A = 4.0
      const waitMinutes = calculateAverageWaitMinutes(5, 20, 5);
      expect(waitMinutes).toBeGreaterThan(0);
      expect(waitMinutes).toBeLessThan(60);

      // Saturated capacity yields Infinity
      expect(calculateAverageWaitMinutes(4, 20, 5)).toBe(Infinity);
    });

    it('solves for recommended open counters adhering to utilization <= 0.85', () => {
      const res = calculateRecommendedCounters({
        expectedArrivalsPerHour: 30,
        avgServiceDurationMinutes: 12, // mu = 5
        targetWaitMinutes: 20,
        maxPhysicalCounters: 12,
        bufferRatio: 0.15,
      });

      // A = 30 / 5 = 6.0 Erlangs
      // For rho <= 0.85, c must be at least ceil(6 / 0.85) = 8
      expect(res.recommendedCounters).toBeGreaterThanOrEqual(7);
      expect(res.utilization).toBeLessThanOrEqual(0.85);
      expect(res.bufferCounters).toBeGreaterThanOrEqual(res.recommendedCounters);
      expect(res.expectedWaitMinutes).toBeLessThan(20);
    });
  });

  describe('Demand Forecasting & Seasonality Engine', () => {
    it('produces 8-hour forecast with prediction interval bounds', () => {
      const fc = forecastHourlyDemand('off_delhi_south_01', '2026-11-18'); // Wednesday
      expect(fc.isOfficeClosed).toBe(false);
      expect(fc.hourlyForecast).toHaveLength(8);

      fc.hourlyForecast.forEach((slot) => {
        expect(slot.predictedDemand).toBeGreaterThan(0);
        expect(slot.lowerBound80).toBeLessThanOrEqual(slot.predictedDemand);
        expect(slot.upperBound80).toBeGreaterThanOrEqual(slot.predictedDemand);
        expect(slot.lowerBound95).toBeLessThanOrEqual(slot.lowerBound80);
        expect(slot.upperBound95).toBeGreaterThanOrEqual(slot.upperBound80);
        expect(slot.recommendedCounters).toBeGreaterThan(0);
      });
    });

    it('handles Sunday weekly closure gracefully', () => {
      const sundayForecast = forecastHourlyDemand('off_delhi_south_01', '2026-11-15'); // 2026-11-15 is Sunday
      expect(sundayForecast.isOfficeClosed).toBe(true);
      expect(sundayForecast.closureReason).toContain('Sunday');
      sundayForecast.hourlyForecast.forEach((slot) => {
        expect(slot.predictedDemand).toBe(0);
        expect(slot.recommendedCounters).toBe(0);
      });
    });

    it('applies statutory holiday closure', () => {
      const holidayForecast = forecastHourlyDemand('off_delhi_south_01', '2026-10-02'); // Gandhi Jayanti
      expect(holidayForecast.isOfficeClosed).toBe(true);
      expect(holidayForecast.closureReason).toContain('Mahatma Gandhi Jayanti');
    });

    it('flags data sufficiency warnings for cold start offices with < 14 days of history', () => {
      const fc = forecastHourlyDemand('off_cold_start_05', '2026-11-18');
      expect(fc.isColdStart).toBe(true);
      expect(fc.sufficiencyWarning).toBe(true);
      expect(fc.historicalSamplesCount).toBeLessThan(14 * 8);
    });
  });

  describe('Backtesting and Drift Detection', () => {
    it('computes backtest accuracy metrics (MAE, RMSE, MAPE)', () => {
      const metrics = runBacktestEvaluation('off_delhi_south_01', 14);
      expect(metrics.insufficientData).toBe(false);
      expect(metrics.mae).toBeGreaterThan(0);
      expect(metrics.rmse).toBeGreaterThan(0);
      expect(metrics.mape).toBeGreaterThan(0);
      expect(metrics.naiveBaselineMae).toBeGreaterThan(metrics.mae);
    });

    it('detects when drift is within operational variance', () => {
      const drift = detectForecastDrift('off_delhi_south_01', 7);
      expect(drift).toHaveProperty('driftDetected');
      expect(typeof drift.driftDetected).toBe('boolean');
    });
  });

  describe('Capacity Plan FSM & Human Override Rules', () => {
    it('creates draft plan initialized with recommended counters', () => {
      const plan = createDraftCapacityPlan({
        officeId: 'off_delhi_south_01',
        planDate: '2026-11-18',
        userId: 'mgr_ravi',
        userRole: 'manager',
      });

      expect(plan.planId).toMatch(/^plan_off_delhi_south_01_/);
      expect(plan.status).toBe(CAPACITY_PLAN_STATUSES.DRAFT);
      expect(plan.hourlyStaffing.length).toBe(8);
      expect(plan.hourlyStaffing[0].allocatedCounters).toBe(
        plan.hourlyStaffing[0].recommendedCounters
      );
    });

    it('requires mandatory justification when human allocation diverges >= 20%', () => {
      const plan = createDraftCapacityPlan({
        officeId: 'off_delhi_south_01',
        planDate: '2026-11-18',
      });

      const initialRec = plan.hourlyStaffing[0].recommendedCounters;
      // Drastic increase by +50%
      const modifiedStaffing = [
        { hour: plan.hourlyStaffing[0].hour, allocatedCounters: initialRec + 4 },
      ];

      // Missing reason should throw
      expect(() => {
        updateCapacityPlanAllocations({
          planId: plan.planId,
          hourlyAllocations: modifiedStaffing,
          overrideReason: '',
        });
      }).toThrow(/Mandatory Override Justification/);

      // With valid reason should succeed
      const updated = updateCapacityPlanAllocations({
        planId: plan.planId,
        hourlyAllocations: modifiedStaffing,
        overrideReason: 'VIP citizen delegation visit expected between 09:00 and 11:00',
      });
      expect(updated.hasVarianceOverride).toBe(true);
      expect(updated.overrideReason).toContain('VIP citizen delegation');
    });

    it('executes valid FSM state transitions and rejects illegal transitions', () => {
      const plan = createDraftCapacityPlan({
        officeId: 'off_delhi_south_01',
        planDate: '2026-11-18',
      });

      // DRAFT -> SUBMITTED (Valid)
      const submitted = transitionCapacityPlanStatus({
        planId: plan.planId,
        targetStatus: CAPACITY_PLAN_STATUSES.SUBMITTED,
      });
      expect(submitted.status).toBe(CAPACITY_PLAN_STATUSES.SUBMITTED);

      // SUBMITTED -> DRAFT is invalid directly unless rejected
      expect(() => {
        transitionCapacityPlanStatus({
          planId: plan.planId,
          targetStatus: CAPACITY_PLAN_STATUSES.ARCHIVED,
        });
      }).toThrow(/Invalid transition/);

      // Non-manager/admin cannot approve
      expect(() => {
        transitionCapacityPlanStatus({
          planId: plan.planId,
          targetStatus: CAPACITY_PLAN_STATUSES.APPROVED,
          userRole: 'citizen',
        });
      }).toThrow(/Unauthorized/);

      // Manager can approve
      const approved = transitionCapacityPlanStatus({
        planId: plan.planId,
        targetStatus: CAPACITY_PLAN_STATUSES.APPROVED,
        userRole: 'manager',
        userId: 'mgr_ravi',
      });
      expect(approved.status).toBe(CAPACITY_PLAN_STATUSES.APPROVED);
      expect(approved.approvedBy).toBe('mgr_ravi');

      // APPROVED -> ARCHIVED (Valid)
      const archived = transitionCapacityPlanStatus({
        planId: plan.planId,
        targetStatus: CAPACITY_PLAN_STATUSES.ARCHIVED,
      });
      expect(archived.status).toBe(CAPACITY_PLAN_STATUSES.ARCHIVED);
    });

    it('records append-only audit trail for all significant actions', () => {
      const plan = createDraftCapacityPlan({
        officeId: 'off_delhi_south_01',
        planDate: '2026-11-18',
      });

      transitionCapacityPlanStatus({
        planId: plan.planId,
        targetStatus: CAPACITY_PLAN_STATUSES.SUBMITTED,
        userId: 'lead_operator',
      });

      const audits = getCapacityAuditLogs(plan.planId);
      expect(audits.length).toBeGreaterThanOrEqual(2);
      expect(audits.some((a) => a.action === 'CREATE_DRAFT')).toBe(true);
      expect(audits.some((a) => a.action === 'TRANSITION_SUBMITTED')).toBe(true);
    });
  });

  describe('Zero-PII & Privacy Controls', () => {
    it('sanitizes and suppresses small-group footfall (< 5 arrivals)', () => {
      const recorded = recordDemandAggregate({
        aggregateId: 'agg_test_small_group_01',
        officeId: 'off_delhi_south_01',
        date: '2026-11-14',
        timeSlot: '09:00-10:00',
        hourIndex: 0,
        categoryId: 'cat_aadhaar',
        appointmentCount: 2,
        walkInCount: 1,
        totalFootfall: 3, // < 5 count
        avgServiceDurationMinutes: 12,
        noShowCount: 0,
        isHoliday: false,
      });

      expect(recorded.isSuppressed).toBe(true);
      expect(recorded.totalFootfall).toBe(0);
      expect(recorded.appointmentCount).toBe(0);
    });

    it('rejects raw citizen data in aggregates', () => {
      expect(() => {
        recordDemandAggregate({
          aggregateId: 'agg_invalid_pii',
          officeId: 'off_delhi_south_01',
          date: '2026-11-14',
          totalFootfall: 20,
          applicantName: 'Sneha Roy',
        });
      }).toThrow(/Zero-PII violation/);
    });
  });
});

