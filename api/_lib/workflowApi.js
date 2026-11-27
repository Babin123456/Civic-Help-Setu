/**
 * Dependency-injected HTTP handler for Durable Civic Agent Workflows (ADR-1149).
 * Separates model/provider calls from atomic state commits, enforces Clerk auth,
 * role/ownership boundaries, rate limits, idempotency, and PII-free telemetry.
 */

import { bearerToken } from './firebaseToken.js';
import { clientKey, createSingleFlight } from './abuseGuard.js';
import { resolveRole } from '../../src/services/roleService.js';
import { runPreInferenceGuardrails, GUARDRAIL_DECISION } from '../../src/ai/aiGuardrailPipeline.js';
import {
  EVENT_TYPE,
  WORKFLOW_STATUS,
  WORKFLOW_LIMITS,
  validateCreateWorkflowInput,
  validateStepCommand,
  validateApprovalCommand,
  validateReplayCommand,
} from '../../src/workflows/workflowContracts.js';
import {
  createWorkflowEvent,
  createEmptyState,
  applyEvent,
  buildDeadLetterRecord,
} from '../../src/workflows/durableWorkflowEngine.js';

const json = (status, body, extra = {}) => ({
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
  body,
});

const tooMany = (retryAfterSeconds) =>
  json(429, { error: 'rate_limited', retryAfterSeconds }, { 'Retry-After': String(retryAfterSeconds) });

