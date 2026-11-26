# Policy Change Impact Analyzer Across Forms, Eligibility and Guidance

## Problem Overview
When central or state governments amend circulars (e.g. altering OBC creamy layer income ceilings, qualifying dates for voter registration, or fee waivers), changes frequently fail to propagate uniformly across application forms, eligibility rules, and public guidance pages.

## Key Architecture
1. **Asset Dependency Graph**:
   - Links policies directly to affected form schemas (`FORM_SCHEMA`), rule evaluators (`ELIGIBILITY_RULE`), and citizen guides (`PUBLIC_GUIDE_PAGE`).
2. **Impact Severity Scoring**:
   - Classifies blast radius into `LOW`, `MEDIUM`, or `HIGH_BREAKING` based on whether core logic or multiple assets are touched.
3. **Domain Lead Sign-Off Gate**:
   - Mandates approval by designated domain leads before promoting policy diffs into production pipelines.
4. **Reproducible Diff Previews**:
   - Generates deterministic delta reports capturing previous values and proposed transformations.
