# Open Contracting Red-Flag Analytics for Public Procurement Records (#751)

## 1. Overview & Problem Statement
Civic Help Setu provides a dedicated **Open Contracting Red-Flag Analytics Workspace** to assist municipal and state auditors, civil society researchers, and citizen observers in scrutinizing public procurement records for unusual patterns without declaring wrongdoing.

While prior tooling (e.g., [#722 `TenderReadinessWorkspace`](../src/pages/TenderReadinessWorkspace.jsx)) focuses on vendor preparation and document compliance, **#751 is an explainable oversight and audit analytics workspace** aligned with the international **Open Contracting Data Standard (OCDS)** and Central Vigilance Commission (CVC) procurement norms.

> **Ethical & Statutory Boundary:** Anomaly indicators are purely statistical and procedural prompts for human auditor triage. The platform **never** labels a vendor "corrupt" or "fraudulent", nor does it automatically trigger administrative debarment or sanctions. Every recommendation is subject to documented human review.

---

## 2. Domain Entities & OCDS-Aligned Data Model
All data structures adhere to strict schema contracts defined in `src/data/openContractingContract.js`:

```
┌────────────────────────────────────────────────────────┐
│           Procurement Notice (Planning & Tender)       │
│  - tenderRefNumber, estimatedValue, dates, method      │
└──────────────────────────┬─────────────────────────────┘
                           │ 1:N
                           ▼
┌────────────────────────────────────────────────────────┐
│              Bid Submissions (Quotes)                  │
│  - vendorId, bidAmount, isTechnicallyQualified, rank   │
└──────────────────────────┬─────────────────────────────┘
                           │ 1:1
                           ▼
┌────────────────────────────────────────────────────────┐
│              Contract Award (Award Stage)              │
│  - winningVendorId, awardedAmount, awardDate           │
└──────────────────────────┬─────────────────────────────┘
                           │ 1:N
                           ▼
┌────────────────────────────────────────────────────────┐
│             Contract Amendments (Variations)           │
│  - costDelta, percentageVariation, statutoryRationale  │
└──────────────────────────┬─────────────────────────────┘
                           │ Evaluated By
                           ▼
┌────────────────────────────────────────────────────────┐
│           RedFlag Anomaly (Explainable Engine)         │
│  - indicatorCode, severity, cohortBenchmark, evidence  │
└──────────────────────────┬─────────────────────────────┘
                           │ Triaged By
                           ▼
┌────────────────────────────────────────────────────────┐
│              AuditReview (Human Oversight)             │
│  - disposition, justification, auditSeal, reviewerRole │
└────────────────────────────────────────────────────────┘
```

### Core Entities
1. **`ProcurementNotice` (`procurement_notices`)**: Captures notice reference, issuing authority, municipal jurisdiction, category (`goods`, `works`, `services`, `consultancy`), estimated value, publishing date, submission deadline, procurement method (`open_competitive`, `limited_tender`, `single_source`), and verified HTTPS source link with SHA-256 seal.
2. **`BidSubmission` (`bid_submissions`)**: Tracks submitted bids, bidder entity identifiers, quotes, and technical qualification outcomes.
3. **`ContractAward` (`award_records`)**: Final contract award amount, winning vendor reference, evaluation method, and contract signing timestamp.
4. **`VendorEntity` (`vendor_entities`)**: Normalized vendor master entity with registration ID, MSME status, incorporation year, and active contract volume.
5. **`Amendment` (`contract_amendments`)**: Post-award contract variations, cost escalations, time extensions, and statutory justification on record.
6. **`RedFlag` (`analytics_runs`)**: Unique indicator instance storing severity (`low`, `medium`, `high`, `critical`), influencing fields, comparison cohort baseline, and recommended auditor questions.
7. **`AuditReview` (`review_cases`)**: Auditor triage outcome (`pending_review`, `under_investigation`, `marked_false_positive`, `cleared_with_explanation`, `escalated_for_formal_audit`), documented justification, and cryptographic audit seal.

---

## 3. Explainable Anomaly Detection Ruleset
The analytics engine (`src/services/openContractingAnalyticsService.js`) executes ruleset `v1.0.0-ocds-deterministic`:

| Indicator Code | Name | Anomaly Condition | Default Severity | Comparison Cohort Benchmark |
| :--- | :--- | :--- | :--- | :--- |
| **OCDS-RF-01** | Repeated Single-Bid Award | Open competitive tender where only 1 valid quote was evaluated. | `high` | Average bids per open tender across same category & jurisdiction. |
| **OCDS-RF-02** | Abbreviated Bidding Window | Notice advertising period shorter than statutory threshold (<14 days for high value, <7 days for minor). | `medium` / `high` | Average advertising window (days) for peer category tenders. |
| **OCDS-RF-03** | Unusual Amendments & Cost Creep | Multiple variations (>=2) or cumulative cost escalation exceeding statutory ceiling (>15-20%). | `critical` | Average contract cost escalation rate (%) in jurisdiction. |
| **OCDS-RF-04** | Award Price Outlier | Final award amount exceeds departmental administrative estimate by >20-35%. | `high` / `critical` | Cohort average award-to-estimate ratio. |
| **OCDS-RF-05** | High Vendor Concentration | Single vendor wins >=40% of all evaluated agency contracts in a rolling window. | `medium` | Expected neutral market share per vendor (`100% / n_vendors`). |

---

## 4. Role-Based Access Control (RBAC) & Privacy Scopes

| Capability | Citizen Observer (`citizen`) | Procurement Analyst (`analyst`) | Oversight Auditor (`auditor`) | Administrator (`admin`) |
| :--- | :---: | :---: | :---: | :---: |
| **Browse Published Notices & Awards** | Yes | Yes | Yes | Yes |
| **Inspect Red-Flag Indicators & Cohorts** | Yes | Yes | Yes | Yes |
| **Run / Refresh Analytics Ruleset** | Yes | Yes | Yes | Yes |
| **View Internal Confidential Auditor Notes** | Redacted | Yes | Yes | Yes |
| **Draft Triage Inquiries (`under_investigation`)** | No | Yes | Yes | Yes |
| **Mark False Positive / Clear Flag** | No | No | Yes | Yes |
| **Issue Tamper-Evident Audit Seals** | No | No | Yes | Yes |
| **Export Unredacted Dossier** | Redacted | Yes | Yes | Yes |

### Anti-PII & Privacy Boundary
- Text inputs (justifications, search, reviews) are scanned against Aadhaar (`\b\d{4}\s?\d{4}\s?\d{4}\b`), PAN (`\b[A-Z]{5}[0-9]{4}[A-Z]\b`), telephone contact numbers, and private email addresses.
- Public projections for citizens strip internal investigator IDs, personal contact numbers, and confidential deliberations.

---

## 5. Serverless API Endpoint (`/api/open-contracting-analytics`)

### `GET /api/open-contracting-analytics`
* Query Params: `?role=citizen|analyst|auditor`
* Response: Returns total reviews and queued audit outcomes. Public citizen requests receive redacted summaries.

### `POST /api/open-contracting-analytics`
* Request Headers: `idempotency-key` (optional), `x-forwarded-for`
* Request Body:
```json
{
  "flagId": "FLAG-SBA-NOT-2026-BLR-002",
  "disposition": "marked_false_positive",
  "justification": "Emergency desilting approved under Section 89 of KMC Act due to impending monsoon culvert breach.",
  "reviewerId": "AUD-KA-9901",
  "jurisdiction": "Bengaluru Urban, Karnataka"
}
```
* Guardrails:
  - Rate limiting via `abuseGuard.js` (15 requests/min per IP).
  - Single-flight deduplication to avoid double-submission races.
  - Idempotency key replay protection.
  - Deterministic audit seal generation (`AUDIT-SEAL-[0-9A-F]{4}-[0-9A-F]{4}`).

---

## 6. Offline Synchronization & Edge Resilience
- **Offline Mode**: If network connectivity drops, audit decisions are queued in `localStorage` under `civic_open_contracting_offline_queue_v1`.
- **Automatic Reconnection Sync**: When network status returns to online (`isOnline: true`), `openContractingService.syncOfflineQueue()` transmits queued decisions and generates permanent audit entries.
- **Accessible Alternatives**: `AccessibleCohortTable` provides a complete semantic HTML table alternative to charts and graphs.

---

## 7. Local Testing & Verification Commands

```bash
# Run schema and data contract validation tests
npm test -- --run src/data/openContractingContract.test.js

# Run explainable anomaly detection engine tests
npm test -- --run src/services/openContractingAnalyticsService.test.js

# Run client-side service and offline storage tests
npm test -- --run src/services/openContractingService.test.js

# Run serverless API route and idempotency tests
npm test -- --run tests/open-contracting-analytics.test.js

# Run workspace UI accessibility & SSR tests
npm test -- --run src/pages/OpenContractingWorkspace.test.jsx

# Run security lint
npm run lint:security

# Run production build
npm run build
```
