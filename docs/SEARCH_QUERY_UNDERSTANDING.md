# Civic Search Query Understanding & Spelling Recovery Layer

> **Issue**: [#1431](https://github.com/GoldRay19/Civic-Help-Setu/issues/1431)
> **Branch**: `feat/search-query-spelling-recovery-1431`
> **Extends**: `#435` (`phoneticTransliterationSearchService.js`) and `MOCK_SERVICES`

---

## 1. Architecture Overview

| Component | Role |
|-----------|------|
| `src/services/civicSearchQueryRecoveryService.js` | Devanagari & Indic colloquial transliteration, Damerau-Levenshtein spelling recovery, curated synonyms, legal identifier locking, reviewed query evaluation |
| `api/_lib/handlers/search-query-recovery.js` | Serverless REST API (`/api/search-query-recovery`, `/evaluate`, `/evaluations`) with rate limiting, PII rejection, and reviewer/admin auth gating |
| `src/pages/SearchQueryRecoveryWorkspace.jsx` | Accessible UI (`/search-recovery`, `/query-understanding`) showing original query, corrections, locked legal tokens, and evaluation controls |

---

## 2. Legal Identifier Safety & Provenance

- **Locked Legal Tokens**: `Form 16`, `Section 80C`, `RTI/2026/101`, `GRV-*`, 6-digit PINs, and IFSC codes are locked by `isLegalIdentifierToken()` and **never** altered by spell correction.
- **Original Query Preservation**: `originalQuery` is always returned alongside `correctedQuery` with an interactive "Search Original Query Instead" toggle.
- **Zero PII**: Queries containing Aadhaar or PAN patterns are rejected (`400`) and excluded from evaluation logs.

---

## 3. Configuration, Monitoring & Rollback

- **Configuration**: Uses `CLERK_SECRET_KEY` for reviewer evaluation endpoints; search recovery itself runs deterministically with zero external LLM calls.
- **Monitoring**: Track `hasCorrection` rates, `lockedLegalTokens` frequency, `400` PII rejections, and `accepted` vs `Needs Tuning` evaluation ratios.
- **Rollback**: Remove `"search-query-recovery"` from `api/[...path].js` and `/search-recovery` from `src/App.jsx`.
