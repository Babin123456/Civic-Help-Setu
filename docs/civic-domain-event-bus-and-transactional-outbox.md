# Civic Domain Event Bus and Transactional Outbox Architecture

## Overview
Civic workflows—such as application lodgement, grievance escalation, deficiency notices, document verification, and fee receipt generation—often involve cross-cutting concerns (notifications, audit chains, compliance monitors, and analytics). Directly invoking side-effects synchronously within primary user actions creates fragile failure cascades, double-submission risks, and loss of critical state during transient network or service outages.

The `civicDomainEventBusService` (`src/services/civicDomainEventBusService.js`) is a **process-local prototype**. Its maps stage events, track retries and successful handlers, retain dead letters, and record replay audit entries only until the process restarts. It does not commit events atomically with database writes, authenticate operators, or provide cross-process delivery guarantees. No production producer bootstrap is installed by this module.

The [event contract registry and migration runbook](CIVIC_EVENT_CONTRACTS.md) defines the implemented admission checks, opt-in typed releases, consumer pins, CI impact reports, deprecation and rollback procedure. The transactional deployment architecture below is an integration goal, not a claim that durable storage exists.
---

## Architectural Pillars

### 1. Versioned Civic Domain Event Contracts
All events published through the bus adhere to standardized, versioned event schemas (`CIVIC_EVENT_TYPE`):
- **`APPLICATION_SUBMITTED`**: Emitted when a citizen successfully registers or lodges an application for a civic service.
- **`APPLICATION_STATUS_CHANGED`**: Emitted when an application transitions milestones (e.g. Scrutiny, Field Inspection, Approval).
- **`GRIEVANCE_LODGED`**: Emitted when a citizen registers a complaint under state Right to Public Service (RTS) frameworks.
- **`GRIEVANCE_ESCALATED`**: Emitted when an unresolved grievance breaches statutory SLAs and ascends to appellate authorities.
- **`DEFICIENCY_NOTICE_ISSUED`**: Emitted when a scrutiny officer raises formal observations or document discrepancies.
- **`DOCUMENT_VERIFIED`**: Emitted upon successful officer scrutiny or cryptographically signed verification.
- **`FEE_RECEIPT_ISSUED`**: Emitted when official treasury or service fee payments are acknowledged.

Each event package encapsulates:
- `eventId`: Stable unique identifier (`evt_...`).
- `eventType`: Qualified domain event type.
- `schemaVersion`: Semantic version (`1.0.0`) supporting schema evolution.
- `aggregateId`: Entity identifier (e.g. `app_...`, `grv_...`).
- `producerDomain`: Originating service context.
- `idempotencyKey`: Client or producer supplied token preventing duplicate staging.
- `tenantId`: Jurisdiction/Tenant boundary (e.g. `MUNICIPALITY_PUNE`, `CENTRAL`).
- `payload`: Sanitized domain facts.
- `metadata`: Correlation and causation IDs for distributed tracing.

---

### 2. Transactional Outbox Pattern
Instead of dispatching events directly across external network boundaries:
1. The producer invokes `stageOutboxEvent(input)`; a deployment must supply a real database unit-of-work before claiming transactional staging.
2. The event is stored with initial status `PENDING_DELIVERY`.
3. After contract validation, retries within the same tenant and producer return the existing entry only if event type, version, aggregate and sanitized payload match; conflicting reuse is rejected.

---

### 3. Observable Dispatcher & Retry Backoff
The asynchronous dispatcher (`dispatchPendingOutboxEvents()`):
- Fetches pending and retryable events in bounded batches (`batchSize`).
- Dispatches each event sequentially to registered consumers matching the event type and tenant scope.
- If a consumer fails, the event is marked `FAILED_RETRYABLE`, and the next delivery attempt is scheduled using exponential backoff:
  $$\text{backoffMs} = \text{initialBackoffMs} \times (\text{backoffMultiplier})^{\text{attempts} - 1}$$
- Prevents redundant execution by maintaining consumer execution logs (`${consumerId}:${eventId}`).

---

### 4. Dead-Letter Queue (DLQ) & Poison Message Isolation
When an event exceeds its maximum retry threshold (`maxAttempts`, default 3):
- The dispatcher transitions the event to `DEAD_LETTERED`.
- The failure details, stack trace, and original event payload are captured in `dead_letter_events`.
- **Poison Message Isolation**: Failing events do not block subsequent valid events in the outbox stream.

---

### 5. Administrative Replay & Audit Trail
Operational desk operators and administrators can resolve and replay dead-lettered events via `replayDeadLetterEvent()`:
- **Caller precondition**: Checks only non-empty `operatorId` and `justification` strings. A trusted authenticated/authorized operator boundary must be supplied by the caller; these fields alone do not authenticate anyone.
- **Reset**: Resets delivery counters and clears failed consumer execution logs for that specific event.
- **Audit Logging**: Writes an append-only audit record to `administrativeAuditLog` capturing timestamp, operator identity, target event, and operational justification.

---

### 6. Privacy & PII Scrubbing (Data Minimization)
`sanitizeEventPayload()` enforces data minimization principles prior to staging:
- Citizen names are masked as `CITIZEN_REDACTED`.
- Contact numbers are masked as `XXXXXX_REDACTED`.
- Email addresses are mapped to non-routable scoped pseudonyms (`REDACTED@DOMAIN.LOCAL`).
- Aadhaar and PAN numbers are redacted (`XXXX-XXXX-REDACTED`).
- The top-level `authTokens` field is removed. This is not recursive PII/secret detection: callers must pass reference-only payloads and must not include nested secrets.

---

### 7. Observability & Health Metrics
`getEventBusHealthMetrics()` exposes real-time telemetry:
- `outboxDepth`: Total number of staged events.
- `pendingCount`: Events waiting or scheduled for retry.
- `deliveredCount`: Successfully processed events.
- `deadLetterCount`: Unresolved poisoned/failing events.
- `activeConsumersCount`: Number of subscribed consumers.
- `status`: Returns `HEALTHY` or `ATTENTION_REQUIRED` (if DLQ contains unresolved events).

---

## Verification & Testing
Comprehensive Vitest unit tests in `src/services/civicDomainEventBusService.test.js` verify:
1. Event staging, schema validation, and aggregate boundary enforcement.
2. Idempotency guarantees preventing duplicate outbox insertions.
3. Automated PII scrubbing and credential stripping.
4. Consumer registration, subscription routing, and tenant scoping.
5. Sequential delivery, retry backoff, and state transitions.
6. Dead-Letter Queue (DLQ) routing upon retry exhaustion.
7. Poison message isolation allowing healthy events to progress.
8. Administrative replay input checks, justification and process-local audit trail logging.
9. Observability and operational health metrics calculation.
