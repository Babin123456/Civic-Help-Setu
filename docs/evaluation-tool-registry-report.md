# Governed Agent Tool Registry — Evaluation Report (#1146)

- **Command:** `npm run eval:tool-registry`
- **Fixtures:** Strictly synthetic (`src/services/toolRegistry/__fixtures__/syntheticToolFixtures.js`)
- **Score:** 8/8 security & governance checks passed

## Check Results

| Check | Category | Result |
|---|---|---|
| EVAL-01: Default-deny unknown tool | Boundary | PASS |
| EVAL-02: Privilege escalation blocked | Authorization | PASS |
| EVAL-03: Replay & concurrent race blocked | Replay | PASS |
| EVAL-04: Cross-user token reuse blocked | Isolation | PASS |
| EVAL-05: Malformed JSON Schema & prototype pollution rejected | Validation | PASS |
| EVAL-06: Expiry enforcement | TTL | PASS |
| EVAL-07: Human approval & provenance gating | Governance | PASS |
| EVAL-08: Admin revocation & PII-free audit trail | Operations | PASS |

## Aggregate Registry Telemetry Snapshot (PII-Free)

- Capabilities Issued: 6
- Allowed Invocations: 2
- Denied Invocations: 10
- Replays Blocked: 1
- Cross-User Blocked: 1
- Privilege Escalations Blocked: 1
- Schema Violations Rejected: 1
- Revocations Enforced: 1
