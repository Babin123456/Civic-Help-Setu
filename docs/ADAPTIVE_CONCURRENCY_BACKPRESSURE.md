# Adaptive Concurrency Limits and Queue Backpressure

> **Feature**: #1238 - Adaptive Concurrency Limits and Queue Backpressure  
> **Status**: Implemented  
> **Last Updated**: 2026-11-25

## Overview

The Adaptive Concurrency and Backpressure system protects Civic Help Setu APIs from overload by dynamically measuring dependency saturation and limiting concurrent work per route, tenant, and priority lane. It includes bounded queues with explicit rejection semantics, retry-after guidance, and priority lanes for critical citizen actions.

## Problem Statement

APIs face several overload threats:
1. **Unbounded memory growth** - Queues growing without bounds during sustained overload
2. **Priority inversion** - Low-priority traffic starving urgent workflows
3. **Cascading failures** - Downstream dependency saturation causing upstream timeouts
4. **Noisy neighbors** - One tenant's burst affecting other tenants' latency
5. **Retry storms** - Clients retrying immediately after 429/503 responses

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    API Gateway Middleware                               │
│  (Version Negotiation, Consumer Registry, Request Validation, etc.)    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  Backpressure Middleware                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐    │
│  │ Tenant Rate     │  │ Concurrency     │  │ Bounded Queue       │    │
│  │ Limiter         │──│ Controller      │──│ (Priority Lanes)    │    │
│  └─────────────────┘  └─────────────────┘  └─────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Mesh Readiness Layer                                 │
│  (Service Identity, Trace Context, Circuit Breakers, Bulkheads)        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      Route Handlers                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Concurrency Controller (`api/_lib/concurrencyController.js`)

Dynamically adjusts concurrency limits using AIMD (Additive Increase / Multiplicative Decrease) algorithm based on dependency health signals.

**Key Features**:
- **Saturation Metrics**: Tracks in-flight requests, latency percentiles (p50, p95, p99), error rates per route
- **AIMD Algorithm**: Increases concurrency when healthy, decreases multiplicatively under saturation
- **Priority Lanes**: Separate concurrency budgets for CRITICAL, HIGH, NORMAL, LOW
- **Emergency Brake**: Drastic concurrency reduction when p99 latency > 5s or error rate > 50%
- **Circuit Breaker Integration**: Rejects when downstream dependency breaker is OPEN
- **Per-Route/Tenant Limits**: Configurable concurrency budgets per route and tenant

**Configuration**:
```javascript
{
  routeDefaults: {
    maxConcurrency: 100,
    minConcurrency: 10,
    targetLatencyP50Ms: 200,
    targetLatencyP99Ms: 1000,
    maxErrorRate: 0.05,
    increaseStep: 5,
    decreaseFactor: 0.5,
    measurementWindowMs: 30000,
    saturationThreshold: 0.8,
  },
  priorityLanes: {
    CRITICAL: { minConcurrency: 5, maxConcurrency: 50, reservedSlots: 10 },
    HIGH: { minConcurrency: 3, maxConcurrency: 30, reservedSlots: 5 },
    NORMAL: { minConcurrency: 2, maxConcurrency: 20, reservedSlots: 0 },
    LOW: { minConcurrency: 1, maxConcurrency: 10, reservedSlots: 0 },
  },
  emergencyBrake: {
    enabled: true,
    latencyP99ThresholdMs: 5000,
    errorRateThreshold: 0.5,
    cooldownMs: 60000,
  }
}
```

**Response Headers**:
```
X-Concurrency-Limit: 100
X-Concurrency-InFlight: 45
X-Concurrency-Priority: NORMAL
Retry-After: 30  (when limit exceeded)
X-Backpressure-Reason: concurrency_limit|circuit_breaker_open|emergency_brake
```

### 2. Bounded Queue (`api/_lib/boundedQueue.js`)

Provides bounded queues with explicit rejection semantics and priority lanes.

**Key Features**:
- **Fixed Capacity**: Per-priority-lane capacity with configurable limits
- **Rejection Semantics**: Immediate rejection with `Retry-After` when full
- **Priority Lanes**: Separate queues for CRITICAL/HIGH/NORMAL/LOW
- **Aging Promotion**: Low-priority items age into higher priority lanes (prevents starvation)
- **Tenant Isolation**: Per-tenant queue slices to prevent noisy neighbors
- **Dead Letter Queue**: Captures rejected/failed items for analysis

