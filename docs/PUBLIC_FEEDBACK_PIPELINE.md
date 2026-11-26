# Public guide-feedback ingestion (#1267)

This extends the existing `BottleneckFeedbackPrompt`, admin feedback dashboard and
`bottleneckFeedback` collection. The owner assigned #1267 and approved Firestore.
Guide friction is the implementation boundary chosen here; legislative corrections,
fire/business feedback and official government grievances remain separate domains.
No scanner provider or production credentials are included in the repository.

## Request and persistence path

The browser acceptance run also exposed pre-existing startup defects in the shared
entry paths. This change uses the tenant module's existing fallback when its optional
jurisdiction resolver is not exported, moves `ImportConsole.displayName` below its
initialization, reads the existing import service's statistics instead of an undefined
`stats`, and imports the missing `Sparkles` icon needed by the default admin screen.
These small prerequisites make the existing route usable without a parallel screen
or a change to tenant authorization policy.

The existing API catchall registers `/api/bottleneck-feedback` behind its Origin,
CORS, CSRF, error-contract and mesh middleware. POST accepts the existing guide
fields, an `Idempotency-Key` (16–128 URL-safe characters), and optionally a base64
PNG/JPEG/PDF of at most 256 KiB. It validates lengths/types on the server and shares
the existing PII scrubber across notes, service names and step titles. Scrubbing is
best-effort pattern minimization, not a guarantee that arbitrary prose/files contain
no personal information. Filenames are not retained. The UI warns against personal
documents and retains form contents when a write cannot be confirmed.

A Firestore transaction reserves the receipt and increments a per-actor quota in
the existing `abuseControlQuotas` collection. Actor identifiers use the existing
abuse control plane's HMAC helper; raw IPs/user IDs are not stored in quota rows.
Verified Clerk users have independent buckets, including behind a shared NAT.
Anonymous callers share their network's bucket. Vercel supplies the trusted
forwarded address; another deployment must overwrite incoming forwarded headers.
Missing identity/configuration fails closed; there is no global fallback bucket.
Anonymous NAT peers can share a limit, and distributed attackers can rotate
identities: deploy ingress limits and monitor cost, not just application quotas.

Retries with the same actor/key and normalized payload recover the original receipt;
changed payload returns 409. Concurrent retries do not create duplicate reports or
consume extra quota. Different actors may intentionally submit identical reports;
content similarity alone must not suppress corroborating citizen feedback.
Requests beyond quota return 429/Retry-After. Storage/identity outages return a
generic 503, never a successful local-only receipt.

## Moderation and deadlines

Server-fetched Clerk admin metadata authorizes queue reads, audit reads, decisions
and clean attachment downloads. Browser demo roles never authorize the backend.
Firestore client rules deny all shared-feedback, audit and aggregate access,
including tokens claiming the UI admin role. Firebase Admin uses server IAM.

Reports retain the existing pending/reviewed/addressed/dismissed vocabulary, plus a
numeric revision. PATCH requires the displayed revision; a concurrent decision
returns 409. Each successful revision appends an audit event with the verified actor,
previous status/revision and server time. Scanner events are also appended. The
endpoint offers the newest 50 audit events; older events remain in Firestore.
The worker and API principals are trusted operators; this is not an externally
tamper-proof audit ledger against a compromised Admin service account.

The first-response SLA defaults to 24 hours (`dueAt`, server clock), configurable
with `FEEDBACK_SLA_HOURS`. Standard and suspected-spam queues are queried separately,
oldest first, with at most 50 rows/page and a stable time/document-ID cursor. Review
removes a report from the pending page. The dashboard labels overdue reports and
its page-limited counters; it does not misrepresent a page as the complete backlog.
The spam score combines repeated intake, redaction hits and excessive links. It is
an explainable routing signal, not a truth verdict; moderators can address reports
from either queue. Spam does not occupy the standard queue or a shared global quota.

## Attachment quarantine and trusted scanning

The quota/receipt reservation commits before any object upload. A private immutable
`feedback-quarantine/<receipt>/<sha256>` object is created with generation-match=0.
The record transitions `upload_pending` → `quarantined` after upload. A failed upload
leaves a recoverable reservation; retry the same payload/key. Orphaned objects may
exist after a crash and must be covered by the bucket's private lifecycle policy.
Client storage rules already deny this prefix. Never add public download tokens,
public ACLs or a public bucket policy to it.

Deploy a trusted scanner worker with access to this private prefix. It must fetch
the **specified immutable generation**, verify its SHA-256, scan the complete bytes
with the operator's configured malware engine, then pipe a verdict into:

```sh
node scripts/feedback-scan-result.mjs < scanner-verdict.json
```

The JSON fields are `id`, `sha256`, `generation`, `verdict` (`clean` or `rejected`)
and `scanner` (engine/version). The adapter verifies the stored digest/generation and
current state transactionally. It cannot prove that the trusted worker actually
ran a malware engine: that is an operator deployment obligation. Until a real worker
is configured, all uploads remain quarantined, never implicitly clean. Rejected
objects cannot be downloaded or changed to clean through this adapter. A trusted
rescan may revoke a clean verdict; already-issued signed URLs can remain valid for
their remaining 60-second lifetime, so delete the specific object generation for
immediate incident revocation. A verified
moderator may request a clean generation-bound URL valid for 60 seconds; it forces
download instead of inline rendering. Do not log that bearer URL. IAM signing
permissions are required; unavailable signing returns 503 without exposing bytes.

