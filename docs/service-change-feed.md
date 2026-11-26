# Versioned Civic Service Change Feed with Saved-Item Impact Notifications (#762)

## Architectural Overview

The Versioned Civic Service Change Feed provides a dedicated, reliable capability for tracking material amendments to civic service records, required application documents, statutory fee schedules, and official gazette citations. It links these updates directly to citizens' saved service checklists and subscriptions through an explainable, human-in-the-loop review workflow.

```
┌─────────────────────────────────┐
│ Service Version Snapshot        │ (Immutable version records)
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│ Deterministic & Semantic Diff   │ (Field-by-field before/after analysis)
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│ Materiality Recommendation      │ (Automated scoring + explainability breakdown)
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│ Human-in-the-Loop Review Desk   │ (Gate: Notifications withheld until approval)
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│ Idempotent Impact Dispatcher    │ (Cross-checks user subscriptions & saved items)
└─────────────────────────────────┘
```

## Data Model & Normalized Entities

The feature is built on five normalized core entities:

1. **`ServiceVersion`**:
   - `id`, `serviceId`, `version`, `effectiveDate`, `authority`, `jurisdictionId`, `title`, `guidanceText`, `requiredDocuments`, `fees`, `slaDays`, `sourceUrl`, `editorId`, `createdAt`, `schemaVersion`.
   - **Immutability Invariant**: Historical versions are never overwritten or mutated in place.

2. **`ChangeEvent`**:
   - `id`, `serviceId`, `changeType`, `changeReason`, `changeTitle`, `effectiveDate`, `editorId`, `changedAt`, `affectedJurisdictions`, `isMaterial`, `materialityRecommendation`, `officialGazetteCitation`, `status` (`pending`, `approved`, `rejected`, `archived`), `idempotencyKey`.

3. **`ReviewApproval`**:
   - `id`, `changeEventId`, `approverId`, `decision` (`approved`, `rejected`), `decidedAt`, `reason`.

4. **`Subscription`**:
   - `id`, `userId`, `serviceId`, `jurisdictionId`, `type`, `frequency` (`immediate`, `daily`, `weekly`), `createdAt`.

5. **`DeliveryAttempt`**:
   - `id`, `idempotencyKey`, `changeEventId`, `recipientId`, `deliveryChannel`, `status`, `attempts`, `attemptedAt`.

## State Transitions & Domain Gating

- **Transitions**:
  - `pending` ➔ `approved` | `rejected` | `archived`
  - `approved` ➔ `archived`
  - `rejected` ➔ `pending` | `approved`
- **Notification Barrier**: Unapproved change events can never trigger notification dispatches or delivery attempts.
- **Materiality Classification**:
  - Material changes (new mandatory documents, increased statutory fees, reduced SLAs, policy overhauls) trigger action-required citizen badges.
  - Non-material changes (typographical/editorial refinements) update public feeds without generating disruptive push/email alerts.

## Rollback Strategy

Under standard administrative jurisprudence and the repository's data retention policy:
- **Never delete or overwrite** historical service versions.
- To roll back an errant policy revision, invoke `rollbackVersion(serviceId, targetVersionId, reason)` which appends an incremented superseding version (e.g., `v3.0-restored`) restoring the target version's specifications with a reference to the cancellation circular.

## Testing & Verification Commands

Run the targeted test suites:
```bash
# Contract and service unit tests
npm test -- --run src/data/changeEventContract.test.js src/services/changeFeedService.test.js

# Component and visual regression tests
npm test -- --run src/pages/ChangeFeedPage.test.jsx

# Production build check
npm run build

# Security lint
npm run lint:security
```
