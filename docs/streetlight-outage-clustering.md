# Streetlight Outage Clustering and Repair Prioritization Dashboard (#756)

## 1. Overview & Problem Statement
Civic Help Setu provides a dedicated, end-to-end maintenance workflow for municipal public lighting:
- **Citizen Fault Reporting**: Reporting by specific pole asset ID or approximate street landmark/coordinates.
- **Deterministic Deduplication & Spatial Clustering**: Clustering proximate dark poles ($\le 120\text{m}$) within an active 72-hour sliding window, merging duplicate reports, and calculating centroid and bounding corridors.
- **Explainable Prioritization**: Scoring dark corridors ($0-100$) based on outage persistence, density of dark poles, and public safety anchors (hospitals, schools, transit hubs, accident blackspots).
- **Technician Dispatch & Outcome Logging**: Full work order dispatch lifecycle, parts replacement tracking from the municipal catalog, and photographic evidence logging with tamper-evident audit trails.

---

## 2. Architecture & Service Boundary

Business rules live in the service layer (`src/services/`), strictly separate from React components:

- `src/services/streetlightConstants.js`: Enums, status transition state machines, error codes, and RBAC capabilities.
- `src/services/streetlightValidation.js`: Strict validation, string sanitization (anti-XSS), coordinate bounds checking, and file metadata guards.
- `src/services/streetlightAccessControl.js`: Least-privilege role-based access control (`public`, `citizen`, `operator`, `technician`, `reviewer`, `admin`) and ward jurisdiction scoping.
- `src/services/streetlightClusteringEngine.js`: Pure mathematical Haversine distance clustering, deduplication matching, and explainable prioritization algorithm.
- `src/services/streetlightMigrations.js`: Schema migrations (`schemaVersion: 1`), secondary index building, storage persistence, and rollback runner.
- `src/services/streetlightService.js`: Core trusted boundary for report submission, public tracking, work orders, repair events, and audit logging.

---

## 3. Normalized Data Models

1. **`StreetlightAsset` (`civic_streetlight_assets_v1`)**:
   `id`, `jurisdictionId`, `coordinates: { lat, lng }`, `street`, `landmark`, `poleType`, `luminaireType`, `wattage`, `operationalStatus`, `installationDate`, `lastInspectedAt`.
2. **`OutageReport` (`civic_streetlight_reports_v1`)**:
   `id`, `trackingToken`, `assetId`, `jurisdictionId`, `location: { lat, lng, addressText, landmark }`, `faultCategory`, `status`, `duplicateOfId`, `reporterCategory`, `reporterHash`, `idempotencyKey`, `reportedAt`.
3. **`OutageCluster` (`civic_streetlight_clusters_v1`)**:
   `id`, `jurisdictionId`, `corridorName`, `centroid: { lat, lng }`, `boundingBox`, `reportIds`, `assetIds`, `poleCount`, `status`, `priorityScore`, `priorityTier`, `assignedWorkOrderId`, `explainability`.
4. **`WorkOrder` (`civic_streetlight_work_orders_v1`)**:
   `id`, `clusterId`, `jurisdictionId`, `assignedTechnicianId`, `assignedTechnicianName`, `priority`, `targetSlaHours`, `scheduledDate`, `status`, `dispatchedAt`, `acknowledgedAt`, `onSiteAt`, `resolvedAt`, `reassignedAt`, `reassignReason`.
5. **`RepairEvent` (`civic_streetlight_repair_events_v1`)**:
   `id`, `workOrderId`, `clusterId`, `assetId`, `technicianId`, `resolutionAction`, `partsReplaced`, `technicianNotes`, `photoChecksum`, `completedAt`.
6. **`InspectionSchedule` (`civic_streetlight_inspection_schedules_v1`)**:
   `id`, `jurisdictionId`, `assetId`, `frequencyDays`, `assignedInspectorId`, `lastPatrolledAt`, `nextDueAt`, `status`.

---

## 4. Prioritization Ruleset & Explainability (v1.0.0)

Priority scores ($0 - 100$) are calculated deterministically:

$$\text{PriorityScore} = \min(100, \, S_{\text{duration}} + S_{\text{density}} + S_{\text{hazard}} + S_{\text{safety}})$$

- **Duration ($0-30\text{ pts}$)**: Persistent outage $> 48\text{h}$ yields 30 pts; $> 24\text{h}$ yields 20 pts; $> 8\text{h}$ yields 10 pts.
- **Density ($0-30\text{ pts}$)**: $\ge 4$ dark poles yield 30 pts (corridor blackout); $2-3$ poles yield 20 pts; 1 pole yields 10 pts.
- **Critical Hazard Override ($0-40\text{ pts}$)**: `exposed_wiring` automatically adds 40 pts and forces `CRITICAL` tier; `damaged_pole` adds 30 pts.
- **Public Safety Context ($0-25\text{ pts}$)**: Proximity to hospital ($25\text{ pts}$), transit hub ($20\text{ pts}$), or school/blackspot ($15\text{ pts}$).

### Human-in-the-Loop Override
Operators and reviewers can override the automated priority tier. An explicit `overrideReason` is mandatory, and the override event is immutably recorded in the tamper-evident audit log.

---

## 5. Security & Privacy Safeguards

- **Anonymization & Zero PII Exposure**: Citizen contact numbers are never stored in plain text in public records; public projections (`toPublicReportProjection`) strip all hashes, contact details, and private staff notes.
- **Anti-Enumeration**: Public lookup requires high-entropy tracking tokens (`TRK-STLT-XXXXXX`).
- **Abuse Prevention**: Public submissions are rate-limited (max 10 requests per 10-minute window per client).
- **Idempotency**: Submissions accept an `idempotencyKey` preventing duplicate cluster creation on network retries.

---

## 6. Testing & Verification

Run the targeted test suites:

```bash
# Domain Service, Clustering & State Machine Tests
npx vitest run src/services/streetlightService.test.js

# Role Scoping, RBAC & Privacy Protection Tests
npx vitest run src/services/streetlightAccessControl.test.js

# Storage Migrations, Rollback & Retention Policy Tests
npx vitest run src/services/streetlightMigrations.test.js

# Workspace UI, Modals, Accessibility & States Tests
npx vitest run src/pages/StreetlightOutageWorkspace.test.jsx
```
