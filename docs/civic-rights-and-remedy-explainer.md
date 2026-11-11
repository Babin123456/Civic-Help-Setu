# Plain-Language Civic Rights and Remedy Explainer with Source-Bounded Guidance

This document details the architectural design, statutory rights mapping, tripartite presentation structure, and fail-closed abstention rules for Civic Help Setu's Rights and Remedies Engine.

## Problem Statement
When Indian citizens encounter bureaucratic obstacles—such as statutory service delays beyond published citizen charters, arbitrary refusal to accept certificates, ungrounded rejections, or demands for unnotified fees—they frequently lack clear information about:
1. Exact statutory rights granted under Public Service Guarantee Acts (e.g. RTS Acts across Maharashtra, Delhi, Karnataka).
2. Distinction between educational legal awareness and licensed legal advocacy.
3. Concrete procedural remedies (First Appeal, CPGRAMS public grievance, RTI application, vigilance complaint).

Unconstrained LLMs frequently hallucinate legal doctrines, invent non-existent statutory timelines, or provide unauthorized legal representation.

## Tripartite Presentation Architecture

To ensure transparent citizen comprehension, every valid remedy is presented in three visually distinct tiers:

```
  +-------------------------------------------------------------+
  |              1. Quoted Official Legal Provision              |
  |  - Verbatim text from State/Central statute or gazette      |
  |  - Precise section and rule citation                        |
  +------------------------------+------------------------------+
                                 │
                                 ▼
  +-------------------------------------------------------------+
  |             2. Plain-Language Citizen Explanation            |
  |  - Clear, accessible language without confusing jargon      |
  |  - Explains what the citizen can legally demand             |
  +------------------------------+------------------------------+
                                 │
                                 ▼
  +-------------------------------------------------------------+
  |             3. Practical Step-by-Step Options                |
  |  - Concrete avenues: Appeal forms, CPGRAMS, RTI filing      |
  |  - Statutory limitation windows (e.g. 30 days)              |
  |  - Designated escalation authority / counter designation    |
  +-------------------------------------------------------------+
```

## Safety and Non-Advocacy Safeguards
- **Source-Bounded Abstention**: When no verified statute or citizen charter clause covers the described situation, the system explicitly abstains rather than inventing legal remedies.
- **Helpdesk Counter Dossier**: Citizens can export a structured briefing document containing official questions to ask at the competent departmental desk.
- **Explicit Non-Litigation Disclaimer**: Clarifies that the tool offers administrative literacy and guidance, not licensed legal advocacy.
