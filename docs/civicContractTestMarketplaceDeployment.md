# Civic Service Integration Contract Test Marketplace — Deployment, Migration & Rollback (#1191)

## 1. Deployment Overview

The Contract Test Marketplace is deployed as a zero-downtime, fully backward-compatible feature slice:
- **Client Application:** SPA workspace page loaded lazily at `/contract-test-marketplace`.
- **API Backend:** Optional Vercel serverless function mounted at `/api/civic-contract-test-marketplace`.
- **Zero Additional Infrastructure:** Relies on browser-native storage (client) and stateless memory/KV (serverless).

### Environment Configuration

No new secret environment variables are required. Existing Clerk and API configuration handles authentication seamlessly.

### Route Registrations

| Route | HTTP Method | Access Level | Description |
|-------|-------------|--------------|-------------|
| `/contract-test-marketplace` | GET | Public / Maintainer | Interactive workspace UI for browsing adapters, suites, and reports |
| `/api/civic-contract-test-marketplace` | GET | Public | Health and schema version checks |
| `/api/civic-contract-test-marketplace/adapters` | GET | Public | List registered provider adapters |
| `/api/civic-contract-test-marketplace/adapters` | POST | Operator Gated | Register or update a provider adapter |
| `/api/civic-contract-test-marketplace/suites` | GET | Public | List contract test suites |
| `/api/civic-contract-test-marketplace/suites` | POST | Operator Gated | Register or update a contract suite |
| `/api/civic-contract-test-marketplace/suites/:id/run` | POST | Authenticated User | Execute a sandbox contract suite run |
| `/api/civic-contract-test-marketplace/runs/:id` | GET | Public | Retrieve conformance run details |
| `/api/civic-contract-test-marketplace/runs/:id/results` | GET | Public | Fetch individual test results for a run |
| `/api/civic-contract-test-marketplace/runs/:id/drift` | POST | Authenticated User | Record a conformance score drift event |
| `/api/civic-contract-test-marketplace/audit-log` | GET | Public | Read redacted audit trail |
| `/api/civic-contract-test-marketplace/feature-weights` | GET | Public | Inspect scoring weights |

---

## 2. Configuration & Weights

Conformance scores are computed deterministically using weighted categories:

| Test Type | Default Weight | Objective |
|-----------|----------------|-----------|
| `auth` | 0.20 | Validate token headers, expiration, and rejected invalid credentials |
| `schema` | 0.25 | Validate payload structure, field presence, and data type integrity |
| `pagination` | 0.10 | Verify cursor / offset boundaries, limits, and total counts |
| `freshness` | 0.10 | Ensure timestamps comply with SLA staleness thresholds |
| `error_behavior` | 0.10 | Verify proper HTTP 4xx/5xx responses for bad requests |
| `breaking_change` | 0.15 | Detect removed fields, modified types, or contract regressions |
| `malicious_payload` | 0.10 | Probe sanitization against XSS, SQLi, and injection patterns |

---

## 3. Migration Strategy

The store schema follows strict versioning (`CIVIC_CONTRACT_TEST_SCHEMA_VERSION = 1`).
The migration pipeline in `civicContractTestMarketplaceMigrations.js` ensures seamless upgrades:
- **Seed Initialization:** Empty stores are seeded with initial default adapters and suites.
- **Legacy Migration:** Stores with legacy schemas are automatically transformed into versioned schemas with `migrationHistory` entries.
- **Safe Persistence:** All store modifications occur via `runContractTestTransaction` with snapshot rollback on errors.

---

## 4. Rollback Procedures

### Rollback to Seeded Store

To restore default synthetic state programmatically:

```javascript
import { rollbackContractTestStore } from './src/services/civicContractTestMarketplaceMigrations.js';

const restoredStore = rollbackContractTestStore({ now: new Date() });
```

### Reset to Clean Store

To wipe state and re-initialize empty tables:

```javascript
import { resetContractTestStoreToEmpty } from './src/services/civicContractTestMarketplaceMigrations.js';

const emptyStore = resetContractTestStoreToEmpty({ now: new Date() });
```

### Data Retention & Archival

The system applies automated retention via `applyContractTestRetentionPolicy`:
- Runs and audit logs older than 90 days are archived or pruned.
- The active audit log is capped at 1,000 recent items.
