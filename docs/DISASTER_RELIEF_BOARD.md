# Public Disaster Relief Entitlement and Camp Information Board (#1435)

## Architecture
Extends `src/services/disasterReliefService.js`, `src/data/emergencyReliefData.js`, `src/services/upDisasterReliefCampService.js`, and `src/services/piiLeakageGuardService.js`:
- **Service**: `src/services/disasterReliefBoardService.js` — evaluates camp & entitlement freshness (`evaluateReliefRecordFreshness`), enforces verified provenance (`source`, `jurisdiction`, `effectiveDate`, `verifiedAt`), marks unknown rules `unverified`, auto-excludes expired records, and provides offline survival essentials (`getOfflineBoardEssentials`, `saveOfflineBoardSnapshot`).
- **API & Store**: `api/_lib/disasterReliefBoardStore.js`, `api/_lib/handlers/disaster-relief-board.js`, and `api/[...path].js` (`/api/disaster-relief-board`) with Clerk auth, `admin` role + jurisdiction checks, zero-PII enforcement, rate limiting, and `Cache-Control: no-store`.
- **Accessible UI**: `src/pages/DisasterReliefBoardWorkspace.jsx` at `/disaster-relief-board` and `/relief-camp-board` with low-bandwidth text mode, offline mode banner, stale-data warnings, and visibly distinct origin badges.

## Data Provenance & Privacy
- Official camp and entitlement records carry `source`, `jurisdiction`, `effectiveDate`, and `verifiedAt`; missing provenance is marked `unverified`.
- Citizen observations are stored separately (`originClassification: 'citizen_entered_fact'`) and require admin moderation.
- Aadhaar, PAN, OTPs, passwords, biometrics, and beneficiary names are strictly rejected.

## Configuration, Deployment, Monitoring & Rollback
- **Configuration**: Requires `CLERK_SECRET_KEY` for admin camp publishing, observation moderation, and audit-log access.
- **Monitoring**: Track `401`/`403`/`429` responses on `/api/disaster-relief-board` and inspect `GET /api/disaster-relief-board/audit-log`.
- **Rollback**: Remove route registrations in `src/App.jsx` and `api/[...path].js` or `git revert` the feature commit.
