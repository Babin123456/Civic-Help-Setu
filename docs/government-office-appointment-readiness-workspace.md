# Government Office Appointment and Visit-Readiness Workspace

## Overview
Citizens preparing for in-person visits to government facilitation counters (such as Sub-Registrar offices, Tahsildar chambers, Passport Seva Kendras, and Municipal counters) often arrive missing required photocopies, photographs, fee receipts, or counter details.

The `officeAppointmentReadinessService` (`src/services/officeAppointmentReadinessService.js`) provides an end-to-end appointment tracking and visit-readiness workspace. It generates personalized, categorized packing checklists, supports iCalendar (.ics) synchronization, and records post-visit outcomes.

## Key Capabilities

### 1. Appointment Lifecycle & Ownership Privacy
- Citizens can create, view, update, reschedule, and cancel booked visits.
- **Privacy Enforcement**: All appointment records are strictly bound to the authenticated `ownerId`. Cross-user access is denied by default.

### 2. Categorized Physical Visit Packing Checklist
`generateVisitPackingChecklist()` organizes necessary paperwork into clear physical categories:
- **`ORIGINAL`**: Primary documents required for physical inspection (e.g. Identity Proof, Property Deeds).
- **`PHOTOCOPY`**: Specific count of self-attested copies with blue ink attestation guidance.
- **`PHOTOGRAPH`**: Standardized passport photos (white background, 35x45mm).
- **`PRINTED_FORM`**: Downloaded application printouts and declarations.
- **`FEE_EVIDENCE`**: Original treasury challan counterfoils or electronic payment slips.

### 3. RFC 5545 Compliant iCalendar (.ics) Export
`generateAppointmentIcs()` formats appointment metadata into standard calendar events:
- Handles UTC timestamps (`DTSTART`, `DTEND`, `DTSTAMP`).
- Tracks state transitions using incremental `SEQUENCE` counters (e.g., Sequence 0 for confirmed, Sequence 1 for rescheduled or cancelled).
- Accurately emits `STATUS:CONFIRMED` or `STATUS:CANCELLED` to update citizen calendar apps.

### 4. Ground Visit Outcome Tracking
Records physical facilitation results:
- `COMPLETED`: Application accepted and receipt generated.
- `RESCHEDULED`: Counter requested return on another date.
- `TOKEN_ISSUED`: Token received in queuing system.
- `ADDITIONAL_DOCS_REQUESTED`: Missing evidence noted with specific citizen notes.
- `CANCELLED`: Appointment cancelled prior to visit.

### 5. Ethical Transparency
- The service explicitly clarifies that tracking an appointment does not claim automated synchronization with internal government scheduling servers unless externally confirmed.

## Verification & Testing
- Unit tests in `src/services/officeAppointmentReadinessService.test.js` verify:
  - Appointment creation with structured, categorized checklists.
  - Ownership authorization and rejection of unauthorized access.
  - Rescheduling with date updates and sequence increments.
  - Cancellation tracking.
  - Visit outcome recording (e.g. additional documents requested).
  - RFC 5545 iCalendar generation and cancellation updates.
