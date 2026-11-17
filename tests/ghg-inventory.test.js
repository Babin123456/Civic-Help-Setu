import { describe, it, expect, beforeEach } from 'vitest';
import {
  createGhgInventoryHandler,
  generateGhgReceiptCode,
  resetGhgRepositoryForTests,
  validateGhgSubmissionPayload,
} from '../api/_lib/handlers/ghg-inventory.js';
import { createGhgMemoryRepository } from '../api/_lib/ghgInventoryRepository.js';
import { createRateLimiter } from '../api/_lib/abuseGuard.js';
import defaultRouteHandler from '../api/ghg-inventory.js';

const VALID_TOKEN = 'valid-session-token-123456';

let testRepo;

const operator = {
  id: 'user_operator',
  role: 'staff',
  ghgRole: 'operator',
  jurisdictionIds: ['WARD-042'],
};

const payload = (overrides = {}) => ({
  periodId: 'PER-2026-27',
  jurisdictionId: 'WARD-042',
  department: 'Solid Waste Management',
  title: 'FY 2026-27 landfill gate correction',
  idempotencyKey: 'ghg-queue-key-0001',
  correctionNotes: 'Gate total reconciled with the weighbridge log.',
  records: [
    {
      sourceId: 'SRC-WST-01',
      quantity: 7_900,
      unit: 't',
      dataQuality: 'measured',
      correctionNotes: 'Corrected gate total.',
      sourceDocument: {
        name: 'landfill-gate-fy2627.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 400_000,
        sha256: 'a'.repeat(64),
      },
    },
  ],
  ...overrides,
});

const buildHandler = ({
  actor = operator,
  verify = async (token) => {
    if (token !== VALID_TOKEN) throw new Error('invalid');
    return { userId: 'user_operator' };
  },
  resolve = async () => actor,
  summary = async ({ jurisdictionId }) => ({
    available: true,
    summary: {
      periodLabel: 'FY 2025-26',
      jurisdictionName: 'Ward 42 — Indiranagar',
      totals: { tCO2e: 5790.14, measuredTCO2e: 5790.14, estimatedTCO2e: 0 },
    },
    periods: [{ id: 'PER-2025-26', label: 'FY 2025-26' }],
    jurisdictionId,
  }),
  repository = null,
  ipLimiter = createRateLimiter({ limit: 100, windowMs: 60_000 }),
} = {}) =>
  createGhgInventoryHandler({
    verifySession: verify,
    resolveActor: resolve,
    getPublishedSummary: summary,
    repository: repository || testRepo,
    ipLimiter,
  });

const post = (handler, body = payload(), headers = {}) =>
  handler({
    method: 'POST',
    headers: { 'x-vercel-forwarded-for': '203.0.113.10', ...headers },
    body,
  });

