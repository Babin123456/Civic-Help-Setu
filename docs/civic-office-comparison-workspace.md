# Local civic office comparison workspace (#824)

Compare up to three civic offices for one service before travelling. The workspace answers a
different question from the nearby-office directory: **which office records a capability for this
service, in this jurisdiction, with evidence I can inspect** — not merely which office is closest.

- Citizen page: `/comparison`
- Office detail and outdated-record report: `/office/:officeId`
- Entry point: **Compare offices side by side** on `/nearby` (the selected service is carried over)
- Ranking endpoint: `GET /api/office-comparison`
- Report/review endpoint: `POST` / `PATCH /api/office-comparison`

The feature uses the existing service catalogue (`src/data/services.js`,
`src/services/serviceCatalog.js`), the office registry (`src/data/locationOffices.js`), the existing
theme tokens and design conventions, and the existing Clerk/role conventions for the administrator
actions. There is no new AI provider, database or browser credential.

## What the citizen can do

1. Choose a service, then optionally narrow by state, district, locality/city/pincode and contact
   channel. GPS is optional and only requested from an explicit button.
2. Read responsive office cards or a semantic comparison table. Each card shows recorded service
   capabilities, jurisdiction, official contact channels, contact verification, accessibility
   evidence and the last verification date.
3. Select two or three offices. The top two matching offices are preselected so the comparison is
   useful immediately.
4. Open a full office record to see every recorded capability, jurisdiction facts, contact channels,
   accessibility evidence, recorded hours, the service guide's document checklist, and source links.
5. Report an outdated record with a reason, an optional short note and an optional official HTTPS
   source. The comparison table's **Report outdated** action opens the same page and moves focus to the
   report form. **Cancel and return** goes back to the comparison with the service preserved. No
   account, phone number, identity number or document is requested.
6. Return, cancel or resume: filters (including contact channel, wheelchair-only and distance radius),
   selected office IDs and the view mode are kept in `sessionStorage` for the tab. **Clear saved
   comparison** removes that draft. The page states that the draft is local progress, not a government
   application status, receipt or approval.

## Data model and normalization rules

All rules live in the pure module `src/services/officeComparisonService.js`, shared by the browser
and the API handler.

| Field | Rule | Unknown handling |
| --- | --- | --- |
| Office ID / name | Trimmed strings; ID and name are required to show a record | Invalid records are skipped |
| Service capability | Only `office.serviceIds` creates a capability claim. A catalogue entry alone never upgrades the claim | No IDs or an unmatched ID shown as unknown / "catalogue link unknown" |
| Capability source | The office record's `auditMetadata.sourceUrl` when present and HTTPS. Otherwise the office portal is shown as **unverified context** | "not recorded" |
| Service jurisdiction | `service.jurisdiction` (`national`, `state`, `district`, local body) or a legacy string. Missing jurisdiction is **unknown**, never assumed nationwide | "Unknown" and review required |
| Office jurisdiction | Recorded district/state, or "Unknown" | "Unknown" |
| Contact channels | Helpline, phone, email and portal from the office record. Verified only when the office record has dated audit evidence | `Unknown`, "Contact verification unknown" |
| Accessibility | Eight boolean facilities; values are shown only when the office record has dated audit evidence | Every value is `Unknown`; never treated as available or unavailable |
| Coordinates | Valid lat/lng are kept for distance, but a pin requires an explicit `coordinateVerification` (or `coordinatesVerified: true`) **and** an HTTPS source | No pin; text list remains |
| Verification date | `auditMetadata.reviewDate` + `auditMetadata.sourceUrl`; older than 180 days is stale | "Verification not recorded" |
| Contact/accessibility evidence | Uses the same dated office audit; no inferred or scraped evidence | Unknown |

Other rules:

- Missing values are normalized to `Unknown` and rendered as text, not colour alone.
- Every capability/contact/accessibility/verification claim carries a source link or says the source
  is not recorded.
- No opening-hours claim is generated. Recorded hours are labelled as recorded, not live open status.
- A verification date in the future is not treated as evidence. The record stays `Unknown` /
  review-required and the audit source is shown as unverified context.
- Existing registry coordinates are intentionally **not** marked verified, so the map currently shows
  the no-verified-pins fallback and a complete text list.
