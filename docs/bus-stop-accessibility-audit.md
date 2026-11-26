# Bus stop accessibility audit

`src/services/busStopAccessibilityService.js` scores the physical side of a bus stop: shelter,
seating, lighting, kerb access, tactile paving and signage. Routes and timetables are not part of it.

## How evidence is counted

- Official inventory records count on their own.
- Citizen observations count only after moderation, and only when at least two agree.
- Anything older than 180 days is ignored, and the stop shows up in `findStaleStops`.
- If official and citizen evidence disagree, the attribute is marked `conflict` and goes into the
  report as needing a site check.

## Status

A stop is `verified_accessible` only when kerb access, tactile paving, lighting and signage are all
verified present. A verified missing attribute gives `not_accessible`. Everything else is
`insufficient_evidence`, so a stop is never shown as accessible on thin data.

## Output

- `buildImprovementReport(stop)` gives plain text for a transport or local authority.
- `searchStopsAsText(stops, query)` gives one line per stop for screen readers and low-end devices.

The map view, moderation queue UI and storage are not included yet.
