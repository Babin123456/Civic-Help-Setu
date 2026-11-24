# Civic Service Change Sandbox with Shadow Traffic Evaluation (#1181)

## 1. Overview

The **Civic Service Change Sandbox with Shadow Traffic Evaluation** is a
maintainer workspace for comparing a proposed service workflow against current
behavior before publishing it.

It creates **versioned staging snapshots**, replays **synthetic journeys** and
opt-in anonymized aggregate patterns, compares **completion, validation and
accessibility outcomes**, **blocks writes to production during shadow runs**,
and supports **rollback** and **deterministic replay**.

Available at `/service-change-sandbox`.

---

## 2. Architecture decision record (ADR)

### 2.1 Context

Maintainers need to understand how a proposed service change (new steps,
documents, validation rules) would affect completion, validation failures and
accessibility before publishing it to production. Deploying blindly risks
introducing friction, validation regressions or accessibility barriers for
citizens. A sandbox that replays synthetic traffic against both the baseline
and proposed versions, and blocks production writes during the comparison,
lets maintainers decide with evidence.

### 2.2 Decision

Use a **deterministic shadow-traffic sandbox** with versioned staging
snapshots. Replay synthetic journey patterns against the baseline and proposed
service versions, compare aggregate outcomes, block production writes during
active shadow runs, and require explicit human approval to publish or roll back.

| Principle | Implementation |
|---|---|
| Versioned staging snapshots | `src/data/civicServiceChangeSandboxData.js` holds `STAGING_SNAPSHOTS` with `fromVersionId`, `toVersionId`, status and deterministic seed. |
| Deterministic replay | `seededRandom` seeded by snapshot + seed; same inputs always produce identical comparison outcomes (`reproducibility.seed`). |
| Synthetic journeys only | `SYNTHETIC_JOURNEY_PATTERNS` are aggregate, anonymized journey patterns; zero citizen data. |
| Compare completion, validation, accessibility | `runShadowTraffic` computes completion delta, validation failure delta, accessibility issues delta, completion time delta and document drop-off delta. |
| Block production writes during shadow runs | `PRODUCTION_WRITE_BLOCK_STATE`; `publishSnapshot` is blocked when an active (reviewing) shadow run holds the write block. |
| Rollback support | `rollbackSnapshot` sets status to `rolled-back`; requires explicit human approval. |
| Deterministic rules outside LLM prompts | All comparison maths is plain JS; no model is invoked. |
| AI outputs are untrusted suggestions with provenance | Every result carries `untrusted: true`, `requiresHumanReview: true`, `noCitizenData: true`, `illustrative: true`, `provenance`, `schemaVersion`. |
| Validate all external input at trust boundaries | `validateServiceChangeRequest` runs on client and server; rejects sensitive fields/values and unknown ids. |
| Explicit human approval for high-impact actions | Publish and rollback require `humanApproved: true`. The sandbox never files applications, denies benefits or claims official verification. |

### 2.3 Component ownership

| Component | File | Owner | Responsibility |
|---|---|---|---|
| Data contract | `src/data/civicServiceChangeSandboxData.js` | Maintainer | Versioned synthetic snapshots, versions, journey patterns, shadow runs, comparisons |
| Sandbox engine | `src/services/civicServiceChangeSandboxService.js` | Maintainer | Validation, deterministic replay, comparison, publish/rollback/create, storage |
| API boundary | `api/_lib/handlers/service-change-sandbox.js` | Maintainer | Auth, rate limiting, structured errors, HTTP wiring |
| UI workspace | `src/components/serviceChangeSandbox/ServiceChangeSandboxWorkspace.jsx` | Maintainer | Snapshot selection, shadow run, comparison report |
| Page | `src/pages/ServiceChangeSandboxWorkspace.jsx` | Maintainer | Route entry point |
| Tests | `src/services/civicServiceChangeSandboxService.test.js`, `tests/service-change-sandbox-api.test.js`, `src/components/serviceChangeSandbox/*.test.jsx` | Maintainer | Unit, integration, API tests |
| Documentation | `docs/civic-service-change-sandbox.md` | Maintainer | ADR, data flow, threat model, deployment, evaluation |

