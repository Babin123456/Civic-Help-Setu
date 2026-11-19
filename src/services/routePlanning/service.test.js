/**
 * src/services/routePlanning/service.test.js
 * Comprehensive integration tests for Municipal Waste Collection Route & Audit Service (#755).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  setCurrentActor,
  checkPermission,
  PermissionDeniedError,
  sanitizeUserInput,
  generateRouteAuditSeal,
  transaction,
  purgeExpiredRecords,
  listCollectionRoutes,
  createCollectionRoute,
  updateCollectionRoute,
  listPickupPoints,
  createPickupPoint,
  listVehicles,
  createVehicle,
  updateVehicle,
  listRouteRuns,
  createRouteRun,
  createSegregationAudit,
  recordMissedPickup,
  generateDeterministicRecommendations,
  acceptRouteRecommendation,
  getPublicRouteSummary,
} from './service.js';

import {
  CollectionRouteStatus,
  PickupPointStatus,
  VehicleStatus,
  RouteRunStatus,
  SegregationAuditRating,
  RouteRecommendationStatus,
} from '../../data/routePlanning/models.js';

describe('Municipal Waste Route Planning & Segregation Audit Service (#755)', () => {
  let mockStore;

  beforeEach(() => {
    const memory = {};
    mockStore = {
      getItem: (k) => memory[k] || null,
      setItem: (k, v) => {
        memory[k] = String(v);
      },
      clear: () => {
        for (const k of Object.keys(memory)) delete memory[k];
      },
    };
    setCurrentActor({ username: 'test-admin', role: 'admin' });
  });

  describe('PII Sanitization & Data Privacy', () => {
    it('strips HTML, phones, Aadhaar and specific door numbers', () => {
      const dirty = 'Contact supervisor 9845012345, Aadhaar 9812 3456 7890 at Flat 402 <script>alert("hack")</script>';
      const sanitized = sanitizeUserInput(dirty);
      expect(sanitized).not.toContain('9845012345');
      expect(sanitized).not.toContain('9812 3456 7890');
      expect(sanitized).not.toContain('Flat 402');
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('[REDACTED_PHONE]');
      expect(sanitized).toContain('[REDACTED_AADHAAR]');
      expect(sanitized).toContain('[REDACTED_DOOR]');
    });
  });

  describe('Cryptographic Audit Seal', () => {
    it('generates a deterministic tamper-evident seal starting with SEAL-WRA', async () => {
      const audit = {
        pickupPointId: 'pt-1',
        ward: 'Ward 150',
        compliancePercentage: 75,
        rating: 'GOOD',
        auditDate: '2026-11-19T10:00:00.000Z',
      };
      const seal1 = await generateRouteAuditSeal(audit);
      const seal2 = await generateRouteAuditSeal(audit);
      expect(seal1).toMatch(/^SEAL-WRA-[0-9A-F]{4}-[0-9A-F]{4}$/);
      expect(seal1).toBe(seal2);
    });
  });

  describe('Role-Based Access Control', () => {
    it('allows admin and supervisor to create routes, but denies citizens', () => {
      setCurrentActor({ username: 'alice', role: 'citizen' });
      expect(checkPermission('routePlanning.routes.create')).toBe('forbidden');
      expect(() => createCollectionRoute({ name: 'R1', ward: 'W1' }, mockStore)).toThrow(PermissionDeniedError);

      setCurrentActor({ username: 'bob', role: 'supervisor' });
      expect(checkPermission('routePlanning.routes.create')).toBe('ok');
      const route = createCollectionRoute({ name: 'R1', ward: 'W1' }, mockStore);
      expect(route.name).toBe('R1');
    });

    it('allows auditors to record segregation audits', async () => {
      setCurrentActor({ username: 'charlie', role: 'auditor' });
      expect(checkPermission('routePlanning.audits.create')).toBe('ok');

      const audit = await createSegregationAudit(
        {
          pickupPointId: 'pt-101',
          ward: 'Ward 150',
          compliancePercentage: 80,
          rating: SegregationAuditRating.GOOD,
          observedStreams: { wet: 1, dry: 1, hazardous: 0 },
        },
        mockStore
      );
      expect(audit.integritySeal).toMatch(/^SEAL-WRA/);
    });
  });

  describe('Route and Pickup Point Management', () => {
    it('creates, updates and lists routes with sanitized inputs', () => {
      createCollectionRoute(
        {
          name: 'Ward 150 Morning <b>Loop</b>',
          ward: 'Ward 150',
          description: 'Call driver at 9845012345',
        },
        mockStore
      );

      const routes = listCollectionRoutes({}, mockStore);
      expect(routes.length).toBe(1);
      expect(routes[0].name).toBe('Ward 150 Morning Loop');
      expect(routes[0].description).toBe('Call driver at [REDACTED_PHONE]');

      const updated = updateCollectionRoute(routes[0].id, { status: CollectionRouteStatus.ACTIVE }, mockStore);
      expect(updated.status).toBe(CollectionRouteStatus.ACTIVE);
    });

    it('creates and filters pickup points by ward', () => {
      createPickupPoint({ address: 'Main Gate Bins', ward: 'Ward 150' }, mockStore);
      createPickupPoint({ address: 'Park Street Stand', ward: 'Ward 174' }, mockStore);

      const w150Points = listPickupPoints({ ward: 'Ward 150' }, mockStore);
      expect(w150Points.length).toBe(1);
      expect(w150Points[0].address).toBe('Main Gate Bins');
    });
  });

  describe('Vehicle Fleet & Capacity', () => {
    it('manages vehicles and load limits', () => {
      const veh = createVehicle(
        {
          registrationNumber: 'KA-01-EQ-1000',
          capacityKg: 800,
          type: 'tipper',
        },
        mockStore
      );
      expect(veh.registrationNumber).toBe('KA-01-EQ-1000');

      updateVehicle(veh.id, { currentLoadKg: 400, status: VehicleStatus.DEPLOYED }, mockStore);
      const vehicles = listVehicles({ status: VehicleStatus.DEPLOYED }, mockStore);
      expect(vehicles.length).toBe(1);
      expect(vehicles[0].currentLoadKg).toBe(400);
    });
  });

  describe('AI Optimization & Explainable Recommendations Engine', () => {
    it('generates capacity overload recommendation when total waste exceeds threshold', () => {
      // 1. Create a route
      const route = createCollectionRoute(
        {
          name: 'Heavy Industrial Loop',
          ward: 'Ward 150',
          pickupPointIds: ['pt-bulk-1', 'pt-bulk-2'],
          vehicleIds: ['veh-small-1'],
        },
        mockStore
      );

      // 2. Create small vehicle (capacity 400 kg)
      createVehicle(
        {
          id: 'veh-small-1',
          registrationNumber: 'KA-01-SM-1',
          capacityKg: 400,
        },
        mockStore
      );

      // 3. Create heavy points (300 kg + 250 kg = 550 kg > 400 kg)
      createPickupPoint({ id: 'pt-bulk-1', address: 'Market A', ward: 'Ward 150', estimatedWasteKg: 300 }, mockStore);
      createPickupPoint({ id: 'pt-bulk-2', address: 'Market B', ward: 'Ward 150', estimatedWasteKg: 250 }, mockStore);

      // 4. Run optimization engine
      const recs = generateDeterministicRecommendations(route.id, mockStore);
      expect(recs.length).toBeGreaterThan(0);

      const capRec = recs.find((r) => r.type === 'CAPACITY');
      expect(capRec).toBeDefined();
      expect(capRec.title).toContain('Capacity Exceeded');
      expect(capRec.modelVersion).toBe('ruleset-v1.0.0-deterministic');
      expect(capRec.sourceFields.totalEstimatedWasteKg).toBe(550);
      expect(capRec.sourceFields.totalAssignedCapacityKg).toBe(400);
    });

    it('generates segregation quality recommendation when ward compliance is low', async () => {
      const route = createCollectionRoute(
        {
          name: 'Residential Route',
          ward: 'Ward 150',
          pickupPointIds: ['pt-res-1'],
        },
        mockStore
      );

      createPickupPoint({ id: 'pt-res-1', address: 'Res Block 1', ward: 'Ward 150', estimatedWasteKg: 50 }, mockStore);

      // Create low compliance audit (40%)
      await createSegregationAudit(
        {
          pickupPointId: 'pt-res-1',
          ward: 'Ward 150',
          compliancePercentage: 40,
          rating: SegregationAuditRating.POOR,
        },
        mockStore
      );

      const recs = generateDeterministicRecommendations(route.id, mockStore);
      const segRec = recs.find((r) => r.type === 'SEGREGATION');
      expect(segRec).toBeDefined();
      expect(segRec.explanation).toContain('average segregation compliance score of 40%');
    });

    it('supports human-in-the-loop accept, edit and reject actions', () => {
      const route = createCollectionRoute(
        {
          name: 'Action Test Route',
          ward: 'Ward 150',
          pickupPointIds: ['pt-1'],
          vehicleIds: ['veh-1'],
        },
        mockStore
      );
      createVehicle({ id: 'veh-1', registrationNumber: 'KA-01-A', capacityKg: 100 }, mockStore);
      createPickupPoint({ id: 'pt-1', address: 'Point 1', ward: 'Ward 150', estimatedWasteKg: 200 }, mockStore);

      const recs = generateDeterministicRecommendations(route.id, mockStore);
      const recId = recs[0].id;

      // 1. Accept
      const accepted = acceptRouteRecommendation(recId, { action: 'accept' }, mockStore);
      expect(accepted.status).toBe(RouteRecommendationStatus.ACCEPTED);
      expect(accepted.acceptedBy).toBe('test-admin');

      // 2. Edit
      const edited = acceptRouteRecommendation(
        recId,
        {
          action: 'edit',
          editedData: { overrideVehicleCount: 3 },
        },
        mockStore
      );
      expect(edited.status).toBe(RouteRecommendationStatus.EDITED);
      expect(edited.suggestedData.overrideVehicleCount).toBe(3);

      // 3. Reject with mandatory reason
      expect(() => acceptRouteRecommendation(recId, { action: 'reject' }, mockStore)).toThrow(
        /rejectionReason is mandatory/
      );

      const rejected = acceptRouteRecommendation(
        recId,
        {
          action: 'reject',
          rejectionReason: 'Vehicle already allocated from adjacent depot',
        },
        mockStore
      );
      expect(rejected.status).toBe(RouteRecommendationStatus.REJECTED);
      expect(rejected.rejectionReason).toBe('Vehicle already allocated from adjacent depot');
    });
  });

  describe('Transactions and Data Retention', () => {
    it('rolls back cleanly on transaction failure', async () => {
      createCollectionRoute({ name: 'Initial Route', ward: 'Ward 1' }, mockStore);

      await expect(
        transaction(async (records, store) => {
          store.setItem('temp', 'dirty');
          throw new Error('Database connection dropped during multi-write');
        }, mockStore)
      ).rejects.toThrow('Database connection dropped');

      const routes = listCollectionRoutes({}, mockStore);
      expect(routes.length).toBe(1);
      expect(routes[0].name).toBe('Initial Route');
    });

    it('purges completed route runs older than statutory retention window', () => {
      const oldRun = createRouteRun(
        {
          routeId: 'r-old',
          status: RouteRunStatus.COMPLETED,
          endTime: new Date(Date.now() - 200 * 86400000).toISOString(),
        },
        mockStore
      );

      const freshRun = createRouteRun(
        {
          routeId: 'r-fresh',
          status: RouteRunStatus.COMPLETED,
          endTime: new Date().toISOString(),
        },
        mockStore
      );

      const purgedCount = purgeExpiredRecords(180, mockStore);
      expect(purgedCount).toBe(1);

      const runs = listRouteRuns({}, mockStore);
      expect(runs.some((r) => r.id === oldRun.id)).toBe(false);
      expect(runs.some((r) => r.id === freshRun.id)).toBe(true);
    });
  });

  describe('Public Route Summary (Privacy Guard)', () => {
    it('returns strictly approved aggregates and redacts internal identifiers', () => {
      const route = createCollectionRoute(
        {
          name: 'Public Sector 1',
          ward: 'Ward 150',
          pickupPointIds: ['pt-pub-1'],
          vehicleIds: ['veh-driver-secret'],
        },
        mockStore
      );

      createPickupPoint(
        {
          id: 'pt-pub-1',
          address: 'Community Center',
          ward: 'Ward 150',
          status: PickupPointStatus.SERVICED,
        },
        mockStore
      );

      const summary = getPublicRouteSummary(route.id, mockStore);
      expect(summary.name).toBe('Public Sector 1');
      expect(summary.servicedPercentage).toBe(100);
      expect(summary.vehicleIds).toBeUndefined(); // internal IDs masked
      expect(summary.driverNotes).toBeUndefined();
    });
  });

  describe('Robustness, Missing GPS & Multi-Ward Fairness', () => {
    it('gracefully handles missing GPS coordinates without breaking optimization', () => {
      const route = createCollectionRoute(
        {
          name: 'No-GPS Loop',
          ward: 'Ward 150',
          pickupPointIds: ['pt-no-gps'],
          vehicleIds: ['veh-nogps'],
        },
        mockStore
      );

      createVehicle({ id: 'veh-nogps', registrationNumber: 'KA-01-NG', capacityKg: 500 }, mockStore);

      const pt = createPickupPoint(
        {
          id: 'pt-no-gps',
          address: 'Old Village Corner (Missing GPS)',
          ward: 'Ward 150',
          coordinates: null, // explicit missing GPS
          estimatedWasteKg: 60,
        },
        mockStore
      );

      expect(pt.coordinates).toEqual({ lat: 0, lng: 0 });
      const recs = generateDeterministicRecommendations(route.id, mockStore);
      expect(Array.isArray(recs)).toBe(true);
    });

    it('manages unreachable points by logging missed pickups and triggering recovery', () => {
      const route = createCollectionRoute(
        {
          name: 'Blocked Access Route',
          ward: 'Ward 174',
          pickupPointIds: ['pt-blocked'],
        },
        mockStore
      );

      createPickupPoint(
        {
          id: 'pt-blocked',
          address: 'Construction Barrier Lane',
          ward: 'Ward 174',
          status: PickupPointStatus.MISSED,
        },
        mockStore
      );

      recordMissedPickup(
        {
          pickupPointId: 'pt-blocked',
          reason: 'ROAD_BLOCKED',
          resolutionNotes: 'Culvert excavation underway. Reroute via 9th Cross.',
        },
        mockStore
      );

      const recs = generateDeterministicRecommendations(route.id, mockStore);
      const missedRec = recs.find((r) => r.type === 'MISSED_PICKUP');
      expect(missedRec).toBeDefined();
      expect(missedRec.sourceFields.unresolvedMissedCount).toBe(1);
    });

    it('ensures fairness by partitioning routes and queries by ward', () => {
      createCollectionRoute({ name: 'Ward 150 Route', ward: 'Ward 150' }, mockStore);
      createCollectionRoute({ name: 'Ward 174 Route', ward: 'Ward 174' }, mockStore);

      const w150 = listCollectionRoutes({ ward: 'Ward 150' }, mockStore);
      const w174 = listCollectionRoutes({ ward: 'Ward 174' }, mockStore);

      expect(w150.length).toBe(1);
      expect(w174.length).toBe(1);
      expect(w150[0].name).toBe('Ward 150 Route');
      expect(w174[0].name).toBe('Ward 174 Route');
    });
  });
});
