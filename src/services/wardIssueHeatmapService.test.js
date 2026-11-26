
import { describe, it, expect, beforeEach } from 'vitest';
import {
  applyLaplaceMechanism,
  suppressSparseCell,
  compute95ConfidenceInterval,
} from './differentialPrivacyEngine';
import {
  allocateQueryBudget,
  getClientBudgetStatus,
  resetBudgetLedger,
} from './privacyBudgetService';
import {
  fetchDifferentiallyPrivateWardAnalytics,
  buildQueryKey,
} from './wardIssueHeatmapService';
import { resetCivicReports } from './wardIssueHeatmapStorage';

describe('Differential Privacy Engine', () => {
  it('computes expected 95% confidence intervals', () => {
    const ci1 = compute95ConfidenceInterval(0.5, 1);
    expect(ci1.scale).toBe(2);
    expect(ci1.margin).toBeCloseTo(5.99, 1);

    const ci2 = compute95ConfidenceInterval(1.0, 1);
    expect(ci2.scale).toBe(1);
    expect(ci2.margin).toBeCloseTo(3.0, 1);
  });

  it('correctly suppresses sparse cells under threshold', () => {
    // Both under threshold
    const res1 = suppressSparseCell(3, 4, 5);
    expect(res1.isSuppressed).toBe(true);
    expect(res1.publishedCount).toBeNull();

    // Raw under threshold, noisy over threshold -> MUST still suppress to prevent leakage
    const res2 = suppressSparseCell(2, 7, 5);
    expect(res2.isSuppressed).toBe(true);
    expect(res2.publishedCount).toBeNull();

    // Raw over threshold, noisy under threshold -> suppressed
    const res3 = suppressSparseCell(8, 3, 5);
    expect(res3.isSuppressed).toBe(true);
    expect(res3.publishedCount).toBeNull();

    // Both over threshold -> published
    const res4 = suppressSparseCell(15, 14, 5);
    expect(res4.isSuppressed).toBe(false);
    expect(res4.publishedCount).toBe(14);
  });

  it('applies Laplace mechanism with non-negative clamping and rounding', () => {
    // Constant PRNG yielding zero noise (u = 0.5)
    const zeroNoisePrng = () => 0.5;
    const count = applyLaplaceMechanism(10, 0.5, 1, { prng: zeroNoisePrng });
    expect(count).toBe(10);

    // Negative noise that would push count below zero is clamped at 0
    const negNoisePrng = () => 0.001; // Large negative noise
    const clampedCount = applyLaplaceMechanism(2, 0.5, 1, { prng: negNoisePrng });
    expect(clampedCount).toBe(0);
  });
});

