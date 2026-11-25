# CI/CD Pipeline Health and Deployment History View

## Executive Summary
Contributors and maintainers require visibility into whether pull requests successfully passed static linting, unit test suites, security checks, and preview deployments. Scattered GitHub badge links often obscure failure causes and leave reviewers uncertain whether preview sites are ready.

The CI/CD Pipeline Health and Deployment History View provides an accessible, non-secret workflow viewer that correlates commit hashes with workflow run results and deployment status.

---

## Architectural Principles & Invariants

1. **Non-Secret Public Telemetry**:
   - Ingests strictly public GitHub Actions metadata: `runId`, `workflowName`, `branch`, short 7-char `commitSha`, and `durationSeconds`.
   - Never captures or stores runner secrets, credentials, or raw server logs.
2. **Safe Linkage for Failed Jobs**:
   - Failed jobs link directly to the authenticated GitHub Actions interface (`https://github.com/.../actions/runs/...`) instead of scraping stdout logs into the client UI.
3. **Confirmed Production Deployments**:
   - Production deployment is never marked `SUCCESS` until explicitly confirmed by the hosting provider (`providerConfirmed: true`). If unconfirmed, status remains `PENDING`.
4. **Distinct Pipeline States**:
   - Rigorously distinguishes between `SUCCESS`, `FAILED`, `PENDING`, `CANCELLED`, `SKIPPED`, and `UNAVAILABLE`.
5. **Rate-Limit & Stale Cache Resilience**:
   - Gracefully renders cached or fallback states if GitHub API quotas are constrained.

---

## Pipeline Status Evaluation Flowchart

```mermaid
flowchart TD
    A[New Git Commit Pushed] --> B[GitHub Actions Workflows Triggered]
    B --> C{Any Workflow Fails?}
    C -->|Yes| D[Pipeline Status: FAILED (Link to GitHub Run Logs)]
    C -->|No, All Pass| E[Trigger Preview Deployment]
    E --> F{Provider Confirms Success?}
    F -->|Pending| G[Deployment Status: PENDING]
    F -->|Confirmed| H[Deployment Status: SUCCESS (Surface Verified URL)]
```

### State Definitions & Error Fallbacks

| Status | Meaning | Actionable Guidance |
| :--- | :--- | :--- |
| `SUCCESS` | All workflow jobs and deployments completed successfully | Ready for maintainer review or release merge |
| `FAILED` | At least one check (lint, test, build, security) failed | Inspect linked GitHub Actions log URL |
| `PENDING` | Jobs currently executing or awaiting runner assignment | Monitor progress; wait for confirmation |
| `CANCELLED`| Superseded by newer commit or manually aborted | Re-run if necessary |
| `UNAVAILABLE`| Rate limit exceeded or network timeout reaching provider | Display cached pipeline state |

---

## Verification & Execution

Execute unit tests:
```bash
npx vitest run src/services/cicdPipelineHistoryService.test.js
```
Automated tests validate workflow run recording, failure log sanitization, unconfirmed production deployment guards, and commit pipeline aggregation.

