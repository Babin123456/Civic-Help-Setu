# Public Anganwadi Service Availability and Nutrition-Day Calendar (#1438)

## Overview
Provides a source-backed Anganwadi centre directory and Nutrition-Day (VHSND) calendar with separate official and community status channels, accessible `en`/`hi` language, stale-status expiry, official escalation contacts, and strict zero-child-health-data protection.

## Architecture
- **Calendar & Child-Privacy Service**: `src/services/anganwadiCalendarService.js` (extends `upAnganwadiService.js` and `piiLeakageGuardService.js`).
  - `validateNoChildHealthDataOrPii`: rejects Aadhaar, PAN, OTP, password, biometric, contact PII, and child-level health/minor fields (`childName`, `samStatus`, `muac`, `birthWeight`, `immunizationRecord`, etc.).
  - `evaluateStatusFreshness`: flags statuses older than `7` days as `stale_expired`.
  - `publishOfficialScheduleChange` & `submitCommunityCentreStatus`: keeps official schedules and community reports visibly distinct.
- **Store & Serverless API**:
  - `api/_lib/anganwadiCalendarStore.js`
  - `api/_lib/handlers/anganwadi-calendar.js` (registered in `api/[...path].js` under `/api/anganwadi-calendar`).
- **Offline-First Storage & UI**:
  - `src/services/anganwadiCalendarStorage.js`
  - `src/pages/AnganwadiCalendarWorkspace.jsx` (routes: `/anganwadi-calendar`, `/anganwadi-services`).

## Data Provenance, Monitoring & Rollback
- Official centre records include `source`, `jurisdiction`, `effectiveDate`, and `lastVerifiedAt`; incomplete records are marked `unverified`.
- All schedule changes and community status reports append redacted entries to `GET /api/anganwadi-calendar/audit-log`.
