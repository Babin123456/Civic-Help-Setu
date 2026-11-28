# Civic Application Duplicate and Related-Case Detector

> **Issue**: [#1427](https://github.com/GoldRay19/Civic-Help-Setu/issues/1427)
> **Branch**: `feat/duplicate-related-case-detector-1427`

---

## 1. Architecture Overview

| Component | Role |
|-----------|------|
| `src/services/civicCaseDuplicateDetectorService.js` | Explainable scoring (category, jurisdiction, time window, user-confirmed reference), human confirmation with separate case ID preservation, PII guard, synthetic precision/recall evaluator |
| `api/_lib/handlers/duplicate-case-detector.js` | Serverless REST API (`/api/duplicate-case-detector`, `/confirm`, `/eval`, `/audit-log`) with Clerk JWT auth, rate limiting, and admin/reviewer gating |
| `src/pages/DuplicateCaseDetectorWorkspace.jsx` | Accessible UI (`/duplicate-case-detector`, `/related-cases`) |

---

## 2. Privacy & Non-Destructive Linking

- Never matches on Aadhaar, PAN, personal phone numbers, or citizen names; PII payloads are rejected (`400`).
- Confirming a duplicate (`LINK_DUPLICATE`) or related case (`LINK_RELATED`) always preserves both original `caseId`s (`separateCaseIdsPreserved: true`).

---

## 3. Configuration, Monitoring & Rollback

- **Configuration**: Uses `CLERK_SECRET_KEY` for JWT auth; no new env vars required.
- **Monitoring**: Track `precision`/`recall` on synthetic fixtures, `LINK_DUPLICATE` vs `MARK_DISTINCT` ratios, and `400` PII rejections.
- **Rollback**: Remove `"duplicate-case-detector"` from `api/[...path].js` and `/duplicate-case-detector` from `src/App.jsx`.
