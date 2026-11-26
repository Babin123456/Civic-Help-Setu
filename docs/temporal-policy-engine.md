# Architecture Decision Record & Threat Model: Temporal Policy Engine for Effective-Dated Civic Rules (#1155)

## Status
**ACCEPTED** — Core Civic Help Setu Architecture Specification

---

## 1. Context and Problem Statement

Civic welfare schemes, statutory licensing procedures, tax rebates, application fees, and documentation checklists change over time across India's Central ministries, 36 State/UT administrations, and local urban/rural local bodies (ULBs/Panchayats).

Statutory adjudications and citizen rights depend on a relevant **event date** rather than the current system timestamp:
1. **Event-Triggered Schemes**: Ex-gratia relief, maternity benefits, survivor pensions, or death compensation are strictly adjudicated against rules effective on the *date of the occurrence* (e.g., date of death, accident, or birth), regardless of when the claim is filed.
2. **Filing-Triggered Procedures**: Building permits, trade licenses, or caste/income certificates are adjudicated based on requirements in force on the *official application submission date*, even if department scrutiny occurs months later under an amended fee or document regime.
3. **Grandfathering and Transitional Clauses**: Government circulars routinely specify grace periods during which prior rules continue to govern pending applications.

### Failure Modes of Naive Systems
* **Temporal Leakage**: Applying today's rules to an application filed six months ago, demanding newly introduced affidavits that were not legally required at submission.
* **Premature Enforcement**: Applying future-gazetted rules before their gazetted enforcement date.
* **Epistemic Overreach & Hallucination**: Inferring eligibility or benefit denial when circulars or gazettes are missing, ambiguous, or incomplete.
* **Non-reproducible Adjudications**: Inability to reconstruct why an application was deemed eligible or ineligible under historical conditions after policy rules are subsequently updated.

---

## 2. Core Architectural Principles

1. **Deterministic Point-in-Time ("As-Of") Resolution**: Every policy evaluation evaluates the system state as of an explicit point in time ($T_{\text{asOf}}$) rather than wall-clock `Date.now()`.
2. **Continuous Interval & Lineage Integrity**: Each policy rule belongs to a `ruleFamilyId` and carries an explicit validity interval $[\text{effectiveFrom}, \text{effectiveTo}]$. Supersession relationships form a strict Directed Acyclic Graph (DAG).
3. **Proactive Gap & Conflict Detection**: The engine scans timelines within a jurisdiction to flag temporal gaps (periods where no rule is enacted) and temporal conflicts (concurrent overlapping contradictory rules).
4. **Epistemic Humility Invariant**: **Never infer a legal conclusion where source coverage is incomplete.** If circular provenance or boundary intervals are unverified, the engine must return `INDETERMINATE` with `status: INCOMPLETE_SOURCE_COVERAGE`.
5. **No Autonomous Adjudication or Official Status Claims**: Outputs are advisory assistive proposals with statutory citations, requiring human administrative verification before formal filings or adverse impacts.
6. **Immutable Historical Audit Ledger**: Historical evaluations are persisted with a cryptographic digest of the rule snapshot and inputs, ensuring tamper-evident auditability.

---

## 3. Component Architecture & Data Flow

