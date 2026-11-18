# Civic service catalogue visual QA workspace

Reviewer workspace for issue **#841**. It renders the production `ServiceCard` against deterministic **synthetic**
catalogue fixtures at named desktop, tablet and mobile viewports. It is a private layout review tool, not an
official government application status.

- Page: `/services/catalogue-visual-qa` (also `/catalogue-visual-qa`, `/visual-qa`)
- Admin entry point: **Admin → Catalogue visual QA** in the header
- API: `GET`/`POST /api/catalogue-visual-qa`
- Code: `src/pages/CatalogueVisualQaWorkspace.jsx`, `src/services/catalogueVisualQaService.js`,
  `api/_lib/handlers/catalogue-visual-qa.js`

## What the workspace does

1. **Choose a category, language/script, content length, seed, page size and viewport set.**
2. **Render the real card** (`src/components/ServiceCard.jsx`) with `previewMode` at the named viewport width.
   Preview mode renders a non-navigating `<div role="group">` so a synthetic fixture never links to a fake
   service-details page. Production use is unchanged.
3. **Show deterministic bounding boxes and overflow markers** over the card. Markers are decorative. Every finding
   is repeated as text under the card, in the summary, and in the accessible results table.
4. **Summarise issues by code**, with counts, affected viewports, measured limits, remediation and a source path.
5. **Review synthetic long-title / multilingual suggestions.** AI is not called. The local generator labels text as a
   suggestion until the reviewer confirms or rejects it. Low-confidence suggestions are routed to review and are
   never applied automatically.
6. **Compare a saved screenshot baseline** with the current deterministic snapshot (added / removed / changed rows).
7. **Export a review snapshot** as a browser download, with a deterministic checksum, and optionally **verify the same
   scan on the server** (`/api/catalogue-visual-qa`).

### Private progress versus official status

The workspace stores only confirmed non-sensitive inputs:

- filters (category, language, content length, seed, page, page size, viewport ids),
- whether bounding boxes are shown,
- confirmed/rejected synthetic suggestion decisions,
- the last scan run id.

Drafts are saved under `civicbridge_catalogue_visual_qa_draft_v1` and screenshot baselines under
`civicbridge_catalogue_visual_qa_baseline_v1` in the reviewer's browser. Drafts expire after 7 days; baselines after
30 days. Both are browser-local, can be discarded from the page, and never contain reviewer notes or citizen data.
Exports contain no reviewer identity.

The page repeatedly states that review progress is private and **not** an official application, approval or
entitlement status. The official catalogue remains at `/services`.

## Setup

```bash
npm install
npm run dev
```

Then sign in with an admin account and open `/services/catalogue-visual-qa`, or use **Admin → Catalogue visual QA**.
No database migration or seed script is required: fixtures are generated in memory from schema metadata and
synthetic values. The local deterministic scan works without any API configuration; **Verify on server** additionally
needs the API route to be reachable.

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `CLERK_SECRET_KEY` | Server only | Verifies the Clerk bearer token and reads the reviewer's role from metadata. Never expose it to the browser. |
| `NODE_ENV` | Server | `production` disables the local header fallback. |
| `VERCEL_ENV` | Server | Also treated as production when set to `production`. |

No AI provider key is required because no AI provider is called. The workspace intentionally has no client-side
secret. When Clerk is not configured outside production, the endpoint accepts `x-user-role: admin` plus an optional
`x-user-id` for local development and automated tests; production returns `503 ERR_AUTH_NOT_CONFIGURED` instead.

## Data assumptions

- Every fixture is synthetic (`qa.isSynthetic: true`, `qa.isProductionRecord: false`) and carries a `qa-sample-` id.
- Names, departments, descriptions, fees, dates and processing times are fictional; links use reserved `example.org`
  domains and `verified: false`.
- The production catalogue is never imported, read, edited or published by this workspace.
- Viewport widths, card padding, grid columns and text-width factors are fixed constants, so the same seed and
  filters always produce the same measurements and `scanRunId`.
- Measurements are deterministic estimates, not browser pixels. A disputed finding should be confirmed in a real
  browser at the named viewport.
