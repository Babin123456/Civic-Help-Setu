# Civic Data Quality Anomaly Detector for Service Catalogue Records

This document details the deterministic validation rules, statistical outlier detection engine, administrative review workflow, and audit logging for Civic Help Setu's Catalogue Anomaly Detector.

## Problem Statement
Crowdsourced and scraped civic service catalogues accumulate corrupted records over time:
1. Dead or insecure HTTP endpoints.
2. Impossible numeric entries (negative application fees, negative processing timelines).
3. Statistical anomalies (e.g. ₹5,000 recorded for an online ration card update where the statutory norm is ₹50).
4. Missing statutory jurisdictions causing nationwide misdirection.

Automated cleanup scripts that silently overwrite or delete official catalogue records can corrupt legitimate records or mask systemic portal shifts.

## Architectural Pipeline

```
   [ Incoming / Existing Service Catalogue Records ]
                          │
                          ▼
   +-------------------------------------------------------------+
   |            Deterministic Schema & Value Validator           |
   |  - Mandatory metadata presence (Name, Authority, State)     |
   |  - Secure HTTPS URL syntax verification                     |
   |  - Impossible numeric bounds (fee < 0, days <= 0 or > 365)  |
   |  - Date chronology validation (effective vs publication)    |
   +------------------------------+------------------------------+
                                  │
                                  ▼
   +-------------------------------------------------------------+
   |            Statistical Outlier Detection Engine             |
   |  - Category-level mean and standard deviation benchmarks    |
   |  - Flags values exceeding > 3.0 standard deviations (Z-score)|
   |  - Prioritizes severe fee and turnaround anomalies          |
   +------------------------------+------------------------------+
                                  │
                                  ▼
   +-------------------------------------------------------------+
   |              Administrator Triage & Resolution              |
   |  - ZERO silent automated data rewrites                      |
   |  - Flag state: OPEN_FLAG -> ASSIGNED -> RESOLVED / DISMISSED|
   |  - Preserves resolution notes, admin ID, and timestamps     |
   +-------------------------------------------------------------+
```

## Governance & Safety Safeguards
- **Zero Silent Mutation**: The anomaly detector flags discrepancies and generates audit logs, but never mutates live production data without human confirmation.
- **Explainable Anomaly Reasons**: Every flag indicates the anomaly type, severity level, current value, cohort baseline, and exact error message.
- **Resolution Tracking**: Admins can dismiss legitimate outliers (e.g. free statutory services) with explicit justification notes.
