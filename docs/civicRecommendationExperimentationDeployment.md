# Civic Service Recommendation Experimentation Platform with Guardrails — Deployment, Migration & Rollback (#1193)

## 1. Deployment Overview

The Recommendation Experimentation Platform is designed for zero-downtime deployment:
- **Client Application:** SPA workspace page loaded lazily at `/recommendation-experimentation`.
- **API Backend:** Optional Vercel serverless function mounted at `/api/civic-recommendation-experimentation`.
- **Zero Additional Infrastructure:** Operates client-side via browser-native storage (localStorage) with automatic in-memory fallback.

### Environment Configuration

No new secret environment variables are required. Existing Clerk and API configuration handles authentication seamlessly.

### Route Registrations

| Route | HTTP Method | Access Level | Description |
|-------|-------------|--------------|-------------|
| `/recommendation-experimentation` | GET | Public / Maintainer | Interactive workspace UI for managing experiments, guardrails, and simulators |
| `/api/civic-recommendation-experimentation` | GET | Public | Health and schema version checks |
| `/api/civic-recommendation-experimentation/experiments` | GET | Public | List active and registered experiments |
| `/api/civic-recommendation-experimentation/experiments/:id` | GET | Public | Retrieve detailed experiment metadata |
| `/api/civic-recommendation-experimentation/experiments` | POST | Operator Gated | Register or update an experiment |
| `/api/civic-recommendation-experimentation/assignments` | POST | Public | Deterministically assign a variant to a citizen |
| `/api/civic-recommendation-experimentation/metrics` | POST | Public | Record aggregate metrics and evaluate guardrails |
| `/api/civic-recommendation-experimentation/rollback` | POST | Operator Gated | Trigger an immediate experiment rollback |
| `/api/civic-recommendation-experimentation/metrics/:id` | GET | Public | Fetch comparative variant performance metrics |
| `/api/civic-recommendation-experimentation/audit-log` | GET | Public | Inspect governance audit log |

---

## 2. Configuration & Guardrail Thresholds

Experiments enforce four core guardrails defined in `civicRecommendationExperimentationConstants.js`:

| Guardrail Metric | Default Threshold | Description |
|------------------|-------------------|-------------|
| `minRelevanceScore` | 0.60 | Minimum acceptable mean relevance score across recommendations |
| `minLanguageCoverage` | 0.80 | Minimum ratio of recommendations available in citizen's preferred language |
| `maxErrorRate` | 0.05 | Maximum allowable error rate (5%) across variant calls |
| `minCohortSize` | 20 | Minimum samples required before displaying comparative metrics |

---

## 3. Migration Strategy

The store schema follows versioning (`CIVIC_EXPERIMENTATION_SCHEMA_VERSION = 1`).
The migration pipeline in `civicRecommendationExperimentationMigrations.js` ensures seamless upgrades:
- **Seed Initialization:** Missing or uninitialized stores are seeded with initial default experiments.
- **Legacy Migration:** Stores with legacy schemas are automatically transformed into versioned schemas with `migrationHistory` entries.
- **Safe Persistence:** All store modifications execute through `runExperimentationTransaction` with snapshot rollback on errors.

---

## 4. Rollback Procedures

### Immediate Experiment Kill-Switch

Operators can immediately halt any experiment via the API or workspace UI:

```javascript
import { rollbackExperiment } from './src/services/civicRecommendationExperimentationService.js';

const result = await rollbackExperiment({
  experimentId: 'exp-document-readiness-boost',
  reason: 'Guardrail breach detected in canary deployment'
});
```
When rolled back:
1. Status switches to `rolled_back`.
2. All subsequent assignments instantly route 100% of traffic to the baseline control.
3. An audit event is logged with operator provenance.

### Rollback to Seeded Store

```javascript
import { rollbackExperimentationStore } from './src/services/civicRecommendationExperimentationMigrations.js';

const restoredStore = rollbackExperimentationStore({ now: new Date() });
```

### Data Retention & Archival

The system applies automated retention via `applyExperimentationRetentionPolicy`:
- Metrics older than 90 days are pruned.
- The active audit log is capped at 1,000 recent items.
