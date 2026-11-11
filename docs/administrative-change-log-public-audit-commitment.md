# Privacy-Preserving Public Audit Commitment for Administrative Change Logs

## Overview
Administrative change logs tracking modifications to service fee schedules, statutory SLA timelines, official portal URLs, and entitlement criteria require public accountability and tamper resistance. However, publishing full internal records or database state on a public blockchain introduces severe privacy risks and regulatory non-compliance.

The `administrativeAuditCommitmentService` (`src/services/administrativeAuditCommitmentService.js`) introduces a hybrid commitment architecture: full operational records remain securely stored in the protected database, while periodically batched cryptographic Merkle roots are anchored into an immutable public registry.

## Architectural Capabilities

### 1. Canonical Event Schema & PII Exclusion
Administrative events are modeled with strict schemas:
- `recordId`: Identifier of the administrative record (e.g. `service_fee_guide_birth_certificate`).
- `action`: Specific administrative change (`FEE_SCHEDULE_UPDATE`, `STATUTORY_TIMELINE_CHANGE`, etc.).
- `role`: Role of the authorized actor (`SUPER_ADMIN`, `COMPLIANCE_OFFICER`).
- `timestamp`: ISO-8601 UTC timestamp.
- `sourceVersion`: Semantic version of the change package.
- `payloadHash`: SHA-256 digest of the sanitized change delta.
- **Strict PII Prohibition**: The service enforces zero citizen names, phone numbers, Aadhaar numbers, session tokens, or free-form user notes in canonical records, throwing an exception if detected.

### 2. Merkle Root Generation & Independent Audit Verification
- Multiple canonical events are hashed and batched into a deterministic Merkle Tree.
- Only the 32-byte Merkle root is anchored publicly.
- `generateEventAuditProof()` generates self-contained audit paths ($O(\log N)$ size).
- External auditors can verify any disclosed event against the published root using `verifyDisclosedEventAgainstRoot()` without accessing un-disclosed peer events.

### 3. Resilience & Continuity Preservation
- If the public anchoring network fails, local audit continuity is **never destroyed**.
- Batches are registered under `FALLBACK_LOCAL_CONTINUITY` in an append-only local ledger with retry scheduling.

### 4. Key Rotation & Migration Management
- Supports structured key rotation via `rotateAnchoringKey()`, tracking epoch transitions and key IDs (`Ed25519` / `ECDSA`).

### 5. Integrity vs. Content Approval
- The service explicitly clarifies that cryptographic anchoring guarantees **tamper evidence** (that the record was not altered post-anchoring). It does not certify policy wisdom, statutory legality, or subjective correctness.

## Verification & Testing
- Unit tests in `src/services/administrativeAuditCommitmentService.test.js` verify:
  - Strict PII rejection and schema validation.
  - Deterministic Merkle tree and proof verification.
  - Tamper detection on payload alteration.
  - Root mismatch detection.
  - Network failure handling with local continuity preservation.
  - Key rotation metadata lifecycle.
