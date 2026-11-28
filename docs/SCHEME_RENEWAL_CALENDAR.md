# Government Scheme Renewal and Recertification Calendar (#1417)

## Architecture
- **Domain Service** (`src/services/schemeRenewalCalendarService.js`):
  - Extends `VALIDITY_TYPE` / `VALIDITY_STATUS` (`civicDocumentValidityCalendarService.js`) and RFC 5545 iCalendar helpers (`src/utils/icsText.js`).
  - Supports scheme-specific cycles, grace-period source links, configurable opt-in reminder preferences (`leadDays`), and `.ics` export.
- **API Handler** (`api/_lib/handlers/scheme-renewal-calendar.js` registered at `/api/scheme-renewal-calendar`):
  - Enforces authentication (`401`), owner isolation and admin/reviewer rule governance (`403`), zero-PII validation (`400`), and rate limiting (`429`).
- **UI Workspace** (`src/pages/SchemeRenewalCalendarWorkspace.jsx`, routes `/scheme-renewal-calendar` & `/renewal-calendar`):
  - Accessible UI with empty, error, and offline states plus `.ics` export preview.

## Data Provenance & Safety Guarantees
- Official scheme rules include `sourceUrl`, `jurisdiction`, `effectiveDate`, `lastVerifiedAt`, and `gracePeriodDays` (`provenance: 'official_record'`).
- Custom/unknown schemes are marked `UNVERIFIED` (`provenance: 'citizen_entered'`).
- `autoRenewalClaimed` is always `false`; the system never automatically claims a renewal has been completed on an official portal.
- Aadhaar numbers, PAN, OTPs, passwords, and biometrics are rejected at both service and API layers.

## Configuration, Deployment, Monitoring & Rollback
- **Configuration**: Uses `abuseGuard.js` rate limiting and `localStorage` (`civicbridge_scheme_renewal_calendar_v1`).
- **Monitoring**: Track `401`/`403` denials, `400 pii_rejected` responses, and `.ics` export counts.
- **Rollback**: Remove `"scheme-renewal-calendar"` from `api/[...path].js` and `/scheme-renewal-calendar` routes from `src/App.jsx`, or revert the feature commit.
