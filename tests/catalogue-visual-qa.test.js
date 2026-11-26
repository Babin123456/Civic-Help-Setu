/**
 * tests/catalogue-visual-qa.test.js
 * Unit tests for the deterministic catalogue visual QA engine (#841).
 */
import { describe, it, expect, vi } from 'vitest';
import {
  FIXTURE_ID_PREFIX,
  ISSUE_META,
  STORAGE_KEYS,
  VIEWPORT_IDS,
  VISUAL_QA_SCHEMA_VERSION,
  buildDraft,
  buildReviewSnapshot,
  buildScanRunId,
  buildVisualQaQuery,
  clearBaseline,
  clearDraft,
  compareSnapshots,
  containsCitizenData,
  detectScript,
  estimateLineCount,
  estimateTextWidth,
  flattenScanRows,
  generateFixtures,
  getCardMetrics,
  getViewport,
  hashString,
  loadBaseline,
  loadDraft,
  measureCardService,
  normalizeFilters,
  parseReviewSnapshot,
  parseVisualQaQuery,
  requestServerScan,
  requestSuggestionDecision,
  runVisualQaScan,
  saveBaseline,
  saveDraft,
  validateVisualQaFilters,
  VisualQaApiError,
} from '../src/services/catalogueVisualQaService.js';

const memoryStorage = () => {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    map,
  };
};

const fixedNow = new Date('2026-05-01T09:30:00.000Z');

describe('catalogue visual QA fixture generator (#841)', () => {
  it('is deterministic for the same seed and filters', () => {
    const first = generateFixtures({ category: 'Certificates', language: 'hi', contentLength: 'long', seed: 841 });
    const second = generateFixtures({ category: 'Certificates', language: 'hi', contentLength: 'long', seed: 841 });
    expect(first).toEqual(second);
    expect(first).toHaveLength(24);
    expect(new Set(first.map((fixture) => fixture.id)).size).toBe(24);
  });

  it('uses synthetic ids, reserved example links and no citizen data', () => {
    for (const fixture of generateFixtures({ seed: 17 })) {
      expect(fixture.id.startsWith(FIXTURE_ID_PREFIX)).toBe(true);
      expect(fixture.qa.isSynthetic).toBe(true);
      expect(fixture.qa.isProductionRecord).toBe(false);
      expect(fixture.officialSources.every((source) => source.url.startsWith('https://example.org/'))).toBe(true);
      expect(containsCitizenData(fixture)).toBe(false);
      expect(JSON.stringify(fixture)).not.toMatch(/aadhaar|password|otp/i);
    }
  });

  it('switches between short and long synthetic content', () => {
    const short = generateFixtures({ contentLength: 'short', seed: 3 })[0];
    const long = generateFixtures({ contentLength: 'long', seed: 3 })[0];
    expect(long.name.length).toBeGreaterThan(short.name.length);
    expect(short.qa.contentLength).toBe('short');
    expect(long.qa.contentLength).toBe('long');
  });

  it('generates Indic-script fixtures and translated category labels', () => {
    const hindi = generateFixtures({ language: 'hi', category: 'Certificates', seed: 2 })[0];
    expect(detectScript(hindi.name)).toBe('devanagari');
    expect(hindi.qa.categoryLabel).toBe('प्रमाण पत्र');
    expect(hindi.qa.language).toBe('hi');
  });

  it('reproducibly includes deliberate missing metadata', () => {
    const fixtures = generateFixtures({ seed: 841, count: 24 });
    expect(fixtures[4].department).toBeUndefined();
    expect(fixtures[6].processingTime).toBeUndefined();
    expect(fixtures[8].difficulty).toBeUndefined();
    expect(fixtures[3].type).toBeUndefined();
    expect(fixtures[12].name).toBeUndefined();
    expect(fixtures[14].shortDescription).toBeUndefined();
    expect(fixtures[16].category).toBeUndefined();
    expect(fixtures[4].qa.missingFields).toContain('department');
    expect(fixtures[12].qa.missingFields).toContain('name');
    expect(fixtures[14].qa.missingFields).toContain('shortDescription');
    expect(fixtures[16].qa.missingFields).toContain('category');
  });

  it('reproduces every documented issue code at a named viewport', () => {
    const observed = new Map();
    const scans = [
      { contentLength: 'short', language: 'en', seed: 841, pageSize: 6, pages: [1, 2, 3, 4] },
      { contentLength: 'short', language: 'ta', seed: 841, pageSize: 6, pages: [1, 2, 3, 4] },
      { contentLength: 'long', language: 'hi', seed: 841, pageSize: 6, pages: [1, 2, 3, 4] },
    ];
    for (const scan of scans) {
      for (const page of scan.pages) {
        const report = runVisualQaScan({
          contentLength: scan.contentLength,
          language: scan.language,
          seed: scan.seed,
          page,
          pageSize: scan.pageSize,
          viewportIds: VIEWPORT_IDS,
        });
        for (const viewport of report.viewports) {
          for (const card of viewport.cards) {
            for (const issue of card.issues) {
              if (!observed.has(issue.code)) {
                observed.set(issue.code, issue.viewport);
              }
            }
          }
        }
      }
    }

    for (const code of Object.keys(ISSUE_META)) {
      expect(observed.has(code), `expected ${code} to be reproducible at a named viewport`).toBe(true);
      expect(VIEWPORT_IDS).toContain(observed.get(code));
    }
  });
});

