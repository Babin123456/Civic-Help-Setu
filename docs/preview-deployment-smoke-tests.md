# Preview Deployment Smoke Tests

## Objectives & Scope
Every Pull Request deployed to preview or staging environments must satisfy fundamental availability, layout integrity, and security invariants before being considered ready for maintainer review or automated merge.

This suite implements automated smoke testing across critical citizen-facing and administrative routes:
1. **Citizen Landing Page (`/`)**: Confirms root availability (HTTP 200) and essential branding elements.
2. **Civic Services Directory (`/services`)**: Confirms catalog navigation and search filter availability.
3. **Civic AI Guidance Assistant (`/assistant`)**: Confirms user interactive input interface readiness.
4. **Administrative Console (`/admin/audit`)**: Proves security boundary enforcement by strictly validating that unauthenticated requests receive redirection (HTTP 302/307) or authorization challenge (HTTP 401/403).
5. **Backend Health Probe (`/api/health`)**: Confirms backend connectivity and database availability (`status: "ok"`).

---

## Architecture & Integration

- Test Harness Module: `src/services/previewSmokeTestService.js`
- Test Suite: `src/services/previewSmokeTestService.test.js`
- Deterministic Evaluation: Runs without flake, supporting synthetic response mock testing as well as live HTTP polling.
- Zero External Coupling: Can run locally, during Git commit hooks, or inside GitHub Actions preview deployment workflows.

---

## Route Health Verification Matrix

| Route | Classification | Expected Status | Success Condition |
| :--- | :--- | :--- | :--- |
| `/` | Public Citizen Portal | `200 OK` | Body contains `"Civic Help Setu"` brand identifier |
| `/services` | Civic Catalog | `200 OK` | Service filter search and scheme categories rendered |
| `/assistant` | AI Guidance | `200 OK` | Interaction input and conversational view available |
| `/admin/*` | Protected Admin | `302/401/403` | Unauthenticated access strictly redirected to sign-in |
| `/api/health`| Operational Health | `200 OK` | Payload contains `{ "status": "ok" }` |

---

## Security Response Header Checks

In addition to routing availability, preview deployments validate that critical security headers are actively emitted:
- `X-Content-Type-Options: nosniff`: Prevents MIME-sniffing vulnerabilities on user attachments.
- `X-Frame-Options: DENY`: Protects citizen forms against clickjacking exploits.
- `Strict-Transport-Security`: Mandates end-to-end encrypted HTTPS transmission.
- `Content-Security-Policy`: Report-only or enforcing directives mitigating inline script injection.

---

## Detailed Failure Triage Runbook

When a preview deployment smoke check flags an error, maintainers should review the following indicators:
1. **HTTP 500 / 502**: Indicates uncaught initialization errors in React SSR hydration or serverless API handlers.
2. **Missing Brand Snippet**: Signals broken root component rendering or missing environment configuration files.
3. **Protected Admin 200 OK**: Critical security regression indicating misconfigured middleware authentication guards. The PR must be blocked immediately.
4. **Health Check Mismatch**: Indicates database or downstream service reachability failures.

---

## Verification & Execution

Execute the unit test suite locally:
```bash
npx vitest run src/services/previewSmokeTestService.test.js
```
Automated workflows execute this suite during PR review cycles.

