# EV charging directory

`src/services/evChargingDirectoryService.js` is the logic for a public charging station directory.

- `filterStations` filters by connector type, minimum power, operator and locality.
- `describeAttribute` returns the value of an attribute (hours, payment, accessible parking) with its
  source and verification date, and marks it stale after 180 days. Missing values say "Not known".
- `getAvailability` returns counts only when an operator feed was updated in the last 10 minutes.
  Otherwise it says real-time availability is not known.
- `summariseObservations` counts approved community reports from the last 24 hours and labels them as
  not confirmed by the operator. Operator data and community reports are kept separate.
- `findDuplicateCandidates` pairs up stations that share a name and locality, or that are within 50 m
  of each other under the same operator, for a moderator to review.

The directory UI, storage and report-correction flow are not part of this change.
