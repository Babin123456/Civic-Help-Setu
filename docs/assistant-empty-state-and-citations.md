# Assistant Empty State, Starter Prompts & Citations Architecture

## Overview
This document outlines the architectural enhancements implemented for the **Civic Consultation Assistant** (`src/pages/Assistant.jsx`, `src/components/chat/ChatEmptyState.jsx`, and `src/components/assistant/SourcesAndLimitations.jsx`), resolving Issues `#584` and `#585`.

---

## 1. Grouped Starter Prompts & First-Use Experience (#584)

### Categorized Task Pathways
Rather than a loose collection of random questions, starter prompts are organized into structured, easily recognizable civic service categories:
- **Identity & Vital Records**: Birth certificates, lost Aadhaar retrieval, name change records.
- **Licences & Transport**: Learner and permanent driving licences, passport issuance and renewal.
- **Welfare & Grievances**: PM-KISAN, subsidy entitlements, CPGRAMS public grievance escalation.

### Scope & Limitation Transparency
- Explicitly states the assistant's boundaries: derived from verified public gazettes, municipal manuals, and state citizen charters.
- Includes a prominent **Civic Consultation Notice** clarifying that the assistant does not possess administrative or governmental authority and cannot replace formal filings on verified state portals.

---

## 2. Message Readability & Citations Panel (#585)

### Distinguishable Conversation Flow
- **Role Differentiation**: User messages feature a discrete badge ("You (Citizen)") with soft accent borders and right alignment; Assistant answers display "Civic Help Setu Assistant" with distinct typography.
- **Readability Capping**: Max widths (`min(85%, 600px)` for user queries) prevent long, fatiguing line lengths on wide desktop monitors (1080p+).
- **Safe Word Wrapping**: Explicit `overflow-wrap: break-word` and `word-break: break-word` prevent long URLs, Aadhaar references, and legal case identifiers from overflowing on mobile viewports (320px–375px).

### Non-Conflated Source Citations
- AI-generated summaries and raw statutory excerpts are strictly separated.
- Official links render with clear external indicators (`ExternalLink` icon and screen-reader `(opens in a new tab)` announcements).
- Excerpts are formatted with left accent quotes and explicit review dates (`Last verified: Date` or `Review date unavailable`).
