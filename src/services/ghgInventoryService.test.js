import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  changePeriodStatus,
  createReportingPeriod,
  createSubmission,
  decideRecommendation,
  evaluateCalculationStaleness,
  exportInventory,
  exportInventoryCsv,
  generateRecommendations,
  getInventorySummary,
  getPeriodComparison,
  getPublicInventorySummary,
  getSubmissionDetail,
  listAuditEvents,
  listCalculationRuns,
  listEmissionSources,
  listFactorCatalog,
  listPublicPeriods,
  listRecommendations,
  listReportingPeriods,
  listSubmissions,
  publishFactorVersion,
  reviewSubmission,
  runPeriodCalculation,
  submitSubmission,
} from './ghgInventoryService.js';
import { ensureGhgInventory, rollbackGhgStorage } from './ghgInventoryMigrations.js';
import { GHG_ERROR_CODES } from './ghgInventoryConstants.js';
import { GhgInventoryError } from './ghgInventoryValidation.js';

const admin = { id: 'admin-1', username: 'InventoryAdmin', role: 'admin' };
const reviewer = {
  id: 'reviewer-1',
  username: 'ReviewerWard42',
  role: 'staff',
  ghgRole: 'reviewer',
  jurisdictionId: 'WARD-042',
};
const operator = {
  id: 'operator-1',
  username: 'OperatorWard42',
  role: 'staff',
  ghgRole: 'operator',
  jurisdictionId: 'WARD-042',
};
const citizen = { id: 'citizen-1', role: 'citizen' };

