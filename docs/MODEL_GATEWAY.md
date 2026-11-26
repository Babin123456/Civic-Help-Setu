# Civic Model Gateway: Operations, Residency & Maintenance Guide

## Overview

The Civic Model Gateway (`src/services/gateway/`) provides provider-neutral AI routing, data residency enforcement, and deterministic non-LLM fallbacks for Civic Help Setu. It ensures citizen privacy, cost predictability, and zero-downtime resilience while interacting with AI models.

---

## 1. Core Principles & Non-Negotiables

1. **Local-First Residency by Default**: Unless configured otherwise, all queries are routed to local in-browser search (`LocalBrowserAdapter` / `DeterministicFallbackAdapter`).
2. **Pre-Inference Scrubbing**: Any outbound call through external or sovereign cloud adapters is pre-scrubbed using `aiGuardrailPipeline.js`. Sensitive personal data (Aadhaar, PAN, phone numbers, email, voter ID, bank accounts, IFSC, UPI) is replaced with standardized placeholders (`[REDACTED_*]`).
3. **Deterministic Non-LLM Fallback**: If an external provider times out, fails, or violates policy, requests fall back to verified catalog knowledge (`src/ai/civicAssistantFallback.js`) with zero user disruption.
4. **No Autonomous Statutory Actions**: AI models operate strictly as untrusted proposal generators. Every output includes verified source citations and a legal disclaimer. No autonomous application filing or benefit determinations are permitted.

---

## 2. API & Event Contract (Version 1.0.0)

All gateway interactions adhere to typed, versioned boundary contracts (`GATEWAY_CONTRACT_VERSION = '1.0.0'`).

### Request Envelope
```typescript
interface GatewayRequest {
  query: string;                           // Citizen inquiry (mandatory)
  contractVersion?: string;                 // e.g. "1.0.0"
  residencyTier?: 'local_only' | 'sovereign_domestic' | 'cross_border_scrubbed';
  taskRisk?: 'low' | 'medium' | 'high';     // Defaults to 'low'
  language?: string;                       // ISO code (e.g. 'en', 'hi', 'ta', 'bn')
  categoryId?: string;                     // e.g. 'income-certificate', 'vault'
  timeoutMs?: number;                      // Max latency budget (default: 4500ms)
  latencySLA?: number;                     // Fast interactive threshold (e.g. 200ms)
}
```

### Standardized Response Envelope
```typescript
interface GatewayResponse {
  status: 'success' | 'blocked' | 'unsupported' | 'unverified' | 'error';
  data: {
    title: string;
    summary: string;
    steps?: string[];
    documents?: string[];
    fees?: string;
    processingTime?: string;
    officialSources?: Array<{ name: string; url: string; verified: boolean }>;
  };
  meta: {
    contractVersion: string;               // "1.0.0"
    adapterType: string;                   // e.g. "local_browser", "sovereign_cloud"
    modelName: string;                     // Display name of active model/engine
    residencyTier: string;                 // Effective residency tier applied
    routingReason: string;                 // Policy or router justification
    fallbackTriggered: boolean;            // True if diverted to fallback
    fallbackReason?: string;               // Error or breaker code
    latencyMs: number;                     // Execution duration in milliseconds
    tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number };
    estimatedCostINR: number;              // Calculated marginal cost in INR
    timestamp: string;                     // ISO-8601 string
  };
  officialSources: Array<{ name: string; url: string; verified: boolean }>;
  suggestions: string[];
  disclaimer: string;
  guardrail: {
    decision: 'allow' | 'redact_and_allow' | 'block';
    pii: { wasRedacted: boolean; redactedCategories: string[]; redactionCount: number };
    injection: { blocked: boolean; riskLevel: string; reason?: string };
  };
  entailment?: {
    overallSupported: boolean;
    verifiedCount: number;
    unsupportedCount: number;
  };
}
```

---

## 3. Residency Policy Tiers (DPDPA 2023 Aligned)

