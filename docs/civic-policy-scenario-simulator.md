# Agent-Based Civic Policy Scenario Simulator (#1176)

## 1. Overview

The **Agent-Based Civic Policy Scenario Simulator** is a policy-team workspace for
exploring how process changes could affect service demand, travel burden and
document requirements before rollout.

It builds transparent agent-based simulations using **synthetic personas** and
**documented assumptions**, allows scenario parameters, reports sensitivity and
uncertainty, and validates against aggregate public statistics. It prohibits
individual prediction and unsupported causal claims.

Available at `/policy-simulation` (and `/services/:serviceId/policy-simulation`).

---

## 2. Architecture decision record (ADR)

### 2.1 Context

Policy teams need to model the effect of process changes (online channels,
mobile kiosks, document bundling, extended hours) on aggregate service demand,
travel burden and document requirements. Existing Civic Help Setu features are
citizen-facing preparation tools; this feature is a **policy planning aid** that
must never be mistaken for an official forecast, an individual prediction, or a
benefits decision.

### 2.2 Decision

Use a **deterministic, rule-based agent-based simulation** with synthetic
personas as the core engine. Do not delegate simulation maths to an AI model.
AI may only label suggested levers as untrusted suggestions carrying full
provenance.

| Principle | Implementation |
|---|---|
| Deterministic rules outside LLM prompts | All demand, travel, document-burden and sensitivity maths is plain JS in `src/services/civicPolicySimulationService.js`. No model is invoked. |
| AI outputs are untrusted suggestions with provenance | The UI labels lever risk notes and any AI-style suggestion as `SUGGESTION` with source references and data version. |
| Aggregate only — no individual prediction | Personas are statistical archetypes. Outputs are aggregates; no persona is tracked across runs or singled out. `noIndividualPrediction: true` is set on every result. |
| Explicit human approval for high-impact actions | The simulator never files applications, denies benefits or claims official verification. Saving a named configuration requires authentication but performs no civic action. |
| Validate all external input at trust boundaries | `validateSimulationRequest` runs on client and server; rejects sensitive fields/values and unknown ids. |
| Synthetic fixtures only | `src/data/civicPolicySimulationData.js` holds versioned synthetic personas, services, offices, levers and aggregate stats. Zero production PII. |
| Reproducibility | Every run records `schemaVersion`, `dataVersion`, `reviewDate`, `seed` and a `reproducibilityDigest`. Same inputs → same outputs. |

### 2.3 Component ownership

| Component | File | Owner | Responsibility |
|---|---|---|---|
| Data contract | `src/data/civicPolicySimulationData.js` | Maintainer | Versioned synthetic fixtures, lookup helpers |
| Simulation engine | `src/services/civicPolicySimulationService.js` | Maintainer | Deterministic model, validation, sensitivity, uncertainty |
| API boundary | `api/_lib/handlers/policy-simulation.js` | Maintainer | Auth, rate limiting, structured errors, HTTP wiring |
| UI workspace | `src/components/policySimulation/PolicySimulationWorkspace.jsx` | Maintainer | Scenario selection, simulation, results, sensitivity |
| Page | `src/pages/PolicySimulationWorkspace.jsx` | Maintainer | Route entry point |
| Tests | `src/services/civicPolicySimulationService.test.js`, `tests/policy-simulation-api.test.js`, `src/components/policySimulation/*.test.jsx` | Maintainer | Unit, integration, API tests |
| Documentation | `docs/civic-policy-scenario-simulator.md` | Maintainer | ADR, data flow, threat model, deployment, evaluation |

### 2.4 Failure handling

- Invalid input → structured `{ error.code, error.message, errors[] }` HTTP 400.
- Unknown scenario/service/office/lever → 404 or validation error, never a 500 from bad input.
- Storage unavailable (save/load) → `PS_STORAGE_UNAVAILABLE`, UI degrades to ephemeral-only.
- Rate limit exceeded → HTTP 429 with `Retry-After`.
- Network failure during simulation → error banner with a Retry button; no partial state is shown as truth.
- Stale data (past review window) → `isStale: true`, uncertainty set to `low`, banner shown.

---

## 3. Data flow

```
Mermaid diagram (textual):

[Policy team]
   │ selects scenario + levers + day count
   ▼
[src/components/policySimulation/ScenarioSelector.jsx]
   │ POST /api/policy-simulation  { action: 'simulate', ...parameters }
   ▼
[api/_lib/handlers/policy-simulation.js]
   ├─ rate limit (per address + per user)
   ├─ validateSimulationRequest (trust boundary)
   ├─ simulateScenario (deterministic engine)
   │     ├─ applyLevers (deterministic policy rules)
   │     ├─ personServiceDemand / personDocumentBurden / personTravelMinutes
   │     ├─ sensitivity (toggle each lever off, measure delta)
   │     ├─ validateAgainstAggregateStats (tolerance-based, directional)
   │     └─ reproducibilityDigest over canonical inputs
   ▼
[returns { ok, simulation: { totals, byService, byOffice, byPersona, sensitivity, uncertainty, aggregateValidation, reproducibilityDigest, ... } }]
   ▲
   │ renders aggregate-only results + sensitivity + uncertainty
[PolicySimulationWorkspace.jsx + SimulationResults.jsx + SensitivityPanel.jsx]
   │
   ▼
[Policy team reads illustrative aggregates; no individual record, no causal claim]
```

