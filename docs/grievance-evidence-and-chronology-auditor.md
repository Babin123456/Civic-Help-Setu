# AI Grievance Evidence Completeness and Chronology Auditor

This document specifies the technical design, privacy assurances, chronology verification, and evidence auditing framework for citizen grievance preparation in Civic Help Setu.

## Problem Statement
When citizens submit complaints to administrative tribunals, district collectors, or public grievance portals (e.g. CPGRAMS, state CM helplines), a high percentage are rejected or delayed due to:
1. Inverted or missing timelines (e.g. alleging negligence prior to initial filing date).
2. Omission of primary statutory acknowledgements, reference tokens, or sanction letters.
3. Multiple duplicate file attachments obscuring primary evidence.

Crucially, an AI assistant supporting this workflow must never make speculative claims of legal sufficiency, must not fabricate supporting evidence, and must not ingest citizen records for general model training.

## Architecture & Verification Pipeline

```
     [ Citizen Grievance Dossier ] (Events, Timeline, Attachments)
                    │
                    ▼
     +-----------------------------------------------------------+
     |             Deterministic Chronology Auditor              |
     |  - Detects future dates                                   |
     |  - Flags out-of-order sequence transitions                |
     |  - Identifies missing incident anchors                    |
     +------------------------------+----------------------------+
                                    │
                                    ▼
     +-----------------------------------------------------------+
     |             Duplicate Document Detector                   |
     |  - Hash & file size comparison                            |
     |  - Flags redundant attachments                            |
     +------------------------------+----------------------------+
                                    │
                                    ▼
     +-----------------------------------------------------------+
     |           Evidence Completeness & Categorization          |
     |  - PRESENT: Evidence attached                             |
     |  - POSSIBLY_MISSING: Statutory document absent (Citations)|
     |  - NEEDS_CONFIRMATION: Organizational best practice advice|
     +------------------------------+----------------------------+
                                    │
                                    ▼
     +-----------------------------------------------------------+
     |              Zero-Training Guarantee & Disclaimer         |
     |  - No retention for model training                        |
     |  - Disclaims legal sufficiency and guaranteed outcome     |
     +-----------------------------------------------------------+
```

## Evidence Categorization States
- **`PRESENT`**: Evidence category is confirmed present in attached documents.
- **`POSSIBLY_MISSING`**: Required statutory document is not detected in uploads. Grounded in gazette or portal charters.
- **`NEEDS_CONFIRMATION`**: Recommended evidence (e.g. photos, witness notes) suggested as general organizational best practices.
