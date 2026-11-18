# Municipal Greenhouse-Gas Inventory & Emissions Reporting Workspace (#753)

## 1. Overview

The greenhouse-gas (GHG) inventory workspace gives a local authority one auditable place to:

- register municipal emission sources and the departments that own them;
- collect activity data (energy, fuel, waste, lighting) with units, reporting periods,
  source-document metadata and correction notes;
- calculate `tCO2e` from immutable, versioned emission factors;
- separate **measured**, **estimated** and **excluded** values;
- review and approve department submissions before they enter official totals;
- compare reporting periods, export a source-linked inventory, and publish an
  approved aggregate view to citizens.

The workspace is available at `/ghg-inventory` (aliases `/emissions-inventory` and
`/services/ghg-inventory`) and is linked from the main navigation.

---

## 2. Architecture & service boundary

Business rules live in the service and domain layers; React components only render data and
hold form/UI state.

| Layer | File | Responsibility |
| --- | --- | --- |
| Constants | `src/services/ghgInventoryConstants.js` | Enums, state machines, capabilities, units, limits, storage key, error codes |
| Validation | `src/services/ghgInventoryValidation.js` | `GhgInventoryError`, sanitizers, schema/unit/document/PII checks |
| Access control | `src/services/ghgInventoryAccessControl.js` | Role capabilities and jurisdiction scoping |
| Domain contract | `src/data/ghgInventoryContract.js` | Pure conversion, factor resolution, calculation, totals, comparison, export, public projection, estimation rules |
| Persistence | `src/services/ghgInventoryMigrations.js` | One-bundle storage, migrations, indexes, transactions, rollback, retention |
| Service | `src/services/ghgInventoryService.js` | Trusted boundary: permissions, state transitions, reads/writes, audit trail |
| Seed data | `src/data/ghgInventorySeed.js` | Deterministic demo jurisdictions, sources, factors, periods, records |
| API boundary | `api/_lib/handlers/ghg-inventory.js` | Server-side auth, role/jurisdiction checks, validation, rate limiting, idempotency |
| UI | `src/components/ghgInventory/` and `src/pages/GhgInventoryWorkspace.jsx` | Presentation, forms, tables, accessibility states |

All calculation functions are pure. A total can be reproduced from the stored activity value,
the selected factor version id and the period alone.

---

## 3. Data model

Every collection is stored in one atomic JSON bundle under `civic_ghg_inventory_v1`:

```
civic_ghg_inventory_v1
├── meta                  schemaVersion, migrationHistory, lastSavedAt
├── emissionSources       source register (department, category, scope, default factor)
├── activityRecords       quantity, unit, period, data quality, correction note, document metadata
├── emissionFactors       factor definitions (activity unit, source, scope)
├── factorVersions        immutable published values, effective dates, uncertainty
├── reportingPeriods      draft → open → review → approved → locked → archived
├── departmentSubmissions department submission + review state
├── calculationRuns       reproducible snapshots (lines, totals, factor version ids, digest)
├── recommendations       deterministic missing-data estimates awaiting human decision
└── auditEvents           append-only actor/action/reason trail
```

Important relationships:

- An activity record belongs to one submission, one source, one period and one factor version.
- A calculation run records the exact factor version ids and activity record ids used, so a
  later factor publication cannot silently change historical totals.
- A submission is the approval unit. **Only records whose submission is `approved` (or later
  `locked`) are included in official totals and public views.**

### Write atomicity

`runGhgTransaction` clones the bundle, runs the mutator, and writes the new bundle once.
If the mutator throws, the previous bundle is left untouched. When `localStorage` is
unavailable or full, the same API falls back to an in-memory store so the workflow still
functions and the UI can show an offline notice. A single storage key keeps multi-collection
writes atomic without a database.

### Indexes and migrations

`buildGhgIndexes` derives lookup maps for sources, factors, periods, submissions and records.
Migrations are versioned by `GHG_SCHEMA_VERSION`; the migration runner records every step in
`meta.migrationHistory`. Unknown or corrupt bundles are repaired into a valid shape rather than
crashing the page.

---

## 4. Methodology & formula

### 4.1 Emission calculation

Each activity line is calculated deterministically:

```
tCO2e = quantity × factor value
```

with unit conversion first:

```
factorQuantity = quantity × (source unit → base) ÷ (factor unit → base)
```

Supported dimensions are energy (`kWh`, `MWh`, `GJ`), volume (`L`, `kL`) and mass
(`kg`, `t`). A dimensional mismatch (for example litres against a kWh factor) is rejected with
`GHG_UNIT_MISMATCH`; it is never silently converted. Values are rounded to 4 decimal places
only at presentation/storage boundaries, not during accumulation.

The generated formula string is stored on the calculation line, for example:

```
18,500 L × 2.68 tCO2e/kL = 49.58 tCO2e
```

### 4.2 Factor version resolution

Emission factors are **versioned and immutable**. A version has `effectiveFrom`,
`effectiveTo`, `factorValue`, `activityUnit` and `uncertaintyPercent`.

