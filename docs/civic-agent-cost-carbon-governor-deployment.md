# Civic Agent Cost and Carbon Budget Governor — Deployment, Migration & Rollback (#1185)

## 1. Deployment

The governor runs entirely in the browser (localStorage-backed store) and
optionally behind the `/api/civic-agent-cost-carbon` Vercel serverless route.
No build-time changes are required beyond adding the new files.

### Environment variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `CIVIC_AGENT_COST_CARBON_SECRET` | Secret for the API route (future operator auth) | `dev-secret-change-me` (dev only) |

No `VITE_` variables are introduced, so no secrets are bundled into the public
client bundle.

### Routes

| Path | Method | Access |
|------|--------|--------|
| `/cost-carbon-governor` | GET | Public (read-only aggregates + governed run UI) |
| `/api/civic-agent-cost-carbon` | GET/POST | Public read; writes require a verified Clerk session; policy mutations require operator role |

Add the route to `src/App.jsx` (already wired):

```jsx
<Route path="/cost-carbon-governor" element={<CostCarbonGovernorWorkspacePage />} />
```

## 2. Configuration

Budget ceilings are defined in `DEFAULT_COST_CARBON_POLICY`
(`src/data/civicAgentCostCarbonConstants.js`) and can be overridden per-policy
via the `POST /api/civic-agent-cost-carbon/policies` operator endpoint.

Key policy fields:

- `maxTotalCostUSD` — cumulative cost ceiling per run
- `maxTotalTokens` — cumulative token ceiling per run
- `maxTotalLatencyMs` — cumulative latency ceiling per run
- `maxEstimatedCarbonGCO2e` — cumulative carbon ceiling per run
- `maxCostPerCallUSD` / `maxTokensPerCall` — per-call ceilings
- `maxCallsPerRun` / `maxCallsPerMinute` — call-rate ceilings
- `requireHumanApprovalForHighImpact` — gate high-impact actions
- `stopOnBudgetExceeded` / `routeToFallbackOnBudgetExceeded` — stop / fallback behaviour
- `carbonIntensityGCO2ePerKWh` — grid carbon intensity for estimates
- `fallbackModel` — deterministic fallback model id

Operators should review `MODEL_RATE_TABLE` against current provider pricing
before production use; all entries are illustrative estimates (`estimated: true`).

## 3. Migration

The store uses a versioned schema (`CIVIC_AGENT_COST_CARBON_SCHEMA_VERSION =
1`). On load:

- A missing or invalid store is re-seeded with the default policy.
- A legacy (pre-v1) flat shape is migrated by `migrateCostCarbonStore`, which
  preserves collections and records a `migrationHistory` entry. Nothing is
  silently dropped.
- `createSeedStore` seeds the default budget policy.

Migration entry example:

```json
{ "from": 0, "to": 1, "appliedAt": "2026-11-24T10:00:00Z", "kind": "upgrade" }
```

## 4. Rollback

### Rollback to seeded store

```js
import { rollbackCostCarbonStore } from './src/services/civicAgentCostCarbonMigrations.js';

const restored = rollbackCostCarbonStore({ now: new Date() });
// restored is a freshly seeded store with the default policy.
```

### Reset to empty store

```js
import { resetCostCarbonStoreToEmpty } from './src/services/civicAgentCostCarbonMigrations.js';

const empty = resetCostCarbonStoreToEmpty({ now: new Date() });
// empty store with no policies (default policy resolved in-memory by governor).
```

### Retention

Old completed/stopped/failed runs older than `retentionDays` (default 90) are
archived and their calls flagged `archived` via `applyCostCarbonRetentionPolicy`.
Audit events are append-only; the retention run itself is recorded.

## 5. Verification before production

1. Run the full governor test suite:
   ```bash
   npx vitest run src/services/civicAgentCostCarbonGovernor.test.js \
     src/services/civicAgentCostCarbonMigrations.test.js \
     src/data/civicAgentCostCarbonConstants.test.js \
     src/ai/civicAgentCostCarbonWrapper.test.js \
     api/_lib/civicAgentCostCarbonSchemas.test.js \
     tests/civic-agent-cost-carbon-api.test.js
   ```
2. Run lint and security lint:
   ```bash
   npm run lint && npm run lint:security
   ```
3. Review `MODEL_RATE_TABLE` and `DEFAULT_COST_CARBON_POLICY` against current
   provider pricing and organizational carbon/cost targets.
4. Confirm no `VITE_` secrets are introduced and no raw prompts are logged.

## 6. Safety

- Synthetic fixtures only; no citizen records, credentials, raw documents or
  sensitive prompts in fixtures, logs or analytics.
- Prompts are hashed before storage; only length is retained.
- Cost/energy/carbon figures are estimates, labelled `estimated: true`, and are
  never presented as a bill.
