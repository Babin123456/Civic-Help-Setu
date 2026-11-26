# Disaster Relief Needs & Resource Allocation (#747)

The Relief Operations Workspace turns scattered disaster-relief reports into a
verifiable supply chain: a citizen, verified partner or field operator reports a
need; an operator verifies it; a deterministic forecast clusters demand and
recommends quantities; a named human creates an allocation proposal; a second
reviewer approves it, which reserves stock in the same transaction; a team is
dispatched; and the receiving role confirms the distribution. Every step is
audited.

- Route: `/relief-operations` (also `/disaster-relief` and
  `/services/relief-operations`)
- Navigation: **Disaster Relief Operations**
- Page: `src/pages/ReliefOperationsWorkspace.jsx`
- Service boundary: `src/services/reliefOperationsService.js`
- Public intake API: `POST /api/relief-operations`, aggregate
  `GET /api/relief-operations`

The feature is a working operational module, not a static visualisation. Data is
persisted per collection, validated at the trusted boundary, and protected by
role, capability and jurisdiction checks that do not trust the UI.

## Why this shape

The implementation follows the repository's existing `streetlight` feature
pattern: a client-side trusted service boundary with explicit storage
collections, pure migration functions, seeded simulation data and a serverless
edge for untrusted public intake. This keeps the workflow runnable in local
development and tests without external infrastructure, while keeping all
validation and authorisation out of React components.

## Normalised collections

Storage keys are defined in `RELIEF_STORAGE_KEYS`
(`src/services/reliefOperationsConstants.js`).

| Collection | Key | Purpose |
| --- | --- | --- |
| `relief_incidents` | `civic_relief_incidents_v1` | Disaster events, public summaries and status |
| `need_reports` | `civic_relief_need_reports_v1` | Citizen, partner and field-team needs |
| `resource_inventory` | `civic_relief_resource_inventory_v1` | Stock batches, quantities and expiry |
| `stock_movements` | `civic_relief_stock_movements_v1` | Append-only receipt/reservation/release/issue ledger |
| `distribution_sites` | `civic_relief_distribution_sites_v1` | Public and internal distribution points |
| `allocation_proposals` | `civic_relief_allocation_proposals_v1` | Human-approved supply proposals |
| `delivery_confirmations` | `civic_relief_delivery_confirmations_v1` | Dispatch and receipt records |
| `partner_verifications` | `civic_relief_partner_verifications_v1` | Verified relief partners |
| `forecast_runs` | `civic_relief_forecast_runs_v1` | Versioned recommendation snapshots (last 50) |
| `audit_logs` | `civic_relief_audit_logs_v1` | Append-only action log |
| `archive` | `civic_relief_archive_v1` | Retention archive for closed records |
| `migration_meta` | `civic_relief_meta_v1` | Schema version and migration timestamp |

Indexes are rebuilt after every write by `buildReliefIndexes`:

- needs by id, tracking token, jurisdiction, category+status and createdAt day
- resources by id, jurisdiction+category
- allocations by id, status, jurisdiction and createdAt day
- allocations by linked need and resource batch
- deliveries by allocation
- stock movements by resource
- partners by id
- audits by jurisdiction

## Domain states

Need reports (`NEED_TRANSITIONS`):

```
submitted → verified → triaged → allocated → fulfilled
         ↘ rejected → submitted (correction)
         ↘ duplicate (terminal)
```

Incidents:

```
draft → active → containment → closed → archived
              ↘ closed
containment → active (re-escalation)
```

Allocation proposals:

```
pending_approval → approved* → reserved → dispatched → delivered → confirmed
                 ↘ rejected              ↘ cancelled
                 ↘ cancelled / expired
```

`approved` is a transient transition target. In this implementation the human
approval and the stock reservation happen in one transaction, so the stored
state becomes `reserved`.

Deliveries: `pending → en_route → delivered → confirmed`, with `failed` and
`cancelled` branches.

Invalid transitions return `RELIEF_INVALID_STATE_TRANSITION` with the allowed
targets in `details.allowed`.

## Roles and least privilege

Roles are resolved from the authenticated actor by
`src/services/reliefOperationsAccessControl.js`. A caller cannot pass their own
role in a mutation payload.

| Capability | public | citizen | partner | operator | reviewer | admin |
| --- | --- | --- | --- | --- | --- | --- |
| Submit a need | ✓ | ✓ | ✓ (verified partner only) | ✓ | ✓ | ✓ |
| Read operational needs/inventory | | | | ✓ | ✓ | ✓ |
| Verify / triage / reject needs | | | | ✓ | | ✓ |
| Propose an allocation | | | | ✓ | | ✓ |
| Approve / reject an allocation | | | | | ✓ | ✓ |
| Dispatch | | | | ✓ | | ✓ |
| Confirm delivery | | | | ✓ | ✓ | ✓ |
| Run forecast | | | | ✓ | | ✓ |
| Read audit trail / partners | | | | | ✓ | ✓ |
| Verify partners | | | | | | ✓ |

