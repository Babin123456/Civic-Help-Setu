# Plain-Language Government Notice and Order Explainer

> **Issue**: [#1422](https://github.com/GoldRay19/Civic-Help-Setu/issues/1422)
> **Branch**: `feat/notice-order-explainer-1422`
> **Extends**: `civicNoticeSummarizerService.js` and `formFieldTranslationMemoryExtension.js`

---

## 1. Architecture Overview

| Component | Role |
|-----------|------|
| `src/services/noticeOrderExplainerService.js` | Section extraction with `Page P, Para N` citations, OCR confidence assessment, uncertainty flags, human-reviewed translation lookup, authoritative disclaimer, zero-PII guard |
| `api/_lib/handlers/notice-order-explainer.js` | Serverless REST API (`/api/notice-order-explainer`, `/review-translation`, `/audit-log`) with rate limiting & reviewer/admin gating |
| `src/pages/NoticeOrderExplainerWorkspace.jsx` | Side-by-side accessible UI (`/notice-explainer`, `/order-explainer`) |

---

## 2. Authoritative Text & Uncertainty Guarantees

- **Official Text Remains Authoritative**: Every response and UI view displays `AUTHORITATIVE_TEXT_DISCLAIMER` alongside the original passage.
- **OCR Confidence & Uncertainty**: Low OCR confidence (`< 0.70`) or conditional wording raises `uncertaintyFlag: true`; missing metadata is marked `UNVERIFIED`.
- **Rollback**: Remove `"notice-order-explainer"` from `api/[...path].js` and `/notice-explainer` from `src/App.jsx`.
