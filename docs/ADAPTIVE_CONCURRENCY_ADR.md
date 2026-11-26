# ADR-003: Adaptive Concurrency Limits and Queue Backpressure

## Status
Accepted

## Context
The Civic Help Setu API platform needs protection from overload by measuring dependency saturation and dynamically limiting concurrent work per route and tenant. The system must include bounded queues, rejection semantics, retry-after guidance, and priority lanes for critical citizen actions.

## Decision
We implement a three-layer adaptive concurrency and backpressure system:

1. **Concurrency Controller** (`api/_lib/concurrencyController.js`) - AIMD algorithm with priority lanes
2. **Bounded Queue** (`api/_lib/boundedQueue.js`) - Fixed-capacity priority queues with tenant isolation
3. **Backpressure Middleware** (`api/_lib/backpressureMiddleware.js`) - Integration layer for the API gateway

### Key Design Decisions

#### 1. AIMD Algorithm for Concurrency Control
- **Additive Increase**: +5 concurrency when utilization < 40% and error rate < 2.5%
- **Multiplicative Decrease**: ×0.5 when utilization > 80% or error rate > 5% or P99 latency > target
- **Per-route/tenant isolation**: Separate concurrency budgets prevent noisy neighbors
- **Priority lanes**: CRITICAL/HIGH/NORMAL/LOW with reserved slots (10/5/0/0)

#### 2. Bounded Queues with Priority Lanes
- Fixed capacity per priority lane (CRITICAL:100, HIGH:200, NORMAL:500, LOW:1000)
- Tenant slice isolation: max 50 items per tenant, 50% per priority
- Aging promotion: items age up 1 priority level every 5 minutes (max 2 levels)
- Immediate rejection with `Retry-After` header when full
- Dead letter queue for failed items

#### 3. Mesh Resilience Integration
- `getSaturation()` method on `DependencyPolicy` returns utilization, error rate, latency percentiles
- `onSaturationChange` callback notifies concurrency controller of dependency saturation changes
- Circuit breaker state (OPEN/HALF_OPEN/CLOSED) checked before concurrency acquisition

#### 4. Three-Mode Operation
- `DISABLED`: No enforcement, pass-through
- `SHADOW`: Metrics collection only, warning headers
- `ENFORCE`: Full enforcement with 503/429 responses

### Alternatives Considered

| Alternative | Pros | Cons | Decision |
|-------------|------|------|----------|
| Fixed concurrency limits | Simple | No adaptation to load | Rejected |
| Token bucket only | Rate limiting | No concurrency control | Rejected |
| External queue (Redis) | Persistence | Operational complexity | Deferred |
| Single priority queue | Simple | Priority inversion | Rejected |

## Consequences

### Positive
- Graceful degradation under overload (503 with Retry-After)
- Priority inversion prevented (reserved slots + aging promotion)
- Tenant isolation (noisy neighbor protection)
- Observable metrics (utilization, queue depth, saturation)
- Fail-open defaults for safety
- Backward compatible via feature flags

### Negative
- Added complexity in request pipeline
- In-memory state (ephemeral, lost on restart)
- Requires tuning of AIMD parameters per route
- Additional latency (~1-2ms) for concurrency checks

## Implementation Status

| Component | Status | Tests |
|-----------|--------|-------|
| Concurrency Controller | ✅ Complete | 30 tests |
| Bounded Queue | ✅ Complete | 29 tests |
| Backpressure Middleware | ✅ Complete | 20 tests |
| Mesh Resilience Integration | ✅ Complete | 10 tests |
| Task Queue Adapter | ✅ Complete | 18 tests |
| Integration Tests | ✅ Complete | 8 tests |
| Overload & Failure-Injection Tests | ✅ Complete | 6 tests |
| Documentation | ✅ Complete | ADR, Runbook, Capacity, Migration |

## Threat Model & Data Ownership

### Threat Model
| Threat | Vector | Mitigation |
|--------|--------|------------|
| **Noisy-neighbor / Tenant Exhaustion** | Single tenant floods concurrency slots or queue capacity | Per-tenant concurrency caps (`tenantInFlight` in `concurrencyController.js`), bounded per-tenant queue slices (`maxPerTenant` + 50% per-priority cap in `boundedQueue.js`), and `tenantRateLimiter` pre-checks |
| **Priority Starvation / Inversion** | High-volume `LOW`/`NORMAL` traffic starves urgent citizen actions | Reserved `CRITICAL`/`HIGH` concurrency slots + `boundedQueue` aging promotion (`runAging()`) |
| **Unbounded Memory Growth** | Ephemeral tenant IDs or unbounded queues under sustained overload | Fixed per-priority queue capacities, automatic deletion of zero-count entries in `tenantInFlight`, and bounded latency sample ring buffers (`MAX_LATENCY_SAMPLES = 1000`) |
| **Priority Spoofing** | Untrusted client sends `X-Request-Priority: CRITICAL` | Upstream gateway/auth layer is authoritative for `req.priority` on citizen-critical routes; untrusted headers should be stripped or validated at the edge |
| **Cascading Dependency Failure** | Slow or failing downstream causes thread/event-loop exhaustion | `DependencyPolicy` circuit breaker (`OPEN` -> immediate `503` + `Retry-After`) + `emergencyBrake` (`P99 > 5s` or `errorRate > 50%`) |

### Data Ownership
- **Concurrency & Queue State (`concurrencyController.js`, `boundedQueue.js`)**: Owned by the API Gateway runtime (in-memory, per-instance, ephemeral; no citizen PII stored—only route names, priority classes, opaque `tenantId` counters, and latency numbers).
- **Dependency Health & Circuit Breaker State (`api/_lib/mesh/resilience.js`)**: Owned by the Mesh Resilience layer; feeds saturation snapshots to `concurrencyController`.
- **Tenant Quota & Rate-Limit Policies (`api/_lib/tenantRateLimiter.js`)**: Owned by the Gateway/Abuse Control Plane; evaluated prior to concurrency slot acquisition.
- **Task Queue Persistence (`src/tasks/queue/TaskQueueAdapter.js`)**: Local bounded buffer owned by the task adapter; flushed to Firestore task collections owned by the background worker subsystem.

## Rollout Plan

1. **Week 1**: Deploy with `BACKPRESSURE_MODE=shadow` - collect metrics only
2. **Week 2**: Canary 5% traffic with `ENFORCE`
3. **Week 3-4**: Gradual rollout 25% → 50% → 75% → 100%
4. **Operator Override**: Manual concurrency adjustment via `forceAdjustment(route)`

## Rollback Procedure

1. Set `BACKPRESSURE_MODE=disabled` (config change, no deploy)
2. Verify metrics return to baseline
3. If issues persist, revert code deploy

## Metrics & Alerting

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| P99 Latency (steady) | < 1000ms | > 2000ms for 5min |
| P99 Latency (load) | < 3000ms | > 5000ms for 2min |
| Queue Rejection Rate | < 0.1% | > 1% for 5min |
| Priority Inversion | 0 | > 0 per hour |
| Memory Growth | < 10MB/hr | > 50MB/hr |
| Adjustment Frequency | < 10/min | > 50/min (thrashing) |

## References
- Implementation Plan: `ADAPTIVE_CONCURRENCY_IMPLEMENTATION_PLAN.md`
- Implementation Summary: `ADAPTIVE_CONCURRENCY_IMPLEMENTATION_SUMMARY.md`
- Operator Runbook: `docs/ADAPTIVE_CONCURRENCY_RUNBOOK.md`
- Capacity Planning: `docs/CAPACITY_PLANNING.md`