**Configuration**:
```javascript
{
  capacity: { CRITICAL: 100, HIGH: 200, NORMAL: 500, LOW: 1000 },
  tenantSlice: { enabled: true, maxPerTenant: 50 },
  aging: { enabled: true, promoteAfterMs: 300000, maxPromotions: 2 }, // 5 min
  rejection: { mode: 'immediate', defaultRetryAfterMs: 5000 },
  deadLetter: { enabled: true, maxSize: 1000 },
}
```

**API**:
```javascript
const queue = createBoundedQueue(config);

const result = await queue.enqueue({
  task: { ... },
  priority: 'HIGH',
  tenantId: 'tenant-1',
  deadlineMs: 30000,
});
// Returns: { accepted: true, position: 5, estimatedWaitMs: 2000, priority: 'HIGH' }
// Or: { accepted: false, retryAfterMs: 5000, reason: 'queue_full', priority: 'HIGH' }
```

### 3. Backpressure Middleware (`api/_lib/backpressureMiddleware.js`)

Integrates concurrency control and bounded queues into the API Gateway request pipeline.

**Key Features**:
- **Three Modes**: DISABLED, SHADOW (metrics only), ENFORCE (full enforcement)
- **Tenant Rate Limiting**: Integrates with existing tenantRateLimiter
- **Concurrency Control**: Uses concurrencyController for dynamic limits
- **Queue Saturation Signals**: Monitors bounded queue utilization
- **Circuit Breaker Integration**: Registers dependency policies per route
- **Comprehensive Metrics**: Tracks requests, rejections, health status

**Modes**:
- `DISABLED`: No backpressure checks, pass-through
- `SHADOW`: Collects metrics, adds warning headers, allows all requests
- `ENFORCE`: Full enforcement with 503 responses

### 4. Task Queue Adapter (`src/tasks/queue/TaskQueueAdapter.js`)

Provides an in-memory bounded queue layer in front of the Firestore task queue for immediate backpressure, priority lane isolation, and tenant isolation.

**Key Features**:
- **Local Buffering**: Tasks buffered in-memory before Firestore persistence
- **Immediate Backpressure**: Rejects with Retry-After when local queue full
- **Priority Lane Isolation**: CRITICAL tasks don't get blocked by LOW priority
- **Tenant Isolation**: Noisy neighbor protection
- **Aging Promotion**: Stalled tasks promoted to higher priority
- **Async Flush**: Periodic batch flush to Firestore

**Configuration**:
```javascript
{
  capacity: { CRITICAL: 50, HIGH: 100, NORMAL: 200, LOW: 500 },
  tenantSlice: { enabled: true, maxPerTenant: 20 },
  aging: { enabled: true, promoteAfterMs: 120000, maxPromotions: 2 },
  flushIntervalMs: 1000,
  flushBatchSize: 50,
}
```

## Integration Points

### API Gateway Pipeline Order

1. **Gateway Middleware** - Version negotiation, consumer identification, quota enforcement, request validation, deprecation headers
2. **Backpressure Middleware** - Tenant rate limiting, concurrency control, queue saturation checks
3. **Cache Middleware** - Response caching
4. **Idempotency Layer** - Request deduplication
5. **Mesh Readiness Layer** - Service identity, trace context, circuit breakers
6. **Route Handler** - Business logic

### Mesh Resilience Integration

The concurrency controller integrates with mesh resilience circuit breakers:
- Registers `DependencyPolicy` per route
- Checks circuit breaker state before acquiring concurrency slot
- Rejects when breaker is OPEN, allows limited traffic in HALF_OPEN
- Records latency/error metrics for saturation calculation

### Tenant Rate Limiter Integration

The backpressure middleware uses tenant rate limiter as the first (cheapest) check:
- Multi-scope token buckets (actor, jurisdiction, tenant)
- `shadow` vs `enforce` modes
- Fail-open/fail-closed degraded store handling

## Measurable Targets

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| P99 Latency (steady state) | < 1000ms | > 2000ms for 5min |
| P99 Latency (under load) | < 3000ms | > 5000ms for 2min |
| Queue Rejection Rate | < 0.1% | > 1% for 5min |
| Priority Inversion Incidents | 0 | > 0 per hour |
| Memory Growth (queue) | < 10MB/hour | > 50MB/hour |
| Concurrency Adjustment Frequency | < 10/min | > 50/min (thrashing) |

