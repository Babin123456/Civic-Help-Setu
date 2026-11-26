# UP Pension Payment Discrepancy & Life-Certificate Workspace

## Scope & Statutory Schemes
The Government of Uttar Pradesh administers non-contributory social security pensions under the **Integrated Pension Portal (SSPY - `sspy-up.gov.in`)**:
1. **Old Age Pension (Vridhavastha Pension)**: Administered by the Social Welfare Department for senior citizens aged 60+ below the poverty line.
2. **Destitute Widow Pension (Nirashrit Mahila Pension)**: Administered by the Women and Child Development Department.
3. **Divyangjan Disability Pension**: Administered by the Divyangjan Empowerment Department for citizens with 40%+ benchmark disability.

All three schemes disburse statutory monthly welfare of **₹1,000/month**, released as quarterly installments of **₹3,000 per quarter** directly via PFMS Direct Benefit Transfer (DBT).

---

## Common Disruption Causes & Administrative Solutions

### 1. Annual Jeevan Pramaan / Digital Life Certificate (DLC) Lapse
- **Rule**: Beneficiaries must complete annual verification (May–June for old-age, or scheme cycle) via biometric DLC or physical verification.
- **Remedy**: Submit Digital Life Certificate at Common Service Centres (CSC), India Post Payments Bank (IPPB) doorstep postman service, or Tehsil kiosk.

### 2. NPCI Aadhaar Payment Bridge (APB) Mapping Inactivity
- **Rule**: Funds are remitted to the pensioner's Aadhaar-linked primary account in the National Payments Corporation of India (NPCI) mapper.
- **Remedy**: Submit Aadhaar-mandate form at the home bank branch to re-seed DBT mapping.

### 3. Public Financial Management System (PFMS) Name Mismatches
- Minor spelling differences between the SSPY application and the core banking passbook trigger automated PFMS payment rejections.
- **Remedy**: Submit a bank-endorsed passbook front page to the District Social Welfare Officer (DSWO) to update demographic records.

---

## Strict Privacy & Zero Credential Collection
- **No Banking Passwords, PINs, or Full Account Numbers**: Masked export preserves only the final 4 digits.
- **No Aadhaar Biometric Storage**: System does not store or proxy UIDAI biometric credentials.
- **Caregiver Mode**: When a relative assists a senior citizen, explicit consent is recorded with an immutable timestamp.


---

## Escalation Matrix & Contact Channels
When online grievance submission requires follow-up, pensioners may escalate in sequence:
1. **Panchayat / Ward Level**: Gram Vikas Adhikari (GVA) / Ward Member for physical existence verification certs.
2. **Block Level**: Assistant Development Officer (Social Welfare) / ADO Samaj Kalyan at Block Development Office (Vikas Khand).
3. **Tehsil Level**: Sub-Divisional Magistrate (SDM) / Tehsildar during Tehsil Diwas (1st & 3rd Tuesday of each month).
4. **District Level**: District Social Welfare Officer (DSWO) for Old Age Pension; District Probation Officer (DPO) for Widow Pension; District Divyangjan Empowerment Officer for Disability Pension.
5. **State CM Helpline**: Call 1076 (UP CM Jan Sunwai) quoting the SSPY registration number.

## Printable Dossier Workflow
The workspace generates a clean, non-confidential physical representation letter addressed to the relevant DSWO. Beneficiaries or caregivers can print this document, attach a self-attested bank passbook copy and DLC acknowledgement slip, and submit it during office hours or District Public Hearing days (Janta Darshan).


## Field Verification Checklist for Caregivers & Volunteers
When assisting an elder or widow at the Tehsil or Block office, ensure the following steps are performed:
1. **SSPY Portal Search**: Look up the pensioner by registration number or mobile number at `sspy-up.gov.in`. Note down the PFMS account validation status.
2. **Bank Passbook Verification**: Compare the pensioner's name character-by-character against the Aadhaar card. If initials or spelling differs, request an e-KYC update at the branch.
3. **NPCI DBT Seeding Confirmation**: Ask the branch clerk to print the NPCI status screen. Merely linking Aadhaar for biometric cash withdrawal (AePS) does NOT automatically map the account for DBT payment bridge.
4. **Jeevan Pramaan Acknowledgment**: Secure a printout or SMS with Pramaan ID after submitting biometric DLC.
5. **Receipt on Representation**: Always request an inward diary number or seal on the duplicate copy of the representation submitted to the DSWO office.


## Technical Integration with Civic Help Setu
- Exportable representation files conform to standard CommonMark Markdown for rendering in the web interface or printing to PDF.
- Sensitive identifiers are truncated or replaced with asterisks before persisting in browser local session state.
- In line with system-wide privacy guidelines, no credentials, passwords, biometric templates, or full financial identifiers are retained or transmitted to third-party endpoints.
