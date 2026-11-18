# Universal Accessibility Audit & Measured Remediation Workspace

## 1. Overview & Problem Statement

Under the **Rights of Persons with Disabilities Act, 2016 (RPwD Act 2016)** and the landmark Supreme Court ruling in ***Rajive Raturi v. Union of India (2018) 2 SCC 713***, all public and private establishments providing public services are mandated to ensure barrier-free physical accessibility.

Historically, civic accessibility assessments relied on simple pass/fail checklists that failed to record numerical measurements (such as ramp slope gradients, doorway clear widths, or handrail heights) or track the progress of physical barrier remediation over time.

This workspace (`/accessibility-audit-workspace`) introduces a **measured accessibility screening and time-bound remediation engine** built strictly against the **Harmonised Guidelines and Standards for Universal Accessibility in India (2021)** published by the Ministry of Housing and Urban Affairs (MoHUA).

---

## 2. Statutory & Jurisprudential Framework

### 2.1 Rights of Persons with Disabilities Act, 2016 (RPwD Act 2016)
- **Section 40:** Mandates the Central Government to formulate accessibility rules for public facilities, transport, and built infrastructure.
- **Section 44 & 45:** Requires mandatory adherence to accessibility standards in building plans, occupancy certificates, and existing infrastructure retrofits within specified timelines.
- **Section 46:** Directs all service providers to ensure accessibility in their premises within a period not exceeding two years from notification.
- **Section 89 & 90:** Prescribes statutory penalties for contraventions (up to ₹10,000 for first violation, and ₹50,000 to ₹5,00,000 for subsequent contraventions).

### 2.2 Supreme Court of India Precedent
- ***Rajive Raturi v. Union of India (2018) 2 SCC 713:*** The Supreme Court directed all state governments and Union Ministries to complete retrofitting of government buildings, educational institutions, healthcare centers, and transport hubs to comply with universal accessibility standards.

### 2.3 Preliminary Screening Notice & Legal Boundaries
> **Statutory Notice:** This assessment is a preliminary civic screening tool based on Harmonised Guidelines (2021) benchmarks. It is intended for citizen barrier documentation, civic representation, and voluntary remediation planning. It does **not** constitute a certified architectural audit, statutory accessibility clearance, or judicial finding.

---

## 3. Measured Physical Benchmarks (Harmonised Guidelines 2021)

The workspace records and validates numerical measurements across six core facility elements:

| Facility Element | Measured Metric | Standard Benchmark | Applicability Caveat & Source |
|---|---|---|---|
| **Ramp Gradient** | Slope ratio ($1:X$) | $\ge 12$ ($1:12$ or gentler) | Gradients up to $1:10$ permitted only for short kerb ramps with rise $\le 150\text{ mm}$ (Sec 4.2.2). |
| **Ramp Width** | Clear width (mm) | $\ge 1200\text{ mm}$ | $1800\text{ mm}$ recommended for two-way passing bays (Sec 4.2.1). |
| **Lower Handrail** | Height from floor (mm) | $700 - 800\text{ mm}$ (std $760\text{ mm}$) | Continuous rail required for children and short-statured persons (Sec 4.2.3). |
| **Upper Handrail** | Height from floor (mm) | $850 - 950\text{ mm}$ (std $900\text{ mm}$) | Horizontal extension of $300\text{ mm}$ past top/bottom risers required (Sec 4.2.3). |
| **Doorway Opening** | Clear width (mm) | $\ge 900\text{ mm}$ | Measured between face of open leaf at $90^\circ$ and frame rebate (Sec 4.3.1). |
| **Door Threshold** | Vertical sill height (mm) | $\le 12\text{ mm}$ | Sills $> 6\text{ mm}$ must be beveled with slope $\le 1:2$ (Sec 4.3.2). |
| **Washroom Width** | Internal width (mm) | $\ge 2000\text{ mm}$ | Must accommodate $1500\text{ mm}$ wheelchair turning circle (Sec 5.1). |
| **Washroom Depth** | Internal length (mm) | $\ge 2200\text{ mm}$ | Outward-opening or sliding door required for emergency access (Sec 5.1). |
| **Washroom Grab Bar** | Height from floor (mm) | $750 - 850\text{ mm}$ | L-rail on side wall and hinged drop-down rail on transfer side (Sec 5.1.4). |
| **Tactile Warning Band** | Indicator width (mm) | $\ge 300\text{ mm}$ | Installed $300\text{ mm}$ before flight of stairs or level drops (Sec 4.8). |
| **Lift Car Width** | Internal cabin width (mm) | $\ge 1100\text{ mm}$ | Depth must also be $\ge 1400\text{ mm}$ for wheelchair entry (Sec 4.5.1). |
| **Lift Control Panel** | Centerline button height (mm) | $900 - 1000\text{ mm}$ | Buttons must feature raised Braille numerals and audible floor chime (Sec 4.5.4). |

