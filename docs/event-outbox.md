# Durable Event Outbox & Idempotent Publisher Platform

## Overview

The Event Outbox platform guarantees reliable, at-least-once asynchronous event delivery with zero data loss, crash/restart resilience, and strict idempotency across distributed civic services.

This documentation covers the completed **Slice 1 and Slice 2** implementation of GitHub Issue #1235:
- **Transactional Staging**: Atomic outbox write alongside event creation in `applicationEventRepository.create(event)`.
- **Ingest Deduplication**: Strict idempotency checks by `eventId` and `idempotencyKey` preventing double-staging.
- **Asynchronous Publisher**: In-flight locking, exponential backoff, and randomized jitter avoiding thundering herds.
- **Poison-Event Quarantine**: Dead-letter isolation with audit log entries after reaching `maxAttempts`.
- **Admin-Only Bounded Replay**: Operational event replay restricted to administrative roles (`admin`, `reviewer`, `official`), secured with deterministic delivery keys (`${eventId}:replay:${timestamp}`).
- **Observability Metrics**: Live snapshots (`total`, `pending`, `inFlight`, `delivered`, `quarantined`, `retries`, `replays`, `avgDeliveryLagMs`).
- **Durable Firestore Adapter**: `createFirestoreOutboxStorageAdapter` backed by Google Cloud Firestore with graceful in-memory fallback and diagnostic logging.
- **Configurable Delivery Sink**: `createWebhookDeliverySink` with `safeHttpUrl` sanitization, delivery key propagation, and `EVENT_DELIVERY_WEBHOOK_URL` support.

---

## Architecture & Data Flow

```
[Client / Citizen]
        |
        v
POST /api/application-events
        |
        v (Token Auth + PII Redaction)
applicationEventRepository.create(event)
        |
        +-----------------------------------------------+
        |                                               |
        v (Atomic Commit)                               v (Transactional Outbox)
Application Events Store                          Event Outbox Storage
   - Read models                                    - Memory (default / fallback)
   - Citizen timelines                              - Firestore (applicationEventOutbox)
                                                    - Status: PENDING, attempts: 0
                                                        |
                                                        v
                                          createEventOutboxPublisher()
                                                        |
                                           (Tick: publishPending)
                                                        |
                                                        v (In-Flight Locking)
                                                     Status: IN_FLIGHT
                                                        |
                                                        v
                                             resolvedDeliver(event)
                                              - Injectable callback
                                              - Webhook Sink (HTTP POST)
                                                   /          \
                                         (Success)             (Failure)
                                             /                     \
                                            v                       v
                                    Status: DELIVERED       Attempts += 1
                                                             < maxAttempts ?
                                                             /             \
                                                           (Yes)           (No)
                                                             /               \
                                                            v                 v
                                                   Exponential Backoff   Status: QUARANTINED
                                                   Status: PENDING       Audit Log Recorded
```

---

## Storage Adapters

### 1. In-Memory Adapter (`createMemoryStorageAdapter`)
- Default storage layer used in development, testing, and edge runtimes.
- Clones entries using `JSON.parse(JSON.stringify(...))` across reads and writes to enforce storage isolation.

### 2. Firestore Adapter (`createFirestoreOutboxStorageAdapter`)
- Durable cloud storage adapter backed by Google Cloud Firestore using `api/_lib/firebaseAdmin.js` conventions.
- **Collection**: `applicationEventOutbox` (configurable via `collectionName`).
- **Document Structure**:
  ```json
  {
    "data": {
      "outbox_evt_123": {
        "outboxId": "outbox_evt_123",
        "eventId": "evt_123",
        "idempotencyKey": "key_123",
        "status": "pending",
        "attempts": 0,
        "nextAttemptAt": "2026-11-24T15:00:00.000Z",
        "lastError": null,
        "createdAt": "2026-11-24T15:00:00.000Z",
        "deliveredAt": null,
        "event": { ... }
      }
    },
    "updatedAt": "2026-11-24T15:00:00.000Z"
  }
  ```
- **Unconfigured / Graceful Fallback**:
  - If `FIREBASE_SERVICE_ACCOUNT` is unset or `getFirestoreAdmin()` returns `null`, the adapter silently degrades to `fallback` (in-memory adapter).
  - Any runtime Firestore exception (e.g. transient network outage or permission error) is logged via `logDiagnostic` and delegates to the fallback adapter to ensure service continuity.

---

## Configurable Delivery Sink

### Webhook Delivery Sink (`createWebhookDeliverySink`)
- Dispatches event payloads to an external HTTP(S) endpoint.
- **Configuration**:
  - `EVENT_DELIVERY_WEBHOOK_URL`: Environment variable defining the target URL.
  - Sanitized using `safeHttpUrl` (rejects `javascript:`, `data:`, and non-HTTP protocols).
