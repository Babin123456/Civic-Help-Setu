# Government Circular and Gazette Research Workspace with Citation-First Answers

This document details the architectural design, ingestion schema, page-level citation mechanics, and editorial promotion gate for the Gazette and Circular Research Workspace in Civic Help Setu.

## Problem Statement
Administrative guidelines, eligibility rules, revised fee structures, and procedural prerequisites in India are published in statutory gazette notifications, ministerial circulars, office orders, and departmental memoranda rather than modern consumer landing pages.

Standard RAG architectures often:
1. Synthesize generalized assertions without exact paragraph or page citations.
2. Rely on obsolete or superseded circulars when subsequent gazette amendments have repealed earlier clauses.
3. Silently hallucinate administrative answers when governing circulars are missing or inaccessible.

## Architectural Design

```
   [ Approved Official Publications ] (Gazettes, Circulars, Memoranda)
                       │
                       ▼
   +-------------------------------------------------------------+
   |             Checksum & Page-Preserving Ingester             |
   |  - Metadata: Authority, Gazette No, Date, URL, SHA-256      |
   |  - Preserves exact PDF page boundaries & numbered sections  |
   +------------------------------+------------------------------+
                                  │
                                  ▼
   +-------------------------------------------------------------+
   |            Multi-Faceted Search & Retrieval Engine          |
   |  - Query by Notification Number / Identifier                |
   |  - Department / Ministry filtering                          |
   |  - Jurisdiction matching (National, State, District)        |
   |  - Inverted keyword & semantic passage matching             |
   +------------------------------+------------------------------+
                                  │
                                  ▼
   +-------------------------------------------------------------+
   |            Citation-First Answer Generator                  |
   |  - Mandatory page-level citation for every claim            |
   |  - Checksum and official source URL attached                |
   |  - Surfaces Superseded / Conflicted Circular Alerts         |
   |  - Strict ABSTENTION if no verified circular exists         |
   +------------------------------+------------------------------+
                                  │
                                  ▼
   +-------------------------------------------------------------+
   |              Human Editorial Review Gate                    |
   |  - Research findings proposed as PENDING_EDITORIAL_REVIEW   |
   |  - Senior editor approves before public catalogue promotion |
   +-------------------------------------------------------------+
```

## Citation Guarantees
- **Exact Coordinates**: Every citation identifies the issuing authority, order number, notification date, page number, and section title.
- **Fail-Closed Abstention**: If the indexed corpus does not contain a verified, non-superseded circular covering the user's query, the engine explicitly abstains from synthesizing an ungrounded answer.
- **Provenance Integrity**: Publications store a cryptographic checksum (`SHA-256`) of the verified official PDF.
