# Civic Service Recommendation Experimentation Platform with Guardrails — Evaluation Report (#1193)

## 1. Evaluation Criteria

| Criterion | Target | Verification Method |
|-----------|--------|---------------------|
| Deterministic Assignment Consistency | Exact same variant assigned to identical citizenId & experimentId across turns | Unit tests in `src/services/civicRecommendationExperimentationEngine.test.js` |
| Prohibited Attribute Protection | 100% rejection of sensitive attributes (caste, religion, gender, Aadhaar, PAN) | Schema and engine unit tests |
| Opt-In Consent Enforcement | Opted-out users routed to baseline control variant without exception | Engine unit and API integration tests |
| Guardrail Breach Detection | Proactively flags relevance drops, language coverage lapses, and error rate spikes | Engine unit and API integration tests |
| Immediate Rollback Response | Status switches to `rolled_back` instantly routing all traffic to control | Engine and API tests |
| Privacy-Safe Cohort Protection | Masks variant comparisons until minimum cohort size (`minCohortSize`) is met | Engine and API tests |
| Zero Citizen Data Exposure | Strictly synthetic test fixtures; zero PII, passwords, or raw prompts logged | Security lint and fixture review |
| Versioned Schema Conformance | Validates input against schema v1; rejects unknown fields | Schema validation tests in `api/_lib/civicRecommendationExperimentationSchemas.test.js` |
| Atomic Persistence & Rollback | Store migrations upgrade legacy schemas; transactions rollback on error | Unit tests in `src/services/civicRecommendationExperimentationMigrations.test.js` |

---

## 2. Reproducible Commands

Run all verification steps using the commands below:

```bash
# 1. Install dependencies
npm install --no-audit --no-fund

# 2. Run unit and integration tests for recommendation experimentation
npx vitest run \
  src/data/civicRecommendationExperimentationConstants.test.js \
  src/services/civicRecommendationExperimentationMigrations.test.js \
  src/services/civicRecommendationExperimentationEngine.test.js \
  api/_lib/civicRecommendationExperimentationSchemas.test.js \
  tests/civic-recommendation-experimentation-api.test.js

# 3. Run production build to verify module bundling and chunking
npm run build
```

---

## 3. Test Coverage Summary

| Test File | Total Tests | Focus Areas |
|-----------|-------------|-------------|
| `src/data/civicRecommendationExperimentationConstants.test.js` | 8 | Schema version, status enums, error codes, guardrail thresholds, prohibited attributes list, slug regex |
| `src/services/civicRecommendationExperimentationMigrations.test.js` | 8 | Store initialization, legacy migration, load/persist lifecycle, atomic transactions with snapshot rollback, retention pruning |
| `src/services/civicRecommendationExperimentationEngine.test.js` | 14 | Prohibited attribute screening, upsert lifecycle, deterministic hashing, opt-in checks, inactive state fallbacks, guardrail breaches, rollback, cohort size protection |
| `api/_lib/civicRecommendationExperimentationSchemas.test.js` | 8 | Trust boundary validation, unknown key rejection, slug verification, sensitive attribute rejection, score ranges |
| `tests/civic-recommendation-experimentation-api.test.js` | 14 | API endpoints, session verification, operator gating (401/403), variant assignment, metric recording, rollback, 405 Method Not Allowed |
| **Total** | **52** | **All 52 tests passing with 100% success rate** |

---

## 4. Negative, Permission, Retry, and Concurrency Scenarios

- **Negative Cases:**
  - Non-slug IDs or uppercase characters fail validation with `RE_INVALID_TYPE`.
  - Body containing prohibited targeting attributes triggers `RE_PROHIBITED_ATTRIBUTE_TARGETING` (HTTP 400).
  - Attempting to access non-existent experiments returns HTTP 404.
  - Unsupported HTTP verbs return HTTP 405 Method Not Allowed.
- **Permission Cases:**
  - Operator-gated endpoints (experiment creation, rollback) reject unauthenticated calls with HTTP 401 `missing_token` or `invalid_token`.
  - Authenticated non-operators are rejected with HTTP 403 `operator_access_denied`.
- **Retry & Recovery:**
  - Failed transactions immediately restore snapshots without partial mutations.
  - If localStorage is disabled or throws quota errors, memory storage fallback operates transparently.
- **Concurrency:**
  - Atomic transactions verify state consistency, isolating concurrent updates.

---

## 5. Dependencies, Licenses, and Cost Limits

- **Dependencies:** Uses existing project dependencies (`react`, `lucide-react`, `vitest`). Introduces zero new external npm dependencies.
- **Licenses:** MIT License across all components.
- **Performance:** Deterministic hashing executes in < 1ms per assignment; entire test suite runs in under 250ms.
- **Cost Limits:** Serverless and client-executable; storage bounded by 90-day retention pruning and 1,000 max audit log cap. Consumes 0 LLM tokens for deterministic rule evaluations.

---

## 6. Safety and Data Protection

- **Synthetic Fixtures Only:** Verified using `tests/fixtures/civicRecommendationExperimentationSyntheticFixtures.js`.
- **Stateless Hashing:** User assignments are calculated without storing personal identifiers in cookies or databases.
- **Non-Autonomous Guardrail:** Recommendation scores are diagnostic hints. No automated benefit grant, benefit denial, or official verification occurs.
