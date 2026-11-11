# Civic Form Schema Mapper and Guided Form Preparation Engine

This document details the architecture, versioned schema catalog, provenance tracking, and client-side validation for Indian civic forms in Civic Help Setu.

## Problem Statement
Official Indian administrative application forms (e.g. Form 8 for Electoral Roll revision, Form 1/1A/2 for Driving Licences, Form 16 for Income Affidavits) frequently feature confusing bureaucratic column labels, unclear statutory requirements, and complex conditional requirements.

Citizens often submit invalid entries, use obsolete printed formats superseded by recent gazettes, or fall victim to third-party scraping portals that claim to automatically submit data without verification.

## Guided Architecture

```
     [ Versioned Form Schema ] (Authority, Effective Date, Gazette Citation)
                 │
                 ├──► [ Supersession Checker ]
                 │       - Checks if newer form edition exists
                 │       - Alerts if gazette revised the form
                 │
                 ├──► [ Field Schema Mapper ]
                 │       - REQUIRED: Strict mandatory fields
                 │       - OPTIONAL: Non-blocking inputs
                 │       - CONDITIONAL: Activated by parent choice
                 │       - UNSUPPORTED_LEGACY: Discontinued fields
                 │
                 ├──► [ Field Provenance Tracker ]
                 │       - USER_MANUAL_ENTRY
                 │       - VAULT_PREFILLED
                 │       - DEFAULT_FALLBACK
                 │
                 ▼
     [ Validation & Guided Review Sheet ]
     - Highlights missing required fields
     - Displays plain-language explanation & statutory citations
     - Strictly: PREPARED_FOR_USER_REVIEW_ONLY
     - Zero automatic government portal submission
```

## Safety and Privacy Commitments
1. **No Automated Submission**: Civic Help Setu never transmits credentials or attempts automated submission to external government portals. Forms are prepared for citizen inspection, printing, and authorized offline/official portal submission.
2. **Explicit Field Provenance**: Every prefilled attribute explicitly indicates whether it originated from a citizen's manual entry or confirmed digital vault storage.
3. **Statutory Integrity**: Form schemas maintain citations to official administrative rules and gazette notifications.
