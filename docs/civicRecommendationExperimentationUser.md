# Civic Service Recommendation Experimentation Platform with Guardrails — User Guide (#1193)

## Overview

The **Civic Service Recommendation Experimentation Platform** allows civic tech maintainers, product teams, and researchers to test and compare alternative service recommendation strategies while strictly protecting citizens from unfair, unsafe, or discriminatory experiments.

Key features include:
1. **Deterministic Feature Flags:** Consistent assignment of citizens to experiment variants without tracking personal identities.
2. **Citizen Opt-In Consent:** Experimental algorithms only apply to citizens who have explicitly opted in.
3. **Prohibited Sensitive Attribute Protection:** Targeting or filtering by caste, religion, gender, Aadhaar, PAN, or exact income is strictly prohibited and blocked at the trust boundary.
4. **Automated Guardrails:** Continuously enforces minimum relevance, regional language coverage, and low error rates.
5. **Immediate Rollback:** One-click kill-switch to abort any active experiment and revert immediately to the standard rule-based baseline.

---

## Accessing the Workspace

Navigate to `/recommendation-experimentation` in your browser.
The interface is designed mobile-first, conforms to WCAG 2.1 AA accessibility guidelines, and functions offline with in-browser persistence.

---

## Key Workflows

### 1. Browsing Experiments & Guardrails

- Open the **Experiments Catalog** tab to view all registered experiments (e.g. `exp-service-discovery-v1`).
- Inspect status badges: `active`, `draft`, `paused`, `concluded`, or `rolled_back`.
- Review comparative variant metrics (assignments count, mean relevance, language coverage, and error rates).
- Notice that if an experiment has fewer assignments than the minimum cohort threshold (`minCohortSize`), variant metrics are masked to preserve privacy and prevent small-sample bias.

### 2. Creating an Experiment with Guardrails

- Open the **New Experiment** tab.
- Provide a unique lowercase slug (e.g. `exp-local-priority`).
- Enter a descriptive name and test hypothesis.
- Configure mandatory guardrails:
  - **Min Relevance Floor (0–1):** Threshold below which recommendation quality is unacceptable.
  - **Min Language Coverage (0–1):** Required ratio of recommendations available in local languages.
  - **Max Error Rate (0–1):** Allowable failure rate before triggering an alert.
  - **Min Cohort Threshold:** Minimum assignment volume required before publishing metrics.
- Keep the **Require Opt-In** checkbox checked to ensure citizens explicitly consent before assignment.
- Select **Register & Activate Experiment**.

### 3. Simulating Deterministic Assignments

- Open the **Assignment Simulator** tab.
- Select an active experiment from the dropdown.
- Input a pseudonymous citizen identifier (e.g. `citizen-urban-01`).
- Toggle the **Opt-In** checkbox and choose a preferred language.
- Select **Run Assignment Evaluation**.
- Observe the deterministic hash bucket and assigned variant. Repeating the simulation with the same citizen ID will always produce the exact same variant, ensuring consistent user experiences across sessions.

### 4. Triggering an Immediate Rollback

- If an experiment breaches quality standards or causes user confusion, maintainers can immediately trigger a rollback.
- In the **Experiments Catalog**, select **Trigger Immediate Rollback**.
- The experiment status transitions to `rolled_back` instantly, and all future traffic is safely redirected to the baseline rule-based control strategy.
- An immutable entry is logged in the **Audit Trail**.

---

## Safety & Ethics Principles

- **Diagnostic Hints Only:** Recommendation scores are informative indicators based on citizen preferences. They do not constitute an official government eligibility decision or legal benefit entitlement.
- **Human Review Guarantee:** Maintainers must manually approve high-impact actions. The system never autonomously files applications or alters citizen records.
- **Prohibited Attributes:** The platform blocks any experiment targeting sensitive demographic attributes (caste, religion, gender, Aadhaar, PAN).
- **Synthetic Data:** All demonstrations and unit tests operate strictly on synthetic fixtures with zero citizen records or credentials.
