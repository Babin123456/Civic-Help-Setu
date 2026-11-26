# Civic public-metadata contracts

`src/data/contracts/registry.json` is the versioned registry for service guides,
authority metadata, document-type metadata, deadlines and community facilities.
Each entry identifies its producer, responsible maintainer, semantic version,
field rules and typed references. Initial ownership is the repository maintainer
`GoldRay19`; changing ownership requires review and a versioned audit entry.
This is technical stewardship metadata, not a permission grant.

The service and facility adapters call the existing `validateServiceRecord` and
`validateCommunityFacilityRecord` functions. Facility provenance retains its
existing `auditMetadata` shape. New authority/document/deadline adapters validate
public metadata only. Document records describe a document *type*, not a citizen
file, identity number, scan or vault entry. Existing private vault storage and
read paths are untouched.

## Producer preflight

Install the locked dependencies, then run:

```sh
npm ci
npm run contracts:validate -- public-metadata.json
npm run contracts:check -- --base <full-base-commit-sha>
```

The first command loads the actual application adapters through Vite's module
loader without starting a listening server. It reports counts and field errors,
not raw records, and writes nothing. Exit status is 0 for valid input, 1 for
validation/quarantine, or 2 for an unreadable, oversized or malformed file. It
performs no network requests or production data writes.

The input envelope is:

```json
{
  "registryVersion": 1,
  "entities": [{
    "type": "authority",
    "version": "1.0.0",
    "record": {
      "id": "synthetic-authority",
      "name": "Synthetic authority",
      "lastVerified": "2026-01-01",
      "officialSources": [{"name": "Synthetic source", "url": "https://example.gov.in"}],
      "jurisdiction": {"level": "national", "states": [], "districts": [], "localBody": ""}
    }
  }]
}
```

All references resolve within the batch. A document requires `authorityId`; a
deadline requires `serviceId` and a real `dueDate`, with optional `documentId`;
a facility requires `authorityId` in addition to its existing facility contract.
Services may declare `authorityId`, `documentIds` and `deadlineIds`. Duplicate
IDs quarantine every duplicate rather than choosing one. Invalid/missing
references propagate quarantine to dependents; valid forward references and
cycles are permitted. Unrelated valid rows remain available to the caller.
Only a producer authorized for its existing write boundary may persist them.
There is no new generic server write endpoint or parallel database.

The pure `validateCivicDataset` function returns accepted entries, quarantined
row indices with field/code/message diagnostics, envelope errors and count
metrics. It has no shared mutable request state. Quarantine is an in-memory
preview, not a persistent store of rejected input. Codes include `INVALID_FIELD`,
`DOMAIN_CONTRACT`, `INVALID_REFERENCE`, `DUPLICATE_ID`, `UNSUPPORTED_CONTRACT`,
`UNSAFE_INPUT`, `BYTE_LIMIT`, `ROW_LIMIT` and `INVALID_ENVELOPE`. Never persist or
log a rejected source record to explain an error.

## Existing service import integration

CSV, JSON arrays and the existing `{ "services": [...] }` format retain their
current parsing and normalization. Opt into the strict registry with:

```json
{"contractVersion":"1.0.0","services":["full canonical service records go here"]}
```

The string above is explanatory: each array element must actually be a full
service object meeting the existing service contract. Unsupported versions do
not fall back to legacy validation. The existing review table shows rejected
rows and imports valid rows. Accepted services retain `dataContract` provenance;
`importAdminServices` checks it again immediately before writing. Changing a
previewed record cannot bypass that check. The existing `services.import`
permission remains first, and storage-write failures preserve the old catalogue.

This UI imports service guides only. Other typed entities use the producer
preflight; they are not silently saved by the service import UI. A service import
containing references to entities absent from that service-only batch is rejected.
For related multi-domain producers, validate one complete typed dataset before
using each domain's existing authorized write path.

Browser role checks protect the local workflow, not a shared backend. Existing
localStorage can still be edited with developer tools. A future shared-data
producer must enforce its own server-side authorization and transactions. Pure
validation is not an authorization token, atomic storage transaction, signature,
content truth check or general personal-data detector. It rejects known private
identifier keys and never returns rejected values in diagnostics; producers
must still accept only public civic metadata.

## Capacity, failure handling and monitoring

Limits: 1 MiB UTF-8 JSON, 500 total entities, depth 20, 100,000 inspected nodes,
50 diagnostics per rejected row, 2,000-character metadata text, 120-character IDs
and 20 official sources. Dates, numeric ranges, reference types and supported
versions fail closed. No network dependency or retry is needed for validation.
The bounded fixed-point reference check performs at most 500 passes; a 500-row
synthetic batch has a coarse two-second regression budget, not a production SLO.
Measure producer p95 latency with real workloads before increasing these limits.

Record accepted/quarantined counts and counts by fixed error code, without
source values, contact details or document contents. Start an operator review
when a producer's quarantine ratio exceeds 5% of a batch, any unexpected
`UNSUPPORTED_CONTRACT` occurs, or preflight exceeds two seconds for a maximum-size
batch. These are initial runbook thresholds, not an installed telemetry service.
Concurrent validation tests verify request isolation; they do not establish
cross-tab or database write serialization.

On failure, retain the previous published dataset, inspect the row number and
field/code, correct public source metadata, and rerun preflight. Retry a failed
storage write only after checking capacity; never clear the catalogue to make
room automatically. Keep a backup through the existing catalogue workflow.

## Compatibility, rollout and rollback

The PR quality workflow runs the registry check against the actual PR base SHA
(or previous push SHA), with complete history. An unavailable base fails rather
than pretending bootstrap succeeded. Registry bootstrap is allowed only when
that verified base has no registry. CI also runs normal lint, tests and build;
this feature does not waive those gates or make them required in branch settings.

Changed definitions require a higher semantic version and an owned change entry.
Removal, narrowing, validator replacement or a required new field needs a major
version and migration notes. Historical change records cannot be removed.
Optional additions can use a minor version. Reviewers must also version semantic
changes to delegated validators; the manifest comparison is not a semantic
analysis of arbitrary source edits. Update contract fixtures with every change.

Roll out by reviewing owners and field definitions, running preflight on a
synthetic batch, then opting individual producers into version 1. Existing
catalogues do not need an automatic rewrite. For a future major version, supply
and test an explicit conversion before enabling its producer. This release
accepts only the listed current versions, so do not switch a producer before
its records are migrated and validated.

Rollback a producer to its prior legacy input format and restore its previous
catalogue backup through existing controls. Revert code/registry changes together
if necessary; do not relabel invalid records as an older supported version.
Existing read paths ignore the additive `dataContract` tag and stay usable.

Tests: `civicDataQualityService.test.js`, `civicDataQualityImport.test.js`,
`compatibility.test.js`, `scripts/contracts/validate.test.js`, plus the existing
service import, permission and storage-failure suites. They cover all five
adapters, partial quarantine, invalid dependencies, migration gates, malformed
and oversized input, concurrent previews, permissions and retryable storage
failures using synthetic metadata and existing public seed adapter regressions.
