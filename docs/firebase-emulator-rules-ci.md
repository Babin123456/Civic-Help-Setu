# Isolated Firebase Emulator Security Rules CI Job

## Background & Objectives
Civic Help Setu relies on Firestore Security Rules and Cloud Storage Rules to enforce strict authorization boundaries:
- Citizen grievance reports and personal attachments must remain accessible strictly to their authors and designated jurisdiction officers.
- Public utility listings (e.g. sanitation facilities, ration center locations) must be readable globally while disallowing untrusted writes.

Running security rules testing directly against live Google Cloud Firebase instances risks cross-test contamination, transient network failures, and unintended cost/quota consumption. This enhancement establishes an isolated, hermetic CI job powered by the local Firebase Emulator Suite and synthetic fixture assertions.

---

## Architectural Principles

1. **Hermetic & Independent Execution**:
   - The test harness (`src/services/firebaseEmulatorHarness.js`) operates without external network dependencies.
   - Generates ephemeral synthetic datasets tagged with an isolated `runId`.
2. **Deterministic Role-Based Policy Matrix**:
   - Validates that anonymous actors are blocked from viewing confidential citizen submissions.
   - Enforces read-open rules exclusively for verified public assets (e.g. municipal sanitation facilities).
   - Validates ownership enforcement (`request.auth.uid == resource.data.ownerId`).
   - Verifies administrative oversight by authorized role holders.
3. **Continuous Integration Automation**:
   - Dedicated workflow `.github/workflows/firebase-rules.yml` triggers on pull requests modifying `firebase/**`, `docs/FIREBASE_RULES.md`, or database access policies.
   - Runs automated diagnostics for Java runtime compatibility, executes emulator assertions, and generates structured test verdicts.

---

## Security Verification Matrix

| Actor Role | Target Resource | Operation | Expected Verdict | Policy Enforcement Rule |
| :--- | :--- | :--- | :--- | :--- |
| Anonymous | `/grievances/{id}` | Read / Write | DENIED (403) | `allow read, write: if request.auth != null && ...` |
| Anonymous | `/publicToilets/{id}` | Read | PERMITTED (200) | `allow read: if true;` (public utility directory) |
| Anonymous | `/publicToilets/{id}` | Write | DENIED (403) | Unauthenticated mutations strictly prohibited |
| Citizen A | `/grievances/{id_A}` | Read / Update | PERMITTED (200) | `request.auth.uid == resource.data.ownerId` |
| Citizen B | `/grievances/{id_A}` | Read / Update | DENIED (403) | Foreign citizens prohibited from accessing peer records |
| Field Officer | Local `/grievances/{id}` | Read | PERMITTED (200) | Jurisdiction-matched officer authorization rule |
| District Admin | Any Resource | Read / Audit | PERMITTED (200) | Administrative role verification via claims/tokens |

---

## Operational Runbook & CI Maintenance

1. **Local Emulator Execution**:
   Developers can run the emulator suite locally without setting up live cloud credentials:
   ```bash
   npm run rules:test
   ```
2. **Deterministic Port Binding**:
   The isolated runner binds strictly to local loopback ports (8080, 9199, 9099) to avoid colliding with background services.
3. **Flake Prevention & Fast Failures**:
   The harness uses synthetic in-memory validation along with socket readiness checks before running assertions, eliminating race conditions during CI initialization.
4. **Automated Enforcement on Pull Requests**:
   Any modification to security rules automatically triggers this workflow, ensuring regression prevention prior to merging into production branches.

---

## Verification & Usage

- Run unit test suite: `npx vitest run src/services/firebaseEmulatorHarness.test.js`
- Run static security rules validation: `npx vitest run scripts/firebaseRules.test.js`
- CI execution is automated on pull requests and branch pushes targeting `main`.