const expectGhgError = (fn, code) => {
  try {
    fn();
    throw new Error(`Expected GhgInventoryError ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(GhgInventoryError);
    expect(error.code).toBe(code);
  }
};

const submissionPayload = (overrides = {}) => ({
  periodId: 'PER-2026-27',
  jurisdictionId: 'WARD-042',
  title: 'FY 2026-27 landfill gate correction',
  department: 'Solid Waste Management',
  idempotencyKey: `test-key-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  correctionNotes: 'Gate meter reading reconciled with the weighbridge log.',
  records: [
    {
      sourceId: 'SRC-WST-01',
      quantity: 7_900,
      unit: 't',
      dataQuality: 'measured',
      correctionNotes: 'Corrected gate total.',
      sourceDocument: {
        name: 'landfill-gate-h1-fy2627.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 400_000,
      },
    },
  ],
  ...overrides,
});

describe('GHG inventory service (#753)', () => {
  beforeEach(() => {
    const store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
      clear: () => store.clear(),
    });
    rollbackGhgStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists scoped periods and submission counts for staff', () => {
    const periods = listReportingPeriods(operator);
    expect(periods).toHaveLength(3);
    expect(periods[0].id).toBe('PER-2026-27');
    expect(periods[0].submissionCount).toBe(4);
    expect(periods.find((period) => period.id === 'PER-2026-27').pendingReviews).toBe(2);
    expectGhgError(() => listReportingPeriods(citizen), GHG_ERROR_CODES.PERMISSION_DENIED);
  });

  it('summarises approved data without mixing unapproved rows', () => {
    const summary = getInventorySummary('PER-2025-26', reviewer);
    expect(summary.totals.tCO2e).toBe(5790.14);
    expect(summary.totals.measuredTCO2e).toBe(5790.14);
    expect(summary.lines).toHaveLength(6);
    expect(summary.byCategory).toHaveLength(4);
    expect(summary.missingSources).toHaveLength(0);
    expect(summary.isStale).toBe(false);

    const open = getInventorySummary('PER-2026-27', reviewer);
    expect(open.totals.tCO2e).toBe(296.7);
    expect(open.lines).toHaveLength(1);
    expect(open.isStale).toBe(true);
    expect(open.staleReason).toContain('changed after this calculation');
    expect(open.missingSources.map((source) => source.id)).toEqual(
      expect.arrayContaining(['SRC-BLD-01', 'SRC-FLT-01', 'SRC-FLT-02', 'SRC-LGT-01', 'SRC-WST-01'])
    );
  });

  it('creates an idempotent draft, submits it, approves it and runs a reproducible calculation', () => {
    const payload = submissionPayload();
    const draft = createSubmission(payload, operator);
    expect(draft).toMatchObject({
      status: 'draft',
      department: 'Solid Waste Management',
      recordCount: 1,
      idempotent: false,
    });
    expect(draft.records[0].dataQuality).toBe('measured');
    expect(draft.records[0].formula).toContain('tCO2e/t');

    const replay = createSubmission(payload, operator);
    expect(replay.id).toBe(draft.id);
    expect(replay.idempotent).toBe(true);
    expect(
      ensureGhgInventory().departmentSubmissions.filter(
        (submission) => submission.idempotencyKey === payload.idempotencyKey
      )
    ).toHaveLength(1);

    const submitted = submitSubmission(draft.id, operator);
    expect(submitted.status).toBe('submitted');
    expect(submitted.submittedAt).toBeTruthy();

    expectGhgError(
      () =>
        reviewSubmission(draft.id, 'approve', {}, reviewer),
      GHG_ERROR_CODES.INVALID_STATE_TRANSITION
    );

    const underReview = reviewSubmission(draft.id, 'start_review', {}, reviewer);
    expect(underReview.status).toBe('under_review');
    const approved = reviewSubmission(draft.id, 'approve', {}, reviewer);
    expect(approved.status).toBe('approved');
    expect(approved.records.every((record) => record.status === 'validated')).toBe(true);

    const run = runPeriodCalculation(
      { periodId: 'PER-2026-27', idempotencyKey: 'run-test-key-001' },
      reviewer
    );
    expect(run.status).toBe('completed');
    expect(run.totals.tCO2e).toBe(4246.7);
    expect(run.outputHash).toMatch(/^ghg-fnv1a64:[0-9a-f]{16}$/);
    expect(run.activityRecordIds).toHaveLength(2);

    const replayRun = runPeriodCalculation(
      { periodId: 'PER-2026-27', idempotencyKey: 'run-test-key-001' },
      reviewer
    );
    expect(replayRun.idempotent).toBe(true);
    expect(replayRun.id).toBe(run.id);

    const runs = listCalculationRuns('PER-2026-27', reviewer);
    expect(runs[0].status).toBe('completed');
    expect(runs.filter((item) => item.status === 'superseded')).toHaveLength(1);
  });

  it('enforces role separation for submission and review actions', () => {
    expectGhgError(
      () => createSubmission(submissionPayload(), reviewer),
      GHG_ERROR_CODES.PERMISSION_DENIED
    );
    expectGhgError(
      () => reviewSubmission('SUB-2627-FLEET', 'approve', {}, operator),
      GHG_ERROR_CODES.PERMISSION_DENIED
    );
    expectGhgError(
      () => runPeriodCalculation({ periodId: 'PER-2026-27' }, citizen),
      GHG_ERROR_CODES.PERMISSION_DENIED
    );
    expectGhgError(
      () => getSubmissionDetail('SUB-2627-FLEET', citizen),
      GHG_ERROR_CODES.PERMISSION_DENIED
    );
  });

  it('rejects duplicate active source rows and cross-jurisdiction writes', () => {
    const payload = submissionPayload();
    expectGhgError(
      () =>
        createSubmission(
          {
            ...payload,
            records: [payload.records[0], { ...payload.records[0], quantity: 10 }],
          },
          operator
        ),
      GHG_ERROR_CODES.VALIDATION_ERROR
    );

    expectGhgError(
      () =>
        createSubmission(
          { ...payload, jurisdictionId: 'WARD-084', idempotencyKey: 'cross-jurisdiction-key' },
          operator
        ),
      GHG_ERROR_CODES.JURISDICTION_DENIED
    );

    // SRC-BLD-01 already has an active record in an open review submission.
    expectGhgError(
      () =>
        createSubmission(
          {
            ...payload,
            idempotencyKey: 'conflict-record-key',
            records: [{ ...payload.records[0], sourceId: 'SRC-BLD-01', unit: 'kWh', quantity: 10 }],
          },
          operator
        ),
      GHG_ERROR_CODES.IDEMPOTENCY_CONFLICT
    );
  });

  it('keeps the period and submission state machines explicit', () => {
    const draft = createSubmission(submissionPayload(), operator);
    expectGhgError(
      () => reviewSubmission(draft.id, 'lock', {}, reviewer),
      GHG_ERROR_CODES.INVALID_STATE_TRANSITION
    );

    const submitted = submitSubmission(draft.id, operator);
    expect(submitted.status).toBe('submitted');

    expectGhgError(
      () => reviewSubmission(draft.id, 'reject', { reason: 'short' }, reviewer),
      GHG_ERROR_CODES.VALIDATION_ERROR
    );
    expectGhgError(
      () => changePeriodStatus('PER-2026-27', 'locked', { reason: 'Publish the annual inventory.' }, admin),
      GHG_ERROR_CODES.INVALID_STATE_TRANSITION
    );

    const underReview = reviewSubmission(draft.id, 'start_review', {}, reviewer);
    expect(underReview.status).toBe('under_review');
  });

  it('calculates category comparisons between two approved periods', () => {
    const comparison = getPeriodComparison(
      { periodId: 'PER-2025-26', comparisonPeriodId: 'PER-2024-25' },
      reviewer
    );
    expect(comparison.current.totals.tCO2e).toBe(5790.14);
    expect(comparison.previous.totals.tCO2e).toBe(201.804);
    expect(comparison.totalChange.deltaTCO2e).toBe(5588.336);
    expect(comparison.comparison.length).toBeGreaterThan(0);
    expect(comparison.comparison.find((row) => row.category === 'waste_operations')).toMatchObject({
      currentTCO2e: 3700,
      previousTCO2e: 0,
      percentChange: null,
    });
  });

  it('protects measured data from a proposed estimate and records the human decision', () => {
    const draft = createSubmission(
      submissionPayload({
        title: 'Draft fire fleet diesel measurement',
        records: [
          {
            sourceId: 'SRC-FLT-02',
            quantity: 18_800,
            unit: 'L',
            dataQuality: 'measured',
          },
        ],
      }),
      operator
    );
    expect(draft.records[0].sourceId).toBe('SRC-FLT-02');

    expectGhgError(
      () =>
        decideRecommendation(
          'REC-2627-FLT02',
          'accept',
          { reason: 'Accept the historical average for the missing source.' },
          reviewer
        ),
      GHG_ERROR_CODES.MEASURED_DATA_PROTECTED
    );

    const rejected = decideRecommendation(
      'REC-2627-FLT02',
      'reject',
      { reason: 'A measured reading is expected from the fire depot this week.' },
      reviewer
    );
    expect(rejected.recommendation.status).toBe('rejected');
    expect(rejected.auditEventId).toMatch(/^AUD-/);
    expectGhgError(
      () =>
        decideRecommendation(
          'REC-2627-FLT02',
          'accept',
          { reason: 'Try to accept a rejected recommendation now.' },
          reviewer
        ),
      GHG_ERROR_CODES.INVALID_STATE_TRANSITION
    );
  });

  it('accepts an estimate as a separately labelled record and never overwrites measured history', () => {
    const result = decideRecommendation(
      'REC-2627-FLT02',
      'accept',
      { reason: 'Historical average is acceptable until the depot meter is installed.' },
      reviewer
    );
    expect(result.recommendation.status).toBe('accepted');
    expect(result.message).toContain('labelled estimated');

    const data = ensureGhgInventory();
    const estimatedRecord = data.activityRecords.find(
      (record) => record.sourceId === 'SRC-FLT-02' && record.periodId === 'PER-2026-27'
    );
    expect(estimatedRecord.dataQuality).toBe('estimated');
    expect(estimatedRecord.correctionNotes).toContain('Estimated from recommendation');
    const measuredHistory = data.activityRecords.filter(
      (record) => record.sourceId === 'SRC-FLT-02' && record.periodId !== 'PER-2026-27'
    );
    expect(measuredHistory).toHaveLength(2);
    expect(measuredHistory.every((record) => record.dataQuality === 'measured')).toBe(true);

    const summary = getInventorySummary('PER-2026-27', reviewer);
    expect(summary.totals.estimatedTCO2e).toBe(47.436);
    expect(summary.totals.measuredTCO2e).toBe(296.7);
    expect(summary.totals.tCO2e).toBe(344.136);
  });

  it('generates deterministic estimates only for sources without current activity', () => {
    decideRecommendation(
      'REC-2627-FLT02',
      'reject',
      { reason: 'Start from a clean recommendation run for this test case.' },
      reviewer
    );
    const result = generateRecommendations({ periodId: 'PER-2026-27' }, reviewer);
    expect(result.created.length).toBeGreaterThanOrEqual(1);
    const fire = result.created.find((item) => item.sourceId === 'SRC-FLT-02');
    expect(fire).toMatchObject({
      method: 'historical_average',
      rulesetVersion: 'ghg-forecast-rules-2026.1',
      estimatedQuantity: 17_700,
      status: 'pending',
    });
    expect(fire.explanation).toContain('labelled estimated');
    expect(result.skipped.some((item) => item.reason === 'measured_or_submitted_data_present')).toBe(true);
    expect(listRecommendations({ periodId: 'PER-2026-27' }, reviewer).items.length).toBeGreaterThan(1);
  });

  it('publishes an immutable factor version without rewriting historical windows', () => {
    expectGhgError(
      () =>
        publishFactorVersion(
          'EF-DIESEL',
          {
            factorValue: 0.0026,
            effectiveFrom: '2026-07-01',
            changeNote: 'Updated diesel factor for the second half of FY 2026-27.',
            uncertaintyPercent: 5,
          },
          reviewer
        ),
      GHG_ERROR_CODES.PERMISSION_DENIED
    );

    const published = publishFactorVersion(
      'EF-DIESEL',
      {
        factorValue: 0.0026,
        effectiveFrom: '2026-07-01',
        changeNote: 'Updated diesel factor for the second half of FY 2026-27.',
        uncertaintyPercent: 5,
      },
      admin
    );
    expect(published.version.versionNumber).toBe(2);
    expect(published.version.factorValue).toBe(0.0026);
    expect(published.version.status).toBe('published');

    const data = ensureGhgInventory();
    const previous = data.factorVersions.find((version) => version.id === 'EFV-DIESEL-1');
    expect(previous.effectiveTo).toBe('2026-06-30');
    expect(previous.status).toBe('published');
    expect(data.emissionFactors.find((factor) => factor.id === 'EF-DIESEL').currentVersionId).toBe(
      published.version.id
    );
    const catalog = listFactorCatalog(reviewer);
    expect(catalog.factors.find((factor) => factor.id === 'EF-DIESEL').versions).toHaveLength(2);
  });

  it('creates and transitions reporting periods with overlap protection', () => {
    expectGhgError(
      () =>
        createReportingPeriod(
          {
            jurisdictionId: 'WARD-042',
            label: 'FY 2026-27 duplicate',
            startDate: '2026-10-01',
            endDate: '2027-03-31',
          },
          admin
        ),
      GHG_ERROR_CODES.VALIDATION_ERROR
    );

    const created = createReportingPeriod(
      {
        jurisdictionId: 'WARD-042',
        label: 'FY 2027-28',
        startDate: '2027-04-01',
        endDate: '2028-03-31',
      },
      admin
    );
    expect(created.period.status).toBe('draft');
    const opened = changePeriodStatus(created.period.id, 'open', {}, admin);
    expect(opened.period.status).toBe('open');
    expectGhgError(
      () => changePeriodStatus(created.period.id, 'open', {}, reviewer),
      GHG_ERROR_CODES.PERMISSION_DENIED
    );
  });

  it('exports only approved, source-linked periods and provides CSV', () => {
    expectGhgError(
      () => exportInventory('PER-2026-27', admin),
      GHG_ERROR_CODES.INVALID_STATE_TRANSITION
    );

    const exported = exportInventory('PER-2025-26', reviewer);
    expect(exported.period.label).toBe('FY 2025-26');
    expect(exported.totals.tCO2e).toBe(5790.14);
    expect(exported.lines).toHaveLength(6);
    expect(exported.generatedByRole).toBe('reviewer');
    expect(JSON.stringify(exported)).not.toContain('reviewer.ward42');
    expect(exported.lines[0].activity.sourceDocument.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(exported.contentDigest).toMatch(/^ghg-fnv1a64:/);

    const csv = exportInventoryCsv(exported);
    expect(csv.split('\n')).toHaveLength(7);
    expect(csv).toContain('record_id,source,department,category');
    expect(csv).toContain('tCO2e');

    expectGhgError(() => exportInventoryCsv(null), GHG_ERROR_CODES.VALIDATION_ERROR);
  });

  it('publishes only approved aggregate data and hides internal identifiers', () => {
    expect(listPublicPeriods()).toHaveLength(2);
    const publicData = getPublicInventorySummary();
    expect(publicData.available).toBe(true);
    expect(publicData.summary.periodLabel).toBe('FY 2025-26');
    expect(publicData.summary.totals.tCO2e).toBe(5790.14);
    const text = JSON.stringify(publicData);
    expect(text).not.toMatch(/SUB-|ACT-|SRC-|EFV-/);
    expect(text).not.toContain('reviewer.ward42');
    expect(text).not.toContain('landfill-gate');

    const openPeriod = getPublicInventorySummary({ periodId: 'PER-2026-27' });
    expect(openPeriod.available).toBe(false);
    expect(openPeriod.reason).toContain('No approved inventory');
  });

  it('records and scopes the append-only audit trail', () => {
    expectGhgError(() => listAuditEvents({}, operator), GHG_ERROR_CODES.PERMISSION_DENIED);
    const before = listAuditEvents({ pageSize: 100 }, reviewer);
    expect(before.total).toBeGreaterThanOrEqual(2);
    expect(before.items[0].id).toBeTruthy();

    reviewSubmission(
      'SUB-2627-FLEET',
      'start_review',
      {},
      reviewer
    );
    const after = listAuditEvents({ pageSize: 100 }, reviewer);
    expect(after.total).toBe(before.total + 1);
    expect(after.items[0].action).toBe('submission.start_review');
    expect(after.items[0].actorRole).toBe('reviewer');
  });

  it('detects stale calculations from the approved-record timestamps', () => {
    expect(evaluateCalculationStaleness(ensureGhgInventory(), 'PER-2025-26').isStale).toBe(false);
    const stale = evaluateCalculationStaleness(ensureGhgInventory(), 'PER-2026-27');
    expect(stale.isStale).toBe(true);
    expect(stale.latestRun.id).toBe('RUN-2627-FACILITIES');
  });

  it('validates pagination and list filters on the boundary', () => {
    const sources = listEmissionSources({ page: 1, pageSize: 1000 }, operator);
    expect(sources.pageSize).toBe(100);
    expect(sources.items).toHaveLength(6);

    const fleet = listSubmissions({ periodId: 'PER-2026-27', status: 'all', pageSize: 100 }, reviewer);
    expect(fleet.items.length).toBe(4);
    const submitted = listSubmissions(
      { periodId: 'PER-2026-27', status: 'submitted' },
      reviewer
    );
    expect(submitted.items).toHaveLength(1);
    expect(submitted.items[0].id).toBe('SUB-2627-FLEET');

    expectGhgError(
      () => listSubmissions({ status: 'not-a-status' }, reviewer),
      GHG_ERROR_CODES.VALIDATION_ERROR
    );
  });
});
