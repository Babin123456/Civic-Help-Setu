# Application Timeline Replay and Event Difference Viewer (#839)

## Overview

The Track page (`/track`) now shows an event replay below the milestone timeline. It reads append-only application event records, separates citizen notes from official-source events, compares two stored events field by field, and routes conflicting or low-confidence evidence to review.

The feature is local-first: the Track page reads and appends records in `civicbridge_application_events_v1` in browser storage, and the server contract is implemented in `api/_lib/applicationEvents.js` and `api/application-events.js`.

A static synthetic demo is available at [`docs/application-timeline-demo.html`](application-timeline-demo.html). It renders the replay with fictional reviewer data and can be opened directly in a browser without installing the app.

## Data model

Every record has:

| Field | Meaning |
| --- | --- |
| `eventId` | Stable identifier used in AI citations and the table view. |
| `applicationId` | Tracked civic application reference. |
| `category` | `submission`, `acknowledgement`, `review`, `query`, or `outcome`. |
| `sourceType` | `official_portal`, `official_office`, `system`, or `citizen_note`. |
| `sourceRef` | Human-readable source name. |
| `sourceUrl` | Optional safe http(s) link to the recorded source. |
| `sourceTimestamp` | Exact date/time supplied by the source. Never rewritten. |
| `ingestedAt` | Server or device time when the record was stored. |
| `status` | Recorded civic status, or `null` for a citizen note. |
| `statusTransition` | `{ from, to }` when the stored record provides it. |
| `actorRole` | Citizen, reviewer, system, or other recorded actor. |
| `payloadVersion` | Version of the stored payload shape. |
| `payload` | Small event payload; citizen notes keep `privateGuidance: true`. |
| `isOfficial` | Derived only from `sourceType`, never trusted from the client. |
| `isPrivateGuidance` | True for citizen notes. |
| `idempotencyKey` | Optional key for duplicate detection. |

Records are appended. `appendApplicationEvent` rejects an identical `eventId`, `idempotencyKey`, or content fingerprint instead of overwriting. Citizen notes can never be marked official: validation rejects `sourceType: 'citizen_note'` with `isOfficial: true`. Both client and server validation reject Aadhaar and PAN patterns in the payload and unsafe `sourceUrl` values.

Existing tracked applications are projected into events with deterministic legacy IDs. Re-running the projection is idempotent. If a milestone or note changes, a new event with a new signature is appended; previous events stay intact.

## UI and accessibility

- Chronological event cards show source badges, exact source and ingestion timestamps, status transitions, actor role, event ID, and payload version.
- Citizens can filter by category and source, select exactly two events for the stored-record diff, and report an inconsistency. Cancelling the report form keeps the selected events and typed reason so the citizen can resume later.
- A mobile stepper appears below 720px alongside the chronological list, so the event cards and the table alternative remain available at every width.
- Every card is readable without hover. All controls are native buttons, selects, checkboxes, and a labelled textarea with visible focus.
- The timeline includes a table alternative, print styles, `prefers-reduced-motion` handling, and semantic headings. The illustrative-data notice links to the tracked service's official source when the service catalogue or an event provides a safe URL.
- Timeline events and inconsistency reports are registered in the "Clear my data" storage registry and described in `docs/DATA_RETENTION.md`.
- Both stores are classified device-only in `src/services/cloudRecords.js`. Generic record sync must not overwrite the append-only log; cloud support needs a dedicated immutable event collection and a moderation review queue.
- Loading, empty, error, stale-data, permission-denied, filtered-empty, and review-required states are implemented.

## AI summary guardrail

`src/services/timelineSummaryService.js` is deterministic and summarises recorded events only:

- Label: `Suggestion — verify against official sources`.
- Citations include every cited `eventId` and the exact `sourceTimestamp`.
- The data version is shown in the summary and in the timeline footer, and each citation includes the event ID, exact source timestamp, source label, source reference, and a safe official-source link when one was recorded.
- It never infers or predicts an official outcome, approval, rejection, or deadline.
- Conflicting or unorderable evidence sets `requiresReview: true` and `confidence: 'low'` and is highlighted in the UI for human review.
- Citizen notes are counted separately and are never described as official status.

## API contract

`GET /api/application-events?applicationId=SRV-...&limit=25&cursor=0`