- Office service IDs that are not in the built-in catalogue (for example `passport-renewal`) are still
  shown as a recorded claim with "catalogue link unknown"; they are not silently dropped.

## Deterministic ranking and explanations

Ranking is rule-based code, not model output:

1. Explicit service capability: 50%
2. Jurisdiction coverage: 30%
3. Evidence freshness: 20% (verified 1, stale 0.5, unknown 0.1)

Ties break by distance (only when GPS is active), then office name, then office ID. The same filters
and records always produce the same order. Match labels and explanatory text are deterministic
suggestions, and the UI labels them **"Suggestion, not an official decision."**

Match states:

| State | Meaning |
| --- | --- |
| `VERIFIED_MATCH` | Office lists the service, jurisdiction is covered, office record is verified and fresh |
| `STALE_MATCH` | Same capability/jurisdiction, but the office record is older than 180 days |
| `REVIEW_REQUIRED` | Capability is listed but jurisdiction or dated evidence is missing |
| `CAPABILITY_CONFLICT` | Office lists the service but the service guide's jurisdiction conflicts with the office region |
| `JURISDICTION_ONLY` | Region matches, but no explicit capability is recorded — the office may only assist |
| `NOT_MATCHED` | Neither capability nor jurisdiction is confirmed |
| `NEUTRAL` | No service selected |

The payload includes `dataVersion: "office-registry-2026-11-18.1"` and every card/table repeats it.
Low-confidence and conflicting evidence is sent to review rather than guessed.

## API contract

The route is registered in `api/[...path].js` and implemented by
`api/_lib/officeComparison.js` + `api/_lib/handlers/office-comparison.js`. The handler factory
accepts an injected clock and session verifier so tests do not need Clerk or a running server.

### Public ranking

`GET /api/office-comparison?serviceId=driving-license&state=Delhi&district=South%20Delhi&locality=...&channel=all&page=1&pageSize=6&onlyWheelchairAccessible=false`

| Parameter | Required | Validation |
| --- | --- | --- |
| `serviceId` | yes | Slug, 120 chars max, must exist in the built-in catalogue (`service` is accepted as an alias) |
| `state`, `district` | no | Single string, 80 chars max |
| `locality` | no | Single string, 120 chars max; matched against office name, address, city, district, state, pincode, landmark, category and type |
| `channel` | no | `all`, `in-person`, `online`, `phone` |
| `page` | no | Integer 1–100000 |
| `pageSize` | no | Integer 1–50 (default 6) |
| `onlyWheelchairAccessible` | no | `true` or `false`; only a **verified** wheelchair ramp qualifies |

Success (`200`):

```json
{
  "ok": true,
  "dataVersion": "office-registry-2026-11-18.1",
  "generatedAt": "2026-11-18T12:00:00.000Z",
  "service": { "id": "driving-license", "name": "Driving License", "jurisdiction": "National (all India)", "lastVerified": "2026-11-12", "catalogSource": {} },
  "page": 1,
  "pageSize": 6,
  "total": 15,
  "totalPages": 3,
  "aggregation": { "byState": {}, "capabilityMatches": 4, "verifiedRecords": 0, "reviewRequired": 15, "verifiedCoordinates": 0, "total": 15 },
  "results": []
}
```

`results` contains normalized records (office, capabilities with sources, contact, accessibility,
coordinates, verification, jurisdiction, match) but never the raw office row. The response is
`Cache-Control: no-store`.

Malformed input (`400`):

```json
{ "error": "validation_failed", "details": ["page must be an integer between 1 and 100000."] }
```

### Report an outdated record (public, rate-limited)

`POST /api/office-comparison`

```json
{
  "officeId": "delhi-rto-sarai-kale-khan",
  "reason": "outdated_contact",
  "note": "The listed helpline is no longer in service.",
  "sourceUrl": "https://transport.delhi.gov.in/office-directory"
}
```

Allowed reasons are exported as `REPORT_REASONS`. `sourceUrl` must be HTTPS. The note is limited to
500 characters. Aadhaar/PAN patterns, phone numbers, email addresses, passwords and OTPs are
rejected before the report enters the queue. Success is `201` with `reportId`,
`verificationSeal`, `status: "pending_review"` and `submittedAt`. Errors: `400` validation,
`404` unknown office, `429` rate limited (with `Retry-After`).

