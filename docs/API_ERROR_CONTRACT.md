# Public API error and recovery contract

The existing API entry points use `withApiErrorContract` from
`api/_lib/errorContract.js`. The public catalogue and client adapters live in
`src/utils/civicErrorContract.js`. This is one response boundary around existing
handlers, not a new router, authentication system or data store.

## Version 1

A rejected request returns its HTTP status, `errorVersion: 1`, `ok: false`,
`success: false`, a stable `code`, fixed public `message`, `retryable`,
`recoveryAction` and a generated `correlationId`. The legacy `error` field stays a
string when the handler used strings; existing object-shaped errors retain a
safe `{code, message}` object. Arbitrary diagnostics, exception text, stack
traces, request values and validation `details` are not copied. Public messages
come only from the catalogue, never from a provider's response text.

| HTTP | Code | Recovery |
| --- | --- | --- |
| 400 / unknown 4xx | INVALID_REQUEST | edit_request |
| 401 | UNAUTHENTICATED | sign_in |
| 403 | FORBIDDEN | request_access |
| 404 | NOT_FOUND | refresh |
| 405 | METHOD_NOT_ALLOWED | change_action |
| 409 / 412 | CONFLICT | refresh |
| 413 | PAYLOAD_TOO_LARGE | reduce_payload |
| 422 | VALIDATION_FAILED | edit_request |
| 422, known synthetic PII rejection | SENSITIVE_DATA_REJECTED | remove_private_data |
| 429 | RATE_LIMITED | wait |
| 502 / 503 / 504 | DEPENDENCY_UNAVAILABLE | retry_later |
| 500 / unknown server failure | INTERNAL_ERROR | contact_support |
| Client transport failure | NETWORK_ERROR | check_connection |
| Unreadable successful response | INVALID_RESPONSE | refresh |

Only rate limiting, unavailable dependencies and network failures are marked
retryable. This describes a transient condition; it does not authorize automatic
replay. In particular, do not automatically replay email, payment or other
non-idempotent POST requests. Use a verified server idempotency mechanism or ask
the user to retry manually after checking whether the first operation completed.
Permission, authentication, conflict and validation failures require their named
recovery action rather than repeated requests.

`Retry-After` and `retryAfterSeconds`, when present, are whole seconds from 0 to
3600. Out-of-range/unknown delays are omitted; non-retryable failures remove the
header. HTTP-date delays are not currently converted. Clients use the explicit
code/status and bounded delay, not substring tests on error messages.

## Correlation, privacy and authorization

Each invocation creates a fresh UUID v4 and returns it in `X-Correlation-ID` and
its error body. Untrusted incoming IDs and handler attempts to replace the
header are ignored. Concurrent invocations share no response state. A client
accepts only a correctly formatted UUID and never invents a server ID for an
offline request. An ID is diagnostic metadata, not authentication or permission.

Unexpected exceptions are recorded by the boundary with fixed keys only:
`event`, `code`, `status`, `correlationId`. It does not log the exception,
request URL/query, headers or body. A failed logger cannot prevent a safe error
response. Error responses are `Cache-Control: no-store`; successful payloads,
authorization checks, cookies and domain behavior remain in the original handler.
No client-supplied role or raw error code can grant permission.

The boundary handles existing Node JSON responses, legacy returned
`{status, headers, body}` values and failed standard `Response` objects. It does
not rewrite bytes already sent, nor does it catch module-initialization failures
before the handler loads. Streaming/non-JSON output must have its own reviewed
error boundary before using this contract. Current covered rejection paths use
JSON. Do not put private diagnostics in a successful response.

## Integration and migration

The catch-all dispatcher and standalone application-events, counter-journey,
firebase-token, import-batches, neighbourhood-resource-exchange, road-hazards and
synthetic-datasets entries use the wrapper. The abuse-control-plane factory
wraps its configured handler and retains its required injected session verifier
and operator authorization. Its existing default export remains a factory;
this change does not invent production authentication configuration for it.
Deployment wiring must supply that configuration before treating it as a live
Vercel handler.

Existing abuse-control-plane, email and visual-QA clients use the shared safe
adapter. It accepts known versioned codes only at appropriate HTTP statuses,
falls back to HTTP status for unknown/legacy/malformed payloads, and does not
copy arbitrary response metadata. Visual-QA and abuse errors retain their
existing Error subclasses with typed recovery information. Existing provider
sign-in sanitizers keep their provider-specific responsibilities.

Roll out server and client adapters together. Consumers should branch on
`errorVersion` and `code`, display `message`, and retain `correlationId` for
support. Domain codes formerly stored in `error`/`details` are not a supported
v1 recovery interface. Update those consumers rather than parsing fixed text.
The known synthetic PII rejection maps to `SENSITIVE_DATA_REJECTED`. Legitimate
field correction remains possible through the existing local validators; a
future public field-detail catalogue must explicitly allowlist its keys and
fixed messages before returning them.

Rollback server/client adapters together to their prior release if needed,
retaining existing authorization checks. Do not temporarily expose exception
strings or disable privacy handling to diagnose a rollback. Do not use an
error contract as evidence of a successful operation.

## Tests, operations and limits

`api/_lib/errorContract.test.js` covers the HTTP classes, successful responses,
legacy response handling, throwing handlers/loggers, already-started responses,
forged IDs/codes, bounded retry values, concurrent isolation and real local HTTP
round trips. Client tests cover malformed data, offline failures, safe fallback
and integration with actual abuse and visual-QA helpers. Existing API tests
assert the versioned public response instead of raw private diagnostics.

The implementation holds only per-request metadata and performs no network
calls, retries, persistence or background work. Payload size, request rate,
timeouts, session verification and storage limits stay with the existing
handlers. The JSON boundary replaces error payloads with a small fixed envelope;
success payload capacity is unchanged. Synthetic concurrency/transport checks
are regression coverage, not a production throughput claim.

Count failures by fixed code/status and measure latency at the existing host.
Suggested initial operator triggers: investigate a 5xx ratio over 1% in five
minutes, a sudden rise in authorization failures, or repeated dependency errors
for two minutes. These are runbook thresholds, not an installed metrics/alerting
service. Correlate by the returned UUID; never include citizen data in an alert.
Check provider health, configuration and permissions before retrying. Keep
manual degraded workflows available while a dependency is down.

Repository-wide baseline tests/lint and full application startup must be healthy
before claiming production acceptance. A passing wrapper fixture, build or
client test does not establish production Clerk authorization or full-app
validation.
