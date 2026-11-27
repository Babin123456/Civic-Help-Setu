# Civic Data API and developer sandbox (#773)

A read-only, versioned data contract for approved public datasets, with a developer sandbox, scoped credentials, quotas, usage metrics and append-only audits.

The feature is reachable at `/civic-data-api` (alias `/developer-api`) from the navigation drawer.

## What is exposed

| Dataset | Classification | Public fields | Filters |
| --- | --- | --- | --- |
| `service-locations` | Public directory | id, name, department, category, state, district, ward, address, timings, officialUrl, lastVerifiedAt | state, district, ward, category, q |
| `public-notices` | Public notice | id, title, department, category, state, district, issuedAt, effectiveAt, summary, sourceUrl, lastVerifiedAt | state, district, category, issuedAfter, issuedBefore, q |
| `ward-metrics` | Ward aggregate only | id, state, district, ward, metric, value, unit, period, sourceUpdatedAt | state, district, ward, metric, period, q |

The sandbox is populated from `src/data/civicDataApiCatalog.js`. Every sandbox response is labelled `meta.synthetic: true` and identifies the dataset version, source and generation timestamp.

Citizen-level applications, grievances, contact details, notes, internal identifiers and API key hashes are never returned by the dataset query path.

## API contract

```
GET /api/v1/datasets
GET /api/v1/datasets/{id}/schema
GET /api/v1/datasets/{id}/records?page=1&pageSize=10&state=...
```

Records requests require `x-api-key`. Responses include:

- `apiVersion` and `dataset.version`
- `meta.page`, `meta.pageSize`, `meta.total`, `meta.totalPages`, `meta.hasNextPage`
- `meta.source`, `meta.license`, `meta.generatedAt`, `meta.synthetic`
- `quota.limit`, `quota.used`, `quota.remaining`
- `rateLimit.limit`, `rateLimit.remaining`, `rateLimit.windowSeconds`
- stable error codes (`RATE_LIMITED`, `QUOTA_EXCEEDED`, `SCOPE_DENIED`, ...)

Pagination is bounded by each dataset's `maxPageSize`. Filters are allow-listed per dataset. Unknown filters, unknown public fields and out-of-jurisdiction requests are refused rather than ignored.

### Deployment boundary

The developer portal executes the same read-only contract through `executeReadOnlyQuery` in `src/services/civicDataApiService.js`. That is the sandbox path used by the tests and the UI.

To serve the contract over HTTPS, deploy a thin server adapter that:

1. authenticates `x-api-key` by comparing a SHA-256 hash with the server-owned key store;
2. loads the approved dataset and schema from the same catalogue contract;
3. applies the same pagination, filter, jurisdiction, quota and rate-limit rules;
4. writes usage and audit rows in a shared store (Firestore, Postgres or similar);
5. serves only the public fields listed above.

Do not move browser `localStorage` into a public endpoint. Production keys, quotas and audit retention must live at the server boundary. `api/_lib/abuseGuard.js` already provides per-instance rate limiting and single-flight helpers for public Vercel functions.

## Domain states

### API client

```
pending -> active | revoked
active -> suspended | revoked
suspended -> active | revoked
revoked -> (terminal)
```

- Sandbox clients activate immediately.
- Production clients are created as `pending` and require an administrator to approve them.
- Suspending or revoking a client revokes its active keys.
- A reason is required for suspension and revocation.

### API key

```
active -> revoked (rotation or owner decision)
```

A rotated key is revoked immediately and linked to its replacement through `rotatedFromKeyId` / `rotatedToKeyId`. The plaintext key is returned once and never stored.

### Dataset

```
draft -> approved | archived
approved -> deprecated | archived
deprecated -> approved | archived
archived -> (terminal)
```

Only approved and deprecated datasets are listed and queryable.

## Data model and persistence

| Model | Storage key | Purpose |
| --- | --- | --- |
| `ApiClient` | `civicbridge_api_clients_v1` | owner, environment, lifecycle state, dataset scope, jurisdiction, quota |
| `ApiKey` | `civicbridge_api_keys_v1` | client, prefix, last four characters, SHA-256 hash, state, expiry, rotation links |
| `UsageMetric` | `civicbridge_api_usage_daily_v1` | per client / dataset / day request, error and byte counts |
| `Dataset` | `civicbridge_dataset_catalog_v1` | approved catalogue, classification, public fields, filters, quotas |
| `SchemaVersion` | `civicbridge_schema_versions_v1` | versioned field types, required/enum/range/format rules |
| `RateLimitEvent` | `civicbridge_rate_limit_events_v1` | allowed and blocked request timestamps for the per-minute window |
| `AccessAudit` | `civicbridge_access_audits_v1` | append-only administrative and API access events |
| anomaly reviews | `civicbridge_api_anomaly_reviews_v1` | human accept/edit/reject decisions for deterministic recommendations |

Every record carries `createdAt`, `updatedAt`, `createdBy` and `schemaVersion` where it applies. Key records are never exposed with `keyHash` in list views.