- Only confirmed non-sensitive inputs and decisions are stored, in the reviewer's browser, for at most 7 days
  (drafts) or 30 days (baselines).

## Named viewports and measurement

| Viewport | Width | Grid columns | Card width | Content width | Card padding |
|---|---:|---:|---:|---:|---:|
| Desktop | 1024 px | 3 | 304 px | 224 px | 40 px |
| Tablet | 768 px | 2 | 340 px | 260 px | 40 px |
| Mobile | 390 px | 1 | 350 px | 310 px | 20 px |

Measurements are computed, not sampled from the browser. A card width comes from the named viewport and the
production grid rules. Text width is estimated from per-script character factors:

| Script | Factor |
|---|---:|
| Latin | per character (upper/lower/digit/punctuation/space) |
| Devanagari | 0.61 |
| Bengali | 0.61 |
| Tamil | 0.62 |
| CJK | 0.92 |

The same seed, filters, component version and generator version always produce the same measurements and the same
`scanRunId`. That is what the visual-regression snapshot test compares. A real screenshot can confirm a warning, but
a scan never changes because a font had not loaded yet.

### Issue codes

| Code | Severity | Group |
|---|---|---|
| `TITLE_OVERFLOW` | warning | overflow |
| `UNBREAKABLE_TOKEN` | warning | overflow |
| `DEPARTMENT_TRUNCATED` | warning | overflow |
| `DESCRIPTION_CLAMPED` | info | overflow |
| `BADGE_WRAP` | warning | overflow |
| `DOCUMENT_COUNT_WRAP` | warning | overflow |
| `MIXED_SCRIPT_METADATA` | info | overflow |
| `MISSING_DEPARTMENT` | error | missing-metadata |
| `MISSING_PROCESSING_TIME` | error | missing-metadata |
| `MISSING_DIFFICULTY` | warning | missing-metadata |
| `MISSING_TYPE` | warning | missing-metadata |
| `MISSING_DESCRIPTION` | error | missing-metadata |
| `MISSING_NAME` | error | missing-metadata |
| `MISSING_CATEGORY` | error | missing-metadata |
| `LOW_CONFIDENCE_SUGGESTION` | review | review |

Every issue records the named viewport, field, measured value/limit, confidence, remediation and source path.

## Synthetic fixture rules

The generator lives in `src/services/catalogueVisualQaService.js`. It is shared by the browser and the server so a
local scan and a server verification use the same code.

- Fixture ids start with `qa-sample-`.
- Names, departments, descriptions, fees and processing times are fictional.
- Links use only reserved `example.org` addresses and `verified: false`.
- Every fixture carries `qa.isSynthetic: true` and `qa.isProductionRecord: false`.
- Deliberate metadata gaps are reproducible: every 9th fixture omits `department`, every 11th `processingTime`,
  every 13th `difficulty`, every 7th `type`, every 17th `name`, every 19th `shortDescription` and every 23rd
  `category`.
- Long content adds long titles, repeated description text and, every 7th fixture, an unbreakable identifier. Every
  5th long fixture also carries a deliberately verbose documents label so `DOCUMENT_COUNT_WRAP` is reproducible at a
  named viewport.
- Indic fixtures are available in Hindi (`hi`), Bengali (`bn`) and Tamil (`ta`).
- The generator never imports the production catalogue or the test fixture module into the app.

`containsCitizenData()` refuses Aadhaar-like numbers, PAN, mobile numbers, e-mail addresses and provider secret
patterns. Drafts, baselines and exports are checked with it. If a value matches, the write or export fails with a
structured error instead of storing the value.

## States

The page renders all of these:

- loading / permission check (`VisualQaLoadingState`),
- scanning skeleton (`VisualQaSkeleton`),
- empty page (`VisualQaEmptyState` with "Return to page 1"),
- recoverable scan or server error with structured fields (`VisualQaErrorState`),
- stale draft and stale baseline notices (`VisualQaStaleNotice`),
- offline notice while the local scan still works (`VisualQaOfflineNotice`),
- permission denied (`VisualQaPermissionDenied`),
- resumed private draft with discard control (`VisualQaResumedNotice`),
- server verification success or permission refusal (`VisualQaServerVerified`),
- server audit receipt after a confirmed/rejected suggestion.

