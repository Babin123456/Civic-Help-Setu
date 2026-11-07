# Services Directory Header & Filter Grouping Architecture

## Overview
This document specifies the design and implementation of the polished Services Directory header and multifaceted filter grouping (Issue `#566`).

The goal is to provide a clean, high-hierarchy search and discovery experience for citizens navigating hundreds of civic service guides across state and central jurisdictions.

---

## 1. Visual Hierarchy & Header Polish

### Directory Title & Utility Shortcuts
- **Badge Anchor**: Top verification badge (`Verified Citizen Portals & Guides`) with translucent primary accent styling.
- **Fluid Headline**: Responsive clamp typography (`clamp(2.25rem, 5vw, 3.25rem)`) with optimal line height (1.15).
- **Concise Value Proposition**: Explains that guides provide step-by-step procedures, required documents, authority contacts, and official fee breakdowns.
- **Quick Citizen Action Shortcuts**:
  - `Citizen RTI Request Builder (Section 6(1))` for immediate information requests.
  - `Civic Grievance & Department Router` for escalating service delivery issues.

### Category Strip Navigation
- Placed in a dedicated semantic `<nav aria-label="Filter services by category">` region.
- Smooth horizontal scrolling on mobile touch screens with hidden scrollbars for clean presentation.
- Accessible `aria-pressed` states on pill buttons.

---

## 2. Filter Grouping & Organization

The `FilterToolbar` component has been reorganized into clear semantic sections:

### 1. Primary Search & Counter
- Full-width search bar with prominent search icon, clear button (`X`), and autocomplete keyboard navigation (`ArrowUp`, `ArrowDown`, `Enter`, `Escape`).
- Real-time result counter ("Showing X service guides").
- Dynamic **Active Filter Count Badge** (e.g. `3 active`) indicating total non-default filters in effect.
- One-click **Reset all** button with `RotateCcw` icon, allowing users to restore default view instantly.

### 2. Authority & Jurisdiction Group
Organized in a responsive auto-fit grid (`repeat(auto-fit, minmax(240px, 1fr))`):
- **Authority & Department**: Dropdown filtering by department/ministry (e.g., Revenue, Transport, UIDAI).
- **State / District Scope**: Cascading state and district selector for location-specific procedures.
- **Fee Structure & Speed**: Grouped controls for free vs paid services and delivery timelines.

### 3. Application Modality & Sorting Group
- **Mode Facets**: Segmented pill selectors for `All`, `Online`, and `Offline` with `aria-pressed` states.
- **Difficulty Facets**: Segmented pill selectors for `All`, `Easy`, `Medium`, and `Hard`.
- **Sort Selector**: Aligned to the right with `ArrowUpDown` icon and clearly labelled options:
  - Most Relevant (default)
  - Most Popular
  - Fastest Processing
  - Name (A – Z)
  - Name (Z – A)
  - Difficulty (Easiest first)

---

## 3. Accessibility & URL State Persistence
- All filters maintain bidirectional synchronization with URL search parameters (`?q=`, `?cat=`, `?dept=`, `?state=`, `?district=`, `?mode=`, `?fee=`, `?speed=`, `?sort=`).
- Deep-linked URLs and browser back/forward buttons work seamlessly.
- Screen readers receive appropriate announcements via `role="combobox"`, `role="listbox"`, and `aria-label` tags.
