# Civic Information Freshness Prediction and Review Prioritization Model — Evaluation Report (#1189)

## 1. Evaluation criteria

| Criterion | Target | Measured by |
|-----------|--------|-------------|
| Deterministic scoring | Same inputs always produce same score | Unit tests |
| Deny-by-default for stale verification | Never-verified → highest concern | Unit tests |
| Link health weighting | Unreachable link → higher priority | Unit tests |
| Superseded source weighting | Superseded/withdrawn → higher priority | Unit tests |
| Government domain de-weighting | .gov.in domains slightly de-weighted | Unit tests |
| Score range | 0–100 inclusive | Unit tests |
| Priority band mapping | 0–30 low, 30–50 medium, 50–70 high, 70–100 critical | Unit tests |
| Confidence range | 0–1 inclusive | Unit tests |
| Review marking | Reviewed predictions marked with reviewer + timestamp | Unit + API tests |
| Drift detection | Score changes >5% recorded as drift events | Unit tests |
| Invalid input | 400 `validation_failed` with stable codes | Unit + API tests |
| Missing service/prediction | Appropriate not-found error | Unit tests |
| Concurrency | Concurrent predictions succeed | Unit tests |
| No sensitive data persisted | Sensitive keys/values rejected | Unit tests + code review |
| Migration & rollback | Legacy shape migrated; rollback/reset restore valid store | Unit tests |
| Retention | Old reviewed predictions archived | Unit tests |

## 2. Reproducible commands

```bash
# Install dependencies
npm install --no-audit --no-fund

# Lint all code (including security rules)
npm run lint
npm run lint:security

# Run freshness-prediction-related tests
npx vitest run \
  src/services/civicSourceFreshnessPredictionEngine.test.js \
  src/services/civicSourceFreshnessPredictionMigrations.test.js \
  src/data/civicSourceFreshnessPredictionConstants.test.js \
  api/_lib/civicSourceFreshnessPredictionSchemas.test.js \
  tests/civic-source-freshness-prediction-api.test.js

# Run full test suite (note: pre-existing failures in unrelated files)
npx vitest run

# Build
npm run build
```

## 3. Test coverage summary

| Test file | Area |
|-----------|------|
| `src/services/civicSourceFreshnessPredictionEngine.test.js` | Validation, predict, reviewPrediction, getPrediction, listPredictions, getReviewAudit, getDriftEvents, recordDriftEvent, listFeatureWeights, deny-by-default, stale verification, link health, superseded source, confidence |
| `src/services/civicSourceFreshnessPredictionMigrations.test.js` | Empty/seed store, validation helpers, migration, indexes, load/persist, transaction, rollback, reset, retention |
| `src/data/civicSourceFreshnessPredictionConstants.test.js` | Schema version, default prediction, enums, error codes, priority thresholds, feature weights |
| `api/_lib/civicSourceFreshnessPredictionSchemas.test.js` | Versioned schema validation for all endpoints |
| `tests/civic-source-freshness-prediction-api.test.js` | API integration: schema, predict, list predictions, get prediction, review, drift events, feature weights, auth gating |

## 4. Negative / permission / retry / concurrency cases

- **Negative:** invalid serviceId → 400; invalid priority band → 400; invalid status → 400; limit out of range → 400; score out of range → 400; missing serviceId → 400.
- **Permission:** review endpoints without a valid Clerk session → 401 `missing_token`; invalid token → 401 `invalid_token`.
- **Retry:** no retries (deterministic, single evaluation); drift events below 5% threshold not recorded.
- **Concurrency:** concurrent predictions succeed under normal load.

## 5. Dependencies, licences, and cost

- **Runtime dependencies:** none beyond existing (`react`, `lucide-react`, `vitest`, `eslint`).
- **Dev dependencies:** vitest, eslint (existing).
- **Licences:** MIT (project LICENSE).
- **Cost:** localStorage/in-memory writes bounded by retention; API calls are lightweight reads/writes. No external calls made by the engine itself.
- **Performance:** per-evaluation feature extraction sorted by priority; atomic store transactions; bounded retention via `applyFreshnessRetentionPolicy`.

## 6. Safety

- Synthetic fixtures only (`tests/fixtures/civicSourceFreshnessPredictionSyntheticFixtures.js`): made-up service/resource ids, link health statuses, and fabricated scores. No citizen records, credentials, raw documents, or sensitive prompts.
- Logs and analytics: no PII, no raw URLs/prompts (inputs hashed where applicable), no credentials.
- AI: not used; all rules are deterministic policy evaluations.
- Decisions are access-control/triage outputs, not legal advice, benefit denial, or official verification.
