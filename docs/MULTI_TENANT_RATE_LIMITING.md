# Multi-Tenant & Jurisdiction-Scoped Rate Limiting (#1336)

## Architecture
`api/_lib/tenantRateLimiter.js` extends `api/_lib/abuseGuard.js` and reuses `privacyIdentifier` from `api/_lib/abuseControlPlane.js` to enforce hierarchical token-bucket rate limits across:
1. **Actor** (`tenantId + jurisdictionCode + route + actorHash`)
2. **Jurisdiction** (`tenantId + jurisdictionCode + route`)
3. **Tenant** (`tenantId + route`)

### Policy Profiles
- `public-read`: 120 burst capacity, 2 req/s refill, `failMode: open`
- `public-write`: 20 burst capacity, 0.35 req/s refill, `failMode: open`
- `authenticated-write`: 45 burst capacity, 0.75 req/s refill, `failMode: open`
- `admin-mutation`: 30 burst capacity, 0.5 req/s refill, `failMode: closed`

## Threat Boundaries
- **Privacy**: Raw IPs/user IDs are never stored; only HMAC-SHA256 hashes (`privacyIdentifier`) are keyed.
- **Header sanitization**: `x-tenant-id` and `x-jurisdiction-code` are validated against `^[a-zA-Z0-9._:-]{1,64}$`.
- **Noisy-neighbor isolation**: Exhausting quota in one tenant or jurisdiction does not affect buckets for isolated tenants/jurisdictions.

## Failure Modes, Metrics & Rollback
- **Standard headers**: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, `Retry-After`, `X-RateLimit-Scope`.
- **Degraded store**: `failMode: open` allows traffic with `degraded: true`; `admin-mutation` (`failMode: closed`) returns `503` with `Retry-After: 5`.
- **Rollout / Rollback**: Start in `mode: 'shadow'` to observe `rate_limit_exceeded` events before switching to `mode: 'enforce'`.
