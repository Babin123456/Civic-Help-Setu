/**
 * tests/catalogue-visual-qa-api.test.js
 * Integration tests for api/_lib/handlers/catalogue-visual-qa.js (#841).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler, { __test__ } from '../api/_lib/handlers/catalogue-visual-qa.js';
import { buildReviewSnapshot, runVisualQaScan } from '../src/services/catalogueVisualQaService.js';

const adminHeaders = { 'x-user-role': 'admin', 'x-user-id': 'synthetic-reviewer' };

const createMockRes = () => ({
  statusCode: 200,
  headers: {},
  body: null,
  writableEnded: false,
  setHeader(key, value) {
    this.headers[key] = value;
  },
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(data) {
    this.body = data;
    this.writableEnded = true;
    return this;
  },
});

const run = async ({ method = 'GET', query = {}, body, headers = adminHeaders }) => {
  const req = { method, query, body, headers };
  const res = createMockRes();
  await handler(req, res);
  return res;
};

describe('api/catalogue-visual-qa endpoint (#841)', () => {
  beforeEach(() => {
    vi.stubEnv('CLERK_SECRET_KEY', '');
    vi.stubEnv('NODE_ENV', 'test');
  });

  it('requires a reviewer role', async () => {
    const anonymous = await run({ headers: {} });
    expect(anonymous.statusCode).toBe(401);
    expect(anonymous.body.error.code).toBe('ERR_AUTH_REQUIRED');

    const citizen = await run({ headers: { 'x-user-role': 'citizen' } });
    expect(citizen.statusCode).toBe(403);
    expect(citizen.body.error.code).toBe('ERR_UNAUTHORIZED');
  });

  it('returns a synthetic paginated scan with privacy metadata', async () => {
    const res = await run({ query: { category: 'Health', language: 'hi', pageSize: '6', view: 'mobile' } });
    expect(res.statusCode).toBe(200);
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(res.body.meta).toMatchObject({
      syntheticOnly: true,
      containsCitizenData: false,
      productionContentIncluded: false,
    });
    expect(res.body.data.schemaVersion).toBe('civic-catalogue-visual-qa/v1');
    expect(res.body.data.pagination).toMatchObject({ page: 1, pageSize: 6, total: 24, totalPages: 4 });
    expect(res.body.data.viewports).toHaveLength(1);
    expect(res.body.data.viewports[0].id).toBe('mobile');
    expect(res.body.data.viewports[0].cards).toHaveLength(6);
    expect(res.body.data.totals.cardScans).toBe(6);
    expect(res.body.data.issueSummary.length).toBeGreaterThan(0);
  });

  it('returns the metadata contract without scanning', async () => {
    const res = await run({ query: { action: 'metadata' } });
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toMatchObject({
      schemaVersion: 'civic-catalogue-visual-qa/v1',
      syntheticOnly: true,
      contentLengths: ['short', 'long'],
    });
    expect(res.body.data.categories[0]).toBe('All');
    expect(res.body.data.viewports).toEqual(['desktop', 'tablet', 'mobile']);
  });

  it('returns an empty page beyond the fixture range', async () => {
    const res = await run({ query: { page: '9', pageSize: '12' } });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.pagination.empty).toBe(true);
    expect(res.body.data.viewports[0].cards).toEqual([]);
  });

  it('rejects malformed and unknown query filters with structured fields', async () => {
    const res = await run({ query: { category: 'Nope', seed: 'abc', viewport: 'watch' } });
    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe('ERR_INVALID_QUERY');
    expect(res.body.error.fields.map((field) => field.field)).toEqual(
      expect.arrayContaining(['category', 'seed', 'viewportIds'])
    );

    const duplicate = await run({ query: { viewport: 'mobile,mobile' } });
    expect(duplicate.statusCode).toBe(400);
    expect(duplicate.body.error.fields.some((field) => field.reason.includes('duplicates'))).toBe(true);
  });

  it('rejects unsupported methods', async () => {
    const res = await run({ method: 'PUT' });
    expect(res.statusCode).toBe(405);
    expect(res.body.error.code).toBe('ERR_METHOD_NOT_ALLOWED');
  });

  it('rejects malformed JSON and non-object bodies', async () => {
    const malformed = await run({ method: 'POST', body: '{' });
    expect(malformed.statusCode).toBe(400);
    expect(malformed.body.error.code).toBe('ERR_MALFORMED_JSON');

    const arrayBody = await run({ method: 'POST', body: [] });
    expect(arrayBody.statusCode).toBe(400);
    expect(arrayBody.body.error.code).toBe('ERR_INVALID_BODY');
  });

  it('refuses production catalogue content and citizen identifiers', async () => {
    const production = await run({
      method: 'POST',
      body: { action: 'confirm-suggestion', services: [{ id: 'real-record' }] },
    });
    expect(production.statusCode).toBe(400);
    expect(production.body.error.code).toBe('ERR_PRODUCTION_CONTENT_PROHIBITED');

    const pii = await run({
      method: 'POST',
      body: {
        action: 'confirm-suggestion',
        fixtureId: 'qa-sample-health-1',
        suggestionId: 'qa-sample-health-1-title',
        decision: 'confirmed',
        reviewerNote: 'Call 9876543210 or email citizen@example.com',
      },
    });
    expect(pii.statusCode).toBe(400);
    expect(pii.body.error.code).toBe('ERR_PII_PROHIBITED');
  });

  it('validates and previews an export snapshot with an audit receipt', async () => {
    const filters = { category: 'Health', language: 'ta', contentLength: 'long', pageSize: 6, viewport: 'mobile' };
    const res = await run({
      method: 'POST',
      body: {
        action: 'export-snapshot',
        filters,
        decisions: { 'qa-sample-health-1-title': 'confirmed' },
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.snapshot.schemaVersion).toBe('civic-catalogue-visual-qa/v1');
    expect(res.body.data.snapshot.privacy.syntheticOnly).toBe(true);
    expect(res.body.data.snapshot.rows).toHaveLength(6);
    expect(res.body.data.audit).toMatchObject({
      action: 'CATALOGUE_VISUAL_QA_SNAPSHOT_EXPORTED',
      actorRole: 'admin',
      containsCitizenData: false,
    });
    expect(res.body.data.audit.receipt).toMatch(/^VQA-[0-9A-F]{8}$/);

    const invalid = await run({
      method: 'POST',
      body: { action: 'export-snapshot', filters: { category: 'Nope', pageSize: 6 } },
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.body.error.code).toBe('ERR_INVALID_FILTERS');
  });

  it('accepts a valid suggestion decision and refuses an invalid one', async () => {
    const accepted = await run({
      method: 'POST',
      body: {
        action: 'confirm-suggestion',
        fixtureId: 'qa-sample-health-1',
        suggestionId: 'qa-sample-health-1-title',
        decision: 'confirmed',
        reviewerNote: 'Synthetic layout check only.',
      },
    });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.body.data).toMatchObject({
      fixtureId: 'qa-sample-health-1',
      suggestionId: 'qa-sample-health-1-title',
      status: 'confirmed',
      reviewedByRole: 'admin',
      noteStored: false,
      fixtureOnly: true,
    });
    expect(accepted.body.data.audit.action).toBe('VISUAL_QA_SUGGESTION_CONFIRMED');

    const rejected = await run({
      method: 'POST',
      body: {
        action: 'confirm-suggestion',
        fixtureId: 'not-a-fixture',
        suggestionId: 'prod-service-title',
        decision: 'maybe',
        reviewerNote: 'x',
      },
    });
    expect(rejected.statusCode).toBe(400);
    expect(rejected.body.error.code).toBe('ERR_INVALID_SUGGESTION_DECISION');
    expect(rejected.body.error.fields).toHaveLength(4);
  });

  it('rejects an unknown POST action', async () => {
    const res = await run({ method: 'POST', body: { action: 'delete-everything' } });
    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe('ERR_INVALID_ACTION');
  });
});

describe('catalogue visual QA server validation helpers (#841)', () => {
  it('normalises defaults and reports the shared filter errors', () => {
    const { filters, errors } = __test__.readAndValidateFilters({ viewport: 'mobile,desktop' });
    expect(errors).toEqual([]);
    expect(filters).toMatchObject({
      category: 'All',
      language: 'en',
      contentLength: 'short',
      seed: 841,
      page: 1,
      pageSize: 9,
    });
    expect(filters.viewportIds).toEqual(['mobile', 'desktop']);
  });

  it('validates decision maps and drops unsafe keys', () => {
    const { decisions, errors } = __test__.validateDecisionMap({
      'qa-sample-health-1-title': 'confirmed',
      '../etc/passwd': 'confirmed',
      'qa-sample-health-2-title': 'maybe',
    });
    expect(decisions).toEqual({ 'qa-sample-health-1-title': 'confirmed' });
    expect(errors).toHaveLength(2);
    expect(errors[0].field).toBe('decisions.../etc/passwd');
  });

  it('keeps exported row keys and totals stable for the same scan', () => {
    const report = runVisualQaScan({ pageSize: 6, viewportIds: ['mobile'] });
    const first = buildReviewSnapshot(report, { now: new Date('2026-01-01T00:00:00.000Z') });
    const second = buildReviewSnapshot(report, { now: new Date('2026-01-01T00:00:00.000Z') });
    expect(first.rows).toEqual(second.rows);
    expect(first.checksum).toBe(second.checksum);
  });
});