- **HTTP Request Specification**:
  - **Method**: `POST`
  - **Headers**:
    - `Content-Type: application/json`
    - `X-Delivery-Key: <eventId>:<attempt>` (or `<eventId>:replay:<timestamp>`)
    - `X-Is-Replay: true | false`
  - **Body**:
    ```json
    {
      "event": { ... },
      "deliveryKey": "evt_123:1",
      "isReplay": false
    }
    ```
  - **Timeout**: Managed with `AbortController` (default: 10,000 ms).
- **Sink Resolution Priority**:
  1. Explicit `deliver(event, meta)` callback passed to publisher.
  2. `targetUrl` parameter passed to publisher.
  3. `EVENT_DELIVERY_WEBHOOK_URL` environment variable.
  4. Safe no-op function `async () => {}`.

---

## Failure Modes & Isolation

| Failure Scenario | Mitigation & Behavior |
| :--- | :--- |
| **Worker / Node Crash** | Records remain in durable Firestore or shared storage. On restart, a new outbox/publisher instance recovers all staged records and resumes dispatch with zero duplicate delivery. |
| **Concurrent Publisher Ticks** | Atomic `claimRecord` changes status to `in_flight`. Competing ticks see non-pending status and skip the record. |
| **Downstream Outage / Timeout** | Exponential backoff spaces out retries without thundering herds. Delivery keys ensure idempotency upon downstream recovery. |
| **Poison Event (Permanent Failure)** | Quarantined upon reaching `maxAttempts`. Publisher skips quarantined items during regular dispatch, preserving throughput for healthy events. |
| **Firestore Outage / Missing Creds** | Intercepted via `logDiagnostic`; automatically falls back to in-memory adapter without unhandled process crashes. |

---

## Security Boundaries & Access Control

- **PII Scrubbing**: All events undergo Aadhaar, PAN, credential, and sensitive payload redaction before storage and staging.
- **Role-Based Replay Access**:
  - `POST /api/application-events?action=replay` is strictly gated to administrative roles (`admin`, `reviewer`, `official`).
  - Citizen or unauthenticated requests are rejected immediately with `403 Forbidden`.
  - Replay requests are capped at a maximum of 100 records per operation.
  - Every replay action is audited with `EVENT_OUTBOX_REPLAYED`, including caller role, requested count, and replayed count.
- **Metrics Access**:
  - `GET /api/application-events?metrics=true` or `view=outbox` requires admin authentication. Non-admins receive `403 Forbidden`.

---

## SLOs, Metrics & Alerting Thresholds

### Metrics Exposed via `publisher.getMetrics()`
- `total`: Total records in the outbox.
- `pending`: Events awaiting initial publication or backoff retry.
- `inFlight`: Events currently in transit.
- `delivered`: Successfully published events.
- `quarantined`: Poison events isolated in dead-letter state.
- `retries`: Total retry attempts incurred.
- `replays`: Total administrative event replays triggered.
- `avgDeliveryLagMs`: Moving average lag between event ingestion and successful delivery.

### Recommended Alerting Thresholds

| Metric | Target SLO | Warning Alert | Critical Alert | Action |
| :--- | :--- | :--- | :--- | :--- |
| `avgDeliveryLagMs` | < 1,000 ms | > 5,000 ms | > 15,000 ms | Inspect downstream consumer latency or network throughput. |
| `quarantined` | 0 | > 0 | > 10 in 1 hour | Review quarantined payloads; triage poison schema or downstream API errors. |
| `pending` (backlog) | < 50 | > 500 | > 2,000 | Check publisher tick frequency and downstream health. |
| `retries` rate | < 1% | > 5% of deliveries | > 15% of deliveries | Check downstream transient errors or rate limiting. |

---

## Configuration & Feature-Flag Rollout

| Environment Variable | Description | Default |
| :--- | :--- | :--- |
| `OUTBOX_ENABLED` | Master switch for transactional outbox staging and publisher. | `true` |
| `USE_FIRESTORE_OUTBOX` | Toggle to use Firestore storage adapter instead of memory. | `false` |
| `EVENT_DELIVERY_WEBHOOK_URL` | Default webhook sink target URL for HTTP event publication. | `null` |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase Admin JSON service account credentials for Firestore. | `null` |

---

## Rollback Plan

If unexpected anomalies occur in production:
1. Set `OUTBOX_ENABLED=false` and restart or redeploy the service.
2. The `applicationEventRepository` will bypass outbox staging and operate identically to pre-#1235 behavior.
3. If Firestore connectivity causes degradation, set `USE_FIRESTORE_OUTBOX=false` to switch immediately to in-memory operation.
