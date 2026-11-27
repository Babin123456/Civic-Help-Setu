# Public School Infrastructure Defect and Follow-Up Register (#1437)

## Overview
School-level infrastructure defect register (`DRINKING_WATER`, `BOYS_GIRLS_TOILETS`, `RAMP_ACCESSIBILITY`, `CLASSROOM_INFRASTRUCTURE`, `ELECTRICITY_FANS`) with non-identifying reports, department routing, evidence moderation, school/ward aggregates, status history, and strict child privacy (zero student names or faces).

## Architecture
- **Defect Register & Child-Privacy Service**: `src/services/schoolDefectRegisterService.js` (extends `upSchoolFacilityGapService.js` and `piiLeakageGuardService.js`).
  - `validateNoStudentPiiOrFaces`: rejects student names, roll numbers, minor photos/faces, unstripped EXIF, and PII.
  - `createSchoolDefectReport`, `moderateSchoolDefectEvidence`, `updateSchoolDefectStatus`, `aggregateSchoolAndWardDefects`.
- **Store & Serverless API**:
  - `api/_lib/schoolDefectRegisterStore.js`
  - `api/_lib/handlers/school-defect-register.js` (registered in `api/[...path].js` under `/api/school-defect-register`).
- **Offline-First Storage & UI**:
  - `src/services/schoolDefectRegisterStorage.js`
  - `src/pages/SchoolDefectRegisterWorkspace.jsx` (routes: `/school-defect-register`, `/school-infrastructure-register`).

## Data Provenance, Monitoring & Rollback
- Official records include `source`, `jurisdiction`, `effectiveDate`, and `lastVerifiedAt`; incomplete records are marked `unverified`.
- All defect submissions, moderations, and status transitions append redacted entries to `GET /api/school-defect-register/audit-log`.
