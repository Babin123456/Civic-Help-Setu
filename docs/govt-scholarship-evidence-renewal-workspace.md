# Government Scholarship Application Evidence and Renewal Workspace

## Scope & Architectural Principles
This service facilitates applicant readiness for Central and State government welfare scholarships, covering both **Fresh Applications** and **Renewal Applications** across national and state portals.

---

## Common Verification Defects & Solutions
- **Income Certificate Outdated**: Income certificates in many states are valid for 1 financial year only. Ensure the certificate reflects the current financial year.
- **Bonafide Institutional Stamp Missing**: Document must clearly indicate the applicant's class/semester, roll number, and institution code (AISHE/DISE).
- **Aadhaar Demographic Mismatch**: Differences in initials or spelling between matriculation certificate, Aadhaar, and bank account must be reconciled early.

---

## Supported Portals & Systems
- **National Scholarship Portal (NSP)**: Schemes by Ministry of Social Justice, Ministry of Minority Affairs, Ministry of Tribal Affairs, Department of Higher Education.
- **State Scholarship Portals**:
  - SSP (State Scholarship Portal, Karnataka)
  - MahaDBT (Government of Maharashtra)
  - Oasis & Medhashree (Government of West Bengal)
  - Medhabruti & State Portal (Odisha)
  - UP Scholarship & Fee Reimbursement Online System

---

## Fresh vs. Renewal Application Guidelines

| Feature | Fresh Application | Renewal Application |
| :--- | :--- | :--- |
| **Eligibility** | Newly enrolled in school/college/course | Continuing into subsequent academic year |
| **Application ID** | Newly generated after OTR registration | Uses existing permanent Application ID |
| **Academic Rule** | Qualifying entry exam / prior class marks | Minimum prescribed score (usually >= 50%) |
| **Document Need** | Full dossier (Income, Domicile, Bonafide) | Fresh Bonafide certificate & latest marksheet |

---

## Strict Privacy & Bank Security Safeguards
- **Zero Financial Credential Collection**: Under no circumstance does this service collect bank passwords, debit card PINs, CVV, or OTPs.
- **Aadhaar-Payment-Bridge (APB) Model**: Under Government DBT guidelines, scholarships are transferred strictly to the student's **Aadhaar-seeded bank account** mapped in the NPCI (National Payments Corporation of India) mapper.
- Students are instructed to check status at their branch or through the official UIDAI resident portal.

---

## Multi-Level Verification Workflow

```
[1. Student Submission on NSP / State Portal]
                 │
                 ▼
[2. L1: Institute Nodal Officer (INO) Verification]
    - Checks bonafide student status & attendance records.
                 │
                 ▼
[3. L2: District Nodal Officer (DNO) Verification]
    - Validates income, domicile, and caste certificates against state databases.
                 │
                 ▼
[4. L3: State Nodal Officer (SNO) Approval]
    - Prepares merit and selection lists.
                 │
                 ▼
[5. L4: PFMS / DBT Disbursement to Bank Account]
```
