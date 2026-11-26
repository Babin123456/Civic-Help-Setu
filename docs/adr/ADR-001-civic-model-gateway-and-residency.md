# ADR-001: Civic Model Gateway with Dynamic Routing, Fallback and Data Residency Policies

* **Status**: Accepted
* **Date**: 2026-11-26
* **Deciders**: Civic Help Setu Core Maintainers & Architecture Review
* **Context**: Issue #1153 (`[level3][feature] Build a Model Gateway with Routing, Fallback and Civic Data Residency Policies`)

---

## 1. Context and Problem Statement

Civic Help Setu assists citizens navigating municipal, state, and central government procedures. Different tasks demand different model capabilities, cost profiles, latency tolerances, and data-handling guarantees:
* Checking basic application documents or office hours is a low-risk, high-frequency task requiring ultra-low latency and zero network cost.
* Interpreting nuanced deficiency notices or multi-stage eligibility rules requires higher model capability.
* Citizen inputs frequently contain sensitive identifiers (Aadhaar, PAN, voter IDs, phone numbers, ration card details, caste/income claims).

Prior to this architecture, assistant responses were exclusively generated in-browser via keyword matching and BM25 catalog searches (`src/ai/civicAssistant.js`). Direct integration with external commercial LLMs without an architectural boundary introduces critical risks:
1. **Civic Data Residency & Sovereignty Breaches**: Transmitting unscrubbed citizen queries to arbitrary offshore cloud endpoints violates civic trust and statutory compliance (e.g., India's Digital Personal Data Protection Act 2023 - DPDPA).
2. **Provider Outages & Lock-In**: Complete dependence on a single commercial API fails when quotas expire or APIs experience downtime.
3. **Uncontrolled Cost & Token Waste**: Repetitive queries generate redundant API billing.
4. **Hallucination of Legal/Statutory Claims**: Unbounded LLMs may fabricate deadlines, fees, or government decisions without citations.

---

## 2. Decision Drivers

* **Data Residency Enforcement**: Zero unredacted citizen PII may ever leave the user's chosen residency tier. By default, operations must remain strictly in-browser (`LOCAL_BROWSER_ONLY`) unless explicitly permitted by policy.
* **Resilience via Deterministic Fallbacks**: If any remote provider is slow, unreachable, or returns errors, the system must transparently fall back to deterministic non-LLM search without disrupting the citizen's experience.
* **Provider Neutrality**: Support pluggable model adapters (local WASM/mock, sovereign domestic endpoints, external providers) behind uniform request/response contracts.
* **Cost and Latency Control**: Configurable timeouts, circuit breakers, and cost estimation telemetry per request.
* **AI Output as Untrusted Proposal**: All model responses require strict citations to official sources and post-synthesis entailment verification; no autonomous filing or authoritative decisions.

---

## 3. Considered Options

1. **Option A: Direct Provider SDK Coupling in Components**
   * *Pros*: Fast initial prototype.
   * *Cons*: Tight coupling; scatter-shot prompt logic; impossible to enforce uniform privacy scrubbing or centralized fallback; severe vendor lock-in.
   * *Verdict*: Rejected.

2. **Option B: Centralized Backend Gateway Server**
   * *Pros*: Keeps API keys on a centralized server; offloads processing.
   * *Cons*: Civic-Help-Setu is designed as a privacy-preserving, zero-backend, client-side SPA. Introducing a centralized server creates a high-value honey pot for citizen data, recurring server infrastructure costs, and violates the client-side architectural model.
   * *Verdict*: Rejected for core client architecture; reserved as an optional proxy adapter if maintainers self-host an enterprise gateway.

3. **Option C: Modular Client-Side Model Gateway with Provider-Neutral Adapters, Residency Engine, and Circuit Breaker (Selected)**
   * *Pros*: Preserves the privacy-first client-side model; encapsulates provider logic into swappable adapters; strictly routes by residency and risk tier; enforces pre-inference PII scrubbing; seamlessly falls back to local grounded catalog retrieval.
   * *Cons*: Requires careful circuit breaker and adapter lifecycle management in JavaScript.
   * *Verdict*: Accepted.

---

## 4. Architecture and Data Flow

```
+-------------------------------------------------------------------------------+
|                             Client Application                                |
|                        (src/pages/Assistant.jsx)                              |
+---------------------------------------+---------------------------------------+
                                        | (raw citizen query)
                                        v
+-------------------------------------------------------------------------------+
|                       Pre-Inference Guardrail Pipeline                        |
|                     (src/ai/aiGuardrailPipeline.js)                           |
| - Strips PII (Aadhaar, PAN, phone, IFSC, accounts)                            |
| - Blocks prompt injections & instruction overrides                            |
+---------------------------------------+---------------------------------------+
                                        | (sanitized payload, metadata)
                                        v
+===============================================================================+
|                             Civic Model Gateway                               |
|                  (src/services/gateway/modelGatewayService.js)                |
|                                                                               |
|  1. Residency Policy Engine (residencyPolicyEngine.js)                        |
|     - Evaluates task risk, category, and citizen residency preference         |
|     - Rejects unauthorized cross-border transmissions                         |
|                                                                               |
|  2. Multi-Criteria Router (modelRouter.js)                                    |
|     - Selects candidate adapter by Language, Risk, Latency SLA, Cost          |
|                                                                               |
|  3. Circuit Breaker & Fallback Manager (circuitBreaker.js)                    |
|     - Monitors error rate, 429 rate limits, and request timeouts              |
|     - Trips to OPEN state on failures; executes deterministic fallback        |
|                                                                               |
|  4. Telemetry & Accounting (gatewayTelemetry.js)                              |
|     - Records tokens, latency, cost estimate, residency tier without PII      |
+=======================================+=======================================+
                                        |
       +--------------------------------+-------------------------------+
       |                                |                               |
       v                                v                               v
+---------------+              +-----------------+             +-----------------+
| Local Browser |              | Sovereign Cloud |             | External Cloud  |
| Adapter       |              | Adapter         |             | Provider Adapter|
| (Zero network)|              | (India Endpoint)|             | (Scrubbed PII)  |
+-------+-------+              +--------+--------+             +--------+--------+
        |                               |                               |
        +-------------------------------+-------------------------------+
                                        | (or upon failure / trip)
                                        v
+-------------------------------------------------------------------------------+
|                    Deterministic Non-LLM Fallback Engine                      |
|                     (src/ai/civicAssistantFallback.js)                        |
| - Grounded catalog lookup                                                     |
| - Official office directory & statutory dispute contact points                |
+---------------------------------------+---------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
|                      Post-Synthesis Entailment Engine                         |
|             (src/services/evidenceEntailmentVerificationService.js)           |
| - Verifies citations against official retrieved documents                     |
| - Surfaces mandatory legal disclaimer and provenance badges                   |
+-------------------------------------------------------------------------------+
```

---

## 5. Residency Policy Tiers

| Policy Tier | Scope & Boundary | Permitted Destinations | Use Cases |
|---|---|---|---|
| `TIER_LOCAL_ONLY` *(Default)* | Zero network transit. Computations occur exclusively in-browser. | In-browser memory, local rules, indexed catalog. | Sensitive citizen data, caste/income claims, offline usage, private documents. |
| `TIER_SOVEREIGN_DOMESTIC` | Domestic data processing within India's jurisdiction. | Verified domestic cloud/edge instances compliant with DPDPA 2023. | Medium-risk procedural queries requiring complex natural language processing. |
| `TIER_CROSS_BORDER_SCRUBBED` | Permitted for external general-purpose models. | Scrubbed prompts sent to global model APIs. | General non-sensitive civic information, translations, summarization. |

---

## 6. Failure Modes and Resilience

1. **Provider Outage (5xx / Connection Reset)**:
   * Circuit breaker records failure. Once threshold (e.g. 3 consecutive failures) is reached, breaker transitions to `OPEN`.
   * Requests immediately divert to `DeterministicFallbackAdapter` without latency penalty.
2. **Timeout Violation**:
   * Each request is bounded by an `AbortController` timeout (default: 4500ms).
   * Exceeding the timeout immediately triggers the deterministic fallback with a UI notification.
3. **Residency Policy Mismatch**:
   * If a high-risk request attempts to use a cross-border adapter without scrub certification, the policy engine blocks the request with `RESIDENCY_POLICY_VIOLATION` and routes to `LocalBrowserAdapter`.
4. **Adversarial / Malformed Output**:
   * If an LLM returns unparseable or malicious content, post-synthesis validation rejects it and renders the verified catalog guide.

---

## 7. Consequences and Compliance

* **Positive**: Full compliance with citizen data residency standards; zero single-point-of-failure; transparent cost and latency metrics; zero vendor lock-in.
* **Negative**: Multiple adapters and circuit breaker state must be maintained.
* **Security & Privacy Guarantee**: Synthetic test fixtures ensure no real citizen data or credentials enter the codebase, telemetry, or test traces.