## Configuration

### Environment Variables

```bash
# Backpressure Mode
BACKPRESSURE_MODE=enforce  # disabled|shadow|enforce

# Concurrency Controller
CONCURRENCY_CONTROLLER_ENABLED=true
CONCURRENCY_MODE=shadow  # shadow|enforce

# Bounded Queue
BOUNDED_QUEUE_ENABLED=true

# Task Queue Adapter
TASK_QUEUE_ADAPTER_ENABLED=true
TASK_QUEUE_FLUSH_INTERVAL_MS=1000
TASK_QUEUE_FLUSH_BATCH_SIZE=50
```

### Route-Specific Concurrency Config

```javascript
// In createDefaultBackpressureMiddleware()
concurrency: {
  routeConfigs: {
    '/api/services': { maxConcurrency: 100, targetLatencyP99Ms: 1000 },
    '/api/auth': { maxConcurrency: 50, targetLatencyP99Ms: 2000 },
    '/api/upload': { maxConcurrency: 20, targetLatencyP99Ms: 10000 },
    '/api/reports': { maxConcurrency: 30, targetLatencyP99Ms: 5000 },
    '/api/admin': { maxConcurrency: 10, targetLatencyP99Ms: 2000 },
  },
}
```

## Client Usage Guide

### Handling Backpressure Responses

```javascript
async function apiCallWithBackpressure(url, options = {}) {
  const response = await fetch(url, options);
  
  if (response.status === 503) {
    const data = await response.json();
    const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
    const reason = response.headers.get('X-Backpressure-Reason');
    
    console.warn(`Service overloaded (${reason}). Retrying after ${retryAfter}s`);
    await sleep(retryAfter * 1000);
    return apiCallWithBackpressure(url, options); // Retry
  }
  
  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
    console.warn(`Rate limited. Retrying after ${retryAfter}s`);
    await sleep(retryAfter * 1000);
    return apiCallWithBackpressure(url, options);
  }
  
  return response;
}
```

### Priority Header

Clients can indicate request priority for critical citizen actions:

```bash
# Critical priority (emergency services, time-sensitive)
curl -H "X-Request-Priority: CRITICAL" https://api.example.com/api/services

# High priority (time-sensitive civic operations)
curl -H "X-Request-Priority: HIGH" https://api.example.com/api/services

# Normal priority (default)
curl https://api.example.com/api/services

# Low priority (background, best-effort)
curl -H "X-Request-Priority: LOW" https://api.example.com/api/services
```

## Operational Runbooks

### Health Checks

```bash
# Backpressure middleware health
curl https://api.example.com/api/gateway-health
# Check components: concurrencyController, boundedQueue, tenantRateLimiter

# Detailed metrics
curl -H "X-API-Key: admin-key" https://api.example.com/api/gateway-metrics
```

### Monitoring Alerts

| Metric | Warning Threshold | Critical Threshold | Action |
|--------|-------------------|-------------------|--------|
| Concurrency rejection rate | > 1% | > 5% | Check downstream latency, consider scaling |
| Queue utilization (any priority) | > 80% | > 95% | Investigate processing delays |
| Emergency brake activations | > 0/hour | > 5/hour | Check downstream dependency health |
| Circuit breaker OPEN count | > 0 | > 3 | Investigate dependency failures |
| Tenant rate limit rejections | > 5% | > 20% | Review tenant quotas, check for abuse |
| Task queue flush errors | > 0 | > 10/min | Check Firestore connectivity |

### Dashboard Queries

**Concurrency Utilization by Route**:
```
concurrency_in_flight / concurrency_limit by route
```

**Queue Utilization by Priority**:
```
queue_byPriority_CRITICAL_utilization
queue_byPriority_HIGH_utilization
queue_byPriority_NORMAL_utilization
queue_byPriority_LOW_utilization
```

**Tenant Slice Utilization**:
```
queue_tenantSlices_*_total / tenantSlice_maxPerTenant
```

**Emergency Brake Status**:
```
concurrency_emergencyBrake_active by route
```

### Manual Override Procedures

