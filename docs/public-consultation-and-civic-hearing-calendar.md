# Public Consultation and Local Civic Hearing Calendar

## Overview
Public hearings, municipal ward committee meetings, draft-rule comments periods, and city master planning consultations are scattered across fragmented gazette notifications and authority websites. Citizens frequently discover consultation opportunities only after objection deadlines have closed.

The `civicHearingCalendarService` (`src/services/civicHearingCalendarService.js`) introduces a unified, jurisdiction-aware public participation calendar. It indexes official public hearings, supports community submissions through an editorial moderation queue, enables multi-dimensional filtering, and provides private preparation notes with opt-in reminders.

## Key Capabilities

### 1. Participation Event Types
- **`WARD_COMMITTEE_MEETING`**: Neighborhood ward committees, Area Sabha assemblies, and zonal citizen forums.
- **`PUBLIC_HEARING`**: Statutory hearings mandated by environmental impact assessments, electricity regulatory commissions, and land acquisitions.
- **`DRAFT_RULE_CONSULTATION`**: Public notice and comment windows for municipal bylaws, transport guidelines, and policy amendments.
- **`PLANNING_CONSULTATION`**: Master Plan revisions, zoning demarcations, and local development schemes.

### 2. Multi-Tier Verification & Community Moderation
- **Official Notices**: Verified administrative entries published with department provenance and gazette reference URLs.
- **Community Submissions**: Citizens can submit local hearings which remain unverified (`isVerified: false`, `HEARING_STATUS.PENDING_MODERATION`) until reviewed and approved by an administrator.

### 3. Duplicate and Conflicting Submission Guardrails
- Automatically inspects existing events across normalized organizer names, event dates, and title strings.
- Rejects duplicate submissions to prevent spam while protecting integrity.

### 4. Search, Filtering, and Historical Archival
- Filter by: State, District, Municipality, Topic (`SOLID_WASTE`, `URBAN_PLANNING`, `ENVIRONMENT`, `TRANSIT_ROADS`, `WATER_SANITATION`), and Participation Mode (`IN_PERSON`, `VIRTUAL`, `HYBRID`, `WRITTEN_SUBMISSION`).
- **Archive Access**: Past and expired consultations remain searchable in the archive (`includeArchived: true`), ensuring permanent public record accessibility.

### 5. Private Preparation Notes & Timezone-Aware Reminders
- Citizens can record private preparation notes (`saveUserPreparationNotes()`) without publishing them to the public catalog.
- Citizens can configure opt-in reminders with custom advance notification periods and local timezone support.

## Verification & Testing
- Unit tests in `src/services/civicHearingCalendarService.test.js` verify:
  - Official verified hearing publishing with jurisdiction, deadline, and source metadata.
  - Automated duplicate detection and rejection.
  - Community moderation workflow (unverified until approved).
  - Multi-dimensional filtering by district, municipality, topic, and mode.
  - Searchability of expired hearings in historical archives.
  - Private citizen preparation notes and timezone-aware reminder configuration.
