# Public Waterbody Restoration Milestone & Evidence Tracker (#1442)

## Overview
Links official waterbody restoration work plans to measurable milestones (`inlet_cleanup`, `desilting`, `water_testing`, `boundary_protection`), separates official claims from independent community observations, preserves corrections append-only, and blocks unsupported environmental health claims.

## Architecture
- **Tracker Service**: `src/services/waterbodyRestorationService.js`
  - `verifyWaterbodySourceProvenance`: requires `source`, `jurisdiction`, `effectiveDate`, and `lastVerifiedAt`; incomplete sources are marked `unverified`.
  - `validateNoUnsupportedHealthClaims`: rejects unverified potable/health claims (e.g. `"safe to drink"` without a verified lab citation).
  - `addCommunityObservation` & `recordMilestoneCorrection`: keeps official claims, citizen observations, and AI advisories visibly distinct and preserves all prior corrections.
- **Store & Serverless API**:
  - `api/_lib/waterbodyRestorationStore.js`
  - `api/_lib/handlers/waterbody-restoration.js` (registered in `api/[...path].js` under `/api/waterbody-restoration`).
- **Offline-First Storage & UI**:
  - `src/services/waterbodyRestorationStorage.js`
  - `src/pages/WaterbodyRestorationWorkspace.jsx` (routes: `/waterbody-restoration`, `/waterbody-tracker`).

## Data Provenance, Monitoring & Rollback
- Zero Aadhaar, PAN, OTP, password, biometric, or contact PII is permitted.
- All observations and corrections append redacted entries to `GET /api/waterbody-restoration/audit-log`.
- Because corrections are append-only (`corrections[]`), prior milestone states remain auditable and reversible.
