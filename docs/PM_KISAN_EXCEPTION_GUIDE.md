# PM-KISAN Installment Exception Diagnosis Guide (#1418)

## Architecture
- **Domain Service** (`src/services/pmKisanExceptionGuideService.js`):
  - Extends `checklistStorage.js` (`readChecklist`, `writeChecklist`) and `checklistExportService.js` (`formatTextSummary`).
  - Uses versioned status mappings (`PM_KISAN_MAPPING_VERSION = '2026.1'`) for `ekyc_pending`, `land_seeding_no`, `bank_aadhaar_seeding_pending`, and `beneficiary_record_mismatch`, plus safe `unknown` state handling.
- **API Handler** (`api/_lib/handlers/pm-kisan-exception-guide.js` registered at `/api/pm-kisan-exception-guide`):
  - Enforces authentication (`401`), admin/reviewer role authorization on mapping governance and audit logs (`403`), zero-credential/PII validation (`400`), and rate limiting (`429`).
- **UI Workspace** (`src/pages/PmKisanExceptionGuideWorkspace.jsx`, routes `/pm-kisan-guide` & `/pm-kisan-exceptions`):
  - Accessible decision-tree UI with offline support and printable help-desk checklist.

## Data Provenance & Privacy-by-Design
- Verified mappings carry `provenance: 'official_record'`, `sourceUrl`, `jurisdiction`, `effectiveDate`, and `lastVerifiedAt`.
- Unrecognized portal messages are marked `UNVERIFIED` with `provenance: 'citizen_entered'` and safe help-desk guidance.
- Aadhaar numbers, PAN, OTPs, passwords, biometrics, and bank account/IFSC details are never collected and are rejected at both service and API layers.

## Configuration, Deployment, Monitoring & Rollback
- **Configuration**: Uses `abuseGuard.js` rate limiting and `localStorage` (`civicbridge_pmkisan_diagnosis_v1`).
- **Monitoring**: Track `401`/`403` governance denials, `400 pii_rejected` responses, and `unknown` status frequency to prioritize new verified mappings.
- **Rollback**: Remove `"pm-kisan-exception-guide"` from `api/[...path].js` and `/pm-kisan-guide` routes from `src/App.jsx`, or revert the feature commit.
