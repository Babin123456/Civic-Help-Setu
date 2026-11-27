# Civic AI Hallucination & Unsupported-Claim Reporting Workflow (#1448)

## Overview
Provides a claim-level reporting, risk-routing, correction/withdrawal, and regression-fixture export workflow for AI-generated civic guidance.

## Architecture
- **Domain Service**: `src/services/aiHallucinationReportService.js`
  - Links each report to `responseId`, `claimId`, `serviceId`, `modelVersion`, `rulesetVersion`, and `sourceSnapshot`.
  - Enforces **minimal telemetry** and **reporter privacy** (`anonymizeReporterId`, zero PII validation via `piiLeakageGuardService.js`).
  - Classifies risk (`high` / `medium` / `low`) and routes high-risk reports (`fabricated_portal_or_url`, `misstated_requirement`, or uncited high-stakes claims) to `priority_reviewer_queue`.
  - Supports reporter withdrawal (`withdrawn_by_reporter`) and official reviewer resolution (`correction_issued`, `dismissed`, `resolved_no_defect`), exporting redacted regression fixtures (`exportAsRegressionFixture`).
- **Store & API**:
  - `api/_lib/aiHallucinationReportStore.js`
  - `api/_lib/handlers/ai-hallucination-reports.js` (registered in `api/[...path].js` under `/api/ai-hallucination-reports`).
  - Enforces Clerk authentication, reporter isolation (citizens only see their own anonymized receipts), `admin` role + jurisdiction authorization for resolution and audit logs, rate limiting, and `Cache-Control: no-store`.
- **Offline-First Storage & UI**:
  - `src/services/aiHallucinationReportStorage.js`
  - `src/pages/AiHallucinationReportWorkspace.jsx` (routes: `/ai-hallucination-reports`, `/report-ai-claim`).
  - Keeps AI-generated claims, citizen-entered reports, and official verified corrections visibly distinct; handles loading, empty, error, and offline states.

## Data Provenance & Privacy
Official corrections require `source`, `jurisdiction`, `effectiveDate`, and `lastVerifiedAt`. Incomplete or missing snapshots are marked `unverified`. Zero Aadhaar, PAN, OTP, password, biometric, or contact PII is permitted.

## Configuration, Monitoring & Rollback
- Server environment variables: `CLERK_SECRET_KEY` for session verification; `APP_ORIGIN` / `APP_ALLOWED_ORIGINS` for request security.
- All report submissions, withdrawals, and resolutions write redacted entries to `GET /api/ai-hallucination-reports/audit-log`.
- To roll back a faulty model/ruleset version flagged by exported regression fixtures, revert the model/ruleset configuration and re-run `npm test -- --run src/services/aiHallucinationReportService.test.js tests/ai-hallucination-reports.test.js`.
