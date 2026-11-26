# Civic Information Freshness Prediction and Review Prioritization Model — Deployment, Migration & Rollback (#1189)

## 1. Deployment

The freshness prediction engine runs entirely in the browser (localStorage-backed store) and
optionally behind the `/api/civic-source-freshness-prediction` Vercel serverless route.
No build-time changes are required beyond adding the new files.

### Environment variables

No new environment variables are introduced. No `VITE_` variables are added,
so no secrets are bundled into the public client bundle.

### Routes

| Path | Method | Access |
|------|--------|--------|
| `/freshness-prediction` | GET | Public (evaluation UI + read-only aggregates) |
| `/api/civic-source-freshness-prediction` | GET/POST | Public read; review mutations require a verified Clerk session |

Add the route to `src/App.jsx` (already wired):

```jsx
<Route path="/freshness-prediction" element={<FreshnessPredictionWorkspacePage />} />
```

## 2. Configuration

Feature weights define how much each factor contributes to the priority score.
The default weights are:

| Feature | Weight | Description |
|---------|--------|-------------|
| days_since_verification | +0.30 | Days since last verification (capped at 180 days) |
| link_health | +0.25 | Link health (unreachable = highest concern) |
| source_age | +0.15 | Source age in days (capped at 730 days / 2 years) |
| superseded_status | +0.10 | Source superseded or withdrawn |
| change_frequency | +0.10 | Number of change events (capped at 12) |
| gov_domain | -0.05 | Government domain (slightly de-weighted) |
| verification_count | -0.05 | Number of verifications on record (capped at 12) |

Weights sum to a baseline that maps into a 0–100 priority score. Operators may
adjust them, but must record the change and re-evaluate baselines.

Priority band thresholds:

| Band | Score range |
|------|-------------|
| low | 0–29 |
| medium | 30–49 |
| high | 50–69 |
| critical | 70–100 |

Policies can be created/updated via the API.

## 3. Migration

The store uses a versioned schema (`CIVIC_SOURCE_FRESHNESS_SCHEMA_VERSION =
1`). On load:

- A missing or invalid store is re-seeded with an empty state.
- A legacy (pre-v1) flat shape is migrated by `migrateFreshnessStore`, which
  preserves collections and records a `migrationHistory` entry. Nothing is
  silently dropped.
- `createSeedStore` seeds an empty store.

Migration entry example:

```json
{ "from": 0, "to": 1, "appliedAt": "2026-11-24T10:00:00Z", "kind": "upgrade" }
```

## 4. Rollback

### Rollback to seeded store

```js
import { rollbackFreshnessStore } from './src/services/civicSourceFreshnessPredictionMigrations.js';

const restored = rollbackFreshnessStore({ now: new Date() });
// restored is a freshly seeded store.
```

### Reset to empty store

```js
import { resetFreshnessStoreToEmpty } from './src/services/civicSourceFreshnessPredictionMigrations.js';

const empty = resetFreshnessStoreToEmpty({ now: new Date() });
// empty store with no predictions.
```

### Retention

Old reviewed/superseded/withdrawn predictions older than `retentionDays`
(default 90) are archived via `applyFreshnessRetentionPolicy`. Their scores
stay for audit. Drift events older than retentionDays are archived too.

## 5. Verification before production

1. Run the full prediction engine test suite:
   ```bash
   npx vitest run src/services/civicSourceFreshnessPredictionEngine.test.js \
     src/services/civicSourceFreshnessPredictionMigrations.test.js \
     src/data/civicSourceFreshnessPredictionConstants.test.js \
     api/_lib/civicSourceFreshnessPredictionSchemas.test.js \
     tests/civic-source-freshness-prediction-api.test.js
   ```
2. Run lint and security lint:
   ```bash
   npm run lint && npm run lint:security
   ```
3. Review `DEFAULT_FEATURE_WEIGHTS` and `PRIORITY_THRESHOLDS` against
   organizational review priorities before production use.
4. Confirm no `VITE_` secrets are introduced and no raw prompts are logged.

## 6. Safety

- Synthetic fixtures only; no citizen records, credentials, raw documents or
  sensitive prompts in fixtures, logs or analytics.
- Decisions are triage hints for maintainer review, not legal advice or benefit
  denial.
- The engine never autonomously edits guidance, files applications, or denies
  benefits.