---

## 4. Remediation Planning & Reassessment Engine

### 4.1 Automated Action Plan Generation
- Non-compliant facility measurements are automatically compiled into a prioritized action plan:
  - **Critical Priority (30-day target):** Safety hazards (e.g. steep ramp slopes $> 1:12$, absent handrails, narrow main entrance doors).
  - **High Priority (60-day target):** Sanitary facility dimensions, raised thresholds, missing tactile paving.
- Plan items track: Barrier label, measurement gap, recommended corrective engineering action, target completion date, responsible department, and remediation status (`IDENTIFIED`, `PLANNED`, `IN_PROGRESS`, `REMEDIATED`, `VERIFIED`).

### 4.2 Immutable Reassessment History Chaining
- Facility assessments support multiple inspection rounds across time.
- When recording a reassessment snapshot:
  - Compares current measurements to earlier baseline.
  - Automatically identifies **resolved barriers** (previously failing benchmarks that now comply).
  - Computes score progression ($0\% \rightarrow 50\% \rightarrow 100\%$).
  - Stores assessor notes and maintains a verifiable timeline.

### 4.3 Printable Screening Report
- Accessible modal providing:
  - Complete benchmark matrix with numerical values, gaps, and statutory sources.
  - Prioritized remediation schedule.
  - Reassessment audit log.
  - Direct export to Markdown (`.md`), Plain Text (`.txt`), and browser print (`window.print()`).

---

## 5. Offline Vault & Cryptographic Integrity

- **Storage Key:** `civicbridge_accessibility_audit_vault` in `localStorage`.
- **SHA-256 Tamper Seal:** An SHA-256 digest is computed over all canonical record fields (`auditDigest`). Tampering with stored measurements or plan entries is immediately flagged (`verifyAudit`).
- **Data Minimization:** No personal phone numbers, complainant names, or GPS coordinates are stored in the vault.
- **Privacy Center:** Fully registered under the `drafts` category in `src/services/privacyConsentService.js` and `docs/DATA_RETENTION.md`.

---

## 6. Verification & Testing

Validated with 100% test coverage:
- `src/services/accessibilityAudit.test.js`: 13 tests covering measurement boundary conditions ($1:12$, $900\text{ mm}$, $12\text{ mm}$, range bounds), incomplete/unknown input handling, remediation plan generation, reassessment tracking, report generation, and vault seal integrity.
- `src/components/accessibilityAudit/MeasuredAuditTable.test.jsx`: Tests table accessibility, inputs, and gap rendering.
- `src/components/accessibilityAudit/RemediationPlanCard.test.jsx`: Tests action plan prioritization and status controls.
- `src/components/accessibilityAudit/ReassessmentTimelineCard.test.jsx`: Tests chronological reassessment round rendering.
- `src/components/accessibilityAudit/PrintableAccessibilityReportModal.test.jsx`: Tests printable report generation and statutory caveat alerts.
- `src/pages/AccessibilityAuditWorkspace.test.jsx`: Tests workspace routing and integration.
