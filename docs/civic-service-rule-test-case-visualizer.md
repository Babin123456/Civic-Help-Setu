# Civic Service Rule Test-Case Visualizer for Catalogue Reviewers

## Overview
Civic rules governing welfare eligibility, fee structures, procedural exceptions, and document prerequisites are often nuanced. Variations across family income limits, land categories (such as irrigated vs notified non-irrigated dry land), applicant age, and domicile history make rule modifications high-stakes. Without automated deterministic test suites, maintainers face unpredictable side-effects when revising draft rules.

The **Civic Service Rule Test-Case Visualizer Service** (`src/services/civicServiceRuleTestCaseVisualizerService.js`) introduces a rigorous, automated testing sandbox for catalogue reviewers. It enables reviewers to execute approved synthetic scenario suites, trace deterministic decision paths, inspect before-and-after outcome shifts across rule versions, and enforce strict publication gatekeeping so that no draft rule can be published if test cases fail or discrepancies remain unresolved.

---

## Architecture & Core Workflow

```
   [ Catalogue Maintainer Edits Draft Rule Conditions ]
                           |
                           v
        +-------------------------------------+
        | Approved Synthetic Test Case Suite  |
        |  - Standard Eligibility Scenarios   |
        |  - Exact Boundary Thresholds        |
        |  - Exception & Concession Branches  |
        |  - Missing-Data Edge Cases          |
        +------------------+------------------+
                           |
                           v
        +-------------------------------------+
        | Deterministic Rule Evaluator        |
        |  - Step-by-Step Condition Matching  |
        |  - Missing Data -> INDETERMINATE    |
        |  - Auditable Evaluated Decision Path|
        +------------------+------------------+
                           |
           +---------------+---------------+
           |                               |
           v                               v
+---------------------+         +---------------------+
| Version Diff Matrix |         | Accessible Table    |
| (Side-by-side shift |         | (WCAG Non-Visual    |
|  v1 vs v2 diffs)    |         |  Scenario Matrix)   |
+---------------------+         +---------------------+
                           |
                           v
        +-------------------------------------+
        | Publication Gatekeeper & RBAC Audit |
        |  - Blocks approval if tests fail    |
        |  - Mandatory reviewer audit notes   |
        |  - Redacted export sanitization     |
        +-------------------------------------+
```

---

## Architectural Capabilities

### 1. Declarative Rules & Synthetic Test Case Registry
- **Declarative Condition Trees**: Conditions specify target fields, comparison operators (`LESS_THAN_OR_EQUAL`, `GREATER_THAN_OR_EQUAL`, `EQUALS`, `LESS_THAN_OR_EQUAL_WITH_EXCEPTION`), thresholds, and human-readable statutory descriptions.
- **Strictly Synthetic Non-PII Fixtures**: Test fixtures (`SYNTHETIC_EWS_TEST_CASES`) use entirely synthetic values to test standard, boundary, and exception scenarios. Real citizen records and PII are strictly prohibited.

### 2. Deterministic Rule Evaluator & Path Tracer
- `evaluateRuleCase(rule, testCase)` executes each condition node in isolation.
- **Handling Incomplete Inputs**: If an essential attribute is missing, the evaluator returns `INDETERMINATE` with `status: 'MISSING_DATA'` rather than guessing or applying arbitrary defaults.
- Generates an auditable `evaluatedPath` detailing inputs, effective thresholds, and pass/fail reasons.

### 3. Version Diff & Scenario Matrix
- `compareRuleVersions(currentRule, draftRule, testCases)` executes the test suite against both the currently published version and the draft revision.
- Identifies **Outcome Shifts**: Detects specific scenarios whose results changed (e.g. from `FAIL` in v1 to `PASS` in v2 due to a new rural concession).
- Provides an accessible, linearized scenario matrix (`getAccessibleScenarioMatrix`) suitable for screen readers and keyboard navigation.

### 4. AI Guardrails & Human Oversight
- AI may suggest synthetic edge cases or draft condition phrasing, but:
  - All AI output is labeled `isAdvisory: true`.
  - AI is strictly prohibited from deciding or approving expected test outcomes.
  - Deterministic evaluation code alone computes pass/fail/indeterminate statuses.

### 5. Publication Gatekeeper & Review Audit Logging
- **`recordReviewDecision`** enforces role-based access control (`CATALOGUE_ADMIN` or `CATALOGUE_REVIEWER`).
- **Gatekeeper Enforcement**: Attempting to approve a draft rule whose test suite contains failures or expectation discrepancies throws an immediate error (`Publication Gatekeeper: Cannot approve rule while synthetic test cases have unresolved failures`).
- Requires comprehensive reviewer rationale (minimum 15 characters).
- Provides masked audit history (`sanitizeRuleReviewRecordForExport`).

---

## Statutory Notice & Scope

> [!IMPORTANT]
> **Notice**: Synthetic test evaluation is a catalogue maintenance sandbox tool to verify deterministic rule logic prior to publishing. Test cases contain strictly synthetic non-PII data and do not represent actual citizen applications or official government adjudications.

---

## Verification & Test Metrics
- **Unit Test Suite**: `src/services/civicServiceRuleTestCaseVisualizerService.test.js`
- **Results**: 20/20 tests passing.
- **Linting & Security**: 0 errors, 0 warnings across ESLint and `eslint.security.config.js`.
