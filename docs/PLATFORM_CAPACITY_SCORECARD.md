# Platform capacity and architecture scorecard

This is the CI-only initial implementation approved in issue #1285. It reuses the
existing quality and Lighthouse workflows. It does not add browser telemetry, a
second citizen-readiness checklist, a database, or an endpoint accepting uploaded
score JSON. A scorecard is a GitHub job summary and a downloadable versioned
`civic-platform-scorecard` artifact containing `scorecard.md` and `scorecard.json`.

## What the score means

Seven equally weighted dimensions form an **evidence coverage score**. A dimension
earns a point only when verified evidence passes its stated budget. Failed,
invalid and unavailable dimensions earn no points. The denominator stays seven;
removing evidence cannot improve the score. This is not a production health or
compliance certification. With the initial collectors, at most three of seven
dimensions can pass (42.9%).

| Dimension | Initial authoritative evidence | Explicit boundary |
| --- | --- | --- |
| Throughput | Unavailable | No application load-test collector exists. Collector pressure tests do not measure application throughput. |
| Latency | Existing Lighthouse raw reports; median FCP per route, all four routes at or below 3000 ms | Local synthetic public-route preview, not production API latency or an SLO. |
| Availability | Unavailable | No deployed uptime collector or observation window exists. |
| Privacy | Unavailable | Passing general tests does not establish an independent privacy assessment. |
| Accessibility | Existing Lighthouse raw reports; median score per route at least 0.90 | Automated public-route checks; manual keyboard/screen-reader review remains necessary. |
| Cost | Unavailable | No deployed usage or billing collector; missing cost is not zero cost. |
| Operational readiness | Quality artifact, cross-checked against GitHub's native install/contract/lint/test/build step conclusions | The named quality gates only; not a claim that every operational or security control is certified. |

The Lighthouse budgets are the existing `.lighthouserc.json` FCP and accessibility
thresholds. Each of `/`, `/services`, `/assistant` and `/open-source` needs exactly
three valid samples. Missing scores or timings never default to zero. Unexpected
routes/origins, stale measurements and incomplete sample sets invalidate the
measurement. Existing Lighthouse assertions and quality commands are unchanged.

## Architecture and trust boundary

`scripts/platform-scorecard/policy.json` is maintainer-controlled configuration:
repository name **and numeric ID**, main branch, existing numeric workflow IDs,
artifact names, maximum age, measurement budgets and exact Git blob IDs for the
workflow, package/lock files and relevant producer/configuration files.

`createGitHubSource` is the evidence-source interface. It retrieves metadata only
from fixed `https://api.github.com/repos/<allowlisted-repository>/...` paths. The
collector requires an exact 40-character commit. It checks:

1. Workflow identity/path and configuration blobs at that exact commit.
2. Main-branch `push` or owner `workflow_dispatch`, same repository/head-repository
   IDs, exact SHA and latest run/attempt. PR/fork events cannot qualify. Pending
   newer attempts cannot silently fall back to old passing results.
3. Artifact name, run/repository/ref/SHA, creation/expiry and seven-day age bound.
4. SHA-256 of downloaded ZIP bytes against the digest returned by **GitHub**.
   Caller-supplied hashes or uploaded JSON never establish authenticity.
5. For quality reports, the versioned producer envelope and each outcome against
   native GitHub job-step conclusions. An artifact claiming a passing test cannot
   override GitHub's failing step.

The JSON/Markdown outputs preserve workflow/run/artifact IDs, repository/SHA,
collection and artifact timestamps, trusted digest, verified configuration blobs,
and explicit rejection/unavailability reasons. Do not accept a locally edited
output file as authoritative evidence; trace it back to the trusted workflow and
its source artifacts. GitHub and maintainers reviewing main/configuration are
trust roots; this is not a separate cryptographic attestation against a malicious
repository administrator or compromised GitHub service.

The publisher checks out the **trusted default-branch workflow SHA**, never a PR
head. It has only `contents: read` and `actions: read`; no deployment credentials,
PR writes, caches or untrusted artifact execution. Only this upstream repository
can publish the scheduled workflow. Tokens stay server-side; they are not emitted
in errors or passed to GitHub's short-lived artifact-storage redirect. No API key,
citizen record or existing diagnostics event is collected.

