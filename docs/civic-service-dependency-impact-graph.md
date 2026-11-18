# Civic Service Dependency Impact Graph for Administrators

## Overview
In a multi-tier civic delivery framework, changes to upstream rules—such as an annual gross income ceiling revision for welfare eligibility, a fire clearance height threshold update in the National Building Code, an updated list of accepted residence proofs, or revised municipal user fees—inevitably propagate across dozens of service guides, checklists, application forms, and public help articles.

Previously, catalogue maintainers lacked full visibility into this downstream blast radius prior to publishing. As a result, changes risked creating broken references, inconsistent eligibility advice, and scrutiny rejections for citizens.

The **Civic Service Dependency Impact Graph Service** (`src/services/civicServiceDependencyImpactService.js`) introduces an enterprise-grade dependency index and downstream impact tracer. It allows catalogue administrators and content reviewers to simulate the exact downstream ripple effects of any draft catalogue record, inspect affected services and forms, view an accessible tabular report, and record formalized impact approval decisions with immutable audit logging.

---

## Architectural Workflow

```
   [ Upstream Shared Rule or Catalogue Record Change ]
                           |
                           v
         +-----------------------------------+
         | Graph Integrity & Cycle Detection |
         |   - Depth-First Search Traversal  |
         |   - Dangling Edge Verification    |
         +-----------------+-----------------+
                           |
                           v
         +-----------------------------------+
         | Downstream Impact Engine          |
         |   - Breadth-Bounded Traversal     |
         |   - Severity Scoring (CRITICAL,   |
         |     MODERATE, LOW)                |
         |   - Depth & Content-Type Filters  |
         +-----------------+-----------------+
                           |
          +----------------+----------------+
          |                                 |
          v                                 v
+--------------------+            +--------------------+
| Directed Visual Map|            | Tabular Report     |
| (Interactive nodes |            | (WCAG Non-Visual   |
|  & typed edges)    |            |  Accessible View)  |
+--------------------+            +--------------------+
                           |
                           v
         +-----------------------------------+
         | Role-Based Decision & Audit Store |
         |   - RBAC (ADMIN / REVIEWER)       |
         |   - Mandatory Formal Rationale    |
         |   - Masked Export Sanitization    |
         +-----------------------------------+
```

---

## Architectural Capabilities

### 1. Typed Reference Registry & Integrity Validation
The service indexes catalogue assets across standard node types (`NODE_TYPE`):
- **`SHARED_RULE`**: Core statutory rules governing eligibility, limits, or documentation.
- **`SERVICE_GUIDE`**: Public-facing civic service pages detailing steps and timelines.
- **`CHECKLIST`**: Scrutiny checklists used by officers and citizens to ensure compliance.
- **`APPLICATION_FORM`**: Statutory forms submitted by applicants.
- **`HELP_ARTICLE`**: Plain-language explainers and citizen rights guides.
- **`FEE_SCHEDULE`**: Gazetted municipal tariffs and scrutiny fees.

`validateDependencyIntegrity(catalogue)` systematically checks the entire registry before computing impact:
- Ensures every dependency edge references valid source and target nodes.
- Uses Depth-First Search with recursion stacks to detect circular dependencies (e.g. `X -> Y -> Z -> X`).

### 2. Deterministic Downstream Impact Analysis
- `computeDownstreamImpactGraph(catalogue, rootNodeId, options)` traverses forward edges from the modified root node up to `maxDepth` (default: 3).
- Evaluates impact severity:
  - **`CRITICAL`**: Direct changes to core statutory parameters (e.g., income ceiling, height threshold, accepted identity proofs). Requires administrative review before publishing.
  - **`MODERATE`**: Secondary downstream consequences affecting forms or checklists one hop away.
  - **`LOW`**: Tertiary downstream guides or advisory help articles.
- Supports precision filtering by `contentTypeFilter` (e.g., only affected `SERVICE_GUIDE` records) and `jurisdictionFilter` (e.g., `MUNICIPAL_TOWN_PLANNING`).

### 3. Accessible Tabular Impact Reporting
- `getTabularImpactReport(impactGraph)` flattens graph structures into a clean tabular dataset.
- Conforms to WCAG accessibility criteria, providing full insight into node IDs, titles, jurisdictions, direct parents, impact ratings, and statutory citations without relying on mouse hover or visual canvas interactions.

### 4. AI Guardrails & Transparency
- Advisory summaries strictly derive from explicit graph edges and versioned rules.
- Explicitly disclaims automated policy decisions: AI-generated summaries are tagged `isAdvisory: true` and require human administrative sign-off before publishing.

### 5. Role-Based Administration & Audit Logging
- **`CATALOGUE_ADMIN`**: Authorized to approve breaking changes (`CRITICAL`) and record publishing decisions.
- **`CONTENT_REVIEWER`**: Authorized to approve non-critical changes with mandatory justification notes.
- **`VIEWER`**: Read-only access to impact simulations and historical review records.
- `sanitizeImpactRecordForExport(record)` scrubs reviewer PII and internal security tokens for compliance reporting.

---

## Statutory Notice & Boundary

> [!IMPORTANT]
> **Administrative Notice**: This dependency impact analysis simulates downstream effects on Civic Help Setu service guides, checklists, and forms. Impact review decisions do not alter statutory government gazettes, municipal by-laws, or official government portals.

---

## Verification & Test Coverage
- **Unit Test Suite**: `src/services/civicServiceDependencyImpactService.test.js`
- **Results**: 19/19 tests passing.
- **Linting & Security**: 0 errors, 0 warnings across ESLint and `eslint.security.config.js`.
