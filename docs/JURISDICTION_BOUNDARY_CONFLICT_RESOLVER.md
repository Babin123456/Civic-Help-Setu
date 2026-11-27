# Jurisdiction Boundary Conflict Resolver for Civic Services

> **Issue**: [#1434](https://github.com/GoldRay19/Civic-Help-Setu/issues/1434)
> **Branch**: `feat/jurisdiction-boundary-resolver-1434`
> **Extends**: `#815` (`administrativeJurisdictionResolverService.js`, `jurisdiction-handoff.js`, `JurisdictionHandoffWorkspace.jsx`)

---

## 1. Architecture Overview

| Component | Role |
|-----------|------|
| `src/services/jurisdictionBoundaryConflictService.js` | Versioned boundary datasets, border-area ambiguity detection with confidence & alternatives, manual override, non-PII provenance logs |
| `api/_lib/handlers/jurisdiction-handoff.js` | Extended with `GET ?action=boundary-versions`, `GET ?action=provenance-logs` (admin/officer only), `POST action=resolve-conflict`, and `POST action=manual-override` (auth required) |
| `src/components/jurisdiction/BoundaryConflictResolverPanel.jsx` | Accessible UI panel embedded in `JurisdictionHandoffWorkspace.jsx` |

---

## 2. Data Provenance & Uncertainty Handling

- **Versioned Datasets**: `BOUNDARY_DATASET_VERSIONS` (`2026.2`, `2025.4`) carry `source`, `jurisdiction`, `effectiveDate`, `lastVerifiedAt`, and `verificationStatus`.
- **Distinct Provenance**: `official_dataset` (`Official Boundary Dataset`), `citizen_confirmed` (`Citizen Confirmed Override`), `ai_suggestion`, and `unverified` (`Unverified / Unknown Rule`) are visibly distinguished.
- **Unknown Boundaries**: Unmatched inputs return `UNVERIFIED` rather than guessing state/municipal rules.

---

## 3. Configuration, Monitoring & Rollback

- **Configuration**: Uses existing `jurisdiction-handoff` serverless route; no new environment variables required.
- **Monitoring**: Track `AMBIGUOUS_BORDER` rates, `MANUAL_OVERRIDE` frequency, `401`/`403` auth rejections, and `400` PII validation rejections.
- **Rollback**: Remove `<BoundaryConflictResolverPanel />` from `JurisdictionHandoffWorkspace.jsx` and the new `action` branches from `api/_lib/handlers/jurisdiction-handoff.js`. All `#815` endpoints remain untouched.

