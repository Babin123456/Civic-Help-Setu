# Fair Scheduling & Allocation Engine for Token and Appointment Peaks

## Overview

The Fair Scheduling & Allocation Engine (#1268) provides an auditable, starvation-free scheduling mechanism for civic service appointments and physical counter token demand peaks (e.g. Sub-Registrar, RTO, Municipal Licensing, and Welfare facilitation counters).

This implementation delivers **Slice 1** of GitHub Issue #1268:
- Atomic slot reservation with capacity limits, optimistic locking, and concurrency protection.
- Per-(citizen, service, window) idempotency preventing duplicate bookings on retries or network flaps.
- Configurable **P0–P3 priority classes** with emergency-service designation enforcement.
- Accessibility accommodations (P2) modeled strictly as functional requirements without medical diagnosis disclosure.
- Deterministic tie-breaking and wait-time aging anti-starvation rules.
- Automatic waitlist promotion upon booking cancellations and no-show grace period expiry.
- Administrative manual overrides requiring explicit justification and writing append-only audit entries.
- Privacy-preserving public queue projections sanitizing all PII and accommodation details.
- Storage-adapter abstraction (`read`, `write`, `remove`) defaulting to in-memory with zero external dependencies.

---

## Priority Policy & Classification Rules

| Priority Class | Target Segment | Eligibility Criteria | Guardrail / Rule | Explainable Reason Code |
| :--- | :--- | :--- | :--- | :--- |
| **`P0` — Emergency** | Life-safety, disaster, or urgent critical services | Explicitly designated emergency services only (e.g., emergency ambulance, disaster shelter) | **Reject Citizen Self-Selection**: Non-emergency services requesting `P0` are rejected immediately (`400 Bad Request`). | `P0_EMERGENCY_DESIGNATED`<br>`REJECT_UNAUTHORIZED_EMERGENCY` |
| **`P1` — Time-Critical** | Statutory deadlines or court-mandated filings | Verified statutory deadline (`hasStatutoryDeadline === true`) or documented limitation constraints | Must supply deadline parameter or statutory reference. | `P1_STATUTORY_DEADLINE` |
| **`P2` — Accessibility Accommodation** | Citizens requiring assistive or accessible access | Any declared accessibility accommodation requirement (e.g. step-free wheelchair access, sign language, tactile guide) | **No Medical Diagnosis Required**: Modeled purely as an accommodation requirement. Public projections never display sensitive accommodation details. | `P2_ACCOMMODATION_MATCHED` |
| **`P3` — Standard** | General civic facilitation bookings | All other eligible citizen requests | Default class. | `P3_STANDARD_ALLOCATION` |

---

## Anti-Starvation Aging & Tie-Breaking

### Aging Formula
To prevent low-priority (P3) requests from being perpetually starved by incoming P2/P1 requests during sustained demand peaks, waitlisted requests earn an **effective priority boost** over time:

$$\text{effectiveRank} = \max\left(0, \text{baseRank} - \left\lfloor \frac{\text{now} - \text{waitlistedAt}}{\text{agingWindowMs}} \right\rfloor\right)$$

- Base ranks: `P0 = 0`, `P1 = 1`, `P2 = 2`, `P3 = 3`.
- `agingWindowMs`: Configurable aging window (default: 1 hour).
- A P3 request waiting for $\ge 2 \times \text{agingWindowMs}$ is effectively treated as rank 1 (equivalent to P1) during waitlist promotions, earning the `AGING_BOOST_APPLIED` reason code.

### Deterministic Tie-Breaking
When multiple waitlisted requests compete for a newly released slot:
1. Lowest **effective rank** wins (P0 > P1 > P2 > P3).
2. Earlier `requestedAt` timestamp wins (FIFO within equal rank).
3. Deterministic lexical tie-breaker on `citizenId` (`a.citizenId.localeCompare(b.citizenId)`).

---

## Lifecycle & State Machine

```
   [Citizen Request]
           |
           v
+-----------------------+   Slot Available?
| reserveSlot()         | -----------------> (Yes) -> [RESERVED]
+-----------------------+                      |          |
           | (No)                              |          v
           v                                   |     [CHECKED_IN]
     [WAITLISTED]                              |          |
           ^                                   |          v
           | (Waitlist Promotion)              |     [COMPLETED]
           |                                   |
           +<---- Cancellation / No-Show <-----+
           |
           +----> [CANCELLED] / [NO_SHOW]
```

### No-Show Grace Period & Slot Release
- **`gracePeriodMs`**: Default 15 minutes past slot window start time.
- If a citizen has not checked in after `slotStartTime + gracePeriodMs`, `recordNoShow()` transitions the booking to `NO_SHOW`.
- The released capacity immediately triggers automatic promotion of the top waitlisted request with `WAITLIST_PROMOTED`.

### Administrative Overrides
- Restricted to administrative roles (`admin`, `reviewer`, `official`).
- Requires a mandatory, non-empty `reason` string explaining the operational necessity.
- Generates an append-only audit entry (`SCHEDULER_OVERRIDE_APPLIED`) and appends `ADMIN_OVERRIDE` to the booking's reason codes.

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

Exposed via `scheduler.getMetrics()`:
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

## Deployment & Rollback

- **Zero-Dependency Core**: Standard Node ESM module with no third-party libraries.
- **Rollback**: If anomalies occur, reverting to previous counter booking behaviour is instantaneous by bypassing `createFairScheduler` without affecting client-side readiness scorecards or static facility boards.

---

## Slice 2 Roadmap

- **Durable Firestore Adapter**: Implementation of `createSchedulerStorageAdapter` backed by Google Cloud Firestore with optimistic document versioning.
- **Live WebSocket / SSE Push**: Real-time token projection updates for physical counter display screens.
- **Counter Journeys Integration**: Integration into `api/counter-journey.js` for simulated token allocation during guided onboarding.
