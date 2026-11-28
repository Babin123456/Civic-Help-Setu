# Senior-Citizen Public Service Proxy and Assistance Workflow (#1420)

## Architecture
- **Domain Service** (`src/services/seniorProxyAssistanceService.js`):
  - Extends `checklistStorage.js` (`readChecklist`, `writeChecklist`) and `trackingService.js` (`normalizeStatus`, `STATUS_META`).
  - Requires separate proxy credentials (`proxyActorId !== seniorOwnerId`), explicit owner approval (`approveProxyDelegation`), future permission expiry (`expiresAt`), and immediate revocation propagation (`revokeProxyDelegation`).
- **API Handler** (`api/_lib/handlers/senior-proxy-assistance.js` registered at `/api/senior-proxy-assistance`):
  - Enforces authentication (`401`), owner-only approval/revocation and granular permission checks (`403`), zero-PII validation (`400`), and rate limiting (`429`).
- **UI Workspace** (`src/pages/SeniorProxyAssistanceWorkspace.jsx`, routes `/senior-proxy` & `/proxy-assistance`):
  - Accessible, responsive UI with loading, empty, error, and offline states.

## Data Provenance & Privacy-by-Design
- Delegated edits, reminders, and tracking updates carry `provenance`: `citizen_entered`, `official_record`, or `ai_suggestion`.
- Official tracking rules include `source`, `jurisdiction`, `effectiveDate`, and `lastVerifiedAt`; missing metadata is marked `UNVERIFIED`.
- Aadhaar numbers, PAN, passwords, OTPs, and biometrics are rejected at both service and API boundaries.
- Non-PII `activityHistory` logs all approvals, denials, edits, reminders, tracking updates, and revocations.

## Configuration, Deployment, Monitoring & Rollback
- **Configuration**: Uses existing rate limiter (`abuseGuard.js`) and `localStorage` persistence (`civicbridge_senior_proxy_v1`).
- **Monitoring**: Monitor `401`/`403` denials (especially post-revocation and expired-grant attempts) and `400 pii_rejected` responses.
- **Rollback**: Remove `"senior-proxy-assistance"` from `api/[...path].js` and `/senior-proxy` routes from `src/App.jsx`, or revert the feature commit.
