# Public notice deadline calendar

The deadline calendar turns a curated public notice into per-action deadline
candidates, lets a citizen confirm, edit or dismiss each one, and treats only
confirmed dates as deadlines.

It is rendered on the service detail page for every service that has an approved
public notice linked through `affectedServiceIds`.

## Why it works this way

- **Derived, never guessed into the official record.** Deadline candidates are
  calculated from the notice's `gazettePublicationDate` and a category rule set.
  The official notice record is never modified by the calendar.
- **Per-citizen decisions.** Confirmation, edits and dismissals are stored in the
  browser under `civicbridge_notice_deadline_state_v1`, keyed by a stable
  candidate id (`deadline_<noticeId>_<actionType>`). A citizen's decisions do not
  leak into shared notice data or another browser.
- **Unconfirmed is not a deadline.** Pending candidates are labelled `Suggested`.
  Only `confirmed` candidates are exported to iCalendar and counted as confirmed.
- **History is kept.** Dates in the past are flagged `Expired` but are never
  removed from the list or the calendar.
- **Low confidence is review, not fact.** Candidates below the review threshold
  (0.60) carry a `Needs review` badge and are visually separate from
  high-confidence official fields.

## Relative-date rules

All arithmetic is done on calendar dates in UTC, so
`2026-02-15T00:00:00.000Z` plus 30 days is always `2026-03-17` regardless of the
browser timezone. Expiry is evaluated against the IST calendar day.

| Action | Offset from publication | Confidence | Notes |
| --- | --- | --- | --- |
| Gazette publication | 0 days | 0.95 | Taken directly from `gazettePublicationDate` |
| Submission deadline | +15 days | 0.75 | Always derived |
| Objection deadline | +30 days | 0.70 | Always derived |
| Hearing date | +45 days | 0.60-0.65 | `rule_amendment`, `gazette_order` |
| Payment due | +30 days | 0.65–0.70 | `fee_revision`, `deadline_extension` |
| Appeal deadline | +60 days | 0.55 | Always derived; flagged `Needs review` |

Category-specific rules override a base rule for the same action type, so an
action type never appears twice.

## Confirmation lifecycle

```
pending (Suggested)
  ├── confirm  -> confirmed  (exported, counted)
  ├── edit     -> confirmed  (with override date and optional note)
  ├── dismiss  -> rejected   (kept, excluded from export)
  └── reset    -> pending    (drops the stored override)
```

`reset` removes the stored decision, so the candidate falls back to its derived
date. `reset` for a whole notice removes every stored decision for that notice.

## Service API

Implemented in `src/services/dateCandidateService.js`.

| Function | Purpose |
| --- | --- |
| `extractDateCandidates(notice)` | Deterministic candidates with stable ids, source references and confidence |
| `getNoticeDeadlines(notice, { storage, now })` | Candidates merged with the citizen's decisions and expiry flags |
| `getDeadlinesForNoticeId(id, options)` | Same, resolved from storage |
| `getDeadlinesForService(serviceId, options)` | Deadlines from approved notices linked to a service |
| `confirmDateCandidate(id, storage)` | Mark a candidate confirmed |
| `rejectDateCandidate(id, storage)` | Dismiss a candidate but keep it in history |
| `updateDateCandidate(id, changes, storage)` | Edit date/note; confirms by default |
| `resetDateCandidate(id, storage)` | Return one candidate to its derived value |
| `resetDateCandidates(noticeId, storage)` | Clear every decision for a notice |
| `calculateDateDependencies(candidates)` | Explicit dependency graph, no date-order guessing |
| `exportICal(noticeOrId, storage)` | iCalendar for confirmed deadlines only |
| `validateDateCandidate(candidate)` | Candidate shape validation |
| `validateDeadlineEdit(changes)` | Citizen edit validation |
| `getDateRulesForCategory(category)` | Rule set used for a notice category |

## UI

`src/components/notices/DeadlineCalendar.jsx`

