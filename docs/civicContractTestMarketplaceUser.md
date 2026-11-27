# Civic Service Integration Contract Test Marketplace — User Guide (#1191)

## Overview

The **Civic Service Integration Contract Test Marketplace** enables civic tech maintainers, API providers, and integrators to verify external civic APIs and internal microservices against versioned contracts.

With this marketplace, you can:
1. Register and inspect **Provider Adapters** (REST, GraphQL, SOAP, file, etc.).
2. Define reusable **Contract Suites** covering authentication, schemas, pagination, freshness, error handling, breaking changes, and malicious payloads.
3. Trigger scheduled or manual **Sandbox Runs** that execute synthetic tests safely without touching production citizen data.
4. Review **Redacted Conformance Reports** displaying overall conformance scores (0–100), latency distributions, breaking change alerts, and security warnings.
5. Track **Score Drift** over time to catch regressions before citizen services are affected.

---

## Accessing the Workspace

Navigate to `/contract-test-marketplace` in your browser.
The interface is designed mobile-first, conforms to WCAG 2.1 AA accessibility guidelines, and functions offline with in-browser persistence.

---

## Key Workflows

### 1. Registering or Viewing Provider Adapters

- Open the **Adapters** tab to view all registered civic integrations (e.g., `aadhaar-verification-api`, `ration-card-registry`, `parivahan-vehicle-rc`).
- Review adapter configurations: Base URL, Adapter Type, Auth Mechanism, Timeout, and Retry policies.
- Add new adapters by providing a lowercase slug identifier (e.g., `municipal-water-billing`), base URL, and communication protocol.

### 2. Creating & Organizing Contract Suites

- Open the **Suites** tab to view contract suites grouped by adapter.
- Each suite contains granular checks across 8 distinct contract types:
  - **Auth:** Ensures headers, keys, and tokens are evaluated cleanly.
  - **Schema:** Validates that response structures match declared specifications.
  - **Pagination:** Verifies page sizes, next tokens, and boundary limits.
  - **Freshness:** Asserts that data timestamps fall within acceptable SLAs.
  - **Error Behavior:** Confirms that invalid queries receive correct HTTP error responses.
  - **Breaking Change:** Checks for unexpected field removals or altered types.
  - **Malicious Payload:** Evaluates endpoint resistance against SQLi and XSS probes.
  - **Conformance:** Overall contract compliance score.

### 3. Executing a Test Run

- Select **Run Suite** on any active contract suite.
- The engine executes the synthetic sandbox evaluations deterministically.
- A comprehensive **Run Report** is generated:
  - **Conformance Score (0–100):** Weighted health metric.
  - **Summary Breakdown:** Count of passed, failed, skipped, and warned tests.
  - **Breaking Changes:** Highlights breaking regressions if detected.
  - **Malicious Payload Alerts:** Indicates potential security vulnerabilities.

### 4. Monitoring Drift and Audit Logs

- When a provider's score fluctuates by 5% or more between consecutive runs, a **Drift Event** is recorded.
- Review the **Audit Log** to inspect timestamps, actor roles, suite IDs, and reasons for every operation.

---

## Safety & Ethics Principles

- **Diagnostic Hints Only:** Conformance scores are technical health indicators. They do not represent official government certification or authorization.
- **Human Approval Required:** Maintainers must manually approve high-impact actions. The system will never autonomously edit live configurations, file applications, or deny citizen benefits.
- **Synthetic Data Guarantee:** All tests use synthetic fixtures. No real citizen records, Aadhaar numbers, phone numbers, or passwords are used, logged, or stored.