**Force Concurrency Adjustment** (Operator Action):
```javascript
// Via admin API or direct invocation
const controller = backpressureMiddleware.concurrencyController;
controller.forceAdjustment('/api/services');
```

**Disable Backpressure for Route** (Emergency):
```javascript
// Via feature flag or config
concurrency: {
  routeConfigs: {
    '/api/critical-emergency': { maxConcurrency: 1000, minConcurrency: 100 },
  },
}
```

**Clear Dead Letter Queue**:
```javascript
const queue = backpressureMiddleware.boundedQueue;
queue.clearDeadLetterQueue();
```

## Failure Modes & Mitigations

| Failure Mode | Detection | Mitigation | Rollback |
|--------------|-----------|------------|----------|
| Concurrency controller crash | Metrics gap, health check fail | Fail-open (allow all), alert | `CONCURRENCY_CONTROLLER_ENABLED=false` |
| Queue memory leak | Queue size metrics, heap growth | Bounded capacity + periodic sweep | Restart instance |
| Priority starvation | Priority lane wait time metrics | Aging promotion + reserved slots | Tune aging config |
| False positive saturation | Alert fatigue | Hysteresis + minimum measurement window | Adjust thresholds |
| Downstream dependency silent failure | Circuit breaker OPEN, error rate | Bulkhead rejection + fallback | Circuit breaker reset API |

## Rollout Strategy

1. **Shadow Mode** (Week 1): Deploy with `BACKPRESSURE_MODE=shadow` - collect metrics, no enforcement
2. **Canary** (Week 2): Enable for 5% of traffic, monitor latency/error rates
3. **Gradual Rollout** (Week 3-4): Increase to 25%, 50%, 75%, 100%
4. **Full Enforcement**: All traffic, with operator override capability

## Rollback Procedure

1. Set `BACKPRESSURE_MODE=disabled` (no code deploy needed)
2. Verify metrics return to baseline
3. If issues persist, revert code deploy

**Rollback Time**: < 2 minutes (configuration change only)

## Testing

### Unit Tests
```bash
npm test -- api/_lib/concurrencyController.test.js
npm test -- api/_lib/boundedQueue.test.js
npm test -- api/_lib/backpressureMiddleware.test.js
npm test -- src/tasks/queue/TaskQueueAdapter.test.js
```

### Integration Tests
```bash
npm test -- api/_lib/gateway/gatewayMiddleware.test.js
npm test -- api/_lib/mesh/serviceMesh.test.js
```

### Concurrency & Load Tests
```bash
npm test -- api/_lib/gateway/resilienceAndChaos.test.js
```

### Failure Injection
```bash
# Simulated downstream latency spike → concurrency decrease
# Simulated downstream errors → circuit breaker + concurrency decrease
# Queue saturation → proper 503 with Retry-After
# NAT shared IP → tenant isolation verified
```

## Security Considerations

1. **No PII in Metrics**: All metrics are aggregated, no tenant/user identifiers
2. **Fail-Open Defaults**: Middleware errors don't block requests
3. **Rate Limit Headers**: Standard headers prevent information leakage
4. **Priority Validation**: Only accepts known priority values, defaults to NORMAL
5. **Tenant Isolation**: Per-tenant slices prevent cross-tenant interference

## Performance

| Operation | Target Latency | Measurement |
|-----------|---------------|-------------|
| Concurrency acquire/release | < 1ms | In-memory counters |
| Queue enqueue/dequeue | < 1ms | Array operations |
| Tenant rate limit check | < 2ms | Token bucket |
| Backpressure middleware | < 5ms | Full pipeline |

**Memory Usage**:
- Concurrency controller: ~10KB per route
- Bounded queue: ~50 bytes per queued item
- Task queue adapter: ~100 bytes per buffered task

## Related Documentation

- [API Gateway](API_GATEWAY.md) - Versioning, quotas, validation, deprecation
- [Abuse Controls](ABUSE_CONTROLS.md) - Rate limiting and abuse detection
- [Mesh Readiness](docs/MESH_READINESS.md) - Service mesh infrastructure
- [Task Queue](docs/deployment-task-queue.md) - Distributed task processing
- [Fair Scheduling](docs/fair-scheduling.md) - Appointment scheduling with priority
- [Implementation Plan](ADAPTIVE_CONCURRENCY_IMPLEMENTATION_PLAN.md) - Original implementation plan