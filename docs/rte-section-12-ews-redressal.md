# Right to Education (RTE) Section 12(1)(c) EWS/DG Quota Admission, Illegal Screening & Fee Refund Redressal Workspace

## 1. Overview & Statutory Framework

Under the **Right of Children to Free and Compulsory Education (RTE) Act, 2009**, enacted under **Article 21A of the Constitution of India**, every child between the ages of 6 and 14 possesses a fundamental legal entitlement to free and compulsory elementary education.

To dismantle systemic educational segregation and ensure inclusive access, **Section 12(1)(c)** mandates that all private unaided non-minority schools reserve **at least 25% of the strength of entry-level classes (pre-school / nursery / Class 1)** for children belonging to:
1. **Economically Weaker Sections (EWS):** Families whose annual household income falls below the respective State Government notified ceiling (ranging from ₹1,00,000 to ₹3,50,000).
2. **Disadvantaged Groups (DG):** Scheduled Castes (SC), Scheduled Tribes (ST), Socially and Educationally Backward Classes (OBC-NCL), Children with Disabilities under the Rights of Persons with Disabilities (RPwD) Act 2016, Orphans, Transgender children, and children of HIV-affected families.

Despite clear judicial affirmations, parents encounter pervasive illegal hurdles:
- Arbitrary denial of admission following official government lottery allotments.
- Subjecting 3-to-7-year-old children or their parents to prohibited screening tests and interviews.
- Demands for capitation donations or auxiliary expenses (textbooks, uniforms, activity/computer fees) that are required to be completely free.
- Absence of standardized, legally grounded petitions to Block Education Officers (BEO), District Education Officers (DEO), and Child Rights Commissions (SCPCR / NCPCR).

This workspace (`/rte-quota-workspace`, `/rte-admission-audit`, `/rte-screening-redressal`) delivers an end-to-end statutory evaluation, penalty auditor, fee reconciler, petition generator, and cryptographic evidence vault.

---

## 2. Key Statutory Provisions & Civil Liabilities

### 2.1 Section 12(1)(c) & 12(2) Quota & State Reimbursement
- **Section 12(1)(c):** Mandates unaided private schools to admit at least 25% children from EWS and DG in Class 1 or pre-school entry.
- **Section 12(2):** Provides that the school shall be reimbursed expenditure incurred per child by the State Government (capped at the State's per-child expenditure in government schools).
- **Prohibition on Passing Costs:** The school is strictly barred from recovering any deficit or auxiliary costs from the admitted child or their family.

### 2.2 Section 13: Prohibition of Capitation Fee & Screening Procedure
- **Section 13(1):** No school or person shall, while admitting a child, collect any capitation fee or subject the child or their parents/guardians to any screening procedure.
- **Section 13(2)(a) Penal Liability:** Collecting capitation fee is punishable with a fine which may extend to **10 times the capitation fee charged**.
- **Section 13(2)(b) Penal Liability:** Subjecting a child to any screening procedure is punishable with fine up to **₹25,000 for the first contravention** and **₹50,000 for each subsequent contravention**.

### 2.3 Section 3(2): Mandatory Free Elementary Entitlement
- No child admitted to elementary education shall be liable to pay any kind of fee or charges or expenses which may prevent them from pursuing and completing elementary education.
- Textbooks, workbooks, two sets of uniforms, shoes, writing materials, and laboratory access must be provided without cost.

### 2.4 Section 14 & 15: Age & Admission Proof Protections
- **Section 14(2):** No child shall be denied admission in a school for lack of age proof (birth certificate, hospital card, anganwadi record, or parent affidavit).
- **Section 15:** A child shall not be denied admission even if such admission is sought after the extended date.

### 2.5 Section 18: Withdrawal of School Recognition
- Any school operating without or in persistent breach of statutory RTE conditions faces withdrawal of recognition and daily compounding fines of up to ₹10,000 per day under Section 18(5).

---

## 3. Landmark Jurisprudence

### 3.1 Society for Unaided Private Schools of Rajasthan v. Union of India (2012) 6 SCC 1
- The Supreme Court upheld the constitutional validity of Section 12(1)(c) across all unaided non-minority private schools in India.
- The Court affirmed that educational institutions perform a public function and cannot plead commercial autonomy to bypass social affirmative obligations.

### 3.2 Pramati Educational & Cultural Trust v. Union of India (2014) 8 SCC 1
- A 5-judge Constitution Bench re-affirmed that Section 12(1)(c) applies universally to private unaided non-minority educational institutions as part of the basic right under Article 21A.

### 3.3 State High Court Directives on Auxiliary Levies
- The High Court of Delhi (*Justice for All v. Govt. of NCT of Delhi*) and Allahabad High Court have repeatedly ruled that demanding fees for books, uniforms, smart class fees, or development charges from EWS students is unlawful and amounts to contempt of statutory mandate.

---

## 4. Section 32 Redressal & SCPCR/NCPCR Procedure

Under **Section 32 of the RTE Act 2009**:
1. **Filing Written Complaint:** Any aggrieved parent or citizen may submit a formal complaint in writing to the Competent Local Authority (Block Education Officer / District Education Officer).
2. **Three-Month Statutory Determination:** The Local Authority is statutorily mandated to decide the matter and grant redressal within three (3) months.
3. **Appellate Recourse:** Appeals and urgent escalation lie directly before the **State Commission for Protection of Child Rights (SCPCR)** under Section 31 and the **National Commission for Protection of Child Rights (NCPCR)** under the Commissions for Protection of Child Rights Act, 2005.

---

## 5. Architectural & Technical Specifications

| Component / Layer | Path | Responsibility |
|---|---|---|
| Workspace Page | `src/pages/RteAdmissionWorkspace.jsx` | Tabbed dashboard, telemetry, vault integration |
| Eligibility Matrix Card | `src/components/rte/RteEligibilityMatrixCard.jsx` | State threshold, age, category, catchment evaluation |
| Capitation Auditor Card | `src/components/rte/CapitationFeeAuditorCard.jsx` | Section 13 10x capitation fine and screening penalties |
| Free Entitlement Card | `src/components/rte/FreeEntitlementReconcilerCard.jsx` | Section 3(2) auxiliary fee overcharge reconciler |
| Section 32 Drafter | `src/components/rte/RtePetitionDrafter.jsx` | Formal legal representation generator for BEO/SCPCR |
| Core Domain Engine | `src/services/rteAdmissionService.js` | Pure algorithmic calculations and statutory logic |
| Offline Cryptographic Vault | `src/services/rteAdmissionStorage.js` | SHA-256 seal generator, tamper audit, DPDP minimization |
