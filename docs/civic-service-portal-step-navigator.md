# Civic Service Portal Step Navigator with Verified Page-State Guidance

## Purpose & Scope
Official state and central public service portals (e.g., Sarathi Parivahan, UIDAI Resident Portal, e-District, SPARROW) often confuse citizens with multi-stage navigations, opaque validation rules, and unhandled redirect errors.

This service acts as an off-portal orientation companion:
1. **Guiding Page Purpose**: Explains what each sequential page expects before the citizen fills it.
2. **Pre-Empting Form Rejections**: Highlights common validation traps (file size caps, special character restrictions, demographic naming mismatches).
3. **Phishing & Imposter Defense**: Cryptographically validates destination hostnames against an allowlist of verified `.gov.in` and `.nic.in` domains.

---

## Zero Credential Collection Guarantee
- **Absolute Privacy Boundary**: Civic Help Setu NEVER requests, stores, or proxies user portal passwords, Aadhaar OTPs, CAPTCHAs, or banking secrets.
- Citizens complete authentication exclusively in their own browser on official government infrastructure.

---

## Domain Verification Protocol
Every external portal link displayed in the navigator is evaluated against verified national public sector domains:
- Must use encrypted `https://` protocol.
- Must terminate with authorized government suffixes (`.gov.in`, `.nic.in`, or designated autonomous board domains).
- Any redirect to commercial or unverified domains triggers an immediate visual phishing caution banner.

---

## Directory of Pre-Verified Central & State Portals
- **Passport Seva Portal** (`passportindia.gov.in`): Administered by CPV Division, Ministry of External Affairs.
- **e-Filing Income Tax Portal** (`incometax.gov.in`): Administered by Central Board of Direct Taxes.
- **EPFO Unified Member Portal** (`unifiedportal-mem.epfindia.gov.in`): Provident fund KYC and withdrawal service.
- **Sarathi Parivahan** (`sarathi.parivahan.gov.in`): Driving licence testing and issuance infrastructure.

---

## Universal Portal Troubleshooting Knowledge Base
- **Double Payment Verification**: When money debits from a citizen's bank account but the government portal reports transaction failure, clicking the portal's "Double Verification" or "Re-verify" tool queries the payment aggregator without triggering duplicate charges.
- **Filename Sanitization**: Many NIC server-side filters reject file uploads containing spaces, parentheses, or non-ASCII characters. Files must always be renamed cleanly (e.g. `document_proof.pdf`).
- **Scheduled Maintenance Clashes**: Indian state treasuries and central portals run batch database reconciliations between 00:00 and 02:00 IST; submissions should be avoided during this daily maintenance window.

---

## Citizen Discrepancy Reporting
When portal layouts are updated by departments, citizens can report altered UI elements or broken links (`LAYOUT_ALTERED`, `LINK_BROKEN`), automatically queuing the step definition for maintainer audit.