- Requires `Authorization: Bearer <Clerk session token>`.
- Returns `{ items, nextCursor, total, dataVersion }`.
- Returns `403` when a citizen requests another citizen's timeline. Admins may read it through the Clerk route; the handler also accepts reviewer and official roles when a session provider supplies them.
- Returns `200` with `items: []` when no events exist.

`POST /api/application-events`

```json
{
  "applicationId": "SRV-83900001",
  "category": "query",
  "sourceType": "citizen_note",
  "sourceRef": "Citizen note",
  "sourceTimestamp": "2026-10-06T08:20:00.000Z",
  "status": null,
  "actorRole": "citizen",
  "payloadVersion": 1,
  "payload": { "text": "Private reminder.", "privateGuidance": true }
}
```

- Returns `201` on append, `400` with `details` on malformed input, `401` for missing/invalid tokens, `403` for official-source writes by non-reviewers or cross-citizen writes, and `409` for duplicate events.
- `ingestedAt`, ownership, `actorRole`, and `isOfficial` are set server-side; client values are ignored. The first successful append to an application claims it for that citizen; later citizen writes and reads are checked against that owner. A production repository should also verify application ownership against the tracking backend before the first append.
- Official-source appends also write a payload-free audit entry (`OFFICIAL_APPLICATION_EVENT_APPENDED`) with the actor, role, application, event, source, and timestamp. Citizen notes do not write an admin audit entry. The reference repository keeps this audit in memory; production should use the durable admin audit trail.
- Payloads containing Aadhaar or PAN identifiers are rejected.
- Lists are paginated (maximum 50 per page) and include a deterministic data version.

## Environment variables

No new browser variables are required. The local Track page works with browser storage.

For the server endpoint:

| Variable | Scope | Purpose |
| --- | --- | --- |
| `CLERK_SECRET_KEY` | Server only | Verifies the bearer session token for `/api/application-events`. Never use a `VITE_` prefix. |

The endpoint returns `503 { "error": "not_configured" }` when `CLERK_SECRET_KEY` is absent. The in-memory repository is suitable for tests and reference deployments; production deployments should replace it with durable append-only storage while keeping the same handler contract.

## Data assumptions

- The Track page is the source of application records for legacy projection.
- Official source events come only from `official_portal` or `official_office`; application-record milestones are `system` and are labelled as unofficial.
- Timestamps that cannot be parsed (`Pending`, `Estimated Oct 22`, `Date pending`) sort last and trigger review.
- `sourceTimestamp` is preserved exactly as recorded; sorting uses a parsed copy.
- Synthetic reviewer data is in `src/test/fixtures/applicationTimelineFixture.js`. It contains no real citizen data.

## Manual verification

1. Run `npm install` and `npm run dev`.
2. Open `/track` and select a seeded application.
3. Confirm the replay appears under the milestone timeline with category counts, source badges, exact timestamps, and event IDs.
4. Select two events and choose **Compare events**. Confirm the diff shows only stored records and lists changed fields.
5. Add a citizen note on the Track page. Confirm the new event is marked private guidance and is not shown as official.
6. Use the category and source filters. Confirm the filtered-empty state is announced.
7. Add or modify a note and reload twice. Confirm events are not duplicated.
8. Open the browser devtools storage entry `civicbridge_application_events_v1` and confirm earlier records still exist.
9. Test at 320px, 375px, tablet, and desktop widths. Use only the keyboard to reach filters, event selection, comparison, report form, and the table alternative.
10. Use **Print view** and confirm controls are hidden and event cards remain readable.
11. Submit an inconsistency report and confirm a report is stored under `civicbridge_event_inconsistency_reports_v1` without changing any event.
12. With the server endpoint configured, verify `401` without a token, `403` for a citizen writing official events, `400` for malformed input, `409` for duplicates, and `200` with empty items for an unknown application.

## Tests

```bash
npx vitest run src/services/applicationEventService.test.js
npx vitest run src/services/timelineSummaryService.test.js
npx vitest run src/components/tracking/ApplicationTimelineReplay.test.jsx
npx vitest run tests/application-events.test.js
npx vitest run src/pages/Track.test.jsx
npx eslint src/services/applicationEventService.js src/services/timelineSummaryService.js src/components/tracking api/_lib/applicationEvents.js api/application-events.js tests/application-events.test.js
npm run build
```

Covered cases include out-of-order ingestion, duplicate event IDs and content, citizen-note source separation, pagination, malformed input, authorization, empty results, diff correctness, and summary citations.
