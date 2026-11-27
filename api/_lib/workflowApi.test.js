import { describe, it, expect } from 'vitest';
import { createWorkflowApiHandler } from './workflowApi.js';
import { createCivicWorkflowAdapter } from '../../src/workflows/providerAdapter.js';
import { applyEvent } from '../../src/workflows/durableWorkflowEngine.js';

function createInMemoryStore() {
  const workflows = new Map();
  const dlq = new Map();

  return {
    async findByStartIdempotencyKey(ownerId, idempotencyKey) {
      for (const wf of workflows.values()) {
        if (wf.state.ownerId === ownerId && wf.startIdempotencyKey === idempotencyKey) {
          return wf.state;
        }
      }
      return null;
    },
    async createWorkflow(state, startEvent) {
      workflows.set(state.workflowId, {
        state,
        events: [startEvent],
        keys: new Set([startEvent.idempotencyKey]),
        startIdempotencyKey: startEvent.idempotencyKey,
      });
    },
    async getWorkflow(workflowId) {
      const wf = workflows.get(workflowId);
      return wf ? { state: wf.state, events: [...wf.events] } : null;
    },
    async listWorkflowsByOwner(ownerId) {
      return [...workflows.values()].filter((w) => w.state.ownerId === ownerId).map((w) => w.state);
    },
    async appendEvent(workflowId, expectedSequence, event) {
      return this.appendEventsBatch(workflowId, expectedSequence, [event]);
    },
    async appendEventsBatch(workflowId, expectedSequence, events) {
      const wf = workflows.get(workflowId);
      if (!wf) return { status: 'not_found' };
      if (wf.keys.has(events[0].idempotencyKey)) return { status: 'duplicate', state: wf.state };
      if (wf.state.lastSequence !== expectedSequence) {
        return { status: 'conflict', expectedSequence: wf.state.lastSequence, actualSequence: expectedSequence, state: wf.state };
      }
      let state = wf.state;
      for (const ev of events) {
        state = applyEvent(state, ev);
        wf.events.push(ev);
        wf.keys.add(ev.idempotencyKey);
      }
      wf.state = state;
      return { status: 'committed', state };
    },
    async writeDeadLetter(record) {
      dlq.set(record.workflowId, record);
    },
    async listDeadLetters() {
      return [...dlq.values()].filter((d) => d.status === 'open');
    },
    async resolveDeadLetter(workflowId, resolvedBy, resolvedAt) {
      const item = dlq.get(workflowId);
      if (item) dlq.set(workflowId, { ...item, status: 'replayed', resolvedBy, updatedAt: resolvedAt });
    },
    async deleteWorkflow(workflowId) {
      workflows.delete(workflowId);
    },
  };
}

function makeHarness({ invokeProvider, timeoutMs = 500 } = {}) {
  const store = createInMemoryStore();
  const telemetry = [];
  let seqId = 0;

  const users = {
    tok_citizen_a: { userId: 'citizen_a', role: 'citizen' },
    tok_citizen_b: { userId: 'citizen_b', role: 'citizen' },
    tok_admin_001: { userId: 'admin_1', role: 'admin' },
  };

  const handler = createWorkflowApiHandler({
    verifySession: async (token) => {
      if (!users[token]) throw new Error('bad token');
      return { userId: users[token].userId };
    },
    getPublicMetadata: async (userId) => {
      const found = Object.values(users).find((u) => u.userId === userId);
      return { role: found?.role || 'citizen' };
    },
    store,
    adapter: createCivicWorkflowAdapter({
      timeoutMs,
      invokeProvider: invokeProvider || (async () => ({
        summary: 'Synthetic checklist draft with verified portal citation.',
        citations: [{ id: 'birth-cert', title: 'Birth Certificate Guide', url: 'https://services.india.gov.in' }],
      })),
    }),
    createId: () => `wf-synth-${++seqId}`,
    emitTelemetry: (ev) => telemetry.push(ev),
  });

  return { handler, store, telemetry };
}