Jurisdiction scope is enforced on every mutation and on operational reads.
Operators and reviewers are bound to their assigned ward. An unrestricted admin
(no jurisdiction assignment) may work across wards. Public and citizen callers
are never given operational records; they receive aggregate projections.

Separation of duty is enforced in the service: `createdBy` must differ from the
approving reviewer's actor id.

## Bounded AI / deterministic forecast

`src/services/reliefForecastEngine.js` implements a local, deterministic
ruleset, `relief-forecast-rules-v1.0.0`. No network call is made, so the
workspace works during an outage.

What it does:

1. Filters open, non-archived, non-duplicate reports inside the feature window
   (default 7 days).
2. Clusters by jurisdiction + locality + category.
3. Averages coordinates into a centroid for display only and records the
   maximum spread in metres.
4. Estimates a recommended supply quantity by applying a recency factor to each
   report's unfulfilled quantity, plus urgency weighting.
5. Scores priority from urgency, people affected, verification ratio, recency
   and category weight.
6. Assigns confidence from report count, verification ratio and freshness.

Every recommendation records:

- `modelVersion` and `rulesetVersion`
- `featureWindow` (`from`, `to`, `days`)
- `executedAt`
- `evidence`: report count, verified count, duplicate count, report ids, source
  fields, newest report timestamp, centroid and spread
- `freshness`: evaluated time, newest report age, stale count, stale flag and
  freshness limit
- `explanation`: plain-language factors
- `requiresHumanApproval: true`
- `requiresMedicalReview` and `triageDecisionMade: false`

Policy boundaries:

- Recommendations never approve, reserve, dispatch or issue stock.
- Medicine demand is a **quantity only**. The engine does not diagnose, triage
  or rank patients, and the UI states this explicitly. A qualified medical
  reviewer decides care.
- No inferred sensitive attributes (caste, religion, gender, disability,
  health status) are used or stored.
- `buildDeterministicFallback` is available when a caller requests the
  conservative path; it sums remaining quantities, marks every recommendation
  low confidence, and still requires human approval.

Stale reports stay in the forecast but lower confidence and raise a visible
stale flag, so an operator never sees an unqualified number.

## Transactions and double-allocation prevention

`transaction()` in the service snapshots every collection, applies the mutator to
a deep copy, and persists only when the mutator succeeds. On failure the previous
snapshot is written back. This makes approval + reservation + movement + audit a
single unit.

Approval re-checks availability **inside** the transaction:

```
available = quantityOnHand - quantityReserved
```

Two reviewers approving proposals for the same batch cannot both succeed once
the unreserved quantity is exhausted; the second approval fails with
`RELIEF_INSUFFICIENT_STOCK` and its proposal remains `pending_approval`.
Partial delivery releases the unused reservation and records both an `issue` and
a `release` movement.

## Idempotency and duplicate handling

- Need submissions accept an optional idempotency key. Replaying the same
  payload returns the original public receipt; a different payload with the same
  key fails with `RELIEF_IDEMPOTENCY_CONFLICT`.
- Allocation proposals accept an idempotency key and replay the original
  proposal.
- Duplicate reports are detected within a 12-hour window by matching
  jurisdiction, category and locality plus either an explicit dedupe fingerprint
  or 70% description-token overlap or near-identical coordinates. The duplicate
  is stored with status `duplicate`, linked to the primary report, and excluded
  from demand and forecast counts.
- The public API also applies single-flight and per-address rate limiting.

## Privacy and public projections

Public projections are allow-list based, never "remove a few fields" filters.

- Public need: tracking token, category/label, locality, jurisdiction, quantity,
  fulfilled quantity, people affected, urgency, status, timestamps. No record
  id, description, incident id, partner id, reporter reference, private note or
  coordinates.
- Public site: only sites marked public.
- Public incident: only non-draft incidents, public summary only.
- Aggregate public status: counts, people affected, unfulfilled quantities, and
  public sites. No report identifiers, tokens, descriptions or private notes.

The UI never displays a citizen's contact details and does not collect them.
Free-text fields are scanned for Aadhaar, PAN, phone numbers and email addresses;
matches are rejected rather than redacted silently. The public API applies the
same checks server-side and returns only a receipt with a tracking token.

## Security threat model

| Threat | Control |
| --- | --- |
| Duplicate submission / replay | Idempotency keys, fingerprint conflict detection, single-flight, duplicate merge |
| Double allocation | Transactional availability check and stock reservation |
| Privilege escalation | Server/trusted-boundary role resolution; capability table; UI never supplies role |
| Cross-jurisdiction access | Scope assertion on every read and mutation; unrestricted admin is explicit |
| Malicious upload / HTML injection | Only JSON fields; script/tag/control-character sanitisation; no `dangerouslySetInnerHTML`; security lint |
| PII leakage | Allow-list public projections, PII rejection, aggregate-only public API |
| Audit tampering | Append-only log; corrections add entries; restricted to reviewer/admin |
| Expired or unfit stock | Expiry check at proposal and approval; quarantine/write-off status blocks allocation |
| Separation-of-duty abuse | Proposer cannot approve their own proposal |
| Rate-limit abuse | Public API and service-level submission window |
| Stale data misuse | Freshness flags, confidence downgrade, explicit UI warning |

