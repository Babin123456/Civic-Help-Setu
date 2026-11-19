# Municipal Tree Health Inventory and Preventive Maintenance Planner (#749)

## 1. What this module does

The tree inventory is a separately scoped civic workflow for a municipality to:

- register public trees with species, planting site, planting date, condition and a coarse public location;
- schedule, complete and verify preventive inspections;
- raise, assign, update and close evidence-backed maintenance orders;
- keep a pruning history and planting-site register;
- accept citizen observations of visible damage, triage them and link accepted reports to inspections;
- import a validated CSV register and audit every privileged change.

It is **not** a visual-only module. All reads and writes go through a service layer with persistent storage, explicit state machines and an append-only audit trail.

Routes:

| Route | Purpose |
| --- | --- |
| `/tree-health` | Primary page (registered in `src/App.jsx`) |
| `/tree-inventory` | Alias for the same page |

Navigation: the Navbar entry is "Tree Health Inventory" (`src/components/Navbar.jsx`).

## 2. Architecture

```text
src/pages/TreeHealthInventory.jsx        page orchestration, tabs, form state
src/components/trees/*.jsx               presentation, accessible controls, no business rules
src/services/treeInventoryService.js     trusted boundary: authorisation, validation, state machines,
                                         transactions, audit, public projections
src/services/treeInventoryConstants.js   enums, labels, limits, capabilities, transitions, error codes
src/services/treeInventoryValidation.js  storage helpers, transaction/rollback, sanitisation, coordinates,
                                         attachments, pagination, error type
src/services/treeInventoryMigrations.js  bootstrap, schema migration, rollback, index manifest
src/services/treeAccessControl.js        tree-domain role and jurisdiction resolution
src/services/treeImageTriageService.js   deterministic triage rules and expert review
src/data/treeInventoryData.js            demonstration species, wards, planting sites and seed records
```

The React layer never decides whether an action is allowed and never writes storage directly. Buttons are hidden or disabled for usability only; the service re-checks every capability and jurisdiction.

### Persistence model

The app is client-side and offline-first, so each normalised collection is a JSON array in `localStorage` behind the service boundary. Multi-key writes use a read/modify/validate/commit transaction that restores the previous values if any step fails.

| Collection | Storage key | Core entity |
| --- | --- | --- |
| Public trees | `civicbridge_tree_assets_v1` | `TreeAsset` |
| Species catalogue | `civicbridge_tree_species_v1` | `tree_species` |
| Inspections | `civicbridge_tree_inspections_v1` | `TreeInspection` |
| Maintenance orders | `civicbridge_tree_maintenance_orders_v1` | `MaintenanceOrder` |
| Pruning events | `civicbridge_tree_pruning_events_v1` | pruning history |
| Planting sites | `civicbridge_tree_planting_sites_v1` | `PlantingSite` |
| Report attachments | `civicbridge_tree_report_attachments_v1` | validated image metadata/content |
| Citizen reports | `civicbridge_tree_citizen_reports_v1` | `CitizenReport` |
| Triage suggestions | `civicbridge_tree_triage_suggestions_v1` | bounded model output |
| Audit events | `civicbridge_tree_audit_events_v1` | hash-chained append-only log |
| Idempotency / rate limit | `..._idempotency_v1`, `..._rate_limit_v1` | replay and abuse controls |
| Schema metadata / backup | `..._meta_v1`, `..._migration_backup_v1` | version stamp and rollback snapshot |

Every operational record carries `id`, `publicId` where relevant, `createdAt`, `updatedAt`, `createdBy` and `schemaVersion`. Relationships are validated foreign keys inside the service: a tree references a known `speciesId` and optional `plantingSiteId`; an inspection or work order must reference an existing tree; a pruning event is created only from a verified pruning order. There are no dangling references after a migration.

### Query indexes

`TREE_INVENTORY_INDEX_MANIFEST` in `treeInventoryMigrations.js` documents the filters that must stay bounded:

