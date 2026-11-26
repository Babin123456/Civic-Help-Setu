# Civic Agent Workflow Policy-as-Code Engine — Evaluation Report (#1187)

## 1. Evaluation criteria

| Criterion | Target | Measured by |
|-----------|--------|-------------|
| Deny-by-default | Unknown resource / no matching rule → denied | Unit tests |
| Deny-by-default | Missing policy → denied | Unit + simulation tests |
| Allow rule match | Matching allow rule → permitted | Unit tests |
| Require approval | High-impact without human approval → REQUIRE_APPROVAL | Unit tests |
| Require approval | High-impact with human approval → permitted | Unit tests |
| Confirmation gate | Confirmation-gated rule without confirmation → denied | Unit tests |
| Confirmation gate | Confirmation-gated rule with confirmation → permitted | Unit tests |
| Role restriction | Non-matching role → denied | Unit tests |
| Conflict resolution | Higher-priority deny wins over lower-priority allow | Simulation tests |
| Emergency revocation | Actions suspended after revocation | Simulation tests |
| Bypass detection | Expected-deny request permitted → bypass flagged | Simulation tests |
| Invalid input | 400 `validation_failed` with stable codes | Unit + API tests |
| Missing run/policy | Policy not found → `CP_POLICY_NOT_FOUND` | Unit tests |
| Emergency lock | All actions refused → `CP_EMERGENCY_REVOKED` | Unit tests |
| Concurrency | Concurrent evaluations succeed | Unit tests |
| No sensitive data persisted | Inputs hashed; sensitive keys/values rejected | Unit tests + code review |
| Migration & rollback | Legacy shape migrated; rollback/reset restore valid store | Unit tests |
| Retention | Old archived/revoked policies retired | Unit tests |

## 2. Reproducible commands

```bash
# Install dependencies
npm install --no-audit --no-fund

# Lint all code (including security rules)
npm run lint
npm run lint:security

# Run policy-engine-related tests
npx vitest run \
  src/services/civicAgentPolicyEngine.test.js \
  src/services/civicAgentPolicyMigrations.test.js \
  src/data/civicAgentPolicyConstants.test.js \
  src/services/civicAgentPolicySimulation.test.js \
  api/_lib/civicAgentPolicySchemas.test.js \
  tests/civic-agent-policy-api.test.js

# Run full test suite (note: pre-existing failures in unrelated files)
npx vitest run

# Build
npm run build
```

## 3. Test coverage summary

| Test file | Area |
|-----------|------|
| `src/services/civicAgentPolicyEngine.test.js` | Validation, evaluate, upsertPolicy, emergencyRevoke, listPolicies, getPolicy, getPolicyVersions, getEvaluationAudit, deny-by-default, allow rules, require_approval, confirmation gating, role restrictions, conflict resolution, emergency lock, concurrency |
| `src/services/civicAgentPolicyMigrations.test.js` | Empty/seed store, validation helpers, migration, indexes, load/persist, transaction, rollback, reset, retention |
| `src/data/civicAgentPolicyConstants.test.js` | Schema version, default policy, enums, error codes, deny-by-default rule, id patterns |
| `src/services/civicAgentPolicySimulation.test.js` | Bypass detection, conflict resolution, emergency revocation, deny-by-default simulation |
| `api/_lib/civicAgentPolicySchemas.test.js` | Versioned schema validation for all endpoints |
| `tests/civic-agent-policy-api.test.js` | API integration: schema, evaluate, list policies, upsert, get policy, emergency revoke, versions, audit, simulate, auth gating |

## 4. Negative / permission / retry / concurrency cases

- **Negative:** invalid resourceType → 400; invalid policyId → 400; non-boolean citizenConfirmed → 400; invalid rule effect → 400; too many rules (>500) → 400; limit out of range → 400; non-array simulate requests → 400.
- **Permission:** high-impact without human approval → REQUIRE_APPROVAL; operator endpoints without operator session → 403; user endpoints without session → 401; missing token → 401.
- **Retry/budget:** no retries (deterministic, single evaluation); concurrency cap enforced; each evaluation counted independently.
- **Concurrency:** concurrent evaluations succeed under normal load.

## 5. Dependencies, licences, and cost

- **Runtime dependencies:** none beyond existing (`react`, `lucide-react`, `vitest`, `eslint`).
- **Dev dependencies:** vitest, eslint (existing).
- **Licences:** MIT (project LICENSE).
- **Cost:** localStorage/in-memory writes bounded by retention; API calls are lightweight reads/writes. No external calls made by the engine itself.
- **Performance:** per-evaluation in-memory rule matching sorted by priority; atomic store transactions; bounded retention via `applyPolicyRetentionPolicy`.

## 6. Safety

- Synthetic fixtures only (`tests/fixtures/civicAgentPolicySyntheticFixtures.js`): made-up policy/rule/resource ids, roles and fabricated outcomes. No citizen records, credentials, raw documents, or sensitive prompts.
- Logs and analytics: no PII, no raw prompts (inputs hashed), no credentials.
- AI: not used; all rules are deterministic policy evaluations.
- Decisions are access-control outputs, not legal advice, benefit denial or official verification.
