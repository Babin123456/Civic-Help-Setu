import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  submitNeedReport,
  trackNeedByToken,
  reviewNeedReport,
  listNeedReports,
  getUnmetNeedsSummary,
  createIncident,
  transitionIncident,
  createResource,
  listResources,
  quarantineResource,
  createDistributionSite,
  proposeAllocation,
  decideAllocation,
  dispatchAllocation,
  confirmDelivery,
  cancelAllocation,
  listAllocations,
  runReliefForecast,
  getLatestForecastRun,
  getPublicReliefStatus,
  getReliefMetrics,
  getReliefAuditTrail,
  toPublicNeedProjection,
  resetReliefRateLimiter,
} from './reliefOperationsService';
import {
  ensureReliefData,
  rollbackReliefStorage,
  __resetReliefMemoryStorage,
} from './reliefOperationsMigrations';
import { RELIEF_ERROR_CODES } from './reliefOperationsConstants';

const citizen = { id: 'citizen-1', role: 'citizen', jurisdictionId: 'WARD-150' };
const operator = {
  id: 'operator-1',
  role: 'operator',
  reliefRole: 'operator',
  jurisdictionId: 'WARD-150',
  username: 'Operator One',
};
const otherOperator = {
  id: 'operator-2',
  role: 'operator',
  reliefRole: 'operator',
  jurisdictionId: 'WARD-150',
};
const reviewer = {
  id: 'reviewer-1',
  role: 'reviewer',
  reliefRole: 'reviewer',
  jurisdictionId: 'WARD-150',
};
const admin = { id: 'admin-1', role: 'admin' };
const partnerUser = {
  id: 'partner-user-1',
  role: 'partner',
  reliefRole: 'partner',
  partnerId: 'PARTNER-001',
  jurisdictionId: 'WARD-150',
};

const uniqueReport = (overrides = {}) => ({
  category: 'sanitation',
  locality: 'Test Nagar',
  jurisdictionId: 'WARD-150',
  description: 'Sanitation kits and handwashing supplies for the temporary shelter blocks after the flood.',
  quantity: 25,
  peopleAffected: 90,
  urgency: 'high',
  reporterType: 'citizen',
  ...overrides,
});

const reason = 'Field assessment confirms this decision is appropriate.';