## Migrations, retention and rollback

`src/services/reliefOperationsMigrations.js`:

- `migrateReliefData(rawData, fromVersion)` is pure and idempotent. It normalises
  legacy keys (`reports`, `inventory`, `distributionSites`, `proposals`,
  `partnerVerifications`, `deliveryConfirmations`, `reliefIncidents`,
  `stockMovements`) and fills required timestamps, statuses, tracking tokens and
  schema versions.
- An empty database seeds the synthetic dataset.
- `ensureReliefData()` loads, validates and indexes; corrupt storage re-seeds
  rather than throwing at boot.
- `persistReliefData()` writes all collections and rebuilds indexes.
- `rollbackReliefStorage()` removes every relief key and restores the seed.
- `applyReliefRetentionPolicy()` anonymises terminal needs older than the
  retention window (drops reporter references, free text, private notes and
  coordinates), archives closed incidents, and moves old audit entries to the
  archive store.
- If `localStorage` throws (privacy mode/quota), an in-memory fallback keeps the
  feature usable for the session.

Migration tests cover an empty database and a representative legacy dataset,
idempotent re-runs, index construction, rollback, retention/anonymisation and
storage failure fallback.

### Rollback runbook

1. Call `rollbackReliefStorage()` from the app console or a maintenance script.
2. Or clear the `civic_relief_*` keys from `localStorage`.
3. Reload `/relief-operations`; the seed dataset is restored.
4. To roll back a code deployment, revert the release commit. The previous
   version ignores the new keys, and the forward migration is additive.

Because reservations are transactional, there are no partial allocations to
repair after a rollback.

## Public API

`api/_lib/handlers/relief-operations.js` is registered in `api/[...path].js`.

- `POST /api/relief-operations`
  - Strict allow-list validation (category, locality, jurisdiction, description,
    quantity, people affected, urgency, optional idempotency key).
  - PII rejection, per-address rate limit (10/minute), single-flight.
  - Returns `201` with a safe receipt (receipt id, tracking token, aggregate
    fields). Returns `200` on an idempotent replay and `409` on a conflicting
    replay.
- `GET /api/relief-operations?jurisdictionId=WARD-150`
  - Aggregate counts only. No report ids, tokens, descriptions or private data.

This endpoint never allocates, approves, diagnoses or triages anything. The
authenticated operator workflow runs through the service boundary in the app.

## Seeded simulation data

`src/data/reliefOperationsSeed.js` contains fully synthetic incidents, needs,
stock batches, sites, partners, one pending allocation and stock movements across
WARD-150, WARD-042 and WARD-174. Timestamps are generated relative to load time
so freshness, stale-data and forecast signals are meaningful. No real person,
address, phone number or identifier is present.

The UI includes a **Viewing as** switcher (public, citizen, verified partner,
operator, reviewer, administrator) so every role path and permission-denied
state can be exercised without external accounts.

## Local setup and tests

From the repository root:

```bash
npm ci
npm run dev          # open http://localhost:5173/relief-operations
npm run lint
npm run lint:security
npm test
npm run build
```

Focused suites:

```bash
npx vitest run src/services/reliefOperationsService.test.js       # workflow, RBAC, transactions, duplicates, PII
npx vitest run src/services/reliefForecastEngine.test.js          # clustering, forecast, fallback, medical boundary
npx vitest run src/services/reliefOperationsMigrations.test.js    # empty DB, legacy data, rollback, retention
npx vitest run src/pages/ReliefOperationsWorkspace.test.jsx       # page and component/accessibility tests
npx vitest run tests/relief-operations-api.test.js                # public API validation, abuse and privacy
```

## Manual acceptance script

1. Open `/relief-operations`. Confirm the nav entry exists and the page title is
   visible.
2. As **Relief operations operator**, run the forecast. Confirm each
   recommendation shows quantity, priority, confidence, report counts, freshness,
   ruleset version and execution time.
3. Create a proposal from a recommendation, accepting or editing the quantity.
4. Switch to **Allocation reviewer**. Approve the proposal. Confirm the status
   becomes **Stock reserved** and the stock available quantity drops.
5. Try to approve a second proposal for more than the remaining stock; confirm it
   fails and stays pending.
6. Switch to **Relief operations operator**, dispatch the reservation, then
   switch to the reviewer and confirm the delivery. Confirm the need's fulfilled
   quantity rises, the reservation falls to zero and stock movements record
   `issue`.
7. Open **Audit trail**. Confirm actor, role, reason and before/after values are
   present for every action.
8. Switch to **Public visitor**. Confirm only aggregate counts and public sites
   are visible, no tokens or descriptions appear, and a need report can be
   submitted with a tracking token.
9. Submit the same report twice and confirm the second is linked as a duplicate.
10. Tab through the page with the keyboard only. Confirm visible focus, labelled
    controls, table captions, status announcements and text (not colour-only)
    status badges.
11. Resize to a narrow viewport and confirm the tables scroll and the layout does
    not overlap.
