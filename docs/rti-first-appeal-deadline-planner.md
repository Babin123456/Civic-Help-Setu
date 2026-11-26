# RTI First Appeal Deadline and Transfer Decision Planner

## Overview
While citizens often succeed in drafting initial Right to Information (RTI) applications, many miss statutory windows for filing First Appeals when a response is delayed, transferred, or rejected.

The **RTI First Appeal Deadline and Transfer Decision Planner** provides a date-driven workflow grounded in the RTI Act, 2005.

## Core Features
1. **Statutory Limitation Calculations (`rtiStatutoryTimelineData.js`)**:
   - 30-day PIO response clock under Section 7(1).
   - 48-hour expedited life and liberty timeline under Section 7(1) proviso.
   - Deemed refusal trigger under Section 7(2) invoking free-of-cost information rights under Section 7(6).
   - 30-day First Appeal limitation period under Section 19(1) with 30-day discretionary condonation window.
2. **Event-Specific Next Step Guidance (`rtiAppealPlannerService.js`)**:
   - Handles Section 6(3) inter-departmental transfers (5-day statutory transfer rule).
   - Formulates grounds of appeal for baseless Section 8/9 exemption rejections.
3. **Chronology & Evidence Generation**:
   - Generates a chronological milestone log and mandatory annexure checklist (speed-post tracking, initial application, fee receipts) suitable for inclusion in First Appeal memos.