If the endpoint is unreachable, the client keeps the same non-sensitive report in
`civicbridge_office_comparison_reports_v1` and tells the citizen it was saved on this device.

### Administrator review (Clerk bearer session, admin role)

- `GET /api/office-comparison?review=pending`
- `PATCH /api/office-comparison` with `{ "reportId": "...", "status": "resolved" | "rejected", "reviewNote": "..." }`

Both require `Authorization: Bearer <Clerk session token>` whose user has
`publicMetadata.role === "admin"` (resolved through `src/services/roleService.js`). Responses:
`401 missing_token` / `invalid_token`, `403 admin_role_required`, `503 auth_not_configured`.
Resolutions append `{ action: "office_report_reviewed", reportId, officeId, actorId, status,
reviewedAt, dataVersion }` to `OFFICE_REVIEW_AUDIT` and return the reviewed status. The queue and
audit trail are in-memory reference storage for this repository; production deployment should move
them to a shared, access-controlled store.

## Validation, pagination and aggregation

- Client: the report form validates the same schema before sending and renders structured field
  errors. URL parameters are parsed into the session draft; unknown services and unusable values fall
  back to a safe UI state instead of crashing.
- Server: `validateComparisonQuery` and `validateOfficeReport` run before ranking or queueing.
- Pagination is applied after deterministic ranking. `allResults` is kept only in the browser for
  selection; the API returns just the requested page.
- Aggregation exposes capability matches, verified records, review-required records, verified
  coordinates and per-state counts.

## Security, privacy and accessibility

- Only the service/locality/contact/accessibility filters and selected office IDs go into the session
  draft (`sessionStorage`, cleared on tab close and by **Clear my data**). No names, GPS coordinates,
  phone numbers, identity numbers or free text are stored there.
- Reports contain only office ID, reason, optional note and optional official source. A blocked local
  quota does not pretend the report was sent.
- No new client secret is introduced. `CLERK_SECRET_KEY` is read only in the server handler and never
  prefixed with `VITE_`. The ranking endpoint serves public registry data only.
- Administrator actions use the existing role source of truth and write an audit entry.
- The new storage keys are registered in `src/services/privacyConsentService.js` and documented in
  `docs/DATA_RETENTION.md`, so **Clear my data** and the key-coverage test include them.
- The comparison uses a semantic `<table>` with `<caption>` and `<th scope>`, visible focus outlines,
  native form controls, `aria-live` state panels, an explicit text alternative for the map, no
  hover-only information, and a `prefers-reduced-motion` block. The layout uses fluid
  `minmax(min(100%, …), 1fr)` grids and a keyboard-focusable horizontal table scroller.

## Data assumptions and limitations

- `CIVIC_OFFICES` currently has 15 records. Most records have no `auditMetadata`, so they correctly
  show unknown/stale verification. Only three have a review date and source URL.
- No existing office record declares a verified coordinate source, so **no pins render today**. The
  map fallback and text list are the intended behaviour until explicit coordinate verification is
  added. Distance is a straight-line estimate from GPS, not proof that an office exists.
- Some office `serviceIds` (for example `passport-renewal`) are not in the built-in service
  catalogue; the UI labels them "catalogue link unknown" rather than inventing a guide.
- The registry is local demo/reference data, not a live government directory. Recorded hours are not
  a live open/closed status. Always confirm with the official authority before travelling.
- The report queue and audit trail are in-memory in the serverless reference implementation. A
  production deployment needs durable, access-controlled storage and a retention policy.
- The component tests use `react-dom/server` static markup because this repository does not install
  jsdom/testing-library. Interactive behaviour is covered by the pure services, API tests and
  structural markup/CSS contracts.

## Setup and checks

```bash
npm install
npm run dev          # open /comparison or /nearby
npm test             # Vitest unit, component, page and API tests
npx vite build       # production bundle
npx eslint <changed files>
```

Environment variables:

| Name | Where | Purpose |
| --- | --- | --- |
| `CLERK_SECRET_KEY` | Server only (`api/_lib/handlers/office-comparison.js`) | Verifies administrator bearer sessions and reads the Clerk public role from the server |
| No new `VITE_*` variable | — | Nothing in the comparison UI needs a provider credential or server secret |

