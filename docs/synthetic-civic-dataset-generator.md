# Privacy-Safe Synthetic Civic Dataset Generator (#778)

## 1. Overview & Problem Statement

Civic Help Setu requires rich, relational, and multi-lingual datasets (services, applications, grievances, and administrative offices) to develop and test complex civic workflows—such as statutory cure window expirations, jurisdiction routing mismatches, multi-script transliteration errors, and offline conflict synchronization.

Copying real citizen submissions or production databases into development or testing environments violates the **Digital Personal Data Protection Act (DPDPA)** and statutory public service privacy guidelines.

This module introduces a dedicated, privacy-safe, deterministic synthetic civic dataset generator that generates realistic but completely artificial service, application, grievance, and office records so contributors can test workflows without touching citizen data.

---

## 2. Architectural Pillars & Core Invariants

1. **Zero-PII Guarantee by Construction**:
   - Generation uses procedural grammars and localized generative distributions.
   - Every generated record is tagged with an indelible cryptographic synthetic watermark (`isSynthetic: true`, `syntheticWatermark: "SYNTH-CIVIC-SETU-v1"`).
   - Dummy non-routable phone prefixes (`+91-99900-XXXXX`) are strictly enforced.
   - Scanned against Verhoeff Aadhaar checks, PAN regex patterns, active mobile numbers, and personal emails before certification.
2. **Deterministic Reproducibility**:
   - Powered by a 32-bit Mulberry32 Pseudo-Random Number Generator (PRNG).
   - Given the same numeric seed and scenario profile, the generator produces bit-for-bit identical datasets across all platforms and environments.
3. **Directed Acyclic Graph (DAG) for Referential Integrity**:
   - Topological generation order:
     $$\text{Administrative Offices} \longrightarrow \text{Civic Services} \longrightarrow \text{Citizen Applications} \longrightarrow \text{Public Grievances}$$
   - Guarantees 100% referential integrity with zero orphan references.
4. **Indic Demographic & Linguistic Synthesis**:
   - Multi-script support covering English, Devanagari (Marathi/Hindi), Tamil, Bengali, Telugu, and Kannada.
   - Pincodes strictly conform to real administrative postal circles for authentic testing.
5. **Markov Chain Status Timeline Generation**:
   - Models realistic statutory lifecycles:
     $$\text{Draft} \longrightarrow \text{Submitted} \longrightarrow \text{In Scrutiny} \longrightarrow \text{Query Deficiency} \longrightarrow \text{Approved / Rejected}$$
   - Includes stochastic delays, deficiency cure window timers, and appeal escalations.
6. **Ephemeral Storage & Retention Policy**:
   - Stored in isolated local storage keys (`civicbridge_synthetic_*`), completely separate from production or user vault stores.
   - Ephemeral 7-day retention with automatic background garbage collection (`purgeExpiredArtifacts()`).

---

## 3. Data Model & Storage Schema

The module implements 5 normalized entities:

| Entity / Collection | Storage Key | Description |
| :--- | :--- | :--- |
| `SyntheticProfile` | `civicbridge_synthetic_profiles_v1` | Testing scenario configurations, seeds, volume, and edge-case rates. |
| `GenerationJob` | `civicbridge_synthetic_jobs_v1` | Asynchronous generation job statuses, progress percentages, and error payloads. |
| `GeneratedArtifact` | `civicbridge_synthetic_artifacts_meta_v1` | Certified metadata, SHA-256 checksums, and k-anonymity scores. |
| `ArtifactPayload` | `civicbridge_synthetic_artifact_data_{id}` | Isolated JSON payload holding offices, services, applications, and grievances. |
| `ValidationRun` | `civicbridge_synthetic_validation_runs_v1` | Audit verification logs for zero-PII compliance and referential integrity scores. |

---

## 4. API & Service Layer

### 4.1 Serverless Endpoint (`api/synthetic-datasets.js`)

- **GET `/api/synthetic-datasets`**: Discovers schema catalog capabilities and operational limits.
- **POST `/api/synthetic-datasets`**: Server-side request validation with rate limiting (`abuseGuard.js`) and single-flight execution.

### 4.2 Standard Error Codes

| Error Code | HTTP Status | Description | Actionable Guidance |
| :--- | :---: | :--- | :--- |
| `ERR_SYNTH_INVALID_SEED` | `400` | Seed is not a valid 32-bit integer | "Provide an integer seed between 0 and 4294967295." |
| `ERR_SYNTH_PII_SUSPECT` | `422` | Generation produced data matching real PII patterns | "Execution halted: PII guard triggered. Seed quarantined." |
| `ERR_SYNTH_STORAGE_QUOTA` | `507` | Browser storage limit reached | "Browser storage limit reached. Please remove old synthetic artifacts." |
| `ERR_SYNTH_RATE_LIMIT` | `429` | Request rate limit exceeded | "Too many generation requests. Please wait 60 seconds." |

---

## 5. User Interface & Accessible Contributor Workflow

The workspace is reachable at `/synthetic-datasets` (alias: `/dataset-generator`):

1. **Preset Scenario Selection**:
   - *Ward Grievance Backlog Surge* (Monsoon waterlogging & delay breaches).
   - *RTS Statutory Compliance Audit* (SLA tracking, cure window timers, appeals).
   - *Multi-Lingual Welfare Pipeline* (Hindi/English bilingual stress test).
   - *Urban Water & Municipal Utility Disruptions* (Fast 24-48h turnaround emergencies).
   - *Custom Contributor Configurator* (Fine-tune seed, volume, and failure rates).
2. **Inspection Table**:
   - Accessible tabbed tables for Applications, Grievances, Services, and Offices.
   - Search filter, pagination, and status pills.
3. **One-Click Local Dev Loading**:
   - `LocalStorageLoaderModal` injects synthetic services directly into `civicbridge_custom_services`, enabling instant testing of service search and guides without manual entry.
4. **Data Exports**:
   - Download full dataset as formatted JSON, CSV (Applications / Grievances), or SQL insert statements.

---

## 6. Targeted Test Suite & Verification

Run the targeted test suite covering all synthetic generator components:

```bash
npx vitest run src/services/piiLeakageGuardService.test.js \
  src/services/syntheticGeneratorEngine.test.js \
  src/services/syntheticDatasetService.test.js \
  src/pages/SyntheticDatasetWorkspace.test.jsx \
  tests/api-synthetic-datasets.test.js
```

Verify production build and ESLint compliance:

```bash
npm run build
npx eslint src/data/synthetic* src/services/synthetic* src/services/pii* src/components/syntheticDataset/* src/pages/Synthetic* api/synthetic-datasets.js api/_lib/syntheticSchemaContract.js tests/api-synthetic-datasets.test.js
```
