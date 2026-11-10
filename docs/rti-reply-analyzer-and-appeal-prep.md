# RTI Reply Analyzer and Appeal Preparation Workspace

This document specifies the technical architecture, classification ontology, statutory provisions, and appeal preparation mechanisms for the Right to Information (RTI Act 2005) workspace in Civic Help Setu.

## Problem Statement
Indian citizens submitting requests under the Right to Information Act, 2005 frequently face ambiguous, bureaucratic, or partially uncooperative responses from Public Information Officers (PIOs). These may include:
1. Section 6(3) jurisdictional transfers where the applicant must track a new department.
2. Section 7(3) demands for reproduction costs or page fees.
3. Partial or blanket refusals invoking Section 8(1) exemptions (commercial confidence, national security, personal privacy).

Citizens often miss the strict 30-day statutory limitation window to file a First Appeal under Section 19(1) or conflate educational legal information with formal legal representation.

## Classification Architecture

```
     [ Public Information Officer (PIO) Response ] (Image/OCR/Text)
                            │
                            ▼
     +-------------------------------------------------------------+
     |                    Sectional Parser                         |
     |  - Paragraph and annexure boundary detection                |
     +------------------------------+------------------------------+
                                    │
                                    ▼
     +-------------------------------------------------------------+
     |                 Statutory Category Classifier               |
     |  - FULL_DISCLOSURE (Sec 7(1))                               |
     |  - SECTION_6_3_TRANSFER (Transferred Public Authority)      |
     |  - FEE_DEMAND_SECTION_7 (Copying/Inspection Cost)           |
     |  - THIRD_PARTY_NOTICE_SECTION_11 (10-day notice)            |
     |  - REJECTION_EXEMPTION_SECTION_8 (Exemption citation)       |
     +------------------------------+------------------------------+
                                    │
                                    ▼
     +-------------------------------------------------------------+
     |                 Chronology & Deadlines Engine               |
     |  - Letter dispatch date detection                           |
     |  - Citizen receipt date anchoring                           |
     |  - 30-day First Appeal limitation calculation (Sec 19(1))   |
     +------------------------------+------------------------------+
                                    │
                                    ▼
     +-------------------------------------------------------------+
     |            Appeal Preparation Draft & Disclaimer            |
     |  - Generates ground outline for First Appellate Authority   |
     |  - Clear legal educational disclaimer (Non-adversarial)     |
     +-------------------------------------------------------------+
```

## Safety and Non-Adversarial Guarantees
- The analyzer highlights exact verbatim response passages without asserting that the public authority acted with unlawful intent.
- Educational explanations are visibly distinguished from licensed advocate advice.
- Users can review, edit, and redact personal identifiers before exporting an appeal draft.
