# Accessible Pedestrian Route & Barrier Map for Public Infrastructure (#757)

## 1. Overview & Statutory Framework
The **Accessible Pedestrian Route & Barrier Map** introduces a dedicated municipal infrastructure navigation and defect auditing capability to Civic Help Setu. It enables pedestrians, wheelchair users, parents with strollers, and citizens with low vision or mobility challenges to plan safe, accessible journeys through urban corridors, report newly observed street barriers, and monitor municipal defect rectifications.

> **Statutory Basis:**
> Built in compliance with **Sections 40 and 44 of the Rights of Persons with Disabilities (RPwD) Act, 2016** and the **Harmonised Guidelines and Standards for Universal Accessibility in India (2021)** issued by the Ministry of Housing and Urban Affairs (MoHUA).

---

## 2. Normalized Domain Entities & Schemas
Defined in `src/data/pedestrianBarrierContract.js`:

- **PedestrianSegment (`PedestrianSegment`)**: Physical walkway link between two urban nodes (`startNodeId`, `endNodeId`, `corridorName`, `ward`, `lengthMeters`, `widthMeters`, `gradientPct`, `surfaceType`, `curbRampStatus`, `tactilePaving`, `sidewalkType`, `lighting`, `hasStairsOrSteps`, `verificationStatus`, `lastInspectedAt`, `schemaVersion`).
- **CrossingAsset (`CrossingAsset`)**: Road crossing infrastructure (`crossingType`, `curbCutBothSides`, `tactileBlisterWarning`, `audiblePedestrianSignal`, `refugeIsland`, `condition`).
- **BarrierObservation (`BarrierObservation`)**: Physical defect report (`segmentId`, `barrierType`, `severity`, `ward`, `description`, `confidenceScore`, `photoUrl`, `status`, `reportedAt`, `reportedBy`).
- **TemporaryObstruction (`TemporaryObstruction`)**: Time-bounded roadworks, trench excavation, or seasonal construction (`obstructionType`, `startsAt`, `expiresAt`, `status`).
- **VerificationEvent (`VerificationEvent`)**: Immutable audit log of official inspection decisions (`observationId`, `action`, `reviewerId`, `reviewerRole`, `reasonCode`, `notes`, `timestamp`).
- **RoutePreference (`RoutePreference`)**: Functional mobility constraints chosen locally without requiring medical diagnosis (`avoidStairsAndSteps`, `requireCurbRamps`, `maxGradientPct`, `requireTactilePaving`, `requireAudibleSignals`, `avoidUnpavedSurfaces`, `maxDetourFactor`).
- **RouteResult (`RouteResult`)**: Evaluated route (`routeId`, `originNodeId`, `destinationNodeId`, `segments`, `totalDistanceMeters`, `accessibleDistanceRatio`, `overallAccessibilityRating`, `identifiedBarriers`, `scoringProvenance`, `isDeterministicFallback`).

---

## 3. Barrier Lifecycle State Machine

```
              [Reported by Citizen]
                       │
       ┌───────────────┴───────────────┐
       ▼                               ▼
[Under Field Review]            [Rejected / Invalid]
       │                               │
       ├───────────────────────────────┘ (Re-opened on appeal)
       ▼
[Verified Official Defect]
       │ (Civil works completed / defect rectified)
       ▼
[Resolved & Cleared]
```

* **Strict Role Gating:** Transitions to `verified`, `rejected`, or `resolved` require authenticated staff roles (`operator`, `reviewer`, `admin`). Citizen role submissions are restricted to `reported`.
* **State Machine Invariants:** Invalid transitions are rejected at both service and API boundaries with `ERR_INVALID_TRANSITION`.

---

## 4. Intelligent Routing Engine & Explainability Provenance

1. **Multi-Constraint Dynamic Graph Scoring:**
   - Adjacency graph constructed from verified pedestrian segments and crossings.
   - Dynamic edge cost equation:
     $$\text{Cost} = \text{Length} \times \text{SurfacePenalty} \times \text{GradientPenalty} \times \text{BarrierPenalty}$$
   - When constraints like `requireCurbRamps` or `avoidStairsAndSteps` are active, non-compliant segments receive infinite penalty ($+\infty$) to prune them from the primary candidate graph.
