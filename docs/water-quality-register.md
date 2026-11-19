# Community Water-Quality Sampling and Laboratory Result Register (#754)

## 1. Overview & Problem Statement
The **Community Water-Quality Sampling and Laboratory Result Register** provides a dedicated public-facing surveillance record of community drinking water points (municipal standposts, community RO purification kiosks, public handpumps, protected dug wells, and tanker hydrants) and verified laboratory test results.

> **Statutory Notice:** Water quality evaluation is governed by **Bureau of Indian Standards IS 10500:2012** (Drinking Water — Specification, Second Revision, Reaffirmed 2021). All automated evaluations on this platform are deterministic comparisons against official statutory thresholds. The platform **does not provide AI-generated clinical or medical diagnoses**; out-of-range alerts indicate physical, chemical, or bacteriological non-compliance and trigger municipal public health remedial workflows.

---

## 2. Domain Entities & Normalized Data Model
All structures adhere to strict schema contracts defined in `src/data/waterQualityContract.js`:

- **WaterPoint (`WaterPoint`)**: Represents a physical community water extraction or distribution installation:
  - `id`: Unique identifier (e.g., `WP-BLR-W150-01`)
  - `name`: Official or community title
  - `pointType`: `public_standpost`, `community_ro_plant`, `handpump`, `open_well`, `tanker_filling_point`, `school_anganwadi_tap`
  - `ward`, `zone`, `city`, `landmark` (with exact private residential address masking)
  - `operationalStatus`: `active`, `maintenance_needed`, `isolated_unsafe`, `decommissioned`
  - `sourceType`: e.g. "Municipal Piped Cauvery Supply", "Deep Borewell Aquifer"
  - `overallComplianceStatus`: `compliant`, `warning`, `exceeded`, `critical_hazard`, `pending`
- **SamplingEvent (`SamplingEvent`)**: Captures physical collection event metadata:
  - `id`: e.g. `SMP-2026-BLR-001`
  - `waterPointId`: Reference to parent `WaterPoint`
  - `collectionDate`: ISO-8601 collection timestamp
  - `sampleType`: `routine_surveillance`, `citizen_complaint`, `post_monsoon`, `outbreak_alert`
  - `sealedContainerCode`: Unique bar-code/seal ID for tamper detection
  - `chainOfCustodyStatus`: `collected`, `in_transit`, `received_by_lab`, `testing_in_progress`, `completed`
  - `testedLabId`: Reference to certified testing laboratory
  - `cryptographicSeal`: SHA-256 derived verification seal (`SEAL-WQR-xxxx-xxxx`)
- **TestParameter (`TestParameter`)**: Standard chemical, physical, and bacteriological measures under IS 10500:2012:
  - `ph` (6.5 - 8.5)
  - `tds` (Desirable: 500 mg/L, Permissible: 2000 mg/L)
  - `turbidity` (Desirable: 1.0 NTU, Permissible: 5.0 NTU)
  - `total_hardness` (Desirable: 200 mg/L, Permissible: 600 mg/L)
  - `total_alkalinity` (Desirable: 200 mg/L, Permissible: 600 mg/L)
  - `chloride` (Desirable: 250 mg/L, Permissible: 1000 mg/L)
  - `sulphate` (Desirable: 200 mg/L, Permissible: 400 mg/L)
  - `nitrate` (Max 45 mg/L, No relaxation)
  - `fluoride` (Desirable: 1.0 mg/L, Permissible: 1.5 mg/L)
  - `free_residual_chlorine` (Min 0.2 mg/L, Max 1.0 mg/L)
  - `iron` (Max 1.0 mg/L, No relaxation)
  - `arsenic` (Desirable: 0.01 mg/L, Permissible: 0.05 mg/L)
  - `lead` (Max 0.01 mg/L, No relaxation)
  - `total_coliform` (Zero tolerance in 100 mL sample)
  - `e_coli` (Zero tolerance in 100 mL sample)
- **LabResult (`LabResult`)**: Individual parameter measurement:
  - `testedValue`: Measured quantity
  - `status`: `verified_compliant`, `flagged_out_of_range`, `superseded`
  - `supersededByResultId`: Pointer to replacement result if a correction was published
- **CorrectiveAction (`CorrectiveAction`)**: Municipal intervention triggered by contamination or out-of-range readings:
  - `actionType`: `chlorination_shock`, `pipeline_repair`, `source_isolation`, `filter_replacement`, `public_boil_advisory`
  - `status`: `initiated`, `in_progress`, `field_verified`, `closed`

---

## 3. Bounded Intelligence & Rule-Based Compliance
In strict adherence to Issue #754:
1. **No Opaque AI**:
   - No Large Language Model or neural classifier is used for medical assessment or civic denial.
2. **Deterministic Rules Engine (`src/services/waterQualityRulesEngine.js`)**:
   - Direct, auditable comparison against IS 10500:2012 threshold boundaries.
3. **Explainability & Provenance**:
   - Every automated evaluation records:
     - `rulesetVersion`: e.g. `v1.0.0-IS10500-2012-R2021`
     - `standard`: `IS 10500:2012 (Reaffirmed 2021)`
     - `executionTimestamp`
     - `influencingParameters`: Exceeded parameters with delta percentage.
4. **Mandatory Human-in-the-Loop**:
   - All out-of-range parameter flags and remedial sanction actions require explicit review and authorization by an authorized municipal health official.

---

## 4. Privacy, Security & Anti-Abuse Safeguards
1. **Zero Public PII**:
   - Client and server-side validation strips Aadhaar numbers (12-digit regex), PAN, mobile numbers, and personal emails.
   - Exact residential house or flat numbers are scrubbed; only public water point landmarks, ward titles, and municipal jurisdictions are published.
2. **Result Immutability & Supersession**:
   - Historical lab test results cannot be silently deleted or mutated.
   - Any official correction creates a new result version, marks previous results with `status: 'superseded'`, links `supersededByResultId`, and appends an immutable audit event with mandatory justification.
3. **Cryptographic Verification Seals**:
   - Every published test result generates a deterministic hash seal (`SEAL-WQR-xxxx-xxxx`) binding sample event, laboratory ID, collection date, and testing timestamp.
4. **Rate Limiting & Abuse Prevention**:
   - Serverless route (`api/water-quality-register`) implements fixed-window rate limiting (10 req/min) and single-flight duplicate suppression.

---

## 5. Schema Migrations & Rollback Strategy
The module includes a forward migration and rollback engine (`src/services/waterQualityMigrations.js`):
- `runMigrations(store)`: Inspects `schemaVersion` and sequentially executes upgrade transformers.
- `rollbackMigration(store)`: Safely restores prior schema version if an upgrade encounters corruption.
- Persistent stores are keyed under `civicbridge_water_quality_v1`.

---

## 6. Verification & Test Commands
Run the targeted test suite:
```bash
npx vitest run src/services/waterQualityValidation.test.js
npx vitest run src/services/waterQualityRulesEngine.test.js
npx vitest run src/services/waterQualityMigrations.test.js
npx vitest run src/services/waterQualityService.test.js
npx vitest run tests/water-quality-register.test.js
npx vitest run src/pages/WaterQualityRegister.test.jsx
```
