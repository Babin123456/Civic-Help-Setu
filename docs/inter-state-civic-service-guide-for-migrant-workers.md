# Inter-State Civic Service Guide for Migrant Workers

## Overview
Migrant workers and relocating families across Indian states frequently struggle to identify which public benefits are portable across state boundaries, which identity records require address updates, and which welfare schemes require fresh state registration.

The `interStateMigrantServiceGuideService` (`src/services/interStateMigrantServiceGuideService.js`) provides a transparent roadmap engine mapping origin and destination state pairs into actionable, categorized transition checklists without collecting unnecessary identity numbers or personal documents.

## Key Capabilities

### 1. Categorization of Transition Tasks
The service categorizes transition tasks into four functional buckets:
- **`PORTABLE_BENEFITS`**: Central and national schemes portable without cancellation of origin documents (e.g., One Nation One Ration Card under NFSA, e-Shram unorganized worker UAN, Ayushman Bharat PM-JAY).
- **`PROFILE_UPDATES`**: Modifications on central registries (e.g., Voter ID constituency shifting under Form 8, Aadhaar address update).
- **`FRESH_APPLICATIONS`**: Schemes requiring fresh local registration with the destination state (e.g., State Building and Other Construction Workers - BOCW Welfare Boards).
- **`LOCAL_REGISTRATIONS`**: Neighborhood facilitation (e.g., child school admissions under Right to Education RTE norms without transfer certificate barriers).

### 2. Distinction of Portability Tiers
- **`NATIONWIDE_PORTABLE`**: Operates seamlessly nationwide via biometrics or centralized databases.
- **`CONDITIONAL_PORTABILITY`**: Requires specific conditions (such as residency proof or Form 8 submission).
- **`NON_PORTABLE_LOCAL_ONLY`**: Tied strictly to state-level revenue, domicile, or labour boards.

### 3. Strict Provenance & "Not Verified" Guardrail
- Every task cites its governing legislation, official central or state department source, and verification date.
- **Zero Hallucination Rule**: For unverified state combinations, the engine explicitly outputs `"not verified. Do not guess"` with guidance to verify directly through national nodal portals.

### 4. Privacy-Respecting Checklist Export
- `exportMigrantTransitionChecklist()` generates exportable transition plans strictly omitting personal Aadhaar, PAN, bank account, or ration card numbers.

## Verification & Testing
- Unit tests in `src/services/interStateMigrantServiceGuideService.test.js` verify:
  - Transition roadmap generation across verified state pairs (e.g. Bihar to Tamil Nadu).
  - Proper classification of nationwide portable vs. state-dependent schemes.
  - "Not verified" response generation for unverified state combinations.
  - Identification of intra-state moves.
  - Clean export omission of personal identity data.
