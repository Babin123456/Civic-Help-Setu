# Civic event contract registry and operator runbook (#1263)

## Implemented boundary

The `events` section of `src/data/contracts/registry.json` is the shared,
repository-reviewed source of truth. `eventCompatibility.js` validates proposals;
`civicDomainEventBusService.js` applies the same contract at its actual
`stageOutboxEvent` entrypoint before any idempotency lookup or map write.
`registerEventConsumer` validates version pins against that registry. Dispatch
checks pins again, including when a consumer changed after staging.

This extends the existing bus and metadata compatibility CI entrypoint. It adds
no network registry, management endpoint, database or second publishing path.
The bus stores events, successful executions, dead letters and replay audit in
volatile JavaScript maps. It has no database transaction with domain mutations,
no production producer bootstrap, no cross-process reservation, and no durable
exactly-once guarantee. A process crash loses that state. Integrators must provide
those deployment boundaries separately before using it for statutory workflows.

## Releases, payloads and producer admission

All seven existing event types retain explicit `1.0.0` legacy releases, default
producer wildcard and their previous free-form JSON behavior. This compatibility
choice does not retroactively claim strict validation for historical payloads.
`APPLICATION_SUBMITTED@2.0.0` is an opt-in typed release requiring a nonempty
`serviceId` (maximum 100 JavaScript code units); other fields are permitted.
Only declared `CIVIC_CORE` and `APPLICATION_PORTAL` producer names admit that
release. No production caller is silently upgraded.

```js
stageOutboxEvent({
  eventType: CIVIC_EVENT_TYPE.APPLICATION_SUBMITTED,
  schemaVersion: '2.0.0', producerDomain: 'APPLICATION_PORTAL',
  aggregateId: 'synthetic-application', tenantId: 'synthetic-tenant',
  idempotencyKey: 'synthetic-request', payload: { serviceId: 'synthetic-service' },
});
```

The supported schema subset is explicit `type`, primitive `enum`, object
`properties`/`required`/boolean `additionalProperties`, array `items`, numeric
`minimum`/`maximum`, and string `minLength`/`maxLength`. Objects, arrays, strings,
finite numbers, safe integers, booleans and null are supported. Schema depth is
at most eight, each object schema at most 64 properties, and typed serialized
payloads at most 65,536 UTF-8 bytes. Unsupported keywords fail CI rather than
pretending to implement general JSON Schema. The legacy escape hatch is limited
to explicit untyped `1.0.0` releases. It retains the old unbounded payload behavior.
The bus sanitizes before validation, so producers cannot depend on redacted
values satisfying a contract.

Published release records are immutable, including owners/producers/samples.
Add a new semantic version and an owned change reason instead of editing them.
An optional field addition to an open object can use a minor release. Field
removal/type changes/new required fields/closed-object additions and changed
bounds or enum semantics are conservatively breaking: use a new major version
and nonempty migration instructions. Preserve all published schemas and change
history for queued events, audit and rollback. Samples are synthetic and each
shipped sample becomes a generated contract test.

## Consumer inventory and migration

`events.consumers` is the declared CI inventory; it starts empty because this
repository has no actual production registrations to invent. Each real consumer
must declare `id`, `owner`, active/retired status, event types and accepted version
arrays. Preserve retired entries rather than deleting history. Runtime
`getEventConsumerInventory()` returns copied metadata, accepted versions, owner,
tenant scope, enabled status and whether the registration is declared. It exposes
no handler functions or event payloads. Undeclared legacy registrations remain
possible for backward compatibility and are explicitly counted as undeclared;
they are not proof that CI has complete consumer coverage.

Registration defaults to `1.0.0` for each subscription. A declared consumer must
match its repository subscriptions and pins. Register consumers accepting both
old and new versions **before** the producer switches. At stage time every
matching enabled runtime consumer must accept the proposed version; otherwise
admission fails without creating an entry. Unknown versions/producers, invalid
payloads and conflicting idempotency reuse fail explicitly. Duplicate keys are
scoped by tenant and producer. A consumer pin regression after admission follows
the existing retry/dead-letter path instead of silently receiving an unsupported
version. Already successful handlers keep the existing execution-log behavior.
The dispatcher reserves the entire selected batch synchronously before the
first await, so two overlapping drains in one process cannot execute the same
queued event. This does not reserve work across processes.

