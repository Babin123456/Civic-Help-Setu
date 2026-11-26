import { describe, it, expect, beforeEach } from 'vitest';
import {
  forecastGrievanceSla,
  analyzeStageBottlenecks,
  evaluateForecastDriftAndCalibration,
  proposeBottleneckIntervention,
  approveBottleneckIntervention,
  rejectBottleneckIntervention,
  listBottleneckInterventions,
  listInterventionAuditLogs,
  resetGrievanceSlaStorage,
  calculatePercentile,
} from './grievanceSlaForecastingService';
import {
  JURISDICTIONS,
  GRIEVANCE_CATEGORIES,
  BOTTLENECK_STAGES,
  ACTION_RECOMMENDATION_STATUS,
  RISK_LEVELS,
} from '../data/grievanceSlaContract';

describe('grievanceSlaForecastingService (#1175)', () => {
  beforeEach(() => {
    resetGrievanceSlaStorage();
  });

  describe('calculatePercentile', () => {
    it('computes correct percentiles with interpolation', () => {
      const numbers = [10, 20, 30, 40, 50];
      expect(calculatePercentile(numbers, 50)).toBe(30);
      expect(calculatePercentile(numbers, 0)).toBe(10);
      expect(calculatePercentile(numbers, 100)).toBe(50);
    });
  });

  describe('forecastGrievanceSla', () => {
    it('computes valid statistical forecasts with prediction intervals for active cohorts', () => {
      const res = forecastGrievanceSla({
        jurisdiction: JURISDICTIONS.DELHI_CENTRAL,
        category: GRIEVANCE_CATEGORIES.MUNICIPAL_WATER_SANITATION,
      });

      expect(res.status).toBe('ACTIVE');
      expect(res.disclaimer).toContain('NOT legal guarantees');
      expect(res.statutorySlaDays).toBe(7);
      expect(res.sampleSize).toBe(85);
      expect(res.missingDataCount).toBe(3);
      expect(res.missingnessRate).toBeGreaterThan(0);
      expect(res.isSuppressedForPrivacy).toBe(false);

      expect(res.forecast).toBeDefined();
      expect(res.forecast.medianDays).toBeGreaterThan(0);
      expect(res.forecast.iqr.p25Days).toBeLessThanOrEqual(res.forecast.medianDays);
      expect(res.forecast.iqr.p75Days).toBeGreaterThanOrEqual(res.forecast.medianDays);
      expect(res.forecast.confidenceInterval80.lowerDays).toBeLessThanOrEqual(res.forecast.confidenceInterval80.upperDays);
      expect(res.forecast.confidenceInterval95.lowerDays).toBeLessThanOrEqual(res.forecast.confidenceInterval95.upperDays);
      expect(res.forecast.predictedBreachProbability).toBeGreaterThanOrEqual(0);
      expect(Object.values(RISK_LEVELS)).toContain(res.forecast.riskLevel);
    });

    it('enforces differential privacy gate when cohort sample size is below MIN_COHORT_SAMPLE_SIZE', () => {
      const res = forecastGrievanceSla({
        jurisdiction: JURISDICTIONS.PUNE_DISTRICT,
        category: GRIEVANCE_CATEGORIES.PENSION_SOCIAL_WELFARE,
      });

      expect(res.status).toBe('PRIVACY_SUPPRESSED');
      expect(res.isSuppressedForPrivacy).toBe(true);
      expect(res.forecast).toBeNull();
      expect(res.disclaimer).toContain('suppressed under privacy preservation');
      expect(res.sampleSize).toBe(6);
    });

    it('returns safe fallback when no cohort data is available', () => {
      const res = forecastGrievanceSla({
        jurisdiction: JURISDICTIONS.CHENNAI_CORP,
        category: GRIEVANCE_CATEGORIES.ELECTRICITY_SUPPLY, // not present in mock synthetic data
      });

      expect(res.status).toBe('NO_COHORT_DATA');
      expect(res.forecast).toBeNull();
      expect(res.message).toContain('Insufficient historical cohort records');
    });

    it('throws descriptive error on invalid boundary inputs', () => {
      expect(() => {
        forecastGrievanceSla({ jurisdiction: 'INVALID', category: 'FAKE' });
      }).toThrow(/Invalid query/);
    });
  });

  describe('analyzeStageBottlenecks', () => {
    it('decomposes stages and identifies primary bottleneck stage and excess days', () => {
      const analysis = analyzeStageBottlenecks(
        JURISDICTIONS.DELHI_CENTRAL,
        GRIEVANCE_CATEGORIES.RATION_CARD_PDS
      );

      expect(analysis.status).toBe('ANALYZED');
      expect(analysis.totalCycleDays).toBeGreaterThan(0);
      expect(analysis.stages.length).toBe(5);
      expect(analysis.exceededStages.length).toBeGreaterThan(0);
      // Field inspection benchmark is 7, duration is 12 -> exceeded by 5 days
      expect(analysis.primaryBottleneckStage).toBe(BOTTLENECK_STAGES.FIELD_INSPECTION);
    });

    it('returns empty analysis if no stage data exists', () => {
      const analysis = analyzeStageBottlenecks('NON_EXISTENT', 'INVALID');
      expect(analysis.status).toBe('NO_STAGE_DATA');
      expect(analysis.bottlenecks).toEqual([]);
      expect(analysis.primaryBottleneckStage).toBeNull();
    });
  });

  describe('evaluateForecastDriftAndCalibration', () => {
    it('evaluates distribution drift and calibration error against validation observations', () => {
      // Historical Delhi water median ~7, mean ~7.8
      const validationObservationsStable = [5, 6, 7, 7, 8, 8, 9, 10];
      const evaluation = evaluateForecastDriftAndCalibration(
        'coh_dl_water_q1_2026',
        validationObservationsStable
      );

      expect(evaluation.cohortId).toBe('coh_dl_water_q1_2026');
      expect(evaluation.driftDetected).toBe(false);
      expect(evaluation.driftStatus).toBe('STABLE');
      expect(evaluation.calibrationError).toBeGreaterThanOrEqual(0);
      expect(['WELL_CALIBRATED', 'FAIR', 'POOR']).toContain(evaluation.calibrationStatus);
    });

    it('detects drift when validation distribution shifts significantly', () => {
      // Shifted observations with high delay surge
      const validationObservationsDrifted = [18, 22, 25, 28, 30, 32];
      const evaluation = evaluateForecastDriftAndCalibration(
        'coh_dl_water_q1_2026',
        validationObservationsDrifted
      );

      expect(evaluation.driftDetected).toBe(true);
      expect(evaluation.driftStatus).toBe('DRIFT_ALERT');
      expect(evaluation.meanShiftDays).toBeGreaterThan(5);
    });

    it('throws error for invalid validation inputs', () => {
      expect(() => {
        evaluateForecastDriftAndCalibration('coh_dl_water_q1_2026', []);
      }).toThrow(/Validation observations must be a non-empty array/);

      expect(() => {
        evaluateForecastDriftAndCalibration('unknown_cohort', [1, 2, 3]);
      }).toThrow(/Cohort unknown_cohort not found/);
    });
  });

  describe('Human-in-the-Loop Interventions Workflow', () => {
    it('allows proposing, approving, and auditing bottleneck interventions', () => {
      const action = proposeBottleneckIntervention({
        stage: BOTTLENECK_STAGES.FIELD_INSPECTION,
        title: 'Deploy additional revenue inspectors to backlog zone',
        details: 'Backlog in Ward 7 exceeds statutory SLA by 5 days.',
        recommendedBy: 'AI_BOTTLENECK_DIAGNOSTIC_ENGINE',
      });

      expect(action.actionId).toBeDefined();
      expect(action.status).toBe(ACTION_RECOMMENDATION_STATUS.PROPOSED);
      expect(action.approvedBy).toBeNull();

      // Retrieve actions list
      const actions = listBottleneckInterventions();
      expect(actions.length).toBe(1);

      // Approve action
      const approved = approveBottleneckIntervention(action.actionId, 'OFFICER_ID_9042');
      expect(approved.status).toBe(ACTION_RECOMMENDATION_STATUS.APPROVED);
      expect(approved.approvedBy).toBe('OFFICER_ID_9042');
      expect(approved.approvedAt).toBeDefined();

      // Verify audit trail
      const audit = listInterventionAuditLogs();
      expect(audit.length).toBe(2);
      expect(audit[0].eventType).toBe('APPROVE_INTERVENTION');
      expect(audit[0].actor).toBe('OFFICER_ID_9042');
      expect(audit[1].eventType).toBe('PROPOSE_INTERVENTION');
    });

    it('allows rejecting interventions with justification', () => {
      const action = proposeBottleneckIntervention({
        stage: BOTTLENECK_STAGES.INTAKE_TRIAGE,
        title: 'Automate rejection of incomplete dockets',
        details: 'Proposal to auto-reject applications missing property tax receipts.',
        recommendedBy: 'TRIAGE_RULE_ENGINE',
      });

      const rejected = rejectBottleneckIntervention(
        action.actionId,
        'DY_COMMISSIONER_102',
        'Citizens must be given 7 days rectification notice under RTS Act'
      );

      expect(rejected.status).toBe(ACTION_RECOMMENDATION_STATUS.REJECTED);
      expect(rejected.rejectionReason).toContain('rectification notice');

      const audit = listInterventionAuditLogs();
      expect(audit[0].eventType).toBe('REJECT_INTERVENTION');
      expect(audit[0].notes).toContain('rectification notice');
    });

    it('rejects approval of non-existent actions', () => {
      expect(() => {
        approveBottleneckIntervention('act_non_existent', 'OFFICER_1');
      }).toThrow(/not found/);
    });
  });
});
