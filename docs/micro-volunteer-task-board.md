# Civic Micro-Volunteer Task Board (#759)

The Micro-Volunteer Task Board is a separately scoped module for small,
low-risk neighbourhood contributions. A ward operator publishes a task with a
plain-language instruction, evidence requirements and a safety note. A signed-in
citizen claims a place, submits completion evidence, and a human moderator
approves, rejects or requests changes with a reason. Moderators and
administrators can reopen an incomplete task. Every decision is appended to an
audit trail.

The board is **not** an official government service application and never
records a government decision. It is separate from the existing `/volunteer`
coordination screen.

- Routes: `/micro-volunteer-board`, `/micro-volunteer`,
  `/services/micro-volunteer-board`
- Navigation: **Micro-Volunteer Board**
- Page: `src/pages/MicroVolunteerTaskBoard.jsx`
- Contract and state machines: `src/data/microVolunteerContract.js`
- Service boundary: `src/services/microVolunteerService.js`
- Storage, migrations and retention: `src/services/microVolunteerMigrations.js`
- Access control: `src/services/microVolunteerAccessControl.js`
- Validation and error mapping: `src/services/microVolunteerValidation.js`
- Serverless boundary: `api/micro-volunteer.js` and
  `api/_lib/handlers/micro-volunteer.js`
- Server repository contract: `api/_lib/microVolunteerRepository.js`

## Why this shape

The implementation follows the repository's existing browser-first feature
pattern (streetlights, pedestrian barriers, GHG inventory). The browser board
persists one validated JSON bundle in `localStorage` and falls back to an
in-memory adapter when storage is unavailable. The serverless endpoint reuses
the same service functions with an injected repository, so a partner deployment
can place the same bundle behind a durable store without changing the domain
rules.

Validation, authorisation and state transitions live in the service layer, not
in React components. A caller cannot supply its own role, jurisdiction,
idempotency result or moderation outcome.

## Collections and entities

The bundle key is `civic_micro_volunteer_board_v1`. It contains the collections
below; every record carries `createdAt`, `updatedAt` where mutable,
`createdBy`/owner references, and `schemaVersion`.

| Collection | Entity | Purpose |
| --- | --- | --- |
| `tasks` (`micro_tasks`) | `MicroTask` | Public task, instructions, evidence requirements, capacity, status |
| `taskCategories` (`task_categories`) | category definitions | Deterministic matching vocabulary and default safety text |
| `claims` (`task_claims`) | `TaskClaim` | One citizen's claim on one place, with idempotency key |
| `submissions` (`completion_submissions`) | `CompletionSubmission` | Evidence note, public link, file **metadata only**, moderation outcome |
| `moderationEvents` (`moderation_events`) | `ModerationEvent` | Append-only audit of claims, submissions, decisions, retention runs |
| `recommendationRuns` | recommendation snapshot | Ruleset version, input window, reasons and human decisions |
| `meta` | migration/retention metadata | Schema version, history, warnings, last save time |

Foreign references are validated in the service: a claim must point at an
existing task, a submission at an existing claim and task, and a moderation
event at the records it describes. Multi-record changes (claim + task status,
submission + claim + task, moderation + audit) run inside one atomic
`runMicroVolunteerTransaction`.

Indexes are rebuilt after every write: task by id/public ref, status, category,
jurisdiction, jurisdiction+status, createdAt order; claims by task and citizen;
submissions by claim; moderation events by task.

## Domain states

Task (`TASK_TRANSITIONS`):

```
draft → open → assigned → awaiting_review → completed
                              ↘ reopened → open | assigned | awaiting_review | completed
any non-archived → archived (terminal)
```

Claim (`CLAIM_TRANSITIONS`): `active → submitted → approved | changes_requested | rejected`,
plus `withdrawn` and `expired`. A `changes_requested` or `reopened` claim may
submit again.