## Accessibility

- The visual card grid has a full non-visual alternative: `VisualQaResultsTable` is always in the DOM, has a
  `<caption>`, column scopes, row scopes and a focusable scroll region.
- Essential information is never hover-only. Markers repeat their code as text, and each card lists its findings.
- Controls are native `select`, `input`, `fieldset`/`legend`, radio and checkbox elements with visible labels.
- Focus-visible outlines are defined for links, buttons, inputs, selects and the table region.
- Reduced-motion users get no shimmer, spin or transition animations.
- Colour is not the only signal: severity, issue code, measured text and remediation are written out.

## API

The endpoint is registered in `api/[...path].js` under `catalogue-visual-qa`. It validates independently of the
page and never trusts a client-side role.

### Authentication

- When `CLERK_SECRET_KEY` is configured, the handler verifies the Clerk bearer token and requires the `admin` role
  from Clerk metadata.
- In non-production/test environments without a Clerk secret, the handler accepts `x-user-role: admin` for local
  development and automated tests.
- Production without a configured secret returns `503 ERR_AUTH_NOT_CONFIGURED`.
- The API returns `401 ERR_AUTH_REQUIRED`, `401 ERR_INVALID_SESSION`, `403 ERR_UNAUTHORIZED` and rate-limits requests.

### Synthetic reviewer data

The workspace and API tests use fictional reviewer data only. Nothing here represents a real person or official
authority.

| Field | Development/test value |
|---|---|
| Reviewer role | `admin` |
| Reviewer id | `synthetic-reviewer` |
| Header fallback | `x-user-role: admin`, `x-user-id: synthetic-reviewer` |
| Production | Verified Clerk session with `admin` metadata; headers are ignored |

Audit receipts contain `actorRole` and a synthetic hash, never a reviewer name, e-mail, note or citizen identifier.

### `GET` scan

```http
GET /api/catalogue-visual-qa?category=Health&language=hi&contentLength=long&page=1&pageSize=6&view=mobile
Accept: application/json
Authorization: Bearer <clerk-session-token>
```

Response:

```json
{
  "data": {
    "schemaVersion": "civic-catalogue-visual-qa/v1",
    "scanRunId": "vqa-1a2b3c4d",
    "componentVersion": "catalogue-service-card@1.0.0",
    "fixtureGeneratorVersion": "synthetic-fixture-generator@1.0.0",
    "dataVersion": "service-schema-v1",
    "filters": { "page": 1, "pageSize": 6, "viewportIds": ["mobile"] },
    "pagination": { "page": 1, "pageSize": 6, "total": 24, "totalPages": 4, "empty": false },
    "viewports": [{ "id": "mobile", "cards": [] }],
    "issueSummary": [],
    "totals": {},
    "sources": [],
    "disclaimer": "…",
    "privateProgressNote": "…",
    "privacy": { "syntheticOnly": true, "containsCitizenData": false }
  },
  "meta": { "syntheticOnly": true, "containsCitizenData": false, "productionContentIncluded": false }
}
```

`GET ?action=metadata` returns the schema, component, data versions, categories, languages, content lengths,
viewports and page-size limits without scanning.

Unknown filters are rejected with `400 ERR_INVALID_QUERY` and a `fields` array. The client parser falls back to
defaults, but the server never silently accepts an unknown value.

### `POST` actions

Only `export-snapshot` and `confirm-suggestion` are accepted. Every request body is checked for production content
keys (`services`, `catalogue`, `records`, …) and citizen data before the action runs.

`export-snapshot`:

```json
{
  "action": "export-snapshot",
  "filters": { "category": "Health", "pageSize": 6, "viewport": "mobile" },
  "decisions": { "qa-sample-health-1-title": "confirmed" }
}
```

Returns `{ data: { snapshot, audit } }`. The audit receipt is a synthetic hash; the reviewer's identity and notes are
not stored or returned in the snapshot.

`confirm-suggestion`:

