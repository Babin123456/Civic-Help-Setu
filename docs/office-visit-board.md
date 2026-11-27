# Office visit board

`src/services/officeVisitBoardService.js` holds the logic for a visit board for local government
offices: hours, holidays, token instructions, counter details and a printable checklist.

## Live data vs verified data

- Static details (hours, counters, token steps) come from manually verified records. Each record has
  a `verifiedAt` date. After 180 days it shows as stale.
- Live queue numbers are shown only when an authority feed is attached and was updated in the last
  15 minutes. Otherwise `getQueueInfo` returns static guidance and the verification date, with no
  numbers at all.
- Waiting times are never estimated, and nothing implies a token has been reserved.

## Opening status

`getOpeningStatus` checks working days, opening hours, lunch closure and listed holidays. If an office
has no usable hours the answer is `unknown`, not `closed`.

## Checklist

`buildVisitChecklist(office, counterId)` returns plain text with hours, upcoming closures,
appointment requirement, the documents to bring for a counter, token steps, step-free access and
facilities. It works offline and prints cleanly.

The UI, storage and the moderation flow for correcting office details are not part of this change.