describe('deterministic measurements and issue detection (#841)', () => {
  it('computes named viewport card rules', () => {
    expect(getCardMetrics(getViewport('desktop'))).toMatchObject({
      cardWidth: 304,
      contentWidth: 224,
      columns: 3,
      viewportWidth: 1024,
    });
    expect(getCardMetrics(getViewport('tablet'))).toMatchObject({ cardWidth: 340, columns: 2 });
    expect(getCardMetrics(getViewport('mobile'))).toMatchObject({
      cardWidth: 350,
      contentWidth: 310,
      columns: 1,
    });
    expect(() => getCardMetrics(getViewport('watch'))).toThrow('Unknown viewport');
  });

  it('estimates script-aware text widths deterministically', () => {
    const width = estimateTextWidth('Riverside Permit', { fontSize: 20 });
    expect(estimateTextWidth('Riverside Permit', { fontSize: 20 })).toBe(width);
    expect(estimateTextWidth('नमूना नदी अनुमति', { fontSize: 20 })).toBeGreaterThan(0);
    expect(estimateTextWidth('', { fontSize: 20 })).toBe(0);
    expect(estimateLineCount('', 100, 20)).toBe(0);
    expect(detectScript('नमूना')).toBe('devanagari');
    expect(detectScript('নমুনা')).toBe('bengali');
    expect(detectScript('மாதிரி')).toBe('tamil');
    expect(detectScript('Sample')).toBe('latin');
  });

  it('measures the mobile viewport and reports overflow at the named viewport', () => {
    const fixture = generateFixtures({ contentLength: 'long', seed: 841 })[0];
    const measurements = measureCardService(fixture, 'mobile');
    expect(measurements.viewport).toBe('mobile');
    expect(measurements.title.estimatedLines).toBeGreaterThan(2);
    expect(measurements.title.longestToken).toBeGreaterThan(24);

    const report = runVisualQaScan({ contentLength: 'long', seed: 841, viewportIds: ['mobile'] });
    const issues = report.viewports[0].cards[0].issues;
    expect(issues.some((issue) => issue.code === 'TITLE_OVERFLOW')).toBe(true);
    expect(issues.some((issue) => issue.code === 'UNBREAKABLE_TOKEN')).toBe(true);
    expect(issues.every((issue) => issue.viewport === 'mobile')).toBe(true);
  });

  it('detects missing metadata and mixed-script metadata', () => {
    const report = runVisualQaScan({
      contentLength: 'short',
      language: 'hi',
      seed: 841,
      viewportIds: ['desktop'],
      pageSize: 9,
    });
    const codes = report.viewports[0].cards.flatMap((card) => card.issues.map((issue) => issue.code));
    expect(codes).toContain('MISSING_DEPARTMENT');
    expect(codes).toContain('MISSING_PROCESSING_TIME');
    expect(codes).toContain('MIXED_SCRIPT_METADATA');
  });

  it('is byte-stable for a repeated scan and scan run id', () => {
    const filters = { contentLength: 'long', language: 'bn', seed: 99, pageSize: 6, viewportIds: ['mobile', 'desktop'] };
    const first = runVisualQaScan(filters);
    const second = runVisualQaScan(filters);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.scanRunId).toBe(second.scanRunId);
    expect(first.scanRunId).toBe(buildScanRunId(filters));
    expect(first.scanRunId).toMatch(/^vqa-[0-9a-f]{8}$/);
  });

  it('matches the visual regression fixture baseline', () => {
    const report = runVisualQaScan({
      category: 'Certificates',
      language: 'hi',
      contentLength: 'long',
      seed: 841,
      pageSize: 3,
      viewportIds: ['desktop', 'tablet', 'mobile'],
    });
    const projection = report.viewports.map((viewport) => ({
      viewport: viewport.id,
      cardWidth: viewport.cardWidth,
      columns: viewport.columns,
      cards: viewport.cards.map((card) => ({
        fixtureId: card.fixtureId,
        title: card.service.name,
        suggestionStatus: card.suggestionStatus,
        titleLines: card.measurements.title.estimatedLines,
        badgeWidth: card.measurements.badges.estimatedWidth,
        issues: card.issues.map((issue) => ({
          code: issue.code,
          field: issue.field,
          severity: issue.severity,
          measured: issue.measured,
        })),
      })),
    }));
    expect(projection).toMatchSnapshot();
  });

  it('flattens one row per fixture and viewport and paginates', () => {
    const report = runVisualQaScan({ page: 1, pageSize: 6, viewportIds: ['desktop', 'mobile'] });
    const rows = flattenScanRows(report);
    expect(rows).toHaveLength(12);
    expect(rows[0].key).toContain(':desktop');
    expect(report.pagination).toMatchObject({ page: 1, pageSize: 6, total: 24, totalPages: 4 });

    const empty = runVisualQaScan({ page: 5, pageSize: 6 });
    expect(empty.pagination.empty).toBe(true);
    expect(flattenScanRows(empty)).toHaveLength(0);
  });
});

