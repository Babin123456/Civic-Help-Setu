import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ensureRoadSafetySeedData,
  calculateWeightedCrashScore,
  calculateExposureRiskRate,
  calculateInfrastructureHazardScore,
  evaluateSegmentRisk,
  executeRiskRun,
  listReviewCases,
  getReviewCaseDetail,
  transitionReviewCaseState,
  recordSiteInspection,
  recordIntervention,
  evaluateInterventionOutcome,
  submitCitizenHazardReport,
  compareTimePeriods,
  migrateRoadSafetyStorage,
  rollbackRoadSafetyStorage,
  serializePublicBlackspotSummary,
  getRoadSafetyAuditLogs,
  spatialJoinCrashToSegment,
  rescaleSegmentExposureForBoundaryChange,
  detectTemporalBiasInCrashHistory,
  RoadSafetyServiceError,
  RATE_LIMIT_MAX_SUBMISSIONS,
} from './roadSafetyBlackspotService';
import {
  ROAD_SAFETY_STORAGE_KEYS,
  CASE_STATES,
  SEED_ROAD_SEGMENTS,
} from '../data/roadSafetyContract';
import { setCurrentActor, PermissionDeniedError } from './accessControl';

const createMemoryStorage = () => {
  const store = new Map();
  return {
    getItem: vi.fn((key) => (store.has(key) ? store.get(key) : null)),
    setItem: vi.fn((key, value) => store.set(key, String(value))),
    removeItem: vi.fn((key) => store.delete(key)),
    clear: vi.fn(() => store.clear()),
    store,
  };
};