Multi-record operations (key rotation and client revocation) use the local snapshot transaction helper so a failed write restores all governance collections.

## Governance

- Per-client per-minute limit: 30 sandbox, 120 production.
- Daily quota: 250 sandbox, 5000 production.
- Jurisdiction scope is enforced on every query. A Karnataka client cannot request Delhi rows.
- Dataset scope is enforced on every query.
- Keys can expire, be rotated or be revoked.
- Usage is aggregated daily; no individual request payload or caller identity is stored in usage rows.

### Deterministic anomaly recommendations

Rules are fixed and versioned (`ANOMALY_RULE_VERSION`). Each recommendation records:

- rule id and rule version
- input window
- execution timestamp
- explanation
- the source fields that influenced it
- a recommendation

Current rules:

| Rule | Threshold |
| --- | --- |
| `daily_quota_pressure` | 80% or more of the daily quota used |
| `repeated_rate_limits` | 3 or more blocked requests in 24 hours |
| `error_rate_pressure` | more than 20% errors with at least 10 requests today |

An administrator can accept, edit or reject a recommendation. Edit and reject require a reason. The original recommendation, editor, reason and rule version are retained.

## Privacy, security and auditability

- Public views expose only fields marked `public: true` in the schema.
- Ward metrics are aggregates only; no application-level or citizen-level rows exist in the catalogue.
- API secrets are generated with `crypto.getRandomValues` and stored as SHA-256 hashes.
- Key list views show only the prefix and last four characters.
- Owners see only their own clients; administrators see all clients.
- Audit reads and anomaly reviews require administrator permission.
- Sanitization uses the shared `sanitizePlainText` helper; URLs use `safeHttpUrl` in schema validation.
- Threat model for this feature:
  - **Enumeration:** dataset and filter names are allow-listed; unknown values are refused.
  - **Replay / duplicate submissions:** reads are idempotent; usage writes are aggregate counters.
  - **Privilege escalation:** the caller never supplies their role; ownership and admin checks run in the service layer.
  - **Data leakage:** response rows are projected to public fields and tested against the schema.
  - **Malicious uploads:** this feature accepts no uploads.
  - **Key theft:** keys are hashed, scoped, expire and can be rotated or revoked.
  - **Quota abuse:** per-minute limits, daily quotas and append-only rate-limit events.

## Retention, deletion and archival

| Data | Retention | Behaviour |
| --- | --- | --- |
| API clients and keys | Until revoked or deleted by the owner/admin | Revocation is immediate and audited; hashes stay for the audit trail |
| Daily usage | 400 days | Aggregate counters only; prune with the normal data-retention job |
| Rate-limit events | 7 days in local storage | Older events are pruned on write |
| Access audits | 2 years | Append-only; no update path |
| Anomaly reviews | 2 years | Retained with the rule version and reviewer decision |
| Dataset catalogue and schema rows | Life of the dataset version | Archived versions remain readable for compatibility checks |
| Sandbox fixtures | Replaced with the release | Synthetic only; no real citizen data |

Deleting a client revokes its keys and stops all requests, but does not rewrite historical aggregate usage or audit rows.

## Migrations and rollback

The storage keys are version-suffixed (`_v1`). The seed is additive: `ensureCivicDataApiSeed` writes the catalogue and schemas only when the collections are empty, so existing clients, keys, usage and audits are not overwritten.

For a schema change:

1. Add a new schema version (`v2`) with `compatibility` and run `validateSchemaCompatibility` against `v1`.
2. Publish the new dataset version through an administrator path; keep `v1` readable until clients migrate.
3. Write a migration that copies or transforms records; validate every record with `validateRecordAgainstSchema`.
4. Keep the previous catalogue snapshot in `civicbridge_dataset_catalog_v1` backup storage before applying.
5. Roll back by restoring the previous catalogue and schema rows and re-pointing the dataset to its previous version. Do not delete the new version until the audit retention window ends.

A rollback is safe because reads are version-scoped and no mutation path is exposed by this feature.

## Environment variables

No environment variable is required for the local sandbox. The developer portal uses the browser's storage.

For a server adapter, keep server-only configuration out of `VITE_` variables:

| Variable | Purpose |
| --- | --- |
| `CIVIC_DATA_API_KEY_PEPPER` | optional server-side pepper before SHA-256 key hashing |
| `CIVIC_DATA_API_STORE` | server data store connection (Firestore / Postgres) |
| `CIVIC_DATA_API_AUDIT_SINK` | append-only audit destination |

## Local setup and tests

```bash
npm install
npm run dev
```

Open `/civic-data-api`.

Targeted tests:

```bash
npm test -- --run src/services/civicDataApiService.test.js
npm test -- --run src/pages/CivicDataApi.test.jsx
```

Full verification before opening a pull request:

```bash
npm test
npm run lint
npm run lint:security
npm run build
```

## Manual fallback

If the developer portal cannot write to storage, it still lists the approved catalogue from the bundled definitions. It shows a recoverable error for credential actions and never presents a synthetic key as if it were issued. The sandbox console disables requests while the browser reports offline.