- jurisdiction;
- jurisdiction + ward + species;
- status + condition;
- `inspectionDueAt` (overdue/upcoming reminders);
- `createdAt`;
- bounded search over public ID, ward, locality and species name (never private notes);
- work-order state / assignee / due date;
- citizen-report state + jurisdiction + created date.

List endpoints accept `page` and `pageSize`; page size is capped by `TREE_API_LIMITS.maxTreesPerPage`. Search strings, notes and CSV cells have explicit length limits.

## 3. Roles and jurisdiction scope

Site-wide roles remain `admin` and `citizen`. The tree domain narrows an administrator through trusted public metadata:

```js
{ role: 'admin', raw: { publicMetadata: { treeRole: 'arborist', jurisdictionId: 'blr' } } }
```

A citizen can never obtain staff access by passing a role in a request; only the signed-in actor registered by `AuthProvider` is read.

| Capability | Operator | Arborist | Reviewer | Admin |
| --- | :---: | :---: | :---: | :---: |
| Public register | yes | yes | yes | yes |
| Staff register / private coordinates | yes | yes | yes | yes |
| Register or correct a tree | — | yes | — | yes |
| Propose risk | — | yes | — | yes |
| Confirm / reject risk | — | — | yes | yes |
| Lifecycle transition | — | yes | — | yes |
| Schedule / complete inspection | yes | yes | — | yes |
| Verify inspection | — | — | yes | yes |
| Create / assign / update order | yes | yes | — | yes |
| Close order with evidence | — | yes | yes | yes |
| Triage citizen report | yes | yes | yes | yes |
| Review citizen report | — | yes | yes | yes |
| Review triage suggestion | — | yes | yes | yes |
| CSV import | — | — | — | yes |
| Read audit trail | — | — | yes | yes |
| Migration / retention | — | — | — | yes |

A full administrator with no `treeRole` sees all jurisdictions. A staff member with a jurisdiction only sees that jurisdiction, including in the public register. Citizens and anonymous visitors see the whole public register; the staff-only jurisdiction resolver never narrows a citizen to an empty list.

Risk, removal and lifecycle decisions always need a named human. Removal approval (`removal_approved`) additionally requires a reviewer-confirmed `high` or `critical` risk.

## 4. Domain states

Transitions are defined once in `treeInventoryConstants.js` and enforced by the service.

| Entity | States |
| --- | --- |
| Tree | `active` → `pending_review` → `removal_approved` → `removed`; `archived` can be restored to `active` |
| Inspection | `scheduled` → `in_progress` → `completed` → `verified`; `missed`, `cancelled` |
| Maintenance order | `draft` → `assigned` → `in_progress` ↔ `blocked` → `completed` → `verified`; `cancelled` |
| Citizen report | `submitted` → `triaged` → `under_review` → `accepted` / `rejected` / `duplicate` |
| Triage suggestion | `pending` → `accepted` / `edited` / `rejected` (terminal) |

Invalid transitions return a stable `TREE_INVALID_TRANSITION` code with a plain-language message. A completed inspection cannot be edited; it can only be verified. A verified or cancelled work order is terminal. A reviewed triage suggestion cannot be reviewed again.

Closing an order as `completed` or `verified` requires closure notes of at least 10 characters and at least one evidence attachment. Closing a verified pruning order records a pruning event in the same transaction.

## 5. Validation and retry safety

- Every input is sanitised and validated in the service (`requireString`, `requireEnum`, `requireIsoDate`, coordinate checks, attachment checks) before it is stored.
- Coordinates: precise latitude/longitude must be valid WGS84 values. Public views receive only a rounded ~1 km bucket (`geo_12.97_77.64`).
- Text is trimmed, length-limited and stripped of unsafe markup. Public narratives are escaped/plain-text sanitised.
- Attachments are limited to JPEG, PNG and WebP, a maximum of 5 MB each and a bounded count, with a data-URL check. SVG and documents are rejected.
- CSV files are limited to 256 KB / 500 data rows.
- Actions that may be retried accept an `idempotencyKey`; a replay returns the original result (`replayed: true`) instead of duplicating records.
- Citizen report submission is rate-limited to 3 reports per hour per reporter key. A near-identical report from the same reporter, category and description within 10 minutes is flagged as a duplicate.
- Errors use stable codes (`TREE_PERMISSION_DENIED`, `TREE_JURISDICTION_FORBIDDEN`, `TREE_VALIDATION_ERROR`, `TREE_INVALID_TRANSITION`, `TREE_RATE_LIMITED`, `TREE_STORAGE_ERROR`, etc.) and a `userMessage` the UI can show.

