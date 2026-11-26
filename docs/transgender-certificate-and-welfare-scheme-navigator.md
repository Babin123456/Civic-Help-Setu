# Transgender Certificate & Welfare Scheme Application Navigator (#1104)

## 1. Overview & Problem Definition
Transgender people across India frequently encounter fragmented, confusing, and contradictory information regarding:
1. Statutory application routes for obtaining an official Certificate of Identity and barcoded Identity Card.
2. The legal distinction between initial identity certification (Section 5) and gender affirmation revisions (Section 6 & 7).
3. Entitlements under central flagship welfare programmes (SMILE, Ayushman Bharat TG Plus, Garima Greh) and state-specific welfare boards.
4. How and where to appeal arbitrary rejections or bureaucratic delays beyond the statutory 30-day timeline.
5. Accessing verified, safe community resources and legal aid without exposing personal identity or facing harassment.

Civic-Help-Setu provides a **privacy-first, jurisdiction-aware preparation guide and directory** grounded directly in published central and state legislation.

---

## 2. Statutory Legal Framework

> [!IMPORTANT]
> **Prohibition of Intrusive Examination**: Under Section 5 of the *Transgender Persons (Protection of Rights) Act, 2019* and Rule 5 of the *Rules, 2020*, requiring an applicant to undergo any physical or medical examination for an initial Certificate of Identity is **strictly prohibited by law**. Self-perceived gender identity declared via a self-declaration affidavit (Form 2) is legally conclusive.

### Primary Central Statutes
1. **The Transgender Persons (Protection of Rights) Act, 2019** (Act No. 40 of 2019).
2. **The Transgender Persons (Protection of Rights) Rules, 2020** (G.S.R. 592(E)).
3. **NALSA v. Union of India (2014) 5 SCC 438**: Landmark Supreme Court ruling upholding the right to self-identification of gender.

---

## 3. Statutory Portals & Issuing Authorities

| Jurisdiction | Competent Authority | Statutory Act / Rules | Official Application Portal | Staleness Horizon |
| :--- | :--- | :--- | :--- | :--- |
| **All India / Central** | District Magistrate / Collector | Central Act 2019 & Rules 2020 | https://transgender.dosje.gov.in | 180 days |
| **Delhi (NCT)** | District Magistrate (Revenue Dept, GNCTD) | GNCTD Social Welfare Rules | https://transgender.dosje.gov.in | 180 days |
| **Maharashtra** | District Collector / Welfare Board | SJSA Dept Regulations | https://transgender.dosje.gov.in | 180 days |
| **Tamil Nadu** | TN Transgender Welfare Board & District Collectors | TN Social Welfare Department SOPs | https://transgender.dosje.gov.in | 180 days |
| **Karnataka** | Deputy Commissioner / Social Welfare Dept | State Transgender Policy 2017 | https://transgender.dosje.gov.in | 180 days |
| **Kerala** | District Collector & Social Justice Officer | State Transgender Policy 2015 | https://transgender.dosje.gov.in | 180 days |
| **West Bengal** | District Magistrate & WB Transgender Board | WB WCD & Social Welfare SOPs | https://transgender.dosje.gov.in | 180 days |

---

## 4. Distinct Procedural Routes

### Route A: Initial Certificate of Identity & Identity Card (Section 5)
* **Application Form**: Form 1 submitted online at `transgender.dosje.gov.in`.
* **Affidavit**: Form 2 self-declaration on non-judicial stamp paper declaring self-perceived gender identity as Transgender.
* **Residence Requirement**: Minimum 1 year continuous residence within the District Magistrate's jurisdiction.
* **Statutory SLA**: 30 days under Rule 6(1).
* **Issuance**: Digital download of barcoded certificate and photo identity card.

