# Citizen Consent Purpose Visualizer for Connected Civic Data

## Overview
Under the Digital Personal Data Protection Act, 2023 (DPDP Act, Section 6), citizens must be clearly informed of what specific personal data elements are requested by public service features, why they are needed (purpose), who processes them, how long they are retained, and how consent can be freely withdrawn at any time.

The `citizenConsentVisualizerService` (`src/services/citizenConsentVisualizerService.js`) introduces a transparent consent purpose visualizer, strict downstream processing gate, and auditable revocation engine. It provides citizens with granular control over optional processing, renders interactive data-flow graphs tracing citizen data to features and retention states, enforces zero-processing defaults, and issues downstream restriction directives upon withdrawal.

---

## Architectural Highlights

### 1. Granular Purpose-Specific Consent Catalogue
Models discrete civic facilitation purposes (`REGISTERED_CONSENT_PURPOSES`):
- **`SERVICE_ELIGIBILITY_MATCHING`**: Evaluates age, district, and income against scheme rules. Processed locally in-memory; ephemeral retention.
- **`OFFICE_VISIT_PREPARATION`**: Organizes counter visit paperwork and calendar reminders. Retained for 30 days post-visit in local encrypted storage.
- **`DOCUMENT_OCR_PRE_SCRUTINY`**: On-device extraction of certificate reference numbers and stamps. Purged immediately after parsing.
- **`STATUTORY_NOTICES_SMS_ALERTS`**: SMS and email updates on application milestones and statutory hearing schedules. Retained during application lifecycle (up to 180 days).
- **`ANONYMOUS_COMMUNITY_ANALYTICS`**: Aggregated performance and accessibility telemetry without identifiable tokens. Retained for 90 days.

---

### 2. Zero-Processing by Default & Downstream Gating
- All optional civic purposes initialize with status `UNSPECIFIED`.
- Downstream services invoke `verifyDownstreamProcessingAllowed(ownerId, purposeId)` before reading citizen profile or document fields.
- If consent is not explicitly granted (or if it has expired or been revoked), downstream processing is blocked deterministically.

---

### 3. Auditable Revocation & Cascade Restriction
When a citizen revokes consent via `revokePurposeConsent(ownerId, purposeId, justification)`:
- The grant status immediately transitions to `REVOKED`.
- An immutable event is logged to the `consentAuditTrail`.
- Downstream processing gates instantly block subsequent access.
- Returns actionable `restrictionDirectives` specifying:
  - Terminated processor (`terminatedProcessor`).
  - Purged field scopes (`purgeFieldScopes`).
  - Enforcement actions (`PURGE_IMMEDIATELY_FROM_MEMORY` or `RESTRICT_AND_FLAG_FOR_EXPIRY_CASCADE`).

---

### 4. Interactive Data-Flow Graph Model
`generateDataFlowGraph(ownerId)` models a directed multi-tier graph:
- **`CITIZEN_DATA_FIELD`**: Individual requested attributes (e.g. `age`, `districtName`, `documentPreviewBuffer`).
- **`PURPOSE_NODE`**: The registered civic processing objective with active grant status and lawful basis.
- **`PROCESSOR_NODE`**: Designated execution environment (e.g. `LOCAL_BROWSER_ENGINE`, `LOCAL_ENCRYPTED_VAULT`).
- **`RETENTION_NODE`**: Enforceable retention lifecycle rules.
- **Directed Edges**: Illustrate active transfers (`INCORPORATED_FOR_PURPOSE`, `DISPATCHES_TO`, `RETAINS_UNDER`).

---

### 5. Multi-Modal Accessibility
- `getAccessiblePurposeSummary(ownerId)` provides a screen-reader friendly table and linear text alternative.
- Highlights plain-language summaries, active grant states, retention periods, and revocation controls without requiring graph interaction.

---

### 6. Privacy & PII Protection
- `sanitizeConsentExportForAudit()` redacts personal citizen identifiers (`ownerId`, contact numbers) while preserving verifiable audit metadata for DPDP regulatory compliance.

---

## Verification & Testing
Comprehensive Vitest unit tests in `src/services/citizenConsentVisualizerService.test.js` verify:
1. Dossier initialization with all registered purposes and default `UNSPECIFIED` states.
2. Owner-only authorization rejecting unauthorized snooping.
3. Downstream gate enforcement (`verifyDownstreamProcessingAllowed`) blocking ungranted operations.
4. Explicit consent grant, denial, and auditable revocation workflows.
5. Downstream restriction and memory-purge directives upon revocation.
6. Directed data-flow graph node and edge generation.
7. Accessible tabular summary for screen-readers.
8. Append-only audit trail and privacy-safe export sanitization.
