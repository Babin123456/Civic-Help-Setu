# Priority-Aware Load Shedding & Graceful Degradation (#1349)

## Architecture
`api/_lib/loadShedder.js` integrates into `api/_lib/mesh/middleware.js` (`executeRoute`) to protect critical citizen workflows during traffic spikes or downstream latency degradation.

### Server-Side Priority Tiers
- **`critical`**: Citizen grievance, emergency, and mutation routes (`POST`/`PUT`/`PATCH`/`DELETE` excluding sheddable prefixes).
- **`standard`**: Normal read-only service discovery and directory routes.
- **`sheddable`**: Analytics, benchmarks, chaos engineering, and synthetic dataset endpoints.

### Pressure & Hysteresis
- **Elevated pressure** (`inflight >= 60%` or `ewmaLatency >= 1500ms`): sheds `sheddable` traffic with `503` + `Retry-After: 10` + `X-Load-Shed-Tier`.
- **Critical pressure** (`inflight >= 85%` or `ewmaLatency >= 3000ms`): sheds `sheddable` and `standard` traffic while preserving `critical` citizen writes up to `maxInflight`.
- **Hysteresis**: Recovers to `normal` only when pressure drops below `50%` of the warning threshold, preventing oscillation.

## Threat Boundaries & Rollback
- **No client spoofing**: Priority is derived strictly from server-side route + method classification; client headers are ignored.
- **Rollout / Rollback**: `LOAD_SHEDDING_MODE` defaults to `shadow` (logs `load_shed` metrics without rejecting); set `LOAD_SHEDDING_MODE=enforce` to activate or `disabled` to bypass.