Completion (`COMPLETION_TRANSITIONS`): `submitted → under_review → approved |
changes_requested | rejected`, plus `reopened` and `withdrawn`.

Invalid transitions return `MICRO_VOLUNTEER_INVALID_TRANSITION` with an
actionable message; they never silently no-op. Archiving is preferred over
deleting so the audit trail stays complete.

## Roles and capabilities

The board defines its own least-privilege roles in
`microVolunteerAccessControl.js`; the repository-wide `accessControl.js` only
knows `admin`/`citizen`.

| Role | Capabilities |
| --- | --- |
| `public` | Read the public board, categories and aggregate summary |
| `citizen` | Claim a task, submit evidence, view own activity and suggestions |
| `operator` | Publish/edit/archive-owned tasks in assigned wards; no moderation |
| `reviewer` | Moderate completions and reopen tasks in assigned wards |
| `admin` | All board capabilities, retention, rollback and audit |

Rules:

- Deny by default. A signed-out caller is `public`; an unknown role is
  `citizen`.
- Operators and reviewers must have at least one jurisdiction assignment;
  only an admin may be unscoped.
- Every write is checked against the record's jurisdiction.
- Self-moderation is rejected: a moderator cannot decide a claim or task they
  created or claimed.
- Public projections never include account ids, internal record ids,
  idempotency keys, payload hashes, private moderation reasons or contact
  details.

## Deterministic matching

`buildTaskRecommendations` is a published, versioned ruleset
(`micro-volunteer-match-2026.1`). It scores only explicit inputs: category
match, same jurisdiction, time fit, due-soon, and open places. Every suggestion
includes the reasons and points that produced it, the ruleset version, the
input window and the execution timestamp.

There is no opaque volunteer score, no public ranking and no automatic
assignment. The contributor can accept, edit the category or reject every
suggestion, and each decision is recorded. Ties fall back to due date and then
public reference, so two runs with the same inputs produce the same order.

## Retention and deletion

Retention is applied by `applyMicroVolunteerRetentionPolicy` and recorded as a
`retention_applied` audit event:

| Record | Policy |
| --- | --- |
| Completed tasks | Archived after 180 days |
| Claims on retained tasks | Citizen id replaced with `archived.contributor`; free text redacted after 90 days |
| Withdrawn/expired claims | Removed after 30 days; the audit event remains |
| Completion submissions | Note and file metadata redacted after 90 days; approved public outcome note is kept |
| Moderation events | Retained 730 days, then removed |
| Recommendation runs | Last 50 per contributor, older snapshots dropped |

Uploaded file **contents** are never stored in the bundle. Only file name, MIME
type, size and an optional SHA-256 are kept, and these are validated against
the allowed list (JPEG, PNG, WebP, PDF) and size limit (5 MB, 3 files). Exact
home addresses, phone numbers, email addresses, Aadhaar/PAN numbers, OTPs and
coordinates are rejected by the validator.

## Migrations and rollback

- `createEmptyBoard` creates a valid, empty bundle for a new deployment.
- `createSeedBoard` creates the reviewed synthetic demo data used by tests and
  local development.
- `migrateMicroVolunteerData` upgrades a pre-#759 prototype shape
  (`micro_tasks`, `task_claims`, `completion_submissions`, `moderation_events`,
  `schemaVersion: 0`) without dropping records. Unknown statuses fall back to a
  safe value and a warning is recorded.
- A corrupt or unreadable bundle is replaced by the reviewed seed, with the
  recovery recorded in migration metadata.
- `rollbackMicroVolunteerStorage` restores the reviewed seed.
- `resetMicroVolunteerStorageToEmpty` atomically replaces the bundle with an
  empty board.

Rollback procedure:

1. Export or copy the current `civic_micro_volunteer_board_v1` value if it must
   be kept.
2. Choose **Board operations → Restore reviewed seed** or **Reset to an empty
   board**, or call the service functions directly.