### 3.1 Trust boundaries

| Boundary | Enforcement |
|---|---|
| Client → API | `validateSimulationRequest` on both sides; sensitive-key/value scans; slug and range checks |
| API → Engine | Only validated parameters reach `simulateScenario` |
| Engine → UI | Outputs carry `illustrative: true`, `noIndividualPrediction: true`, `disclaimer` |
| Storage (save/load) | Only scenario ids and parameter ids (no PII); authentication required to save |

---

## 4. Threat model

### 4.1 Assets

- Synthetic scenario configurations (saved in `localStorage` under `civicbridge_policy_simulation_scenario_v1`).
- Simulation parameters and results (aggregate only).
- API rate-limit state (in memory, per function instance).

### 4.2 Threats and mitigations

| Threat | Impact | Mitigation |
|---|---|---|
| PII or credentials sent in simulation request | Data leakage | `findSensitiveKeys` / `collectSensitiveText` reject passwords, OTPs, Aadhaar, PAN, phone, income amounts; request bodies/headers never logged |
| Simulator mistaken for official forecast | Harmful reliance | Every result carries `disclaimer`, `illustrative: true`, `noIndividualPrediction: true`; UI states "illustrative planning band" |
| Individual citizen prediction/re-identification | Privacy harm | Personas are archetypes; outputs are aggregates; no tracking id; no cross-run linkage |
| Unsupported causal claim | Bad policy decision | Sensitivity is labelled directional; `detectQueueClaim`-style guard not applicable (no queue claims); uncertainty band reported |
| Simulation abuse / DoS | Service degradation | Per-address rate limit (30/min), per-user limit (10/min after session), `dayCount` capped at 365, entity caps (personas 200, services 100, offices 100, levers 50) |
| Stale data used for planning | Wrong conclusion | `isStale` flag, `uncertainty.level`, stale banner; review date tracked |
| Unauthenticated save of named config | Data integrity | Save/load/list-saved-scenarios require authentication (guest → 401) |

### 4.3 Non-goals / explicitly prohibited

- Autonomous filing of applications.
- Autonomous denial of benefits.
- Claiming official verification of any citizen, document or outcome.
- Predicting individual outcomes.
- Storing real citizen records, credentials, raw documents or sensitive prompts.

---

## 5. Data model (versioned schema)

Schema version: `civic-policy-simulation-v1`

### Persona (synthetic archetype)

```
{ id, label, archetype, travelBurden, documentReadiness,
  languagePreference[], digitalLiteracy, officeVisitPreference,
  baseServiceDemandMultiplier, documentRequirements[], notes }
```

### Service

```
{ id, name, department, category, statutoryDays, fee, feeType,
  baseDailyDemand, documentRequirements[], travelToOfficeRequired,
  onlineAvailable, isSynthetic }
```

### Office

```
{ id, name, state, district, ward, pincode, officeType, isSynthetic,
  averageWaitMinutes, counterCount }
```

### Policy lever

```
{ id, label, description, appliesToServiceIds[], appliesToOfficeIds[],
  effect: { type, ... }, defaultEnabled, riskNote }
```

### Scenario

```
{ id, title, description, leverIds[], personaIds[], serviceIds[],
  officeIds[], expectedDirectionalEffects[] }
```

### Simulation result

```
{ schemaVersion, dataVersion, reviewDate, staleAfterDays, isStale,
  scenario, parameters, reproducibilityDigest,
  totals { estimatedDailyDemand, estimatedDailyInPersonVisits,
    estimatedDailyOnlineDemand, estimatedDailyTravelMinutes,
    averageDocumentBurden },
  byService[], byOffice[], byPersona[],
  sensitivity[] { leverId, leverLabel, travelMinutesDelta, demandDelta, note },
  uncertainty { level, isStale, lowConfidenceStatCount, message },
  aggregateValidation { checks[], passed, total, passRate, note },
  disclaimer, illustrative: true, noIndividualPrediction: true }
```

### Saved configuration (localStorage only)

```
{ scenarioId, name, parameters, updatedAt }
```

No PII, credentials or document contents are stored anywhere.

---

## 6. Evaluation criteria (measurable)

