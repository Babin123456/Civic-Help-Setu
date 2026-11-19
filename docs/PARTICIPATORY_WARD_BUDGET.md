# Participatory Ward Budget Proposal and Public Deliberation Platform (#765)

## 1. Overview
The **Participatory Ward Budget Proposal and Public Deliberation Platform** introduces a dedicated municipal civic workflow to Civic Help Setu. It enables residents to formulate, submit, deliberate upon, and track proposals for local capital and maintenance improvements (pedestrian footpaths, drainage networks, street lighting, public facilities, and traffic safety).

> **Statutory Notice:** Citizen participation, comments, and voting on this platform are **advisory** under Section 13B of the Municipal Corporation Act to guide Ward Committee allocation decisions unless explicitly mandated by state urban laws.

---

## 2. Domain Entities & Normalized Data Model
All data structures adhere to strict schema contracts defined in `src/data/wardBudgetContract.js`:

- **BudgetCycle (`BudgetCycle`)**: Defines the active fiscal cycle envelope (e.g., `CYCLE-BLR-2026-W150`), total budget pool cap (₹5 Crore max per ward), allocated funds, dates for intake, deliberation, technical review, and voting stages.
- **WardProposal (`WardProposal`)**: Captures proposal intake metadata, categorized under strict enums (`roads_footpaths`, `parks_greenery`, `sanitation_drainage`, `street_lighting`, `public_facilities`, `traffic_safety`), approximate location, cost estimate range, supporting evidence survey notes, author reference, and metrics.
- **ProposalComment (`ProposalComment`)**: Threaded deliberation comments with content sanitization, PII blocking, and role badges (`citizen` vs `reviewer`).
- **ReviewDecision (`ReviewDecision`)**: Documents official engineering scrutiny outcomes (`eligible`, `ineligible`, `technical_revision_needed`, `merged_as_duplicate`, `approved_for_voting`, `funded`, `rejected`) with public summary justification and confidential internal engineering notes.
- **PublicVote (`PublicVote`)**: Anonymized advisory ballot records with double-voting prevention using salted one-way hashes (`SHA-256(voterId + cycleId + salt)`).
- **ImplementationUpdate (`ImplementationUpdate`)**: Milestones and ground progress tracking (tender published, contractor assigned, work in progress, inspection complete, handed over).

---

## 3. Proposal Lifecycle State Machine

```
[Draft]
   │
   ▼
[Submitted]
   │
   ├──────────────────────────────┐
   ▼                              ▼
[Under Technical Review]    [Consolidated as Duplicate] (linked to canonical proposal)
   │
   ├──────────────────────────────┬──────────────────────────────┐
   ▼                              ▼                              ▼
[Eligible / Approved for Voting] [Revision Needed]             [Ineligible / Rejected]
   │                              │ (resubmitted with updates)   (with statutory reason)
   ▼                              └───────────► [Submitted]
[Voting Open] (Advisory Ballot)
   │
   ▼
[Allocation Finalized / Funded]
   │
   ▼
[Implementation Tracking] (Tender ➔ Contractor ➔ Work in Progress ➔ Completed)
```

---

## 4. Bounded Intelligence & Duplicate Clustering
The duplicate detection engine (`src/services/proposalClusteringService.js`) enforces strict AI governance:

- **Bounded Role**: Suggests related proposals based on token overlap (Jaccard similarity on title, description, location keywords, ward, and category). **Never** decides eligibility or ranks public support.
- **Explainability & Provenance**: Every recommendation records:
  - `rulesetVersion`: e.g. `v1.4.0-trigram-token-jaccard`
  - `executionTimestamp`
  - `influencingFactors`: e.g. `["Title similarity (78%)", "Nearby location keywords (60%)", "Matching municipal ward"]`
- **Human in the Loop**: Citizens can inspect duplicates during intake; Ward Committee reviewers can explicitly accept consolidation, edit, or reject candidates.
- **Deterministic Offline Fallback**: Operates entirely in client memory without external network or LLM dependencies.

---

## 5. Privacy, Security & Anti-Abuse Controls

1. **Zero Public PII**:
   - Automated regex screening for Aadhaar (12 digits), PAN, Indian phone numbers (`+91` / 10 digits), and private emails. Submissions containing personal data are rejected at both client and server boundaries.
   - Resident author names in public views are sanitized or displayed as masked community identifiers (e.g. `Kavitha R. (Resident)`).
2. **Advisory Voting Integrity**:
   - Generates one-way salted voter seal hashes.
   - Rejects duplicate vote attempts within the same budget cycle.
3. **Audit Trail**:
   - Review decisions and state overrides append immutable decision logs recording reviewer ID, timestamp, and justification reason code.
4. **Rate Limiting**:
   - `abuseGuard` enforces fixed-window rate limits (10 req/min) and single-flight deduplication on serverless routes.

---

## 6. Offline-First Resilience
- Proposals and deliberation actions created while offline are queued in `localStorage` under `civicbridge_ward_offline_queue_v1`.
- When connectivity resumes (`useNetwork`), the queue flushes automatically with optimistic UI reconciliation.

---

## 7. Testing & Verification

Run the targeted test suites:

```bash
# Service & clustering tests
npx vitest run src/services/wardBudgetService.test.js

# UI & workspace component tests
npx vitest run src/pages/WardBudgetWorkspace.test.jsx

# Integration conflict resolution test
npx vitest run src/pages/ServiceDetails.test.jsx

# Serverless API handler test
npx vitest run tests/ward-budget-proposals.test.js
```

