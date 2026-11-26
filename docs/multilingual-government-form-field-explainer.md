# Multilingual Government Form Field Explainer & Error-Prevention Assistant

- **Issue:** [#1001 — [level3][feature] Build a Multilingual Government Form Field Explainer and Error-Prevention Assistant](https://github.com/GoldRay19/Civic-Help-Setu/issues/1001)
- **Jurisdiction:** Uttar Pradesh (State Public Services Delivery & Revenue Portals)
- **Core Principle:** Educational guidance only — Zero submission, zero autofill, client-side format validation, strictly synthetic fictional examples, and strict redirection to official `.gov.in` portals.

---

## 1. Problem Statement & Citizen Challenge

Citizens frequently abandon official government applications because form fields use administrative legalisms, non-standard abbreviations, unclear formats, or unfamiliar language.

Generic machine translation (e.g., standard webpage translation) fails because:
1. **No Document Guidance:** Translating "Khasra/Khatauni" or "Khasra Gata" to English or Tamil does not explain *where in the citizen's Record of Rights (RoR) / Jamabandi slip that number is located*.
2. **Ambiguous Formats:** It fails to explain strict deterministic patterns (e.g., why an IFSC 5th character is always `0` and not the letter `O`, or why UP postal PIN codes must be 6 digits starting between `20xxxx` and `28xxxx`).
3. **Conditional Triggers Unclear:** Applicants do not know when a field applies (e.g., whether an uncultivated student must declare agricultural income, or when an OBC applicant must declare Creamy Layer exclusion).
4. **Scrutiny Rejections:** Citizens guess facts or input personal numbers into untrusted third-party cyber-cafe portals, resulting in delays, rejected applications, or data privacy risks.

---

## 2. Architectural Principles & Non-Negotiable Invariants

| Principle | Invariant & Enforcement |
| :--- | :--- |
| **Strictly Educational** | **Never fills unknown facts or submits forms.** Submissions occur solely on official department portals (`.gov.in`). Invoking `submitOfficialForm()` explicitly throws an error. |
| **Synthetic Fictional Data Only** | **All examples strictly use dummy synthetic samples.** Every example explicitly carries the tag `(Fictional Sample - Do not copy)`. Zero real citizen PII is ever used in fixtures or rendered UI. |
| **Official Provenance & Traceability** | Every explanation is explicitly linked to an official form version, statutory authority, source portal URL, and last department verification date. |
| **Sensitive Field Demarcation** | Credentials (Aadhaar, Bank Account, Mobile OTP, Income disclosures) are demarcated with visual `ShieldAlert` badges and prominent security advisories warning citizens to enter them only on official `.gov.in` portals. |
| **Version Drift & Staleness Protection** | When an administrative form version changes on the official portal, the system detects the drift, transitions form guidance to `OUTDATED_UNDER_REVIEW`, withdraws live advice, and routes the form to a human review queue before revised guidance is published. |
| **Multilingual Fallback Chain** | Supported languages: Hindi (`hi`), English (`en`), Bengali (`bn`), and Tamil (`ta`). If a specific translation is absent, the system falls back safely: `Target Language -> English (en) -> Canonical Schema Default`. |

---

## 3. High-Volume Uttar Pradesh Forms Catalogue (Initial Scope)

The assistant launches with five verified, high-volume citizen application forms from official Government of Uttar Pradesh portals:

| # | Form Title | Department Issuer | Official Portal | Version | Form Code |
|---|------------|-------------------|-----------------|---------|-----------|
| 1 | **Income Certificate (आय प्रमाण पत्र)** | Department of Revenue (राजस्व विभाग), Govt of UP | [edistrict.up.gov.in](https://edistrict.up.gov.in/edistrictup/) | `2024.1` | `EDIST-REV-INC-01` |
| 2 | **Domicile / Residence Certificate (निवास प्रमाण पत्र)** | Department of Revenue (राजस्व विभाग), Govt of UP | [edistrict.up.gov.in](https://edistrict.up.gov.in/edistrictup/) | `2024.1` | `EDIST-REV-DOM-01` |
| 3 | **Caste Certificate - SC/ST/OBC (जाति प्रमाण पत्र)** | Department of Revenue (राजस्व विभाग), Govt of UP | [edistrict.up.gov.in](https://edistrict.up.gov.in/edistrictup/) | `2024.2` | `EDIST-REV-CAS-01` |
| 4 | **Old Age Pension Application (वृद्धावस्था पेंशन योजना)** | Social Welfare Department (समाज कल्याण विभाग), Govt of UP | [sspy-up.gov.in](https://sspy-up.gov.in/HindiPages/oldage_h.aspx) | `2024.1` | `SSPY-OAP-2024` |
| 5 | **Jan Sunwai Citizen Grievance (जनसुनवाई - समाधान पोर्टल / IGRS)** | Administrative Reforms & Public Grievance Directorate, Govt of UP | [jansunwai.up.gov.in](https://jansunwai.up.gov.in/) | `2024.3` | `IGRS-JAN-SUN-01` |

---

## 4. Key Subsystems & Implementation Details

### A. Data Catalogue (`src/data/upFormFieldExplainerCatalogue.js`)
Contains the authoritative schema definitions for each form and field, including:
- `category`: Categorized by Identity, Residency, Financial, Category, Beneficiary, or Grievance.
- `plainLanguageExplanation`: Simple words describing what the field seeks.
- `whereToFind`: Specific instructions directing citizens to the relevant source document (e.g., front of Aadhaar, first page of passbook, computerized Khatauni RoR).
- `fictionalExample`: Synthetic example with prominent `(Fictional Sample - Do not copy)`.
- `formatValidation`: Deterministic rules for dates, PIN codes, document references, and bank formats.
- `isSensitive` & `sensitivityWarning`: Explicit security demarcations.
- `isConditional` & `conditionalRules`: Predicate condition and statutory reason citing department circulars.
- `officialSourceCitation`: Exact rule or portal guideline citation.

### B. Service Engine (`src/services/formFieldExplainerService.js`)
Core business logic providing:
1. `getAllCataloguedForms(includeUnderReview)`: List forms and metadata.
2. `getFieldExplanation(formId, fieldId, targetLanguage, isPlainLanguage)`: Resolves multilingual translations with deterministic fallback, attaches synthetic examples, and flags outdated form versions.
3. `validateFieldFormat(field, rawValue)`: In-memory, deterministic validation for UP PIN codes (`20xxxx-28xxxx`), Aadhaar (12 digits, not starting with 0/1), Bank IFSC (`^[A-Z]{4}0[A-Z0-9]{6}$`), Bank Accounts (9-18 digits), Mobile numbers (10 digits starting with 6-9), Date of birth with statutory age calculation (e.g., Old Age Pension $\ge 60$ years), numeric ranges, and enums.
4. `evaluateConditionalField(field, currentValues)`: Evaluates conditional branch states and explains *when and why* the field applies based on department rules.
5. `detectFormVersionChange(formId, downloadedVersion, sourceDetails)`: Compares live version against catalogued version. If drifted, transitions status to `OUTDATED_UNDER_REVIEW`, queues item in `humanReviewQueue`, and attaches warning banners.
6. `approveRevisedFormVersion(...)`: Administrative review approval workflow to publish revised form guidance.
7. `submitOfficialForm()`: Explicit barrier guard throwing an educational invariant error.

### C. Citizen UI Workspace (`src/pages/FormFieldExplainerAssistant.jsx`)
Interactive React workspace offering:
- **Form Switcher Tabs:** Direct access to the 5 UP government forms with version pills and department provenance.
- **Language & Plain-Language Bar:** Switch explanations between Hindi, English, Bengali, and Tamil; toggle plain-language simplification.
- **Search & Category Filters:** Quickly locate fields by keywords or functional group (Identity, Residency, Income, Category, Grievance).
- **Field Explainer Card:** Clear explanations, document location guides, synthetic examples, and statutory citations.
- **Sensitive Security Alert:** Prominent red warning banner on sensitive fields instructing citizens never to enter PII on unofficial portals.
- **Conditional Scenario Simulator:** Live toggles allowing citizens to see how upstream answers (e.g., Agriculture vs Salaried, Minor vs Adult, SC vs OBC) activate or hide conditional fields.
- **Live Error-Prevention Sandbox:** Interactive in-memory format validation giving immediate feedback without storing data.
- **Official Submission Redirection:** Direct links to the verified statutory `.gov.in` submission portals.

---

## 5. Acceptance Criteria Verification Matrix

| Acceptance Criterion | Verification Method | Test Result |
| :--- | :--- | :--- |
| **Every explanation linked to specific official version & source** | `getFieldExplanation` asserts `formVersion`, `departmentIssuer`, `sourceUrl`, and `officialSourceCitation`. | **PASS** (`formFieldExplainerService.test.js`) |
| **Examples never contain real citizen data** | Test iterates all catalogued forms and verifies all examples have the synthetic fictional marker and no real phone or Aadhaar numbers. | **PASS** (`formFieldExplainerService.test.js`) |
| **Assistant never fills unknown facts or submits forms** | `submitOfficialForm()` throws educational barrier error; UI strictly operates client-side with zero data transmission. | **PASS** (`formFieldExplainerService.test.js`) |
| **Sensitive fields are clearly identified** | Aadhaar, Bank Account, Mobile, and Income fields carry `isSensitive: true` and security warnings. | **PASS** (`formFieldExplainerService.test.js`) |
| **Outdated form guidance is withdrawn or marked for review** | Simulating version change triggers `OUTDATED_UNDER_REVIEW`, creates human review queue item, and renders warning alerts. | **PASS** (`formFieldExplainerService.test.js`) |
| **Tests cover language fallback, conditional fields, validation, and version changes** | 35 service tests + 6 page tests covering all required dimensions with zero failures. | **PASS** (41/41 Vitest Tests) |

---

## 6. How to Run Tests & Build

```bash
# Run unit & integration tests
npx vitest run src/services/formFieldExplainerService.test.js src/pages/FormFieldExplainerAssistant.test.jsx

# Run security lint
npm run lint:security

# Run production build
npm run build
```
