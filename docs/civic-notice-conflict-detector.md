# Civic Notice and Public-Order Deduplication and Conflict Detector

This document details the architecture, grouping heuristics, conflict taxonomy, and editorial review workflow for Civic Help Setu's Public Notice Comparator.

## Problem Statement
Indian public departments routinely publish public notices, recruitment advertisements, exam timetables, auction dates, and citizen deadlines across multiple state and municipal websites. Subsequent notifications often amend crucial terms:
1. Deadlines extended by corrigendum.
2. Physical verification venues relocated across districts.
3. Notices cancelled, stayed, or withdrawn altogether.

Citizens consulting outdated notices miss examination dates or visit closed offices. Automated systems that overwrite or delete earlier notices destroy vital evidentiary audit trails.

## Comparative Architecture

```
   [ Input Public Notices & Gazette Orders ]
                       │
                       ▼
   +-------------------------------------------------------------+
   |                  Notice Grouping Engine                     |
   |  - Normalized Identifier Matching (REC2025EXAM04)           |
   |  - Explicit Cross-Reference / Citation Detection            |
   |  - Authority & Jaccard Topic Overlap Scorer                 |
   +------------------------------+------------------------------+
                                  │
                                  ▼
   +-------------------------------------------------------------+
   |                 Side-by-Side Conflict Scorer                |
   |  - DATE_MODIFIED (Extension or rescheduling)                |
   |  - VENUE_LOCATION_CHANGED (Physical center shifted)         |
   |  - FEE_MODIFIED (Statutory revision)                        |
   |  - WITHDRAWAL_CANCELLATION (Order annulled)                 |
   |  - CORRIGENDUM_AMENDMENT (Explicit modification notice)     |
   +------------------------------+------------------------------+
                                  │
                                  ▼
   +-------------------------------------------------------------+
   |                 Side-by-Side Review Dossier                 |
   |  - Earlier vs Later notice timeline presentation            |
   |  - Preserves BOTH original notices and URLs permanently     |
   |  - Relationship: SUGGESTED_CONFLICT                         |
   +------------------------------+------------------------------+
                                  │
                                  ▼
   +-------------------------------------------------------------+
   |                 Human Editorial Annotation Gate             |
   |  - Editor confirms amendment, supersession, or false match  |
   |  - Zero destructive changes to source documents             |
   +-------------------------------------------------------------+
```

## Safety Guarantees
- **Preservation of Source Records**: Earlier notices are never deleted, overwritten, or automatically marked invalid.
- **Explainable Discrepancies**: Every conflict flag explicitly highlights the exact differing field and verbatim passage snippets.
- **Editorial Review Accountability**: Any relationship classification (`CONFIRMED_AMENDMENT`, `CONFIRMED_SUPERSEDED`) records the reviewer ID and timestamp.