describe('reliefOperationsService (#747)', () => {
  beforeEach(() => {
    const store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
      clear: () => store.clear(),
    });
    __resetReliefMemoryStorage();
    rollbackReliefStorage();
    resetReliefRateLimiter();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetReliefRateLimiter();
  });

  it('enforces role boundaries for verification, approval and audit access', () => {
    expect(() => reviewNeedReport('NEED-0001', { decision: 'verify' }, citizen)).toThrowError(
      expect.objectContaining({ code: RELIEF_ERROR_CODES.PERMISSION_DENIED })
    );

    expect(() =>
      decideAllocation('ALLOC-0001', { decision: 'approve', reason }, operator)
    ).toThrowError(expect.objectContaining({ code: RELIEF_ERROR_CODES.PERMISSION_DENIED }));

    expect(() => getReliefAuditTrail({}, operator)).toThrowError(
      expect.objectContaining({ code: RELIEF_ERROR_CODES.PERMISSION_DENIED })
    );

    // Reviewer can read the append-only audit trail within their jurisdiction.
    expect(() => getReliefAuditTrail({}, reviewer)).not.toThrow();
  });

  it('enforces explicit capability boundaries for citizen, reviewer and admin', () => {
    expect(() => listNeedReports({}, citizen)).toThrowError(
      expect.objectContaining({ code: RELIEF_ERROR_CODES.PERMISSION_DENIED })
    );
    expect(() => listNeedReports({}, { role: 'public' })).toThrowError(
      expect.objectContaining({ code: RELIEF_ERROR_CODES.PERMISSION_DENIED })
    );

    // Reviewers are the human approval gate, not field verifiers or proposers.
    expect(() => reviewNeedReport('NEED-0001', { decision: 'verify' }, reviewer)).toThrowError(
      expect.objectContaining({ code: RELIEF_ERROR_CODES.PERMISSION_DENIED })
    );
    expect(() =>
      proposeAllocation(
        { needId: 'NEED-0001', resourceId: 'RES-WATER-BLR-01', category: 'water', quantity: 1 },
        reviewer
      )
    ).toThrowError(expect.objectContaining({ code: RELIEF_ERROR_CODES.PERMISSION_DENIED }));

    // An unrestricted administrator can read every jurisdiction in the seed dataset.
    const adminNeeds = listNeedReports({}, admin);
    expect(new Set(adminNeeds.items.map((need) => need.jurisdictionId)).size).toBeGreaterThan(1);
  });

  it('prevents concurrent approvals from over-reserving the same stock', () => {
    const resource = createResource(
      {
        name: 'Emergency water pouches',
        category: 'water',
        unit: 'pouch',
        jurisdictionId: 'WARD-150',
        quantityOnHand: 10,
        batchRef: 'TEST-WATER-10',
      },
      operator
    );

    const first = proposeAllocation(
      {
        needId: 'NEED-0001',
        resourceId: resource.id,
        category: 'water',
        quantity: 6,
        siteId: 'SITE-150-A',
      },
      operator
    );
    const second = proposeAllocation(
      {
        needId: 'NEED-0001',
        resourceId: resource.id,
        category: 'water',
        quantity: 6,
        siteId: 'SITE-150-A',
      },
      otherOperator
    );

    const approved = decideAllocation(first.id, { decision: 'approve', reason }, reviewer);
    expect(approved.status).toBe('reserved');

    expect(() =>
      decideAllocation(second.id, { decision: 'approve', reason }, reviewer)
    ).toThrowError(expect.objectContaining({ code: RELIEF_ERROR_CODES.INSUFFICIENT_STOCK }));

    const stock = listResources({}, operator).items.find((item) => item.id === resource.id);
    expect(stock.quantityReserved).toBe(6);
    expect(stock.quantityOnHand).toBe(10);
    expect(stock.availableQuantity).toBe(4);

    const queue = listAllocations({}, operator).items;
    expect(queue.find((item) => item.id === second.id).status).toBe('pending_approval');
  });

  it('deduplicates repeated reports and supports replay-safe idempotency keys', () => {
    const first = submitNeedReport(uniqueReport(), citizen, { clientId: 'dedupe-client' });
    const second = submitNeedReport(uniqueReport(), citizen, { clientId: 'dedupe-client-2' });

    expect(first.deduplicated).toBe(false);
    expect(second.deduplicated).toBe(true);
    expect(second.status).toBe('duplicate');
    expect(second.duplicateOfTrackingToken).toBe(first.trackingToken);

    const list = listNeedReports({ category: 'sanitation', locality: 'Test Nagar' }, operator);
    const primary = list.items.find((need) => need.trackingToken === first.trackingToken);
    expect(primary.duplicateCount).toBe(1);

    const keyed = uniqueReport({
      description: 'Bleach tablets and gloves for the school shelter after the flood water receded.',
      idempotencyKey: 'test-idem-747-a',
    });
    const replayA = submitNeedReport(keyed, citizen, { clientId: 'key-client' });
    const replayB = submitNeedReport(keyed, citizen, { clientId: 'key-client' });
    expect(replayB.trackingToken).toBe(replayA.trackingToken);
    expect(replayB.idempotentReplay).toBe(true);

    expect(() =>
      submitNeedReport(
        { ...keyed, description: 'Completely different text for a different need in the same locality.' },
        citizen,
        { clientId: 'key-client-conflict' }
      )
    ).toThrowError(expect.objectContaining({ code: RELIEF_ERROR_CODES.IDEMPOTENCY_CONFLICT }));
  });

  it('rejects expired stock and blocks allocation from unverified needs', () => {
    expect(() =>
      proposeAllocation(
        {
          needId: 'NEED-0006',
          resourceId: 'RES-MED-EXPIRED',
          category: 'medicine',
          quantity: 5,
          siteId: 'SITE-150-A',
        },
        operator
      )
    ).toThrowError(expect.objectContaining({ code: RELIEF_ERROR_CODES.STOCK_EXPIRED }));

    expect(() =>
      proposeAllocation(
        {
          needId: 'NEED-0008',
          resourceId: 'RES-FOOD-001',
          category: 'transport',
          quantity: 2,
          siteId: 'SITE-150-A',
        },
        operator
      )
    ).toThrowError(expect.objectContaining({ code: RELIEF_ERROR_CODES.INVALID_STATE_TRANSITION }));
  });

  it('enforces separation of duty between proposer and approver', () => {
    const proposal = proposeAllocation(
      {
        needId: 'NEED-0003',
        resourceId: 'RES-SHELTER-001',
        category: 'shelter',
        quantity: 5,
        siteId: 'SITE-150-A',
      },
      admin
    );

    expect(() =>
      decideAllocation(proposal.id, { decision: 'approve', reason }, admin)
    ).toThrowError(expect.objectContaining({ code: RELIEF_ERROR_CODES.SEPARATION_OF_DUTY }));
  });

  it('runs the complete propose → approve/reserve → dispatch → confirm workflow persistently', () => {
    const proposal = proposeAllocation(
      {
        needId: 'NEED-0003',
        resourceId: 'RES-SHELTER-001',
        category: 'shelter',
        quantity: 20,
        siteId: 'SITE-150-A',
        recommendation: {
          recommendationId: 'REC-TEST-SHELTER',
          modelVersion: 'relief-forecast-rules-v1.0.0',
          decision: 'edited',
          recommendedQuantity: 24,
          operatorNote: 'Reduced to the confirmed family count.',
        },
      },
      operator
    );
    expect(proposal.status).toBe('pending_approval');

    const reserved = decideAllocation(proposal.id, { decision: 'approve', reason }, reviewer);
    expect(reserved.status).toBe('reserved');

    const dispatched = dispatchAllocation(
      proposal.id,
      { teamName: 'East Zone Shelter Team', vehicleRef: 'KA-01-TEST-747' },
      operator
    );
    expect(dispatched.allocation.status).toBe('dispatched');

    const confirmation = confirmDelivery(
      dispatched.delivery.id,
      {
        deliveredQuantity: 20,
        receivedByRole: 'Shelter coordinator',
        note: 'Tarpaulins handed over at the community hall.',
      },
      reviewer
    );
    expect(confirmation.delivery.status).toBe('confirmed');
    expect(confirmation.need.fulfilledQuantity).toBe(20);
    expect(confirmation.need.status).toBe('allocated');
    expect(confirmation.resource.quantityOnHand).toBe(28);
    expect(confirmation.resource.quantityReserved).toBe(0);

    // Reload from storage: the workflow survives a page refresh.
    const reloaded = ensureReliefData();
    const storedNeed = reloaded.needs.find((need) => need.id === 'NEED-0003');
    const storedAllocation = reloaded.allocations.find((item) => item.id === proposal.id);
    const storedDelivery = reloaded.deliveries.find((item) => item.id === dispatched.delivery.id);
    expect(storedNeed.fulfilledQuantity).toBe(20);
    expect(storedAllocation.status).toBe('confirmed');
    expect(storedDelivery.status).toBe('confirmed');

    const movements = reloaded.movements.filter((movement) => movement.allocationId === proposal.id);
    expect(movements.map((movement) => movement.type)).toEqual(
      expect.arrayContaining(['reservation', 'issue'])
    );

    expect(() =>
      confirmDelivery(
        dispatched.delivery.id,
        { deliveredQuantity: 1, receivedByRole: 'Shelter coordinator' },
        reviewer
      )
    ).toThrowError(expect.objectContaining({ code: RELIEF_ERROR_CODES.INVALID_STATE_TRANSITION }));
  });

  it('cancels a reserved allocation and releases the reservation transactionally', () => {
    const proposal = proposeAllocation(
      {
        needId: 'NEED-0002',
        resourceId: 'RES-FOOD-001',
        category: 'food',
        quantity: 25,
        siteId: 'SITE-150-A',
      },
      operator
    );
    decideAllocation(proposal.id, { decision: 'approve', reason }, reviewer);
    const before = listResources({ category: 'food' }, operator).items.find(
      (item) => item.id === 'RES-FOOD-001'
    );
    expect(before.quantityReserved).toBe(25);

    const cancelled = cancelAllocation(proposal.id, { reason: 'Site access closed by district control room.' }, operator);
    expect(cancelled.status).toBe('cancelled');

    const after = listResources({ category: 'food' }, operator).items.find(
      (item) => item.id === 'RES-FOOD-001'
    );
    expect(after.quantityReserved).toBe(0);
    expect(after.quantityOnHand).toBe(before.quantityOnHand);
  });

  it('rejects invalid state transitions with actionable detail', () => {
    expect(() =>
      reviewNeedReport('NEED-0001', { decision: 'verify' }, operator)
    ).toThrowError(
      expect.objectContaining({
        code: RELIEF_ERROR_CODES.INVALID_STATE_TRANSITION,
        details: expect.objectContaining({ allowed: expect.any(Array) }),
      })
    );

    expect(() =>
      dispatchAllocation('ALLOC-0001', { teamName: 'Unscheduled Team' }, operator)
    ).toThrowError(expect.objectContaining({ code: RELIEF_ERROR_CODES.INVALID_STATE_TRANSITION }));
  });

  it('scopes operational reads by jurisdiction', () => {
    const otherWardOperator = {
      id: 'operator-42',
      role: 'operator',
      reliefRole: 'operator',
      jurisdictionId: 'WARD-042',
    };
    const needs = listNeedReports({}, otherWardOperator);
    expect(needs.items.length).toBeGreaterThan(0);
    expect(needs.items.every((need) => need.jurisdictionId === 'WARD-042')).toBe(true);

    expect(() =>
      reviewNeedReport('NEED-0001', { decision: 'verify' }, otherWardOperator)
    ).toThrowError(expect.objectContaining({ code: RELIEF_ERROR_CODES.PERMISSION_DENIED }));
  });

  it('scopes public projections and strips internal or personal fields', () => {
    const publicStatus = getPublicReliefStatus({});
    const serialized = JSON.stringify(publicStatus);
    expect(serialized).not.toContain('NEED-0001');
    expect(serialized).not.toContain('TRK-RLF-100001');
    expect(serialized).not.toContain('Community hall coordinator confirmed');
    expect(serialized).not.toContain('anon-7f2');
    expect(publicStatus.publicFields.length).toBeGreaterThan(0);

    const projection = toPublicNeedProjection(ensureReliefData().needs[0]);
    expect(projection).not.toHaveProperty('description');
    expect(projection).not.toHaveProperty('privateNote');
    expect(projection).not.toHaveProperty('reporterRef');
    expect(projection).not.toHaveProperty('coordinates');
    expect(projection).not.toHaveProperty('id');

    const tracked = trackNeedByToken('TRK-RLF-100001');
    expect(tracked.statusLabel).toBeDefined();
    expect(tracked).not.toHaveProperty('privateNote');
  });

  it('records incidents and validates their transitions', () => {
    const incident = createIncident(
      {
        name: 'Test Flood Response',
        locality: 'Test Nagar',
        jurisdictionId: 'WARD-150',
        disasterType: 'flood',
        summary: 'Synthetic incident created by the service test.',
        publicSummary: 'Flood response is active in Test Nagar.',
      },
      operator
    );
    expect(incident.status).toBe('active');

    const contained = transitionIncident(
      incident.id,
      'containment',
      { reason: 'Water level is receding.' },
      operator
    );
    expect(contained.status).toBe('containment');

    expect(() =>
      transitionIncident(incident.id, 'archived', { reason: 'Try invalid jump' }, operator)
    ).toThrowError(expect.objectContaining({ code: RELIEF_ERROR_CODES.INVALID_STATE_TRANSITION }));
  });

  it('exposes explainable, versioned forecast runs and stale-data signals', () => {
    const run = runReliefForecast({ jurisdictionId: 'WARD-150', windowDays: 7 }, operator);
    expect(run.modelVersion).toBeDefined();
    expect(run.executedAt).toBeDefined();
    expect(run.featureWindow.days).toBe(7);
    expect(run.recommendations.length).toBeGreaterThan(0);

    const water = run.recommendations.find((rec) => rec.category === 'water' && rec.locality === 'Bellandur');
    expect(water).toBeTruthy();
    expect(water.requiresHumanApproval).toBe(true);
    expect(water.evidence.reportIds.length).toBeGreaterThan(0);
    expect(water.evidence.sourceFields).toContain('urgency');
    expect(water.explanation.length).toBeGreaterThan(0);
    expect(water.confidence).toBeDefined();

    const medicine = run.recommendations.find((rec) => rec.category === 'medicine');
    expect(medicine.requiresMedicalReview).toBe(true);
    expect(medicine.triageDecisionMade).toBe(false);
    expect(medicine.medicalReviewNotice).toMatch(/does not triage/i);

    const latest = getLatestForecastRun({ jurisdictionId: 'WARD-150' }, reviewer);
    expect(latest.runId).toBe(run.runId);

    const staleRun = runReliefForecast(
      { jurisdictionId: 'WARD-150', windowDays: 7, now: Date.now() + 2 * 24 * 60 * 60 * 1000 },
      operator
    );
    expect(staleRun.recommendations.every((rec) => rec.confidence === 'low')).toBe(true);
    expect(staleRun.dataFreshness.isStale).toBe(true);
  });

  it('provides aggregated unmet needs and operator metrics', () => {
    const unmet = getUnmetNeedsSummary({}, operator);
    expect(unmet.summary.totalOpenReports).toBeGreaterThan(0);
    expect(unmet.summary.byCategory.some((item) => item.category === 'water')).toBe(true);
    expect(unmet.summary.byLocality.some((item) => item.locality === 'Bellandur')).toBe(true);
    expect(unmet.needs.every((need) => ['submitted', 'verified', 'triaged'].includes(need.status))).toBe(true);

    const metrics = getReliefMetrics({}, operator);
    expect(metrics.openNeeds).toBeGreaterThan(0);
    expect(metrics.pendingApprovals).toBeGreaterThanOrEqual(1);
    expect(metrics.peopleAffected).toBeGreaterThan(0);
  });

  it('requires a verified partner for partner submissions', () => {
    const report = uniqueReport({
      category: 'food',
      locality: 'Partner Test Locality',
      description: 'Partner reports dry ration kits needed at the verified distribution point.',
      reporterType: 'partner',
    });

    expect(() => submitNeedReport(report, partnerUser, { clientId: 'partner-ok' })).not.toThrow();
    expect(() =>
      submitNeedReport(report, { ...partnerUser, partnerId: 'PARTNER-MISSING' }, { clientId: 'partner-bad' })
    ).toThrowError(expect.objectContaining({ code: RELIEF_ERROR_CODES.PARTNER_NOT_VERIFIED }));
  });

  it('rate-limits public submissions and rejects PII in free text', () => {
    expect(() =>
      submitNeedReport(
        uniqueReport({ description: 'Call 9876543210 and ask for Aadhaar 4321 8765 2109 about the shelter.' }),
        citizen,
        { clientId: 'pii-client' }
      )
    ).toThrowError(expect.objectContaining({ code: RELIEF_ERROR_CODES.VALIDATION_ERROR }));

    for (let index = 0; index < 10; index += 1) {
      submitNeedReport(
        uniqueReport({
          locality: `Rate Limit Locality ${index}`,
          description: `Sanitation support needed for shelter block ${index} after the flood water receded.`,
        }),
        citizen,
        { clientId: 'rate-client' }
      );
    }
    expect(() =>
      submitNeedReport(uniqueReport({ locality: 'Rate Limit Final' }), citizen, { clientId: 'rate-client' })
    ).toThrowError(expect.objectContaining({ code: RELIEF_ERROR_CODES.RATE_LIMITED }));
  });

  it('quarantines stock with a mandatory reason and audit entry', () => {
    expect(() => quarantineResource('RES-WATER-001', { reason: '' }, operator)).toThrowError(
      expect.objectContaining({ code: RELIEF_ERROR_CODES.VALIDATION_ERROR })
    );
    const updated = quarantineResource(
      'RES-WATER-001',
      { reason: 'Packaging damaged in transit; batch withdrawn.' },
      operator
    );
    expect(updated.status).toBe('expired');

    const audit = getReliefAuditTrail({ action: 'STOCK_WRITTEN_OFF' }, reviewer);
    expect(audit.items.length).toBe(1);
    expect(audit.items[0].reason).toMatch(/damaged/i);
  });

  it('creates distribution sites with public projections', () => {
    const site = createDistributionSite(
      {
        name: 'Test Ward Relief Desk',
        address: 'Ward office annexe, Test Nagar',
        locality: 'Test Nagar',
        jurisdictionId: 'WARD-150',
        capacityPerDay: 80,
      },
      operator
    );
    expect(site.isPublic).toBe(true);
    const publicStatus = getPublicReliefStatus({ jurisdictionId: 'WARD-150' });
    expect(publicStatus.distributionSites.some((item) => item.id === site.id)).toBe(true);
  });
});
