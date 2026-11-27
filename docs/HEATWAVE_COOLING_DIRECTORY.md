# Heatwave Public Cooling-Centre and Water-Point Directory (#1436)

## Architecture
Extends the existing UP Heatwave Relief Coordination subsystem without creating parallel pipelines:
- **Contract & Freshness Engine**: `src/data/upHeatwaveReliefContract.js` — enforces verified municipal/disaster-management sources (`VERIFIED_DIRECTORY_SOURCES`, `isVerifiedMunicipalOrDisasterSource`) and automatic expiry of temporary facilities (`isTemporaryFacilityExpired`, `statusBadge: 'expired_temporary'`).
- **Directory Service**: `src/services/upHeatwaveReliefService.js` — filters out unverified sources and expired temporary facilities by default (`includeExpired: false`), keeps official records visibly distinct from citizen observations, and provides `registerVerifiedCoolingFacility`.
- **API Store & Handler**: `api/_lib/heatReliefDirectoryStore.js`, `api/_lib/handlers/heat-relief-observations.js`, and `api/[...path].js` (`/api/heat-relief-observations` & `/api/heatwave-cooling-directory`) with Clerk auth, `admin` role + jurisdiction checks, zero-PII enforcement, rate limiting, single-flight deduplication, and `Cache-Control: no-store`.
- **Accessible UI & Non-Map Fallback**: `src/pages/UpHeatwaveReliefMap.jsx` and `src/components/heatwaveRelief/HeatwaveFacilityList.jsx` at `/up-heatwave-relief`, `/heatwave-relief`, `/cooling-relief`, `/heatwave-cooling-directory`, and `/cooling-directory`.

## Data Provenance & Privacy
- Only facilities backed by verified municipal or disaster-management authorities (`responsibleAuthority`, `sourceUrl`, `verifiedAt`, `jurisdiction`, `effectiveDate`) are admitted.
- Citizen condition reports are stored separately with `originClassification: 'citizen_entered_fact'` and `pending_review` moderation status.
- Aadhaar, PAN, OTPs, passwords, biometrics, personal phone numbers, and residential door numbers are rejected via `inspectStringForPII` and strict payload validators.

## Configuration, Deployment, Monitoring & Rollback
- **Configuration**: Requires `CLERK_SECRET_KEY` for admin facility registration, condition-report moderation, and audit-log endpoints.
- **Monitoring**: Watch `401`/`403`/`429` rates on `/api/heatwave-cooling-directory` and review `GET /api/heatwave-cooling-directory/audit-log` (admin-only).
- **Rollback**: Revert the route registration in `src/App.jsx` and `api/[...path].js` or `git revert` the feature commit.