export function createWorkflowApiHandler({
  verifySession,
  getPublicMetadata,
  store,
  adapter,
  ipLimiter,
  userLimiter,
  now = Date.now,
  createId = () => `wf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  emitTelemetry = () => {},
}) {
  const singleFlight = createSingleFlight();

  async function authenticate(headers) {
    const address = ipLimiter ? clientKey(headers) : null;
    if (address) {
      const verdict = ipLimiter.take(address);
      if (!verdict.allowed) return { error: tooMany(verdict.retryAfterSeconds) };
    }

    const token = bearerToken(headers);
    if (!token) return { error: json(401, { error: 'missing_token' }) };

    let userId;
    try {
      ({ userId } = await verifySession(token));
    } catch {
      return { error: json(401, { error: 'invalid_token' }) };
    }
    if (typeof userId !== 'string' || userId.length === 0 || userId.length > 128) {
      return { error: json(401, { error: 'invalid_token' }) };
    }

    if (userLimiter) {
      const verdict = userLimiter.take(userId);
      if (!verdict.allowed) return { error: tooMany(verdict.retryAfterSeconds) };
    }

    let role;
    try {
      role = resolveRole(await getPublicMetadata(userId));
    } catch {
      return { error: json(502, { error: 'role_lookup_failed' }) };
    }

    return { userId, role };
  }

  function canAccessWorkflow(state, userId, role) {
    return Boolean(state && (state.ownerId === userId || role === 'admin'));
  }

  return async function handle({ method, headers = {}, query = {}, body = null }) {
    const auth = await authenticate(headers);
    if (auth.error) return auth.error;
    const { userId, role } = auth;

    if (method === 'GET') {
      if (query.view === 'dlq') {
        if (role !== 'admin') return json(403, { error: 'forbidden' });
        const items = await store.listDeadLetters();
        return json(200, { items });
      }
      if (query.workflowId) {
        const result = await store.getWorkflow(String(query.workflowId));
        if (!result) return json(404, { error: 'not_found' });
        if (!canAccessWorkflow(result.state, userId, role)) return json(403, { error: 'forbidden' });
        return json(200, result);
      }
      const workflows = await store.listWorkflowsByOwner(userId);
      return json(200, { workflows });
    }

    if (method === 'DELETE') {
      const workflowId = query.workflowId ? String(query.workflowId) : '';
      if (!workflowId) return json(400, { error: 'missing_workflow_id' });
      const existing = await store.getWorkflow(workflowId);
      if (!existing) return json(404, { error: 'not_found' });
      if (!canAccessWorkflow(existing.state, userId, role)) return json(403, { error: 'forbidden' });
      await store.deleteWorkflow(workflowId);
      emitTelemetry({ event: 'workflow.purged', workflowId });
      return json(200, { deleted: true, workflowId });
    }

    if (method !== 'POST') {
      return json(405, { error: 'method_not_allowed' }, { Allow: 'GET, POST, DELETE' });
    }

    const action = body?.action;

    if (action === 'start') {
      const parsed = validateCreateWorkflowInput(body);
      if (!parsed.valid) return json(400, { error: parsed.error, message: parsed.message });

      const { workflowType, query: rawQuery, serviceId, idempotencyKey, requiresHumanApproval } = parsed.value;
      const guardrail = runPreInferenceGuardrails(rawQuery);
      if (guardrail.decision === GUARDRAIL_DECISION.BLOCK) {
        return json(400, { error: 'guardrail_blocked', message: 'Query blocked by safety policy.' });
      }

      return singleFlight.run(`start:${userId}:${idempotencyKey}`, async () => {
        const existingByKey = await store.findByStartIdempotencyKey(userId, idempotencyKey);
        if (existingByKey) {
          return json(200, { deduplicated: true, state: existingByKey });
        }

        const workflowId = createId();
        const ts = now();
        const startEvent = createWorkflowEvent({
          workflowId,
          sequence: 1,
          type: EVENT_TYPE.WORKFLOW_STARTED,
          idempotencyKey,
          payload: {
            ownerId: userId,
            workflowType,
            serviceId,
            sanitizedQuery: guardrail.sanitizedQuery || rawQuery,
            requiresHumanApproval,
            retentionExpiresAt: ts + WORKFLOW_LIMITS.DEFAULT_RETENTION_DAYS * 86400_000,
          },
          occurredAt: ts,
        });

        const initialState = applyEvent(createEmptyState(workflowId), startEvent);
        await store.createWorkflow(initialState, startEvent);
        emitTelemetry({ event: 'workflow.started', workflowId, workflowType });
        return json(201, { deduplicated: false, state: initialState, lastEvent: startEvent });
      });
    }

    if (action === 'advance') {
      const parsed = validateStepCommand(body);
      if (!parsed.valid) return json(400, { error: parsed.error, message: parsed.message });
      const { workflowId, expectedSequence, idempotencyKey } = parsed.value;

      return singleFlight.run(`advance:${workflowId}:${idempotencyKey}`, async () => {
        const existing = await store.getWorkflow(workflowId);
        if (!existing) return json(404, { error: 'not_found' });
        if (!canAccessWorkflow(existing.state, userId, role)) return json(403, { error: 'forbidden' });

        // Phase 1: Atomically commit ModelCallRequested (separate from provider call)
        const reqResult = await store.appendEvent(workflowId, expectedSequence, createWorkflowEvent({
          workflowId,
          sequence: expectedSequence + 1,
          type: EVENT_TYPE.MODEL_CALL_REQUESTED,
          idempotencyKey: `${idempotencyKey}:req`,
          payload: { attempt: existing.state.retryCount + 1 },
          occurredAt: now(),
        }));

        if (reqResult.status === 'duplicate') {
          return json(200, { deduplicated: true, state: reqResult.state });
        }
        if (reqResult.status === 'conflict') {
          return json(409, {
            error: 'sequence_mismatch',
            expectedSequence: reqResult.expectedSequence,
            actualSequence: reqResult.actualSequence,
          });
        }
        if (reqResult.status === 'rejected') {
          return json(400, { error: reqResult.error });
        }

        const startedStepAt = now();
        const startStep = existing.events.find((e) => e.type === EVENT_TYPE.WORKFLOW_STARTED);
        const queryText = startStep?.payload?.sanitizedQuery || '';

        // Phase 2: Invoke provider-neutral adapter OUTSIDE transaction
        const outcome = await adapter.proposeStep({
          workflowType: reqResult.state.workflowType,
          query: queryText,
          serviceId: reqResult.state.serviceId,
        });

        const commitSeq = reqResult.state.lastSequence;

        // Phase 3: Commit result atomically
        if (outcome.ok) {
          const proposalEvent = createWorkflowEvent({
            workflowId,
            sequence: commitSeq + 1,
            type: EVENT_TYPE.STEP_PROPOSED,
            idempotencyKey: `${idempotencyKey}:prop`,
            causationId: `${idempotencyKey}:req`,
            payload: outcome.proposal,
            occurredAt: now(),
          });
          const followUpType = reqResult.state.requiresHumanApproval
            ? EVENT_TYPE.HUMAN_APPROVAL_REQUESTED
            : EVENT_TYPE.WORKFLOW_COMPLETED;
          const followUpEvent = createWorkflowEvent({
            workflowId,
            sequence: commitSeq + 2,
            type: followUpType,
            idempotencyKey: `${idempotencyKey}:gate`,
            causationId: `${idempotencyKey}:prop`,
            payload: reqResult.state.requiresHumanApproval
              ? { reason: 'High-impact civic guidance requires human review.' }
              : {},
            occurredAt: now(),
          });
          const checkpointEvent = createWorkflowEvent({
            workflowId,
            sequence: commitSeq + 3,
            type: EVENT_TYPE.CHECKPOINT_SAVED,
            idempotencyKey: `${idempotencyKey}:ckpt`,
            causationId: `${idempotencyKey}:gate`,
            payload: {},
            occurredAt: now(),
          });

          const committed = await store.appendEventsBatch(workflowId, commitSeq, [
            proposalEvent,
            followUpEvent,
            checkpointEvent,
          ]);
          emitTelemetry({
            event: 'workflow.step_committed',
            workflowId,
            sequence: committed.state.lastSequence,
            durationMs: now() - startedStepAt,
          });
          return json(200, { deduplicated: false, state: committed.state });
        }

        // Failure path: record ModelCallFailed and dead-letter if retries exhausted or non-retryable
        const failedEvent = createWorkflowEvent({
          workflowId,
          sequence: commitSeq + 1,
          type: EVENT_TYPE.MODEL_CALL_FAILED,
          idempotencyKey: `${idempotencyKey}:fail`,
          causationId: `${idempotencyKey}:req`,
          payload: { code: outcome.code, retryable: outcome.retryable },
          occurredAt: now(),
        });

        const nextRetryCount = reqResult.state.retryCount + 1;
        const shouldDeadLetter = !outcome.retryable || nextRetryCount >= WORKFLOW_LIMITS.MAX_RETRIES;
        const eventsToCommit = [failedEvent];

        if (shouldDeadLetter) {
          eventsToCommit.push(createWorkflowEvent({
            workflowId,
            sequence: commitSeq + 2,
            type: EVENT_TYPE.MOVED_TO_DEAD_LETTER,
            idempotencyKey: `${idempotencyKey}:dlq`,
            causationId: `${idempotencyKey}:fail`,
            payload: { errorCode: outcome.code },
            occurredAt: now(),
          }));
        }

        const failedCommit = await store.appendEventsBatch(workflowId, commitSeq, eventsToCommit);

        if (shouldDeadLetter) {
          const dlqRecord = buildDeadLetterRecord(
            failedCommit.state,
            { errorCode: outcome.code, sanitizedReason: outcome.sanitizedReason, failedSequence: commitSeq + 1 },
            now()
          );
          await store.writeDeadLetter(dlqRecord);
          emitTelemetry({ event: 'workflow.dead_lettered', workflowId, sequence: commitSeq + 2, errorCode: outcome.code });
        } else {
          emitTelemetry({ event: 'workflow.provider_timeout', workflowId, sequence: commitSeq + 1, attempt: nextRetryCount });
        }

        return json(503, {
          error: outcome.code,
          retryable: !shouldDeadLetter && outcome.retryable,
          deadLettered: shouldDeadLetter,
          state: failedCommit.state,
        });
      });
    }

    if (action === 'approve') {
      const parsed = validateApprovalCommand(body);
      if (!parsed.valid) return json(400, { error: parsed.error, message: parsed.message });
      const { workflowId, expectedSequence, idempotencyKey, decision, note } = parsed.value;

      const existing = await store.getWorkflow(workflowId);
      if (!existing) return json(404, { error: 'not_found' });
      if (!canAccessWorkflow(existing.state, userId, role)) return json(403, { error: 'forbidden' });
      if (existing.state.status !== WORKFLOW_STATUS.AWAITING_HUMAN_APPROVAL) {
        return json(409, { error: 'invalid_workflow_state', status: existing.state.status });
      }

      const approvalEvent = createWorkflowEvent({
        workflowId,
        sequence: expectedSequence + 1,
        type: EVENT_TYPE.HUMAN_APPROVAL_RESOLVED,
        idempotencyKey,
        payload: { decision, reviewerId: userId, note },
        occurredAt: now(),
      });

      const res = await store.appendEvent(workflowId, expectedSequence, approvalEvent);
      if (res.status === 'duplicate') return json(200, { deduplicated: true, state: res.state });
      if (res.status === 'conflict') return json(409, { error: 'sequence_mismatch' });
      emitTelemetry({ event: 'workflow.human_approval', workflowId, sequence: res.state.lastSequence, decision });
      return json(200, { deduplicated: false, state: res.state });
    }

    if (action === 'replay_dlq') {
      if (role !== 'admin') return json(403, { error: 'forbidden' });
      const parsed = validateReplayCommand(body);
      if (!parsed.valid) return json(400, { error: parsed.error, message: parsed.message });
      const { workflowId, idempotencyKey } = parsed.value;

      const existing = await store.getWorkflow(workflowId);
      if (!existing) return json(404, { error: 'not_found' });
      if (existing.state.status !== WORKFLOW_STATUS.DEAD_LETTERED) {
        return json(409, { error: 'not_dead_lettered', status: existing.state.status });
      }

      const replayEvent = createWorkflowEvent({
        workflowId,
        sequence: existing.state.lastSequence + 1,
        type: EVENT_TYPE.DEAD_LETTER_REPLAYED,
        idempotencyKey,
        payload: { replayedBy: userId },
        occurredAt: now(),
      });

      const res = await store.appendEvent(workflowId, existing.state.lastSequence, replayEvent);
      await store.resolveDeadLetter(workflowId, userId, now());
      return json(200, { replayed: true, state: res.state });
    }

    return json(400, { error: 'unsupported_action' });
  };
}
