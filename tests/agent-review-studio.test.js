import { describe, it, expect, beforeEach } from 'vitest';
import defaultHandler, {
  createAgentReviewStudioHandler,
  AGENT_REVIEW_STORE,
  AGENT_REVIEW_AUDIT_LOG,
} from '../api/_lib/handlers/agent-review-studio.js';
import {
  SYNTHETIC_PROPOSAL_BIRTH_FEE,
  SYNTHETIC_PROPOSAL_WITH_PII,
  SYNTHETIC_PROPOSAL_AUTONOMOUS_CLAIM,
} from '../src/test/fixtures/agentReviewFixtures.js';

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

const verifiedHandler = createAgentReviewStudioHandler({
  verifyActor: async (req) => {
    const token = req.headers?.authorization;
    if (!token) return { ok: false, status: 401, error: 'Authentication required.' };
    if (token === 'Bearer admin-token') return { ok: true, actorId: 'admin-1', role: 'admin' };
    if (token === 'Bearer citizen-token') return { ok: true, actorId: 'citizen-1', role: 'citizen' };
    return { ok: false, status: 401, error: 'Invalid token.' };
  },
});

describe('/api/agent-review-studio handler (#1150)', () => {
  beforeEach(() => {
    AGENT_REVIEW_STORE.clear();
    AGENT_REVIEW_AUDIT_LOG.length = 0;
  });

  it('never trusts spoofed role headers when no verified bearer token is present', async () => {
    const resSpoof = createMockRes();
    await defaultHandler({ method: 'GET', headers: { 'x-civic-role': 'admin' } }, resSpoof);
    expect(resSpoof.statusCode).toBe(401);
  });

  it('enforces authentication and admin RBAC boundaries', async () => {
    const resUnauth = createMockRes();
    await verifiedHandler({ method: 'GET', headers: {} }, resUnauth);
    expect(resUnauth.statusCode).toBe(401);

    const resCitizenGet = createMockRes();
    await verifiedHandler(
      { method: 'GET', headers: { authorization: 'Bearer citizen-token' } },
      resCitizenGet
    );
    expect(resCitizenGet.statusCode).toBe(403);

    const resCitizenPatch = createMockRes();
    await verifiedHandler(
      { method: 'PATCH', headers: { authorization: 'Bearer citizen-token' }, body: { id: 'rev-1' } },
      resCitizenPatch
    );
    expect(resCitizenPatch.statusCode).toBe(403);
  });

  it('rejects untrusted payloads with PII or autonomous action claims', async () => {
    const resPii = createMockRes();
    await verifiedHandler(
      { method: 'POST', headers: { authorization: 'Bearer citizen-token' }, body: SYNTHETIC_PROPOSAL_WITH_PII },
      resPii
    );
    expect(resPii.statusCode).toBe(400);

    const resAuto = createMockRes();
    await verifiedHandler(
      { method: 'POST', headers: { authorization: 'Bearer admin-token' }, body: SYNTHETIC_PROPOSAL_AUTONOMOUS_CLAIM },
      resAuto
    );
    expect(resAuto.statusCode).toBe(400);
  });

  it('handles submission, idempotent retry, approval, silent-regen block, stale version 409, and fork', async () => {
    const resCreate = createMockRes();
    await verifiedHandler(
      {
        method: 'POST',
        headers: { authorization: 'Bearer admin-token' },
        body: { ...SYNTHETIC_PROPOSAL_BIRTH_FEE, idempotencyKey: 'api-idem-1' },
      },
      resCreate
    );
    expect(resCreate.statusCode).toBe(201);
    const createdId = resCreate.body.item.id;

    const resRetry = createMockRes();
    await verifiedHandler(
      {
        method: 'POST',
        headers: { authorization: 'Bearer admin-token' },
        body: { ...SYNTHETIC_PROPOSAL_BIRTH_FEE, idempotencyKey: 'api-idem-1' },
      },
      resRetry
    );
    expect(resRetry.statusCode).toBe(200);
    expect(resRetry.body.item.id).toBe(createdId);

    const resStale = createMockRes();
    await verifiedHandler(
      {
        method: 'PATCH',
        headers: { authorization: 'Bearer admin-token' },
        body: {
          id: createdId,
          decision: 'approve',
          expectedVersion: 99,
          rationale: 'Stale version check test.',
        },
      },
      resStale
    );
    expect(resStale.statusCode).toBe(409);
    expect(resStale.body.code).toBe('VERSION_CONFLICT');

    const resApprove = createMockRes();
    await verifiedHandler(
      {
        method: 'PATCH',
        headers: { authorization: 'Bearer admin-token' },
        body: {
          id: createdId,
          decision: 'approve',
          expectedVersion: 1,
          rationale: 'Verified statutory 21-day rule on crsorgi.gov.in.',
        },
      },
      resApprove
    );
    expect(resApprove.statusCode).toBe(200);
    expect(resApprove.body.item.status).toBe('approved');

    const resRegen = createMockRes();
    await verifiedHandler(
      {
        method: 'PATCH',
        headers: { authorization: 'Bearer admin-token' },
        body: { id: createdId, action: 'regenerate' },
      },
      resRegen
    );
    expect(resRegen.statusCode).toBe(409);
    expect(resRegen.body.code).toBe('SILENT_REGEN_FORBIDDEN');

    const resFork = createMockRes();
    await verifiedHandler(
      {
        method: 'POST',
        headers: { authorization: 'Bearer admin-token' },
        body: { action: 'fork', id: createdId, rationale: 'New gazette update requires re-review.' },
      },
      resFork
    );
    expect(resFork.statusCode).toBe(201);
    expect(resFork.body.item.version).toBe(3);
    expect(resFork.body.item.status).toBe('pending_review');

    // Superseded v1/v2 item must also reject further in-place decisions
    const resSuperseded = createMockRes();
    await verifiedHandler(
      {
        method: 'PATCH',
        headers: { authorization: 'Bearer admin-token' },
        body: {
          id: createdId,
          decision: 'reject',
          expectedVersion: 2,
          rationale: 'Attempt to mutate superseded record.',
        },
      },
      resSuperseded
    );
    expect(resSuperseded.statusCode).toBe(409);
    expect(resSuperseded.body.code).toBe('SILENT_REGEN_FORBIDDEN');
  });
});
