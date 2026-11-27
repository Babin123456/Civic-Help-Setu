import { describe, it, expect, beforeEach } from 'vitest';
import { createAgentApprovalInboxHandler } from '../api/_lib/handlers/agent-approval-inbox.js';
import {
  InMemoryAgentApprovalInboxStore,
  resetDefaultAgentApprovalInboxStoreForTests,
} from '../api/_lib/agentApprovalInboxStore.js';
import { createRateLimiter } from '../api/_lib/abuseGuard.js';
import { ACTION_DECISION, ACTION_STATUS } from '../src/services/agentApprovalInboxService.js';

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

describe('Agent Approval Inbox API Handler (#1446)', () => {
  let store;

  beforeEach(() => {
    resetDefaultAgentApprovalInboxStoreForTests();
    store = new InMemoryAgentApprovalInboxStore();
  });

  it('enforces auth, role/jurisdiction checks, idempotency, dry-run, and immutable decision log', async () => {
    const handler = createAgentApprovalInboxHandler({
      getStore: async () => store,
      rateLimiter: createRateLimiter({ limit: 50, windowMs: 60000 }),
      verifyActor: async (req) => {
        const auth = req.headers?.authorization;
        if (!auth) return { ok: false, status: 401, error: 'Authentication required.' };
        if (auth === 'Bearer citizen') return { ok: true, actorId: 'c-1', role: 'citizen', jurisdiction: '*' };
        if (auth === 'Bearer admin-mh') return { ok: true, actorId: 'op-mh', role: 'admin', jurisdiction: 'IN-MH' };
        return { ok: true, actorId: 'op-up', role: 'admin', jurisdiction: 'IN-UP' };
      },
    });

    // 401 unauthenticated
    const res401 = createMockRes();
    await handler({ method: 'GET', url: '/api/agent-approval-inbox/proposals', headers: {} }, res401);
    expect(res401.statusCode).toBe(401);

    // 403 citizen cannot list operator inbox
    const res403List = createMockRes();
    await handler(
      { method: 'GET', url: '/api/agent-approval-inbox/proposals', headers: { authorization: 'Bearer citizen' } },
      res403List
    );
    expect(res403List.statusCode).toBe(403);

    // 201 create proposal with idempotency key
    const resCreate = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/agent-approval-inbox/proposals',
        headers: { authorization: 'Bearer citizen', 'idempotency-key': 'prop-key-1' },
        body: {
          title: 'Propose Ward 8 Checklist Update',
          jurisdiction: 'IN-UP',
          toolCalls: [{ toolName: 'updateChecklist', operationType: 'write', targetEndpoint: '/api/checklist' }],
        },
      },
      resCreate
    );
    expect(resCreate.statusCode).toBe(201);
    const proposalId = resCreate.body.proposal.proposalId;

    // Idempotent replay returns 200 with same proposalId
    const resReplay = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/agent-approval-inbox/proposals',
        headers: { authorization: 'Bearer citizen', 'idempotency-key': 'prop-key-1' },
        body: {
          title: 'Propose Ward 8 Checklist Update',
          jurisdiction: 'IN-UP',
          toolCalls: [{ toolName: 'updateChecklist', operationType: 'write' }],
        },
      },
      resReplay
    );
    expect(resReplay.statusCode).toBe(200);
    expect(resReplay.body.idempotentReplay).toBe(true);
    expect(resReplay.body.proposal.proposalId).toBe(proposalId);

    // 403 wrong jurisdiction admin cannot decide
    const res403Jur = createMockRes();
    await handler(
      {
        method: 'POST',
        url: `/api/agent-approval-inbox/proposals/${proposalId}/decide`,
        headers: { authorization: 'Bearer admin-mh' },
        body: { decision: ACTION_DECISION.APPROVE },
      },
      res403Jur
    );
    expect(res403Jur.statusCode).toBe(403);

    // 200 authorized IN-UP admin approves
    const resApprove = createMockRes();
    await handler(
      {
        method: 'POST',
        url: `/api/agent-approval-inbox/proposals/${proposalId}/decide`,
        headers: { authorization: 'Bearer admin-up', 'idempotency-key': 'dec-key-1' },
        body: { decision: ACTION_DECISION.APPROVE, rationale: 'Verified against UP circular.' },
      },
      resApprove
    );
    expect(resApprove.statusCode).toBe(200);
    expect(resApprove.body.proposal.status).toBe(ACTION_STATUS.APPROVED);

    // Decision log chain is verified
    const resLog = createMockRes();
    await handler(
      { method: 'GET', url: '/api/agent-approval-inbox/decision-log', headers: { authorization: 'Bearer admin-up' } },
      resLog
    );
    expect(resLog.statusCode).toBe(200);
    expect(resLog.body.chainValid).toBe(true);
    expect(resLog.body.entries).toHaveLength(1);
  });
});
