# Application Status Timeline & Hierarchy Architecture

## Overview
This document specifies the design and accessibility updates introduced for the **Track Application Status Timeline** (`src/components/tracking/ApplicationTimeline.jsx` and `src/pages/Track.jsx`), resolving Issue `#582`.

---

## 1. Visual Hierarchy & Distinct State Encoding

To adhere strictly to WCAG 2.1 AA / 2.2 Guideline 1.4.1 (Use of Color), milestone stages do not rely solely on color to communicate progress. Each state provides three distinct indicators:
1. **Semantic Text Badge**: `Completed`, `In Progress`, `Action Required`, `Delayed Step`, `Upcoming`.
2. **Distinct Icon Glyphs**:
   - `CheckCircle2` for verified completed steps.
   - `Clock` for actively processing steps.
   - `AlertTriangle` for actions required by the applicant.
   - `Hourglass` for steps exceeding standard statutory turnaround times.
   - `Circle` for upcoming unreached milestones.
3. **Contrast Border & Shading**: Subtle background tints and solid borders for active/delayed cards ensure clear distinction across light and dark themes.

---

## 2. Fallback Handling & Data Resilience
- **Missing Dates**: If a target or completed timestamp is omitted from the tracking payload, the component renders `Date pending` with a `Calendar` icon rather than an awkward empty gap.
- **Missing Descriptions**: If no detailed note was provided by the department, an explicit notice appears: `No detailed progress notes provided by the department for this milestone.`
- **Empty Milestone Arrays**: Renders an accessible status card instructing the user when no timeline stages have been recorded yet.

---

## 3. Responsive Stacking & Mobile Behavior
- Timeline nodes and content cards stack cleanly without horizontal clipping at 320px, 375px, and tablet widths.
- Words wrap properly (`word-break: break-word`) to accommodate long reference numbers and department names.
- Screen readers announce the milestone region with `role="region"` and `aria-label="Application Milestone Progress Timeline"`.
