import { describe, it, expect, beforeEach } from 'vitest';
import { pedestrianBarrierService } from './pedestrianBarrierService.js';
import { resetPedestrianBarrierData } from './pedestrianBarrierStorage.js';
import { isInspectionStale } from './pedestrianRouteEngine.js';
import { DEFAULT_ROUTE_PREFERENCES } from '../data/pedestrianBarrierContract.js';

describe('pedestrianBarrierService (#757)', () => {
  beforeEach(() => {
    resetPedestrianBarrierData();
  });

  describe('Inventory & Metrics Queries', () => {
    it('retrieves initial seeded nodes, segments, and crossings', () => {
      const nodes = pedestrianBarrierService.getNodes();
      expect(nodes.length).toBeGreaterThanOrEqual(6);
      expect(nodes.some((n) => n.name.includes('Haralur Main'))).toBe(true);

      const segments = pedestrianBarrierService.getSegments();
      expect(segments.length).toBeGreaterThanOrEqual(6);

      const crossings = pedestrianBarrierService.getCrossings();
      expect(crossings.length).toBeGreaterThanOrEqual(2);
    });

    it('filters inventory by municipal ward', () => {
      const hsrSegments = pedestrianBarrierService.getSegments({ ward: 'Ward 174 - HSR Layout' });
      expect(hsrSegments.length).toBeGreaterThanOrEqual(2);
      expect(hsrSegments.every((s) => s.ward === 'Ward 174 - HSR Layout')).toBe(true);
    });

    it('computes accurate network accessibility metrics', () => {
      const metrics = pedestrianBarrierService.getNetworkMetrics('Ward 150 - Bellandur');
      expect(metrics.totalCorridors).toBeGreaterThanOrEqual(4);
      expect(metrics.totalDistanceMeters).toBeGreaterThan(0);
      expect(metrics.curbRampCompliancePct).toBeGreaterThanOrEqual(0);
      expect(metrics.tactileCoveragePct).toBeGreaterThanOrEqual(0);
      expect(metrics.verifiedBarriersCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Barrier Observation Reporting & PII Safeguards', () => {
    it('successfully creates a valid citizen barrier observation', () => {
      const payload = {
        segmentId: 'SEG-101-102',
        barrierType: 'damaged_footpath',
        severity: 'moderate_impediment',
        ward: 'Ward 150 - Bellandur',
        description: 'Multiple loose paver slabs creating 5cm tripping edges along pedestrian walkway.',
        confidenceScore: 0.9,
      };

      const result = pedestrianBarrierService.reportBarrierObservation(payload, { name: 'Kavitha R.' });
      expect(result.success).toBe(true);
      expect(result.isQueuedOffline).toBe(false);
      expect(result.observation.id).toMatch(/^BAR-\d+$/);
      expect(result.observation.status).toBe('reported');

      const stored = pedestrianBarrierService.getObservationById(result.observation.id);
      expect(stored).toBeDefined();
      expect(stored.description).toContain('loose paver slabs');
    });

    it('rejects barrier descriptions containing personal contact information (Phone, Aadhaar, Email)', () => {
      const piiPayload = {
        segmentId: 'SEG-101-102',
        barrierType: 'open_drain_hazard',
        severity: 'high_barrier',
        ward: 'Ward 150 - Bellandur',
        description: 'Open drain near gate. Call me on 9876543210 or email test@example.com with Aadhaar 1234 5678 9012.',
      };

      expect(() => {
        pedestrianBarrierService.reportBarrierObservation(piiPayload);
      }).toThrow(/Privacy violation/);
    });

    it('queues submissions offline when client network is disconnected', () => {
      const payload = {
        segmentId: 'SEG-101-102',
        barrierType: 'vendor_encroachment',
        severity: 'low_friction',
        ward: 'Ward 150 - Bellandur',
        description: 'Vendor cart parked on walking zone during morning vegetable market hours.',
      };

      const result = pedestrianBarrierService.reportBarrierObservation(payload, {}, false);
      expect(result.success).toBe(true);
      expect(result.isQueuedOffline).toBe(true);

      const flushResult = pedestrianBarrierService.flushOfflineQueue();
      expect(flushResult.flushed).toBe(1);

      const queuedObs = pedestrianBarrierService.getObservationById(result.observation.id);
      expect(queuedObs).toBeDefined();
    });
  });

  describe('Official Verification & Lifecycle State Machine', () => {
    it('allows authorized reviewer to verify observation and appends audit event', () => {
      const observations = pedestrianBarrierService.getObservations({ status: 'reported' });
      expect(observations.length).toBeGreaterThan(0);
      const target = observations[0];

      const reviewDecision = {
        action: 'verify',
        reasonCode: 'statutory_inspection_passed',
        reviewerNotes: 'Inspected on-site; encroachment restricts footpath below statutory 1.5m clearance.',
      };

      const result = pedestrianBarrierService.verifyBarrierObservation(target.id, reviewDecision, {
        id: 'OFFICER-BBMP-77',
        role: 'reviewer',
      });

      expect(result.success).toBe(true);
      expect(result.observation.status).toBe('verified');
      expect(result.auditEvent.action).toBe('verify');
      expect(result.auditEvent.reviewerRole).toBe('reviewer');

      const auditTrail = pedestrianBarrierService.getAuditEvents({ observationId: target.id });
      expect(auditTrail.some((e) => e.reasonCode === 'statutory_inspection_passed')).toBe(true);
    });

    it('prevents unauthorized citizens from executing verification or resolution transitions', () => {
      const observations = pedestrianBarrierService.getObservations();
      const target = observations[0];

      expect(() => {
        pedestrianBarrierService.verifyBarrierObservation(
          target.id,
          { action: 'verify', reasonCode: 'test' },
          { role: 'citizen' }
        );
      }).toThrow(/Permission denied/);

      expect(() => {
        pedestrianBarrierService.resolveBarrierObservation(
          target.id,
          { reasonCode: 'defect_rectified' },
          { role: 'citizen' }
        );
      }).toThrow(/Permission denied/);
    });

    it('allows operators to mark verified defects as resolved once works are completed', () => {
      const verifiedList = pedestrianBarrierService.getObservations({ status: 'verified' });
      expect(verifiedList.length).toBeGreaterThan(0);
      const target = verifiedList[0];

      const res = pedestrianBarrierService.resolveBarrierObservation(
        target.id,
        {
          reasonCode: 'defect_rectified',
          reviewerNotes: 'Rebar cut, slabs relaid with cement mortar, surface flush and tested with wheelchair.',
        },
        { id: 'ENGINEER-BBMP-12', role: 'operator' }
      );

      expect(res.success).toBe(true);
      expect(res.observation.status).toBe('resolved');

      const updated = pedestrianBarrierService.getObservationById(target.id);
      expect(updated.status).toBe('resolved');
    });
  });

  describe('Intelligent Route Engine & Explainability Provenance', () => {
    it('computes accessible path avoiding impassable curb ramps and broken slabs for wheelchair users', () => {
      // From NODE-101 (Haralur Junction) to NODE-103 (Outer Ring Road)
      const route = pedestrianBarrierService.calculateRoute('NODE-101', 'NODE-103', {
        avoidStairsAndSteps: true,
        requireCurbRamps: true,
        maxGradientPct: 6,
        avoidUnpavedSurfaces: true,
      });

      expect(route).toBeDefined();
      expect(route.segments.length).toBeGreaterThan(0);
      expect(route.totalDistanceMeters).toBeGreaterThan(0);

      // Verify that it selected the accessible Haralur Link -> Flyover path (SEG-101-105 -> SEG-105-103)
      // rather than the broken slab and missing curb ramp paths (SEG-101-104 or SEG-102-103)
      const segmentIds = route.segments.map((s) => s.id);
      expect(segmentIds).toContain('SEG-101-105');
      expect(segmentIds).toContain('SEG-105-103');
      expect(segmentIds).not.toContain('SEG-101-104'); // Contains steps & dirt

      // Check explainability provenance
      expect(route.scoringProvenance.rulesetVersion).toBeDefined();
      expect(route.scoringProvenance.executionTimestamp).toBeDefined();
      expect(route.scoringProvenance.influencingFactors.length).toBeGreaterThan(0);
    });

    it('enforces verification integrity rule: never flags route as fully accessible if segments are unverified or stale', () => {
      // Route traversing Kaikondrahalli East Bund (provisional/unverified)
      const route = pedestrianBarrierService.calculateRoute('NODE-104', 'NODE-102', {
        ...DEFAULT_ROUTE_PREFERENCES,
        requireCurbRamps: false, // relax to allow passage
        avoidStairsAndSteps: false,
      });

      expect(route).toBeDefined();
      // Must NOT be fully_accessible because SEG-104-102 is provisional
      expect(route.overallAccessibilityRating).not.toBe('fully_accessible');
      expect(route.overallAccessibilityRating).toBe('partially_accessible');
      expect(
        route.scoringProvenance.influencingFactors.some((f) => f.includes('unverified') || f.includes('Integrity Note'))
      ).toBe(true);
    });

    it('identifies inspection staleness when last inspection exceeds 30 days', () => {
      const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const old = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();

      expect(isInspectionStale(recent)).toBe(false);
      expect(isInspectionStale(old)).toBe(true);
    });

    it('provides deterministic fallback when destination cannot be reached under strict constraints', () => {
      // NODE-104 has stairs and missing curb ramps. If user requires both, strict path is blocked.
      const route = pedestrianBarrierService.calculateRoute('NODE-104', 'NODE-103', {
        avoidStairsAndSteps: true,
        requireCurbRamps: true,
        maxGradientPct: 4,
      });

      expect(route).toBeDefined();
      expect(route.isDeterministicFallback).toBe(true);
      expect(route.overallAccessibilityRating).toBe('high_impediment');
      expect(
        route.scoringProvenance.influencingFactors.some((f) => f.includes('Relaxed Fallback') || f.includes('high-impediment'))
      ).toBe(true);
    });
  });
});
