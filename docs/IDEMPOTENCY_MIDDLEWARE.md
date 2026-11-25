# HTTP Idempotency-Key Middleware & Request Coalescing (#1335)

## Architecture
`api/_lib/idempotencyMiddleware.js` and `api/_lib/idempotencyStore.js` provide a unified HTTP `Idempotency-Key` middleware integrated into `createApiDispatcher` (`api/[...path].js`).

- **Supported methods**: `POST`, `PUT`, `PATCH`, `DELETE`. Read-only methods (`GET`, `HEAD`, `OPTIONS`) pass through untouched.
- **Backward compatibility**: Requests without an `Idempotency-Key` header pass through unless the route is configured in `IDEMPOTENCY_REQUIRED_ROUTES`.
- **Canonical payload hashing**: `canonicalPayloadHash` normalizes JSON key ordering recursively and computes `SHA-256(method + route + canonicalBody)`.
- **In-flight request coalescing**: Concurrent identical requests share a single `createSingleFlight()` promise and receive the captured `{ status, headers, body }` snapshot with `X-Idempotency-Replayed: true`.
- **Conflict detection**: Reusing an `Idempotency-Key` with a different payload hash returns `409 Conflict` (`IDEMPOTENCY_KEY_CONFLICT`).
- **5xx non-caching**: Upstream `5xx` responses or thrown errors release the in-flight lock so safe client retries can succeed.

## Threat Boundaries
- **Key scoping**: Keys are hashed as `SHA-256(actorKey | method | route | idempotencyKey)`, preventing cross-actor or cross-endpoint replay/probing.
- **Input validation**: `Idempotency-Key` must match `^[a-zA-Z0-9._:-]{8,128}$`; malformed keys return `400 Bad Request`.
- **Header spoofing**: `actorKey` prefers verified `req.auth?.userId` and falls back to `clientKey(req.headers)` (Vercel-trusted edge headers only).

## Failure Modes & Degraded Behavior
- **Memory store** (default): Bounded to `5000` keys with TTL eviction (`IDEMPOTENCY_TTL_MS`, default 24h).
- **Firestore store** (`IDEMPOTENCY_STORE=firestore`): Transactional `acquireLock` prevents cross-instance duplicate execution.
- **Store outage**: Defaults to fail-open so citizen submissions are not blocked; critical routes listed in `IDEMPOTENCY_FAIL_CLOSED_ROUTES` return `503 Service Unavailable` with `Retry-After: 5`.

## Metrics, Alerts & Rollback
- **Metrics emitted via `onMetric`**: `idempotency_replay_hit`, `idempotency_coalesced_hit`, `idempotency_payload_conflict`, `idempotency_in_flight_conflict`, `idempotency_store_error`.
- **Alert thresholds**: `idempotency_store_error > 5/min` or `idempotency_payload_conflict > 20/min`.
- **Rollback**: Remove routes from `IDEMPOTENCY_REQUIRED_ROUTES` / `IDEMPOTENCY_FAIL_CLOSED_ROUTES` or set `IDEMPOTENCY_STORE=memory`.
