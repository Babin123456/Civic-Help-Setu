# Civic Survey Builder with Sampling Quality and Response-Bias Diagnostics (#767)

## Overview
Civic Help Setu provides a dedicated, privacy-preserving **Civic Survey Builder with Sampling Quality and Response-Bias Diagnostics**. This capability enables municipal departments, urban planners, and approved researchers to author structured public surveys, collect anonymous citizen feedback, and evaluate sampling representation and item missingness without relying on opaque models or violating citizen privacy.

---

## Architectural Principles

1. **Separation of Concerns**:
   - Presentation: `src/pages/CivicSurveyWorkspace.jsx` and modular components under `src/components/survey/`.
   - Business Logic: Typed service methods in `src/services/surveyService.js`.
   - Persistence & Anti-Replay: Normalized local store with idempotency deduplication in `src/services/surveyStorage.js`.
   - Diagnostics Engine: Deterministic ruleset-versioned calculations in `src/services/surveyDiagnosticsService.js`.
   - Trusted Boundary: Serverless handler in `api/_lib/handlers/civic-surveys.js` with rate limiting, zero-PII rejection, and cryptographic receipt seals.

2. **Domain State Machine**:
   - `draft` ➔ `under_review` ➔ `published` ➔ `paused` ➔ `closed` ➔ `archived`.
   - Publishing enforces validation gates: surveys with zero questions or missing statutory consent text cannot be published.

3. **Privacy & k-Anonymity Safeguards**:
   - **Consent Separation**: Consent tokens are isolated from survey response answer vectors.
   - **k-Anonymity Demographic Suppression**: Subgroups with counts below the privacy threshold ($N < 5$) are suppressed into `"Suppressed (Small Group < 5)"` in public and research outputs.
   - **Zero PII**: Rejection of Aadhaar, PAN, phone numbers, and credentials in submission payloads.
   - **Statutory Withdrawal**: Citizens can revoke consent and purge responses using their anonymous receipt token.

4. **Sampling Quality & Bias Diagnostics**:
   - **Response Coverage**: Measures progress toward target quotas.
   - **Item Missingness**: Calculates non-response rates per question to identify ambiguity or citizen fatigue.
   - **Voluntary Demographic Imbalance**: Measures deviation across voluntarily reported community strata.
   - **Explainable Recommendations**: Provenance of influencing source fields, ruleset version (`v1.0.0-sampling-diagnostics`), and human-in-the-loop accept/reject decision controls.
   - **Statistical Caveat**: Explicit disclaimer that voluntary civic surveys do not claim probabilistic census representativeness.

---

## Verification & Testing Commands

To run all tests associated with this capability:

```bash
# Domain contract & validation tests
npx vitest run src/data/surveyContract.test.js

# Persistent storage & idempotency tests
npx vitest run src/services/surveyStorage.test.js

# Diagnostics engine & recommendation tests
npx vitest run src/services/surveyDiagnosticsService.test.js

# Service orchestration tests
npx vitest run src/services/surveyService.test.js

# Serverless API handler & zero-PII tests
npx vitest run tests/civic-surveys.test.js

# UI & Workspace tests
npx vitest run src/pages/CivicSurveyWorkspace.test.jsx
npx vitest run src/components/admin/SurveyAuditQueue.test.jsx
npx vitest run src/pages/ServiceDetails.test.jsx
npx vitest run src/utils/diagnostics.test.js
```

