# Implementation Summary: Issue #840 - Civic Public Notice Deadline Calendar

## Overview
Adds a civic public notice deadline calendar with action dependency lanes to the
service detail page. Citizens can review AI-suggested dates, confirm, edit or
dismiss each one, open the source for every milestone, and export only the dates
they confirmed. Official notice records are never modified.

Full design and reviewer guide: [`docs/notice-deadline-calendar.md`](docs/notice-deadline-calendar.md).

## Core Files

### 1. `src/services/dateCandidateService.js`
- Deterministic, timezone-safe date math (`addDaysToDate`, `toDateOnly`,
  `parseDateOnly`) with IST-aware expiry.
- Category rule sets (`getDateRulesForCategory`): publication, objection (+30),
  submission (+15), hearing (+45 for rule amendments/gazette orders), payment
  (+30 for fee revisions/deadline extensions), appeal (+60).
- Stable candidate ids (`deadline_<noticeId>_<actionType>`) and a source
  reference on every candidate.
- Per-citizen confirmation state stored separately from notices
  (`civicbridge_notice_deadline_state_v1`): confirm, edit, dismiss, reset.
- Explicit dependency graph (`calculateDateDependencies`) with no date-order
  guessing.
- iCalendar export of confirmed dates only, with escaping, `VALUE=DATE` events
  and source URLs.
- Validation for candidates and citizen edits.
- Low-confidence candidates (`< 0.60`) are flagged `requiresReview`.

### 2. `src/components/notices/DeadlineCalendar.jsx`
- Timeline view with four lanes: Response & Submission, Hearing, Payment, Appeal.
- Monthly calendar view with per-day deadline badges.
- Printable list/table with action, date, status, confidence, source and actions.
- Dependency view explaining prerequisite actions.
- Per-deadline Confirm, Edit (date + note), Dismiss and Reset.
- Source button opens the official URL or expands the source passage.
- Loading, empty, error and no-linked-notice states; expired dates kept and
  flagged; AI suggestions visibly separate from confirmed status.
- Accessible controls (`aria-pressed`, `aria-expanded`, `aria-label`, grid roles,
  table caption and column scopes).

### 3. `src/pages/ServiceDetails.jsx`
- Renders `DeadlineCalendar` with `serviceId`, so it resolves approved
  notices linked to that service and renders nothing when there is none.

## Acceptance Criteria

| Criteria | Status |
|----------|--------|
| No unconfirmed dates as deadlines | ✅ |
| Every milestone opens its source | ✅ |
| Relative-date calculations with verified boundaries | ✅ |
| Allow edits and deletion | ✅ |
| Keep expired notices historically accessible | ✅ |
| Unit tests for transformations and validation | ✅ |
| Component tests for interactions, responsive states, accessibility | ✅ |
| API/integration tests for authorization, malformed input, empty results | ✅ |
| Documentation and synthetic reviewer data | ✅ |

## Tests
- `src/services/dateCandidateService.test.js` — 38 tests.
- `src/services/dateCandidateIntegration.test.js` — 7 tests.
- `src/components/notices/DeadlineCalendar.test.jsx` — 12 tests.

## Design Conventions Followed
- Tailwind/CSS variables, glass-panel surfaces, existing button variants.
- Lucide-react icons with `aria-hidden` where decorative.
- Responsive inline styles matching the surrounding components.
- Deterministic data layers; no mutation of curated notice records.