describe('roadSafetyBlackspotService', () => {
  let mockStorage;
  const ADMIN_ACTOR = { id: 'admin-1', role: 'admin', username: 'Chief Safety Engineer' };
  const CITIZEN_ACTOR = { id: 'cit-1', role: 'citizen', username: 'Citizen User' };

  beforeEach(() => {
    mockStorage = createMemoryStorage();
    setCurrentActor(ADMIN_ACTOR);
  });

  afterEach(() => {
    setCurrentActor(null);
  });

  describe('Storage Initialization & Bootstrap', () => {
    it('initializes empty storage with seed corridors, features, and bootstrap cases', () => {
      const seeded = ensureRoadSafetySeedData(mockStorage);
      expect(seeded).toBe(true);
      expect(mockStorage.setItem).toHaveBeenCalledWith(
        ROAD_SAFETY_STORAGE_KEYS.SEGMENTS,
        expect.any(String)
      );

      // Re-running does not overwrite existing data
      const reseeded = ensureRoadSafetySeedData(mockStorage);
      expect(reseeded).toBe(false);
    });
  });

  describe('Mathematical Formulations & Scoring', () => {
    it('computes MoRTH weighted crash severity accurately', () => {
      const sampleCrashes = [
        { fatalCount: 2, severeInjuryCount: 3, minorInjuryCount: 4, propertyDamageCount: 5 },
      ];
      // 2*5.0 + 3*3.0 + 4*1.0 + 5*0.2 = 10 + 9 + 4 + 1 = 24.0
      const score = calculateWeightedCrashScore(sampleCrashes);
      expect(score).toBe(24.0);
    });

    it('calculates exposure risk rate per million vehicle-km', () => {
      const result = calculateExposureRiskRate(50, 25);
      expect(result.rate).toBe(2.0);
      expect(result.uncertainty).toBe('low');
    });

    it('handles missing exposure denominators with explicit uncertainty bounds', () => {
      const result = calculateExposureRiskRate(50, null);
      expect(result.rate).toBeNull();
      expect(result.uncertainty).toBe('high');
      expect(result.reason).toContain('unavailable');
    });

    it('evaluates infrastructure penalties based on lighting, crossings, and speed', () => {
      const featureUnlit = {
        lightingQuality: 'unlit',
        crossingType: 'none',
        blindCurve: true,
        surfaceCondition: 'deteriorated',
        speedCalming: 'none',
      };
      const evaluation = calculateInfrastructureHazardScore(featureUnlit, 80, [{ status: 'submitted' }]);
      // 8 + 8 + 5 + 5 + 4 + 2 = 32 (capped at 30)
      expect(evaluation.hazardScore).toBe(30);
      expect(evaluation.factors.length).toBeGreaterThan(3);
    });

    it('computes composite risk score and generates explainability factors without inferring fault', () => {
      const segment = SEED_ROAD_SEGMENTS[0];
      const crashes = [{ totalCrashes: 15, fatalCount: 2, severeInjuryCount: 4, exposureDenominator: 30 }];
      const result = evaluateSegmentRisk(segment, crashes, null, []);

      expect(result.compositeRiskScore).toBeGreaterThanOrEqual(5);
      expect(result.compositeRiskScore).toBeLessThanOrEqual(98);
      expect(result.explainabilityFactors).toBeInstanceOf(Array);
      expect(result.explainabilityFactors.some((f) => f.includes('fatal'))).toBe(true);
    });

    it('ensures model scoring is deterministic and strictly reproducible across identical input sets', () => {
      const segment = SEED_ROAD_SEGMENTS[0];
      const crashes = [{ totalCrashes: 18, fatalCount: 3, severeInjuryCount: 6, exposureDenominator: 42 }];
      const run1 = evaluateSegmentRisk(segment, crashes, null, []);
      const run2 = evaluateSegmentRisk(segment, crashes, null, []);

      expect(run1.compositeRiskScore).toBe(run2.compositeRiskScore);
      expect(run1.severityWeightedFrequency).toBe(run2.severityWeightedFrequency);
      expect(run1.explainabilityFactors).toEqual(run2.explainabilityFactors);
    });

    it('handles edge case exposure denominators: zero, negative, and extreme values safely', () => {
      const zeroDenom = calculateExposureRiskRate(30, 0);
      expect(zeroDenom.rate).toBeNull();
      expect(zeroDenom.uncertainty).toBe('high');

      const negativeDenom = calculateExposureRiskRate(30, -10);
      expect(negativeDenom.rate).toBeNull();
      expect(negativeDenom.uncertainty).toBe('high');

      const extremeDenom = calculateExposureRiskRate(10, 100000);
      expect(extremeDenom.rate).toBe(0.000);
      expect(extremeDenom.uncertainty).toBe('low');
    });
  });

  describe('Spatial Joins, Boundary Changes & Temporal Bias Analysis (#769)', () => {
    it('performs spatial join associating coordinates to the nearest road corridor within buffer', () => {
      const hebbalCoords = { lat: 13.0359, lng: 77.5971 };
      const match = spatialJoinCrashToSegment(hebbalCoords, SEED_ROAD_SEGMENTS, 1.0);

      expect(match).not.toBeNull();
      expect(match.segmentId).toBe('seg-ka-blr-nh44-01');
      expect(match.offsetDistanceKm).toBeLessThan(0.5);
    });

    it('returns null when coordinates exceed spatial buffer distance threshold', () => {
      // Remote coordinate far from test corridors
      const remoteCoords = { lat: 20.0, lng: 85.0 };
      const match = spatialJoinCrashToSegment(remoteCoords, SEED_ROAD_SEGMENTS, 0.5);
      expect(match).toBeNull();
    });

    it('rescales exposure denominator when road corridor boundaries or length change', () => {
      const segment = SEED_ROAD_SEGMENTS[0]; // 650 meters
      const rescaled = rescaleSegmentExposureForBoundaryChange(segment, 1300, 40000);

      expect(rescaled.previousLengthMeters).toBe(650);
      expect(rescaled.newLengthMeters).toBe(1300);
      expect(rescaled.newExposureDenominator).toBeGreaterThan(rescaled.previousExposureDenominator);
      expect(rescaled.deltaRatio).toBe(2.0);
    });

    it('detects nocturnal and seasonal temporal bias across crash history', () => {
      const biasedCrashes = [
        { periodStart: '2025-07-10', lightingCondition: 'night', totalCrashes: 8 },
        { periodStart: '2025-08-15', lightingCondition: 'night', totalCrashes: 7 },
        { periodStart: '2025-09-02', lightingCondition: 'day', totalCrashes: 2 },
      ];

      const biasReport = detectTemporalBiasInCrashHistory(biasedCrashes);
      expect(biasReport.hasTemporalBias).toBe(true);
      expect(biasReport.nocturnalRatio).toBeGreaterThan(0.7);
      expect(biasReport.flags.some((f) => f.includes('Nocturnal clustering bias'))).toBe(true);
      expect(biasReport.flags.some((f) => f.includes('Monsoon seasonal skew'))).toBe(true);
    });

    it('reports uniform distribution when crashes exhibit no temporal or seasonal skew', () => {
      const uniformCrashes = [
        { periodStart: '2025-01-10', lightingCondition: 'day', totalCrashes: 5 },
        { periodStart: '2025-02-15', lightingCondition: 'day', totalCrashes: 5 },
        { periodStart: '2025-03-20', lightingCondition: 'night', totalCrashes: 2 },
      ];

      const biasReport = detectTemporalBiasInCrashHistory(uniformCrashes);
      expect(biasReport.hasTemporalBias).toBe(false);
      expect(biasReport.dominantWindow).toBe('uniform');
    });
  });

  describe('Automated Risk Runs & Explainability', () => {
    it('requires admin permission to execute automated risk run', () => {
      setCurrentActor(CITIZEN_ACTOR);
      expect(() => executeRiskRun({}, mockStorage)).toThrow(PermissionDeniedError);
    });

    it('executes risk run and outputs versioned explainable records', () => {
      const run = executeRiskRun({ startDate: '2025-01-01', endDate: '2025-12-31' }, mockStorage);
      expect(run.runRecord.rulesetVersion).toBe('MoRTH-IRC-SP88-v1.2');
      expect(run.runRecord.totalSegmentsEvaluated).toBeGreaterThan(0);
      expect(run.cases.length).toBeGreaterThan(0);
      expect(run.runRecord.disclaimer).toContain('Statutory Road-Safety Analytics Disclaimer');
    });
  });

  describe('Listing & Filtering Cases', () => {
    beforeEach(() => {
      ensureRoadSafetySeedData(mockStorage);
    });

    it('filters cases by state and minScore with pagination', () => {
      const res = listReviewCases({ state: 'Karnataka', minScore: 10, page: 1, limit: 10 }, mockStorage);
      expect(res.cases.every((c) => c.segment.jurisdiction.state === 'Karnataka')).toBe(true);
      expect(res.cases.every((c) => c.compositeRiskScore >= 10)).toBe(true);
      expect(res.totalItems).toBeGreaterThanOrEqual(1);
    });

    it('searches cases by corridor name or district', () => {
      const res = listReviewCases({ searchQuery: 'Hebbal' }, mockStorage);
      expect(res.cases.length).toBeGreaterThanOrEqual(1);
      expect(res.cases[0].segment.name).toContain('Hebbal');
    });

    it('retrieves detailed review case with linked crashes and features', () => {
      const detail = getReviewCaseDetail('case-seg-ka-blr-nh44-01', mockStorage);
      expect(detail).not.toBeNull();
      expect(detail.segment).not.toBeNull();
      expect(detail.crashes).toBeInstanceOf(Array);
      expect(detail.feature).not.toBeNull();
    });
  });

  describe('State Machine & Transitions', () => {
    beforeEach(() => {
      ensureRoadSafetySeedData(mockStorage);
    });

    it('requires roadSafety.review permission to transition state', () => {
      setCurrentActor(CITIZEN_ACTOR);
      expect(() =>
        transitionReviewCaseState('case-seg-ka-blr-nh44-01', CASE_STATES.INSPECTION_SCHEDULED, {}, mockStorage)
      ).toThrow(PermissionDeniedError);
    });

    it('allows valid state progression from candidate to inspection scheduled', () => {
      const updated = transitionReviewCaseState(
        'case-seg-ka-blr-nh44-01',
        CASE_STATES.INSPECTION_SCHEDULED,
        { reason: 'Exceeded statutory 3-year fatal cluster threshold' },
        mockStorage
      );
      expect(updated.status).toBe(CASE_STATES.INSPECTION_SCHEDULED);
      expect(updated.reviewNotes[0].note).toBe('Exceeded statutory 3-year fatal cluster threshold');
    });

    it('rejects invalid state transition with informative error', () => {
      // Cannot jump directly from candidate to resolved
      expect(() =>
        transitionReviewCaseState('case-seg-ka-blr-nh44-01', CASE_STATES.RESOLVED, {}, mockStorage)
      ).toThrow(/Invalid state transition/);
    });

    it('enforces justification reason for dismissal or deferral', () => {
      expect(() =>
        transitionReviewCaseState('case-seg-ka-blr-nh44-01', CASE_STATES.DISMISSED_FALSE_POSITIVE, {}, mockStorage)
      ).toThrow(/documented justification reason is required/);
    });
  });

  describe('Site Inspection & Intervention Tracking', () => {
    beforeEach(() => {
      ensureRoadSafetySeedData(mockStorage);
    });

    it('records site inspection and transitions case to inspected', () => {
      const result = recordSiteInspection(
        'case-seg-ka-blr-nh44-01',
        {
          findings: 'Audit confirms high pedestrian jaywalking due to missing FOB barrier.',
          crossingObservations: 'Median fence breached at 3 locations.',
          lightingCondition: 'poor',
          speedSurveyObservedKmph: 78,
          evidencePhotos: [{ name: 'Breached Fence', url: 'https://images.example.gov.in/p1.jpg' }],
        },
        mockStorage
      );

      expect(result.inspection.inspectedBy).toBe('Chief Safety Engineer');
      expect(result.reviewCase.status).toBe(CASE_STATES.INSPECTED);
      expect(result.reviewCase.inspectionRecords.length).toBe(1);
    });

    it('records intervention and tracks post-intervention outcome', () => {
      const { intervention } = recordIntervention(
        'case-seg-ka-blr-nh44-01',
        {
          interventionType: 'rumble_strips',
          description: 'Install thermoplastic rumble strips and raised pedestrian crosswalk',
          targetCompletionDate: '2026-06-30',
          costEstimateInr: 450000,
          contractor: 'City Road Infrastructure Corp',
        },
        mockStorage
      );

      expect(intervention.interventionType).toBe('rumble_strips');
      expect(intervention.costEstimateInr).toBe(450000);

      const evaluated = evaluateInterventionOutcome(
        intervention.id,
        {
          preInterventionCrashes: 20,
          postInterventionCrashes: 6,
          monitoringMonths: 6,
          notes: 'Observed 70% reduction in pedestrian collisions after installation.',
        },
        mockStorage
      );

      expect(evaluated.outcomeEvaluation.reductionPercentage).toBe(70);
      expect(evaluated.status).toBe('evaluated');
    });
  });

  describe('Citizen Hazard Reporting & Rate Limiting', () => {
    beforeEach(() => {
      ensureRoadSafetySeedData(mockStorage);
    });

    it('sanitizes citizen text and redacts PII before saving', () => {
      const report = submitCitizenHazardReport(
        {
          segmentId: 'seg-ka-blr-nh44-01',
          hazardType: 'pothole_surface',
          description: 'Deep pothole near toll booth, call 9876543210 or email test@example.com for photos <script>alert(1)</script>',
        },
        mockStorage,
        'client-xyz'
      );

      expect(report.description).not.toContain('<script>');
      expect(report.description).toContain('[REDACTED_PHONE]');
      expect(report.description).toContain('[REDACTED_EMAIL]');
    });

    it('enforces rate limit of maximum 5 submissions per 15 minutes', () => {
      for (let i = 0; i < RATE_LIMIT_MAX_SUBMISSIONS; i++) {
        submitCitizenHazardReport(
          {
            segmentId: 'seg-ka-blr-nh44-01',
            hazardType: 'missing_signage',
            description: `Valid hazard description ${i} exceeds minimum length requirement`,
          },
          mockStorage,
          'spammer-client'
        );
      }

      expect(() =>
        submitCitizenHazardReport(
          {
            segmentId: 'seg-ka-blr-nh44-01',
            hazardType: 'missing_signage',
            description: 'This sixth attempt should be rate limited and rejected',
          },
          mockStorage,
          'spammer-client'
        )
      ).toThrow(/Rate limit exceeded/);
    });
  });

  describe('Time Period Comparison & Migration', () => {
    beforeEach(() => {
      ensureRoadSafetySeedData(mockStorage);
    });

    it('compares two distinct periods and measures delta change', () => {
      const comparison = compareTimePeriods(
        'seg-ka-blr-nh44-01',
        { start: '2025-01-01', end: '2025-06-30' },
        { start: '2025-10-01', end: '2025-12-31' },
        mockStorage
      );
      expect(comparison.segmentId).toBe('seg-ka-blr-nh44-01');
      expect(comparison.periodA).toBeDefined();
      expect(comparison.periodB).toBeDefined();
    });

    it('runs storage schema migration smoothly', () => {
      const res = migrateRoadSafetyStorage(mockStorage);
      expect(res.success).toBe(true);
      expect(res.version).toBe(1);
    });

    it('handles migration against completely empty storage by bootstrapping seed data', () => {
      const emptyStorage = createMemoryStorage();
      const res = migrateRoadSafetyStorage(emptyStorage);
      expect(res.success).toBe(true);
      expect(res.version).toBe(1);
      expect(emptyStorage.getItem(ROAD_SAFETY_STORAGE_KEYS.SEGMENTS)).not.toBeNull();
    });

    it('migrates legacy unversioned dataset and upgrades schemaVersion to 1', () => {
      const legacyStorage = createMemoryStorage();
      const legacyCases = [
        { id: 'case-legacy-1', segmentId: 'seg-1', status: 'candidate' }, // Missing schemaVersion
      ];
      legacyStorage.setItem(ROAD_SAFETY_STORAGE_KEYS.CASES, JSON.stringify(legacyCases));

      const res = migrateRoadSafetyStorage(legacyStorage);
      expect(res.success).toBe(true);
      expect(res.migratedCount).toBe(1);

      const updated = JSON.parse(legacyStorage.getItem(ROAD_SAFETY_STORAGE_KEYS.CASES));
      expect(updated[0].schemaVersion).toBe(1);
    });

    it('creates rollback snapshot and successfully rolls back schema version', () => {
      migrateRoadSafetyStorage(mockStorage);
      const rollbackResult = rollbackRoadSafetyStorage(1, mockStorage);
      expect(rollbackResult.success).toBe(true);
      expect(rollbackResult.restoredVersion).toBe(1);
    });
  });

  describe('Security, Jurisdiction Scoping & Append-Only Audit Logging', () => {
    beforeEach(() => {
      ensureRoadSafetySeedData(mockStorage);
    });

    it('enforces jurisdiction boundary and throws RS_FORBIDDEN_JURISDICTION on unauthorized zone', () => {
      // Karnataka officer attempting to alter Delhi corridor
      setCurrentActor({
        id: 'officer-ka',
        role: 'admin',
        jurisdiction: { state: 'Karnataka' },
      });

      expect(() => {
        transitionReviewCaseState(
          'case-seg-dl-del-ring-03',
          CASE_STATES.INSPECTION_SCHEDULED,
          {},
          mockStorage
        );
      }).toThrowError(RoadSafetyServiceError);

      try {
        transitionReviewCaseState(
          'case-seg-dl-del-ring-03',
          CASE_STATES.INSPECTION_SCHEDULED,
          {},
          mockStorage
        );
      } catch (err) {
        expect(err.code).toBe('RS_FORBIDDEN_JURISDICTION');
      }
    });

    it('appends audit log events for review transitions and administrative runs', () => {
      setCurrentActor(ADMIN_ACTOR);
      transitionReviewCaseState(
        'case-seg-ka-blr-nh44-01',
        CASE_STATES.INSPECTION_SCHEDULED,
        { reason: 'Scheduled joint safety inspection with NHAI team' },
        mockStorage
      );

      const logs = getRoadSafetyAuditLogs(mockStorage);
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].action).toBe('CASE_STATE_TRANSITION');
      expect(logs[0].details.toState).toBe(CASE_STATES.INSPECTION_SCHEDULED);
      expect(logs[0].details.caseId).toBe('case-seg-ka-blr-nh44-01');
    });

    it('handles idempotent hazard report submissions safely without duplicating', () => {
      const payload = {
        idempotencyKey: 'idem-uuid-999',
        segmentId: 'seg-ka-blr-nh44-01',
        hazardType: 'pothole_surface',
        description: 'Severe longitudinal rutting near exit ramp.',
      };

      const first = submitCitizenHazardReport(payload, mockStorage, 'client-a');
      const second = submitCitizenHazardReport(payload, mockStorage, 'client-a');

      expect(first.id).toBe(second.id);
      expect(first.idempotencyKey).toBe('idem-uuid-999');
    });

    it('serializes public blackspot summary, stripping internal reviewer and inspection notes', () => {
      const fullCaseDetail = getReviewCaseDetail('case-seg-ka-blr-nh44-01', mockStorage);
      const publicSummary = serializePublicBlackspotSummary(fullCaseDetail);

      expect(publicSummary.name).toBe('NH-44 Outer Ring Road - Hebbal Flyover Down-Ramp');
      expect(publicSummary.compositeRiskScore).toBeDefined();
      expect(publicSummary.status).toBeDefined();
      // Verify internal private fields are absent
      expect(publicSummary.reviewNotes).toBeUndefined();
      expect(publicSummary.inspectionRecords).toBeUndefined();
      expect(publicSummary.assignedOfficer).toBeUndefined();
    });

    it('safely handles non-existent case enumeration without leaking memory or throwing unhandled errors', () => {
      const result = getReviewCaseDetail('non-existent-case-id', mockStorage);
      expect(result).toBeNull();
    });
  });
});

