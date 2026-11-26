# Centralized PII Redaction & Log-Scrubbing Pipeline (#1348)

## Architecture
`api/_lib/piiScrubber.js` provides a deterministic, ReDoS-safe PII and secret scrubbing pipeline integrated into `withApiErrorContract` (`api/_lib/errorContract.js`).

- **String pattern masking**: Linear-time regexes redact Bearer/JWT tokens, Google API keys (`AIza...`), email addresses, PAN numbers, Aadhaar numbers, and Indian mobile numbers.
- **Sensitive key redaction**: Normalized key matching redacts `password`, `token`, `secret`, `authorization`, `cookie`, `aadhaar`, `pan`, `phone`, `email`, `ip`, etc., while respecting explicit `allowKeys` (`correlationId`, `traceId`, `spanId`, `route`, `status`, `code`, `event`).
- **Structural safety**: Uses `WeakSet` for circular references (`[CIRCULAR]`), `maxDepth` bounding (`[MAX_DEPTH]`), and `maxStringLength` truncation.

## Threat Boundaries & Failure Modes
- **ReDoS immunity**: All regexes avoid nested quantifiers and operate on length-bounded strings (`8192` chars default).
- **Safe logger fallback**: `createScrubbingLogger` catches any unexpected serialization error and emits `{ event: 'scrubbed_log_fallback' }` without leaking raw data.

## Metrics & Runbook
- Pass `onRedaction` callback to count `pattern` vs `key` redactions in telemetry.
- To extend sensitive fields without code changes, pass custom `sensitiveKeys` / `customPatterns` to `createScrubbingLogger`.