### 2.4 Failure handling

- Invalid input → structured `{ error.code, error.message, errors[] }` HTTP 400.
- Unknown snapshot/version/pattern → specific not-found error, never a 500 from bad input.
- Production write blocked → `SCS_PRODUCTION_WRITE_BLOCKED` during active shadow runs; publish is refused.
- Publish/rollback without human approval → `SCS_PERMISSION_DENIED`.
- Storage unavailable → `SCS_STORAGE_UNAVAILABLE`, UI degrades to ephemeral-only.
- Rate limit exceeded → HTTP 429 with `Retry-After`.
- Network failure during run → error banner with Retry button; no partial state shown as truth.
- Stale data (past review window) → `isStale: true`, banner shown.

---

## 3. Data flow

```
[Maintainer]
   │ selects snapshot + journey patterns + replay count + seed
   ▼
[src/components/serviceChangeSandbox/SnapshotSelector.jsx]
   │ POST /api/service-change-sandbox  { action: 'run', ...parameters }
   ▼
[api/_lib/handlers/service-change-sandbox.js]
   ├─ rate limit (per address + per user)
   ├─ validateServiceChangeRequest (trust boundary)
   ├─ runShadowTraffic (deterministic orchestration)
   │     ├─ snapshot / version / pattern lookup
   │     ├─ replayJourneyPattern against baseline (fromVersionId)
   │     ├─ replayJourneyPattern against proposed (toVersionId)
   │     ├─ aggregate baseline vs proposed outcomes
   │     ├─ compute deltas + deterministic recommendation
   │     └─ attach reproducibility seed, schemaVersion, dataVersion
   ▼
[returns { ok, run: { snapshot, baseline, proposed, comparison, journeyRuns,
                  reproducibility, untrusted, requiresHumanReview,
                  noCitizenData, illustrative }, isStale, disclaimer }]
   ▲
   │ renders baseline vs proposed, deltas, recommendation + disclaimer
[ServiceChangeSandboxWorkspace.jsx + ComparisonResults.jsx]
   │
   ▼
[Maintainer reviews comparison; publish/rollback require explicit human approval]
```

### 3.1 Trust boundaries

| Boundary | Enforcement |
|---|---|
| Client → API | `validateServiceChangeRequest` on both sides; sensitive-key/value scans; slug and range checks |
| API → Engine | Only validated parameters reach `runShadowTraffic` |
| Engine → UI | Outputs carry `untrusted: true`, `requiresHumanReview: true`, `disclaimer` |
| Storage (save-run) | Only run metadata (snapshot, status, summary); authentication required to save |

---

## 4. Threat model

### 4.1 Assets

- Staging snapshots and service version definitions.
- Shadow traffic run records (saved in `localStorage` under `civicbridge_service_change_sandbox_v1`).
- Production write block state.

### 4.2 Threats and mitigations

| Threat | Impact | Mitigation |
|---|---|---|
| PII or credentials sent in sandbox request | Data leakage | `findSensitiveKeys` / `collectSensitiveText` reject passwords, OTPs, Aadhaar, PAN, phone, income amounts; request bodies/headers never logged |
| Sandbox mistaken for trusted verdict | Harmful deployment decision | Every result carries `untrusted: true`, `requiresHumanReview: true`, `disclaimer`; labelled illustrative |
| Unintended production write during comparison | Production data corruption | `PRODUCTION_WRITE_BLOCK_STATE` blocks publishes during active (reviewing) shadow runs |
| Synthetic data mistaken for real citizen data | Privacy harm | `noCitizenData: true` on every result; synthetic fixtures only |
| Publish/rollback without approval | Unauthorized change | `humanApproved: true` required for publish and rollback |
| Replay non-determinism | Incomparable results | Seeded random; `reproducibility.seed` recorded on every run |
| API abuse / DoS | Service degradation | Per-address rate limit (30/min), per-user limit (10/min), `replayCount` capped at 100000 |

### 4.3 Non-goals / explicitly prohibited

