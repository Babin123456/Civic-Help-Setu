# Public Library Membership & Civic Learning Resource Directory (#727)

## Overview & Citizen Problem
Residents frequently struggle to identify which public libraries serve their locality, how to obtain membership, what statutory fees or caution deposits are required, what renewal rules apply, or how to access government-supported digital learning repositories (such as the National Digital Library of India, Swayam, e-ShodhSindhu, or Sugamya Pustakalaya).

This feature introduces a verified, structured public library directory adhering to Civic Help Setu's zero-assumption data policies.

---

## Architecture & Data Contracts

### 1. Schema & Validation (`src/data/libraryContract.js`)
- **Version**: `LIBRARY_SCHEMA_VERSION = 1`
- **Supported Library Types**:
  - `national_library`: National apex institutions (e.g., National Library of India, Belvedere).
  - `state_central_library`: State central apex libraries (e.g., Anna Centenary Library, State Central Library Cubbon Park).
  - `district_central_library`: District headquarters public libraries.
  - `city_central_library`: Metropolitan municipal libraries (e.g., Delhi Public Library).
  - `branch_library`: Zonal and neighbourhood branch libraries.
  - `digital_learning_centre`: Civic digital learning resource hubs.
  - `community_library`: Local panchayat and municipal ward libraries.
- **Membership Categories**:
  - `general_adult`: Adult citizens.
  - `student`: Subsidized reader concession requiring institutional ID.
  - `senior_citizen`: Concessional or free reference memberships.
  - `children`: Juvenile section memberships with guardian consent.
  - `researcher`: Academic, scholar, and institutional memberships.
- **Invariants**:
  - Every claim must link to a dated official government or municipal source (`auditMetadata.sourceUrl`).
  - Speculative seat counts or live reading hall vacancy numbers are **strictly forbidden** (`FORBIDDEN_LIBRARY_FIELDS`).
  - Missing fees, rules, or requirements must render as **explicit unverified/unavailable states** rather than assumptions.

---

## Data Provenance & Freshness Lifecycle

### Staleness Thresholds
- **Recent (`recent`)**: Audited within <= 90 days.
- **Standard (`standard`)**: Audited within <= 365 days.
- **Overdue (`overdue`)**: Audit overdue (> 365 days). Displays visual `Audit Overdue (Stale Record)` warning banner on directory cards.

### Refresh & Submission Workflow
1. Citizens, librarians, and researchers can submit proposed updates via the **Suggest Update** modal.
2. The submission endpoint (`/api/library-corrections`) enforces:
   - Rate limiting and single-flight request protection via `abuseGuard`.
   - Zero-PII filtering (rejects Aadhaar, PAN, phone numbers, personal names).
   - Mandatory official HTTPS source URL.
   - Deterministic cryptographic seal generation (`LIB-CORR-XXXX-XXXX`).
3. Submissions queue for administrator review in `LibraryCorrectionQueue` on `/admin`.

---

## Client-Side Privacy & Checklist Storage
- Stored exclusively under client-side `localStorage` key `civic_library_checklists_v1`.
- Contains zero personal identifiers or uploaded files.
- Optimistic concurrency control using revision numbers (`rev`).
- Citizens can review, edit, toggle, add custom reminders, and permanently wipe/delete their saved data.

---

## Low-Bandwidth & Accessibility Support
- **Low-Bandwidth Mode**: Single-click toggle switches view to plain-text structured layouts suitable for 2G networks, screen readers, and direct SMS/WhatsApp clipboard copying.
- **Accessibility**: Full keyboard navigation, semantic landmark regions, accessible modal dialogs (`AccessibleModal`) with focus trap, and WCAG AA contrast compliance.

