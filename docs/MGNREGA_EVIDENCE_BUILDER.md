# MGNREGA Work-Demand and Wage Delay Evidence Builder (#1419)

## Architecture
- **Domain Service** (`src/services/mgnregaEvidenceBuilderService.js`):
  - Extends `grievanceEvidenceService.js` (`getAllGrievanceDrafts`, `saveAllGrievanceDrafts`) for saving privacy-safe complaint dossiers.
  - Records demand receipt references, work allocation dates, muster-roll discrepancies, and unpaid wage periods without fabricating rupee entitlement calculations.
- **API Handler** (`api/_lib/handlers/mgnrega-evidence-builder.js` registered at `/api/mgnrega-evidence-builder`):
  - Enforces authentication (`401`), worker-owner authorization (`403`), zero-PII validation (`400`), and rate limiting (`429`).
- **UI Workspace** (`src/pages/MgnregaEvidenceWorkspace.jsx`, routes `/mgnrega-evidence` & `/wage-delay-evidence`):
  - Low-literacy 4-step guided flow with loading/empty/error/offline states.

## Data Provenance & Privacy-by-Design
- Timeline entries and evidence items carry explicit `provenance`: `citizen_entered`, `official_record`, or `ai_suggestion`.
- Published central MGNREGA Act, 2005 references include `sourceUrl`, `jurisdiction`, `effectiveDate`, and `lastVerifiedAt`; unverified local rules are marked `UNVERIFIED`.
- Aadhaar numbers, PAN, OTPs, passwords, biometrics, and bank account/IFSC details are rejected; Job Card references are masked in exported dossiers (`***XXXX`).

## Configuration, Deployment, Monitoring & Rollback
- **Configuration**: Uses `abuseGuard.js` rate limiting and `localStorage` persistence (`civicbridge_mgnrega_evidence_v1`).
- **Monitoring**: Track `401`/`403` denials and `400 pii_rejected` responses via API logs and non-PII case audit logs.
- **Rollback**: Remove `"mgnrega-evidence-builder"` from `api/[...path].js` and `/mgnrega-evidence` routes from `src/App.jsx`, or revert the feature commit.
