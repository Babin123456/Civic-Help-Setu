# Civic Agent Workflow Policy-as-Code Engine — Deployment, Migration & Rollback (#1187)

## 1. Deployment

The policy engine runs entirely in the browser (localStorage-backed store) and
optionally behind the `/api/civic-agent-policy` Vercel serverless route.
No build-time changes are required beyond adding the new files.

### Environment variables

No new environment variables are introduced. No `VITE_` variables are added,
so no secrets are bundled into the public client bundle.

### Routes

| Path | Method | Access |
|------|--------|--------|
| `/policy-engine` | GET | Public (evaluation UI + read-only aggregates) |
| `/api/civic-agent-policy` | GET/POST | Public read; writes require a verified Clerk session; policy mutations require operator role |

Add the route to `src/App.jsx` (already wired):

```jsx
<Route path="/policy-engine" element={<PolicyEngineWorkspacePage />} />
```

## 2. Configuration

Policies are defined as machine-readable documents. The default policy
(`default-civic-agent-policy-v1`) is deny-by-default with no rules (all actions
denied except those explicitly allowed).

Key policy fields:

- `id` — lowercase slug, policy identifier
- `name` — human-readable name
- `status` — active/draft/archived/revoked/emergency_locked/retired
- `denyByDefault` — when true, actions not matching an allow rule are denied
- `rules` — array of policy rules (max 500)
- `emergencyLocked` — when true, all actions under the policy are suspended
- `requireHumanApprovalForHighImpact` — gate high-impact actions

Key rule fields:

- `id` — lowercase slug
- `resourceType` — tool / agent / source / state_transition / workflow
- `resourceId` — the resource the rule applies to (or `*` for all)
- `effect` — allow / deny / require_approval
- `conditions` — ordered condition slugs (citizen_confirmed, human_approved, read_only, time_window, max_daily_calls, verified_source)
- `conditionParams` — parameters for conditions
- `requiresApproval` — explicit human approval required
- `appliesToRoles` — roles the rule applies to (or `*` for all)
- `priority` — higher wins on conflict
- `expiresAt` — optional ISO-8601 expiry

Policies can be created/updated via `POST /api/civic-agent-policy/policies`
(operator role required).

## 3. Migration

The store uses a versioned schema (`CIVIC_AGENT_POLICY_SCHEMA_VERSION = 1`).
On load:

- A missing or invalid store is re-seeded with the default policy.
- A legacy (pre-v1) flat shape is migrated by `migratePolicyStore`, which
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
import { rollbackPolicyStore } from './src/services/civicAgentPolicyMigrations.js';

const restored = rollbackPolicyStore({ now: new Date() });
// restored is a freshly seeded store with the default policy.
```

### Reset to empty store

```js
import { resetPolicyStoreToEmpty } from './src/services/civicAgentPolicyMigrations.js';

const empty = resetPolicyStoreToEmpty({ now: new Date() });
// empty store with no policies.
```

### Retention

Old archived/revoked policies older than `retentionDays` (default 90) are
retired via `applyPolicyRetentionPolicy`. Audit events are append-only; the
retention run itself is recorded.

## 5. Verification before production

1. Run the full policy engine test suite:
   ```bash
   npx vitest run src/services/civicAgentPolicyEngine.test.js \
     src/services/civicAgentPolicyMigrations.test.js \
     src/data/civicAgentPolicyConstants.test.js \
     src/services/civicAgentPolicySimulation.test.js \
     api/_lib/civicAgentPolicySchemas.test.js \
     tests/civic-agent-policy-api.test.js
   ```
2. Run lint and security lint:
   ```bash
   npm run lint && npm run lint:security
   ```
3. Review the default policy and rules against organizational access-control
   requirements before production use.
4. Confirm no `VITE_` secrets are introduced and no raw prompts are logged.

## 6. Safety

- Synthetic fixtures only; no citizen records, credentials, raw documents or
  sensitive prompts in fixtures, logs or analytics.
- Policy inputs are hashed before storage; only length and resource identifiers
  are retained.
- Decisions are access-control outputs, not legal advice or benefit denial.
