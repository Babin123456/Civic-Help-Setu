import { describe, it, expect } from 'vitest';
import {
  EVENT_TYPE,
  WORKFLOW_STATUS,
  validateCreateWorkflowInput,
  validateProposalScope,
} from './workflowContracts.js';
import {
  createWorkflowEvent,
  createEmptyState,
  applyEvent,
  replayFromCheckpoint,
  appendEventDeterministic,
} from './durableWorkflowEngine.js';
import { createCivicWorkflowAdapter } from './providerAdapter.js';

describe('durableWorkflowEngine & contracts (synthetic fixtures)', () => {
  it('rejects invalid untrusted workflow inputs at boundary', () => {
    expect(validateCreateWorkflowInput(null).valid).toBe(false);
    expect(validateCreateWorkflowInput({ workflowType: 'unknown', query: 'hi', idempotencyKey: 'key_12345678' }).valid).toBe(false);
    expect(validateCreateWorkflowInput({ workflowType: 'service_readiness_check', query: '', idempotencyKey: 'key_12345678' }).valid).toBe(false);
    expect(validateCreateWorkflowInput({ workflowType: 'service_readiness_check', query: 'Check passport docs', idempotencyKey: 'short' }).valid).toBe(false);
  });

  it('enforces idempotency on duplicate delivery and rejects out-of-order events', () => {
    const wfId = 'wf-synth-001';
    const start = createWorkflowEvent({
      workflowId: wfId,
      sequence: 1,
      type: EVENT_TYPE.WORKFLOW_STARTED,
      idempotencyKey: 'start_synth_001',
      payload: { ownerId: 'user_synth_1', workflowType: 'service_readiness_check', sanitizedQuery: 'Check docs' },
      occurredAt: 1000,
    });
    const state1 = applyEvent(createEmptyState(wfId), start);

    // Duplicate delivery
    const dup = appendEventDeterministic(state1, start, new Set(['start_synth_001']));
    expect(dup.status).toBe('duplicate');
    expect(dup.state.lastSequence).toBe(1);

    // Out-of-order event (sequence 3 when lastSequence is 1)
    const outOfOrder = createWorkflowEvent({
      workflowId: wfId,
      sequence: 3,
      type: EVENT_TYPE.MODEL_CALL_REQUESTED,
      idempotencyKey: 'req_synth_003',
      occurredAt: 1010,
    });
    const conflict = appendEventDeterministic(state1, outOfOrder, new Set(['start_synth_001']));
    expect(conflict.status).toBe('conflict');
    expect(conflict.error).toBe('sequence_mismatch');
  });

  it('replays deterministically from checkpoint without repeating prior events', () => {
    const wfId = 'wf-synth-replay';
    const e1 = createWorkflowEvent({
      workflowId: wfId,
      sequence: 1,
      type: EVENT_TYPE.WORKFLOW_STARTED,
      idempotencyKey: 'k1_12345678',
      payload: { ownerId: 'u1', workflowType: 'document_checklist_review', sanitizedQuery: 'Ration card docs' },
      occurredAt: 100,
    });
    const e2 = createWorkflowEvent({
      workflowId: wfId,
      sequence: 2,
      type: EVENT_TYPE.MODEL_CALL_REQUESTED,
      idempotencyKey: 'k2_12345678',
      payload: { attempt: 1 },
      occurredAt: 200,
    });
    const e3 = createWorkflowEvent({
      workflowId: wfId,
      sequence: 3,
      type: EVENT_TYPE.STEP_PROPOSED,
      idempotencyKey: 'k3_12345678',
      payload: { summary: 'Bring address proof.', citations: [{ id: 's1', title: 'PDS Guide' }] },
      occurredAt: 300,
    });

    const checkpoint = replayFromCheckpoint(null, [e1, e2]);
    const resumed = replayFromCheckpoint(checkpoint, [e1, e2, e3]);
    expect(resumed.lastSequence).toBe(3);
    expect(resumed.pendingProposal.summary).toBe('Bring address proof.');
    expect(resumed.status).toBe(WORKFLOW_STATUS.RUNNING);
  });

  it('blocks autonomous filing / official claims and requires citations', () => {
    expect(validateProposalScope({ summary: 'Draft ready', citations: [] }).valid).toBe(false);
    expect(
      validateProposalScope({
        summary: 'Your application submitted to government and officially approved.',
        citations: [{ id: 'c1', title: 'Portal' }],
      }).valid
    ).toBe(false);
    expect(
      validateProposalScope({
        summary: 'Draft checklist prepared for review.',
        citations: [{ id: 'c1', title: 'Service Guide' }],
      }).valid
    ).toBe(true);
  });

  it('handles provider timeouts safely without throwing', async () => {
    const adapter = createCivicWorkflowAdapter({
      timeoutMs: 25,
      invokeProvider: () => new Promise((resolve) => setTimeout(() => resolve({ summary: 'late', citations: [{ id: '1' }] }), 150)),
    });
    const outcome = await adapter.proposeStep({ workflowType: 'service_readiness_check', query: 'Check birth certificate' });
    expect(outcome.ok).toBe(false);
    expect(outcome.code).toBe('provider_timeout');
    expect(outcome.retryable).toBe(true);
  });
});
