# Civic Notice Applicability Map by Locality and Effective Date

## Overview
Public notices published by municipal corporations, traffic police directorates, water and electricity boards, and revenue authorities contain critical operational updates—ranging from planned pipe maintenance shutdowns and high-density road diversions to property tax advance concession windows. However, these documents are often lengthy and dense, burying the exact geographic and temporal boundaries under bureaucratic jargon. As a result, citizens struggle to determine whether a published notice applies to their locality or whether an announcement has expired.

The **Civic Notice Applicability Map Service** (`src/services/civicNoticeApplicabilityMapService.js`) provides an authoritative geographic and temporal resolver. It extracts and models effective date windows, maps verified municipal ward boundaries, marks ambiguous candidate place names for human review, and allows citizens to subscribe to localized alerts without exposing private geolocation data.

---

## Architectural Principles & Workflow

```
       [ Gazetted Public Notices & Authority Advisories ]
                              |
                              v
       +---------------------------------------------+
       | Temporal & Geographic Scope Resolver        |
       |   - Effective Start & End Windows           |
       |   - Distinguishes Confirmed vs Ambiguous    |
       |     Candidate Mentions                      |
       +----------------------+----------------------+
                              |
                              v
       +---------------------------------------------+
       | Deterministic Applicability Evaluator       |
       |   - APPLICABLE_ACTIVE (Within Date & Ward)  |
       |   - FUTURE_EFFECTIVE (Upcoming Works)       |
       |   - TEMPORALLY_EXPIRED (Archived Notice)    |
       |   - UNCERTAIN_AMBIGUOUS (Needs Resolution)  |
       +----------------------+----------------------+
                              |
              +---------------+---------------+
              |                               |
              v                               v
    +-------------------+           +-------------------+
    | Vector Map Layers |           | Accessible Table  |
    | (Polygons, Points,|           | (WCAG Non-Visual  |
    |  Source Passages) |           |  Tabular Parity)  |
    +-------------------+           +-------------------+
                              |
                              v
       +---------------------------------------------+
       | Localized Citizen Subscriptions (Alerts)    |
       |   - Ward-Based Notification Feeds           |
       |   - Redacted Export Sanitization            |
       +---------------------------------------------+
```

---

## Core Capabilities

### 1. Geographic & Temporal Boundaries
Each notice encapsulates:
- **`effectiveStartDate` & `effectiveEndDate`**: ISO date stamps defining the active period.
- **`targetLocalities`**: Array of target wards or regions, categorized by extraction confidence (`LOCALITY_EXTRACTION_CONFIDENCE`):
  - `CONFIRMED_AUTHORITATIVE`: Confirmed by an authorized reviewer.
  - `CANDIDATE_UNREVIEWED`: Suggested by automated extractors, pending human verification.
  - `AMBIGUOUS_UNRESOLVED`: Place names shared across multiple wards (e.g. "Station Road") requiring manual clarification.

### 2. Deterministic Status Determination
`evaluateNoticeApplicability(notice, userLocalityId, evaluationDate)` computes one of five statuses:
- **`APPLICABLE_ACTIVE`**: The current date falls within the effective window and the user's ward is authoritatively confirmed.
- **`FUTURE_EFFECTIVE`**: The notice is valid for the locality but effective dates have not yet commenced.
- **`TEMPORALLY_EXPIRED`**: The notice period has passed; preserved for search and audit records.
- **`NOT_APPLICABLE`**: The user's locality is outside the notice scope.
- **`UNCERTAIN_AMBIGUOUS`**: Geographic scope remains unresolved; presented with an advisory disclaimer.

### 3. Source Passage Provenance
Every matched notice attaches its supporting textual excerpt from the gazette or order (e.g., *Clause 3 - Affected Distribution Zones*), giving citizens full transparency into the source.

### 4. Vector Map with Absent-Geometry Fallback
- `generateNoticeCoverageMapLayers(notice)` outputs vector polygons or point markers when available.
- **Graceful Fallback**: If vector GIS data is absent, the service generates a structured tabular/list representation (`NO_GEOMETRY_AVAILABLE_TABULAR_ONLY`), ensuring full parity between map and non-map views.

### 5. Localized Alert Subscriptions & Privacy
- Citizens can subscribe to alerts for their locality without providing sensitive GPS device tracks (`subscribeToLocalityNotices`).
- Export records scrub citizen IDs (`sanitizeSubscriptionForExport`).

---

## Statutory Notice & Scope

> [!IMPORTANT]
> **Statutory Notice**: The Civic Notice Applicability Map indexes gazetted municipal orders, water utility notices, and traffic advisories. Temporal and geographic applicability is evaluated for citizen guidance and does not replace the official gazetted text of the order.

---

## Verification & Metrics
- **Unit Test Suite**: `src/services/civicNoticeApplicabilityMapService.test.js`
- **Results**: 19/19 tests passing.
- **Linting & Security**: 0 errors, 0 warnings across ESLint and `eslint.security.config.js`.