describe('workflowApi vertical slice & security boundaries', () => {
  it('enforces authentication and owner/admin permission boundaries', async () => {
    const { handler } = makeHarness();

    const unauth = await handler({ method: 'GET', headers: {} });
    expect(unauth.status).toBe(401);

    const started = await handler({
      method: 'POST',
      headers: { Authorization: 'Bearer tok_citizen_a' },
      body: {
        action: 'start',
        workflowType: 'service_readiness_check',
        query: 'Need passport renewal checklist',
        idempotencyKey: 'start_key_0001',
      },
    });
    expect(started.status).toBe(201);
    const wfId = started.body.state.workflowId;

    // Citizen B cannot read Citizen A's workflow
    const idorRead = await handler({
      method: 'GET',
      headers: { Authorization: 'Bearer tok_citizen_b' },
      query: { workflowId: wfId },
    });
    expect(idorRead.status).toBe(403);

    // Citizen cannot access admin DLQ
    const dlqDenied = await handler({
      method: 'GET',
      headers: { Authorization: 'Bearer tok_citizen_a' },
      query: { view: 'dlq' },
    });
    expect(dlqDenied.status).toBe(403);
  });

  it('completes end-to-end vertical slice with human approval and deduplicates retries', async () => {
    const { handler, telemetry } = makeHarness();

    const start1 = await handler({
      method: 'POST',
      headers: { Authorization: 'Bearer tok_citizen_a' },
      body: {
        action: 'start',
        workflowType: 'document_checklist_review',
        query: 'My Aadhaar 2345 6789 0123 passport renewal',
        idempotencyKey: 'start_dedup_001',
      },
    });
    expect(start1.status).toBe(201);
    // PII must be scrubbed before persistence and never in telemetry
    expect(start1.body.state.steps[0].summary).not.toContain('2345 6789 0123');

    // Duplicate start returns 200 deduplicated
    const start2 = await handler({
      method: 'POST',
      headers: { Authorization: 'Bearer tok_citizen_a' },
      body: {
        action: 'start',
        workflowType: 'document_checklist_review',
        query: 'My Aadhaar 2345 6789 0123 passport renewal',
        idempotencyKey: 'start_dedup_001',
      },
    });
    expect(start2.status).toBe(200);
    expect(start2.body.deduplicated).toBe(true);

    const wfId = start1.body.state.workflowId;

    // Advance -> awaiting_human_approval
    const adv = await handler({
      method: 'POST',
      headers: { Authorization: 'Bearer tok_citizen_a' },
      body: { action: 'advance', workflowId: wfId, expectedSequence: 1, idempotencyKey: 'adv_key_0001' },
    });
    expect(adv.status).toBe(200);
    expect(adv.body.state.status).toBe('awaiting_human_approval');

    // Stale sequence -> 409 conflict
    const stale = await handler({
      method: 'POST',
      headers: { Authorization: 'Bearer tok_citizen_a' },
      body: { action: 'approve', workflowId: wfId, expectedSequence: 1, decision: 'approved', idempotencyKey: 'app_stale_01' },
    });
    expect(stale.status).toBe(409);

    // Approve at current sequence
    const approved = await handler({
      method: 'POST',
      headers: { Authorization: 'Bearer tok_citizen_a' },
      body: {
        action: 'approve',
        workflowId: wfId,
        expectedSequence: adv.body.state.lastSequence,
        decision: 'approved',
        note: 'Verified locally',
        idempotencyKey: 'app_valid_01',
      },
    });
    expect(approved.status).toBe(200);
    expect(approved.body.state.status).toBe('completed');
    expect(telemetry.some((t) => JSON.stringify(t).includes('2345 6789 0123'))).toBe(false);
  });

  it('routes exhausted provider timeouts to dead-letter queue and supports admin replay', async () => {
    let shouldFail = true;
    const { handler } = makeHarness({
      timeoutMs: 20,
      invokeProvider: async () => {
        if (shouldFail) {
          await new Promise((r) => setTimeout(r, 80));
        }
        return {
          summary: 'Recovered draft after provider outage.',
          citations: [{ id: 'c1', title: 'Civic Guide' }],
        };
      },
    });

    const start = await handler({
      method: 'POST',
      headers: { Authorization: 'Bearer tok_citizen_a' },
      body: { action: 'start', workflowType: 'grievance_draft_prep', query: 'Streetlight outage', idempotencyKey: 'dlq_start_01' },
    });
    let state = start.body.state;

    // 3 retries -> dead_lettered on 3rd
    for (let i = 1; i <= 3; i++) {
      const res = await handler({
        method: 'POST',
        headers: { Authorization: 'Bearer tok_citizen_a' },
        body: { action: 'advance', workflowId: state.workflowId, expectedSequence: state.lastSequence, idempotencyKey: `retry_${i}_0001` },
      });
      expect(res.status).toBe(503);
      state = res.body.state;
    }
    expect(state.status).toBe('dead_lettered');

    // Admin inspects DLQ and replays
    const dlqList = await handler({
      method: 'GET',
      headers: { Authorization: 'Bearer tok_admin_001' },
      query: { view: 'dlq' },
    });
    expect(dlqList.body.items.length).toBe(1);

    shouldFail = false;
    const replay = await handler({
      method: 'POST',
      headers: { Authorization: 'Bearer tok_admin_001' },
      body: { action: 'replay_dlq', workflowId: state.workflowId, idempotencyKey: 'replay_adm_01' },
    });
    expect(replay.status).toBe(200);
    expect(replay.body.state.status).toBe('running');

    // Resume from checkpoint after replay
    const resumed = await handler({
      method: 'POST',
      headers: { Authorization: 'Bearer tok_citizen_a' },
      body: {
        action: 'advance',
        workflowId: state.workflowId,
        expectedSequence: replay.body.state.lastSequence,
        idempotencyKey: 'resume_after_dlq_01',
      },
    });
    expect(resumed.status).toBe(200);
    expect(resumed.body.state.status).toBe('awaiting_human_approval');
  });
});