describe('api/ghg-inventory (#753)', () => {
  beforeEach(() => {
    testRepo = createGhgMemoryRepository();
    resetGhgRepositoryForTests();
  });

  it('serves the approved public projection over GET without internal identifiers', async () => {
    const handler = buildHandler();
    const response = await handler({
      method: 'GET',
      headers: {},
      query: { jurisdictionId: 'ward-042' },
    });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.available).toBe(true);
    expect(response.body.summary.totals.tCO2e).toBe(5790.14);
    expect(JSON.stringify(response.body)).not.toMatch(/SUB-|ACT-|SRC-|EFV-/);
    expect(response.headers['Cache-Control']).toBe('no-store');
  });

  it('does not leak an unapproved projection when no public summary provider is configured', async () => {
    const handler = createGhgInventoryHandler({
      verifySession: async () => ({ userId: 'user_operator' }),
      resolveActor: async () => operator,
      ipLimiter: createRateLimiter({ limit: 100, windowMs: 60_000 }),
    });
    const response = await handler({ method: 'GET', headers: {}, query: {} });

    expect(response.status).toBe(200);
    expect(response.body.available).toBe(false);
    expect(response.body.disclosure).toContain('after a reviewer approves the period');
  });

  it('rejects unsupported methods with a 405 and an Allow header', async () => {
    const handler = buildHandler();
    const response = await handler({ method: 'DELETE', headers: {}, body: null });

    expect(response.status).toBe(405);
    expect(response.body.error).toBe('method_not_allowed');
    expect(response.headers.Allow).toBe('GET, POST');
  });

  it('requires authentication before validation or queueing', async () => {
    const handler = buildHandler();
    const missing = await post(handler, payload(), { authorization: '' });
    expect(missing.status).toBe(401);
    expect(missing.body.error).toBe('authentication_required');
    expect(await testRepo.listSubmissions()).toHaveLength(0);

    const invalid = await post(handler, payload(), { authorization: 'Bearer expired-token-12345' });
    expect(invalid.status).toBe(401);
    expect(invalid.body.error).toBe('invalid_token');
    expect(await testRepo.listSubmissions()).toHaveLength(0);
  });

  it('returns 503 when the server-side session verifier is not configured', async () => {
    const handler = createGhgInventoryHandler({
      ipLimiter: createRateLimiter({ limit: 100, windowMs: 60_000 }),
    });
    const response = await post(handler);
    expect(response.status).toBe(503);
    expect(response.body.error).toBe('auth_not_configured');
  });

  it('rejects a verified role that is not an operator or administrator', async () => {
    const handler = buildHandler({
      actor: { id: 'citizen_1', role: 'citizen', ghgRole: 'citizen', jurisdictionIds: ['WARD-042'] },
    });
    const response = await post(handler, payload(), { authorization: `Bearer ${VALID_TOKEN}` });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('forbidden_role');
    expect(await testRepo.listSubmissions()).toHaveLength(0);
  });

  it('rejects a jurisdiction outside the verified account assignment', async () => {
    const handler = buildHandler({
      actor: { ...operator, jurisdictionIds: ['WARD-084'] },
    });
    const response = await post(handler, payload(), { authorization: `Bearer ${VALID_TOKEN}` });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('jurisdiction_forbidden');
    expect(response.body.details.some((message) => message.includes('not assigned'))).toBe(true);
    expect(await testRepo.listSubmissions()).toHaveLength(0);
  });

  it('allows an administrator without a narrow assignment to submit any jurisdiction', async () => {
    const handler = buildHandler({
      actor: { id: 'admin_1', role: 'admin', ghgRole: 'admin', jurisdictionIds: [] },
    });
    const response = await post(
      handler,
      payload({ jurisdictionId: 'WARD-084' }),
      { authorization: `Bearer ${VALID_TOKEN}` }
    );

    expect(response.status).toBe(202);
    expect(response.body.receipt.jurisdictionId).toBe('WARD-084');
  });

  it('queues a valid submission with metadata-only documents and a stable receipt code', async () => {
    const handler = buildHandler();
    const response = await post(handler, payload(), { authorization: `Bearer ${VALID_TOKEN}` });

    expect(response.status).toBe(202);
    expect(response.body.ok).toBe(true);
    expect(response.body.receipt.status).toBe('queued_for_review');
    expect(response.body.receipt.recordCount).toBe(1);
    expect(response.body.receipt.receiptCode).toMatch(/^GHG-[0-9A-F]{4}-[0-9A-F]{4}$/);
    expect(response.body.help).toContain('does not affect published totals until a reviewer approves');
    
    const queued = await testRepo.listSubmissions();
    expect(queued).toHaveLength(1);

    const submission = queued[0];
    expect(submission.sourceDocument).toBeUndefined();
    expect(submission.records[0].sourceDocument.storage).toBe('metadata_only');
    expect(submission.records[0].sourceDocument.sha256).toBe('a'.repeat(64));
    expect(submission.verifiedRole).toBe('operator');
    expect(JSON.stringify(submission)).not.toContain('fileData');
    expect(JSON.stringify(submission)).not.toContain(VALID_TOKEN);
  });

  it('replays an idempotent request instead of queueing a duplicate', async () => {
    const handler = buildHandler();
    const first = await post(handler, payload(), { authorization: `Bearer ${VALID_TOKEN}` });
    const second = await post(handler, payload(), { authorization: `Bearer ${VALID_TOKEN}` });

    expect(first.status).toBe(202);
    expect(second.status).toBe(200);
    expect(second.body.replayed).toBe(true);
    expect(second.body.receipt.submissionId).toBe(first.body.receipt.submissionId);
    expect(second.body.receipt.receiptCode).toBe(first.body.receipt.receiptCode);
    expect(await testRepo.listSubmissions()).toHaveLength(1);
  });

  it('validates the payload on the trusted boundary and returns stable field errors', () => {
    const missing = validateGhgSubmissionPayload({}, operator);
    expect(missing.some((message) => message.includes('periodId'))).toBe(true);
    expect(missing.some((message) => message.includes('records'))).toBe(true);

    const badUnit = validateGhgSubmissionPayload(
      payload({ records: [{ sourceId: 'SRC-WST-01', quantity: 1, unit: 'bogus', dataQuality: 'measured' }] }),
      operator
    );
    expect(badUnit.some((message) => message.includes('unit must be one of'))).toBe(true);

    const duplicate = validateGhgSubmissionPayload(
      payload({
        records: [
          { sourceId: 'SRC-WST-01', quantity: 1, unit: 't', dataQuality: 'measured' },
          { sourceId: 'SRC-WST-01', quantity: 2, unit: 't', dataQuality: 'measured' },
        ],
      }),
      operator
    );
    expect(duplicate.some((message) => message.includes('repeats a source'))).toBe(true);

    const countedTwice = validateGhgSubmissionPayload(
      payload({
        records: [
          {
            sourceId: 'SRC-WST-01',
            quantity: 1,
            unit: 't',
            dataQuality: 'measured',
            sourceDocument: { name: 'x.pdf', fileData: 'JVBERi0xLjQK' },
          },
        ],
      }),
      operator
    );
    expect(countedTwice.some((message) => message.includes('metadata only'))).toBe(true);

    const residentData = validateGhgSubmissionPayload(
      payload({ correctionNotes: 'Call the resident on 9876543210 before publishing.' }),
      operator
    );
    expect(residentData.some((message) => message.includes('phone number'))).toBe(true);

    const undeclaredAttachment = validateGhgSubmissionPayload(
      payload({ attachment: { name: 'receipt.pdf', data: 'AAA' } }),
      operator
    );
    expect(undeclaredAttachment.some((message) => message.includes('Attachments are not accepted'))).toBe(true);
  });

  it('returns 422 for an invalid payload and does not queue it', async () => {
    const handler = buildHandler();
    const response = await post(
      handler,
      payload({ records: [] }),
      { authorization: `Bearer ${VALID_TOKEN}` }
    );

    expect(response.status).toBe(422);
    expect(response.body.error).toBe('validation_failed');
    expect(response.body.details.some((message) => message.includes('records'))).toBe(true);
    expect(await testRepo.listSubmissions()).toHaveLength(0);
  });

  it('returns 400 for malformed JSON before validation', async () => {
    const handler = buildHandler();
    const response = await post(handler, '{"periodId":', { authorization: `Bearer ${VALID_TOKEN}` });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('validation_failed');
    expect(response.body.details[0]).toContain('Malformed JSON');
  });

  it('rejects an oversized payload before authentication', async () => {
    const handler = buildHandler();
    const oversized = payload({ correctionNotes: 'x'.repeat(300 * 1024) });
    const response = await post(handler, oversized, {});

    expect(response.status).toBe(413);
    expect(response.body.error).toBe('payload_too_large');
    expect(await testRepo.listSubmissions()).toHaveLength(0);
  });

  it('rate limits repeated submissions for the same verified address', async () => {
    const handler = buildHandler({
      ipLimiter: createRateLimiter({ limit: 1, windowMs: 60_000 }),
    });
    const first = await post(handler, payload(), { authorization: `Bearer ${VALID_TOKEN}` });
    const second = await post(
      handler,
      payload({ idempotencyKey: 'ghg-queue-key-0002' }),
      { authorization: `Bearer ${VALID_TOKEN}` }
    );

    expect(first.status).toBe(202);
    expect(second.status).toBe(429);
    expect(second.body.error).toBe('rate_limited');
    expect(second.headers['Retry-After']).toBeTruthy();
    expect(await testRepo.listSubmissions()).toHaveLength(1);
  });

  it('generates a deterministic receipt code from jurisdiction, key and time', () => {
    const first = generateGhgReceiptCode('WARD-042', 'key-0001', '2026-11-17T00:00:00.000Z');
    const same = generateGhgReceiptCode('WARD-042', 'key-0001', '2026-11-17T00:00:00.000Z');
    const other = generateGhgReceiptCode('WARD-042', 'key-0002', '2026-11-17T00:00:00.000Z');

    expect(first).toBe(same);
    expect(first).not.toBe(other);
    expect(first).toMatch(/^GHG-[0-9A-F]{4}-[0-9A-F]{4}$/);
  });

  it('persists submissions across separate handler instances sharing the repository', async () => {
    const repository = createGhgMemoryRepository();
    const handlerInstance1 = buildHandler({ repository });
    const handlerInstance2 = buildHandler({ repository });

    const submissionPayload = payload({ idempotencyKey: 'shared-instance-key-1' });

    // Submit on instance 1
    const postRes1 = await post(handlerInstance1, submissionPayload, {
      authorization: `Bearer ${VALID_TOKEN}`,
    });
    expect(postRes1.status).toBe(202);
    expect(postRes1.body.ok).toBe(true);
    expect(postRes1.body.receipt.submissionId).toBeTruthy();

    // Replay on instance 2
    const postRes2 = await post(handlerInstance2, submissionPayload, {
      authorization: `Bearer ${VALID_TOKEN}`,
    });
    expect(postRes2.status).toBe(200);
    expect(postRes2.body.replayed).toBe(true);
    expect(postRes2.body.receipt.submissionId).toBe(postRes1.body.receipt.submissionId);
    expect(postRes2.body.receipt.receiptCode).toBe(postRes1.body.receipt.receiptCode);
  });

  it('detects and rejects reusing an idempotency key with a conflicting payload (409)', async () => {
    const repository = createGhgMemoryRepository();
    const handler = buildHandler({ repository });

    const initial = payload({
      idempotencyKey: 'conflict-test-key-01',
      records: [{ sourceId: 'SRC-WST-01', quantity: 100, unit: 't', dataQuality: 'measured' }],
    });
    const conflicting = payload({
      idempotencyKey: 'conflict-test-key-01',
      records: [{ sourceId: 'SRC-WST-01', quantity: 999, unit: 't', dataQuality: 'measured' }],
    });

    const first = await post(handler, initial, { authorization: `Bearer ${VALID_TOKEN}` });
    expect(first.status).toBe(202);

    const second = await post(handler, conflicting, { authorization: `Bearer ${VALID_TOKEN}` });
    expect(second.status).toBe(409);
    expect(second.body.error).toBe('idempotency_conflict');
    expect(second.body.help).toContain('already used with a different activity payload');
  });

  it('isolates idempotency keys across different municipal jurisdictions', async () => {
    const repository = createGhgMemoryRepository();
    const adminActor = { id: 'admin_super', role: 'admin', ghgRole: 'admin', jurisdictionIds: [] };
    const handler = buildHandler({ actor: adminActor, repository });

    const ward42Payload = payload({ jurisdictionId: 'WARD-042', idempotencyKey: 'multi-ward-key-1' });
    const ward84Payload = payload({ jurisdictionId: 'WARD-084', idempotencyKey: 'multi-ward-key-1' });

    const resWard42 = await post(handler, ward42Payload, { authorization: `Bearer ${VALID_TOKEN}` });
    const resWard84 = await post(handler, ward84Payload, { authorization: `Bearer ${VALID_TOKEN}` });

    expect(resWard42.status).toBe(202);
    expect(resWard84.status).toBe(202);
    expect(resWard42.body.receipt.jurisdictionId).toBe('WARD-042');
    expect(resWard84.body.receipt.jurisdictionId).toBe('WARD-084');
    expect(resWard42.body.receipt.submissionId).not.toBe(resWard84.body.receipt.submissionId);
  });

  it('returns 503 database_unavailable when shared persistence throws', async () => {
    const failingRepository = {
      recordSubmission: async () => {
        throw new Error('Connection to Firestore timed out');
      },
    };
    const handler = buildHandler({ repository: failingRepository });

    const res = await post(handler, payload({ idempotencyKey: 'db-fail-key-001' }), {
      authorization: `Bearer ${VALID_TOKEN}`,
    });

    expect(res.status).toBe(503);
    expect(res.body.error).toBe('database_unavailable');
    expect(res.body.help).toContain('could not be persisted to shared storage');
  });

  it('handles actor resolution failure with 401 invalid_token', async () => {
    const handler = buildHandler({
      resolve: async () => {
        throw new Error('Clerk user lookup error');
      },
    });

    const res = await post(handler, payload(), { authorization: `Bearer ${VALID_TOKEN}` });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid_token');
  });

  it('wires getPublishedSummary into the default route handler for approved projections', async () => {
    let capturedStatus = null;
    let capturedBody = null;
    const req = {
      method: 'GET',
      headers: {},
      query: { jurisdictionId: 'WARD-042', periodId: 'PER-2025-26' },
    };
    const res = {
      setHeader: () => {},
      status: (code) => {
        capturedStatus = code;
        return {
          json: (body) => {
            capturedBody = body;
          },
        };
      },
    };

    await defaultRouteHandler(req, res);

    expect(capturedStatus).toBe(200);
    expect(capturedBody.ok).toBe(true);
    expect(capturedBody.available).toBe(true);
    expect(capturedBody.summary.jurisdictionName).toContain('Indiranagar');
    expect(capturedBody.summary.totals.tCO2e).toBeGreaterThan(0);
    // Public responses never leak internal submission details or notes
    expect(JSON.stringify(capturedBody)).not.toMatch(/ghg_sub_|weighbridge|gate total/i);
  });

  it('serves available: false when querying an unpublished period', async () => {
    let capturedStatus = null;
    let capturedBody = null;
    const req = {
      method: 'GET',
      headers: {},
      query: { jurisdictionId: 'WARD-042', periodId: 'PER-2026-27' },
    };
    const res = {
      setHeader: () => {},
      status: (code) => {
        capturedStatus = code;
        return {
          json: (body) => {
            capturedBody = body;
          },
        };
      },
    };

    await defaultRouteHandler(req, res);

    expect(capturedStatus).toBe(200);
    expect(capturedBody.ok).toBe(true);
    expect(capturedBody.available).toBe(false);
    expect(capturedBody.reason).toContain('No approved inventory');
  });
});
