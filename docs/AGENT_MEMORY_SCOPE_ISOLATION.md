# Civic Agent Memory Scope & Per-Case Context Isolation (#1447)

## Overview
Enforces tenant- and case-scoped memory partitions with allowlisted retrieval, deterministic no-memory mode, and default exclusion of secrets and sensitive PII.

## Architecture
- **Isolation Layer**: `src/services/agentMemory/memoryScopeIsolationLayer.js` (extends `caseIsolationGuard.js` and `piiLeakageGuardService.js`).
  - `createScopedMemoryEntry`: enforces `assertCaseScope`, validates `MEMORY_ORIGINS` (`citizen_entered_fact`, `official_record`, `ai_community_suggestion`), excludes secrets/tokens/high-entropy strings/PII, and attaches TTL expiry and `sourceReference` provenance.
  - `retrieveScopedContext`: enforces deterministic `no_memory` mode (`[]`), cross-case filtering, allowlisted category filtering, TTL expiry, and secret scanning on read.
- **Store & Serverless API**:
  - `api/_lib/agentMemoryScopeStore.js`
  - `api/_lib/handlers/agent-memory-scope.js` (registered in `api/[...path].js` under `/api/agent-memory-scope`).
  - Enforces Clerk auth, tenant authorization, `x-case-id`/`x-tenant-id` header scope checks, deletion endpoints, `Cache-Control: no-store`, and redacted audit logs.
- **Offline-First Storage & UI**:
  - `src/services/agentMemory/memoryScopeStorage.js`
  - `src/pages/AgentMemoryScopeWorkspace.jsx` (routes: `/agent-memory-scope`, `/memory-isolation`).

## Data Provenance, Configuration, Monitoring & Rollback
- Official records carry `source`, `jurisdiction`, `effectiveDate`, and `lastVerifiedAt`; incomplete references are marked `unverified`.
- All partition deletions and policy changes append redacted entries to `GET /api/agent-memory-scope/audit-log`.
- To roll back to stateless behavior immediately, set partition mode to `no_memory` or pass `?noMemory=true` on context retrieval.
