# Architecture Decision Record (ADR): Cross-Portal Application Status Reconciliation Assistant (#1158)

## Status
Accepted

## Context & Problem Statement
Citizens frequently receive unsynchronized and contradictory status updates regarding government applications across multiple communication channels:
1. **Official Central & State Portals**: e.g., "Under Scrutiny", "Query Raised", "Disposed With Remarks".
2. **Automated SMS Gateways**: e.g., "Your application #MH-10293 has been approved and dispatched on 14-Oct".
3. **Physical / Counter Receipts**: e.g., "Received at Taluk Office counter on 10-Oct with sub-tracking ref 10293/A".
4. **Email / Messaging Updates**: Divergent tracking codes, timestamp inversions, or conflicting actions required.

Because these government IT systems run on decoupled architectures without standardized status taxonomies, citizens experience confusion, miss time-sensitive statutory cure windows (e.g., deficiency rectifications, appellate deadlines), or erroneously conclude their applications are stuck when they have already advanced or been rejected.

## Proposed Architecture & Decision

We implement a **privacy-first, deterministic, client-side Cross-Portal Application Status Reconciliation Assistant** integrated into Civic Help Setu's tracking subsystem.

### Key Architectural Tenets

1. **Voluntary Citizen Ingestion (Zero-Scrape Invariant)**:
   - Civic Help Setu **never** performs automated or unauthenticated scraping of government portals, and never asks for, stores, or processes login credentials, passwords, OTPs, or authentication cookies.
   - Citizens voluntarily import status evidence by pasting SMS alerts, portal status snippets, or manual counter receipt details.

2. **PII Minimization at Boundary**:
   - Every imported evidence text is automatically scrubbed using `minimizeForExternal()` and `redactPersonalData()` (from `src/utils/dataMinimization.js`) before storage or reconciliation processing.
   - Aadhaar numbers, PAN cards, phone numbers, email addresses, and secret tokens are sanitized to safe redaction markers (`[REDACTED_AADHAAR]`, `[REDACTED_PHONE]`, etc.).

3. **Deterministic Canonical Vocabulary Normalization**:
   - Rather than relying on non-deterministic LLM prompts for classification, reconciliation relies on a structured, rule-based vocabulary normalizer (`statusVocabularyNormalizer.js`) covering common Indian national and state portal nomenclatures (Sarathi, Vahan, DigiLocker, Umang, e-District, Jeevan Pramaan, MeeSeva, Seva Sindhu, etc.).
   - Standard statuses map into: `SUBMITTED`, `UNDER_REVIEW`, `ACTION_REQUIRED`, `APPROVED`, `REJECTED`, `DISPATCHED`, `COMPLETED`.

4. **Deterministic Anomaly & Conflict Detection**:
   - Evaluates multi-channel evidence to flag:
     - **Reference Mismatches**: Differing prefix/suffix formats, partial token alignment.
     - **Temporal / Sequence Inversions**: Backward status progression (e.g., "In Progress" timestamped after "Approved").
     - **Contradictory Terminal States**: Simultaneously "Rejected" on portal and "Dispatched" via SMS.
     - **SLA Stalls**: Elapsed duration exceeding standard statutory service guarantee without progress.

5. **Transparent Provenance & Weighted Confidence**:
   - Each evidence item maintains channel provenance and reliability weights (e.g., Official Portal Export = 0.9, Official SMS = 0.8, Physical Receipt = 0.85, User Note = 0.5).
   - Provides a clear consensus status alongside an explainable confidence percentage (0-100%).
   - Generates actionable, non-binding next steps (e.g., visit counter with specific receipt ref, cure document deficiency, file clarification).

6. **Tamper-Evident Local Storage**:
   - Follows Civic Help Setu's established privacy architecture (`privacyIntegrityService.js`), sealing stored evidence records with CSPRNG identifiers and canonical SHA-256 snapshot seals.

7. **AI as Untrusted Proposer**:
   - If AI/NLP is optionally used to suggest structure from unstructured text snippets, all outputs are treated strictly as untrusted draft proposals requiring user review and deterministic schema validation before ingestion.
   - Civic Help Setu makes **no claims of official government authority** and does not issue binding determinations.

---

## Component Boundaries & Data Flow

```
+-----------------------------------------------------------------------------------+
|                           Civic Help Setu Client                                  |
|                                                                                   |
|  [Citizen] --> [StatusReconciliationModal / Track.jsx]                            |
|                          |                                                        |
|                          v                                                        |
|              [PII / Secret Sanitizer] (dataMinimization.js)                       |
|                          |                                                        |
|                          v                                                        |
|           [statusVocabularyNormalizer.js] <---> Canonical Status Taxonomy         |
|                          |                                                        |
|                          v                                                        |
|           [statusReconciliationEngine.js]                                         |
|              - Anomaly Detector (Temporal, Reference, Terminal)                   |
|              - Confidence & Consensus Scorer                                      |
|              - Actionable Next-Step Generator                                     |
|                          |                                                        |
|                          +-----------------------+                                |
|                          v                       v                                |
|             [statusEvidenceStorage.js]    [ReconciliationConflictBanner.jsx]      |
|              - CSPRNG IDs                  - Conflict Badges & Resolution Cues    |
|              - SHA-256 Tamper Seal         - Timeline Diff View                   |
|              - localStorage Cache                                                 |
+-----------------------------------------------------------------------------------+
```

---

## Threat Model (STRIDE Assessment)