## 6. Image-assisted triage

Triage is advisory only.

- Input is an optional image plus visible symptom tags and species context. Nothing is inferred from personal attributes.
- The deterministic ruleset is `tree-triage-rules-v1`, model identifier `deterministic-symptom-rules-v1`.
- An optional external adapter can be injected; if it is unavailable, times out or fails validation, the deterministic fallback runs and records a `fallbackReason`.
- Every suggestion records the ruleset/model version, execution timestamp, input window (fields used and image fingerprint), confidence, rationale and factor explanations.
- Suggestions carry `requiresExpertConfirmation: true`, `canApplyAutomatically: false` and explicit prohibited uses (`automatic_removal`, automatic risk designation, access denial).
- An arborist, reviewer or administrator must accept, edit or reject a suggestion. Accepting/editing applies **condition only**; risk, lifecycle status, pruning and removal are never changed by a suggestion.
- Logs contain no raw image bytes or personal contact details; audit details are the safe triage projection.

## 7. Public projections and privacy

`getPublicInventory`, `getPublicTreeByPublicId`, `getPublicWardMap` and `getCitizenReportStatus` return purpose-built views, never stored records. Public tree fields are limited to:

- public ID, ward, locality, species common/scientific name, planted year, condition label;
- coarse ~1 km grid and precision text;
- inspection timing, confirmed risk label, last verified inspection date, source and `updatedAt`.

Public responses exclude internal IDs, precise coordinates, private notes, creator/reporter keys, attachment internals and staff-only fields. Citizen tracking returns only public status fields and never another reporter's data.

The public page always renders a text table alternative to the ward map, accessible list/table toggle buttons, semantic table captions, `scope` attributes and status text that does not depend on colour.

## 8. Bulk CSV import

Required columns:

```text
ward, species_id, condition, latitude, longitude
```

Optional columns:

```text
public_id, locality, planted_on, planting_site_id, notes
```

Preview validates the header, row count, size, species catalogue, condition enum, coordinate ranges, duplicates, jurisdiction/ward and text limits. `preview.canApply` must be true before import. The service re-validates every row inside the transaction; one invalid row fails the whole import. Imported rows are written with schema metadata and an audit event that includes a file checksum.

## 9. Migrations, rollback, retention

Schema version: **2** (`TREE_INVENTORY_SCHEMA_VERSION`).

`ensureTreeInventoryData` bootstraps reference data (species, wards, planting sites) and a clearly labelled demonstration register on first use. `migrateTreeInventory`:

1. reads the version stamp;
2. normalises legacy v0/v1 tree and report records (IDs, approximate coordinates, defaults);
3. writes a full pre-migration snapshot to `civicbridge_tree_migration_backup_v1`;
4. applies all collections in one transaction;
5. stamps the new version.

`rollbackTreeInventory` restores the snapshot exactly. Both run and rollback are exposed only to an inventory administrator in the "Import & audit" tab.

Retention: closed citizen reports (`accepted`, `rejected`, `duplicate`) older than 365 days are archived in place on demand through `applyTreeRetentionPolicy`. The description is replaced with an archival marker, attachments are removed, the reporter key is nulled and an audit event records the counts. Operational tree, inspection, work-order and pruning history is retained as municipal record; tree records are archived, not deleted.

