# Insurance Claim Rejection and Grievance Pathway Explainer

## Context & Objectives
Policyholders frequently face devastating claim denials for health, motor, or life insurance. Insurers often cite boilerplate clauses (alleged non-disclosure of past medical conditions, delayed intimations, or room-rent proportionalities) without explaining statutory protections or escalation avenues.

## Key Capabilities
1. **Product-Wise Repudiation Deconstruction (`irdaiGrievanceData.js`)**:
   - Health Insurance: Exposes statutory Moratorium Period rules (cannot repudiate for PED after 60 months continuous renewal).
   - Motor Insurance: Highlights Supreme Court precedents prohibiting rejection solely for intimation delays when FIR was filed.
   - Life Insurance: Details Section 45 3-year incontestability safeguards.
2. **Step-by-Step Grievance Progression (`insuranceClaimGrievanceService.js`)**:
   - Level 1: Insurer Grievance Redressal Officer (GRO).
   - Level 2: IRDAI Bima Bharosa Portal (https://bimabharosa.irdai.gov.in).
   - Level 3: Council for Insurance Ombudsmen (claims up to ₹50 Lakhs).
3. **Medical Privacy & Neutrality Safeguards**:
   - Explicit warnings against uploading unredacted diagnostic reports.
   - Neutral guidance clarifying that final liability requires reading specific policy schedules.
