# Senior Citizen Maintenance & Property Protection Tribunal Workspace (#858)

## 1. Overview & Statutory Background

Under *The Maintenance and Welfare of Parents and Senior Citizens Act, 2007* (Act No. 56 of 2007), senior citizens (aged 60+) and elderly parents have an unalienable statutory right to claim maintenance, basic physical amenities, and physical safety from their adult children or legal heirs.

Prior to #858, elderly citizens in distress had access only to informational ID guides without practical tooling to calculate equitable maintenance, evaluate Section 23 property gift deed revocation grounds, draft legally formatted Sub-Divisional Magistrate (SDM) tribunal petitions, or enforce the statutory 90-day inquiry ceiling.

This feature introduces a comprehensive, offline-first, privacy-preserving **Senior Citizen Maintenance & Property Protection Tribunal Workspace** (`/senior-citizen-tribunal`) supporting:
1. **Statutory Case Classification:** Form A (Maintenance & Medical), Form B (Section 23 Property Revocation), Form C (Interim Urgent Relief), Form D (Conciliation Settlement).
2. **Equitable Maintenance & Sibling Apportionment Calculator:** Mathematically computes monthly essential needs (food, shelter, geriatric medicine, diagnostic care, caregiver allowances) and distributes liability across adult children based on income and inheritance benefits.
3. **Section 23 Property Revocation Validator:** Evaluates gift/settlement deeds against statutory conditions and binding High Court precedents.
4. **90-Day Statutory SLA Tracker & Appellate Escalator:** Tracks the 90-day statutory ceiling under Section 5(6) and auto-drafts Section 16 Appellate Appeals to the District Magistrate (DM) when deadlines are breached.
5. **Local Privacy Locker & Cryptographic Dossier Export:** Client-side offline storage (`civicbridge_senior_tribunal_petitions`) with automated PII scrubbing and canonical SHA-256 digital seals.

---

## 2. Statutory Architecture & Workflows

### 2.1 Jurisdiction & Presiding Authority
- **Primary Forum:** Maintenance Tribunal presided over by the Sub-Divisional Magistrate (SDM) / Revenue Divisional Officer (RDO) in the district where the parent resides or where the children reside (Section 7).
- **Appellate Forum:** Appellate Tribunal presided over by the District Magistrate / Deputy Commissioner (Section 16).
- **Bar of Advocates:** Section 17 bars legal practitioners from representing parties before the Tribunal without special leave, necessitating self-contained, plain-language petitions for citizens.

### 2.2 Case Types
| Code | Name | Statutory Provision | Purpose |
|---|---|---|---|
| `FORM-A` | Monthly Maintenance & Medical Relief | Sections 4 & 5 | Living, food, shelter, and medical reimbursement claims. |
| `FORM-B` | Section 23 Property Revocation & Eviction | Section 23 | Declaring gift/settlement deed void and evicting abusive occupants. |
| `FORM-C` | Urgent Interim Maintenance & Eviction | Section 5(2) | Immediate monthly relief payable during inquiry pendency. |
| `FORM-D` | Conciliation Conference & Settlement | Section 6 | Mediated agreement with Conciliation Officer enforceable as a decree. |

---

## 3. Equitable Maintenance Apportionment Algorithm

Section 4(2) mandates that the obligation of children/relatives to maintain a parent extends to the need of such citizen to lead a normal life. When multiple adult children exist:

```
Net Deficit = (Food + Shelter + Medical + Caregiver + Other) - Parent's Own Income
```

Liability is apportioned in proportion to each respondent's monthly earnings:
```
Weight = Respondent Monthly Income / Total Respondent Income
```
If a respondent has already received ancestral or self-acquired parental property via gift or settlement, a **+15% liability multiplier** is applied under the equitable doctrine of unjust enrichment.

### Historical Statutory Cap vs Judicial Precedents
While Section 9(2) originally noted a cap of ₹10,000/month, various High Courts (including the Delhi High Court and Bombay High Court) have established that the ₹10,000 threshold serves as an illustrative floor rather than an inflexible ceiling when medical and 24/7 caregiving necessities exceed that figure.

---

## 4. Section 23 Property Transfer Revocation & Eviction

Section 23(1) of the Act establishes that where any senior citizen has transferred property (by gift or otherwise) subject to the condition that the transferee shall provide basic amenities, and the transferee fails or refuses to do so, the transfer of property is deemed to have been made by fraud or coercion or under undue influence, and **is void at the option of the transferor**.

### Landmark Precedents Integrated
- **Sunny Paul v. State of NCT Delhi (Delhi HC):** Affirmed that the Maintenance Tribunal possesses summary jurisdiction to order the eviction of children/relatives from a senior citizen's house to secure their peaceful possession.
- **Manmohan Singh v. Surya Kant (P&H HC):** Held that adult children residing in a parent's house are licensees whose license is terminable at will upon harassment or neglect.
- **Sudesh Chhikara v. Ramti Devi (Supreme Court 2022):** Clarified the evidentiary standard required to establish explicit or implied conditions of maintenance at the time of deed execution.

---

## 5. 90-Day Statutory SLA & Inquiry Phases

Section 5(6) mandates that the Tribunal dispose of the application within **90 days** from the date of notice service:
- **Days 1–15:** Filing & Summons Service to Children
- **Days 16–30:** Conciliation Officer Conference & Settlement Report
- **Days 31–70:** Summary Tribunal Inquiry, Medical Records & Income Scrutiny
- **Days 71–90:** Final Order Pronouncement & Recovery Direction
- **Post-90 Days:** Automatic Section 16 Appellate Appeal to District Magistrate (DM)

---

## 6. Privacy & Cryptographic Verification

All drafted petitions and dossiers stored in local browser storage (`civicbridge_senior_tribunal_petitions`):
- Automatically scrub Aadhaar, PAN, and phone numbers via `minimizeForExternal()`.
- Compute a deterministic canonical SHA-256 seal (`computePetitionDigest`) guaranteeing evidence integrity.
- Detect offline tampering via `verifyPetitionIntegrity()`.
- Export signed JSON dossiers and printable plain-text slips in triplicate for physical court filing.

---

## 7. Testing & Verification

Run all unit and component tests:
```bash
npx vitest run src/services/seniorCitizenTribunalService.test.js src/services/seniorCitizenTribunalStorage.test.js src/components/seniorTribunal/MaintenanceApportionmentCalculator.test.jsx src/pages/SeniorCitizenTribunalWorkspace.test.jsx
```

Run linter:
```bash
npx eslint src/services/seniorCitizenTribunalService.js src/services/seniorCitizenTribunalStorage.js src/components/seniorTribunal/MaintenanceApportionmentCalculator.jsx src/components/seniorTribunal/Section23PropertyRevocationCard.jsx src/components/seniorTribunal/TribunalSlaTimeline.jsx src/components/seniorTribunal/EvidenceChecklistDrawer.jsx src/components/seniorTribunal/TribunalPetitionBuilder.jsx src/pages/SeniorCitizenTribunalWorkspace.jsx
```

Run security check and audit:
```bash
npm run lint:security
node scripts/security/audit-report.mjs --omit-dev --level high
```

Run build:
```bash
npm run build
```
