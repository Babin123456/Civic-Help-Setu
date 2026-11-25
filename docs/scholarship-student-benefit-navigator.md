# Government Scholarship and Student Benefit Eligibility Navigator

## Problem Context
Students and low-income families frequently face difficulty distinguishing between central sector schemes, state-specific provisions, and category-based welfare scholarships. They encounter confusing renewal conditions, missed cycles, and DBT rejection due to unseeded bank accounts.

## Solution Architecture
1. **Source-Linked Directory (`scholarshipDirectoryData.js`)**:
   - Contains verified government scholarships with administering bodies, target demographics, income thresholds, eligible courses, benefit amounts, and official portal links.
2. **Transparent Navigator Engine (`scholarshipNavigatorService.js`)**:
   - Evaluates likely eligibility deterministically across state, caste/minority category, course, and family income.
   - Distinctly flags `LIKELY_ELIGIBLE`, `INELIGIBLE`, and `MORE_INFO_NEEDED` with plain-language explanations.
   - Highlights official decision-maker disclaimers to prevent false guarantees.
3. **Personalized Document Checklist**:
   - Generates actionable document preparation checklists (Caste Certificates, Income proof, e-Attestation, NPCI bank seeding) ready for printing or offline storage.
