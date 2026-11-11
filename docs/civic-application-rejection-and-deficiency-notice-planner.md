# Civic Application Rejection and Deficiency Notice Response Planner

## Overview
When citizens receive a deficiency memo, rejection order, or request for additional information from a civic authority, they often struggle to identify the exact procedural defect, response deadline, and official remediation channel.

The `deficiencyNoticeResponsePlannerService` (`src/services/deficiencyNoticeResponsePlannerService.js`) provides an end-to-end, privacy-preserving workflow that extracts notice details, classifies statutory deadlines, maps defects to verified remediation guidance, and generates a user-editable correction checklist.

## Architectural Capabilities

### 1. Data Extraction & Provenance Traceability
- Parses application reference numbers, notice dates, issuing authorities, and defect clauses.
- Associates every extracted field with a confidence score and source page reference (from OCR blocks).
- Marks items as machine-extracted until reviewed and confirmed by the user (`isUserConfirmed`).

### 2. Deadline Verification & Classification
Deadlines are explicitly categorized into three distinct states to avoid misleading citizens:
- **`EXTRACTED`**: The notice prints an explicit calendar date (e.g., "submit on or before 28/03/2026").
- **`CALCULATED`**: The notice specifies a statutory relative window (e.g., "within 15 days of notice date"), computed from the verified notice date.
- **`UNVERIFIED`**: Conflicting dates are present across notice headers/dispatch stamps, or no deadline is mentioned. Flags the record for manual office confirmation.

### 3. Separation of Quoted Notice Text from AI Interpretation
- Strictly captures the exact quoted clause from the notice.
- Separately displays an interpretable plain-language summary of what the defect means.
- Links the identified defect code (e.g. `ADDRESS_PROOF_INVALID`, `INCOME_CERTIFICATE_EXPIRED`, `SIGNATURE_MISMATCH`, `FEE_PAYMENT_UNVERIFIED`) to verified official instructions and official portal URLs.

### 4. Interactive User Correction Checklist
- Converts extracted deficiencies into step-by-step action items.
- Allows applicants to mark items as resolved, add private notes, and review the recommended submission channel (`ONLINE_PORTAL`, `IN_PERSON_COUNTER`, or `APPELLATE_AUTHORITY`).

### 5. Privacy, Redaction & Ethical Safeguards
- **Export Redaction**: `redactNoticePlan()` strips Aadhaar numbers, PAN cards, phone numbers, email addresses, and custom applicant names before exporting or sharing.
- **No Automatic Submission / Guarantee**: The service includes an explicit disclaimer stating that responses are not automatically transmitted to government portals and that approval outcomes cannot be guaranteed.

## Verification & Testing
- Unit tests in `src/services/deficiencyNoticeResponsePlannerService.test.js` verify:
  - Clean single-deficiency notice extraction.
  - Multi-deficiency notices with concurrent defects.
  - Conflicting date detection triggering `UNVERIFIED` status.
  - Degraded OCR text and low-confidence fallback handling.
  - Sensitive identifier redaction before export.
