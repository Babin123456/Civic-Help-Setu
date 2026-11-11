# State-Wise Civic Grievance Escalation and Statutory Timeline Tracker

## Overview
When citizens lodge public grievances regarding municipal failures, ration distribution, revenue documents, or public health hazards, they are rarely informed about the statutory SLA response window or the sequence of appellate officers available if lower authorities fail to respond.

The `stateGrievanceEscalationTrackerService` (`src/services/stateGrievanceEscalationTrackerService.js`) provides a jurisdiction-aware escalation engine tracking grievances under state Right to Public Service (RTS) legislation (such as Maharashtra RTS 2015, Karnataka Sakala 2011, Tamil Nadu Right to Service framework, and Delhi PGC).

## Key Capabilities

### 1. Curated State Statutory Escalation Ladders
The service maintains versioned rules and statutory escalation stages:
- **Tamil Nadu**: Grievance Redressal Officer (30d) $\to$ District Revenue Officer (30d) $\to$ District Collector (45d). CM Helpline: 1100.
- **Maharashtra**: Public Grievance Officer (21d) $\to$ First Appellate Authority (30d) $\to$ State RTS Commission (90d). Helpline: 1800-120-8040.
- **Karnataka**: Designated Officer (21d) $\to$ First Appellate Authority (30d) $\to$ Karnataka Appellate Tribunal (45d). Helpline: 080-44554455.
- **Delhi**: Competent Officer (15d) $\to$ First Appellate Authority (30d) $\to$ Public Grievance Commission (60d). Helpline: 1031.
- Each jurisdiction explicitly records official sources, last-verified dates, and verified portal URLs.

### 2. Distinction Between Statutory Mandates and Department Targets
- **Statutory Mandate (`STATUTORY_MANDATE`)**: Legally enforceable time limits enacted under state legislation, past which citizens are legally entitled to file first or second appeals.
- **Department Target (`DEPARTMENT_TARGET`)**: Internal operational targets (often shorter, advisory service levels). Both are distinctly labelled.

### 3. Working-Day & Holiday Accounting
- `calculateWorkingDays()` accounts for weekends and recognized national and state public holidays (Republic Day, May Day, Independence Day, Gandhi Jayanti), preventing false breach calculations.

### 4. Interactive Escalation Workflow
- Automatically flags `STATUTORY_SLA_BREACHED` when elapsed working days exceed statutory limits.
- `escalateGrievanceToNextStage()` records stage promotions with rationale into an auditable history trail.

### 5. Chronological Complaint Dossier Export
- `exportComplaintChronology()` compiles the complaint's submission date, reference numbers, state legislation cited, and verification metadata into an exportable package suitable for formal appeals or RTI submissions.

## Verification & Testing
- Unit tests in `src/services/stateGrievanceEscalationTrackerService.test.js` verify:
  - Retrieval of verified statutory rules by state.
  - Graceful fallback for unverified or unsupported jurisdictions.
  - Working day calculations excluding weekends and holidays.
  - Separate labelling of statutory vs. internal target deadlines.
  - SLA breach detection and appellate escalation.
  - Chronological complaint dossier export.
