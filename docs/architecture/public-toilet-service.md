# Public Toilet Availability, Accessibility, and Maintenance Status Service (#758)

## Overview
Civic Help Setu provides a dedicated, production-grade **Public Toilet Availability, Accessibility, and Maintenance Status Service**. The service provides a searchable, verified municipal sanitation facility directory with operating hours, accessibility fixtures, sanitary amenities, cleaning event ledgers, maintenance work orders, bounded explainable intelligence, and moderated citizen feedback.

---

## Architectural Principles

1. **Separation of Concerns**:
   - **Presentation & Interaction**: `src/pages/PublicToiletDirectory.jsx` and modular components under `src/components/toilets/` (`ToiletCard`, `ToiletFilters`, `ToiletDetailModal`, `ToiletIssueReportModal`, `ToiletCleaningLogModal`, `ToiletMaintenanceModal`, `ToiletRecommendationsCard`, `ToiletStates`).
   - **Domain Contract & Validation**: `src/data/publicToiletContract.js` (normalized schemas, operating-hour logic, zero-PII sanitization, public projection masking).
   - **Persistence & Idempotency**: `src/services/publicToiletStorage.js` (`localStorage` with transparent in-memory fallback, multi-record state updates, idempotency key deduplication, schema version migrations, and 90-day cleaning log retention pruning).
   - **Bounded Intelligence Engine**: `src/services/toiletDiagnosticsService.js` (deterministic ruleset version `1.0.0-deterministic`, explainable recommendations with source field citations, and mandatory human accept/edit/reject decision controls).
   - **Trusted Serverless Boundary**: `api/_lib/handlers/public-toilets.js` (rate limiting, transactional idempotency, honeypot anti-spam, zero-PII rejection, and server-issued receipts after durable persistence).

2. **Domain State Machines**:
   - **Facility Status**:
     $$\text{verified\_active} \longleftrightarrow \text{temporarily\_closed} \longleftrightarrow \text{under\_maintenance} \longrightarrow \text{decommissioned}$$
     - Facilities automatically transition to `under_maintenance` when a `critical` maintenance ticket (e.g. water outage or sewer backflow) is filed, and automatically recover to `verified_active` once all critical tickets are resolved.
   - **Maintenance Ticket Lifecycle**:
     $$\text{reported} \longrightarrow \text{acknowledged} \longrightarrow \text{in\_progress} \longrightarrow \text{resolved} \longrightarrow \text{closed} \quad (\text{or } \text{rejected})$$
   - **Citizen Feedback Moderation**:
     $$\text{pending} \longrightarrow \text{approved} \quad (\text{or } \text{rejected})$$

3. **Accessibility & WCAG 2.1 AA Compliance**:
   - Status indicators do not rely on color alone: distinct icons (Clock, AlertTriangle, Wrench) and clear text labels (`Open Now`, `Temporarily Closed`, `Under Maintenance`) are rendered.
   - Accessible table alternative (`role="region"` with keyboard scrollability) provided alongside card grid.
   - High-contrast focus rings, semantic labels, `aria-modal="true"`, and keyboard Escape listeners on all modals.

4. **Privacy, Security & Auditability**:
   - **Zero PII**: Rejection of Aadhaar, PAN, phone numbers, and credentials in ticket and feedback payloads.
   - **Public Field Masking**: `maskPublicFacility` strips internal contractor notes, operator contact numbers, and supervisor tokens before serving citizen/public queries.
   - **Tracking Receipt**: The server issues an opaque `PT-<UUID>` receipt after the report is committed. It is a reference identifier, not proof of municipal dispatch or a digital signature. The old checksum helper remains for compatibility only.
   - **Append-Only Audit Ledger**: Records all closures, overrides, ticket updates, and recommendation actions with timestamps and roles.

---

## Targeted Test Verification Suite

Run all targeted tests for Issue #758:

```bash
# Domain contract, calculations, and validation tests
npx vitest run src/data/publicToiletContract.test.js

# Persistent storage, migrations, and retention tests
npx vitest run src/services/publicToiletStorage.test.js

# Explainable AI / intelligence diagnostics tests
npx vitest run src/services/toiletDiagnosticsService.test.js

# Business logic, RBAC, and orchestration tests
npx vitest run src/services/publicToiletService.test.js

# Serverless API handler and abuse-guard tests
npx vitest run api/_lib/handlers/public-toilets.test.js

# Workspace page and UI components tests
npx vitest run src/pages/PublicToiletDirectory.test.jsx
```



## Durable report API (#1126)

Citizen reports are stored in the server-only Firestore collection
`publicToiletSubmissions`, separate from the browser's facility directory mirror.
Configure the existing `FIREBASE_SERVICE_ACCOUNT` JSON and `CLERK_SECRET_KEY` on
the server. If storage is unavailable the API returns 503 without a receipt;
there is no process-memory production fallback. No existing in-memory queue can
be recovered after its process has exited.

- `POST /api/public-toilets` requires an `Idempotency-Key` containing 16–128
  letters, digits, underscores or hyphens. Generate a random key per report and
  reuse it with an unchanged payload on retry. The key's SHA-256 hash identifies
  the document. A Firestore transaction creates the report and receipt together;
  retries return the same receipt, while a different normalized payload returns
  409. Description and optional rating, severity and cleanliness are validated.
- Plain `GET` is health information only and never returns submissions.
- `GET ?view=moderation&limit=20&cursor=...` requires a Clerk bearer token whose
  user is confirmed as admin via server-fetched public metadata. Limits are
  1–50. The opaque cursor orders by descending creation time and document ID;
  `nextCursor: null` ends the page sequence. The standard descending single-field
  index supplies this query; no composite index or backfill is needed.
- `PATCH` with `{id, decision: "approved" | "dismissed"}` uses the same access
  check and a transaction. Only queued reports can transition; repeating the
  same decision preserves the first actor and timestamp, and a conflicting
  decision returns 409. Reviews do not update municipal systems or dispatch work.

Deploy the rules alongside the API: all client SDK access, including Firebase
admin-role clients, is explicitly denied for this collection. Server Admin SDK
access uses service-account IAM. Queue responses are `no-store`. Deploying the
new collection requires no schema migration; verify configuration and submit a
test report before directing real traffic to it. Rollback should preserve the
collection and its audit data; the old public queue endpoint must not be restored.

Run focused regressions with `npx vitest run tests/public-toilets.test.js
api/_lib/handlers/public-toilets.test.js api/_lib/publicToiletStore.test.js
api/_lib/toiletModerator.test.js tests/toilet-durable-ui.test.jsx`.
Run the actual Firestore transaction/rules check with
`npm --prefix firebase/emulator install` then
`npm --prefix firebase/emulator run test:toilets` (Java and local port 8080 required).
