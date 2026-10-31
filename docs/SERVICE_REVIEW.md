# Two-person review of high-impact service changes

A mistaken edit to a fee, a document list, eligibility or an application link can mislead many citizens.
A draft preview ([SERVICE_DRAFTS.md](SERVICE_DRAFTS.md)) helps the editor check their own work; this adds an
independent second reviewer for the edits that matter most.

## Which changes need review

The list is explicit and lives in one file, `src/data/reviewPolicy.js`:

| Field | Why it is high impact |
|---|---|
| Eligibility | Decides who is told they may apply |
| Required documents | Citizens gather these before visiting an office |
| Fees | A wrong amount means a wasted trip or an overpayment |
| Official application links | Citizens follow this link to apply |

To add a field, add a line to `HIGH_IMPACT_FIELDS`. A **new guide** counts as high impact (it adds all of the above).
Edits that touch none of these (processing time, summary, difficulty, ...) go straight to publishing as before. Set
`REVIEW_ALL_CHANGES = true` to require review for every change.

## States

```
draft ──send──▶ pending ──approve──▶ approved ──publish──▶ published
                   │  └─return──▶ returned ──edit & send again──▶ pending
                   └─withdraw (sender only)──▶ draft
```

- **Sending** needs a draft with no validation problems and a short note saying where the changed facts come from
  (official notice, circular or page). The reviewer sees that note, the field-level before/after table, and the guide's official source links.
- **Deciding** needs the `services.review` permission, a named account, and a short reason (3 to 300 characters).
  The decision stores the reviewer, the time and the reason, and adds an audit-trail entry.
- **The sender cannot decide** on their own change (approve or return). Names are compared ignoring case and spaces.
- **Returning** changes nothing that citizens see: the published guide is only ever written by publishing.
- **Publishing** (`publishDraft`) refuses a high-impact change unless it is approved, whatever the screen shows.

## Stale drafts

An approval is about one exact draft against one exact published guide. It stops applying, and the draft goes back
to "not sent", when:

- the draft is edited after it was sent or approved (saving identical content keeps it), or
- the published guide changed after the change was sent. A reviewer cannot approve it ("ask the editor to send it again"),
  and an approval given before the change is reported as outdated and blocks publishing.

## What this does not guarantee

Drafts and decisions are stored in the browser's localStorage, like the rest of the catalogue. So "another admin" means another
signed-in account on the same browser profile, and anyone with developer tools can edit storage directly (see
[ACCESS_CONTROL.md](ACCESS_CONTROL.md)). The workflow is not faked in component state: the rules run in `serviceReview.js` and
`serviceDrafts.js`, and storage goes through an adapter.

For real cross-device approval, give drafts a shared store and enforce the same rules on the server:

```js
import { setDraftStore } from './services/serviceDrafts';

setDraftStore({
  read: () => /* array of drafts from the shared backend */,
  write: (drafts) => /* save them */,
});
```

Until then, treat the two-person rule as protection against mistakes, not against someone determined to bypass it.
