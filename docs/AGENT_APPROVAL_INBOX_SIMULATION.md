# Civic Agent Approval Inbox & Action Simulation Mode (#1446)

## Overview
Provides an operator approval inbox and deterministic dry-run simulation mode for multi-step assistant actions before any external write or state mutation occurs.

## Architecture
- **Domain & Simulation Service**: `src/services/agentApprovalInboxService.js`
  - `createActionProposal`: validates proposed tool calls, affected records, expected side effects, and zero-PII boundaries, and automatically runs `simulateActionProposal`.
  - `simulateActionProposal`: deterministic dry-run preview showing `wouldMutateCount`, `policyChecks`, `ruleProvenance` (`verified` / `unverified`), and `predictedSideEffects` without executing writes.
  - `decideActionProposal` & `verifyDecisionLogChain`: enforces explicit operator approval (`approve`, `edit`, `reject`), server-side idempotency, and an immutable hash-chained decision log.
- **Store & Serverless API**:
  - `api/_lib/agentApprovalInboxStore.js`
  - `api/_lib/handlers/agent-approval-inbox.js` (registered in `api/[...path].js` under `/api/agent-approval-inbox`).
  - Enforces Clerk authentication, `admin` role + jurisdiction authorization, `idempotency-key` replay handling, rate limiting, and `Cache-Control: no-store`.
- **Offline-First Storage & Accessible UI**:
  - `src/services/agentApprovalInboxStorage.js`
  - `src/pages/AgentApprovalInboxWorkspace.jsx` (routes: `/agent-approval-inbox`, `/approval-inbox`).

## Data Provenance, Monitoring & Rollback
- Official policy checks require `source`, `jurisdiction`, `effectiveDate`, and `lastVerifiedAt`; incomplete rules are flagged `unverified`.
- Every decision appends an immutable hash-chained record to `GET /api/agent-approval-inbox/decision-log` with chain integrity verification (`chainValid`).
- To halt automated action proposals immediately, disable write-capable tool routes or reject pending proposals in the inbox.
