# Caregiver-Managed Multi-Person Civic Document Checklist (#1421)

## Architecture
- **Domain Service** (`src/services/caregiverChecklistService.js`):
  - Extends `checklistStorage.js` (`readChecklist`, `writeChecklist`, `deleteChecklist`) for optimistic-concurrency checklist persistence and `checklistExportService.js` for formatted export summaries.
  - Maintains isolated `persons` partitions inside each household workspace (`civicbridge_caregiver_households_v1`).
- **API Handler** (`api/_lib/handlers/caregiver-document-checklist.js` registered at `/api/caregiver-document-checklist`):
  - Enforces authentication (`401`), per-person scope & consent authorization (`403`), zero-PII validation (`400`), and rate limiting (`429`).
- **UI Workspace** (`src/pages/CaregiverChecklistWorkspace.jsx`, routes `/caregiver-checklist` & `/household-checklists`):
  - Accessible, responsive UI with loading, empty, error, and offline-mode states.

## Data Provenance & Privacy-by-Design
- Checklist items carry explicit `provenance`: `citizen_entered`, `official_record`, or `ai_suggestion`.
- Official application rules track `source`, `jurisdiction`, `effectiveDate`, and `lastVerifiedAt`; missing metadata is flagged `UNVERIFIED`.
- Sensitive PII (Aadhaar numbers, PAN, passwords, OTPs, biometrics) is rejected at both client service and API boundaries.
- Audit log entries (`getHouseholdAuditLog`) record actor, action, outcome, and IDs without storing sensitive PII.

## Configuration, Deployment, Monitoring & Rollback
- **Configuration**: No extra environment variables required; uses existing rate limiter (`abuseGuard.js`) and localStorage persistence.
- **Monitoring**: Track `401`/`403` authorization denials and `400 pii_rejected` responses via API logs and household audit logs.
- **Rollback**: Remove the `"caregiver-document-checklist"` entry from `api/[...path].js` and `/caregiver-checklist` routes from `src/App.jsx`, or revert the feature commit. Existing `civicbridge_checklists` keys remain backward-compatible.