```
                                      +---------------------------------------------+
                                      |   Citizen / Reviewer / Calling Service     |
                                      +----------------------+----------------------+
                                                             |
                                           Request payload   | (ruleFamilyId, jurisdiction,
                                                             |  asOfDate, eventDateType,
                                                             |  attributes)
                                                             v
+---------------------------------------------------------------------------------------------------+
| Boundary Validation & Defense Layer                                                               |
|  - Validates ISO 8601 timestamps and checks effectiveTo >= effectiveFrom                          |
|  - Validates ISO 3166-2:IN jurisdiction format                                                     |
|  - Cycle detection in supersedes / supersededBy DAG                                               |
+----------------------------------------------------+----------------------------------------------+
                                                     |
                                                     v
+---------------------------------------------------------------------------------------------------+
| Temporal Policy Engine (src/services/temporalPolicyEngineService.js)                              |
|                                                                                                   |
|  +-------------------------------------+        +-----------------------------------------------+  |
|  | Point-in-Time ("As-Of") Resolver    |        | Continuous Interval Analyzer                  |  |
|  | - Filters rules where:              |        | - Detects temporal gaps between versions      |  |
|  |   from <= asOfDate <= to            |        | - Flags overlapping concurrent rule conflicts |  |
|  | - Resolves jurisdiction hierarchy   |        | - Identifies orphaned supersessions           |  |
|  +------------------+------------------+        +-----------------------+-----------------------+  |
|                     |                                                   |                          |
|                     v                                                   v                          |
|  +----------------------------------------------------------------------------------------------+  |
|  | Epistemic Humility Gatekeeper                                                                |  |
|  | - Verifies source circular provenance (gazette number, issuing body, citation link)          |  |
|  | - If unverified or interval partial -> OUTCOME: INDETERMINATE                                |  |
|  | - Strictly prevents autonomous benefit denials or authoritative legal advice                 |  |
|  +--------------------------------------------------+-------------------------------------------+  |
|                                                     |                                              |
|                                                     v                                              |
|  +----------------------------------------------------------------------------------------------+  |
|  | Deterministic Condition Evaluator                                                            |  |
|  | - Evaluates threshold conditions (age, income, land, residency) against snapshot             |  |
|  | - Traces exact rule clause citations and fee structures                                      |  |
|  +--------------------------------------------------+-------------------------------------------+  |
+-----------------------------------------------------+---------------------------------------------+
                                                      |
                         +----------------------------+----------------------------+
                         |                                                         |
                         v                                                         v
+---------------------------------------------------+     +---------------------------------------------------+
| Immutable Historical Ledger                       |     | Accessible User UI Slice                          |
| - Generates deterministic snapshot digest         |     | - Timeline Scrubber & Version Tree                |
| - Saves evaluation record with sanitized inputs   |     | - What-If As-Of Date Simulator                    |
| - Enforces retention and zero-PII storage         |     | - Temporal Gap & Conflict Warning Banner          |
+---------------------------------------------------+     | - WCAG 2.1 AA screen-reader accessible matrix     |
                                                          +---------------------------------------------------+
```

---

## 4. Domain Data Contracts

### 4.1 Effective-Dated Rule (`EffectiveDatedRule`)

```typescript
interface EffectiveDatedRule {
  id: string; // e.g., 'rule_ews_mh_2022_v2'
  ruleFamilyId: string; // e.g., 'scheme_ews_certificate'
  version: string; // e.g., '2.1.0'
  title: string;
  jurisdictionLevel: 'central' | 'state' | 'district' | 'local';
  jurisdictionCode: string; // ISO 3166-2:IN (e.g., 'IN-MH', 'IN-KA')
  jurisdictionName?: string;
  eventDateType: 'APPLICATION_DATE' | 'INCIDENT_DATE' | 'EVENT_DATE' | 'NOTIFICATION_DATE';
  effectiveFrom: string; // ISO 8601 UTC timestamp
  effectiveTo: string | null; // ISO 8601 UTC timestamp or null for active
  supersedesRuleId: string | null;
  supersededByRuleId: string | null;
  conditions: Array<{
    id: string;
    field: string; // e.g., 'annualFamilyIncome'
    operator: 'LESS_THAN_OR_EQUAL' | 'GREATER_THAN_OR_EQUAL' | 'EQUALS' | 'IN_LIST';
    value: number | string | boolean | string[];
    unit?: string;
    description: string;
  }>;
  feeStructure: {
    amount: number;
    currency: string;
    concessionAvailable: boolean;
    concessionDetails?: string;
  };
  requiredDocuments: Array<{
    documentCode: string;
    title: string;
    mandatory: boolean;
  }>;
  sourceMetadata: {
    documentType: 'GAZETTE_NOTIFICATION' | 'STATUTORY_CIRCULAR' | 'EXECUTIVE_ORDER';
    notificationNumber: string;
    issuingAuthority: string;
    gazetteDate: string;
    citationUrl?: string;
    isVerified: boolean;
    verificationNotes?: string;
  };
  status: 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}
```

### 4.2 Historical Evaluation Snapshot

```typescript
interface HistoricalEvaluationSnapshot {
  evaluationId: string;
  ruleFamilyId: string;
  evaluatedRuleId: string;
  ruleVersion: string;
  ruleDigestHash: string; // SHA-256 digest of evaluated rule content
  asOfDate: string;
  eventDateType: string;
  jurisdictionCode: string;
  evaluatedAt: string;
  outcome: 'ELIGIBLE' | 'INELIGIBLE' | 'INDETERMINATE';
  statusReason: string;
  decisionPath: Array<{
    conditionId: string;
    field: string;
    actualValue: any;
    expectedThreshold: any;
    operator: string;
    passed: boolean;
  }>;
  feesApplicable: {
    amount: number;
    currency: string;
  };
  mandatoryDocuments: string[];
  citations: Array<{
    authority: string;
    notificationNumber: string;
    date: string;
  }>;
  disclaimer: string;
}
```

