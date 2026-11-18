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
   - **Trusted Serverless Boundary**: `api/_lib/handlers/public-toilets.js` (rate limiting, single-flight deduplication, honeypot anti-spam, zero-PII rejection, and cryptographic receipt seal generation).

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
   - **Cryptographic Tracking Receipt**: Generates `PT-SEAL-XXXX-YYYY` for anonymous citizen tracking without collecting personal contact details.
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

