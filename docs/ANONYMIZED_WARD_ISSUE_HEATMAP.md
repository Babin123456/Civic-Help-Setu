# Anonymized Ward-Level Civic Issue Heatmap & Trend Explorer (#763)

## 1. Overview & Problem Statement

Civic Help Setu provides an aggregate analytics view and trend explorer for understanding recurring municipal civic issues across municipal wards without exposing individual complainants, private notes, or exact residential GPS coordinates.

Urban local bodies, ward committees, and community stakeholders frequently need high-level visibility into recurring service failures (such as road cave-ins, water pipeline ruptures, uncollected garbage, or drainage waterlogging) to allocate budget and deploy proactive maintenance. However, releasing raw citizen reports risks complainant harassment, enumeration, and re-identification—particularly in low-density neighborhoods where a single report can easily be linked to a specific resident.

This module resolves that tension through **mathematically grounded privacy safeguards**:
- **k-Anonymity Small-Cell Suppression ($k \ge 5$)**: Any ward-category cohort with fewer than 5 events is suppressed (`< 5 (Suppressed)`) from public displays.
- **Coordinate Perturbation**: Exact latitude/longitude and house addresses are stripped at the service boundary; events are spatially snapped to municipal ward centroids.
- **Zero-PII Ingest Pipeline**: Submissions containing Aadhaar, PAN, phone numbers, or email addresses are rejected at the edge.
- **Explainable Versioned Interventions**: Automated recommendations detail the exact statistical drivers, input feature window, and ruleset version, requiring human-in-the-loop review by municipal engineers.

---

## 2. Architecture & Data Flow

```
+-----------------------------------------------------------------------------------+
|                                 CITIZEN / INTAKE                                  |
|   - Submits report with category, severity, and landmark location                 |
|   - Strict client & server validation: Zero PII (Aadhaar, PAN, phone, email)      |
+------------------------------------------+----------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------+
|                             SERVICE & STORAGE BOUNDARY                            |
|   - Strips exact coordinates -> Snaps to Ward Centroid                            |
|   - Hashes reporter identifier -> Salted Anonymous Seal (e.g. ANON-48A1)          |
|   - Idempotency deduplication -> Persists to civicbridge_ward_issue_events_v1     |
+------------------------------------------+----------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------+
|                       PRIVACY-PRESERVING AGGREGATION ENGINE                       |
|   - Evaluates counts against k-anonymity threshold (default k = 5)                |
|   - If count < 5: cell is suppressed, count hidden, uncertainty explained         |
|   - If count >= 5: publishes aggregate count, rate per 10k, and trend velocity   |
|   - Calculates velocity delta (rising, falling, stable) & anomaly scores          |
+------------------------------------------+----------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------+
|                                   USER VIEWS                                      |
|  [Public Citizen]            [Municipal Operator]         [Chief Administrator]   |
|  - Heatmap Grid              - Triage & State Transitions  - Trigger Aggregations |
|  - Accessible Table View     - Review Recommendations      - Modify k-Thresholds  |
|  - Multi-Ward Trends         - Action Interventions        - Inspect Audit Logs   |
|  - Suppressed Cohorts Guard                                - Export Open CSV      |
+-----------------------------------------------------------------------------------+
```

---

## 3. Data Model & Entity Contracts

### 3.1 `CivicIssueEvent`
Stored in `civicbridge_ward_issue_events_v1`:
| Field | Type | Description |
|---|---|---|
| `id` | `string` | Deterministic event identifier (e.g. `EVT-150-DRAI-1002`) |
| `wardId` | `string` | Municipal ward identifier (e.g. `ward-150`) |
| `wardName` | `string` | Municipal ward display name (e.g. `Bellandur`) |
| `zone` | `string` | Administrative zone (e.g. `Mahadevapura`) |
| `category` | `string` | Normalized category key (`potholes_road_damage`, `drainage_waterlogging`, etc.) |
| `severity` | `enum` | `'low'`, `'medium'`, `'high'`, `'critical'` |
| `status` | `enum` | `'reported'`, `'verified'`, `'in_progress'`, `'resolved'` |
| `coarseLocation` | `string` | General landmark or sector area (e.g. "Sector 3 Park Perimeter") |
| `approximateCoords` | `[number, number]` | Coarse ward centroid coordinates; never residential GPS |
| `reporterIdHash` | `string` | Salted cryptographic pseudonym (e.g. `ANON-7F2A`) |
| `schemaVersion` | `string` | Semantic contract version (`1.0.0`) |

