# Civic Benefit Disbursement and Payment-Status Reconciliation Workspace

## Overview
Citizens receiving statutory benefits (such as PM-KISAN, state old-age and widow pensions, or welfare grants) frequently navigate payment delays, banking gateway reversals, and missing instalments without insight into where the transaction stalled.

The `benefitDisbursementReconciliationService` (`src/services/benefitDisbursementReconciliationService.js`) provides a user-controlled reconciliation workspace allowing citizens to track expected vs. received instalments, flag discrepancies, and access verified grievance redressal channels without claiming direct integration with government banking networks.

## Key Capabilities

### 1. User-Controlled Benefit Tracking
- Records sanction order details, scheme names, instalment numbers, sanctioned amounts, and transaction references.
- Allows citizens to update receipt dates and annotate records with personal notes.

### 2. Distinction Between Self-Reported and Verified Status
Statuses are categorized transparently:
- `EXPECTED`: Scheduled based on scheme disbursement calendar.
- `USER_REPORTED_RECEIVED`: Citizen recorded credit confirmation.
- `PENDING_CONFIRMATION`: Sanction issued or submitted but awaiting bank credit.
- `DISPUTED_DELAYED`: Elapsed beyond statutory SLA timeframe.
- `REVERSED_OR_FAILED`: Transaction failed or credited back to treasury.
- `UNKNOWN`: Ambiguous status requiring manual review.

The tier `verificationStatus` clearly separates self-reported citizen records from official PFMS public extracts or treasury scrolls.

### 3. Strict Banking Credential Protection
- The service enforces a zero-trust financial privacy boundary:
  - Full bank account numbers, PINs, CVVs, OTPs, and net-banking credentials are strictly rejected.
  - Only safe masked references (e.g. `••••4321`) are accepted.

### 4. Anomaly & Discrepancy Reconciliation
`reconcileBenefitTimeline()` automatically identifies:
- **Duplicate Instalments**: Flags multiple entries claiming the same instalment number for a given scheme.
- **Payment Reversals**: Highlights failed transactions needing bank NPCI Aadhaar-mapping intervention.
- **Partial Disbursements**: Calculates shortfalls between statutory sanctions and actual received amounts.
- **Overdue Payments**: Alerts when expected dates have passed without receipt.

### 5. Official Jurisdiction-Specific Redressal Guidance
Maps delayed transactions to verified government portals and toll-free assistance:
- **Central**: PFMS Public Portal (`pfms.nic.in`), Central DBT Mission Helpline.
- **Tamil Nadu**: Integrated Financial and Human Resources Management System (`treasury.tn.gov.in`), e-Sevai / Special Tahsildar counters.
- **Maharashtra**: Aaple Sarkar DBT (`mahadbt.maharashtra.gov.in`), NPCI Aadhaar seeding facilitation.

### 6. Redacted Payment Chronology Export
Generates formatted payment timelines with masked transaction references and masked bank accounts, formatted for grievance petitions or RTI applications.

## Verification & Testing
- Unit tests in `src/services/benefitDisbursementReconciliationService.test.js` verify:
  - Valid event recording with account masking.
  - Strict rejection of banking credentials and full account numbers.
  - Duplicate instalment anomaly detection.
  - Payment reversal and partial disbursement calculation.
  - Jurisdiction redressal instruction retrieval.
  - Redacted chronological timeline export.
