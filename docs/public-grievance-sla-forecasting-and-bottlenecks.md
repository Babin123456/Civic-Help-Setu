# Public Grievance SLA Forecasting and Bottleneck Analytics Engine (#1175)

## Overview & Architecture Decision Record (ADR)
Public grievance redressal across Indian civic services frequently encounters structural delays. However, presenting estimated resolution dates as legal promises misleads citizens and risks eroding public trust.

The **Public Grievance SLA Forecasting and Bottleneck Analytics Engine** (`src/services/grievanceSlaForecastingService.js`, `src/pages/GrievanceSlaForecastingWorkspace.jsx`) provides:
1. **Separation of Statutory Mandate vs. Empirical Projections**:
   - **Statutory SLA**: Legal mandate enacted under state Right to Public Services / Citizens Charters (e.g., 7 days for municipal water supply, 30 days for ration card issuance).
   - **Cohort Empirical Projections**: Statistical turnaround distributions (median, IQR, 80% and 95% confidence intervals) derived from aggregated historical cohorts.
2. **Zero-Guarantee Legal Principle**: Prominent user-facing disclaimers and UI notices clarifying that projections are non-binding estimates.
3. **Differential Privacy & k-Anonymity Gate**:
   - Strict threshold (`MIN_COHORT_SAMPLE_SIZE = 10`). Cohorts with fewer cases are suppressed to eliminate individual case re-identification.
4. **Lifecycle Stage Bottleneck Breakdown**:
   - Decomposes turnaround time into stages: `INTAKE_TRIAGE`, `FIELD_INSPECTION`, `DEPARTMENT_REVIEW`, `APPELLATE_REVIEW`, and `CLOSURE_DISPATCH`.
   - Flags excess delays relative to operational benchmarks to isolate root causes.
5. **Human-in-the-Loop Governance Gate**:
   - Automated AI diagnostic suggestions cannot autonomously execute reallocations or policy decisions.
   - Proposals require explicit authorized officer sign-off with recorded rationale and an immutable audit trail (`PROPOSE`, `APPROVE`, `REJECT`).
6. **Model Drift & Calibration Evaluation**:
   - Evaluates distribution shifts (`meanShiftDays`) and Expected Calibration Error (`ECE`) comparing predicted breach probabilities with ground-truth validation samples.

---

## Data Flow & Architecture

```
+------------------------------------+
|  Aggregated Grievance Data Cohorts |
|      (Zero Individual PII)         |
+-----------------+------------------+
                  |
                  v
+-----------------+------------------+
|    Privacy Preservation Gate       |
|    (k-Anonymity: N >= 10)          |
+--------+------------------+--------+
         | (N < 10)         | (N >= 10)
         v                  v
+-----------------+  +--------------------------------------------+
| Privacy Masked  |  | Cohort Turnaround Forecaster               |
| & Suppressed    |  | - Rank-based Median & IQR (p25 - p75)      |
+-----------------+  | - Prediction Intervals (80% & 95%)         |
                     | - Breach Risk Probability & Risk Levels    |
                     +----------------------+---------------------+
                                            |
                                            v
                     +--------------------------------------------+
                     | Stage Bottleneck Decomposition             |
                     | - Intake, Inspection, Review, Dispatch     |
                     +----------------------+---------------------+
                                            |
                                            v
                     +--------------------------------------------+
                     | Human-in-the-Loop Approval Gate            |
                     | - Officer Review, Sign-off & Audit Trail   |
                     +--------------------------------------------+
```

---

## Threat Model & Security Boundaries

1. **Inference Attacks on Individual Grievances**:
   - *Risk*: An attacker uses narrow cohort queries to deduce whether a specific high-profile grievance was filed or resolved.
   - *Mitigation*: Any cohort slice with $N < 10$ is suppressed. Output contains aggregated metrics only; individual dockets or names are never retained in contract schemas.
2. **Autonomous Overreach / False Assurance**:
   - *Risk*: AI models make autonomous administrative decisions or promise citizens a guaranteed resolution date.
   - *Mitigation*: Engine restricts AI outputs to non-binding suggestions with provenance. Interventions require human officer sign-off.
3. **Data Poisoning & Drift**:
   - *Risk*: Changes in civic administration lead to stale or misleading predictions.
   - *Mitigation*: Built-in drift and calibration monitor (`evaluateForecastDriftAndCalibration`) continuously compares predicted breach likelihood against empirical validation sets.

---

## Verification & Reproducible Commands

Run tests:
```bash
./node_modules/.bin/vitest run src/data/grievanceSlaContract.test.js
./node_modules/.bin/vitest run src/services/grievanceSlaForecastingService.test.js
./node_modules/.bin/vitest run src/pages/GrievanceSlaForecastingWorkspace.test.jsx
```

Run linter:
```bash
./node_modules/.bin/eslint src/data/grievanceSlaContract.js src/services/grievanceSlaForecastingService.js src/pages/GrievanceSlaForecastingWorkspace.jsx
```
