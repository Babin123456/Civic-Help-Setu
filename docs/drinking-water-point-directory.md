# Public drinking-water point directory

`src/services/drinkingWaterPointService.js` is the logic for a directory of public drinking-water
points (taps, handpumps, tanks, dispensers).

## Two separate statuses

- **Operational status** says whether the point is working. It comes from moderated reports from the
  last 48 hours. One report is shown as `unconfirmed`; two agreeing reports set `broken`,
  `no_supply` or `working`. No reports means `unknown`.
- **Quality status** says whether the water has been tested. It only appears when a test record has a
  date, a named testing authority and a pass or fail result. Tests older than 90 days show as
  `expired`. The test source is passed through so it can be displayed.

Quality is never inferred from reports, votes or appearance. A tap that many people say works still
has quality `unknown` until there is a test record. When quality is unknown or expired the result
carries a warning not to drink from the point without confirmation.

## Other helpers

- `searchWaterPoints` searches by name, locality or source type.
- `nearestWaterPoints` sorts by distance from a position and skips points with no coordinates.
- `describeWaterPoint` returns what a detail view needs, including accessibility and the maintenance
  contact.

The map, report form, correction route and storage are not part of this change.
