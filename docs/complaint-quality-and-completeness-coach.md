# Agentic Civic Complaint Quality and Completeness Coach (#1190)

## 1. Overview & Motivation

When citizens file grievances with public authorities (e.g. municipal corporations, electricity distribution utilities, water supply boards, and transit departments), an overwhelming percentage of submissions are rejected, delayed, or marked unactionable due to missing essential details:
- **Missing or ambiguous dates**: e.g., "happened a few days ago" or "for ages" without calendar timestamps needed to match duty rosters.
- **Vague locations**: e.g., "near my house" or "down the road" without landmark, ward, or street identifiers.
- **Missing prior reference IDs**: lack of consumer numbers, prior token numbers, or application references.
- **Lack of supporting evidence**: missing photo documentation of physical hazards or payment receipts.
- **Unsupported allegations / unverified defamation**: accusations of corruption, bribery, or personal malice that trigger legal or administrative disqualification without registered vigilance filings.

The **Agentic Civic Complaint Quality and Completeness Coach** helps citizens identify these gaps before submission, provides privacy-preserving client-side PII scrubbing, and produces an editable, objective complaint draft.

---

## 2. Architecture Decision Record (ADR)

### 2.1 Context & Boundaries
- Citizens require immediate, accessible, and privacy-conscious feedback.
- Generative LLMs cannot be trusted to perform deterministic rule checks autonomously or to guarantee factual truth.
- AI must never file complaints autonomously or claim official statutory verification.

### 2.2 Decisions & Principles

| Principle | Decision & Implementation |
|---|---|
| **Deterministic Rules Outside LLM Prompts** | Schema-based completeness analysis, regex extraction for references, dates, landmarks, and allegation flags execute via deterministic JavaScript (`src/services/complaintQualityCoachService.js`). |
| **Untrusted AI Suggestions with Provenance** | All generated drafts and recommendations carry provenance metadata (`generator`, `schemaVersion`, `disclaimer`, `timestamp`) and are labeled as non-official proposals. |
| **Privacy Preview & Local PII Scrubbing** | Integrated with `src/ai/aiGuardrailPipeline.js`. Sensitive identifiers (Aadhaar, PAN, phone numbers, bank accounts, UPI, API secrets) are redacted before analysis or storage. |
| **Prompt Injection Defense** | Blocks system-prompt extraction, role manipulation, and jailbreak overrides at the boundary. |
| **Human-in-the-Loop** | Explicit citizen approval and editing is required. The coach provides an editable draft; it never auto-submits or claims official status. |
| **Synthetic Fixtures Only** | All fixtures in `src/data/complaintQualityContract.js` use synthetic personas, mock tokens, and fictional coordinates. Zero production PII. |

---

## 3. Data Flow Diagram

```
+-------------------------------------------------------------------------------+
|                                Citizen UI                                     |
|  [Select Category]  -->  [Enter / Load Text]  -->  [Client Guardrail Redactor]|
+-------------------------------------------------------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------------+
|                   API Dispatcher (/api/complaint-quality-coach)              |
|  [Rate Limiter (abuseGuard)] --> [Schema Validation] --> [Injection Filter]   |
+-------------------------------------------------------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------------+
|             Complaint Quality Coach Engine (Pure Deterministic Core)          |
|  1. Date & Timeline Completeness (ISO / Calendar / Hindi / Ambiguity Flags)   |
|  2. Location & Landmark Detection (Ward / Sector / Landmark / Geo Flags)      |
|  3. Reference / Consumer Number Extractor & Category Pattern Matching         |
|  4. Evidence Attachment Mentions (Photos / Receipts / FIR / Reports)          |
|  5. Unsupported Allegation & Defamation Warning Filter                        |
|  6. Quality Scoring Engine (0 - 100) & Actionable Checklist Breakdown         |
|  7. Objective Draft Generator with Verification Provenance Tags               |
+-------------------------------------------------------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------------+
|                            Citizen Review & Action                            |
|  - Inspect Quality Score & Completeness Checklist                             |
|  - Review & Edit Polished Objective Draft                                     |
|  - Inspect Privacy Preview (Scrubbed PII count & categories)                  |
|  - Copy draft to paste into Jan Sunwai / PGMS / Municipal Portal manually     |
+-------------------------------------------------------------------------------+
```

---

## 4. Threat Model & Security Controls

| Threat | Risk Level | Mitigation Control |
|---|---|---|
| **Prompt Injection & System Prompt Leaks** | High | Checked against deterministic injection rule catalog (`INJECTION_RULES`) in `aiGuardrailPipeline.js` before processing. Attacks return structured HTTP 400. |
| **PII & Sensitive Data Leakage** | Critical | Client-side and server-side regex scrubber eliminates Aadhaar, PAN, phone numbers, and financial details from response payloads and drafts. |
| **Defamation & Unsubstantiated Accusations** | Medium | Allegation pattern filter flags bribery and personal malice accusations, explaining the necessity of Anti-Corruption / Vigilance affidavits and providing neutral phrasing. |
| **Denial of Service / Rapid Query Storms** | Medium | IP-based rate limiting via `createRateLimiter` (`take(ip)`) in `api/_lib/abuseGuard.js`. Limits set to 40 req/min with `Retry-After`. |
| **Autonomous Action / Misrepresentation** | High | System explicitly disclaims official authority; no external submission API exists in this tool; citizens must review and copy manually. |

---

## 5. Component Ownership

- **Data Contract & Schemas**: `src/data/complaintQualityContract.js`
- **Quality Coach Core Engine**: `src/services/complaintQualityCoachService.js`
- **Serverless API Handler**: `api/_lib/handlers/complaint-quality-coach.js`
- **API Dispatcher**: `api/[...path].js`
- **UI Workspace Component**: `src/components/complaintCoach/ComplaintQualityCoachWorkspace.jsx`
- **Page Route**: `src/pages/ComplaintQualityCoachWorkspace.jsx` (mounted at `/complaint-coach`)
- **App Routing**: `src/App.jsx`
- **Unit & Orchestration Tests**: `src/services/complaintQualityCoachService.test.js`
- **API Integration Tests**: `tests/complaint-quality-coach-api.test.js`
- **UI Component Tests**: `src/components/complaintCoach/ComplaintQualityCoachWorkspace.test.jsx`

---

## 6. Reproducible Test & Verification Commands

To verify all components locally:

```bash
# 1. Run Unit Tests for the Coach Engine
npx vitest run src/services/complaintQualityCoachService.test.js

# 2. Run API Integration & Rate-Limiting Tests
npx vitest run tests/complaint-quality-coach-api.test.js

# 3. Run UI Component Static Render Tests
npx vitest run src/components/complaintCoach/ComplaintQualityCoachWorkspace.test.jsx

# 4. Verify Production Build & Asset Bundling
npm run build
```

---

## 7. Measurable Evaluation Criteria

1. **Completeness Detection Accuracy**:
   - Accurately identifies missing dates and ambiguous time ranges across English and Hindi text.
   - Detects presence/absence of valid landmark, ward, or street references.
2. **Defamation & Allegation Risk Reduction**:
   - Successfully identifies 100% of tested bribery and character attack patterns, substituting neutral objective language in generated drafts.
3. **Privacy Compliance**:
   - Zero raw PII (Aadhaar, phone numbers, PAN) present in sanitized drafts or privacy previews.
4. **Latency & Determinism**:
   - Analysis executes in < 30ms locally without calling expensive external LLM inference endpoints.
