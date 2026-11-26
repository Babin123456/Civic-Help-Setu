# Secure Agent Sandbox for Untrusted Civic Document Processing (#1179)

## 1. Overview

The **Secure Agent Sandbox** is a policy-team and administrator workspace for running
untrusted civic document parsers / agent tools (PDF extractors, DOCX converters, OCR
readers, form parsers, government endpoint fetchers) in isolated workers.

It enforces CPU, memory and time limits; disables network by default; restricts
filesystem access to allowlisted paths; scans tool code and outputs for threat
signatures; validates outputs against a versioned schema; and redacts potential PII.
All results are illustrative and untrusted — they must be reviewed by a human before
any civic action.

Available at `/agent-sandbox`.

---

## 2. Architecture decision record (ADR)

### 2.1 Context

Document parsers and agent tools must not execute embedded scripts or access unrelated
application resources. Civic documents may arrive from untrusted third parties and can
contain archive bombs, malformed files, path-traversal references, embedded scripts or
PII. Running them in the main application context would expose the application and
citizen data to compromise.

### 2.2 Decision

Run every parser/tool inside a **sandboxed worker boundary** enforced by deterministic
rules. The sandbox never executes raw tool code directly; it simulates the worker
boundary and applies policy, threat scanning, output validation and redaction.

| Principle | Implementation |
|---|---|
| Isolated workers with CPU, memory and time limits | `enforceResourceLimits` and per-policy limits (cpuLimitMs, memoryLimitMB, timeLimitMs) in `src/services/civicAgentSandboxService.js`. |
| Network disabled by default | `policy.networkAllowed` defaults to false; network requires an approved policy + explicit human approval. |
| Restricted filesystem access | `policy.filesystemPaths` limits access to `/tmp` and reviewed directories only. |
| Validate outputs | `validateSandboxOutput` checks the policy output schema and size limit. |
| Scan dependencies / threats | `scanForThreats` scans tool manifest, inputs and outputs for embedded scripts, eval, archive bombs, path traversal, PII leaks and unauthorised network calls. |
| AI outputs are untrusted suggestions with provenance | Every result carries `untrusted: true`, `requiresHumanReview: true`, `provenance`, `policyVersion`, `schemaVersion`. |
| Aggregate only — no citizen data | `noCitizenData: true` on every run; synthetic fixtures only; zero production PII. |
| Explicit human approval for high-impact actions | Network and permissive (admin) policies require `humanApproved: true`. The sandbox never files applications, denies benefits or claims official verification. |
| Validate all external input at trust boundaries | `validateSandboxRequest` runs on client and server; rejects sensitive fields/values and unknown ids. |

### 2.3 Component ownership

| Component | File | Owner | Responsibility |
|---|---|---|---|
| Data contract | `src/data/civicAgentSandboxData.js` | Maintainer | Versioned synthetic policies, tools, documents, threats, endpoints |
| Sandbox engine | `src/services/civicAgentSandboxService.js` | Maintainer | Validation, threat scanning, resource limits, run orchestration, output validation/redaction |
| API boundary | `api/_lib/handlers/agent-sandbox.js` | Maintainer | Auth, rate limiting, structured errors, HTTP wiring |
| UI workspace | `src/components/agentSandbox/AgentSandboxWorkspace.jsx` | Maintainer | Tool selection, sandbox run, results, scan report |
| Page | `src/pages/AgentSandboxWorkspace.jsx` | Maintainer | Route entry point |
| Tests | `src/services/civicAgentSandboxService.test.js`, `tests/agent-sandbox-api.test.js`, `src/components/agentSandbox/*.test.jsx` | Maintainer | Unit, integration, API tests |
| Documentation | `docs/secure-agent-sandbox.md` | Maintainer | ADR, data flow, threat model, deployment, evaluation |

### 2.4 Failure handling

- Invalid input → structured `{ error.code, error.message, errors[] }` HTTP 400.
- Unknown tool/policy/document → specific not-found error, never a 500 from bad input.
- Threat detected → HTTP 400 with `AS_THREAT_DETECTED`, `blocked: true`, threat list; no untrusted code executed.
- Resource limit exceeded → `AS_RESOURCE_LIMIT_EXCEEDED`, lists the limited resource.
- Network without approval → `AS_PERMISSION_DENIED`.
- Storage unavailable → `AS_STORAGE_UNAVAILABLE`, UI degrades to ephemeral-only.
- Rate limit exceeded → HTTP 429 with `Retry-After`.
- Network failure during run → error banner with Retry button; no partial state shown as truth.
- Stale data (past review window) → `isStale: true`, banner shown.

---

## 3. Data flow

