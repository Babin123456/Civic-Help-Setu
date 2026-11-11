# Public Budget-to-Service Explainer

## Overview
Municipal and state government budget documents (such as Demands for Grants and Annual Financial Statements) are dense and technical, making it difficult for citizens to understand how public money translates into local services like roads, drainage, solid waste management, and public health.

The `budgetToServiceExplainerService` (`src/services/budgetToServiceExplainerService.js`) introduces a RAG-backed public expenditure explainer linking technical budget heads to plain-language civic categories while preserving exact page and table citations.

## Key Capabilities

### 1. Document Provenance Preservation
- Every financial figure recorded in the system requires strict provenance:
  - `docTitle`: Exact publication title (e.g., GCC Annual Budget Estimates 2025-26).
  - `pageNumber`: Specific page number in the published report.
  - `tableId`: Distinct table or financial schedule identifier.
  - `sourceUrl`: Direct link to official public document where hosted.
- The service rejects budget ingestion lacking provenance to eliminate hallucinated financial figures.

### 2. Distinction Between Financial and Physical Metrics
The explainer separates four distinct lifecycle metrics:
- **Budget Allocation (BE)**: Approved spending ceiling at the start of the fiscal year.
- **Revised Estimate (RE)**: Adjusted allocation reflecting mid-year revisions.
- **Actual Expenditure**: Disbursed funds recorded in accounts.
- **Physical Completion %**: Ground inspection status of the physical asset.
- **Strict Guardrail**: The service explicitly prevents equating financial expenditure with completed physical infrastructure (e.g. 100% fund disbursement does not guarantee a completed road).

### 3. Unit Normalization & Comparison Safety
- Standardizes financial figures across Crores, Lakhs, and base INR (`toBaseInr`).
- Prevents silent unit mixing during cross-year comparisons.
- Automatically flags non-comparable categories or missing fiscal year records.

### 4. Plain-Language Civic Breakdown with Citations
- `generateServiceBudgetSummary()` translates technical account heads into clear public summaries.
- Reports initial allocation, finalized expenditure, fund utilization percentage, physical progress, and an inline citation to the original official document page and table.

## Verification & Testing
- Unit tests in `src/services/budgetToServiceExplainerService.test.js` verify:
  - Valid budget ingestion with provenance retention.
  - Strict provenance requirement enforcement.
  - Independent tracking of physical completion vs. actual expenditure.
  - Multi-year comparison math across disparate units (Crores vs. Lakhs).
  - Non-comparable category and missing year rejection.
  - Plain-language summary generation with citations.
