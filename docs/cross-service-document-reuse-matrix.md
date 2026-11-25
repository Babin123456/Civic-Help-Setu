# Cross-Service Document Reuse Matrix & Evidence Packet Planner

## Purpose & Problem Statement
Citizens frequently duplicate effort obtaining and uploading identical identity, residence, income, and property proofs across municipal services. This tool analyzes multi-service document requirements, highlights reusable shared certificates, and flags service-specific evidentiary rules.

---

## Canonical Document Classifications

| Document Code | Name | Categories Covered | Issuing Authority | Statutory Validity |
| :--- | :--- | :--- | :--- | :--- |
| `AADHAAR_CARD` | Aadhaar Card | Identity, Address | UIDAI | Permanent |
| `VOTER_ID_EPIC` | Voter ID (EPIC) | Identity, Address | Election Commission of India | Permanent |
| `ELECTRICITY_BILL` | Utility Electricity Bill | Residential Address | State Discom | 3 Months |
| `REVENUE_INCOME_CERT` | Tehsildar Income Certificate | Financial / EWS | Revenue Department | 12 Months (Financial Year) |
| `REGISTERED_SALE_DEED` | Registered Title Deed | Property Ownership | Sub-Registrar Office | Permanent |

---

## Cross-Service Reuse Engine
- **Shared Documents**: Documents required across 2 or more selected civic services (e.g., Aadhaar + Electricity Bill needed for both Water Connection and Trade Licence).
- **Service-Specific Requirements**: Unique proofs restricted to a single procedure (e.g., Registered Sale Deed exclusively for property mutation / water tap sanction).
- **Validity Expiry Warning**: Flags documents subject to statutory expiration (such as utility bills older than 90 days or previous financial year income certificates).

---

## Administrative Efficiency & Citizen Savings
Reusing canonical proofs across multiple civic applications delivers quantifiable benefits:
- **Reduced Physical Visits**: An estimated 1.5 physical municipal trips saved per reusable proof.
- **Direct Citizen Cost Reductions**: Saves unnecessary notary, attestation, and documentation fees (~₹150 per redundant proof).
- **Faster Verification Times**: Allows municipal departments to cross-reference previously validated documents in the DigiLocker ecosystem.

---

## Private Evidence Packet Planner
- Citizens can mark items as `READY`, `UNAVAILABLE`, or `NEEDS_RENEWAL`.
- **Zero Document File Upload**: Operates strictly on metadata checklist readiness. No personal document scans, Aadhaar numbers, or credentials are collected or saved on the server.
- Explicitly isolated from official government application processing.