- **Timeline** — four lanes: Response & Submission, Hearing, Payment, Appeal.
- **Monthly calendar** — month grids with per-day deadline badges.
- **List** — printable table with action, date, status, confidence, source and
  actions; all information is visible without hover.
- **Dependency view** — states which actions come after which prerequisites.
- **Per-deadline actions** — Confirm, Edit (date + note), Dismiss, Reset.
- **Source** — opens `sourceUrl` in a new tab, or expands the source passage.
- **Summary** — shows how many dates still need review and how many are
  confirmed.

### States

- loading (`aria-busy`)
- empty (notice without a usable publication date)
- error (`role="alert"`)
- stale data (notice reviewed over a year ago; prompts source verification)
- no linked notice (renders nothing, so unrelated services are not cluttered)
- expired history (badge, never deleted)
- dismissed and low-confidence review badges

## Accessibility

- Native buttons, inputs and select controls, all keyboard reachable.
- `aria-pressed` on view toggles, `aria-expanded` on source toggles.
- `aria-label` on every per-deadline action that names the action and date.
- Table has a `<caption>` and `scope="col"` headers.
- Month grids use `role="grid"`, `role="columnheader"` and `role="gridcell"` with
  an `aria-label` on each day.
- Icons are `aria-hidden`; status messages use `role="status"` or `role="alert"`.

## Synthetic reviewer data

Use this notice when reviewing locally or in a preview. It is deliberately not
part of the shipped default catalogue.

```json
{
  "id": "notice_review_840",
  "title": "Synthetic Gazette Notification for Deadline Review",
  "sourceUrl": "https://example.gov.in/synthetic-notice-840.pdf",
  "gazettePublicationDate": "2026-02-15T00:00:00.000Z",
  "reviewedAtDate": "2026-02-18T10:30:00.000Z",
  "reviewedBy": "Synthetic Review Cell",
  "affectedServiceIds": ["income-certificate"],
  "category": "rule_amendment",
  "summary": "Synthetic summary used only to review the deadline calendar.",
  "status": "approved"
}
```

Expected derived dates:

| Action | Expected date | Expected confidence | Review flag |
| --- | --- | --- | --- |
| Gazette publication | 2026-02-15 | 95% | Official field |
| Submission deadline | 2026-03-02 | 75% | — |
| Objection deadline | 2026-03-17 | 70% | — |
| Hearing date | 2026-04-01 | 65% | — |
| Appeal deadline | 2026-04-16 | 55% | Needs review |

Review steps:

1. Add this notice to local storage, open the `income-certificate` service
   detail page, and confirm the calendar appears below the availability notice.
2. If the page already has the shipped gazette notice, choose the synthetic
   notice in the "Choose a linked notice" selector.
3. Check the timeline lists the five dates above and that only the publication
   date is marked `Official field`.
4. Confirm the objection date; it should show `Confirmed by you`, the summary
   count should increment, and `Export iCal` should download a file containing
   only that confirmed date.
5. Edit the submission date and add a note; the new date and note should be shown
   and the export should now contain two events.
6. Dismiss the appeal date; it should stay visible as `Dismissed` and must not
   appear in the export.
7. Reset a confirmed date; it should return to `Suggested` with its derived date.
8. Reload the page and verify confirmed, edited and dismissed decisions persist.
9. Check the List and Monthly calendar tabs, keyboard navigation, and print
   preview.

## Tests

- `src/services/dateCandidateService.test.js` — date boundaries, leap years,
  timezone safety, rule sets, extraction, confirmation lifecycle, expiry,
  dependencies, validation and iCalendar escaping.
- `src/services/dateCandidateIntegration.test.js` — official notice records are
  not mutated, per-notice isolation, unapproved notices are ignored, malformed
  input and empty results.
- `src/components/notices/DeadlineCalendar.test.jsx` — timeline, list,
  monthly calendar, confirmed and expired rendering, empty/loading/error states,
  service resolution and notice selection.
