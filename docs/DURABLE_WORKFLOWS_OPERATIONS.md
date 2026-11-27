# Durable Civic Agent Workflows — Maintainer Operations Runbook

This runbook covers day-2 operations for the durable event-sourced workflow system introduced in [ADR-1149](./adr/ADR-1149-durable-event-sourced-workflows.md).

## 1. Environment & Hosting Configuration (Vercel + Firebase)

- **Required Environment Variables:**
  - `CLERK_SECRET_KEY`: Clerk backend verification key.
  - `FIREBASE_SERVICE_ACCOUNT`: JSON service account for `firebase-admin` (server-side Firestore transactions).
- **Firestore Rules & Indexes:**
  - Rules in `firebase/firestore.rules` allow owners to read their own `agentWorkflows/{workflowId}` and `events` subcollection, admins to read `agentWorkflowDeadLetters`, and **deny all client writes** (`allow write: if false`). All state transitions occur through `/api/agent-workflows` using `firebase-admin`.
  - Composite indexes in `firebase/firestore.indexes.json` support owner-scoped listing (`ownerId ASC, updatedAt DESC`) and DLQ listing (`status ASC, createdAt DESC`).

## 2. Inspecting & Replaying Dead-Lettered Workflows

1. Open **Admin -> Workflow Dead-Letter Queue** (or call `GET /api/agent-workflows?view=dlq` with an admin Bearer token).
2. Inspect the `errorCode`, `failedSequence`, `retryCount`, and `sanitizedReason` (PII is scrubbed; never log raw citizen inputs).
3. To replay a dead-lettered workflow safely after resolving a provider outage:
   - Click **Replay from Checkpoint** in the Admin UI, or send `POST /api/agent-workflows` with `{ "action": "replay_dlq", "workflowId": "...", "idempotencyKey": "..." }`.
   - Replay appends a `DeadLetterReplayed` event and restores status to `running` from the last valid checkpoint without repeating already-committed steps.

## 3. Data Retention & Purge

- Workflows are stamped with `retentionExpiresAt` (`now + 30 days` by default).
- Citizens can delete their own workflow at any time via `DELETE /api/agent-workflows?workflowId=...`.
- Scheduled cleanup queries `agentWorkflows` where `retentionExpiresAt <= now` and deletes expired event subcollections + parent documents in batches.

## 4. Telemetry & Alerting Signals

Structured telemetry events (PII-free) emitted by `api/_lib/workflowApi.js`:
- `workflow.started` (`workflowId`, `workflowType`)
- `workflow.step_committed` (`workflowId`, `sequence`, `eventType`, `durationMs`)
- `workflow.provider_timeout` (`workflowId`, `sequence`, `attempt`, `timeoutMs`)
- `workflow.dead_lettered` (`workflowId`, `sequence`, `errorCode`)
- `workflow.human_approval` (`workflowId`, `sequence`, `decision`)

## 5. Reproducible Test & Evaluation Command

Run the full verification and evaluation suite:

```bash
npm run eval:workflows
```

This executes the deterministic workflow evaluation harness (`scripts/evaluateDurableWorkflows.mjs`) across synthetic fixtures (process restarts, duplicate delivery, out-of-order events, provider timeouts, DLQ replay, and guardrail scope boundaries) and prints measurable pass/fail metrics.
