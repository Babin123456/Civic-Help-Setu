# End-to-End Distributed Tracing Across Browser, API, Jobs and Integrations

## Purpose
Establishes standardized W3C `traceparent` context propagation across browser fetch calls, Next.js / Node API routes, async BullMQ workers, and external government portals.

## Key Features
- **Cost-Controlled Sampling**: Probabilistic hash-based trace sampling with guaranteed 100% sampling on high-severity incident routes.
- **Automated PII Scrubbing**: Identifies and redacts sensitive citizen attributes (Aadhaar, PAN, tokens, OTPs) before telemetry export.
- **Distributed Bottleneck Pinpointing**: Captures start times and latencies across asynchronous execution boundaries.
