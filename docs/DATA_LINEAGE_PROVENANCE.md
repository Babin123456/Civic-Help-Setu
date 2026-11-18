# Data Lineage and Provenance Explorer for Civic Knowledge Records (#777)

## 1. Problem Statement & Citizen Context
Civic Help Setu provides critical service delivery guides, document checklists, fee requirements, and statutory SLAs to citizens across India. However, public policies, municipal fee schedules, and administrative circulars change frequently. Without end-to-end provenance:
1. **Source Disconnect**: Citizens and civil society observers cannot easily verify whether a fee, document rule, or processing time originates from an official gazette notification, a municipal circular, or an unverified summary.
2. **Untracked Parser & Model Transformations**: Automated extraction from state portals, HTML tables, and PDFs can introduce regressions or parsing drift if parser and ruleset versions are not logged.
3. **Unrecorded Human Overrides & Editorial Discretion**: Administrative changes and manual amendments lack transparent, append-only justification logs.
4. **Supersession Opacity**: Citizens often rely on outdated rules when newer gazette notifications have superseded or amended prior statutory orders.

---

## 2. Ethical Invariants & System Guardrails

### Invariant 1: Strict Anti-Hallucination & DAG Invariant
- **No Hallucinated Edges**: Automated lineage summarizers and AI explainers traverse existing Directed Acyclic Graph (DAG) edges only. If an edge does not exist, the fact is explicitly reported as `unverified_unlinked`.
- **Topological Acyclicity**: Every edge insertion is verified via Depth-First Search (`detectCycles()`). Any cyclic relationship (e.g. A ➔ B ➔ C ➔ A) is strictly rejected with `ERR_PROVENANCE_CYCLE_DETECTED`.

### Invariant 2: Mandatory Authoritative Sourcing & Zero PII
- **HTTPS Enforced**: All source URLs must strictly use `https://`.
- **Zero PII**: Citizen submissions and provenance feedback must contain zero Aadhaar, PAN, phone numbers, passwords, or tokens. Regex validators on both client and server enforce this constraint.

### Invariant 3: Explainability & Traceability Audit Stamp
Every automated lineage explanation records:
- `rulesetVersion` (e.g. `lineage_explainer_ruleset@1.2.0`)
- `executionTimestamp` (ISO 8601)
- `inputFeatureWindow` (exact text span from snapshot)
- Composite confidence score (minimum confidence along the causal path)

### Invariant 4: Dual-View Accessibility (WCAG AAA)
Whenever an interactive graph visualization is provided, an accessible structured table alternative (`LineageTableView`) is available with full keyboard navigation, screen reader announcements, and high contrast styling.

---

## 3. Data Model & Normalized Collections

Defined in `src/data/provenanceContract.js` and stored via `src/services/provenanceStorage.js`:

1. **`knowledge_sources` (`civicbridge_knowledge_sources_v1`)**:
   - `id`: Unique stable identifier (e.g., `src_delhi_tree_preservation_act_1994`).
   - `name`: Official title of statutory act, circular, or gazette.
   - `publisher`: Responsible government authority or department.
   - `jurisdiction`: `{ level, state, district, localBody }`.
   - `sourceUrl`: Verified official HTTPS URL.
   - `sourceType`: `gazette_notification`, `statutory_act`, `municipal_order`, `official_portal`.
   - `status`: `active`, `under_review`, `flagged`, `superseded`, `unreachable`, `deprecated`.

2. **`source_snapshots` (`civicbridge_source_snapshots_v1`)**:
   - `id`: Snapshot reference (e.g., `snap_tree_act_1994_s9`).
   - `sourceId`: Foreign key to `knowledge_sources`.
   - `retrievalTimestamp`: Ingestion timestamp.
   - `effectiveDate`: Legal enactment date.
   - `contentHash`: Cryptographic fingerprint (SHA-256).
   - `rawTextSnippet`: PII-sanitized statutory excerpt.

3. **`transformation_runs` (`civicbridge_transformation_runs_v1`)**:
   - `id`, `snapshotId`, `parserVersion`, `rulesetVersion`, `transformationType`, `status`, `metrics`.

4. **`provenance_edges` (`civicbridge_provenance_edges_v1`)**:
   - `id`, `sourceEntityId`, `targetEntityId`, `targetField`, `edgeType`, `confidenceScore`, `metadata`.

5. **`editorial_reviews` (`civicbridge_editorial_reviews_v1`)**:
   - `id`, `targetEntityId`, `reviewerRole`, `reviewDecision`, `isOverride`, `overrideReason`, `publicNotes`, `privateNotes`.

6. **`supersession_links` (`civicbridge_supersession_links_v1`)**:
   - `id`, `predecessorId`, `successorId`, `supersededAt`, `supersessionType`, `reason`.

---

## 4. API Endpoints

- **Route**: `/api/knowledge-provenance` (via `api/[...path].js`)
- **GET**: Query provenance feedback queue with pagination and filtering.
- **POST**: Submit provenance corrections or verified official sources.
  - Rate limited to 10 requests / minute via `abuseGuard.js`.
  - Generates deterministic verification seal: `PROV-SEAL-XXXX-YYYY`.
  - Rejects PII payloads with status `400 Bad Request`.

---

## 5. Storage Retention & Migration Rollback

- All provenance operational keys are registered in `RETAINED_STORAGE_KEYS` in `src/services/privacyConsentService.js`.
- **Rollback Procedure**: In the event of schema migration or data corruption, `initializeProvenanceStorage(true)` resets stores to grounded immutable seed data (`SEED_KNOWLEDGE_SOURCES`, `SEED_PROVENANCE_EDGES`).

