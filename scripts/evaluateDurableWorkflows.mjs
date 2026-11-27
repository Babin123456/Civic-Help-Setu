/**
 * Reproducible evaluation harness for Durable Civic Agent Workflows (Issue #1149).
 * Runs synthetic scenarios and reports measurable reliability & safety metrics.
 */
import assert from 'node:assert/strict';
import {
  EVENT_TYPE,
  WORKFLOW_STATUS,
  validateProposalScope,
} from '../src/workflows/workflowContracts.js';
import {
  createWorkflowEvent,
  createEmptyState,
  applyEvent,
  replayFromCheckpoint,
  appendEventDeterministic,
} from '../src/workflows/durableWorkflowEngine.js';
import { createCivicWorkflowAdapter } from '../src/workflows/providerAdapter.js';

const metrics = {
  replayDeterminism: false,
  duplicateZeroSideEffects: false,
  outOfOrderRejected: false,
  timeoutHandledSafely: false,
  scopeBoundaryEnforced: false,
};

// 1. Replay determinism
const wfId = 'eval-wf-1';
const e1 = createWorkflowEvent({
  workflowId: wfId,
  sequence: 1,
  type: EVENT_TYPE.WORKFLOW_STARTED,
  idempotencyKey: 'eval_k1_0001',
  payload: { ownerId: 'eval_user', workflowType: 'service_readiness_check', sanitizedQuery: 'Evaluate readiness' },
  occurredAt: 1000,
});
const e2 = createWorkflowEvent({
  workflowId: wfId,
  sequence: 2,
  type: EVENT_TYPE.STEP_PROPOSED,
  idempotencyKey: 'eval_k2_0001',
  payload: { summary: 'Checklist prepared', citations: [{ id: 's1', title: 'Guide' }] },
  occurredAt: 2000,
});
const full = replayFromCheckpoint(null, [e1, e2]);
const fromCkpt = replayFromCheckpoint(applyEvent(createEmptyState(wfId), e1), [e1, e2]);
assert.deepEqual(full, fromCkpt);
metrics.replayDeterminism = true;

// 2. Duplicate delivery
const dupRes = appendEventDeterministic(full, e2, new Set(['eval_k1_0001', 'eval_k2_0001']));
assert.equal(dupRes.status, 'duplicate');
metrics.duplicateZeroSideEffects = true;

// 3. Out-of-order rejection
const ooo = createWorkflowEvent({
  workflowId: wfId,
  sequence: 5,
  type: EVENT_TYPE.WORKFLOW_COMPLETED,
  idempotencyKey: 'eval_k5_0001',
});
const oooRes = appendEventDeterministic(full, ooo, new Set(['eval_k1_0001', 'eval_k2_0001']));
assert.equal(oooRes.status, 'conflict');
metrics.outOfOrderRejected = true;

// 4. Provider timeout handling
const adapter = createCivicWorkflowAdapter({
  timeoutMs: 15,
  invokeProvider: () => new Promise((r) => setTimeout(() => r({ summary: 'late', citations: [{ id: '1' }] }), 80)),
});
const timeoutRes = await adapter.proposeStep({ workflowType: 'service_readiness_check', query: 'Check service' });
assert.equal(timeoutRes.ok, false);
assert.equal(timeoutRes.code, 'provider_timeout');
metrics.timeoutHandledSafely = true;

// 5. Scope boundary enforcement
assert.equal(validateProposalScope({ summary: 'Your application submitted to government', citations: [{ id: '1' }] }).valid, false);
assert.equal(validateProposalScope({ summary: 'Draft without citations', citations: [] }).valid, false);
metrics.scopeBoundaryEnforced = true;

console.log('=== Durable Workflow Evaluation Report (Issue #1149) ===');
console.log(JSON.stringify({ status: WORKFLOW_STATUS.COMPLETED, metrics }, null, 2));
