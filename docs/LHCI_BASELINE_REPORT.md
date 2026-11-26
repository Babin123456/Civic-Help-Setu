# Lighthouse CI Baseline Report

**Date**: 2026-11-17  
**Project**: Civic Help Setu  
**Measured Routes**: `/` (Home), `/services` (Services), `/assistant` (Assistant), `/open-source` (Open Source)  
**Tool**: Lighthouse CI (`@lhci/cli` v0.16.1, Lighthouse v13.6.0)  
**Environment**: Node.js 22, headless Chrome (`--no-sandbox --headless --disable-gpu`), local Vite preview server (`http://localhost:4173`)  

---

## 1. Measured Baseline Metrics

The following metrics represent actual measurements collected from the production preview build (`npm run build && npm run preview`):

| Route | Performance | Accessibility | Best Practices | SEO | FCP | LCP | TBT | CLS | Script Size | Total Transfer |
|---|---|---|---|---|---|---|---|---|---|---|
| **`/` (Home)** | 0.73 | 1.00 | 0.77 | 0.82 | 1,786 ms | 10,759 ms | 106 ms | 0.016 | 1.72 MB | 1.84 MB |
| **`/services`** | 0.74 | 0.95 | 0.77 | 0.82 | 1,783 ms | 11,607 ms | 61 ms | 0.000 | 1.79 MB | 1.98 MB |
| **`/assistant`** | 0.74 | 0.96 | 0.77 | 0.82 | 1,752 ms | 10,747 ms | 59 ms | 0.011 | 1.72 MB | 1.84 MB |
| **`/open-source`** | 0.99 | 1.00 | 0.77 | 0.83 | 1,768 ms | 1,768 ms | 53 ms | 0.034 | 1.72 MB | 1.93 MB |

---

## 2. Proposed & Configured Budgets

Budgets are designed to prevent regressions on low-powered devices and assistive technologies while providing realistic headroom to prevent flakiness in CI runners:

| Metric | Target Gate | Severity | Rationale |
|---|---|---|---|
| **Accessibility Score** | `>= 0.90` | **Error** | Current routes score 0.95–1.00. Any regression below 0.90 blocks the PR. |
| **Critical Accessibility Audits** | 100% compliant | **Error** | Critical rules (`button-name`, `document-title`, `html-has-lang`, `image-alt`, aria attributes) fail the gate. |
| **Overall Performance Score** | `>= 0.65` | **Warning** | Baseline is 0.73–0.74 on complex pages and 0.99 on lightweight pages. Allows CI runner jitter while flagging major regressions. |
| **First Contentful Paint (FCP)** | `<= 3,000 ms` | **Warning** | Baseline is ~1.75–1.79s. Leaves sufficient headroom for varying CI CPU load. |
| **Cumulative Layout Shift (CLS)** | `<= 0.10` | **Error** | Baseline is 0.000–0.034. Guarantees visual stability during page render. |
| **Script Bundle Transfer Size** | `<= 2.50 MB` | **Warning** | Baseline is ~1.72–1.79MB. Flags unoptimized chunks and code-bloat regressions. |
| **Total Page Transfer Size** | `<= 3.00 MB` | **Warning** | Baseline is ~1.84–1.98MB. Ensures usability over constrained civic networks. |
| **Best Practices Score** | `>= 0.70` | **Warning** | Baseline is 0.77. |
| **SEO Score** | `>= 0.80` | **Warning** | Baseline is 0.82–0.83. |

---

## 3. Reporting Accessibility Separately from Performance

Accessibility findings are surfaced as an independent section from performance web vitals:
- In CI, the workflow extracts accessibility findings per route and generates a dedicated **Accessibility Audit Report** table and violation breakdown.
- Performance web vitals (FCP, LCP, TBT, CLS) and bundle sizes are reported separately in a dedicated **Performance & Bundle Size Budgets** table.
- Output is written directly to `$GITHUB_STEP_SUMMARY` and preserved in CI artifacts (`.lighthouseci/`).

---

## 4. Privacy & Data Protection

- Audits strictly target **public routes only**: `/`, `/services`, `/assistant`, `/open-source`.
- Authenticated pages (`/login`, `/signup`, `/profile`, `/admin`, `/vault`, `/saved`, `/tenants`) and temporary token routes (`/shared-checklist/:token`, `/app-status/:token`) are excluded from automated audits.
- The reporting script includes runtime route-guard checks to abort if private/authenticated routes are audited.
- Reports contain **no citizen data**, session cookies, or personal identifiers.

---

## 5. Documented Budget Exception Process & Log

This section defines the process for temporarily relaxing Lighthouse performance or accessibility thresholds and tracks all active exceptions. Every exception **requires an Owner and an Expiry Date** (maximum 30 days). Without both, pull requests modifying thresholds will be rejected.

### 5.1 Exception Criteria
Budgets exist to preserve accessibility and low-end device performance. An exception is only granted for:
- Planned architectural migrations with an established remediation roadmap.
- Temporary integration of essential third-party scripts/widgets where optimization is scheduled.
- Temporary upstream library regressions being tracked with an issue.

Exceptions are **never** granted for:
- Bypassing critical accessibility violations (e.g. broken labels, missing alt text, invalid ARIA).
- Avoiding performance optimization on new feature additions.

### 5.2 Mandatory Exception Requirements
Every exception submitted in a PR must include:
1. **Owner**: A named engineer (GitHub handle) who assumes responsibility for resolving the degradation.
2. **Expiry Date**: A hard date no more than **30 days** from the PR merge date.
3. **Target Metric & Route**: The specific budget being relaxed (e.g., FCP on `/services` relaxed from 3000ms to 3500ms).
4. **Remediation Plan**: Link to tracking issue with milestones to bring the metric back into compliance before expiration.

### 5.3 Active Exceptions Log

| Date Added | Route / Metric | Temporary Threshold | Owner (GitHub) | Expiry Date | Tracking Issue / Reason | Status |
|---|---|---|---|---|---|---|
| *(none)* | — | — | — | — | — | Active |

### 5.4 How to Request an Exception
1. Add a new row to the **Active Exceptions Log** table above.
2. Update `.lighthouserc.json` with the approved temporary threshold.
3. Submit a pull request referencing this document in the PR description.
4. When the expiry date arrives, the owner must either restore the original budget threshold or submit a formal baseline update.
