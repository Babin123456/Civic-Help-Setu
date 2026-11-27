# Human-Reviewed Civic Data Contribution Pipeline

> **Issue**: [#1432](https://github.com/GoldRay19/Civic-Help-Setu/issues/1432)
> **Branch**: `feat/civic-data-contribution-pipeline-1432`

---

## 1. Architecture Overview

| Component | Role |
|-----------|------|
| `api/_lib/civicContributionPipelineStore.js` | Bounded store (500 proposals, 2,000 immutable frozen audit entries), field-level diff computation, contributor/publisher role separation, revision conflict detection (`409`), and rollback |
| `api/_lib/handlers/civic-contribution-pipeline.js` | Serverless REST API (`/api/civic-contribution-pipeline`) with Clerk JWT auth, publisher/admin gating, HTTPS source attachment validation, and PII guard |
| `src/services/civicContributionPipelineService.js` | Offline-first client service with `computeFieldDiffs`, `isHttpsUrl`, `hasForbiddenPII`, and provenance labels |
| `src/pages/CivicContributionPipelineWorkspace.jsx` | Accessible workspace (`/civic-contributions`, `/contribution-pipeline`) |

---

## 2. Role Separation, Conflict Resolution & Rollback

- **Role Separation**: Contributors can submit proposals (`PENDING_REVIEW`) but cannot approve or publish their own proposals (`403 SELF_REVIEW_BLOCKED`).
- **Rejection Reasons**: Rejecting a proposal requires a non-empty `rejectionReason` (`400`).
- **Conflict Resolution**: Publishing against a stale `baseRevision` returns `409 ERR_REVISION_CONFLICT` until explicitly resolved (`resolveConflict: true`).
- **Rollback**: Any `PUBLISHED` proposal can be rolled back by a publisher/admin, restoring `previousSnapshot` and appending a `PROPOSAL_ROLLED_BACK` entry to the immutable audit log.

---

## 3. Configuration, Monitoring & Rollback

- **Configuration**: Uses `CLERK_SECRET_KEY` for JWT verification; no new env vars required.
- **Monitoring**: Track `SELF_REVIEW_BLOCKED` (`403`), `ERR_REVISION_CONFLICT` (`409`), `PROPOSAL_ROLLED_BACK`, and PII rejections (`400`).
- **Rollback**: Remove `"civic-contribution-pipeline"` from `api/[...path].js` and `/civic-contributions` from `src/App.jsx`.

