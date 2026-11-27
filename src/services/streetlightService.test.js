import { describe, it, expect, beforeEach } from 'vitest';
import {
  submitOutageReport,
  trackReportByToken,
  listClusters,
  getClusterById,
  triageCluster,
  createWorkOrder,
  listWorkOrders,
  updateWorkOrderStatus,
  recordRepairEvent,
  listAssets,
  createAsset,
  reassignWorkOrder,
  expireStaleOutageStatuses,
  matchAssetByLocation,
  createInspectionSchedule,
  listInspectionSchedules,
} from './streetlightService';
import {
  haversineDistanceMeters,
  findDuplicateReport,
  calculateClusterPriority,
} from './streetlightClusteringEngine';
import {
  rollbackStreetlightStorage,
  ensureStreetlightData,
  persistStreetlightData,
} from './streetlightMigrations';
import {
  FAULT_CATEGORIES,
  PRIORITY_TIERS,
  WORK_ORDER_STATUS,
  REPORT_STATUS,
  ASSET_STATUS,
} from './streetlightConstants';

describe('Streetlight Service & Clustering Suite (#756)', () => {
  const adminActor = { id: 'usr_admin', username: 'ChiefEngineer', role: 'admin' };
  const operatorActor = { id: 'usr_op', username: 'TriageOperator', role: 'operator', streetlightRole: 'operator', jurisdictionId: 'WARD-042' };
  const techActor = { id: 'usr_tech', username: 'TechnicianRamesh', role: 'technician', streetlightRole: 'technician', jurisdictionId: 'WARD-084' };
  const citizenActor = { id: 'usr_cit', username: 'CitizenPriya', role: 'citizen' };

  beforeEach(() => {
    rollbackStreetlightStorage();
  });

  describe('Spatial Clustering Engine', () => {
    it('computes accurate Haversine distance in meters', () => {
      // 100 Feet Road two points roughly 50m apart
      const p1 = { lat: 12.9782, lng: 77.6405 };
      const p2 = { lat: 12.9786, lng: 77.6409 };
      const dist = haversineDistanceMeters(p1, p2);
      expect(dist).toBeGreaterThan(40);
      expect(dist).toBeLessThan(70);
    });

    it('detects duplicate reports on the same pole', () => {
      const existing = [
        {
          id: 'REP-001',
          assetId: 'POLE-042-101',
          status: 'reported',
          location: { lat: 12.9782, lng: 77.6405 },
        },
      ];

      const duplicate = findDuplicateReport(
        { assetId: 'POLE-042-101', location: { lat: 12.9782, lng: 77.6405 } },
        existing
      );

      expect(duplicate).not.toBeNull();
      expect(duplicate.id).toBe('REP-001');
    });

    it('detects spatial duplicate report within 15 meters even without pole ID', () => {
      const existing = [
        {
          id: 'REP-001',
          status: 'clustered',
          location: { lat: 12.978200, lng: 77.640500 },
        },
      ];

      const nearbyReport = {
        location: { lat: 12.978250, lng: 77.640540 }, // ~7 meters away
      };

      const duplicate = findDuplicateReport(nearbyReport, existing, 15);
      expect(duplicate).not.toBeNull();
      expect(duplicate.id).toBe('REP-001');
    });

    it('does not flag reports as duplicate if distant (>15m)', () => {
      const existing = [
        {
          id: 'REP-001',
          status: 'clustered',
          location: { lat: 12.978200, lng: 77.640500 },
        },
      ];

      const distantReport = {
        location: { lat: 12.985000, lng: 77.650000 },
      };

      const duplicate = findDuplicateReport(distantReport, existing, 15);
      expect(duplicate).toBeNull();
    });

    it('computes explainable priority score with safety hazard override', () => {
      const cluster = {
        centroid: { lat: 12.9782, lng: 77.6405 },
        assetIds: ['POLE-042-101'],
      };
      const reports = [
        {
          faultCategory: FAULT_CATEGORIES.EXPOSED_WIRING,
          reportedAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
        },
      ];

      const result = calculateClusterPriority(cluster, reports);
      expect(result.score).toBeGreaterThanOrEqual(75);
      expect(result.tier).toBe(PRIORITY_TIERS.CRITICAL);
      expect(result.explainability.factors.some((f) => f.field === 'hazardOverride')).toBe(true);
      expect(result.explainability.rulesetVersion).toBe('v1.0.0');
    });
  });

  describe('Outage Submission Workflow', () => {
    it('submits a new report, creates or matches a cluster, and sanitizes XSS', () => {
      const result = submitOutageReport(
        {
          assetId: 'POLE-042-101',
          faultCategory: FAULT_CATEGORIES.COMPLETELY_DARK,
          landmark: '<script>alert("hack")</script>Near Metro Pillar',
          description: 'Dark stretch on 100ft road.',
          contactNumber: '+91 9876543210',
        },
        citizenActor,
        { clientId: 'test-client-1' }
      );

      expect(result.trackingToken).toMatch(/^TRK-STLT-\d+/);
      expect(result.location.landmark).toBe('Near Metro Pillar');
      expect(result.location.landmark).not.toContain('<script>');
    });

    it('supports anonymous public tracking by token without leaking reporter PII', () => {
      const submitted = submitOutageReport(
        {
          assetId: 'POLE-042-101',
          faultCategory: FAULT_CATEGORIES.COMPLETELY_DARK,
          contactNumber: '+91 9999988888',
        },
        null,
        { clientId: 'test-client-anon' }
      );

      const tracked = trackReportByToken(submitted.trackingToken);
      expect(tracked.id).toBe(submitted.id);
      expect(tracked.status).toBeDefined();
      expect(tracked.reporterHash).toBeUndefined();
      expect(tracked.contactNumber).toBeUndefined();
    });

    it('handles duplicate submission by merging into existing primary report', () => {
      const sub1 = submitOutageReport(
        {
          assetId: 'POLE-110-302',
          faultCategory: FAULT_CATEGORIES.COMPLETELY_DARK,
        },
        citizenActor,
        { clientId: 'client-dup-1' }
      );

      const sub2 = submitOutageReport(
        {
          assetId: 'POLE-110-302',
          faultCategory: FAULT_CATEGORIES.COMPLETELY_DARK,
        },
        citizenActor,
        { clientId: 'client-dup-2' }
      );

      expect(sub1.status).not.toBe(REPORT_STATUS.DUPLICATE);
      expect(sub2.status).toBe(REPORT_STATUS.DUPLICATE);
    });

    it('supports idempotency keys on retry', () => {
      const key = 'IDEMP-RETRY-TEST-123';
      const first = submitOutageReport(
        {
          assetId: 'POLE-174-501',
          faultCategory: FAULT_CATEGORIES.FLICKERING_INTERMITTENT,
          idempotencyKey: key,
        },
        citizenActor,
        { clientId: 'idemp-client' }
      );

      const retry = submitOutageReport(
        {
          assetId: 'POLE-174-501',
          faultCategory: FAULT_CATEGORIES.FLICKERING_INTERMITTENT,
          idempotencyKey: key,
        },
        citizenActor,
        { clientId: 'idemp-client' }
      );

      expect(retry.id).toBe(first.id);
      expect(retry.trackingToken).toBe(first.trackingToken);
    });
  });

  describe('Operations Triage & Work Order Workflow', () => {
    it('allows operators to triage and override cluster priority with explicit reason', () => {
      const cluster = listClusters({}, adminActor)[0];

      const triaged = triageCluster(
        cluster.id,
        {
          priorityTier: PRIORITY_TIERS.CRITICAL,
          overrideReason: 'VIP motorcade route and hospital ambulance access corridor',
          notes: 'Emergency priority escalation',
        },
        operatorActor
      );

      expect(triaged.priorityTier).toBe(PRIORITY_TIERS.CRITICAL);
      expect(triaged.overrideLog.reason).toContain('VIP motorcade');
    });

    it('throws error when overriding priority without a reason', () => {
      const cluster = listClusters({}, adminActor)[0];
      expect(() => {
        triageCluster(
          cluster.id,
          {
            priorityTier: PRIORITY_TIERS.LOW,
            overrideReason: '',
          },
          operatorActor
        );
      }).toThrow(/explicit reason is required/);
    });

    it('creates work order and transitions cluster & reports atomically', () => {
      const cluster = listClusters({ status: 'open' }, adminActor)[0];

      const wo = createWorkOrder(
        {
          clusterId: cluster.id,
          assignedTechnicianId: 'TECH-042',
          assignedTechnicianName: 'Rajesh Sharma',
          priority: PRIORITY_TIERS.CRITICAL,
          targetSlaHours: 24,
        },
        operatorActor
      );

      expect(wo.id).toMatch(/^WO-STLT-/);
      expect(wo.status).toBe(WORK_ORDER_STATUS.DISPATCHED);

      const updatedCluster = getClusterById(cluster.id, adminActor);
      expect(updatedCluster.assignedWorkOrderId).toBe(wo.id);
    });

    it('enforces legal work order state transitions', () => {
      const woList = listWorkOrders({}, adminActor);
      const wo = woList[0];

      // Current is on_site in seed
      expect(() => {
        updateWorkOrderStatus(wo.id, WORK_ORDER_STATUS.DISPATCHED, '', techActor);
      }).toThrow(/Invalid work order state transition/);

      const updated = updateWorkOrderStatus(wo.id, WORK_ORDER_STATUS.PARTS_PENDING, 'Need 70W driver', techActor);
      expect(updated.status).toBe(WORK_ORDER_STATUS.PARTS_PENDING);
    });

    it('records repair event and atomically resolves work order, cluster, reports, and asset', () => {
      const woList = listWorkOrders({}, adminActor);
      const targetWo = woList[0];

      const repairResult = recordRepairEvent(
        {
          workOrderId: targetWo.id,
          assetId: 'POLE-084-201',
          resolutionAction: 'bulb_driver_replaced',
          partsReplaced: [{ partNumber: 'DRV-70W-IP67', description: '70W Driver', quantity: 1 }],
          technicianNotes: 'Replaced burnt driver and secured weather seal.',
        },
        techActor
      );

      expect(repairResult.repairEvent.id).toMatch(/^REP-EVT-/);
      expect(repairResult.workOrder.status).toBe(WORK_ORDER_STATUS.RESOLVED);
      expect(repairResult.cluster.status).toBe('resolved');

      // Verify asset restored to functional
      const assets = listAssets({ jurisdictionId: 'WARD-084' }, adminActor);
      const pole = assets.find((a) => a.id === 'POLE-084-201');
      expect(pole.operationalStatus).toBe(ASSET_STATUS.FUNCTIONAL);
    });
  });

  describe('Asset Inventory Management', () => {
    it('creates a new pole asset in inventory with coordinate validation', () => {
      const newAsset = createAsset(
        {
          id: 'POLE-042-999',
          jurisdictionId: 'WARD-042',
          coordinates: { lat: 12.9799, lng: 77.6420 },
          street: '12th Main Indiranagar',
          landmark: 'Opposite Community Library',
          poleType: 'standard',
          luminaireType: 'led_70w',
        },
        operatorActor
      );

      expect(newAsset.id).toBe('POLE-042-999');
      expect(newAsset.operationalStatus).toBe(ASSET_STATUS.FUNCTIONAL);
    });

    it('rejects duplicate pole Asset ID', () => {
      expect(() => {
        createAsset(
          {
            id: 'POLE-042-101', // Already in seed
            jurisdictionId: 'WARD-042',
            coordinates: { lat: 12.9782, lng: 77.6405 },
          },
          operatorActor
        );
      }).toThrow(/already exists/);
    });

    it('matches nearest asset within location tolerance', () => {
      // Near POLE-042-101 ({ lat: 12.9782, lng: 77.6405 })
      const matched = matchAssetByLocation({ lat: 12.97821, lng: 77.64051 }, 30);
      expect(matched).not.toBeNull();
      expect(matched.id).toBe('POLE-042-101');
      expect(matched.distanceMeters).toBeLessThan(15);
    });

    it('reassigns work orders to another technician with reason and audit log', () => {
      const woList = listWorkOrders({}, adminActor);
      const targetWo = woList[0];

      const reassigned = reassignWorkOrder(
        targetWo.id,
        {
          newTechnicianId: 'TECH-EMERGENCY',
          newTechnicianName: 'Rapid Night Response Unit 1',
          reason: 'Primary technician fell ill on shift',
        },
        operatorActor
      );

      expect(reassigned.assignedTechnicianId).toBe('TECH-EMERGENCY');
      expect(reassigned.reassignReason).toContain('Primary technician fell ill');
    });

    it('escalates stale unaddressed clusters exceeding SLA threshold', () => {
      const data = ensureStreetlightData();
      const targetCluster = data.clusters[0];
      targetCluster.createdAt = new Date(Date.now() - 96 * 3600 * 1000).toISOString();
      targetCluster.priorityTier = PRIORITY_TIERS.MEDIUM;
      targetCluster.status = 'open';
      persistStreetlightData(data);

      const result = expireStaleOutageStatuses(72, operatorActor);
      expect(result.escalatedCount).toBeGreaterThanOrEqual(1);

      const refreshed = getClusterById(targetCluster.id, adminActor);
      expect(refreshed.priorityTier).toBe(PRIORITY_TIERS.CRITICAL);
    });

    it('creates and lists preventative inspection schedules', () => {
      const schedule = createInspectionSchedule(
        {
          jurisdictionId: 'WARD-042',
          assetId: 'POLE-042-101',
          frequencyDays: 45,
          assignedInspectorId: 'INSP-EAST-01',
        },
        operatorActor
      );

      expect(schedule.id).toMatch(/^SCH-STLT-/);
      expect(schedule.frequencyDays).toBe(45);

      const list = listInspectionSchedules({ jurisdictionId: 'WARD-042' }, operatorActor);
      expect(list.some((s) => s.id === schedule.id)).toBe(true);
    });
  });
});
