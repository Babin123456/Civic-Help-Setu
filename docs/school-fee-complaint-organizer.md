# School Fee Receipt and Unexplained Charge Complaint Organizer

## Context & Objectives
Parents and Parent-Teacher Associations frequently face unannounced fee hikes, mandatory vendor tie-ins, and miscellaneous unexplained levies (smart board fees, development funds, or building cess). Many do not know how to systematically compare invoices against official school circulars or how to approach State District Fee Regulatory Committees (DFRC).

## Key Architecture
1. **State School Fee Regulatory Frameworks (`schoolFeeRegulatoryData.js`)**:
   - Covers key state statutory acts (UP Fee Regulation Act 2018, Maharashtra Fee Regulation Act 2011, Delhi DSEAR 1973).
   - Specifies statutory fee hike caps (e.g. CPI + 5% rule) and District Magistrate grievance portals.
2. **Deterministic Invoice Reconciliation (`schoolFeeComplaintOrganizerService.js`)**:
   - Compares sanctioned circular items with actual receipts line-by-line.
   - Calculates arithmetic variances and flags unnotified miscellaneous line items.
3. **Neutral Parent Clarification Letter Generator**:
   - Generates constructive, polite clarification memos to school principals requesting detailed line-item justification prior to formal escalation.
4. **Privacy-Preserving**:
   - Performs comparisons in local memory without retaining student identity records.