- Calculation resolves the published version effective on the activity date (or the period
  end date when no activity date exists).
- An explicitly requested version must belong to the factor and be effective on that date;
  otherwise the service throws `GHG_FACTOR_UNAVAILABLE`.
- Draft, retired and unpublished versions can never produce official totals.
- Publishing a new version closes the previous version's `effectiveTo` but keeps it
  `published`, so historical runs remain reproducible.

### 4.3 Period totals

`computePeriodTotals` returns:

- `totals.tCO2e` — measured + estimated;
- `totals.measuredTCO2e`, `totals.estimatedTCO2e`, `totals.excludedTCO2e`;
- measured/estimated share percentages;
- category buckets and shares;
- per-line formula, warnings, factor version and uncertainty;
- the sorted factor version ids and activity record ids used.

Excluded lines contribute `0` to totals but retain their gross calculated value so reviewers
can see what was set aside. Missing sources produce a `missing_activity` warning, never an
implicit zero.

### 4.4 Comparison

`compareCategoryTotals` compares two runs by category. When the baseline is zero it returns
`percentChange: null` instead of a misleading infinite percentage.

---

## 5. Data quality & uncertainty

Each activity record is explicitly one of:

| Quality | Meaning | Effect on totals |
| --- | --- | --- |
| `measured` | Meter reading, invoice or weighbridge ticket | Included, counted as measured |
| `estimated` | Labelled estimate, including accepted recommendations | Included, counted as estimated and disclosed |
| `excluded` | Outside the inventory boundary (for example a leased asset) | Shown, but not added to totals |

Quality flags surface in both staff and public views:

- `zero_quantity` — confirm a real zero, not a missing reading;
- `unit_converted` — the original unit was converted before applying the factor;
- `estimated_total` — the line is an estimate;
- `excluded_from_total` — excluded by the department;
- `missing_activity` — no record for a source in the period;
- `uncertainty_above_30_percent` — order-of-magnitude result;
- `stale_calculation` — an approval changed after the latest run.

### Uncertainty bands

Factor versions carry `uncertaintyPercent`. Severity is deterministic:

- `low` — below 10%;
- `medium` — 10% to below 30%;
- `high` — 30% or above (with an explicit warning on the line).

Estimated recommendations calculate uncertainty as `min(90, 12 + historical spread %)`, where
spread is `(max − min) ÷ mean × 100` across the lookback window. This is an order-of-magnitude
band, not a statistical confidence interval.

### Human-controlled estimates

`buildMissingDataRecommendation` uses ruleset `ghg-forecast-rules-2026.1`:

1. Use up to three prior approved periods;
2. Average the historical quantities;
3. Apply the factor version effective for the target period;
4. Record the rule version, feature window, source fields, explanation and uncertainty.

Recommendations are `pending` until a reviewer **accepts**, **edits** or **rejects** them.
Acceptance creates an activity record with `dataQuality: estimated`; it never overwrites a
measured record, and `GHG_MEASURED_DATA_PROTECTED` blocks any attempt to do so.

---

## 6. Roles, jurisdiction and workflow

### Roles

| Role | Capabilities |
| --- | --- |
| `public` / `citizen` | Read published aggregates only |
| `operator` | Manage sources, create/edit/submit department data, run calculations, export |
| `reviewer` | Review/approve/return/reject submissions, decide estimates, read audit trail |
| `admin` | All of the above plus factor publication, period management, migrations |

The workspace includes a demo role-perspective selector to exercise these paths. In
production, roles come from verified Clerk session claims, not from the selector.

### Jurisdiction scope

Every protected read and write checks the actor's jurisdiction against the entity. Platform
admins may operate across jurisdictions; other staff are confined to their assigned
jurisdiction. A payload that claims a different jurisdiction from the reporting period is
rejected with `GHG_JURISDICTION_DENIED`.

### Submission state machine

```
draft → submitted → under_review → approved → locked
                  ↘ changes_requested ↗
                  ↘ rejected → draft
```

- `draft` can only move to `submitted`; it cannot jump straight to `locked`.
- `changes_requested` returns the submission to the department for correction and resubmission.
- `approved` enters official totals and may later be locked for audit.
- Returning, rejecting or reopening requires a written reason stored in the audit trail.
- `locked` is terminal.

### Period state machine

`draft → open → review → approved → locked → archived`, with `open ↔ review` and
`review → open` corrections allowed before approval.

---

## 7. Public projection guarantees

`getPublicInventorySummary` is the only public read path. It:

- considers only periods whose status is `approved`, `locked` or `archived`;
- aggregates only activity records from approved submissions;
- returns no internal ids, actor names, private notes, contacts, correction notes or
  document contents;
- returns `available: false` with a reason when nothing is published or the approved period has
  no approved records;
- exposes totals and categories only, plus non-info warnings and the disclosure statement:

> Public view shows approved aggregate data only. Department notes, internal identifiers and
> source documents are not published.

The seeded current period `PER-2026-27` is deliberately `open`, so the public route shows the
"not yet approved" state until a reviewer approves it.

---