describe('filter validation and query parsing (#841)', () => {
  it('normalises unknown values instead of throwing on the client', () => {
    expect(normalizeFilters({ category: 'Nope', language: 'xx', contentLength: 'huge', seed: -4, page: 0 })).toMatchObject({
      category: 'All',
      language: 'en',
      contentLength: 'short',
      seed: 841,
      page: 1,
    });
  });

  it('returns structured validation errors for invalid scans', () => {
    expect(validateVisualQaFilters({ category: 'Nope' })[0]).toMatchObject({ field: 'category' });
    expect(validateVisualQaFilters({ language: 'xx' })[0]).toMatchObject({ field: 'language' });
    expect(validateVisualQaFilters({ viewportIds: ['mobile', 'mobile'] })[0]).toMatchObject({ field: 'viewportIds' });
    expect(validateVisualQaFilters({ viewportIds: ['watch'] })[0]).toMatchObject({ field: 'viewportIds' });
    expect(validateVisualQaFilters({ page: 0, pageSize: 99, seed: -1 })).toHaveLength(3);
  });

  it('round-trips query filters and defaults safely', () => {
    const params = buildVisualQaQuery({
      category: 'Health',
      language: 'ta',
      contentLength: 'long',
      seed: 42,
      page: 2,
      pageSize: 6,
      viewportIds: ['mobile', 'desktop'],
    });
    params.set('boxes', '0');
    const parsed = parseVisualQaQuery(params);
    expect(parsed).toMatchObject({
      category: 'Health',
      language: 'ta',
      contentLength: 'long',
      seed: 42,
      page: 2,
      pageSize: 6,
      viewportIds: ['mobile', 'desktop'],
      showBoxes: false,
    });

    const fallback = parseVisualQaQuery(new URLSearchParams('category=Nope&language=xx&seed=abc&viewport=watch'));
    expect(fallback).toMatchObject({ category: 'All', language: 'en', seed: 841 });
    expect(fallback.viewportIds).toEqual(['desktop', 'tablet', 'mobile']);
  });

  it('hashes deterministically', () => {
    expect(hashString('catalogue')).toBe(hashString('catalogue'));
    expect(hashString('catalogue')).not.toBe(hashString('catalog'));
  });
});