| Tier Name | Key | Behavior | Network Egress | Target Use Case |
|---|---|---|---|---|
| **Local Only (Default)** | `LOCAL_ONLY` | In-browser keyword, BM25, and rule-based evaluation. | **Zero** | Sensitive citizen personal queries, caste/income claims, offline operation. |
| **Sovereign Domestic** | `SOVEREIGN_DOMESTIC` | Domestic Indian cloud/edge endpoints under DPDPA 2023 jurisdiction. | Permitted to domestic sovereign endpoints only. | Multi-lingual Indic procedural guidance requiring natural language synthesis. |
| **Cross-Border Scrubbed** | `CROSS_BORDER_SCRUBBED` | Commercial frontier providers with strict pre-inference PII masking. | Permitted to approved global endpoints with anonymized data. | General civic knowledge discovery, complex summarization. |

---

## 4. Circuit Breaker & Resilience Configuration

* **Failure Threshold**: 3 consecutive network/timeout errors trip the circuit breaker to `OPEN`.
* **Timeout Budget**: Default 4500ms per external call.
* **Cooldown Period**: 30,000ms in `OPEN` state before transitioning to `HALF_OPEN` for canary testing.
* **Deterministic Fallback**: In `OPEN` or `HALF_OPEN` error states, the system immediately delegates to the deterministic catalog/FAQ fallback without adding delay.

---

## 5. Performance, Token Ceilings & Cost Limits

* **Interactive Latency SLA**: $< 200\text{ms}$ for local queries; $< 4500\text{ms}$ hard timeout for remote calls.
* **Token Ceilings**:
  * Max Prompt Input: 1,000 estimated tokens (approx 4,000 characters). Queries beyond this are truncated safely.
  * Max Output Generation: 800 estimated tokens.
* **Billing Models**:
  * `local-browser`: ₹0.00 marginal cost.
  * `sovereign-domestic`: ~₹0.05 per 1,000 tokens.
  * `external-frontier`: ~₹0.25 per 1,000 tokens.

---

## 6. Accessibility & UX Compliance

* **WCAG 2.1 AA Compliance**:
  * Status badges (`ModelGatewayBadge.jsx`) use semantic `role="status"` with clear, descriptive `aria-label` tags.
  * Collapsible metadata accordions support standard keyboard controls (`Space` / `Enter` to toggle, `aria-expanded="true/false"`).
  * Color contrast ratios exceed 4.5:1 for both light and dark mode palettes.
  * Dashboard inputs have linked `<label>` and semantic grouping.

---

## 7. Data Retention & Privacy

* **Zero Prompt Retention**: The telemetry engine (`gatewayTelemetry.js`) logs **only numerical counters, latency metrics, and residency metadata**. It **never** persists or outputs raw citizen prompt text, user names, or sensitive identifiers.
* **In-Memory Ring Buffer**: Retains a maximum of 100 recent entries in memory. Entries are cleared on browser refresh or via the Admin Dashboard "Clear Telemetry" action.

---

## 8. Deployment Configuration & Rollback

### Supported Hosting Setup
* **Platform**: Client-side Single Page Application (SPA) on Vercel or static CDN.
* **Zero Backend Dependency**: The Model Gateway is self-contained and operates entirely client-side without requiring a separate proxy server.
* **Environment Variables**:
  * `VITE_OPENAI_API_KEY`: Optional external commercial key (loaded only when `CROSS_BORDER_SCRUBBED` tier is explicitly active).
  * `VITE_SOVEREIGN_GATEWAY_URL`: Optional sovereign national endpoint URL.
* **CSP Headers**: Configured in `vercel.json` and `scripts/generateVercelHeaders.js` allowing only approved domestic endpoints when enabled.

### Migration & Rollback Procedure
* **Safe Instant Rollback**:
  If an external model provider causes issues, maintainers or users can immediately toggle the residency policy back to `LOCAL_ONLY` via `setActiveResidencyPolicy('local_only')` or the Admin Dashboard.
* **Automatic Rollback**:
  If network failures occur, the `circuitBreaker.js` automatically bypasses remote calls and trips to `DeterministicFallbackAdapter`, ensuring continuous service availability.

---

## 9. Licenses & Attributions

* **Application Code**: MIT License.
* **Bundled Civic Catalog & Office Datasets**: Open Government Data (OGD) Platform India / Public Civic Information.
* **Pre-trained Model Weights (when local WASM is used)**: Apache-2.0 / MIT compatible open models.

---

## 10. Reproducible Evaluation Benchmark

Run the automated evaluation benchmark to measure routing accuracy, PII scrubbing efficacy, circuit breaker resilience, and telemetry privacy:

```bash
npx vitest run src/services/gateway/gatewayEvaluationReport.test.js
```