## 8. Server-side API boundary

`/api/ghg-inventory` (handler: `api/_lib/handlers/ghg-inventory.js`) is the trusted write
boundary for department clients.

**GET** returns the published summary (`periodId`, `jurisdictionId`, default `WARD-042`), or
an `available: false` payload when no summary provider is configured.

**POST** enforces, in order:

1. JSON body limit (256 KiB) and `413` on oversize;
2. per-IP rate limit (10 requests/minute) with `429` and `Retry-After`;
3. Clerk session verification via injected `verifySession`/`resolveActor` (`503` when
   unconfigured, `401` for missing/invalid tokens);
4. operator or administrator role (`403 forbidden_role`);
5. jurisdiction assignment (`403 jurisdiction_forbidden`);
6. strict schema, unit, duplicate-record, document-metadata and PII validation (`422`);
7. durable persistence via GHG repository (`api/_lib/ghgInventoryRepository.js`) with atomic
   Firestore transactions:
   - the same `jurisdictionId:idempotencyKey` returns the original receipt with `replayed: true` (200);
   - key reuse with a conflicting activity payload is rejected with `409 idempotency_conflict`;
   - concurrent duplicates are collapsed by single-flight execution and transaction locks;
   - shared storage failures answer `503 database_unavailable`.

Document contents (`file`, `fileData`, `base64`, `content`, `documentData`, `buffer`) are
rejected; only name, MIME type, size and checksum are accepted, and only PDF, CSV and XLSX
metadata is allowed.

Stable error codes include `GHG_VALIDATION_ERROR`, `GHG_PERMISSION_DENIED`,
`GHG_UNAUTHENTICATED`, `GHG_JURISDICTION_DENIED`, `GHG_INVALID_STATE_TRANSITION`,
`GHG_UNIT_MISMATCH`, `GHG_FACTOR_UNAVAILABLE`, `GHG_IDEMPOTENCY_CONFLICT`,
`GHG_RATE_LIMITED`, `GHG_STALE_CALCULATION`, `GHG_MEASURED_DATA_PROTECTED`,
`GHG_UNSUPPORTED_FILE` and `GHG_MIGRATION_FAILED`.

---

## 9. Accessibility & UI states

The workspace provides:

- loading, empty, stale, offline, permission-denied and error states;
- a roving-tabindex tab list with arrow/Home/End keyboard support;
- semantic headings, table captions and labelled form controls;
- screen-reader announcements for calculation, export, review and error outcomes;
- a table/list alternative to charts, so totals are readable without visual graphs;
- responsive layouts for narrow screens;
- explicit labels for measured, estimated and excluded data.

---

## 10. Retention, rollback & recovery

The bundle is a **municipal operating record**, retained under `RETAINED_STORAGE_KEYS` in
`src/services/privacyConsentService.js`; clearing a citizen's personal data must not erase the
public inventory or its audit trail.

`applyGhgRetentionPolicy({ retentionYears = 7, draftRetentionDays = 180 })`:

- archives approved/locked periods older than the retention window (values remain for audit);
- removes document metadata from archived periods (the department keeps the original);
- purges abandoned draft submissions and their draft records older than the draft window.

Recovery tools:

- `rollbackGhgStorage()` — removes the bundle and restores deterministic seed data;
- `resetGhgStorageToEmpty()` — removes the bundle and writes a valid empty schema;
- the workspace's admin maintenance panel exposes these operations for demos/tests.

For production, take a storage snapshot before a migration and keep it with the release
record. Migration failures throw `GHG_MIGRATION_FAILED` and leave the previous bundle intact.

---

## 11. Setup & verification

No extra environment variables are required for the browser workspace; seed data is loaded on
first visit.

```bash
# Install
npm install

# Run the app
npm run dev

# Domain contract (conversion, factors, totals, export, public projection)
npx vitest run src/data/ghgInventoryContract.test.js

# Roles, capabilities and jurisdiction scope
npx vitest run src/services/ghgInventoryAccessControl.test.js

# Storage shape, migrations, transactions, rollback and retention
npx vitest run src/services/ghgInventoryMigrations.test.js

# Service orchestration and state machines
npx vitest run src/services/ghgInventoryService.test.js

# Workspace UI, accessibility and resilience states
npx vitest run src/pages/GhgInventoryWorkspace.test.jsx

# Serverless API auth, idempotency and abuse guards
npx vitest run tests/ghg-inventory.test.js

# Full checks
npm test
npm run lint
npm run lint:security
npm run build
```

---

## 12. Limitations & non-goals

- The browser bundle is a single-node demo/operating surface, not a multi-user database. A
  production deployment should persist the same model in a transactional database and keep
  the service contract unchanged.
- The API endpoint queues validated submissions; it does not itself approve or publish data.
- Uncertainty values are deterministic planning bands, not statistically calibrated
  confidence intervals.
- The module reports operational municipal emissions; it does not calculate scope 3
  value-chain emissions beyond sources an authority explicitly registers.
- The demo role selector is a training aid. Production authorisation must come from verified
  session claims.