```
[Admin / policy team]
   │ selects tool + policy + document fixture + input text
   │ toggles network / human approval (high-impact only)
   ▼
[src/components/agentSandbox/ToolSelector.jsx]
   │ POST /api/agent-sandbox  { action: 'run', ...parameters }
   ▼
[api/_lib/handlers/agent-sandbox.js]
   ├─ rate limit (per address + per user)
   ├─ validateSandboxRequest (trust boundary)
   ├─ runSandboxTool (deterministic orchestration)
   │     ├─ tool / policy / document lookup
   │     ├─ human-approval gate for network/permissive policies
   │     ├─ network gating (approved policy + endpoints)
   │     ├─ scanForThreats (tool manifest + input) → block on critical/high
   │     ├─ enforceResourceLimits (CPU/memory/time)
   │     ├─ deterministic simulated output (illustrative, no real execution)
   │     ├─ scanForThreats (output) → block / redact
   │     ├─ validateSandboxOutput (schema + size)
   │     └─ attach provenance, schemaVersion, dataVersion, isStale
   ▼
[returns { ok, run: { ..., untrusted, requiresHumanReview, noCitizenData },
           scan: { pre, post, blocked, redacted } }]
   ▲
   │ renders output + threat scan + resources + disclaimer
[AgentSandboxWorkspace.jsx + SandboxResults.jsx]
   │
   ▼
[Admin reads illustrative, untrusted output; human review required before any civic action]
```

### 3.1 Trust boundaries

| Boundary | Enforcement |
|---|---|
| Client → API | `validateSandboxRequest` on both sides; sensitive-key/value scans; slug and range checks |
| API → Engine | Only validated parameters reach `runSandboxTool` |
| Engine → UI | Outputs carry `untrusted: true`, `requiresHumanReview: true`, `disclaimer` |
| Storage (save-run) | Only run metadata (tool, policy, status, summary); authentication required to save |

---

## 4. Threat model

### 4.1 Assets

- Sandbox run records (saved in `localStorage` under `civicbridge_agent_sandbox_run_v1`).
- Tool manifests, policies and synthetic document fixtures.
- API rate-limit state (in memory, per function instance).

### 4.2 Threats and mitigations

| Threat | Impact | Mitigation |
|---|---|---|
| PII or credentials sent in sandbox request | Data leakage | `findSensitiveKeys` / `collectSensitiveText` reject passwords, OTPs, Aadhaar, PAN, phone, income amounts; request bodies/headers never logged |
| Embedded script execution | Remote code execution | `threat-embedded-script` pattern blocks `<script>` tags in input/tool/output |
| Dynamic code evaluation (`eval`, `new Function`) | Remote code execution | `threat-eval-call` blocks; blocked by policy blockedPatterns |
| Archive bomb (zip bomb) | Memory exhaustion | `threat-archive-bomb` scans compressed archive references; blocks |
| Path traversal | Unauthorised file read | `threat-path-traversal` scans `../` patterns; filesystem restricted to allowlisted paths |
| PII leak in output | Privacy harm | `threat-pii-leak` redacts Aadhaar/PAN/OTP-like values; `noCitizenData: true` |
| Unauthorised network access | Data exfiltration | Network disabled by default; requires approved policy + human approval; approved endpoints only |
| Resource exhaustion loop | DoS | `threat-denial-of-service` warns; CPU/memory/time limits enforced |
| Sandbox mistaken for trusted verdict | Harmful reliance | Every result carries `untrusted: true`, `requiresHumanReview: true`, `disclaimer` |

### 4.3 Non-goals / explicitly prohibited

- Autonomous execution of embedded scripts.
- Autonomous filing of applications or denial of benefits.
- Claiming official verification of any document or outcome.
- Treating sandbox output as a trusted citizen decision.
- Storing real citizen records, credentials, raw documents or sensitive prompts.

---

## 5. Data model (versioned schema)

Schema version: `civic-agent-sandbox-v1`

### Policy

```
{ id, name, description, version, cpuLimitMs, memoryLimitMB, timeLimitMs,
  networkAllowed, filesystemPaths[], allowlistedModules[], blockedPatterns[],
  outputSchema, maxOutputSizeKB, riskLevel, isDefault, isSynthetic }
```

### Tool (agent manifest)

```
{ id, name, documentType, entryPoint, allowedOperations[],
  resourceRequirements, networkRequired, filesystemRequired[],
  defaultPolicyId, provenance, riskNote, isSynthetic }
```

### Document (synthetic fixture)

```
{ id, name, type, mime, sizeBytes, contentHash, isSynthetic, notes,
  malformed?, archiveBomb? }
```

### Threat signature

```
{ id, name, pattern, severity, action, description }
```

### Sandbox run result

```
{ schemaVersion, dataVersion, reviewDate, staleAfterDays, isStale,
  run: { runId, toolId, toolName, policyId, policyName, documentId,
    status, output, threats[], threatCount, redacted, humanApproved,
    networkUsed, provenance, policyVersion, resourcesUsed, disclaimer,
    illustrative: true, noIndividualPrediction: true, noCitizenData: true,
    untrusted: true, requiresHumanReview: true },
  scan: { pre[], post[], blocked, redacted } }
```

### Saved run record (localStorage only)

```
{ runId, toolId, policyId, status, summary, updatedAt }
```

