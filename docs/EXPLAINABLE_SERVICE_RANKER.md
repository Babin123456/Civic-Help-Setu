# Explainable Civic Service Recommendation Ranker

> **Issue**: [#1430](https://github.com/GoldRay19/Civic-Help-Setu/issues/1430)
> **Branch**: `feat/explainable-service-ranker-1430`

---

## 1. Architecture Overview

| Component | Role |
|-----------|------|
| `src/services/explainableServiceRanker.js` | Multi-factor ranker (`Query Relevance` 0.40, `Jurisdiction Match` 0.25, `Task Stage Fit` 0.15, `Verified Freshness` 0.20), deterministic fallback, sensitive-feature stripping, intent override, offline MRR + fairness evaluator |
| `api/_lib/handlers/explainable-service-ranker.js` | Serverless REST API (`POST /api/explainable-service-ranker`, `GET /eval` admin/reviewer-only) with rate limiting & PII rejection |
| `src/pages/ExplainableServiceRankerWorkspace.jsx` | Accessible UI (`/service-ranker`, `/explainable-recommendations`) |

---

## 2. Fairness & Privacy-by-Design

- `sanitizeRankingContext()` strips `caste`, `religion`, `gender`, `income`, `disability`, `aadhaar`, `pan`, `age`, and `biometric` keys so sensitive features can never influence ranking.
- `evaluateRankerOffline()` verifies ranking invariance across demographic perturbations (`fairnessInvariantPassed`).

---

## 3. Configuration, Monitoring & Rollback

- **Configuration**: Uses `CLERK_SECRET_KEY` for `/eval`; ranking itself is deterministic and offline-capable.
- **Monitoring**: Track `fallbackUsed` rates, `fairnessInvariantPassed`, `mrr`, and `400` PII rejections.
- **Rollback**: Remove `"explainable-service-ranker"` from `api/[...path].js` and `/service-ranker` from `src/App.jsx`.