describe('review snapshot export and comparison (#841)', () => {
  it('exports a synthetic-only snapshot without reviewer identity', () => {
    const report = runVisualQaScan({ viewportIds: ['mobile'], pageSize: 6 });
    const snapshot = buildReviewSnapshot(report, { now: fixedNow, decisions: { 'qa-sample-all-1-title': 'confirmed' } });
    expect(snapshot.schemaVersion).toBe(VISUAL_QA_SCHEMA_VERSION);
    expect(snapshot.scanRunId).toBe(report.scanRunId);
    expect(snapshot.privacy).toMatchObject({
      syntheticOnly: true,
      containsCitizenData: false,
      productionContentIncluded: false,
      officialStatus: 'not-an-official-government-status',
    });
    expect(snapshot.checksum).toMatch(/^sha-like-[0-9a-f]{8}$/);
    expect(snapshot.snapshotId.startsWith('vqa-snap-')).toBe(true);
    expect(snapshot.decisions).toEqual({ confirmed: 1, rejected: 0 });
    expect(JSON.stringify(snapshot)).not.toMatch(/reviewerName|reviewerEmail|aadhaar/i);
    expect(parseReviewSnapshot(snapshot).ok).toBe(true);
  });

  it('is byte-stable for the same scan and export time', () => {
    const report = runVisualQaScan({ seed: 841, pageSize: 6 });
    const first = buildReviewSnapshot(report, { now: fixedNow });
    const second = buildReviewSnapshot(report, { now: fixedNow });
    expect(first).toEqual(second);
    expect(first.checksum).toBe(second.checksum);
  });

  it('rejects malformed, wrong-version and citizen-data snapshots', () => {
    const report = runVisualQaScan({ pageSize: 6 });
    const snapshot = buildReviewSnapshot(report, { now: fixedNow });
    expect(parseReviewSnapshot('{').ok).toBe(false);
    expect(parseReviewSnapshot({ ...snapshot, schemaVersion: 'old/v1' }).ok).toBe(false);
    expect(parseReviewSnapshot({ ...snapshot, rows: [{ note: '1234 5678 9012' }] }).ok).toBe(false);
    expect(parseReviewSnapshot({ ...snapshot, privacy: { syntheticOnly: false } }).ok).toBe(false);
  });

  it('compares identical, changed, added and removed rows', () => {
    const report = runVisualQaScan({ viewportIds: ['mobile'], pageSize: 6 });
    const baseline = buildReviewSnapshot(report, { now: fixedNow });
    expect(compareSnapshots(baseline, baseline)).toMatchObject({
      ok: true,
      identical: true,
      summary: { added: 0, removed: 0, changed: 0 },
    });

    const changed = {
      ...baseline,
      rows: baseline.rows.map((row, index) =>
        index === 0
          ? { ...row, issues: [...row.issues, { code: 'TITLE_OVERFLOW', severity: 'warning' }] }
          : row
      ),
    };
    const changedResult = compareSnapshots(baseline, changed);
    expect(changedResult.summary.changed).toBe(1);
    expect(changedResult.identical).toBe(false);

    const removed = { ...baseline, rows: baseline.rows.slice(1) };
    expect(compareSnapshots(baseline, removed).summary.removed).toBe(1);

    const added = {
      ...baseline,
      rows: [...baseline.rows, { ...baseline.rows[0], fixtureId: 'qa-sample-extra', viewport: 'desktop' }],
    };
    expect(compareSnapshots(baseline, added).summary.added).toBe(1);
  });
});

