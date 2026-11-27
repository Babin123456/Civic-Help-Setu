# Governed Agent Tool Registry — Operations, Deployment & Evaluation Guide

This runbook documents deployment configuration, migration/rollback, observability, retention, accessibility, and reproducible evaluation for the Governed Agent Tool Registry (`#1146`).

---

## 1. Deployment Configuration (Vercel + Clerk + Firebase)

Civic Help Setu deploys all serverless API routes through the single Vercel dispatcher [`api/[...path].js`](../api/%5B...path%5D.js). The tool registry handler lives at [`api/_lib/handlers/agent-tool-registry.js`](../api/_lib/handlers/agent-tool-registry.js) and is exposed at `/api/agent-tool-registry`.

### Environment Variables

| Variable | Required | Scope | Purpose |
|---|---|---|---|
| `TOOL_CAPABILITY_SECRET` | Yes (prod) | Server-only | 32+ byte random HMAC-SHA256 secret for minting/verifying `ctok_v1` capability tokens. Never expose as `VITE_*`. |
| `CLERK_SECRET_KEY` | Yes (prod) | Server-only | Verifies Clerk Bearer tokens and fetches authoritative `publicMetadata.role`. |
| `APP_ORIGIN` / `APP_ALLOWED_ORIGINS` | Recommended | Server-only | Enforced by `api/_lib/requestSecurity.js` for Origin/CSRF protection on `POST` routes. |

> **Local / Test Mode:** In Vitest or local browser demo mode (where no backend `TOOL_CAPABILITY_SECRET` exists in the browser), the client requests capabilities from `/api/agent-tool-registry` when available and falls back to an ephemeral in-memory session key clearly marked as local sandbox mode — production secrets are never embedded in client bundles.

---

## 2. API Endpoints (`schemaVersion: "1.0.0"`)

| Method & Path | Auth | Purpose |
|---|---|---|
| `GET /api/agent-tool-registry?schema=1` | Public | Returns contract version, service health, and aggregate security metrics (no PII). |
| `GET /api/agent-tool-registry/tools` | Public | Lists registered tools, JSON schemas, risk tiers, scopes, and revocation status. |
| `POST /api/agent-tool-registry/capabilities` | Verified Clerk User | Issues a short-lived (`<= 300s`) scoped capability bound to `actorId` and role ceiling. |
| `POST /api/agent-tool-registry/invoke` | Verified Clerk User | Validates capability signature, TTL, single-use `jti`, user binding, JSON Schema args, approvals, and executes tool. |
| `GET /api/agent-tool-registry/audit` | Verified Admin | Returns PII-scrubbed invocation audit events and decision counters. |
| `POST /api/agent-tool-registry/revoke` | Verified Admin | Revokes a tool, capability `jti`, or user capability set; supports restoring a tool. |

---

## 3. Observability & Safe Error Handling

- **Metrics tracked:** `totalRequests`, `issuedCapabilities`, `allowedInvocations`, `deniedInvocations`, `replayBlocked`, `crossUserBlocked`, `privilegeEscalationBlocked`, `schemaRejected`, `revocationBlocked`, and `averageLatencyMs`.
- **Safe Errors:** Boundary validation failures return structured JSON (`400` / `401` / `403` / `409` / `429` / `503`) with deterministic error codes (`UNKNOWN_TOOL`, `INVALID_SCHEMA`, `CAPABILITY_REPLAYED`, `CROSS_USER_DENIED`, `SCOPE_DENIED`, `TOOL_REVOKED`, `APPROVAL_REQUIRED`, `PROVENANCE_REQUIRED`) and zero stack traces or secret echoes.
- **Zero-PII Audit Trail:** All audit records strip raw argument values (`argKeys` only) and pass strings through `scrubPii` (`api/_lib/piiScrubber.js`).

---

## 4. Migration, Firestore Rules & Rollback Guidance

### Firestore Security Rules
`firebase/firestore.rules` locks down `agent_tool_registry_revocations` and `agent_tool_registry_audit` to `allow read, write: if false;` so browser clients cannot tamper with revocation lists or audit logs directly; only verified server Admin SDK calls or the serverless API may manage them.

### Migration Steps
1. Set `TOOL_CAPABILITY_SECRET` in Vercel Project Settings (Production & Preview).
2. Deploy updated `api/[...path].js` and `firebase/firestore.rules`.
3. Verify `GET /api/agent-tool-registry?schema=1` returns `200 OK` and `status: "healthy"`.

### Rollback Procedure
1. **Immediate Tool Kill-Switch (Zero Redeploy):** In `Admin` → **Tool Registry & Capabilities**, click **Revoke Tool** for any misbehaving tool (or engage global kill-switch in `civicAgentIncidentResponseService`).
2. **Key Rotation / Mass Invalidation:** Rotate `TOOL_CAPABILITY_SECRET` in Vercel — all outstanding `ctok_v1` tokens are immediately invalidated within 0 seconds.
3. **Full Rollback:** Revert the PR commit on `main` and redeploy; `PolicyControlledToolRouter` retains backwards-compatible deterministic validation for existing callers.

---

## 5. Reproducible Evaluation Command

Run the automated test and adversarial security evaluation suite:

```bash
npm run eval:tool-registry
```

And run full project verification:

```bash
npm test && npm run lint:security && npm run contracts:check && npm run build
```
