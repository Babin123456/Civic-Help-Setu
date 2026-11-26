# Privacy-Safe Security Event Correlation and Alerting

## Executive Summary
Civic Help Setu processes sensitive public-interest data and citizen engagement inquiries. Maintaining high availability and integrity requires rapid detection of abusive behaviors—such as automated brute force, credential stuffing, and illicit bulk record exports—without transforming our security infrastructure into a surveillance mechanism or leaking Citizen Personally Identifiable Information (PII) into telemetry pipelines.

This architecture introduces an in-memory, privacy-preserving event correlation and alerting service designed to satisfy zero-knowledge security requirements.

---

## Threat Model & Core Detection Rules

1. **Authentication Velocity Anomalies (Brute Force / Stuffing)**:
   - Repeated failed login attempts against citizen or administrative portals.
   - Sliding window detection (e.g. 5 failed attempts in 3 minutes).
   - Generates `HIGH` severity alert with salted identifier hashes.

2. **Unusual Bulk Export Spikes**:
   - Extraction of citizen grievance records or scheme applications.
   - Volume thresholding (e.g., >100 records in 5 minutes).
   - Flags potential mass exfiltration for immediate review.

3. **Suspicious Post-Failure Role Elevation**:
   - Administrative role changes occurring shortly after multiple failed logins.
   - Immediate `CRITICAL` severity escalation.

---

## Privacy Architecture Principles

### Zero-PII Ingestion
- **Actor Anonymization**: All emails, citizen identifiers, or phone numbers are hashed with an internal salt before persistence (`act_xxxxxxxx`). Raw strings are discarded.
- **Payload Redaction**: High-risk fields (`token`, `password`, `secret`, `jwt`, `aadhaar`, `mobile`) are automatically purged or masked (`[REDACTED_PII]`).
- **Short-Lived Correlation IDs**: Ephemeral IDs (`corr_<time>_<rand>`) tie related signals together across distributed logs without revealing human identity.
- **Sliding-Window Buffer Pruning**: Events expire from working memory once sliding windows elapse, eliminating long-term residual footprints.

---

## Verification & Rollout Plan

- Unit test coverage validates event redaction, correlation rules, and window pruning.
- Can be wired directly to application event dispatchers or monitoring sidecars.
- Threshold parameters can be dynamically tuned per production telemetry environment.
- Strict zero-PII guarantees are validated by automated schema linter tests.