---

## 5. Threat Model (STRIDE / Civic Trust Framework)

| Threat Category | Potential Attack / Vulnerability | Mitigation in Engine |
| :--- | :--- | :--- |
| **Spoofing / Identity** | An unauthenticated client submits fake circulars or claims arbitrary administrative override. | Admin operations require verified Clerk role authentication; rules require `sourceMetadata.isVerified = true` by an authorized catalogue maintainer before activation. |
| **Tampering** | Retroactive modification of historical rules to alter past eligibility records. | Historical rules are append-only. New revisions must be published with a new semantic version, updated `effectiveFrom`, and `supersededByRuleId`. Evaluation snapshots store immutable `ruleDigestHash`. |
| **Repudiation** | Dispute over whether an applicant met eligibility criteria on their application submission date. | Immutable `HistoricalEvaluationSnapshot` captures exact evaluated rule version, timestamps, input facts, and statutory citation. |
| **Information Disclosure** | Citizen PII (income, Aadhaar, address) leaking into diagnostic error logs, analytics, or rule caches. | Strict data minimization: evaluation inputs are sanitized before logging; tests exclusively use synthetic fixtures; zero citizen PII is persisted in policy rules. |
| **Denial of Service (DoS)** | Cyclic supersession pointers (`A supersedes B supersedes A`) or inverted infinite intervals causing recursion crashes. | Graph cycle detection at service boundaries; depth-bounded traversal (`maxDepth = 32`); regex input validation on ISO strings. |
| **Elevation of Privilege / Epistemic Hallucination** | System issues definitive legal verdicts or autonomous benefit denials on incomplete or ambiguous circulars. | **Epistemic Humility Gate**: Engine flags `INDETERMINATE` with explicit missing citation requirements whenever source coverage is incomplete or unverified. Prominent statutory disclaimer on all user outputs. |

---

## 6. Failure Modes & Operational Recovery

1. **Uncovered Temporal Interval (Gap)**:
   - *Symptom*: User query date falls between the expiration of Rule A and the enactment of Rule B.
   - *Behavior*: Engine returns `outcome: INDETERMINATE`, flags `status: TEMPORAL_GAP_DETECTED`, and details the surrounding boundary dates.
   - *Maintainer Action*: Maintainer inspects administrative change log to backfill transitional notification.
2. **Conflicting Overlapping Rules**:
   - *Symptom*: Two distinct active rules exist for the same jurisdiction and date window without a priority rule.
   - *Behavior*: Engine returns `outcome: INDETERMINATE`, flags `status: TEMPORAL_CONFLICT_DETECTED`, and isolates conflicting rule IDs.
   - *Maintainer Action*: Catalogue team clarifies whether Rule B supersedes Rule A or whether they represent distinct sub-schemes.
3. **Invalid or Malformed Event Date**:
   - *Symptom*: Client passes non-ISO string, future date beyond horizon, or nonsense date.
   - *Behavior*: Fails fast at validation boundary with structured HTTP 400 / descriptive validation error without internal stack trace exposure.

---

## 7. Performance, Cost & Retention Limits

- **Evaluation Latency**: Deterministic point-in-time evaluation $\le 5\text{ms}$ for standard condition trees (in-memory lookup).
- **Graph Complexity Bounds**: Maximum supersession genealogy depth: 32 hops. Maximum conditions per rule: 50.
- **Data Retention**:
  - Live published rules: Retained indefinitely as historical statutory record.
  - Evaluation logs: In-memory simulation results are ephemeral. Persistent audit snapshots follow a 7-year statutory retention cycle per [DATA_RETENTION.md](file:///Users/divya/Documents/Civic-Help-Setu/docs/DATA_RETENTION.md).

---

## 8. Maintainer Operations Runbook

### Publishing a New Effective-Dated Policy Version
1. Ensure the gazette order or statutory circular is verified (`sourceMetadata.isVerified: true`).
2. Set `effectiveFrom` to the gazette's official enforcement timestamp.
3. If this replaces an existing rule, update the existing rule's `effectiveTo` to match `effectiveFrom` and set `supersededByRuleId`.
4. Run `validateTemporalRuleSet(rules)` to confirm zero introduced gaps or conflicts before deployment.
5. Execute regression test suites with synthetic scenario fixtures.
