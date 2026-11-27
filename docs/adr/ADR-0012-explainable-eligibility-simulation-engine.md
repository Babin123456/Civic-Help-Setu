# ADR-0012: Explainable Eligibility Simulation Engine with Counterfactuals

- **Status:** Accepted
- **Date:** 2026-11-26
- **Context:** Issue #1156 (`[level3][feature] Build an Explainable Eligibility Simulation Engine with Counterfactuals`)
- **Deciders:** Civic Help Setu Architecture & Security Working Group

---

## 1. Context and Problem Statement

Civic Help Setu helps citizens discover civic welfare schemes and municipal services. Historically, eligibility checks in public applications suffer from three critical shortcomings:
1. **Opaque Decisions:** Binary determinations ("Eligible" vs "Ineligible") without granular, source-grounded criteria traces explaining *why*.
2. **Lack of Actionable Recourse:** Citizens who fail a criteria threshold receive no actionable suggestions on minimal, realistic profile adjustments ("counterfactuals") that would qualify them.
3. **Deceptive Authority & Risk of Misinformation:** Applicants may misinterpret client-side guidance as an official, legally binding government grant or rejection. Additionally, boundary conditions (such as cutoff dates or margins of income) and conflicting evidentiary records are frequently swallowed by naive conditionals.

## 2. Decision Drivers

- **Deterministic & Grounded:** No generative LLM hallucination in decision logic. Rules must link to explicit statutory instruments (Gazette Orders, Ministry circulars).
- **Zero PII & Privacy-Preserving:** Operates client-side in the citizen's browser without egressing demographic data or financial profiles.
- **Explainability & Counterfactual Optimization:** Computes minimal edit distance across actionable/mutable inputs while keeping immutable traits (historical events, statutory identity traits) constrained.
- **Boundary & Conflict Awareness:** Explicitly highlights boundary dates (e.g. standard 21-day birth reporting window) and conflicting evidence (e.g. self-declared income exceeding BPL ceilings).
- **Statutory Non-Determination Disclaimer:** Enforces clear differentiation between informational simulation guidance and official government adjudication.

---

## 3. Considered Options

1. **Option A: LLM-driven prompt simulation.** (Rejected: Non-deterministic, hallucinations, potential PII leakage, high latency, violates privacy principles).
2. **Option B: Flat procedural conditional functions (Status Quo extended).** (Rejected: Hard to compute automated multi-variable counterfactual perturbations, lacks versioned graph topology, difficult to trace edge dependencies).
3. **Option C: Directed Acyclic Graph (DAG) Rule Model with Deterministic Counterfactual Beam Search.** (Chosen: Formally verifiable, deterministic, typed contracts, modular versioning, blazing fast in-browser execution <20ms).

---

## 4. Architecture Decision

We implement a modular, versioned Rule Graph and Counterfactual Simulation Engine:

### 4.1 Component Boundaries & Data Flow

```
+-----------------------------------------------------------------------------------+
| Browser Client Layer (React)                                                      |
|                                                                                   |
|  [Citizen Profile / What-If Inputs]                                               |
|             |                                                                     |
|             v                                                                     |
|  [simulationContracts.js]  ----> Validates types, ranges, sanitizes & blocks PII  |
|             |                                                                     |
|             v                                                                     |
|  [ruleGraphRegistry.js]    ----> Versioned Rule Graphs (v1.0.0) with Citations     |
|             |                                                                     |
|             v                                                                     |
|  [eligibilitySimulationService.js]                                                |
|       * Evaluates Condition Nodes (Satisfied / Missing / Unknown / Conflicting)   |
|       * Evaluates Boundary Proximity (Near threshold / Deadline warnings)         |
|       * Detects Evidence Discrepancies (Contradictory document claims)             |
|             |                                                                     |
|             v                                                                     |
|  [counterfactualEngine.js] ----> Computes minimal cost perturbations (What-If)    |
|             |                                                                     |
|             v                                                                     |
|  [EligibilitySimulationWorkspace.jsx]                                            |
|       * Condition Audit Tree with Statutory Provenance Citations                  |
|       * Actionable Counterfactual Path Recommendations Cards                      |
|       * Mandatory Statutory Non-Determination Disclaimer                          |
+-----------------------------------------------------------------------------------+
```

### 4.2 Core Domain Model

- **`RuleGraph`**: Defines scheme or service criteria as nodes with types:
  - `THRESHOLD` (numeric ceiling/floor: income, landholding)
  - `BOOLEAN` (flags: land ownership, student status)
  - `CHOICE` (discrete sets: occupation, social category)
  - `DATE_BOUNDARY` (statutory cutoffs: birth reporting within 21 days, minor aging)
  - `DOCUMENT_PREREQUISITE` (official records: Aadhaar e-KYC, Income Certificate)
- **`ConditionState`**:
  - `satisfied`: Criteria fully confirmed by input.
  - `unsatisfied`: Criteria violated by input.
  - `unknown`: Field missing or left blank.
  - `conflicting`: Multiple provided inputs contradict each other.
  - `needs_official_verification`: Requires physical departmental inspection.
- **`Counterfactual`**:
  - Distance cost function: $Cost = \sum w_i \cdot \text{distance}(x_i, x'_i)$
  - Weights penalize immutable traits ($\infty$), hard changes ($5.0$), and prioritize actionable steps ($1.0$).
  - Max perturbation depth $\le 3$; bounded execution time $< 25\text{ms}$.

---

## 5. Security and Operational Implications

- **Input Validation:** Strict type-checking and rejection of forbidden PII fields (`FORBIDDEN_FIELDS`).
- **Safe Error Handling:** Evaluation failures yield an `INCONCLUSIVE` result with clear diagnostic messages without breaking other schemes or UI components.
- **Telemetry & Diagnostics:** Telemetry routed strictly through `src/utils/diagnostics.js` without logging user inputs.
- **Rollback & Migration:** Rule graphs are versioned (e.g., `v1.0.0`). New legislative amendments are published under new versions without disrupting historical assessments.

---

## 6. Compliance and Scope Boundaries

This engine **never**:
1. Claims official legal status or issues binding benefit denials.
2. Interacts with live government portals without explicit statutory API integration.
3. Ingests or stores unmasked citizen PII or real credentials.
