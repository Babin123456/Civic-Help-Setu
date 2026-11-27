# Deterministic Request Replay & Shadow-Traffic Mirroring (#1463)

## Architecture
`api/_lib/shadowMirror.js` mirrors sampled requests asynchronously to a canary handler while returning the primary response immediately.

- **Zero primary-path impact**: Shadow execution is fire-and-forget with bounded concurrency (`maxShadowInflight`) and strict `timeoutMs` isolation.
- **Read-only/idempotent safety**: Only `GET` and `HEAD` requests are mirrored by default (`allowedMethods`).
- **PII-safe diffing**: Primary and shadow payloads are scrubbed via `scrubPii` (`api/_lib/piiScrubber.js`) before comparison or report emission.
- **Deterministic sampling**: Uses FNV-1a hashing on correlation ID / route seed for reproducible sampling.