- Writing to production during an active shadow run.
- Autonomous publishing or rollback without human approval.
- Claiming official verification of any service change or outcome.
- Treating shadow-traffic output as a trusted citizen decision.
- Using real citizen records, credentials, raw documents or sensitive prompts.

---

## 5. Data model (versioned schema)

Schema version: `civic-service-change-sandbox-v1`

### Service version

```
{ id, serviceId, serviceName, version, status, publishedAt,
  steps[], documentRequirements[], validationRules[],
  accessibilityMetadata, isSynthetic, derivedFrom? }
```

### Staging snapshot

```
{ id, serviceId, fromVersionId, toVersionId, title, description,
  status, createdAt, reviewedAt, approvedBy, humanApproved,
  productionWriteBlocked, deterministicSeed, shadowTrafficEnabled,
  isSynthetic }
```

### Synthetic journey pattern

```
{ id, serviceId, label, completionRate, averageStepsCompleted,
  validationFailureRate, accessibilityIssues, documentDropOffRate,
  isSynthetic }
```

### Shadow traffic run result

```
{ schemaVersion, dataVersion, reviewDate, staleAfterDays, isStale,
  run: { snapshot, baseline, proposed, comparison, journeyRuns,
    reproducibility { seed, schemaVersion, dataVersion },
    disclaimer, illustrative: true, noIndividualPrediction: true,
    noCitizenData: true, untrusted: true, requiresHumanReview: true } }
```

### Comparison result

```
{ id, snapshotId, serviceId, baselineRunId, shadowRunId, label,
  completionDelta, validationFailureDelta, accessibilityIssuesDelta,
  completionTimeDeltaSeconds, documentDropOffDelta, recommendation,
  reasoning, isSynthetic }
```

### Saved run record (localStorage only)

```
{ runId, snapshotId, status, summary, updatedAt }
```

No PII, credentials or document contents are stored anywhere.

---

## 6. Evaluation criteria (measurable)

| Criterion | Target | How measured |
|---|---|---|
| Determinism | Same inputs → identical comparison outcome and seed | `civicServiceChangeSandboxService.test.js` repeats runs |
| Input validation | 100% of sensitive fields/values rejected | Unit tests for `validateServiceChangeRequest` |
| Write block during shadow run | Publish refused when active reviewing snapshot | Service + API tests |
| Human approval required | Publish/rollback fail without `humanApproved` | Service + API tests |
| Untrusted output | `untrusted === true`, `requiresHumanReview === true` | Service unit test |
| No citizen data | `noCitizenData === true` on every result | Service unit test |
| API auth | publish/rollback/create/save/list return 401 for guest | `tests/service-change-sandbox-api.test.js` |
| Rate limiting | 429 with `Retry-After` when exceeded | Abuse guard (existing patterns) |
| Accessibility | Keyboard navigable, ARIA labels, colour contrast | Component tests + Lighthouse |
| Mobile-first | Layout stacks below 768px | Component + manual review |

### Reproducible commands

```bash
# Install
npm install

# Run the app
npm run dev

# Unit tests (sandbox engine)
npx vitest run src/services/civicServiceChangeSandboxService.test.js

# API tests (handler)
npx vitest run tests/service-change-sandbox-api.test.js

# Component tests (static markup + interactions)
npx vitest run src/components/serviceChangeSandbox/*.test.jsx

# Full checks
npm test
npm run lint
npm run lint:security
npm run build
```

### Evaluation report

Run the commands above; all tests must pass. The shadow-traffic engine is fully
deterministic, so repeated runs with identical inputs produce identical
comparison outcomes.

---

## 7. Dependencies, licences, performance and cost limits

### Dependencies

No new runtime dependencies. Reuses existing stack:

- React 19, Vite, React Router, Lucide React, Vitest, ESLint.
- Clerk (authentication; falls back to local demo mode).

Licences: existing project dependencies retain their own licences; this feature
adds no new packages.

### Performance limits

- Shadow-traffic replay is synchronous and bounded by `replayCount` (≤ 100000)
  and entity counts. Expected to complete well under 100 ms for default
  snapshots.
- Catalogue endpoint is public and returns the small synthetic dataset.

### Cost limits

