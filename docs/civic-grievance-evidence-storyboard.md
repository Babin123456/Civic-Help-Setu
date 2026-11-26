# Civic Grievance Evidence Storyboard with Source and Timestamp Cards

## Problem Statement & Purpose
When filing formal civic complaints, appeals before the Lokayukta, or Public Interest Litigations (PILs), citizens often possess multiple isolated items of evidence — geolocated photos, portal receipt tokens, correspondence letters, and RTI disclosures — but lack a structured mechanism to assemble them into a legally coherent chronological storyboard.

This service structures unstructured evidence:
1. **Strict Chronological Sequencing**: Orders incidents by verified timestamp with duplicate and missing-date alerts.
2. **Neutral Descriptive Captions**: Generates objective descriptive summaries requiring citizen confirmation before export (ensuring no definitive assertions of criminal wrongdoing or personal guilt are fabricated).
3. **Automated PII Redaction**: Masks personal mobile numbers, 12-digit Aadhaar credentials, and personal email addresses before rendering public or departmental submission indexes.

---

## Recognized Statutory Redressal Forums
- **CPGRAMS**: Central public grievance redressal portal under the Department of Administrative Reforms & Public Grievances.
- **State Lokayukta**: Statutory anti-corruption and administrative inaction investigatory body.
- **District Consumer Commission**: Consumer Protection Act 2019 claims for municipal service deficiencies.
- **High Court PIL**: Public interest litigation writ petitions under Article 226 for systemic civic failures.

---

## Evidence Classification Taxonomies

| Source Type | Statutory Evidentiary Weight | Verification Requirement |
| :--- | :--- | :--- |
| **Geo-Tagged Photograph** | Prima facie proof of site status | Requires date stamp & camera coordinates |
| **Official Receipt Token** | Proof of administrative cognizance | Reference ticket number & SLA date |
| **Written Correspondence** | Demonstration of exhaustion of remedies | Registered post acknowledgment or official email |
| **RTI Response** | Public authority record under Section 7 | Signed PIO communication or certified copy |

---

## Section 65B Electronic Evidence Certification
Under **Section 65B of the Indian Evidence Act, 1872** (and **Section 63 of the Bharatiya Sakshya Adhiniyam, 2023**), electronic documents, mobile photographs, and portal printouts are legally admissible in judicial and quasi-judicial tribunals only when accompanied by a signed certification verifying device custody, integrity, and lack of synthetic tampering. The storyboard automatically drafts an accompanying Section 65B certificate template.

---

## Privacy & Redaction Pipeline
Before generating print-ready indexes, descriptions undergo algorithmic sanitization:
- **Phone Numbers**: Converted to `[REDACTED_PHONE]`.
- **Aadhaar Numbers**: Converted to `[REDACTED_AADHAAR]`.
- **Email Identifiers**: Converted to `[REDACTED_EMAIL]`.

---

## Exportable Chronological Index
Generates a structured evidentiary matrix indexed chronologically, suitable for filing before the Municipal Commissioner, Consumer Forum, or District Grievance Committee.
