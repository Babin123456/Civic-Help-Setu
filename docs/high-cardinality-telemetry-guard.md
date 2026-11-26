# High-Cardinality Telemetry Guard and Metrics Sampling Strategy

## Problem Overview
Unbounded metric label values (such as raw user IDs, Aadhaar numbers, request paths with path variables, and unique timestamps) can cause exponential metric series explosion. This leads to out-of-memory crashes on Prometheus/OpenTelemetry collectors, query timeouts, and runaway monitoring bills.

## Architectural Solutions
1. **PII Masking & ID Normalization**:
   - Strictly strips personal identifiers (`user_id`, `aadhaar`, `email`) from dimension keys.
   - Normalizes path variables (`/api/v1/cases/49102` -> `/api/v1/cases/:id`).
2. **Cardinality Budgets & Overflow Catchment**:
   - Caps distinct series per metric to configurable limits (e.g. 100).
   - Routes anomalous permutations to an `_overflow_="true"` bucket while keeping alerting actionable.
3. **Tail-Based Trace Sampling & Exemplars**:
   - Always samples 100% of failed (5xx) or slow requests (>1000ms).
   - Employs 10% probabilistic sampling on healthy requests, linking trace IDs as metric exemplars.
