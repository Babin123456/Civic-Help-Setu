# Public Park Maintenance and Amenity Inspection Schedule (#1440)

## Overview
Provides a park-level maintenance schedule and amenity inspection log tracking `play_area`, `public_toilet`, `drinking_water`, `walking_track`, and `lighting` separately, with temporary closure alerts, source freshness, and photo personal-data moderation.

## Architecture
- **Schedule & Moderation Service**: `src/services/parkMaintenanceScheduleService.js` (extends `publicParksDirectoryService.js` and `piiLeakageGuardService.js`).
  - `verifyParkSourceProvenance`: checks `source`, `jurisdiction`, `effectiveDate`, and `lastVerifiedAt`, computing `fresh` / `stale` / `unverified` freshness.
  - `moderatePhotoForPersonalData`: blocks photos containing faces/license plates, unstripped EXIF metadata, or PII in captions.
  - `publishMaintenanceWindow` & `submitResidentParkObservation`: keeps official schedules, resident observations, and AI advisories distinct.
- **Store & Serverless API**:
  - `api/_lib/parkMaintenanceScheduleStore.js`
  - `api/_lib/handlers/park-maintenance-schedule.js` (registered in `api/[...path].js` under `/api/park-maintenance-schedule`).
- **Offline-First Storage & UI**:
  - `src/services/parkMaintenanceScheduleStorage.js`
  - `src/pages/ParkMaintenanceScheduleWorkspace.jsx` (routes: `/park-maintenance-schedule`, `/park-inspections`).

## Data Provenance, Monitoring & Rollback
- Zero Aadhaar, PAN, OTP, password, biometric, or contact PII is permitted.
- All maintenance window publications and resident observations append redacted entries to `GET /api/park-maintenance-schedule/audit-log`.
