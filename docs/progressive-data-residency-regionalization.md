# Progressive Data Residency and Regionalization Migration Plan

## Problem Statement
Under India's Digital Personal Data Protection (DPDP) Act and national public sector procurement norms, citizen personal data (e.g. Aadhaar details, grievance disclosures, income papers) must strictly reside within domestic geographical borders. Furthermore, regional disaster recovery migrations must not silently bypass residency boundaries.

## Architecture & Governance
1. **Data Classification Tiers**:
   - `PUBLIC_OPEN_DATA`, `INTERNAL_TELEMETRY`, `RESTRICTED_CITIZEN_PII`, `CRITICAL_IDENTITY_DATA`.
2. **Boundary Enforcement**:
   - Rejects writes/reads to international clouds for restricted data categories.
   - Enforces approved domestic regions: `in-mumbai-1`, `in-hyderabad-1`, `in-delhi-1`.
3. **Migration Checkpoints & Rollback**:
   - Progressively executes cross-region migrations with atomic status tracking.
   - Rollback scripts safely restore original regions without data loss.