Archives are limited to 25 MiB compressed, 200 entries, 40 selected JSON reports,
2 MiB per report and 32 MiB total expanded JSON. System `unzip` streams selected
JSON into bounded buffers with five-second subprocess limits. No archive entries
are extracted to filesystem paths or executed. Unsafe/duplicate paths, corrupt
ZIPs and decompression limits fail closed. Ubuntu's standard `unzip` is required;
native archive tests also use `zip`. No new npm dependency is introduced.

API requests have ten-second deadlines, at most two transient retries and bounded
backoff (up to two seconds). Authorization, expiry, transport failures and absent
evidence are **unavailable**, never successful health. Malformed/tampered evidence
is **invalid**. Sources and archives are processed sequentially to bound memory.
Configured CI sources that have not run for a commit remain unknown.

## Operation, alerts and trends

After merging, main-branch quality and Lighthouse completion events run the
collector. GitHub does not necessarily create new producer runs for every commit
(for example, some repository automation merges do not emit another push run).
The live November 25 source audit found no producer runs for main `c29331b` and no
artifact on the most recent older Lighthouse run; that is an evidence gap, not a
passing platform measurement.

For bootstrap/recovery, a maintainer can dispatch the existing **Pull request
quality** and **Lighthouse CI & Accessibility Budgets** workflows on `main`. The
quality workflow now supports dispatch. Their completion triggers collection;
alternatively dispatch **Civic platform evidence scorecard** on main with an exact
commit. Dispatching the collector alone does not fabricate missing producer data.
Only completed main producer runs with the pinned configuration qualify.

Local collection (Node.js 22.19+ and system `unzip`):

```sh
# GITHUB_TOKEN must already be supplied through a protected environment/secret.
# Read-only Actions and contents access suffice; never use a VITE_ variable.
npm run scorecard -- --sha <exact-main-commit>
```

The collector never triggers workflows, uploads to GitHub, edits main, or changes
branch protection itself. A read-only API outage produces explicit unavailable
records. Invalid evidence and failed measured budgets produce structured `error`
alerts and CLI exit 2 **after** writing the report; the workflow still uploads the
report for diagnosis. A collection/setup failure exits 1. An exit of zero only
means collection completed without those alerts; inspect the unknown dimensions.
Canonical quality/Lighthouse gates continue to report their own failures.

Every JSON report includes actionable gaps. Restore access for
`github_authorization_required`, rerun a missing producer for `no_run_for_commit`,
and investigate tampering/configuration drift for digest/configuration errors.
Never fix a red evidence gate by changing a failing check to success.

Trends are recomputed from actual artifacts for up to five recent distinct main
commits in the latest 100 producer-run records. They are not loaded from a caller's
history file. The report artifact retains these observations for 90 days; raw
producer artifacts retain the existing 14-day policy and evidence older than seven
days is unavailable. Historical collection gaps remain visible. Concurrent
completion events are serialized per evaluated SHA and never race on a shared
mutable history store. A later valid collection can recover missing evidence.

## Configuration changes, migration and rollback

When a producer workflow, package/lock file, evidence producer or Lighthouse
configuration changes, review it and update its actual Git blob IDs in
`configurationBlobs` (for example, `git hash-object <path>`). Pin updates require
normal maintainer review; they must not be auto-approved from incoming reports.
IDs, thresholds and route counts are explicit operator configuration, not values
inferred from an uploaded measurement. A future trusted telemetry source can
implement `collect(producer, commit)` with its own verified provenance and mapping;
do not add an arbitrary-JSON upload as a telemetry source.

No citizen storage or database schema migrates. Version 1 quality envelopes are
checked explicitly. Existing quality scripts, tests, Lighthouse assertions,
diagnostics privacy rules and application behavior remain intact. Roll back by
disabling/reverting the scorecard workflow and removing the additive quality
artifact steps/CLI command; preserve artifact records for audit. Configuration
mismatches intentionally stop credit until reviewed pins are updated.

## Validation

Run the canonical contributing checks (`npm ci`, `npm run lint`, `npm test`,
`npm run build`) and security checks. Focused tests:

```sh
npm test -- --run scripts/platform-scorecard/scorecard.test.mjs
```

They cover provenance/SHA/configuration mismatch, tampered bytes, expired evidence,
native step-vs-self-report conflicts, unavailable dependencies, retry recovery,
fork/ref exclusion, pending reruns, authorization, bounded history, synthetic
concurrent collection, real ZIP reading/traversal/bomb limits and honest unknown
production dimensions. Synthetic fixture success is not evidence that deployed
telemetry or production capacity was measured. The first genuine upstream
producer/report run remains a post-merge operational acceptance step.