3. Reload the board. Migration metadata shows the schema version and history.
4. If a server deployment is used, roll back the repository snapshot and the
   deployed handler together; the bundle is replaced atomically, never patched
   in place.

## Serverless API

`GET /api/micro-volunteer` (also `/api/micro-volunteer-board`) serves public
views: `board` (default), `task&ref=…`, `categories`, `summary`, and the
authenticated `my_activity`, `moderation_queue` and `audit`.

`POST /api/micro-volunteer` accepts one typed action per request:

| Action | Required capability |
| --- | --- |
| `create_task`, `update_task`, `publish_task` | `task.create` |
| `claim_task`, `withdraw_claim` | `task.claim` |
| `submit_completion` | `submission.create` |
| `moderate_submission`, `reopen_task` | `task.moderate` |
| `archive_task` | `task.archive` |
| `generate_recommendations`, `decide_recommendation` | recommendation capabilities |
| `run_retention` | `retention.run` |
| `audit_events` | `audit.read` |

The handler enforces a 64 KB body limit, a per-address fixed-window rate limit,
single-flight collapse for identical in-flight requests, verified-session
identity (Clerk when configured), stable error codes, and public projections
that omit internal identifiers. `Retry-After` is set on `429`.

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `CLERK_SECRET_KEY` | Server only | Verifies the bearer token and loads the caller's role/jurisdiction metadata. Without it the API returns `auth_not_configured`; the browser board still works locally. |
| `VITE_*` | No | Never used for board secrets. Frontend variables are public. |

A durable deployment supplies a repository with `getItem`, `setItem` and
`removeItem` (see `createMicroVolunteerStorageAdapter`). Wrap the read-modify-write
in a per-jurisdiction transaction so two simultaneous claims cannot both take
the last place. The default repository is in-memory and per function instance.

## Data sources and operational limits

- Seed data is synthetic and lives in `src/data/microVolunteerSeed.js`.
- Tasks are operator-authored; there is no external ingestion and no automated
  approval.
- Board actions are bounded: page size is capped, filters are trimmed, task
  capacity is capped, and task due dates must be within the next 180 days.
- The browser bundle is single-device. Two browsers do not share claims. The
  server API exists for shared deployments; do not enable both against the same
  data without a shared repository.
- Rate limits are per warm serverless instance, not global. They slow abuse but
  are not a substitute for a shared limiter.
- The manual fallback is the browser board: an operator can publish from the
  Browse tab, a reviewer can moderate from the Moderation queue, and an admin can
  export the bundle before any reset.

## Accessibility and UX

- Browse → task detail → claim → My activity → evidence → moderation outcome.
- Responsive grids for mobile, tablet and desktop; tables scroll inside a
  labelled wrapper.
- Real buttons and tabs with roving `tabIndex`, arrow/Home/End keyboard
  navigation, visible focus outlines, labelled form fields and semantic lists.
- Status is never colour-only: every badge carries text and an icon.
- Screen-reader announcements for action results; loading, empty, error,
  offline and stale states have plain-language text.
- Timestamps and source fields are shown on the detail view. Public pages show
  only approved outcomes and aggregate counts.

## Verification

```bash
npx vitest run src/data/microVolunteerContract.test.js
npx vitest run src/services/microVolunteerService.test.js
npx vitest run src/services/microVolunteerMigrations.test.js
npx vitest run src/pages/MicroVolunteerTaskBoard.test.jsx
npx vitest run tests/micro-volunteer-api.test.js
npm run lint
npm run lint:security
npm run build
```

The tests cover the task lifecycle, duplicate/over-capacity claim races,
idempotent retries and conflicts, request-changes/resubmission/rejection,
reopen, role and jurisdiction scoping, self-moderation, spam and rate limits,
withdrawal, drafts, archiving, deterministic suggestions, retention,
migration from an empty and a representative legacy bundle, public-projection
leakage, injection/enumeration attempts, component validation/state/error
rendering and accessibility semantics.
