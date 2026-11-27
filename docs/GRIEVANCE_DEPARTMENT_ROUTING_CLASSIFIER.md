# AI-Assisted Grievance Department Routing Classifier with Human Override (#1445)

## Overview
Classifies de-identified civic complaints into ranked municipal/state departments with evidence phrases, multi-department support, confidence thresholds, deterministic fallback, and per-class evaluation metrics.

## Architecture
- **Routing Classifier**: `src/services/grievanceDepartmentRoutingService.js` (extends `grievanceClassificationService.js` and `piiLeakageGuardService.js`).
  - `classifyGrievanceDepartments`: returns ranked department suggestions with `confidence`, `evidencePhrases`, `reasons`, `isMultiDepartment`, `requiresHumanConfirmation`, and `usedDeterministicFallback`.
  - `evaluatePerClassRoutingMetrics`: computes `precision`, `recall`, `f1`, `support`, and `accuracy` on `REVIEWED_DEIDENTIFIED_EXAMPLES`.
  - `applyHumanRoutingOverride`: records operator confirmation or multi-department override.
- **Store & Serverless API**:
  - `api/_lib/grievanceDepartmentRoutingStore.js`
  - `api/_lib/handlers/grievance-department-routing.js` (registered in `api/[...path].js` under `/api/grievance-department-routing`).
- **Offline-First Storage & UI**:
  - `src/services/grievanceDepartmentRoutingStorage.js`
  - `src/pages/GrievanceDepartmentRoutingWorkspace.jsx` (routes: `/grievance-department-routing`, `/department-routing`).

## Data Provenance, Monitoring & Rollback
- Official department rules include `source`, `jurisdiction`, `effectiveDate`, and `lastVerifiedAt`; incomplete rules are marked `unverified`.
- Human overrides append redacted entries to `GET /api/grievance-department-routing/audit-log`.
- To fall back immediately to manual triage without AI suggestions, pass `forceDeterministicFallback: true`.