### Route B: Revised Certificate Following Medical Affirmation (Section 6 & 7)
* **Pre-condition**: Applicant undergoes medical intervention (hormone therapy, gender affirmation surgery) to confirm gender as Male or Female.
* **Documentation**: Certificate in Form 3 issued by the Medical Superintendent or Chief Medical Officer of the treating institution.
* **Statutory Benefit (Section 7(3))**: Holder is legally entitled to update first name and gender marker across all subsequent documents (Aadhaar, Passport, PAN, educational credentials) without separate re-adjudication.

### Route C: Corrections & Typographical Updates
* Submitted online via the National Portal user dashboard under "Request Modification".

### Route D: Statutory First Appeal & Grievance Redressal (Rule 11)
* **Limitation Period**: Must be filed within **30 days** of receiving the rejection order.
* **Appellate Authority**: Designated state appellate authority (typically Divisional Commissioner or Secretary of Social Welfare).
* **Grounds**: Arbitrary refusal, insistence on medical exams, or failure to issue within 30 statutory days.
* **Escalation**: National Council for Transgender Persons (NCTP) & CPGRAMS (`pgportal.gov.in`).

---

## 5. Welfare & Healthcare Schemes Covered

1. **SMILE Scheme (Support for Marginalised Individuals for Livelihood and Enterprise)**:
   * Central umbrella scheme providing pre-matric and post-matric scholarships, PM-DAKSH skill development training with monthly stipends, and micro-enterprise loans.
2. **Ayushman Bharat TG Plus Health Package**:
   * Comprehensive ₹5,00,000 annual cashless healthcare cover per transgender person across empanelled hospitals, covering gender reaffirmation surgeries, hormone therapy, and post-operative care.
3. **Garima Greh (Shelter Homes)**:
   * Residential facilities providing safe shelter, food, counseling, and vocational training for destitute transgender individuals.
4. **State-Level Schemes**:
   * Tamil Nadu monthly pension (₹1,500) and higher education fee waivers.
   * Kerala financial reimbursement for gender affirmation surgery (up to ₹2.5 lakh - ₹5 lakh).
   * Karnataka Mythri monthly pension scheme.
   * Delhi and Maharashtra welfare board assistance funds.

---

## 6. Privacy & Safe-Device Guarantees

* **Zero Identity Document Collection**: The application navigator never prompts users to upload ID proofs, medical records, or affidavits.
* **No Eligibility Gating**: All tabs, checklists, and directory records are open for anonymous review without requiring users to disclose personal details.
* **Quick Exit Protection**: The UI includes a persistent **"Quick Exit (ESC)"** button and listens for the `Escape` key, immediately executing a `window.location.replace` to `https://www.google.com` to prevent browser history caching if accessed on shared or monitored devices.
* **Zero Remote Telemetry**: User interactions, state dropdown changes, and tab selections are never transmitted to analytics or remote servers.
* **Client-Only Local Storage**: Checklist progress is stored purely in `localStorage` under `civic_tg_navigator_progress` with an explicit "Clear Saved Progress" user action.

---

## 7. Multilingual & Plain-Language Support

* Navigation and metadata localized across **English**, **Hindi**, **Bengali**, and **Tamil**.
* Plain-language civic glossary defining statutory legal terms:
  * *Certificate of Identity*
  * *Form 2 Affidavit*
  * *Revised Certificate (Section 7)*
  * *Form 3 Medical Certificate*
  * *Garima Greh*

---

## 8. Verification & Test Coverage

* **Service Logic Tests**: `src/services/transgenderCertificateWelfareService.test.js` (authority resolution, state fallback, Rule 11 appeal verification, data staleness checks).
* **Component Interactive Tests**: `src/components/services/TransgenderCertificateWelfareGuide.test.jsx` (tab switching, Quick Exit presence, self-determination notices, state filtering).
* **Route & Page Tests**: `src/pages/TransgenderCertificateWelfarePage.test.jsx`.
* **Catalogue Integration Tests**: `src/pages/ServiceDetails.test.jsx`.
