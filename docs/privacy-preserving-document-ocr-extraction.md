# Privacy-Preserving Document OCR and Field-Extraction Assistant

This document outlines the privacy architecture, document classification models, field-extraction capabilities, and legal disclaimers implemented for the Civic Help Setu Document Assistant.

## Overview
Citizens applying for Indian public schemes frequently face document rejection due to mismatching names, missing dates of birth, expired identification proofs, or illegible uploads.

The **Privacy-Preserving Document OCR and Field-Extraction Assistant** provides immediate client-side verification of document readiness without sending raw personal records to remote servers or retaining user scans.

## Architectural Principles

```
    [ Citizen Uploads Document ] (Local Device)
                 │
                 ▼
    [ Client-Side OCR / In-Memory Parser ]
                 │
                 ├──► [ Document Type Classifier ] (Aadhaar / PAN / DL / Voter ID / Income)
                 │
                 ├──► [ Field Extractor ]
                 │       ├── Full Name
                 │       ├── Date of Birth
                 │       ├── Identifier Masking (XXXX-XXXX-1234, ABXXXXXX4F)
                 │       └── Validity / Expiry Dates
                 │
                 ├──► [ Service Checklist Evaluation ]
                 │       ├── Name verification
                 │       ├── DOB verification
                 │       └── Document validity check
                 │
                 ▼
    [ Zero-Retention Assurance + Citizen Legal Disclaimer ]
    "Does not declare legal eligibility or guarantee official acceptance."
```

## Privacy & Security Protections
1. **Zero Retention Policy (`ZERO_RETENTION_CLIENT_ONLY`)**: Raw document images and extracted text buffers are processed in transient memory and discarded immediately upon component unmount.
2. **Deterministic PII Masking**: High-sensitivity identifiers (Aadhaar 12-digit UID and PAN 10-character alphanumeric strings) are masked deterministically (`maskSensitiveField`) prior to rendering or logging.
3. **No Legal Eligibility Guarantee**: The assistant explicitly guides checklist completeness and highlights missing fields, but leaves statutory adjudication strictly to designated public authorities.