| Threat Category | Potential Vector | Mitigation in Implementation |
|:---|:---|:---|
| **Spoofing** | Adversary crafts synthetic SMS or forged status snippet to trick citizen into thinking application is closed. | Assistant marks evidence with explicit user-reported provenance tags; consensus algorithm requires cross-channel agreement and highlights unverified single-source claims with lowered confidence. |
| **Tampering** | Malware or browser extension modifies local evidence records in `localStorage`. | Cryptographic SHA-256 checksum seal computed across canonical JSON snapshot; tampered records trigger `status: "TAMPERED"` fail-closed state. |
| **Repudiation** | User disputes whether advice originated from government vs. assistant. | Statutory disclaimer embedded in UI: *"Civic Help Setu is an independent civic utility and does not represent official government departments or issue legally binding decisions."* |
| **Information Disclosure** | User pastes SMS containing Aadhaar, PAN, phone number, or tracking secret; data gets stored in plaintext or logged. | Strict PII minimization regex runs before persistence; diagnostics logger (`logDiagnostic`) enforces allowlisted schema and drops payload bodies. |
| **Denial of Service** | Extremely large pasted text or malicious payload causing browser hang. | String length limits (max 4,000 characters per evidence item), bounded array processing (max 50 evidence items per application), and deterministic time complexity $O(N^2)$ with $N \le 50$. |
| **Elevation of Privilege** | Phishing attack attempting to harvest government portal credentials. | Zero credential input fields; input validation rejects strings matching password, OTP, bearer token, or private key patterns. |

---

## Performance & Cost Limits

- **Execution Latency**: Benchmarked at $\le 2\text{ms}$ per full reconciliation cycle. Deterministic algorithms run synchronously in the main UI thread without perceptible frame drops.
- **Computational Complexity**: Anomaly detection runs in $O(N^2)$ bounded time, where $N \le 50$ (maximum permitted evidence items per application).
- **Storage Quota Limits**: Each evidence item is capped at 4,000 characters. With a maximum limit of 50 items per application, peak storage consumption is $\le 200\text{KB}$, which is well within the 5MB browser `localStorage` boundary.
- **Financial / Operational Cost**: \$0.00 marginal operating cost per citizen lookup. The client-side architecture incurs zero cloud API tokens, zero backend serverless invocations, and zero database read/write costs.

---

## Accessibility Requirements (WCAG 2.1 AA Compliance)

- **Semantic ARIA Roles**:
  - Modal container: `role="dialog"`, `aria-modal="true"`, and `aria-labelledby="reconciliation-modal-title"`.
  - Discrepancy alerts: `role="alert"` with live polite announcements for screen readers.
  - Reconciliation summary banner: `role="region"` with distinct descriptive labels.
- **Keyboard Navigation & Focus Management**:
  - Full keyboard accessibility with tab order traversing form inputs, action buttons, and removal controls.
  - Native `Escape` key listener closes the modal cleanly.
- **Color Contrast & Perception**:
  - All status badge text combinations exceed the WCAG AA minimum 4.5:1 contrast ratio against their respective light and dark backgrounds.
  - Conflict severity indicators pair color coding (Red/Amber/Blue) with explicit textual labels (`[HIGH]`, `[MEDIUM]`, `[LOW]`) so information is never conveyed by color alone.

---

## Data Retention & Privacy Policy

- **Storage Location**: Client-side browser `localStorage` under key `civicbridge_status_reconciliation_v1`.
- **Zero Remote Retention**: No citizen evidence, application reference IDs, timestamps, or scrubbed snippets are transmitted to external servers, analytical pipelines, or cloud logs.
- **Citizen Data Lifecycle**:
  - Self-service individual deletion: Citizens can delete individual evidence items at any time.
  - Single-click global purge: "Purge All Evidence" wipes all stored records for that application immediately.
  - Browser clearing: Clearing website cookies/site data completely removes all traces.

---

## Model, Dataset, and External-Service Licences

- **Model Licences**:
  - Civic Help Setu's reconciliation assistant deliberately uses **deterministic business rule engines** (`statusVocabularyNormalizer.js`) instead of proprietary cloud LLMs. This guarantees zero recurring licensing fees, zero vendor lock-in, and zero data leakage.
  - If optional local browser SLMs (e.g. WebLLM / Gemma Nano) are integrated in future versions for automated SMS parsing, they must use permissive open-weight licenses (such as Apache 2.0 or Gemma Terms of Use) and execute 100% locally on the device.
- **Dataset Licences**:
  - All test fixtures and evaluation scenarios in `tests/reconciliation-synthetic-bench.test.js` are 100% synthetic, fabricated by the maintainers, and distributed under the project's **MIT License**.
  - No copyrighted, proprietary, or actual citizen records or official department datasets are included or required.
- **External-Service Licences & Dependencies**:
  - Zero paid or proprietary external APIs are consumed.
  - Component dependencies rely exclusively on standard open-source libraries: `lucide-react` (ISC License) and `vitest` (MIT License).

---

## Maintainer Operations & Extensibility Runbook

1. **Adding New State Portal Phrases**:
   - Open `src/services/statusVocabularyNormalizer.js`.
   - Add new regex patterns to the appropriate canonical status in `VOCABULARY_RULES`.
   - Run `npx vitest run src/services/statusVocabularyNormalizer.test.js` to verify regression safety.

2. **Adjusting Provenance Weights**:
   - Edit `SOURCE_TYPE_WEIGHTS` in `src/services/statusVocabularyNormalizer.js` to calibrate channel trust based on regional delivery reliability.

3. **Schema Migrations**:
   - The current schema is marked `version: 1`.
   - When evolving the schema (e.g., adding multi-party cryptographic attestation), add a migration transformer in `statusEvidenceStorage.js` to inspect `record.version` and automatically upgrade stored structures on read.

4. **Running Continuous Evaluation**:
   - Execute `npm run test:reconciliation` before merging any changes to the tracking or reconciliation subsystem.
