# Multilingual Side-by-Side Civic Instruction Reader with Terminology Alignment

## Purpose & Scope
When citizens read civic procedures in Indian languages, isolated machine translations frequently distort legal terminology, alter statutory section references, or omit fee figures.

This service establishes a synchronized bilingual reader:
- Aligns source paragraphs (English/Official Gazette) side-by-side with target Indian languages (Hindi, Bengali, Tamil, Telugu, Kannada, Marathi).
- Enforces an automated token preservation auditor that catches corrupted numeric values, currency amounts (`₹`), and legislative section citations (`Section 14`).
- Maintains an aligned terminology glossary where technical civic phrases map explicitly to their statutory definitions.

---

## High-Priority Aligned Civic Glossary
- **Affidavit**: *शपथ पत्र* (Hindi) / *হলফনামা* (Bengali) / *பிரமாண பத்திரம்* (Tamil).
- **Encumbrance Certificate**: *भारमुक्त प्रमाण पत्र* (Hindi) / *দাবিমুক্ত শংসাপত্র* (Bengali) / *வில்லங்க சான்றிதழ்* (Tamil).
- **Property Mutation**: *दाखिल खारिज / नामांतरण* (Hindi) / *নামজারি* (Bengali) / *பட்டா மாறுதல்* (Tamil).

---

## Token Invariant Preservation Rules

$$\text{Preserved Invariants} = \{ \text{Currency } (₹), \text{Numeric Quantities, Statutory Sections } (\text{Section } n), \text{Designated Authority Roles} \}$$

Any translation draft where numeric tokens are dropped or altered is automatically withheld from `REVIEWED_HUMAN_VERIFIED` publication and flagged for human editorial correction.

---

## Translation Lifecycle States
1. `DRAFT_AI_SUGGESTION`: Initial draft translation generated using high-accuracy open translation models. Visibly badged as *Draft / Unverified*.
2. `REVIEWED_HUMAN_VERIFIED`: Translation audited and approved by bilingual civic domain editors.
3. `FLAGGED_MISTRANSLATION`: Paragraph quarantined following community or legal practitioner feedback.

---

## Citizen Mistranslation Feedback Loop
Citizens can highlight any translated sentence or legal term and submit a proposed correction. Reports enter the editorial review queue with source tracking, ensuring ongoing linguistic refinement.