```json
{
  "action": "confirm-suggestion",
  "fixtureId": "qa-sample-health-1",
  "suggestionId": "qa-sample-health-1-title",
  "decision": "confirmed",
  "reviewerNote": "Synthetic layout check only."
}
```

Returns the decision, reviewer role, timestamp, `noteStored: false`, `fixtureOnly: true` and an audit receipt. The
note is sanitised and validated but is not persisted or included in exports.

### Error shape

```json
{
  "error": {
    "code": "ERR_INVALID_QUERY",
    "message": "The visual QA query is not valid.",
    "fields": [{ "field": "seed", "reason": "must be a whole number from 0 to 2147483647" }]
  }
}
```

No tokens, credentials, provider secrets or citizen data are logged or returned by this endpoint.

## Tests

```bash
npx vitest run tests/catalogue-visual-qa.test.js
npx vitest run tests/catalogue-visual-qa-api.test.js
npx vitest run src/pages/CatalogueVisualQaWorkspace.test.jsx
```

- `tests/catalogue-visual-qa.test.js` — fixture determinism, synthetic/PII boundaries, script measurement, issue
  detection, validation, query round-trip, pagination, snapshot export/parse/compare, draft/baseline persistence and
  the API client helpers. It includes a `toMatchSnapshot()` visual-regression projection at all three viewports and
  asserts that every documented issue code is reproducible at a named viewport.
- `tests/catalogue-visual-qa-api.test.js` — authentication, role refusal, paginated scans, metadata, empty pages,
  malformed query, method/body errors, production-content and PII refusal, snapshot export audit and suggestion
  decision validation.
- `src/pages/CatalogueVisualQaWorkspace.test.jsx` — SSR page tests for named viewports, long Indic content, overflow
  and missing-metadata warnings, the accessible table, suggestion labelling, pagination, empty state, permission
  denied, loading, offline, export/baseline controls and the official-status boundary.

The repository does not use jsdom or Playwright, so component tests use `react-dom/server`; interactive keyboard
behaviour is covered by native controls, semantics and the always-present table alternative.

## Manual verification and demo script

1. Sign in as an admin (or use the local demo admin when Clerk is not configured).
2. Open **Admin → Catalogue visual QA**.
3. Choose **Certificates**, **Hindi**, **Long (stress test)**, **Mobile** and run the local scan.
4. Inspect `TITLE_OVERFLOW`, `UNBREAKABLE_TOKEN`, `DOCUMENT_COUNT_WRAP` and `MIXED_SCRIPT_METADATA` markers, then
   confirm the same findings in the text list and the results table.
5. Open page 3 with a page size of 6 and confirm the deliberate `MISSING_NAME`, `MISSING_DESCRIPTION` and
   `MISSING_CATEGORY` findings.
6. Confirm one synthetic suggestion; rerun the scan and note that the confirmed text is measured.
7. Save the snapshot as a baseline, change a filter, then compare added/removed/changed rows.
8. Export the snapshot and inspect `privacy.officialStatus: "not-an-official-government-status"`.
9. Press **Verify on server** and check the audit receipt/verification notice.
10. Press **Cancel & return**, reopen the workspace through the Admin entry point and confirm the resume notice
    restores the confirmed filters and decisions. Delete the local draft and confirm the notice disappears.
11. Tab through the page and confirm the controls, pagination, table scroll region and buttons all show a visible
    focus ring, and that every finding is readable without hovering.

Automated equivalents:

```bash
npx vitest run tests/catalogue-visual-qa.test.js
npx vitest run tests/catalogue-visual-qa-api.test.js
npx vitest run src/pages/CatalogueVisualQaWorkspace.test.jsx src/components/visualQa/CatalogueCardPreview.test.jsx
```

## Limitations

- Measurements are deterministic estimates, not pixel screenshots. A reviewer should confirm a disputed finding in
  a real browser at the named viewport.
- The workspace does not edit or publish the production catalogue. Those changes belong in the normal admin review
  flow.
- Drafts and baselines are browser-local and not synced across devices.
- No AI provider is called. Suggestions are generated locally and remain advisory until confirmed.