The Privacy Centre's "Clear my data" action clears the citizen-submitted tree report and attachment keys (`civicbridge_tree_citizen_reports_v1`, `civicbridge_tree_report_attachments_v1`, the legacy `civicbridge_tree_reports_v1` and the device reporter key). The public register, inspection history, work orders, triage records and the audit chain are retained as municipal operating records, so clearing a citizen's data cannot erase the register or its audit trail. See [DATA_RETENTION.md](DATA_RETENTION.md).

## 10. Audit trail

Privileged actions append hash-chained events:

- actor ID and display label, resolved tree role, jurisdiction;
- action, entity type/ID, reason, timestamp;
- bounded change summary;
- previous hash and current hash.

Nothing in the UI edits or deletes audit events. `verifyTreeAuditChain` detects tampering; the audit panel surfaces "Hash chain broken" and tells staff to stop using the local copy and restore a trusted backup.

## 11. Security threat model

| Threat | Control |
| --- | --- |
| Privilege escalation | Capability re-check in the service from the trusted actor; citizens cannot pass a role; route/button state is not authorisation |
| Cross-jurisdiction access | Every staff read/write resolves scoped jurisdictions; mismatches return `TREE_JURISDICTION_FORBIDDEN` |
| Enumeration | Public tree/asset codes are per-jurisdiction sequences because they are public asset labels; citizen tracking requires the exact random code; near-miss ids return the same generic not-found response; internal record IDs are never returned publicly; lists are paginated and bounded |
| Replay | Idempotency keys on retryable actions; audit and lists deduplicate by action key |
| Duplicate submission | Reporter/category/description/time-window duplicate detection plus rate limiting |
| Malicious upload | MIME allow-list, size/count caps, data-URL structure check, no SVG/documents, no execution path |
| Injection / XSS | Server-boundary sanitisation, plain-text public narratives, no `dangerouslySetInnerHTML` in tree components |
| Data leakage | Public projections built field-by-field; private notes and precise coordinates never enter them; security lint forbids unsafe HTML |
| Audit tampering | Append-only hash chain with verification |

## 12. Operational limits and manual fallback

- The register is stored on this device. It is a demonstration/local-first record, not a municipal system of record; decisions still need the official municipal process.
- Recommended practical size is a few thousand trees per device; pagination and indexes keep the UI bounded, but `localStorage` quota is the hard limit. For a real deployment, replace the storage adapter with a server API and keep the service contract.
- If an external triage model is unavailable, the deterministic ruleset runs. If storage is unavailable, the service returns a recoverable error and does not silently discard input.
- Manual fallback: staff can register a tree, schedule/complete an inspection or raise an order through the forms; citizens can submit a plain observation without a photo. CSV import is optional.
- If migration fails, the previous snapshot remains available and rollback restores it. If the audit chain fails verification, stop writes and restore from a trusted backup.

Environment variables: none are required for this module. It uses the existing app auth/network context and local storage. Do not put secrets in `VITE_` variables (they are public).

## 13. Testing

Targeted commands:

```bash
npx vitest run src/services/treeInventoryService.test.js
npx vitest run src/services/treeAccessControl.test.js
npx vitest run src/services/treeImageTriageService.test.js
npx vitest run src/services/treeInventoryMigrations.test.js
npx vitest run src/pages/TreeHealthInventory.test.jsx
npx vitest run src/components/trees/TreeInventoryComponents.test.jsx
```

Coverage:

- duplicate trees, coordinate validation, CSV preview/apply/replay and missing columns;
- citizen/operator/arborist/reviewer/admin authorisation and jurisdiction scoping;
- persistence across a simulated page reload (trees, inspections and the audit chain rebuilt from storage only);
- inspection reminders, lifecycle and work-order transitions, closure evidence and pruning events;
- triage determinism, provenance, fallback, human review and the "condition only" rule;
- audit-chain verification and retention;
- injection (markup/script payloads), enumeration (near-miss IDs and tracking codes) and cross-report access;
- public projection leakage checks;
- component accessibility, map/list alternatives, triage explanations and import/audit copy;
- migration from an empty store, a representative legacy dataset and rollback.

Full verification before a PR:

```bash
npm test
npm run lint
npm run lint:security
npm run build
```