If `CLERK_SECRET_KEY` is absent, public ranking and report intake still work; administrator review
returns `503 auth_not_configured` instead of inventing an identity.

## Manual verification

1. Open `/nearby`, choose a service, press **Compare offices side by side**. Confirm the service is
   carried into `/comparison?service=…`.
2. Confirm the top two offices are selected, the summary counts are visible, and the comparison table
   has a caption, row headers and column headers. Select a third office; a fourth attempt should be
   refused with a toast.
3. Read a card without hovering: service chips, jurisdiction badge, contact verification,
   accessibility values, last verification and source links must all be visible.
4. Open **View full record**. Confirm recorded hours are labelled as recorded (no "open now"), the
   document checklist is attributed to the service guide, and every source link opens in a new tab.
5. Open **Report outdated** from the comparison table. Confirm the page moves focus to the report form,
   and that **Cancel and return** goes back to the comparison with the service preserved. Submit a
   report with a reason only; then try a note containing an Aadhaar-like number, phone number, email or
   OTP. The second attempt must show field errors and send nothing.
6. Reload the tab. Filters and selected offices should resume. Press **Clear saved comparison**;
   reload and confirm the draft is gone.
7. Block location for the site, reload `/comparison`, and confirm the permission-denied panel still
   offers manual state/district/locality filters.
8. Choose **Map**. With the current registry, confirm the no-verified-pins fallback and the text list
   of every result. Add a synthetic record with `coordinateVerification.verified === true` and an
   HTTPS source (see the sample JSON) before expecting a pin.
9. At 320–640 px width, confirm the filter grid and cards stack, the table scrolls horizontally with
   its hint, buttons remain reachable, and no page-level horizontal overflow appears.
10. Use only the keyboard: Tab to the skip link, service select, filters, compare checkboxes, card
    links, table scroller and pagination. Focus must be visible. Enable **Reduce motion** in the OS
    and confirm the spinner/scroll animation stops.
11. Run `npm test`, `npx vite build`, and ESLint on the changed files.

## Synthetic sample data and demo

`docs/examples/office-comparison-sample.json` contains three made-up office records and a made-up
service query. It is for reviewers and fixtures only and is **not** loaded by the app as real data.
It shows a fully verified match, a stale match, and an office with unknown contact/accessibility.
The sample includes `expectedRanking` and `expectedUnknownFields` so a reviewer can check the
deterministic rules by inspection.

### Captured screenshots

The demo images are checked in under `docs/screenshots/issue-824/`. They were captured on 18 November 2026
from the local registry with headless Chrome: desktop at 1440 px wide and mobile at a true 390 px device
viewport. The comparison is deterministic, so the counts, data version and match labels should match this
document. Replace them only when the registry or the workspace layout changes.

| File | View |
| --- | --- |
| [`comparison-desktop.png`](screenshots/issue-824/comparison-desktop.png) | Cards, filters, stale-data notice and selected comparison |
| [`comparison-table.png`](screenshots/issue-824/comparison-table.png) | Semantic comparison table with caption and headers |
| [`comparison-map-fallback.png`](screenshots/issue-824/comparison-map-fallback.png) | No-verified-pins fallback and complete text list |
| [`office-detail.png`](screenshots/issue-824/office-detail.png) | Full office record, recorded-hours caution and report form |
| [`comparison-mobile.png`](screenshots/issue-824/comparison-mobile.png) | 390 px layout: stacked filters and cards, no page-level overflow |

To recapture them manually:

1. Open `/comparison?service=driving-license` at 1440 px and capture the filter panel, summary strip,
   cards and selected comparison table.
2. Open `/comparison?service=driving-license&view=table` and capture the semantic table.
3. Open `/comparison?service=driving-license&view=map` and capture the no-verified-pins fallback plus
   text list.
4. Open `/office/delhi-rto-sarai-kale-khan?service=driving-license` and capture the detail record,
   recorded hours caution and report form.
5. Repeat step 1 at a true 390 px viewport for the mobile layout. At 390 px the document's
   `scrollWidth` must equal its `clientWidth`; only the table's own container may scroll horizontally.

These images are the demo artifact for issue #824. A short recording of the same flow is an acceptable
substitute when the UI changes substantially.