describe('local draft and baseline persistence (#841)', () => {
  it('round-trips only confirmed non-sensitive draft inputs', () => {
    const storage = memoryStorage();
    const draft = buildDraft({
      filters: { category: 'Health', language: 'ta', contentLength: 'long', seed: 12, page: 2, pageSize: 6 },
      viewportIds: ['mobile'],
      showBoxes: false,
      decisions: { 'qa-sample-health-1-title': 'confirmed', 'qa-sample-health-2-title': 'unknown' },
      now: fixedNow.getTime(),
    });
    expect(saveDraft(storage, draft).ok).toBe(true);
    expect(storage.map.has(STORAGE_KEYS.draft)).toBe(true);
    const loaded = loadDraft(storage, { now: fixedNow.getTime() + 1000 });
    expect(loaded.filters).toMatchObject({ category: 'Health', language: 'ta', contentLength: 'long' });
    expect(loaded.viewportIds).toEqual(['mobile']);
    expect(loaded.showBoxes).toBe(false);
    expect(loaded.decisions).toEqual({ 'qa-sample-health-1-title': 'confirmed' });
    expect(clearDraft(storage)).toBe(true);
    expect(loadDraft(storage)).toBeNull();
  });

  it('refuses drafts with citizen data, expired drafts and future drafts', () => {
    const storage = memoryStorage();
    expect(saveDraft(storage, { version: 1, note: 'citizen@example.com', containsCitizenData: false }).ok).toBe(false);

    const draft = buildDraft({ now: fixedNow.getTime() });
    expect(saveDraft(storage, draft).ok).toBe(true);
    expect(loadDraft(storage, { now: fixedNow.getTime() + 8 * 24 * 60 * 60 * 1000 })).toBeNull();
    expect(loadDraft(storage, { now: fixedNow.getTime() - 10 * 60 * 1000 })).toBeNull();
  });

  it('round-trips a screenshot baseline and rejects invalid snapshots', () => {
    const storage = memoryStorage();
    const report = runVisualQaScan({ pageSize: 6 });
    const snapshot = buildReviewSnapshot(report, { now: fixedNow });
    expect(saveBaseline(storage, snapshot).ok).toBe(true);
    expect(loadBaseline(storage, { now: fixedNow.getTime() + 1000 })?.snapshotId).toBe(snapshot.snapshotId);
    expect(saveBaseline(storage, { nope: true }).ok).toBe(false);
    expect(clearBaseline(storage)).toBe(true);
    expect(loadBaseline(storage)).toBeNull();
  });
});

describe('visual QA API client helpers (#841)', () => {
  it('requests a paginated server scan', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: { scanRunId: 'vqa-abc', totals: { issues: 0 } } }),
    }));
    const result = await requestServerScan({ category: 'Health', pageSize: 6 }, { fetchImpl });
    expect(result.scanRunId).toBe('vqa-abc');
    const url = fetchImpl.mock.calls[0][0];
    expect(url).toContain('/api/catalogue-visual-qa?');
    expect(url).toContain('action=scan');
    expect(url).toContain('category=Health');
  });

  it('surfaces structured validation errors and malformed responses', async () => {
    await expect(
      requestServerScan(
        {},
        {
          fetchImpl: async () => ({
            ok: false,
            status: 400,
            json: async () => ({
              error: { code: 'ERR_INVALID_QUERY', message: 'bad query', fields: [{ field: 'seed', reason: 'must be a number' }] },
            }),
          }),
        }
      )
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST', status: 400, fields: [], retryable: false, recoveryAction: 'edit_request' });

    await expect(
      requestServerScan(
        {},
        {
          fetchImpl: async () => ({
            ok: false,
            status: 500,
            json: async () => {
              throw new Error('not json');
            },
          }),
        }
      )
    ).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });

    await expect(
      requestServerScan(
        {},
        {
          fetchImpl: async () => {
            throw new Error('offline');
          },
        }
      )
    ).rejects.toBeInstanceOf(VisualQaApiError);
  });

  it('sanitises a suggestion reviewer note before sending it', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: { status: 'confirmed', audit: { receipt: 'VQA-1' } } }),
    }));
    const result = await requestSuggestionDecision(
      {
        fixtureId: 'qa-sample-health-1',
        suggestionId: 'qa-sample-health-1-title',
        decision: 'confirmed',
        reviewerNote: `<b>Checked</b>   synthetic${'x'.repeat(400)}`,
      },
      { fetchImpl, headers: { 'x-user-role': 'admin' } }
    );
    expect(result.audit.receipt).toBe('VQA-1');
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.reviewerNote.startsWith('Checked synthetic')).toBe(true);
    expect(body.reviewerNote.length).toBeLessThanOrEqual(300);
    expect(body.reviewerNote).not.toContain('<b>');
  });
});