- No AI model calls; zero inference cost.
- No external paid services beyond existing Clerk/Vercel hosting.
- Storage is `localStorage` only (client-side); no server-side persistence of
  shadow runs.

---

## 8. Deployment documentation

### 8.1 Route registration

- `src/App.jsx`: `/service-change-sandbox` renders `ServiceChangeSandboxWorkspacePage`.
- `api/[...path].js`: `service-change-sandbox` handler registered under `/api/service-change-sandbox`.

### 8.2 Environment variables

No new environment variables required. Existing `VITE_CLERK_PUBLISHABLE_KEY`
controls auth mode (Clerk vs local demo). Read-only shadow-traffic runs are
guest-allowed; publishing, rolling back, creating snapshots and listing/saving
run records require a session.

### 8.3 Build & deploy

```bash
npm run build       # Vite production build
# Deploy to Vercel (existing vercel.json applies)
```

### 8.4 Rollback / migration

- Schema version `civic-service-change-sandbox-v1` is recorded on every result.
- No server-side migrations required (no persistent sandbox store).
- Saved run records live in `localStorage` under a namespaced key; clearing them
  removes only the current user's saved run records, never public data.
- To roll back the feature, remove the route registrations, the handler entry
  in `api/[...path].js`, and the `src/components/serviceChangeSandbox`,
  `src/data/civicServiceChangeSandboxData.js` and
  `src/services/civicServiceChangeSandboxService.js` files.

### 8.5 Observability

- All API errors return structured JSON (`error.code`, `error.message`).
- Rate-limit responses include `Retry-After`.
- No request bodies or headers are logged by the handler.
- Run records carry `provenance`-style fields (`seed`, `schemaVersion`,
  `dataVersion`) for tracing a run back to its exact inputs.

---

## 9. User workflow

1. Open `/service-change-sandbox`.
2. Choose a staging snapshot from the catalogue (baseline vs proposed service
   versions).
3. Select the synthetic journey patterns to replay and set the replay count
   and deterministic seed.
4. Click **Run shadow traffic**. The engine replays the patterns against both
   versions and returns baseline vs proposed outcomes, deltas and a
   recommendation.
5. Review the **Comparison** panel: completion, validation failure,
   accessibility issues, completion time and document drop-off deltas, plus the
   recommendation (proceed / proceed with caution / hold / reject).
6. Read the disclaimer: output is illustrative and untrusted; human review
   required before any production change is published.
7. (Signed-in users only) Publish the snapshot to production or roll it back.
   Both require explicit human approval and are blocked while a shadow run is
   active.

---

## 10. Acceptance criteria status

| Criterion | Status |
|---|---|
| Architecture decision record | ✅ this document |
| Data-flow diagram | ✅ §3 |
| Threat model | ✅ §4 |
| Component ownership | ✅ §2.3 |
| Failure handling | ✅ §2.4 |
| Versioned schemas/contracts | ✅ §5 |
| Validate external input at trust boundaries | ✅ §3.1, `validateServiceChangeRequest` |
| Unit + integration + end-to-end tests | ✅ service, API, component tests |
| Negative, permission, retry, concurrency cases | ✅ API tests |
| Observability | ✅ §8.5 |
| Safe error handling | ✅ structured errors, no body/header logging |
| Migration / rollback | ✅ §8.4 |
| Deployment documentation | ✅ §8 |
| Measurable evaluation criteria | ✅ §6 |
| Reproducible commands | ✅ §6 |
| Dependencies, licences, performance, cost limits | ✅ §7 |
| Synthetic fixtures; no citizen records / credentials / raw documents / sensitive prompts | ✅ §1, §5 |

---

## 11. Limitations & non-goals

- The sandbox replays synthetic journey patterns deterministically; it does not
  replay real citizen traffic in this vertical slice. A production deployment
  could integrate opt-in anonymized aggregate patterns while preserving the same
  policy contract.
- Shadow-traffic output is never acted upon autonomously; a human must review
  and approve any publish or rollback.
- Real citizen documents and production traffic are out of scope; production PII
  must never enter the sandbox.

*Data version: `civic-service-change-sandbox-v1`. Review date: `2026-11-22`.*
