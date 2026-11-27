# ADR-002: Regional Traffic Steering Layer with Health-Based Failover

## Status
**Accepted** — Implementation complete in `src/services/multiRegionRead/`

## Context
The existing Multi-Region Read Layer provides basic health-based failover and routing, but lacks several capabilities required for production-grade regional traffic management:

- **Latency-aware routing**: Currently routes only by health and weight; no explicit latency consideration
- **Capacity-aware routing**: No visibility into replica capacity; potential for overload
- **Fail-closed residency enforcement**: Residency rules are checked but not "fail-closed" (bypass possible)
- **Sticky session management**: No explicit sticky session support for stateful operations
- **Controlled failback**: Recovery is ramp-based but lacks explicit controlled re-enable procedures
- **Observability**: Routing decisions are observable but not with full regional steering metadata

## Decision
Implement a Regional Traffic Steering Layer that enhances the existing multi-region read infrastructure with:

### 1. Multi-Criteria Routing
- **Health**: Existing REPLICA_HEALTH states (HEALTHY/DEGRADED/UNHEALTHY/DRAINING/RECOVERING)
- **Latency**: Observed request latency (`latencyMs`), prefer lower latency replicas
- **Capacity**: Current capacity percentage (`capacityPercent`), prefer higher capacity
- **Residency**: Fail-closed residency constraints using `requiresIndiaResidency()` checks
- **Sticky Sessions**: Optional sticky sessions for stateful collections

### 2. Enhanced Region Configurations
- Added `capacityPercent` field to `createRegionConfig` (default 100%)
- Region residency classification (`RESIDENCY_CLASS.INDIA` vs `GLOBAL`)
- Weight overrides for gradual rollout, draining, and recovery

### 3. Fail-Closed Residency Rules
- Sensitive citizen data (`requiresIndiaResidency()`) can ONLY be read from INDIA-resident regions
- Non-India regions are explicitly excluded (not just deprioritized)
- Violation attempt results in primary-only routing
- Enforced at both registry level (`canReadFromRegion`) and router level

### 4. Controlled Failback
- **Observation window**: Minimum time a replica must be healthy before failback (`RECOVERY_OBSERVATION_MS`: 60s default)
- **Ramp-up**: Gradual weight increase from 10% → 100% over recovery ramp steps
- **Manual override**: `controlledFailback()` API for operator-initiated recovery
- **Safety guard**: Failback rejected if replica not in RECOVERING or HEALTHY state

### 5. Sticky Session Support
- Sticky sessions enabled for: `users`, `applications`, `drafts`, `settings`, `checklists`, `assessments`, `saved`, and authenticated users
- Marker added to routing decisions (`x-sticky-session` header)
- Sessions pinned to first healthy replica; re-routing on failover

### 6. Regional Steering Metadata
New response headers for observability:
- `x-latency-ms`: Observed latency at the served replica
- `x-capacity-percent`: Available capacity percentage at the served replica
- `x-residency-compliant`: Whether routing respected residency constraints
- `x-residency-enforced`: Whether fail-closed residency rules were applied
- `x-sticky-session`: Whether a sticky session was established

## Threat Boundaries
| Boundary | Description |
|----------|-------------|
| **Residency Bypass** | Fail-closed: India-resident data cannot be routed to non-India regions. Exception: admin override with audit log. |
| **Latency Manipulation** | Clients cannot report arbitrary latency; health monitor validates via heartbeat lagMs. |
| **Capacity Exhaustion** | Replicas with `capacityPercent <= 20%` are deprioritized; extreme overload triggers health degradation. |
| **Stale Data** | RYW token validation ensures read-your-writes consistency; token forced-primary if replica lagging. |
| **Failover Storm** | Controlled ramp prevents multiple replicas failing back simultaneously. |
| **Sticky Session Pinning** | Sticky sessions may route to suboptimal replica; rebalance on expiry or explicit invalidation. |

## Operational Failure Modes
| Failure Mode | Symptoms | Automatic Recovery | Manual Action |
|--------------|----------|-------------------|---------------|
| **Replica lag exceeds threshold** | Increased `stale_read_rate`, `ryw_routed_to_primary` | Auto-mark DEGRADED → UNHEALTHY, failover to primary | `manualFailover` if persistent |
| **Replica capacity exhaustion** | Increased error rates, timeouts | Deprioritize (weight reduced), route to healthier replica | Investigate resource limits |
| **Residency rule violation** | Data served from wrong region | Immediate routing to primary for sensitive collections | Security review required |
| **Stale sticky session** | Session pinned to degraded replica | Session expiry or TTL-driven re-evaluation | `manualRecovery` + weight ramp |
| **All replicas unhealthy** | All reads route to primary | Primary continues serving; failback when replicas recover | Monitor and investigate |

## Migration / Rollback Plan
1. **Feature flag gated**: `MULTI_REGION_READS_ENABLED` controls activation
2. **Gradual rollout**: Start at 10% rollout, monitor for 24h at each stage: 10% → 25% → 50% → 100%
3. **Rollback**: Set `MULTI_REGION_READS_ROLLOUT_PERCENT=0` → instant routing to primary
4. **No data migration needed**: Read-only layer, RYW tokens auto-expire (1h TTL)
5. **Reverse**: Disable new headers/metadata by removing `ROUTING_META` fields from decision

## Capacity Assumptions
- Primary region (asia-south1): ~500 QPS, Standard Firestore tier
- Replica regions: 50-200 QPS depending on geography, Standard tier
- Heartbeat interval: 10s, TTL: 60s (missing heartbeat = unhealthy)
- Lag thresholds: DEGRADED > 2s, UNHEALTHY > 10s
- Error rate threshold: MAX_ERROR_RATE_5M = 5%
- Consecutive errors threshold: 5
- Recovery observation: 60s minimum before failback ramp starts
- Recovery ramp steps: [0.1, 0.5, 1.0] over ~5 minutes total

## Related ADRs
- ADR-001: Multi-Region Read Layer (existing infrastructure)
- ADR-003: Read-Your-Writes Token Consistency (token validation flow)