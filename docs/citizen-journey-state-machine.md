# Citizen Journey State Machine with Recoverable Checkpoints

## Purpose
Multi-day civic applications (pension enrolments, caste certifications, housing grants) require persistent, versioned journeys that survive browser refreshes, device changes, and platform upgrades.

## Core Capabilities
1. **Explicit State Enums**:
   - `DRAFT` -> `ELIGIBILITY_VERIFIED` -> `DOCUMENTS_ATTACHED` -> `FIELD_CONFIRMATION_COMPLETED` -> `READY_FOR_EXPORT` -> `ARCHIVED`.
2. **Strict Server-Side Transition Guards**:
   - Rejects illegal skipping of verification steps.
3. **Resumable Checkpoints**:
   - Saves intermediate form answers safely without requiring premature final submission.
4. **Schema Migrations**:
   - Handles transformations across journey data versions (e.g. `v1.0` to `v2.0`) without corrupting in-flight applications.