No PII, credentials or document contents are stored anywhere.

---

## 6. Evaluation criteria (measurable)

| Criterion | Target | How measured |
|---|---|---|
| Determinism | Same inputs → identical output and runId | `civicAgentSandboxService.test.js` repeats runs |
| Input validation | 100% of sensitive fields/values rejected | Unit tests for `validateSandboxRequest` |
| Threat blocking | Embedded script / eval / network-under-disabled blocked | `scanForThreats` unit tests |
| Output validation | Schema + size enforced | `validateSandboxOutput` unit tests |
| Untrusted output | `untrusted === true`, `requiresHumanReview === true` | Service unit test |
| No citizen data | `noCitizenData === true` on every result | Service unit test |
| API auth | save-run/list-runs return 401 for guest | `tests/agent-sandbox-api.test.js` |
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
npx vitest run src/services/civicAgentSandboxService.test.js

# API tests (handler)
npx vitest run tests/agent-sandbox-api.test.js

# Component tests (static markup)
npx vitest run src/components/agentSandbox/*.test.jsx

# Full checks
npm test
npm run lint
npm run lint:security
npm run build
```

### Evaluation report

Run the commands above; all tests must pass. The sandbox engine is fully
deterministic, so repeated runs with identical inputs produce identical outputs.

---

## 7. Dependencies, licences, performance and cost limits

### Dependencies

No new runtime dependencies. Reuses existing stack:

- React 19, Vite, React Router, Lucide React, Vitest, ESLint.
- Clerk (authentication; falls back to local demo mode).

Licences: existing project dependencies retain their own licences; this feature
adds no new packages.

### Performance limits

- Simulation is synchronous and bounded by policy limits (CPU ≤ 60000 ms,
  memory ≤ 512 MB, time ≤ 120000 ms for the most permissive admin policy;
  strict default is 5000 ms CPU / 64 MB / 10000 ms time).
- Catalogue endpoint is public and returns the small synthetic dataset.

### Cost limits

- No AI model calls; zero inference cost.
- No external paid services beyond existing Clerk/Vercel hosting.
- Storage is `localStorage` only (client-side); no server-side persistence of
  sandbox runs.

---

## 8. Deployment documentation

### 8.1 Route registration

- `src/App.jsx`: `/agent-sandbox` renders `AgentSandboxWorkspacePage`.
- `api/[...path].js`: `agent-sandbox` handler registered under `/api/agent-sandbox`.

### 8.2 Environment variables

No new environment variables required. Existing `VITE_CLERK_PUBLISHABLE_KEY`
controls auth mode (Clerk vs local demo). Read-only sandbox runs are guest-allowed;
saving run records requires a session.

### 8.3 Build & deploy

```bash
npm run build       # Vite production build
# Deploy to Vercel (existing vercel.json applies)
```

### 8.4 Rollback / migration

- Schema version `civic-agent-sandbox-v1` is recorded on every result.
- No server-side migrations required (no persistent sandbox store).
- Saved run records live in `localStorage` under a namespaced key; clearing them
  removes only the current user's saved run records, never public data.
- To roll back the feature, remove the route registrations, the handler entry
  in `api/[...path].js`, and the `src/components/agentSandbox`,
  `src/data/civicAgentSandboxData.js` and `src/services/civicAgentSandboxService.js`
  files.

### 8.5 Observability

- All API errors return structured JSON (`error.code`, `error.message`).
- Rate-limit responses include `Retry-After`.
- No request bodies or headers are logged by the handler.
- Run records carry `provenance`, `policyVersion`, `schemaVersion` and
  `reproducibility`-style `runId` for tracing a run back to its exact inputs.

---

## 9. User workflow

1. Open `/agent-sandbox`.
2. Choose a reviewed tool (PDF text extractor, DOCX converter, OCR reader,
   civic form parser, government endpoint fetcher).
3. Choose a sandbox policy (strict default, moderate reviewed, permissive admin).
4. Optionally select a synthetic document fixture and/or input text.
5. For network or permissive policies, enable **explicit human approval**.
6. Click **Run in sandbox**. The engine returns illustrative output, threat scan
   results and resources used.
7. Review the **Threat scan** panel. If blocked, no untrusted code ran.
8. Read the disclaimer: output is illustrative and untrusted; human review
   required before any civic action.
9. (Signed-in users only) Save the run record for later.

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
| Validate external input at trust boundaries | ✅ §3.1, `validateSandboxRequest` |
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

- The sandbox simulates the worker boundary deterministically; it does not
  execute real third-party parser code in this vertical slice. A production
  deployment should run parsers in true OS-level sandboxed workers (e.g. Web
  Workers with isolated origins, or containerised sidecars) while preserving the
  same policy contract.
- Untrusted output is never acted upon autonomously.
- Real citizen documents are out of scope; production PII must never enter the
  sandbox.

*Data version: `civic-agent-sandbox-v1`. Review date: `2026-11-21`.*
