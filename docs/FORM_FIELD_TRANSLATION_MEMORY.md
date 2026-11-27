# Multilingual Civic Form Field Translation Memory

> **Issue**: [#1423](https://github.com/GoldRay19/Civic-Help-Setu/issues/1423)
> **Branch**: `feat/multilingual-translation-memory-1423`
> **Extends**: `#1114` (`civicTranslationMemory.js`, `civicTranslationMemoryService.js`)

---

## 1. Architecture Overview

| Component | Role |
|-----------|------|
| `src/services/formFieldTranslationMemoryExtension.js` | Governed form-field terminology registry (`sourcePhrase`, `approvedTranslation`, `language`, `script`, `reviewer`, `version`), deterministic fallback to original wording, legal-term human review enforcement, PII-free audit log |
| `api/_lib/handlers/form-field-translation-memory.js` | Serverless REST API (`/api/form-field-translation-memory`, `/approve`, `/audit-log`) with Clerk JWT auth, rate limiting, and reviewer/admin gating |
| `src/pages/FormFieldTranslationMemoryWorkspace.jsx` | Accessible UI (`/form-translation-memory`, `/translation-memory`) |

---

## 2. Fallback & Legal Term Governance

- **Fallback to Original Wording**: `resolveFormFieldLabel()` always returns the original `sourcePhrase` (`fallbackUsed: true`) when no human-approved translation exists for the requested language.
- **Human Review for Legal Terms**: `isLegalOrStatutoryTerm()` flags statutory terms (`affidavit`, `domicile`, `encumbrance`, `mutation`, `gazette`, `challan`, etc.) so they require independent `reviewer` / `legal_reviewer` / `admin` approval (`403` for citizens or self-review).

---

## 3. Configuration, Monitoring & Rollback

- **Configuration**: Uses `CLERK_SECRET_KEY` for JWT auth; no new env vars required.
- **Monitoring**: Track `fallbackUsed` rates, `isLegalTerm` pending queue depth, `403` role rejections, and `400` PII rejections.
- **Rollback**: Remove `"form-field-translation-memory"` from `api/[...path].js` and `/form-translation-memory` from `src/App.jsx`.
