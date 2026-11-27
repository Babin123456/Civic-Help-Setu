# Distributed Lease & Leader Election Coordinator (#1461)

## Architecture
`api/_lib/leaseCoordinator.js` provides atomic distributed leases with monotonically increasing fencing tokens for scheduled civic background jobs.

- **Stores**: `createInMemoryLeaseStore` (deterministic tests/local dev) and `createFirestoreLeaseStore` (transactional cross-instance persistence).
- **Fencing Tokens**: Each new acquisition increments `fencingToken` monotonically so stale workers whose lease expired cannot commit writes.
- **Clock-Skew Guard**: `withLease` exposes `effectiveDeadline = expiresAt - clockSkewBufferMs` (default 1000ms) and a `renew()` heartbeat helper.

## Threat Boundaries & Failure Modes
- **Split-brain prevention**: `renew` and `release` verify both `holderId` and `fencingToken`; mismatched callers receive `{ reason: 'fenced_out' }`.
- **Store outage**: `withLease` fails safe (`{ executed: false, reason: 'store_unavailable' }`) rather than running uncoordinated duplicate jobs.
