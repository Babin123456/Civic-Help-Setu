# Civic Agent Cost and Carbon Budget Governor — Evaluation Report (#1185)

## 1. Evaluation criteria

| Criterion | Target | Measured by |
|-----------|--------|-------------|
| Budget enforcement — per-call cost ceiling | Call rejected/fallback when estimated cost > maxCostPerCallUSD | Unit tests |
| Budget enforcement — cumulative cost ceiling | Run stopped when projected cost > maxTotalCostUSD | Unit + integration tests |
| Budget enforcement — token ceiling | Call rejected/stopped when tokens > maxTokensPerCall / maxTotalTokens | Unit tests |
| Budget enforcement — latency ceiling | Run stopped when projected latency > maxTotalLatencyMs | Unit tests |
| Budget enforcement — carbon ceiling | Run stopped when projected carbon > maxEstimatedCarbonGCO2e | Unit tests |
| Budget enforcement — calls per run | Run stopped when calls > maxCallsPerRun | Unit tests |
| Rate limiting — calls per minute | Runaway detection when calls/minute > maxCallsPerMinute | Unit tests |
| Runaway loop detection | Same model + same input repeated ≥ threshold → runwaySuspected | Unit tests |
| Billing metadata gap | No verified billing → `billingMetadataGap: true`, estimates only | Unit + integration tests |
| High-impact permission | `isHighImpact` without `humanApproved` → PERMISSION_DENIED | Unit tests |
| Fail closed on invalid input | 400 `validation_failed` with stable codes | Unit + API tests |
| Fail closed on missing run | recordCall/stopRun for unknown run → RUN_NOT_FOUND | Unit tests |
| Concurrency cap | MAX_CONCURRENT_RUNS and MAX_RUNS_PER_WORKFLOW enforced | Unit tests |
| Deterministic fallback routing | Budget breach → fallback output when configured | Unit + wrapper tests |
| No sensitive data persisted | Prompt hashed; sensitive keys/values rejected | Unit tests + code review |
| Migration & rollback | Legacy shape migrated; rollback/reset restore valid store | Unit tests |
| Retention | Old completed/stopped runs archived; calls flagged archived | Unit tests |

## 2. Reproducible commands

```bash
# Install dependencies
npm install --no-audit --no-fund

# Lint all code (including security rules)
npm run lint
npm run lint:security

# Run governor-related tests
npx vitest run \
  src/services/civicAgentCostCarbonGovernor.test.js \
  src/services/civicAgentCostCarbonMigrations.test.js \
  src/data/civicAgentCostCarbonConstants.test.js \
  src/ai/civicAgentCostCarbonWrapper.test.js \
  api/_lib/civicAgentCostCarbonSchemas.test.js \
  tests/civic-agent-cost-carbon-api.test.js

# Run full test suite (note: pre-existing failures in unrelated files)
npx vitest run

# Build
npm run build
```

## 3. Test coverage summary

| Test file | Area |
|-----------|------|
| `src/services/civicAgentCostCarbonGovernor.test.js` | Validation, preflight, startRun, recordCall, stopRun, getRun, getWorkflowAggregate, listPolicies, budget enforcement, runaway loop, billing gaps, permissions |
| `src/services/civicAgentCostCarbonMigrations.test.js` | Empty/seed store, validation helpers, migration, indexes, load/persist, transaction, rollback, reset, retention |
| `src/data/civicAgentCostCarbonConstants.test.js` | Schema version, default policy, model rate table, getModelRate fallback |
| `src/ai/civicAgentCostCarbonWrapper.test.js` | Estimate-before-call, record-after-call, budget-block fallback, provider-error fallback, billing metadata gap |
| `api/_lib/civicAgentCostCarbonSchemas.test.js` | Versioned schema validation for all endpoints |
| `tests/civic-agent-cost-carbon-api.test.js` | API integration: schema, start run, record call, stop run, policies, workflow aggregate, auth gating |

## 4. Negative / permission / retry / concurrency cases

- **Negative:** invalid workflowId/runId/policyId → 400 `validation_failed`; overlong prompt → 400; negative tokens → 400; unknown run → 404 RUN_NOT_FOUND; missing token → 401 `missing_token`.
- **Permission:** high-impact run without `humanApproved` → PERMISSION_DENIED; operator endpoints without operator session → 403; user endpoints without session → 401.
- **Retry/budget:** budget breach → fail closed or deterministic fallback; `Retry`-style stop via `stopped` flag and `stopReason`; no silent overruns.
- **Concurrency:** `MAX_CONCURRENT_RUNS` and `MAX_RUNS_PER_WORKFLOW` caps; each call counted independently toward cumulative totals.

## 5. Dependencies, licences, and cost

- **Runtime dependencies:** none beyond existing (`react`, `lucide-react`, `vitest`, `eslint`).
- **Dev dependencies:** vitest, eslint (existing).
- **Licences:** MIT (project LICENSE).
- **Cost:** localStorage/in-memory writes bounded by retention; API calls are lightweight reads/writes. No external LLM calls made by the governor itself (estimates only).
- **Performance:** per-run in-memory `activeRuns` map; atomic store transactions; bounded retention via `applyCostCarbonRetentionPolicy`.

## 6. Safety

- Synthetic fixtures only (`tests/fixtures/civicAgentCostCarbonSyntheticFixtures.js`): made-up workflow/model ids, hashed prompts, fabricated aggregates. No citizen records, credentials, raw documents, or sensitive prompts.
- Logs and analytics: no PII, no raw prompts (prompt hashed), no credentials.
- AI: outputs are untrusted estimates carrying provenance; the governor uses deterministic rules only.
- Estimates are labelled `estimated: true` and are never presented as an invoice.
