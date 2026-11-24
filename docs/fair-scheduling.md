# Fair Scheduling & Allocation Engine for Token and Appointment Peaks

## Overview

The Fair Scheduling & Allocation Engine (#1268) provides an auditable, starvation-free scheduling mechanism for civic service appointments and physical counter token demand peaks (e.g. Sub-Registrar, RTO, Municipal Licensing, and Welfare facilitation counters).

This documentation covers the completed **Slice 1 and Slice 2** implementation:
- **Atomic Slot Reservation**: Capacity limits, optimistic concurrency locking, and per-(citizen, service, window) idempotency.
- **Priority Policy (`P0`–`P3`)**: Emergency designation guardrails, time-critical statutory deadlines, functional accessibility accommodations, and standard requests.
- **Starvation-Free Queueing**: Deterministic tie-breaking combined with wait-time aging promotion preventing lower-priority requests from starving.
- **Fair Lifecycle Handling**: Cancellations release slots with automatic top-waitlist promotion; no-shows enforce configurable grace periods before release.
- **Admin Overrides & Audit**: Role-gated manual overrides requiring justification and producing append-only audit entries.
- **Privacy-Preserving Public Views**: Public queue projections strictly omit citizen IDs, sensitive accommodation requirements, and medical details.
- **Durable Firestore Adapter**: Cloud storage adapter backed by Google Cloud Firestore (`civicFairScheduler` collection) with automatic memory fallback.
- **HTTP Route Handler**: `createFairSchedulerHandler` exposed via `api/fair-scheduler.js` with Clerk session verification and IP rate limiting.

---

## Priority Policy & Classification Rules

| Priority Class | Target Segment | Eligibility Criteria | Guardrail / Rule | Explainable Reason Code |
| :--- | :--- | :--- | :--- | :--- |
| **`P0` — Emergency** | Life-safety, disaster, or urgent critical services | Explicitly designated emergency services only (e.g. emergency ambulance, disaster shelter) | **Reject Citizen Self-Selection**: Non-emergency services requesting `P0` are rejected immediately (`400 Bad Request`). | `P0_EMERGENCY_DESIGNATED`<br>`REJECT_UNAUTHORIZED_EMERGENCY` |
| **`P1` — Time-Critical** | Statutory deadlines or court-mandated filings | Verified statutory deadline (`hasStatutoryDeadline === true`) or documented limitation constraints | Must supply deadline parameter or statutory reference. | `P1_STATUTORY_DEADLINE` |
| **`P2` — Accessibility Accommodation** | Citizens requiring assistive or accessible access | Any declared accessibility accommodation requirement (e.g. step-free wheelchair access, sign language, tactile guide) | **No Medical Diagnosis Required**: Modeled purely as an accommodation requirement. Public projections never display sensitive accommodation details. | `P2_ACCOMMODATION_MATCHED` |
| **`P3` — Standard** | General civic facilitation bookings | All other eligible citizen requests | Default class. | `P3_STANDARD_ALLOCATION` |

---

## Anti-Starvation Aging & Tie-Breaking

### Aging Formula
To prevent low-priority (`P3`) requests from being perpetually starved by incoming `P2`/`P1` requests during sustained demand peaks, waitlisted requests earn an **effective priority boost** over time:

$$\text{effectiveRank} = \max\left(0, \text{baseRank} - \left\lfloor \frac{\text{now} - \text{waitlistedAt}}{\text{agingWindowMs}} \right\rfloor\right)$$

- Base ranks: `P0 = 0`, `P1 = 1`, `P2 = 2`, `P3 = 3`.
- `agingWindowMs`: Configurable aging window (default: 1 hour).
- A `P3` request waiting for $\ge 2 \times \text{agingWindowMs}$ is effectively treated as rank 1 (equivalent to `P1`) during waitlist promotions, earning the `AGING_BOOST_APPLIED` reason code.

### Deterministic Tie-Breaking
When multiple waitlisted requests compete for a newly released slot:
1. Lowest **effective rank** wins (`P0 > P1 > P2 > P3`).
2. Earlier `requestedAt` timestamp wins (FIFO within equal rank).
3. Deterministic lexical tie-breaker on `citizenId` (`a.citizenId.localeCompare(b.citizenId)`).

---

## Storage Architecture

### 1. In-Memory Adapter (`createMemoryStorageAdapter`)
- Default storage layer used in development, testing, and edge runtimes.
- Clones entries using `JSON.parse(JSON.stringify(...))` across reads and writes to enforce storage isolation.

### 2. Firestore Adapter (`createFirestoreSchedulerStorageAdapter`)
- Durable storage adapter backed by Google Cloud Firestore using `api/_lib/firebaseAdmin.js` conventions.
- **Collection**: `civicFairScheduler` (configurable via `collectionName`).
- **Document Structure**:
  ```json
  {
    "data": {
      "bookings": {
        "bk_123": {
          "bookingId": "bk_123",
          "tokenId": "TK-4821",
          "idempotencyKey": "cit_1:srv_rto:win_10",
          "citizenId": "cit_1",
          "serviceId": "srv_rto",
          "windowId": "win_10",
          "status": "reserved",
          "priorityClass": "P3",
          "policyVersion": "fair_scheduling_v1",
          "reasonCodes": ["P3_STANDARD_ALLOCATION"],
          "hasAccommodation": false,
          "accommodationRequirement": null,
          "requestedAt": "2026-11-24T15:00:00.000Z",
          "waitlistedAt": null,
          "promotedAt": null,
          "checkedInAt": null,
          "cancelledAt": null
        }
      },
      "auditLog": [],
      "overridesCount": 0
    },
    "updatedAt": "2026-11-24T15:00:00.000Z"
  }
  ```
- **Graceful Fallback**:
  - If `FIREBASE_SERVICE_ACCOUNT` is unset or `getFirestoreAdmin()` returns `null`, the adapter degrades cleanly to `fallback` (in-memory adapter).
  - Any runtime Firestore exception is logged via `logDiagnostic` and delegates to the fallback adapter to ensure service continuity.

---

## HTTP Handler & Endpoints (`api/fair-scheduler.js`)

All endpoints receive requests with `{ method, headers, body, query }`:

| Method | Endpoint / Action | Auth | Purpose | Response |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `?action=projection` | Public | Public sanitized queue display (strips citizen IDs and accessibility requirements). | `200 { ok: true, projection: [...] }` |
| `GET` | `?action=metrics` | Admin (`admin`, `reviewer`, `official`) | Snapshot of queue metrics, wait times, and priority distributions. | `200 { ok: true, metrics: {...} }` |
| `POST` | `action: "reserve"` | Citizen / Bearer token | Reserve slot or enqueue on fair waitlist. | `201 { booking }` (reserved)<br>`202 { booking }` (waitlisted)<br>`200 { booking }` (idempotent existing) |
| `POST` | `action: "cancel"` | Citizen / Admin | Cancel booking and auto-promote top waitlisted request. | `200 { ok: true, booking, promotedBooking }` |
| `POST` | `action: "checkin"` | Citizen / Bearer token | Check in for reserved slot upon physical counter arrival. | `200 { ok: true, booking }` |
| `POST` | `action: "noshow"` | Admin / Counter Staff | Mark slot as no-show after grace period expiry; auto-promotes waitlist. | `200 { ok: true, booking, promotedBooking }` |
| `POST` | `action: "override"` | Admin (`admin`, `reviewer`, `official`) | Apply audited administrative override with mandatory reason. | `200 { ok: true, booking, auditEntry }` |

---

## Counter-Journey Simulator Integration Path

The Civic Counter Journey Simulator (`api/counter-journey.js`) evaluates required documents, procedures, and counter sequencing for citizen visits.

To integrate fair token allocation into counter journeys without duplicating booking logic or touching static facility observation boards:
1. When a citizen completes a journey evaluation via `POST /api/counter-journey` (`action: "evaluate"`), the client or workflow can invoke `POST /api/fair-scheduler` (`action: "reserve"`), passing `serviceId: journey.serviceId` and `citizenId: userId`.
2. The fair scheduler provisions a verified `tokenId` and appointment slot or waitlist position governed by the fair allocation algorithm.
3. The returned `tokenId` and status are stored alongside the journey checklist (`buildJourneyChecklistText`), providing citizens with an end-to-end token reservation and checklist pack in a single seamless flow.

---

## Security & Privacy Threat Boundaries

1. **Accessibility Privacy**:
   - In accordance with privacy and dignity standards, accommodation requirements are recorded strictly for queue routing.
   - Public projections (`getPublicQueueProjection()`) strip `accommodationRequirement`, `hasAccommodation`, `citizenId`, and personal data, outputting only token identifiers (`tokenId`), window IDs, and status.
2. **P0 Abuse Mitigation**:
   - Citizen self-selection of P0 is blocked by `emergencySet` validation. Arbitrary self-elevation is rejected with `REJECT_UNAUTHORIZED_EMERGENCY`.
3. **Idempotency Protection**:
   - Keys are scoped per `(citizenId, serviceId, windowId)`. Repeated clicks or network retry storms safely return the existing reservation without duplicate slot consumption.

---

## Operational Metrics & Alerting Thresholds

Exposed via `scheduler.getMetrics()` and `GET /api/fair-scheduler?action=metrics`:
- `total`: Total bookings recorded.
- `reserved`: Active slot reservations.
- `waitlisted`: Current waitlist backlog.
- `checkedIn`: Checked-in citizen visits.
- `cancelled`: Total cancellations.
- `noShow`: Total unfulfilled visits past grace period.
- `byPriority`: Distribution across `P0`, `P1`, `P2`, `P3`.
- `overridesCount`: Total administrative manual interventions.
- `avgWaitlistDurationMs`: Average duration from waitlist entry to promotion.

### Alerting Thresholds

| Metric | Target SLO | Warning Alert | Critical Alert | Action |
| :--- | :--- | :--- | :--- | :--- |
| `avgWaitlistDurationMs` | < 30 mins | > 60 mins | > 120 mins | Open additional service windows or reallocate counter staff. |
| `waitlisted` (backlog) | < 20 | > 50 | > 150 | Adjust slot quotas or activate emergency overflow counters. |
| `overridesCount` rate | < 1% | > 5% of bookings | > 10% of bookings | Review manual counter desk practices for policy compliance. |
| `noShow` rate | < 10% | > 20% | > 35% | Send SMS/email checklist reminders or shorten booking lead time. |

---

## Configuration & Feature-Flag Rollout

| Environment Variable | Description | Default |
| :--- | :--- | :--- |
| `USE_FIRESTORE_SCHEDULER` | Toggle to persist scheduler state to Firestore rather than memory. | `false` |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase Admin JSON service account credentials for Firestore. | `null` |
| `CLERK_SECRET_KEY` | Clerk authentication secret for verifying citizen and admin sessions. | `null` |

---

## Rollback Plan

If unexpected anomalies occur in production:
1. Set `USE_FIRESTORE_SCHEDULER=false` to switch immediately to in-memory operation.
2. The fair scheduler handler and module are completely decoupled from client-side checklist tools and static facility boards, so existing citizen guides remain fully functional.
