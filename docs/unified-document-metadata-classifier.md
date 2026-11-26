# Unified Document Metadata and Classification Service

## Purpose
Citizen document uploads (identity cards, income certificates, land records, electricity bills) must be reliably categorized without treating unreliable OCR text as verified legal fact.

## Architecture & Principles
1. **Confidence Thresholding**:
   - Documents meeting classification criteria with $\ge 0.75$ confidence are marked `PROVISIONALLY_CLASSIFIED`.
   - Low-confidence or ambiguous documents are automatically flagged `ROUTED_TO_HUMAN_VERIFICATION`.
2. **Immutable Versioning**:
   - Every classification change (initial AI guess vs. official verifier override) is appended to an audit `versionHistory` trail.
3. **Safety Guarantee**:
   - `isOcrVerifiedAsFact` remains `false` by default, ensuring downstream eligibility engines require verified citizen confirmation.
