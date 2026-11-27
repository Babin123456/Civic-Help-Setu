# Civic Application Form Field Dependency and Validation Map Architecture

## Overview
Applying for statutory civic documents and permits—such as Income & Asset Certificates, High-Rise Building Sanctions, Caste Certificates, or Trade Licences—involves complex, multi-tiered forms. Government portals frequently present confusing conditional requirements where answers to upstream questions suddenly trigger mandatory documentation, certificates, or annexures. When applicants lack visibility into this dependency graph, submissions face delays, administrative queries, or outright rejection during scrutiny.

The **Civic Application Form Field Dependency and Validation Map Service** (`src/services/formFieldDependencyMapService.js`) provides an authoritative client-side validation engine and directed dependency graph. It allows citizens to model prerequisites, understand the exact statutory reason why specific documentation is demanded, prune invalid or obsolete downstream inputs reactively, and verify completeness before approaching official statutory e-district or municipal portals.

---

## Architectural Principles

```
  +-------------------------------------------------------+
  |              Authoritative Form Schemas               |
  | (INCOME_CERTIFICATE_FORM, BUILDING_PLAN_SANCTION_FORM)|
  +---------------------------+---------------------------+
                              |
                              v
  +-------------------------------------------------------+
  |          Graph Integrity & Cycle Detection           |
  |     - DFS Cycle Detection                              |
  |     - Dangling Reference Validation                    |
  +---------------------------+---------------------------+
                              |
                              v
  +-------------------------------------------------------+
  |         Reactive Evaluator & Pruning Engine           |
  |     - evaluateCondition (EQUALS, NUMERIC, IN_LIST)    |
  |     - Downstream Branch Answer Pruning                 |
  |     - Regex Format Validation & Field States          |
  +---------------------------+---------------------------+
                              |
             +----------------+----------------+
             |                                 |
             v                                 v
+---------------------------+    +---------------------------+
|  Directed Graph View Engine|    | Linear Accessible View    |
| (Nodes, Edges, Relations) |    | (WCAG Screen-Reader Ready)|
+---------------------------+    +---------------------------+
```

### 1. Declarative Schemas with Statutory Justifications
Each field in a supported form schema defines:
- **`fieldId` & `label`**: Semantic identifier and citizen-friendly title.
- **`fieldType`**: `SELECT`, `TEXT`, `NUMBER`, `BOOLEAN`, etc.
- **`dependsOn`**: Explicit condition specification (`fieldId`, `condition`, `expectedValue`).
- **`statutoryRule`**: The exact regulatory, municipal bye-law, or Right to Public Services (RTS) manual citation mandating the requirement (e.g., *NBC 2016 Part 4 Clause 2.27*, *National Food Security Act 2013*).

### 2. Graph Integrity & Cycle Detection
To guarantee evaluation safety and avoid infinite reactive loops:
- `validateSchemaIntegrity(schema)` scans the dependency graph before evaluation or session initialization.
- Uses Depth-First Search (DFS) with recursion stack tracking to identify circular dependencies (e.g., `Field A -> Field B -> Field C -> Field A`).
- Verifies that all `dependsOn.fieldId` targets exist within the schema, failing fast with `DANGLING_DEPENDENCY_REFERENCE` if any reference is broken.

### 3. Reactive State Evaluation & Downstream Pruning
When an applicant updates an upstream answer:
- `evaluateFormState(schema, answers)` traverses fields in dependency order.
- Inactive conditional fields are automatically transitioned to `FIELD_STATE.INACTIVE_PRUNED`.
- **Downstream Answer Pruning**: Any previous answers belonging to pruned fields are stripped from `sanitizedAnswers`. For instance, if an applicant changes occupation from `STUDENT` to `SALARIED`, student identity proofs are removed, preventing invalid or mismatched submissions.
- Form completion and readiness verdicts (`READY_FOR_OFFICIAL_PORTAL` vs `UNRESOLVED_VALIDATIONS`) are dynamically updated.

### 4. Dependency Trail Inspection
- `inspectDependencyPath(schema, targetFieldId)` traces the full hierarchy of conditions and questions that lead to any conditional field.
- Gives applicants transparency into *why* a particular document is requested, citing the exact statutory clause.

### 5. Multi-Modal Visualizer & Linear Accessibility
- **Directed Graph Representation** (`generateFieldDependencyGraph`): Produces node and edge structures with active/inactive indicators for interactive visual map rendering.
- **Accessible Linear View** (`getLinearAccessibleFormView`): Flattens active fields into a sequential list with plain-language explanations, current inputs, validation errors, and statutory rules for screen readers and keyboard users.

### 6. Privacy Minimization & Export Sanitization
- Distinguishes client-side preparation drafts from official government submissions.
- `sanitizeFormSessionForExport(session)` redacts sensitive values (strings exceeding 4 characters such as Aadhaar, ITR references, and bank account numbers) and masks session identifiers for safe compliance logs or offline sharing.
- User session isolation guarantees citizens can only access their own draft forms.

---

## Supported Civic Form Schemas

### 1. Income and Asset Certificate (`INCOME_CERTIFICATE_FORM`)
- **Authority**: Department of Revenue & Disaster Management / Taluka Tahsildar.
- **Root Fields**: `applicant_category` (`STUDENT`, `SALARIED`, `AGRICULTURIST`, `BUSINESS_OWNER`), `has_bpl_ration_card` (`BOOLEAN`).
- **Conditional Branches**:
  - `STUDENT`: Requires `institution_id_proof` and optional `tuition_fee_structure`.
  - `SALARIED`: Requires `form_16_or_salary_slips`.
  - `AGRICULTURIST`: Requires `land_patta_khasra_extract`.
  - `BUSINESS_OWNER`: Requires `gstin_or_itr_acknowledgement`.
  - `has_bpl_ration_card = true`: Requires 12-digit `bpl_ration_card_number` with regex format validation (`^\d{12}$`).

### 2. Municipal Building Permit Sanction (`BUILDING_PLAN_SANCTION_FORM`)
- **Authority**: Municipal Corporation Town Planning Scrutiny Cell.
- **Root Fields**: `plot_jurisdiction_tier`, `proposed_building_height_m`, `is_commercial_or_assembly`.
- **Conditional Branches**:
  - `proposed_building_height_m > 15.0`: Automatically activates mandatory `fire_provisional_noc_number` under National Building Code (NBC) 2016 Part 4.
  - `is_commercial_or_assembly = true`: Requires State Pollution Control Board (SPCB) Consent-to-Establish reference under Water Act Section 25.

---

## Statutory Scope & Legal Disclaimer

> [!IMPORTANT]
> **Statutory Notice**: This form dependency map and validation check is a client-side preparation tool to prevent scrutiny rejections. It **DOES NOT** submit an official application or claim government portal acceptance. Official filing must be executed on the designated statutory department portal.

---

## Quality & Test Verification
The implementation is thoroughly verified with Vitest and ESLint:
- **Test File**: `src/services/formFieldDependencyMapService.test.js`
- **Coverage**: 27 unit tests validating schema cycles, condition operators, downstream pruning, regex formats, dependency path tracing, accessibility linearization, and multi-tenant session privacy.
- **Code Standards**: 100% pass on ESLint and security-specific lint rules (`eslint.security.config.js`).