| Criterion | Target | How measured |
|---|---|---|
| Determinism | Same inputs → identical `reproducibilityDigest` and totals | `civicPolicySimulationService.test.js` repeats runs |
| Input validation | 100% of sensitive fields/values rejected | Unit tests for `validateSimulationRequest` |
| Aggregate-only output | `noIndividualPrediction === true` on every result | Service unit test |
| Uncertainty reported | `uncertainty.level` ∈ {low, medium, high} | Service unit test |
| Sensitivity computed | `sensitivity` array present for enabled levers | Service + API test |
| API auth | save/load/list return 401 for guest | `tests/policy-simulation-api.test.js` |
| Rate limiting | 429 with `Retry-After` when exceeded | Abuse guard (covered by existing patterns) |
| Accessibility | Keyboard navigable, ARIA labels, colour contrast | Component tests + Lighthouse |
| Mobile-first | Layout stacks below 768px | Component + manual review |

### Reproducible commands

```bash
# Install
npm install

# Run the app
npm run dev

# Unit tests (simulation engine)
npx vitest run src/services/civicPolicySimulationService.test.js

# API tests (handler)
npx vitest run tests/policy-simulation-api.test.js

# Component tests (static markup + interactions)
npx vitest run src/components/policySimulation/*.test.jsx

# Full checks
npm test
npm run lint
npm run lint:security
npm run build
```

### Evaluation report

Run the commands above; all tests must pass. The simulation engine is fully
deterministic, so the `reproducibilityDigest` for `scenario-baseline` with the
default seed is stable across runs and environments.

---

## 7. Dependencies, licences, performance and cost limits

### Dependencies

No new runtime dependencies. Reuses existing stack:

- React 19, Vite, React Router, Lucide React, Vitest, ESLint.
- Clerk (authentication; falls back to local demo mode).

Licences: existing project dependencies retain their own licences; this feature
adds no new packages.

### Performance limits

- Simulation is synchronous and bounded by entity caps (personas ≤ 200,
  services ≤ 100, offices ≤ 100). Expected to complete well under 100 ms for
  default scenarios.
- Catalogue endpoint is public and paginated-free (small synthetic dataset).

### Cost limits

- No AI model calls for simulation; zero inference cost.
- No external paid services beyond existing Clerk/Vercel hosting.
- Storage is `localStorage` only (client-side); no server-side persistence of
  simulations.

---

## 8. Deployment documentation

### 8.1 Route registration

- `src/App.jsx`: `/policy-simulation` and `/services/:serviceId/policy-simulation`
  render `PolicySimulationWorkspacePage`.
- `api/[...path].js`: `policy-simulation` handler registered under `/api/policy-simulation`.

### 8.2 Environment variables

No new environment variables required. Existing `VITE_CLERK_PUBLISHABLE_KEY`
controls auth mode (Clerk vs local demo). Simulation itself is auth-free for
read-only runs; saving requires a session.

### 8.3 Build & deploy

```bash
npm run build       # Vite production build
# Deploy to Vercel (existing vercel.json applies)
```

### 8.4 Rollback / migration

- Schema version `civic-policy-simulation-v1` is recorded on every result.
- No server-side migrations required (no persistent simulation store).
- Saved configurations live in `localStorage` under a namespaced key; clearing
  them removes only the current user's saved scenario configs, never public
  data.
- To roll back the feature, remove the route registrations, the handler entry
  in `api/[...path].js`, and the `src/components/policySimulation` +
  `src/data/civicPolicySimulationData.js` + `src/services/civicPolicySimulationService.js`
  files.

### 8.5 Observability

- All API errors return structured JSON (`error.code`, `error.message`).
- Rate-limit responses include `Retry-After`.
- No request bodies or headers are logged by the handler.
- Simulation results carry `reproducibilityDigest` for tracing a run back to its
  exact inputs.

---

## 9. User workflow

1. Open `/policy-simulation`.
2. Choose a reviewed scenario (baseline, digital ration card, mobile CSC kiosk,
   document bundle) from the catalogue.
3. Adjust personas, services, offices, policy levers and the day window.
4. Click **Run simulation**. The engine returns aggregate totals, per-service,
   per-office and per-archetype tables.
5. Review **Sensitivity & uncertainty**: lever deltas, uncertainty level,
   aggregate validation against public stats.
6. Read the disclaimer: results are illustrative planning bands, not official
   forecasts or individual predictions.
7. (Signed-in users only) Save the configuration for later.

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
| Validate external input at trust boundaries | ✅ §3.1, `validateSimulationRequest` |
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

- The simulator models aggregate demand/travel/document burden using synthetic
  personas; it is not a substitute for official impact assessment or statistical
  modelling.
- Uncertainty bands are deterministic planning bands, not statistically
  calibrated confidence intervals.
- The simulator never files applications, denies benefits or claims official
  verification.
- Real citizen records are never used; production data is out of scope.

*Data version: `civic-policy-simulation-v1`. Review date: `2026-11-20`.*
