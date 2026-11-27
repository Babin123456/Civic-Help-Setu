# Lost Government Document Recovery and Reissue Navigator

This document details the functional specifications, document catalog, prerequisite logic (police reports and affidavits), and privacy-first checklist management for Civic Help Setu's Document Recovery Navigator.

## Problem Statement
Indian citizens who misplace or lose critical identity documents (Aadhaar, PAN Card, Driving Licence, Voter ID, Ration Card) frequently face confusion regarding:
1. Whether an instant, legally equivalent digital copy (via DigiLocker or UIDAI/MoRTH) suffices, or if a physical duplicate is required.
2. Whether a Police Lost Property Report (Non-Cognizable Report - NCR) or a notarized stamp-paper affidavit is legally mandatory before applying for a duplicate.
3. How to proceed when loss occurs due to special circumstances like natural calamities (floods, cyclones), house fires, theft, or relocation.

Guessing requirements leads to rejected applications at RTO counters, wasted stamp duty, and unnecessary visits to local police stations.

## Architecture & Prerequisite Decision Matrix

```
                     [ Citizen Lost Document Query ]
                     (Document Type + Reason of Loss)
                                    │
                                    ▼
       +---------------------------------------------------------+
       |             Prerequisite Evaluation Engine              |
       |  - Aadhaar: No Police NCR needed for online PVC order   |
       |  - PAN: No Police NCR needed if PAN number known        |
       |  - Driving Licence: Police NCR + Affidavit MANDATORY    |
       |  - Voter ID (Form 8): Police NCR required if "Lost"     |
       |  - Theft: Police NCR ALWAYS required for fraud defense  |
       |  - Flood / Fire: Relief camp certificate substitutes    |
       +----------------------------+----------------------------+
                                    │
                                    ▼
       +---------------------------------------------------------+
       |              Multi-Stage Recovery Plan                  |
       |  1. Instant Digital Retrieval (DigiLocker / e-Portal)   |
       |  2. Police Lost Article Report (Online NCR PDF)         |
       |  3. Notarized Self-Declaration Affidavit                |
       |  4. Official Duplicate Reissue Order & Statutory Fee    |
       +----------------------------+----------------------------+
                                    │
                                    ▼
       +---------------------------------------------------------+
       |           Client-Side Personal Checklist Tracker        |
       |  - Save, reopen, toggle, and delete checklist           |
       |  - ZERO exposure of personal identity numbers (PII)     |
       |  - Linked to verified official portal destinations      |
       +---------------------------------------------------------+
```

## Supported Documents Catalog

| Document | Issuing Authority | Statutory Reprint Fee | Police NCR Required? | Digital e-Copy Available? |
|---|---|---|---|---|
| **Aadhaar Card** | UIDAI | ₹50 | No (unless identity theft suspected) | Yes (e-Aadhaar free) |
| **PAN Card** | Income Tax Dept / Protean | ₹50 | No (if PAN known) | Yes (e-PAN PDF) |
| **Driving Licence** | MoRTH / State RTOs | ₹200 | **Yes (Mandatory)** | Yes (DigiLocker valid under IT Act) |
| **Voter ID (EPIC)** | Election Commission of India | ₹0 (Form 8 replacement) | **Yes (if replacement reason is Lost)** | Yes (e-EPIC free) |
| **Ration Card** | State Food & Civil Supplies | ₹45 | **Yes (State dependent)** | Yes (Mera Ration app) |

## Data Provenance & Safety
- **No Speculative Advice**: If a document type or municipal jurisdiction is unverified in our catalog, the system explicitly returns `UNAVAILABLE_DATA` rather than guessing.
- **Zero Credential Collection**: Citizens are directed to authoritative government portals (`uidai.gov.in`, `sarathi.parivahan.gov.in`, `voters.eci.gov.in`); passwords, biometric data, or OTPs are never solicited.