2. **Verification Integrity Guard:**
   - **Mandatory Invariant:** No route may be described as `fully_accessible` unless **100% of traversed segments have verified municipal audit status and current inspection data (within 30 days)**.
   - Routes traversing unverified citizen reports or segments older than 30 days are automatically downgraded to `partially_accessible` with an explicit notice.
3. **Scoring Provenance & Factor Attribution:**
   - Every route calculation outputs:
     - `rulesetVersion`: e.g. `v1.2.0-accessible-dijkstra-multi-constraint`
     - `executionTimestamp`
     - `influencingFactors`: Natural-language explanation of avoided barriers, traversed corridors, and applied constraint multipliers.
4. **Deterministic Fallback:**
   - If severe disconnects block a completely accessible path, a deterministic relaxed fallback computes the best physical path with explicit impassability warnings and sets `isDeterministicFallback: true`.

---

## 5. Privacy, Security & Anti-Abuse Controls

1. **Zero Health or Disability Data Collection:**
   - Route preferences are strictly functional physical parameters (e.g. slope %, steps avoidance, tactile pavers). No medical diagnosis or disability status is ever solicited or stored.
   - Route preferences are stored locally in browser storage (`localStorage`) and never linked to user identity.
2. **Automated Anti-PII Regex Screening:**
   - Both client and server reject submissions containing Indian phone numbers (`+91`), 12-digit Aadhaar patterns, PAN formats, or emails with error code `ERR_PII_DETECTED`.
3. **Public View Masking:**
   - Public APIs scrub internal reviewer notes, submitter IP addresses, and personal contact details, returning masked citizen identifiers (e.g. `Citizen Contributor (Ward 150)`).
4. **Rate Limiting & Abuse Prevention:**
   - `abuseGuard` enforces a 12 req/min limit on public report submissions with single-flight deduplication.
5. **Cryptographic Audit Seal:**
   - Verification events and reports generate deterministic seals (`SEAL-BARRIER-XXXX-XXXX`) for tamper evidence.

---

## 6. Accessibility & Multi-Modal Presentation (WCAG 2.1 AA)

- **Accessible Table Alternative:** In addition to the interactive SVG vector map, the workspace provides a complete semantic HTML `<table>` alternative for turn-by-turn route segments and barrier registers.
- **Non-Color Indicators:** Barrier severity and corridor compliance are indicated with distinct typography, textual badges, and icon glyphs alongside colors (never relying on color alone).
- **All 6 UI Domain States Handled:**
  1. *Loading*: Accessible skeleton with `aria-busy="true"`.
  2. *Empty*: Friendly actionable message when no data matches filters.
  3. *Stale Data*: Recency warning when segment inspection exceeds 30 days.
  4. *Offline*: Non-blocking banner indicating local queued mutations with "Sync Queue" control.
  5. *Permission Denied*: Role escalation notice when unauthorized citizens access reviewer queues.
  6. *Recoverable Error*: Alert box with retry trigger.

---

## 7. Migration, Indexes & Retention Strategy

- **Schema Versioning:** Managed under `SCHEMA_VERSION = '1.0.0'`.
- **Database Indexing Strategy (Firestore / Relational):**
  - Composite Index: `(ward, status, reportedAt DESC)` for filtered queries.
  - Spatial Index: Coordinates `(lat, lng)` for bounding-box corridor retrieval.
  - Reference Index: `segmentId` on `barrier_observations`.
- **Retention & Archival Rules:**
  - Resolved barriers remain public for 180 days before moving to municipal cold-storage archival.
  - Temporary obstructions are automatically expired once `expiresAt < now`.
  - Audit event logs are append-only and permanently retained for statutory compliance.

---

## 8. Targeted Test Suites

Run the dedicated test suites:

```bash
# 1. Domain service & graph routing engine tests
npx vitest run src/services/pedestrianBarrierService.test.js

# 2. Schema migration, index manifest & rollback tests
npx vitest run src/services/pedestrianBarrierMigrations.test.js

# 3. Serverless API handler & validation tests
npx vitest run tests/pedestrian-barriers.test.js

# 4. Security, injection, enumeration & replay defense tests
npx vitest run tests/pedestrian-barriers-security.test.js

# 5. Workspace component & accessibility tests
npx vitest run src/pages/AccessibleRouteBarrierWorkspace.test.jsx
```
