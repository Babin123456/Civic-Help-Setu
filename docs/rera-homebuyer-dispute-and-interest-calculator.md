# RERA Homebuyer Delayed Possession, Statutory Interest & Dispute Workspace

## 1. Overview & Statutory Background

Under the **Real Estate (Regulation and Development) Act, 2016 (Central Act No. 16 of 2016)**, allottees in registered real estate projects have explicit statutory protections against builder defaults, prolonged possession delays, unilateral layout changes, and structural defects.

Prior to this implementation, homebuyers facing delayed possession lacked a dedicated, transparent tool to compute their statutory interest entitlement under Section 18, evaluate 5-year structural defect warranties under Section 14(3), or draft standard Form 'M' / Form 'N' complaints for submission to State Real Estate Regulatory Authorities (MahaRERA, K-RERA, UP RERA, HRERA, TNRERA, GujRERA, Delhi RERA).

This workspace (`/rera-dispute-workspace` and `/rera-homebuyer-rights`) introduces:
1. **Deterministic Statutory Delay Interest Engine:** Computes delayed possession interest benchmarked to **SBI Highest Marginal Cost of Funds Based Lending Rate (MCLR) + 2.0% per annum** as mandated by state RERA rules.
2. **Statutory Relief Bifurcation:**
   - **Option A (Withdrawal & Refund - Section 18(1) 1st Proviso):** Full return of principal amount paid + statutory interest + compensation.
   - **Option B (Stay in Project - Section 18(1) 2nd Proviso):** Monthly delay compensation until actual physical possession with valid Occupancy Certificate (OC).
3. **Section 14(3) 5-Year Structural Defect & 30-Day Rectification SLA Tracker:** Enforces promoter obligation to rectify structural flaws, workmanship defects, and service breakdowns without charge within 30 days of written notice.
4. **Section 4(2)(l)(D) 70% Dedicated Escrow Account Audit Engine:** Evaluates statutory escrow deposits against physical milestone completion to detect unauthorized fund diversion and Section 60/61 penal liability.
5. **Form 'M' & Form 'N' Legal Petition Drafter:** Auto-generates standard statutory complaint memorandums with verified calculations, interim prayer clauses, and verification statements ready for portal filing.
6. **Section 40 Execution Petition & Revenue Recovery Certificate (RRC) Drafter:** Tracks post-order 60-day compliance deadlines, computes running statutory interest on unpaid decrees, and drafts execution petitions to the District Collector and Enforcement Bench.
7. **Section 43(5) & Section 44 REAT Appellate Workspace:** Validates mandatory 100% promoter pre-deposit thresholds (*Newtech Promoters*, 2021), drafts summary dismissal objection petitions, and prepares Section 44 appeal memorandums.
8. **Client-Side Privacy Vault (`civicbridge_rera_complaints`):** Client-side offline-first persistence with DPDP-compliant PII minimization and canonical SHA-256 digital seals.

---

## 2. Statutory Benchmarks & Calculation Models

### 2.1 Prescribed Rate of Interest (SBI MCLR + 2%)
Under Rule 18 (MahaRERA), Rule 15 (Karnataka RERA), Rule 16 (UP RERA), Rule 18 (HRERA), and Rule 19 (TNRERA), the prescribed rate of interest payable by the promoter to the allottee (and vice versa) equals the State Bank of India's highest 1-Year MCLR plus two percent:

$$\text{Prescribed Rate} = \text{SBI MCLR} + 2.0\%$$

Currently, with SBI's benchmark 1-Year MCLR at 8.75%, the statutory rate evaluates to **10.75% per annum**.

### 2.2 Simple Delay Interest Computation
Interest accumulates daily starting from the effective committed possession deadline (including contractual grace periods) up to the evaluation date or actual possession handover date:

$$\text{Accrued Interest} = \text{Principal Paid} \times \left(\frac{\text{Statutory Rate}}{100}\right) \times \left(\frac{\text{Days of Delay}}{365}\right)$$

### 2.3 Monthly Delay Compensation
For allottees opting to stay in the project (Section 18 Proviso 2):

$$\text{Monthly Compensation} = \text{Principal Paid} \times \left(\frac{\text{Statutory Rate}}{100}\right) \div 12$$

---

## 3. Section 14 Structural Defect Warranty & 30-Day Notice SLA

Under Section 14(3) of RERA 2016:
- **5-Year Warranty Period:** Extends for 5 years from the date of physical possession handover.
- **Scope:** Covers structural defects, poor workmanship, substandard materials, or defective provision of amenities (plumbing, fire systems, lifts).
- **Promoter Rectification Duty:** Promoter is statutorily bound to rectify the defect without further charge within **30 days** of receiving written notice from the allottee.
- **Adjudicating Officer Remedy:** If promoter neglects or fails to rectify within 30 days, allottee is entitled to compensatory damages adjudicated under Section 71.

---

## 4. Statutory Forum Differentiation: Form M vs Form N

| Dimension | Form 'M' (Section 31) | Form 'N' (Section 71) |
|---|---|---|
| **Presiding Forum** | Real Estate Regulatory Authority (Full Bench / Single Member) | Adjudicating Officer (Judicial Officer / District Judge rank) |
| **Primary Scope** | Directives to promoter, delay interest under Sec. 18, direction to complete project, OC handover, revoking illegal cancellations. | Adjudging quantum of compensatory damages for mental agony, litigation costs, defect damages under Sec. 12, 14, 18, 19. |
| **Standard Filing Fee** | ₹1,000 to ₹5,000 depending on state. | ₹1,000 to ₹5,000 depending on state. |
| **Statutory SLA** | Section 29(4) mandates disposal within 60 days. | Section 71(3) mandates inquiry within 60 days. |
| **Appellate Forum** | Real Estate Appellate Tribunal (REAT) under Section 43/44 within 60 days. | Real Estate Appellate Tribunal (REAT) under Section 43/44 within 60 days. |

---

## 5. Offline Privacy & Cryptographic Verification

All complaint dossiers created in the workspace:
- Persisted locally in browser storage under `civicbridge_rera_complaints`.
- Automatically registered in `USER_DATA_STORES` within `src/services/privacyConsentService.js` and cleared upon user request.
- PII sanitized via `minimizeForExternal()` to mask phone numbers, street names, and unit numbers prior to export.
- Integrity verified via deterministic canonical JSON SHA-256 seal (`computeComplaintDigest`), alerting users in case of offline data tampering.
- Exportable as printable plain-text complaint petitions and signed JSON evidence dossiers.

---

## 6. Testing & Quality Verification

Run unit and component tests:
```bash
npx vitest run src/services/reraDisputeService.test.js src/services/reraDisputeStorage.test.js src/components/rera/ReraInterestCalculator.test.jsx src/components/rera/ReraExecutionWarrantCard.test.jsx src/components/rera/ReraAppellateMemoCard.test.jsx src/components/rera/ReraEscrowAuditCard.test.jsx src/pages/ReraDisputeWorkspace.test.jsx
```

Run ESLint verification:
```bash
npx eslint src/services/reraDisputeService.js src/services/reraDisputeStorage.js src/components/rera/ReraInterestCalculator.jsx src/components/rera/ReraDefectLiabilityCard.jsx src/components/rera/ReraPetitionDrafter.jsx src/components/rera/ReraEvidenceChecklist.jsx src/pages/ReraDisputeWorkspace.jsx
```

Run security check and production build:
```bash
npm run lint:security
npm run build
```