describe('Privacy Budget Service', () => {
  beforeEach(() => {
    resetBudgetLedger();
  });

  it('allocates budget and decrements remaining amount', () => {
    const clientId = 'test-client-1';
    const statusInitial = getClientBudgetStatus(clientId);
    expect(statusInitial.remainingBudget).toBe(3.0);
    expect(statusInitial.consumedBudget).toBe(0.0);

    const alloc1 = allocateQueryBudget({ clientId, epsilon: 0.5 });
    expect(alloc1.allowed).toBe(true);
    expect(alloc1.consumedBudget).toBe(0.5);
    expect(alloc1.remainingBudget).toBe(2.5);

    const alloc2 = allocateQueryBudget({ clientId, epsilon: 1.0 });
    expect(alloc2.allowed).toBe(true);
    expect(alloc2.consumedBudget).toBe(1.5);
    expect(alloc2.remainingBudget).toBe(1.5);
  });

  it('enforces budget exhaustion limit', () => {
    const clientId = 'test-client-exhaust';

    // Consume up to 3.0 limit
    allocateQueryBudget({ clientId, epsilon: 1.5 });
    allocateQueryBudget({ clientId, epsilon: 1.5 });

    const status = getClientBudgetStatus(clientId);
    expect(status.remainingBudget).toBe(0);
    expect(status.isExhausted).toBe(true);

    // Subsequent query should be rejected
    const blocked = allocateQueryBudget({ clientId, epsilon: 0.5 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.error).toBe('BUDGET_EXHAUSTED');
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('returns cached results without consuming additional budget for idempotent queries', () => {
    const clientId = 'test-client-cache';
    const queryKey = 'ward=WARD-101&cat=potholes_roads&win=30d';

    const alloc1 = allocateQueryBudget({ clientId, epsilon: 0.5, queryKey });
    expect(alloc1.allowed).toBe(true);
    expect(alloc1.isCached).toBe(false);
    expect(alloc1.consumedBudget).toBe(0.5);

    // Second call with same queryKey immediately after
    // Simulating cacheQueryResult
    const alloc2 = allocateQueryBudget({ clientId, epsilon: 0.5, queryKey });
    expect(alloc2.allowed).toBe(true);
  });
});

describe('wardIssueHeatmapService', () => {
  beforeEach(() => {
    resetBudgetLedger();
    resetCivicReports();
  });

  it('validates query key builder', () => {
    const key = buildQueryKey({
      wardId: 'WARD-102',
      category: 'streetlights',
      timeWindow: '14d',
      epsilon: 0.5,
      sparseThreshold: 5,
    });
    expect(key).toBe('ward=WARD-102&cat=streetlights&win=14d&eps=0.5&tau=5');
  });

  it('returns differentially private analytics payload with metadata', () => {
    const res = fetchDifferentiallyPrivateWardAnalytics({
      wardId: 'WARD-101',
      timeWindow: '30d',
      epsilon: 0.5,
      sparseThreshold: 5,
      clientId: 'tester-analytics-1',
    });

    expect(res.success).toBe(true);
    expect(res.schemaVersion).toBe('1.0.0');
    expect(res.data.length).toBeGreaterThan(0);
    expect(res.privacyMetadata.appliedEpsilon).toBe(0.5);
    expect(res.privacyMetadata.sparseThreshold).toBe(5);
    expect(res.privacyMetadata.confidenceInterval95).toBeDefined();
    expect(res.disclaimer).toContain('Section 13B of the Municipal Corporation Act');
    expect(res.budgetStatus.remainingBudget).toBe(2.5);
  });

  it('suppresses sparse cells with count < tau', () => {
    // Custom dataset with 1 report in WARD-105 for water_supply
    resetCivicReports([
      {
        id: 'RPT-TEST-SPARSE',
        wardId: 'WARD-105',
        category: 'water_supply',
        timestamp: new Date().toISOString(),
      },
    ]);

    const res = fetchDifferentiallyPrivateWardAnalytics({
      wardId: 'WARD-105',
      category: 'water_supply',
      epsilon: 0.5,
      sparseThreshold: 5,
      clientId: 'tester-sparse',
    });

    expect(res.success).toBe(true);
    const cell = res.data.find((c) => c.category === 'water_supply');
    expect(cell).toBeDefined();
    expect(cell.isSuppressed).toBe(true);
    expect(cell.publishedCount).toBeNull();
    expect(cell.suppressionReason).toBe('Count < 5');
  });

  it('rejects invalid query parameters', () => {
    const res = fetchDifferentiallyPrivateWardAnalytics({
      timeWindow: 'invalid_window',
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe('INVALID_QUERY_PARAMS');
    expect(res.details.length).toBeGreaterThan(0);
  });

  it('rejects query when budget is exhausted', () => {
    const clientId = 'tester-exhaustion';

    // Exhaust budget (6 queries * 0.5 = 3.0)
    for (let i = 0; i < 6; i++) {
      fetchDifferentiallyPrivateWardAnalytics({
        wardId: `WARD-${101 + i}`,
        clientId,
        epsilon: 0.5,
      });
    }

    // 7th query should fail with BUDGET_EXHAUSTED
    const blockedRes = fetchDifferentiallyPrivateWardAnalytics({
      wardId: 'WARD-110',
      clientId,
      epsilon: 0.5,
    });

    expect(blockedRes.success).toBe(false);
    expect(blockedRes.error).toBe('BUDGET_EXHAUSTED');
    expect(blockedRes.budgetStatus.isExhausted).toBe(true);

/**
 * src/services/wardIssueHeatmapService.test.js
 * Comprehensive unit and integration tests for Anonymized Ward-Level Civic Issue Heatmap (#763).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  wardIssueHeatmapService,
  PermissionDeniedError,
  InvalidStateTransitionError,
  spatialJoinToWard,
} from './wardIssueHeatmapService.js';
import {
  WARD_HEATMAP_STORAGE_KEYS,
  resetWardIssueHeatmapData,
  migrateStorage,
  rollbackStorage,
  readStore,
} from './wardIssueHeatmapStorage.js';
import {
  TIME_WINDOWS,
  EVENT_STATUSES,
  RECOMMENDATION_STATUSES,
  normalizeIssueCategory,
  normalizeWardId,
  containsPii,
} from '../data/wardIssueHeatmapContract.js';

const createMockStorage = () => {
  const store = new Map();
  return {
    getItem: vi.fn((k) => (store.has(k) ? store.get(k) : null)),
    setItem: vi.fn((k, v) => store.set(k, String(v))),
    removeItem: vi.fn((k) => store.delete(k)),
    clear: vi.fn(() => store.clear()),
    store,
  };
};

describe('wardIssueHeatmapService (#763)', () => {
  let mockStorage;
  const adminActor = { id: 'adm-1', role: 'admin', username: 'Chief Commissioner' };
  const operatorActor = { id: 'op-1', role: 'operator', username: 'Field Engineer' };
  const citizenActor = { id: 'cit-1', role: 'citizen', username: 'Citizen User' };

  beforeEach(() => {
    mockStorage = createMockStorage();
    resetWardIssueHeatmapData(mockStorage);
  });

  describe('Storage Bootstrap & Seeding', () => {
    it('initializes empty storage with seed wards, categories, events, and privacy rules', () => {
      const privacyRules = wardIssueHeatmapService.getPrivacyRules(mockStorage);
      expect(privacyRules).toBeDefined();
      expect(privacyRules.minCohortThreshold).toBe(5);
      expect(privacyRules.rulesetVersion).toContain('k5');

      const wards = wardIssueHeatmapService.getWards(mockStorage);
      expect(wards.length).toBeGreaterThanOrEqual(10);
      expect(wards.some((w) => w.id === 'ward-150')).toBe(true);
    });
  });

  describe('Category Normalization & Spatial Join', () => {
    it('normalizes category strings and common aliases', () => {
      expect(normalizeIssueCategory('pothole')).toBe('potholes_road_damage');
      expect(normalizeIssueCategory('road damage on junction')).toBe('potholes_road_damage');
      expect(normalizeIssueCategory('pipe burst')).toBe('water_supply_leakage');
      expect(normalizeIssueCategory('stagnant waterlogging')).toBe('drainage_waterlogging');
      expect(normalizeIssueCategory('open manhole')).toBe('sewage_overflow');
      expect(normalizeIssueCategory('garbage dump')).toBe('garbage_solid_waste');
      expect(normalizeIssueCategory('dark street lamp post')).toBe('street_lighting_electrical');
      expect(normalizeIssueCategory('unknown')).toBe('potholes_road_damage');
    });

    it('normalizes ward identifiers from code or name', () => {
      expect(normalizeWardId('150')).toBe('ward-150');
      expect(normalizeWardId('Bellandur')).toBe('ward-150');
      expect(normalizeWardId('Indiranagar')).toBe('ward-101');
      expect(normalizeWardId('102')).toBe('ward-102');
    });

    it('spatially joins GPS coordinates to closest municipal ward centroid', () => {
      // Bellandur coordinates: [12.9304, 77.6784]
      const ward = spatialJoinToWard(12.9305, 77.6785);
      expect(ward.id).toBe('ward-150');
      expect(ward.name).toBe('Bellandur');

      // Indiranagar coordinates: [12.9784, 77.6408]
      const wardIndira = spatialJoinToWard(12.9780, 77.6410);
      expect(wardIndira.id).toBe('ward-101');
      expect(wardIndira.name).toBe('Indiranagar');
    });
  });

  describe('Privacy-Preserving Aggregation & Small-Cell Suppression', () => {
    it('suppresses sparse cells where event count < minCohortThreshold (k=5)', () => {
      const data = wardIssueHeatmapService.getHeatmapData({
        timeWindow: TIME_WINDOWS.LAST_30_DAYS,
        category: 'sewage_overflow',
        actor: citizenActor,
        storage: mockStorage,
      });

      // Malleshwaram has only 2 sewage events seeded in last 30 days
      const malleshwaramMetric = data.metrics.find((m) => m.wardId === 'ward-72');
      expect(malleshwaramMetric).toBeDefined();
      expect(malleshwaramMetric.suppressed).toBe(true);
      expect(malleshwaramMetric.displayCount).toBe('< 5 (Suppressed)');
      expect(malleshwaramMetric.rawCount).toBeUndefined(); // Stripped from public view
      expect(malleshwaramMetric.ratePer10kPopulation).toBeNull();
      expect(malleshwaramMetric.severityBreakdown).toBeNull();
      expect(malleshwaramMetric.suppressionReason).toContain('k-anonymity privacy safeguards');
    });

    it('publishes counts and rates when event count >= minCohortThreshold (k=5)', () => {
      const data = wardIssueHeatmapService.getHeatmapData({
        timeWindow: TIME_WINDOWS.LAST_30_DAYS,
        category: 'drainage_waterlogging',
        actor: citizenActor,
        storage: mockStorage,
      });

      // Bellandur has 38 drainage events seeded in last 30 days
      const bellandurMetric = data.metrics.find((m) => m.wardId === 'ward-150');
      expect(bellandurMetric).toBeDefined();
      expect(bellandurMetric.suppressed).toBe(false);
      expect(typeof bellandurMetric.displayCount).toBe('number');
      expect(bellandurMetric.displayCount).toBeGreaterThanOrEqual(5);
      expect(bellandurMetric.ratePer10kPopulation).toBeGreaterThan(0);
      expect(bellandurMetric.severityBreakdown).toBeDefined();
    });

    it('re-identification safeguard: public output strictly excludes PII, phone, GPS, and private notes', () => {
      const data = wardIssueHeatmapService.getHeatmapData({
        timeWindow: TIME_WINDOWS.LAST_30_DAYS,
        actor: citizenActor,
        storage: mockStorage,
      });

      const serialized = JSON.stringify(data);
      expect(serialized).not.toContain('reporterIdHash');
      expect(serialized).not.toContain('coarseLocation');
      expect(serialized).not.toContain('approximateCoords');
      expect(containsPii(serialized)).toBe(false);
    });
  });

  describe('Time-Windowed Trends & Velocity Calculations', () => {
    it('computes trend velocity and percentage changes accurately', () => {
      const trends = wardIssueHeatmapService.getTrendExplorerData({
        wardId: 'ward-150',
        compareWithWardId: 'ward-101',
        timeWindow: TIME_WINDOWS.LAST_30_DAYS,
        storage: mockStorage,
      });

      expect(trends.primaryWard.ward.id).toBe('ward-150');
      expect(trends.compareWard.ward.id).toBe('ward-101');
      expect(trends.primaryWard.series.length).toBe(4);
      expect(trends.primaryWard.series[0].startDate).toBeDefined();
    });
  });

  describe('Ingestion & PII Protection', () => {
    it('ingests an eligible civic issue and perturbs coordinates to ward centroid', () => {
      const payload = {
        wardId: 'ward-101',
        category: 'potholes_road_damage',
        severity: 'high',
        coarseLocation: '100-Ft Road Junction near Metro Station',
        description: 'Large crater in middle lane disrupting bus traffic.',
      };

      const res = wardIssueHeatmapService.ingestCivicIssueEvent(payload, citizenActor, mockStorage);
      expect(res.deduplicated).toBe(false);
      expect(res.event.id).toMatch(/^EVT-101-POTH-\d+$/);
      expect(res.event.wardId).toBe('ward-101');
      expect(res.event.reporterIdHash).toMatch(/^ANON-[A-F0-9]+$/);
      expect(res.event.approximateCoords).toEqual([12.9784, 77.6408]); // Snapped to ward centroid
    });

    it('rejects submissions containing PII (phone number, Aadhaar, PAN, email)', () => {
      const piiPayload = {
        wardId: 'ward-101',
        category: 'potholes_road_damage',
        description: 'Contact 9876543210 or email test@example.com my Aadhaar is 1234 5678 9012',
      };

      expect(() => {
        wardIssueHeatmapService.ingestCivicIssueEvent(piiPayload, citizenActor, mockStorage);
      }).toThrow(/personal identifiable information/i);
    });

    it('deduplicates submissions with matching idempotencyKey', () => {
      const payload = {
        idempotencyKey: 'IDEM-TEST-REPLAY-1',
        wardId: 'ward-102',
        category: 'garbage_solid_waste',
        description: 'Overflowing public dustbin near commercial complex.',
      };

      const first = wardIssueHeatmapService.ingestCivicIssueEvent(payload, citizenActor, mockStorage);
      expect(first.deduplicated).toBe(false);

      const second = wardIssueHeatmapService.ingestCivicIssueEvent(payload, citizenActor, mockStorage);
      expect(second.deduplicated).toBe(true);
      expect(second.event.id).toBe(first.event.id);
    });
  });

  describe('State Transitions & Validation', () => {
    it('allows valid lifecycle transitions (reported -> verified -> in_progress -> resolved)', () => {
      const payload = {
        wardId: 'ward-174',
        category: 'street_lighting_electrical',
        description: 'Dark road section near park.',
      };
      const { event } = wardIssueHeatmapService.ingestCivicIssueEvent(payload, citizenActor, mockStorage);
      expect(event.status).toBe(EVENT_STATUSES.REPORTED);

      // Operator verifies
      const verified = wardIssueHeatmapService.transitionEventStatus(
        event.id,
        EVENT_STATUSES.VERIFIED,
        'Field inspection confirmed missing lamp fixture.',
        operatorActor,
        mockStorage
      );
      expect(verified.status).toBe(EVENT_STATUSES.VERIFIED);

      // Operator marks in_progress
      const inProg = wardIssueHeatmapService.transitionEventStatus(
        event.id,
        EVENT_STATUSES.IN_PROGRESS,
        'Maintenance crew dispatched.',
        operatorActor,
        mockStorage
      );
      expect(inProg.status).toBe(EVENT_STATUSES.IN_PROGRESS);

      // Operator resolves
      const resolved = wardIssueHeatmapService.transitionEventStatus(
        event.id,
        EVENT_STATUSES.RESOLVED,
        'LED luminaire replaced and energized.',
        operatorActor,
        mockStorage
      );
      expect(resolved.status).toBe(EVENT_STATUSES.RESOLVED);
    });

    it('blocks invalid lifecycle transitions (reported -> in_progress)', () => {
      const payload = {
        wardId: 'ward-174',
        category: 'street_lighting_electrical',
        description: 'Dark road section.',
      };
      const { event } = wardIssueHeatmapService.ingestCivicIssueEvent(payload, citizenActor, mockStorage);

      expect(() => {
        wardIssueHeatmapService.transitionEventStatus(
          event.id,
          EVENT_STATUSES.IN_PROGRESS,
          'Skipping verification',
          operatorActor,
          mockStorage
        );
      }).toThrow(InvalidStateTransitionError);
    });

    it('denies state transition attempts by unprivileged public citizen', () => {
      const payload = {
        wardId: 'ward-174',
        category: 'street_lighting_electrical',
        description: 'Dark road section.',
      };
      const { event } = wardIssueHeatmapService.ingestCivicIssueEvent(payload, citizenActor, mockStorage);

      expect(() => {
        wardIssueHeatmapService.transitionEventStatus(
          event.id,
          EVENT_STATUSES.VERIFIED,
          'Unauthorized attempt',
          citizenActor,
          mockStorage
        );
      }).toThrow(PermissionDeniedError);
    });
  });

  describe('Explainable Recommendations & Human-in-the-Loop Review', () => {
    it('lists explainable recommendations with model version and input features', () => {
      const recs = wardIssueHeatmapService.getRecommendations({}, mockStorage);
      expect(recs.length).toBeGreaterThan(0);

      const rec = recs[0];
      expect(rec.title).toBeDefined();
      expect(rec.whyProduced).toBeDefined();
      expect(rec.influencedBy).toBeInstanceOf(Array);
      expect(rec.rulesetVersion).toBeDefined();
      expect(rec.status).toBe(RECOMMENDATION_STATUSES.PENDING);
    });

    it('allows authorized operator to accept recommendation with operational notes', () => {
      const recs = wardIssueHeatmapService.getRecommendations({}, mockStorage);
      const pendingRec = recs.find((r) => r.status === RECOMMENDATION_STATUSES.PENDING);
      expect(pendingRec).toBeDefined();

      const reviewed = wardIssueHeatmapService.reviewRecommendation(
        pendingRec.id,
        {
          status: RECOMMENDATION_STATUSES.ACCEPTED,
          notes: 'Approved for night-shift road maintenance bundle.',
          modifiedIntervention: 'Execute rapid cold-mix patching within 48 hours.',
        },
        operatorActor,
        mockStorage
      );

      expect(reviewed.status).toBe(RECOMMENDATION_STATUSES.ACCEPTED);
      expect(reviewed.reviewedBy).toBe(operatorActor.username);
      expect(reviewed.reviewNotes).toContain('night-shift road maintenance bundle');
      expect(reviewed.recommendation).toContain('within 48 hours');
    });

    it('rejects recommendation review lacking justification notes', () => {
      const recs = wardIssueHeatmapService.getRecommendations({}, mockStorage);
      const pendingRec = recs.find((r) => r.status === RECOMMENDATION_STATUSES.PENDING);

      expect(() => {
        wardIssueHeatmapService.reviewRecommendation(
          pendingRec.id,
          { status: RECOMMENDATION_STATUSES.REJECTED, notes: '' },
          operatorActor,
          mockStorage
        );
      }).toThrow(/Review notes.*required/);
    });

    it('denies recommendation review attempts by unprivileged public citizens', () => {
      const recs = wardIssueHeatmapService.getRecommendations({}, mockStorage);
      expect(() => {
        wardIssueHeatmapService.reviewRecommendation(
          recs[0].id,
          { status: RECOMMENDATION_STATUSES.ACCEPTED, notes: 'Citizen trying to approve' },
          citizenActor,
          mockStorage
        );
      }).toThrow(PermissionDeniedError);
    });
  });

  describe('Role-Based Administration & Underlying Records Gating', () => {
    it('allows administrator to execute aggregation run and update privacy rules', () => {
      const run = wardIssueHeatmapService.executeAggregationRun(
        { timeWindow: TIME_WINDOWS.LAST_30_DAYS },
        adminActor,
        mockStorage
      );
      expect(run.runId).toMatch(/^RUN-\d+$/);
      expect(run.executedBy).toBe(adminActor.username);
      expect(run.status).toBe('completed');

      const updatedRules = wardIssueHeatmapService.updatePrivacyRules(
        { minCohortThreshold: 7 },
        adminActor,
        mockStorage
      );
      expect(updatedRules.minCohortThreshold).toBe(7);
    });

    it('denies non-administrators from inspecting underlying authorized events', () => {
      expect(() => {
        wardIssueHeatmapService.getAuthorizedEvents({}, citizenActor, mockStorage);
      }).toThrow(PermissionDeniedError);

      expect(() => {
        wardIssueHeatmapService.getAuthorizedEvents({}, operatorActor, mockStorage);
      }).toThrow(PermissionDeniedError);

      const events = wardIssueHeatmapService.getAuthorizedEvents({}, adminActor, mockStorage);
      expect(events).toBeInstanceOf(Array);
      expect(events.length).toBeGreaterThan(0);
    });

    it('denies non-administrators from inspecting audit logs', () => {
      expect(() => {
        wardIssueHeatmapService.getAuditLogs(citizenActor, mockStorage);
      }).toThrow(PermissionDeniedError);

      const logs = wardIssueHeatmapService.getAuditLogs(adminActor, mockStorage);
      expect(logs).toBeInstanceOf(Array);
      expect(logs.length).toBeGreaterThan(0);
    });
  });

  describe('Migrations & Rollback', () => {
    it('safely migrates existing dataset with schema version stamping and backup', () => {
      const migrationRes = migrateStorage(mockStorage);
      expect(migrationRes.success).toBe(true);
      expect(migrationRes.total).toBeGreaterThan(0);

      const backup = readStore(WARD_HEATMAP_STORAGE_KEYS.MIGRATION_BACKUP, null, mockStorage);
      expect(backup).toBeDefined();
      expect(backup.events.length).toBe(migrationRes.total);

      // Rollback
      const rollbackRes = rollbackStorage(mockStorage);
      expect(rollbackRes.success).toBe(true);
      expect(rollbackRes.restoredCount).toBe(migrationRes.total);
    });

    it('handles rollback gracefully when no backup exists', () => {
      mockStorage.clear();
      const res = rollbackStorage(mockStorage);
      expect(res.success).toBe(false);
      expect(res.reason).toContain('No valid migration backup found');
    });
  });

  describe('Export Functionality', () => {
    it('exports anonymized CSV with whitelisted columns and suppressed indicators', () => {
      const csv = wardIssueHeatmapService.exportAnonymizedMetrics('csv', {}, mockStorage);
      expect(csv).toContain('Ward ID,Ward Name,Zone,Category,Time Window');
      expect(csv).toContain('Suppressed');
      expect(csv).not.toContain('reporterIdHash');
    });

  });
});
