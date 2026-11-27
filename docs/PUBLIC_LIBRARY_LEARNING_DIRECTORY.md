# Public Library and Community Learning Resource Availability Directory (#1439)

## Overview
Searchable directory for public libraries, reading rooms, and digital learning hubs featuring official provenance, last-verified timestamps, accessible filters, opening-hour exceptions, membership rules, and moderated community updates.

## Architecture
- **Directory & Moderation Service**: `src/services/libraryResourceDirectoryService.js` (extends `libraryService.js` and `piiLeakageGuardService.js`).
  - `verifyLibraryProvenance`: enforces `source`, `jurisdiction`, `effectiveDate`, and `lastVerifiedAt`; incomplete rules are marked `unverified`.
  - `searchLearningFacilities`: filters by `wheelchairOnly`, `brailleOnly`, `screenReaderOnly`, `digitalLabOnly`, `wardId`, and text query.
  - `addOpeningHourException`, `submitCommunityLibraryUpdate`, `moderateCommunityLibraryUpdate`.
- **Store & Serverless API**:
  - `api/_lib/libraryResourceDirectoryStore.js`
  - `api/_lib/handlers/library-resource-directory.js` (registered in `api/[...path].js` under `/api/library-resource-directory`).
- **Offline-First Storage & UI**:
  - `src/services/libraryResourceDirectoryStorage.js`
  - `src/pages/LibraryResourceDirectoryWorkspace.jsx` (routes: `/library-resource-directory`, `/community-learning-directory`).

## Data Provenance, Monitoring & Rollback
- Zero Aadhaar, PAN, OTP, password, biometric, or contact PII is permitted.
- All community updates, moderations, and opening-hour exceptions append redacted entries to `GET /api/library-resource-directory/audit-log`.
