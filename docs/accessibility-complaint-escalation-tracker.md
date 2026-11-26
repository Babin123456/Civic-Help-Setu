# Accessibility Complaint Follow-Up and Escalation Tracker

## Overview
The **Accessibility Complaint Follow-Up and Escalation Tracker** empowers citizens, advocates, and persons with disabilities to record, organize, and monitor non-compliance grievances regarding inaccessible built environments, healthcare facilities, public transport hubs, and government premises.

Rooted in the **Rights of Persons with Disabilities (RPwD) Act, 2016** (Sections 44, 45, 75, 80, and 89) and the **Harmonised Guidelines and Space Standards for Barrier Free Built Environment (2021)**, the workspace maintains an offline, client-side documentary audit trail.

---

## Statutory Authority & Core Capabilities

### 1. Section 45 Mandate & Harmonised Guidelines 2021
Section 45 of the RPwD Act, 2016 mandates that all existing public buildings and facilities must be made barrier-free within the prescribed statutory timeframe in accordance with the Central Government's Harmonised Guidelines (2021). The workspace records specific physical barriers (such as ramp slopes exceeding 1:12, missing tactile warning pavers, broken elevators, and inaccessible restrooms).

### 2. Local Chronological Case Timeline
- Tracks events across standard classifications:
  - `COMPLAINT_FILED` (Formal Complaint Lodged)
  - `ACKNOWLEDGMENT_RECEIVED` (Official Docket / SMS Acknowledgment)
  - `INSPECTION_REQUESTED` (Joint Site Inspection Requested)
  - `INSPECTION_CONDUCTED` (Field Site Inspection Conducted)
  - `INTERIM_REPLY` (Departmental Action Taken Report / Interim Reply)
  - `REMINDER_SENT` (Written Reminder Dispatched)
  - `HEARING_SCHEDULED` (Commissioner / Court Hearing)
  - `BARRIER_RECTIFIED` (Accessibility Works Completed)
  - `NOTE_LOGGED` (Citizen Note / Verbal Discussion)
- Events are strictly sorted in chronological order using UTC calendar-day comparisons, immune to local timezone offsets.
- Full editing and deletion capabilities for each timeline event record.

### 3. Clear Citizen vs. Official Portal Distinction
Every timeline view, summary card, and exported document carries the mandatory `OFFICIAL_STATUS_DISCLAIMER`:
> **CITIZEN TRACKER NOTICE:** This timeline reflects citizen-recorded milestones, personal correspondence notes, and evidence logs. It is not an official government case management portal, and recording events here does not automatically update departmental databases or create automatic statutory liability.

### 4. Milestone Reminders & Advisory Limits
- Calculates overdue days, upcoming reminder dates, and elapsed time since the latest event.
- **Legal Limitation Disclaimer:**
  > Target follow-up dates are citizen-managed organizational milestones. A missed response date by a public authority does not automatically constitute court contempt or statutory default unless established through a formal directive by the Disabilities Commissioner.

### 5. Non-Automated Legal Representation Drafter
- Prepares tailored, editable drafts without transmitting or submitting them automatically:
  1. **Authority Follow-Up Letter:** Addressed to the initial public authority (e.g., PWD Executive Engineer, Municipal Commissioner, Hospital Medical Superintendent), citing Sections 44/45 RPwD Act and Harmonised Guidelines 2021.
  2. **Section 75 / 80 Escalation Petition:** Formal legal petition addressed to the Court of the Chief Commissioner or State Commissioner for Persons with Disabilities, citing Section 89 penalty provisions and seeking formal inquiry and binding compliance directions.
- Plain text (`.txt`), Markdown (`.md`), and clipboard copying options.

### 6. Privacy & Data Protection (DPDP Act 2023)
- Stores all data strictly client-side under `civicbridge_accessibility_cases_v1` and `civicbridge_accessibility_tracker_settings_v1`.
- Fully integrated with CivicBridge's **Clear My Data** framework (`category: 'drafts'`).
- Cryptographic SHA-256 seal computation (`computeCaseDigest`) and integrity verification (`verifyCaseIntegrity`).
- Sanitized export routines (`sanitizeCaseForExport`) scrub personal complainant names, addresses, and tracking identifiers upon request.

---

## Architecture & Storage Keys

| Key | Layer | Purpose |
|---|---|---|
| `civicbridge_accessibility_cases_v1` | `localStorage` / memory | Stored complaint cases, events array, SHA-256 digest, and evidence references |
| `civicbridge_accessibility_tracker_settings_v1` | `localStorage` / memory | Citizen reminder lead-time preferences and notification controls |

## Routes & Entry Points

- `/accessibility-tracker` (Primary workspace entry point)
- `/accessibility-complaint-tracker` (Direct alias)
- `/accessibility-escalation` (Direct alias)
- `/services/accessibility-tracker` (Service directory route)
