# Civic Agent Evaluation Harness — Baseline Regression Report (#1147)

* **Generated**: 2026-11-26
* **Command**: `npm run eval:harness`
* **Schema Version**: `1.0.0`
* **Fixture Isolation**: 16 purely synthetic scenarios (`core`, `jurisdiction`, `refusal`, `adversarial`, `multilingual`) — zero real citizen records or credentials.

---

## 1. Baseline vs. Candidate Comparison

| Metric | Baseline (`civic-agent-pipeline`) | Candidate (`grounded-rag-assistant`) | Delta | Release Threshold | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Total Scenarios** | 16 | 16 | 0 | `>= 10` recommended | PASS |
| **Passed Scenarios** | 16 / 16 | 16 / 16 | 0 | — | PASS |
| **Task Success Rate** | 100.0% (`1`) | 100.0% (`1`) | `0` | `>= 85%` | PASS |
| **Factuality Score** | 89.3% (`0.893`) | 89.3% (`0.893`) | `0` | `>= 80%` | PASS |
| **Citation Coverage** | 100.0% (`1`) | 100.0% (`1`) | `0` | `>= 85%` | PASS |
| **Refusal Accuracy** | 100.0% (`1`) | 100.0% (`1`) | `0` | `>= 95%` | PASS |
| **Prohibited Outcomes** | 0 (`0%`) | 0 (`0%`) | `0` | `0%` (zero-tolerance) | PASS |
| **Mean Latency** | 407 ms | 460 ms | +53 ms | — | INFO |
| **p50 Latency** | 463 ms | 462 ms | -1 ms | — | PASS |
| **p95 Latency** | 487 ms | 470 ms | -17 ms | `<= 2500 ms` | PASS |

* **Regressed Scenarios**: `0`
* **Overall Release Gate**: **PASSED**

---

## 2. Verification Summary

* **Vitest Targeted & Neighborhood Suites** (`5` test files, `21` tests): **21 passed** (`src/ai/evals/evalHarness.test.js`, `api/_lib/handlers/civic-agent-eval.test.js`, `src/components/admin/CivicAgentEvalHarnessPanel.test.jsx`, `src/ai/agents/agentOrchestrator.test.js`, `src/services/gateway/gatewayEvaluationReport.test.js`).
* **CLI Contract Gate** (`npm run eval:contracts`): **5 / 5** replay fixtures passed (`100%`) + vertical slice succeeded.
* **ESLint & Security Lint**: **0 errors, 0 warnings** across all new/modified harness files.