## Privacy-safe reporting

Only reports explicitly marked addressed contribute to public analytics. Each
creation-day/category/rating cell uses one of 32 deterministic aggregate shards,
updated in the same review transaction, including inverse updates when a decision
changes. Public reads cover the current UTC day and preceding six days (at most
224 shard documents); they never scan raw reports. Cells below five reports are
suppressed; eligible counts round down to multiples of five. Suppressed cells are
also excluded from totals, preventing a total-minus-categories small-cell reveal.
The public projection contains no free text, IDs, steps, attachments or moderator
identity. This is threshold aggregation, **not differential privacy**; repeated
observations may reveal threshold crossings. Do not use it to report sensitive
individual service cohorts. The dashboard says exactly what the metrics cover.

## Configuration, migration and rollback

1. Export/back up existing Firestore feedback before changing rules. Existing
   browser demonstration records remain device-only; they are not auto-uploaded.
2. Configure `FIREBASE_SERVICE_ACCOUNT`, `CLERK_SECRET_KEY`, an at-least-32-character
   `ABUSE_CONTROL_SECRET`, trusted API origins, and optionally
   `FEEDBACK_QUARANTINE_BUCKET`. Keep all of these server-only. Configure
   `FEEDBACK_PER_MINUTE` (default 20) and positive `FEEDBACK_SLA_HOURS` (default 24).
3. Deploy the compound queue/status/createdAt index and quota `expiresAt` TTL from
   `firebase/firestore.indexes.json`, then deploy the restrictive rules and API/UI
   together. Only use private quarantine bucket IAM and a lifecycle retention policy.
   Firestore TTL is asynchronous; expiry is not a security boundary.
4. The new schema is version 2. Historical Firestore rows used `message`/`new` and
   lacked revision, quota, attachment and aggregate metadata. Preserve that export
   for owner review; do **not** invent ratings or silently count those rows in the
   new metrics. They lack queue fields and are excluded from the new queue. Before
   production cutover, operators must explicitly triage/import them with validated
   guide IDs/categories/ratings, or retain them in the legacy administrative export.
   Existing local/demo API exports remain compatible. This release intentionally
   does not silently migrate unrelated correction collections or personal data.
5. Exercise synthetic intake, concurrent replay, moderation, blocked downloads and
   scanner callbacks in staging. In local development, unconfigured Clerk uses an
   explicitly labelled device-only demo. Set `VITE_SHARED_FEEDBACK=true` to exercise
   the shared API in development; production builds always use the shared API.
6. Roll back UI/API to the prior release and restore the exported rules only after
   stopping shared intake. Preserve version-2 reports/audits/objects for recovery;
   the old browser UI cannot safely interpret or moderate them. Never relax rules
   to expose the new records. Restore the new service before resuming their queue.

## Capacity, observability and recovery

Quota reservation: two reads plus report/quota writes on first intake; replay one
report read. Attachment retries may add object metadata and report reads. Review:
one report read plus up to one aggregate read, with report/audit/aggregate writes.
There is no single global counter; a very busy actor or aggregate shard can still
contend. Firestore retries transactions; exhausted retries return retryable 503.
The 32-shard choice is a starting bound, not a production throughput guarantee.

Monitor endpoint 201/409/429/503 counts and latency via platform HTTP telemetry.
Alert on 503 >1% for 5 minutes, pending oldest standard report exceeding the SLA,
any upload_pending reservation older than 15 minutes, and quarantined objects older
than the configured scanner SLA (suggested 15 minutes). These are operator alert
thresholds to configure, not claims of a shipped external alerting integration.
Page standard and spam backlogs separately; use Firestore aggregate queries for
operator backlog counts rather than treating the UI page count as global.

On Firestore outage, keep the form and key and retry after recovery. On upload
failure retry the same key/bytes; do not create a second receipt. On scanner outage
continue text moderation while attachments stay closed. On Clerk outage deny all
privileged access. After a review 409, refresh and inspect the audit before deciding
again. Set and document private report/object/legacy-export retention according to
the deployment's policy; no arbitrary production retention period is invented here.

## Validation

Use Node 22.19+ and the committed locks. Focused Vitest tests exercise validation,
permissions, CSRF, unavailable dependencies and real React form recovery. The
Firebase suite tests actual transactions, object uploads, rules, replay races,
review CAS, small-cell suppression, spam isolation and synthetic concurrent actors:

```sh
npm ci
npx vitest run tests/bottleneck-feedback.test.js src/services/bottleneckFeedbackService.test.js src/components/feedback/BottleneckFeedbackPipeline.test.jsx
npm --prefix firebase/emulator ci
npm --prefix firebase/emulator test
npm run lint
npm test
npm run build
```

The emulator is a local integration test, not a production Firebase/scanner/Clerk
attestation. A synthetic signer checks generation/expiry arguments; real IAM URL
signing and a real malware engine require staging verification by the operator.
