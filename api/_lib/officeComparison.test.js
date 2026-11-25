import { describe, it, expect, beforeEach } from 'vitest';
import {
  OFFICE_REPORT_QUEUE,
  OFFICE_REVIEW_AUDIT,
  createOfficeComparisonHandler,
} from './officeComparison';

const NOW = Date.parse('2026-11-18T12:00:00Z');
const adminSession = { userId: 'admin-1', role: 'admin' };

const makeHandler = () =>
  createOfficeComparisonHandler({
    verifySession: async (token) => {
      if (token === 'admin-token-123') return adminSession;
      if (token === 'citizen-token-123') return { userId: 'citizen-1', role: 'citizen' };
      throw new Error('bad token');
    },
    now: () => NOW,
  });

const validReport = {
  officeId: 'delhi-rto-sarai-kale-khan',
  reason: 'outdated_contact',
  note: 'The listed helpline is no longer in service.',
  sourceUrl: 'https://transport.delhi.gov.in/office-directory',
};

describe('office-comparison API (#824)', () => {
  beforeEach(() => {
    OFFICE_REPORT_QUEUE.length = 0;
    OFFICE_REVIEW_AUDIT.length = 0;
  });

  it('serves a deterministic, public ranking page with a data version and no raw office rows', async () => {
    const handler = makeHandler();
    const response = await handler({
      method: 'GET',
      query: { serviceId: 'driving-license', state: 'Delhi', page: '1', pageSize: '2' },
    });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.dataVersion).toBeTruthy();
    expect(response.body.generatedAt).toBe('2026-11-18T12:00:00.000Z');
    expect(response.body.service.id).toBe('driving-license');
    expect(response.body.results.length).toBeLessThanOrEqual(2);
    expect(response.body.aggregation.total).toBeGreaterThanOrEqual(response.body.results.length);
    for (const record of response.body.results) {
      expect(record).not.toHaveProperty('raw');
      expect(record.match.suggestion).toBe(true);
    }
  });

  it('returns an empty, successful page for a locality with no offices', async () => {
    const response = await makeHandler()({
      method: 'GET',
      query: { serviceId: 'driving-license', locality: 'no-such-locality-xyz' },
    });
    expect(response.status).toBe(200);
    expect(response.body.results).toEqual([]);
    expect(response.body.total).toBe(0);
    expect(response.body.totalPages).toBe(1);
  });

  it('rejects malformed queries and unknown services', async () => {
    const handler = makeHandler();
    const malformed = await handler({
      method: 'GET',
      query: { serviceId: ['driving-license'] },
    });
    expect(malformed.status).toBe(400);
    expect(malformed.body.error).toBe('validation_failed');

    const missing = await handler({ method: 'GET', query: {} });
    expect(missing.status).toBe(400);

    const unknown = await handler({ method: 'GET', query: { serviceId: 'flying-licence' } });
    expect(unknown.status).toBe(400);
    expect(unknown.body.error).toBe('validation_failed');

    const badPage = await handler({
      method: 'GET',
      query: { serviceId: 'driving-license', page: '0' },
    });
    expect(badPage.status).toBe(400);
  });

  it('keeps the review queue behind an administrator session', async () => {
    const handler = makeHandler();
    const noToken = await handler({ method: 'GET', query: { review: 'pending' } });
    expect(noToken.status).toBe(401);
    expect(noToken.body.error).toBe('missing_token');

    const citizen = await handler({
      method: 'GET',
      query: { review: 'pending' },
      headers: { authorization: 'Bearer citizen-token-123' },
    });
    expect(citizen.status).toBe(403);
    expect(citizen.body.error).toBe('admin_role_required');

    const admin = await handler({
      method: 'GET',
      query: { review: 'pending' },
      headers: { authorization: 'Bearer admin-token-123' },
    });
    expect(admin.status).toBe(200);
    expect(admin.body.items).toEqual([]);
  });

  it('returns 503 for review actions when authentication is not configured', async () => {
    const handler = createOfficeComparisonHandler({ verifySession: null });
    const response = await handler({
      method: 'GET',
      query: { review: 'pending' },
      headers: { authorization: 'Bearer admin-token-123' },
    });
    expect(response.status).toBe(503);
    expect(response.body.error).toBe('auth_not_configured');
  });

  it('accepts a valid outdated-record report with a verification seal', async () => {
    const response = await makeHandler()({ method: 'POST', body: validReport });
    expect(response.status).toBe(201);
    expect(response.body.ok).toBe(true);
    expect(response.body.status).toBe('pending_review');
    expect(response.body.verificationSeal).toMatch(/^OFFICE-SEAL-[0-9A-F]{4}-[0-9A-F]{4}$/);
    expect(OFFICE_REPORT_QUEUE).toHaveLength(1);
    expect(OFFICE_REPORT_QUEUE[0].note).toBe(validReport.note);
  });

  it('rejects malformed, sensitive and unknown-office reports', async () => {
    const handler = makeHandler();
    const malformed = await handler({ method: 'POST', body: { officeId: 'x' } });
    expect(malformed.status).toBe(400);
    expect(malformed.body.error).toBe('validation_failed');

    const sensitive = await handler({
      method: 'POST',
      body: { ...validReport, note: 'Aadhaar 1234 5678 9012' },
    });
    expect(sensitive.status).toBe(400);

    const unknown = await handler({
      method: 'POST',
      body: { ...validReport, officeId: 'not-an-office' },
    });
    expect(unknown.status).toBe(404);
    expect(unknown.body.error).toBe('office_not_found');
    expect(OFFICE_REPORT_QUEUE).toHaveLength(0);
  });

  it('records an administrator resolution in the audit trail', async () => {
    const handler = makeHandler();
    const created = await handler({ method: 'POST', body: validReport });
    const reportId = created.body.reportId;

    const forbidden = await handler({
      method: 'PATCH',
      body: { reportId, status: 'resolved' },
      headers: { authorization: 'Bearer citizen-token-123' },
    });
    expect(forbidden.status).toBe(403);

    const malformed = await handler({
      method: 'PATCH',
      body: { reportId, status: 'maybe' },
      headers: { authorization: 'Bearer admin-token-123' },
    });
    expect(malformed.status).toBe(400);

    const missing = await handler({
      method: 'PATCH',
      body: { reportId: 'no-such-report', status: 'resolved' },
      headers: { authorization: 'Bearer admin-token-123' },
    });
    expect(missing.status).toBe(404);

    const resolved = await handler({
      method: 'PATCH',
      body: { reportId, status: 'resolved', reviewNote: 'Checked the official directory.' },
      headers: { authorization: 'Bearer admin-token-123' },
    });
    expect(resolved.status).toBe(200);
    expect(resolved.body.status).toBe('resolved');
    expect(OFFICE_REPORT_QUEUE[0].status).toBe('resolved');
    expect(OFFICE_REVIEW_AUDIT).toHaveLength(1);
    expect(OFFICE_REVIEW_AUDIT[0]).toMatchObject({
      action: 'office_report_reviewed',
      reportId,
      actorId: 'admin-1',
      status: 'resolved',
    });

    const pending = await handler({
      method: 'GET',
      query: { review: 'pending' },
      headers: { authorization: 'Bearer admin-token-123' },
    });
    expect(pending.body.items).toEqual([]);
  });

  it('answers unsupported methods with 405 and an Allow header', async () => {
    const response = await makeHandler()({ method: 'DELETE' });
    expect(response.status).toBe(405);
    expect(response.headers.Allow).toBe('GET, POST, PATCH');
  });
});