### 3.2 `WardMetric` (Published Aggregate)
Published in `civicbridge_ward_metrics_v1`:
| Field | Type | Description |
|---|---|---|
| `metricId` | `string` | Composite key (`METRIC-{wardId}-{category}`) |
| `displayCount` | `string \| number` | Numeric count if $\ge k$, otherwise `"< 5 (Suppressed)"` |
| `ratePer10kPopulation` | `number \| null` | Standardized rate per 10,000 ward residents; `null` if suppressed |
| `suppressed` | `boolean` | `true` if small-cell privacy threshold is triggered |
| `trendDirection` | `enum` | `'rising'`, `'falling'`, `'stable'` |
| `percentChange` | `number` | Velocity change compared to preceding equivalent time window |
| `anomalyScore` | `number` | Normalized velocity outlier score ($0.0$ to $1.0$) |

### 3.3 `PrivacyRule`
Stored in `civicbridge_privacy_rules_v1`:
| Field | Type | Default | Description |
|---|---|---|---|
| `minCohortThreshold` | `number` | `5` | Minimum event count required for public display ($k$) |
| `differentialPrivacyEpsilon` | `number` | `1.0` | Laplace noise scale parameter for open data exports |
| `suppressSparseCells` | `boolean` | `true` | Enforces suppression of sub-threshold cells |
| `coordinatePerturbation` | `string` | `'ward_centroid_only'` | Restricts spatial resolution to ward boundaries |

---

## 4. State Machine & Lifecycle Transitions

### 4.1 Event Lifecycle Transitions
```
[reported] ---> [verified] ---> [in_progress] ---> [resolved]
     |              |
     +--------------+---> [resolved] (direct closure if duplicate or already cleared)
```
- Only authorized municipal operators and administrators can trigger transitions.
- Transitions record reason notes, operator username, and an immutable audit log entry.
- Direct transition from `reported` to `in_progress` is blocked (`InvalidStateTransitionError`).

### 4.2 Recommendation Review Lifecycle
```
[pending] ---> [accepted] ---> [implemented]
     |
     +-------> [rejected] ---> [pending] (can be reopened upon new telemetry)
```
- Human-in-the-loop: Recommendations generated by statistical spikes require human review before municipal action.
- Accepting an intervention allows optional scope editing.
- Rejecting requires an operational justification note (minimum 5 characters).

---

## 5. Security & Threat Model

| Threat | Safeguard Implemented |
|---|---|
| **Complainant Re-identification** | Small-cell suppression ($k \ge 5$) hides sparse events; public APIs whitelist only aggregate fields. |
| **Location Tracking / Prowling** | Private GPS coordinates and house numbers are stripped at the ingest boundary; coordinates are snapped to ward centroid. |
| **PII Data Leakage** | Client and server regex guards block phone numbers, Aadhaar, PAN, and email addresses. |
| **Replay & Duplicate Attacks** | Idempotency keys (`idempotencyKey`) and single-flight execution prevent duplicate report injection. |
| **Privilege Escalation** | Admin operations (triggering aggregation, updating privacy rules, reading audit logs) are strictly gated by role context. |
| **Denial of Service** | Serverless endpoints enforce rate limiting via `createRateLimiter` (20 req/min per IP). |

---

## 6. API Reference

### `GET /api/ward-issue-heatmap`
- **Query Parameters**:
  - `action`: `'summary'` (default), `'privacy-rules'`, `'trends'`, `'metrics'`
  - `timeWindow`: `'last_7_days'`, `'last_30_days'`, `'last_90_days'`, `'year_to_date'`
  - `wardId`: Municipal ward ID (e.g. `'ward-150'`)
- **Response**: Returns anonymized summary, k-anonymity guarantee, and trend series.

### `POST /api/ward-issue-heatmap`
- **Action: `'ingest'`**:
  ```json
  {
    "action": "ingest",
    "wardId": "ward-101",
    "category": "potholes_road_damage",
    "severity": "high",
    "idempotencyKey": "IDEM-1731718000"
  }
  ```
  Returns `201 Created` with anonymized receipt and ward centroid confirmation.
- **Action: `'review-recommendation'`**:
  Requires `x-user-role: operator` or `admin`.
  ```json
  {
    "action": "review-recommendation",
    "recommendationId": "REC-2026-001",
    "status": "accepted"
  }
  ```

---

## 7. Migration & Rollback Strategy

1. **Automatic Backup**: `migrateStorage()` creates an atomic snapshot in `civicbridge_ward_heatmap_migration_backup_v1` before modifying schema versions.
2. **Schema Stamping**: Upgrades events to `schemaVersion: '1.0.0'` and sets default `coarseLocation` where missing.
3. **Rollback**: Calling `rollbackStorage()` immediately restores previous event arrays and privacy parameters.

---

## 8. Verification Commands

Run targeted test suites:
```bash
# Unit & integration tests for service layer
npx vitest run src/services/wardIssueHeatmapService.test.js

# Component and accessibility tests for workspace UI
npx vitest run src/pages/WardIssueHeatmapWorkspace.test.jsx

# Service directory and routing integration tests
npx vitest run src/pages/ServiceDetails.test.jsx

# Serverless API endpoint tests
npx vitest run tests/ward-issue-heatmap.test.js
```

