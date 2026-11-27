# Public Grievance Language Quality & Completeness Coach (#1444)

## Overview
A local-first drafting coach that checks grievance completeness (`date`, `location`, `requestedOutcome`, `supportingReference`), offers neutral wording suggestions with explicit user approval, supports multilingual prompts (`en`, `hi`, `bn`, `ta`), and preserves the citizen's original text verbatim.

## Architecture
- **Coach Engine**: `src/services/grievanceCompletenessCoachService.js` (extends `complaintQualityCoachService.js` and `piiLeakageGuardService.js`).
  - `analyzeGrievanceDraft`: detects missing fields, computes completeness score, generates pending neutral wording suggestions, and preserves `originalText`.
  - `decideCoachSuggestion`: applies user `approve` / `reject` decisions to `approvedDraftText` while keeping `originalText` immutable.
- **Store & Serverless API**:
  - `api/_lib/grievanceCompletenessCoachStore.js`
  - `api/_lib/handlers/grievance-completeness-coach.js` (registered in `api/[...path].js` under `/api/grievance-completeness-coach`).
- **Offline-First Storage & UI**:
  - `src/services/grievanceCompletenessCoachStorage.js`
  - `src/pages/GrievanceCompletenessCoachWorkspace.jsx` (routes: `/grievance-completeness-coach`, `/grievance-coach`).

## Data Provenance, Monitoring & Rollback
- Official filing rules include `source`, `jurisdiction`, `effectiveDate`, and `lastVerifiedAt`; incomplete rules are marked `unverified`.
- Zero Aadhaar, PAN, OTP, password, biometric, or contact PII is permitted.
- All draft analyses and suggestion approvals append redacted entries to `GET /api/grievance-completeness-coach/audit-log`.
- Because `originalText` is always preserved verbatim, citizens or operators can revert to the original text at any time by rejecting suggestions.