For a deprecation, add an owned record with announcement, sunset and migration.
The current minimum notice is seven days; CI requires the full interval from
review time for a new notice, so backdating cannot skip it. Existing announcements
cannot be rewritten, sunsets cannot accelerate, and history cannot disappear.
CI rejects active declared consumers with no unexpired accepted version.
Sunset blocks **new admission** of the retired version; already staged records
can still drain/replay to a compatible consumer. Do not remove their schemas.

## CI and operator checks

Run with Node 22.23.5 and the committed lockfile:

```bash
npm ci
npm run contracts:check -- --base <actual-40-character-base-sha>
npm test -- --run src/data/contracts/eventCompatibility.test.js src/services/civicDomainEventBusService.test.js src/services/civicDomainEventContracts.test.js scripts/contracts/event-check.test.js
npm run lint
npm test
npm run build
npm run lint:security
node scripts/security/audit-report.mjs --omit-dev --level high
```

The existing PR quality job runs the contract command against its verified base
and uploads `.platform-evidence/event-contract-impact.json` alongside quality.json,
even after a validation failure. An unavailable base fails closed; it must not
be interpreted as a new registry bootstrap. The report names changed releases,
owners, declared affected consumers, their version acceptance and migration
instructions, and all contract validation errors. Malformed envelopes/rows still
produce an error artifact. Runtime-only consumers must be checked separately.
The reviewed scorecard workflow blob pin is updated to these exact workflow bytes;
the existing pin-integrity regression remains enabled. No CI permissions, gates
or dependency versions are relaxed.

The new tests run valid generated samples, negative minor/major proposals,
immutability/removal/notice cases, an actual CLI in isolated Git fixtures,
real bus admission/consumer migration, tenant-scoped duplicate retries,
64 concurrent same-key calls, overlapping dispatcher drains, retry/DLQ/replay,
and a 500-event synthetic burst. The burst is a regression case, not a production
capacity or latency benchmark. This change has no user-facing screen.

## Threat boundary, capacity and recovery

Repository review controls registry changes. Producer names, consumer owner
strings, tenant IDs and replay operator strings are **not authenticated identity**.
There is no new exposed registration endpoint. Keep the service behind existing
trusted application authorization; never expose it directly to untrusted input.
Existing top-level redaction is not recursive PII detection: only reference IDs
and synthetic samples belong in contracts/evidence. Do not log citizen payloads.

Typed payload validation is byte bounded; schema compilation is depth/field
bounded. Registration pins are bounded to 32 versions per event. The existing
maps, metadata, legacy payloads, queue and audit history remain process-memory
capacity risks, with no persistent retention or quotas supplied here. Inspect
outboxDepth/pendingCount/deadLetterCount, contractRejectedCount,
consumerContractFailureCount and undeclaredConsumersCount. Any new contract
rejection or consumer mismatch during rollout is a stop-and-investigate signal;
any dead letter needs operator triage. These are proposed operational triggers,
not an installed production alert exporter or measured SLO.

If registry CI fails, repair the proposal; never bypass the gate. If producer
admission fails, retain the original domain transaction failure semantics and
repair the payload/version or consumer pins; do not claim an event was staged.
If a handler is unavailable, inspect its error, fix it, and use the existing
bounded retries/dead-letter replay with an authorized caller and justification.
Do not reset the in-memory service as a recovery step: that discards pending work.

Roll out registry and accepting consumers first, inspect runtime inventory and
the impact artifact, then opt in the producer. For rollback, stop/revert the new
producer first; keep both schemas and both consumer pins while draining queued
new-version events. Revert consumers only after confirming those events drained.
Do not delete schema/change/deprecation history. Persisted migration and durable
replay safety require a future real transactional storage integration; this
prototype does not claim they have been deployed or verified against Firestore.
