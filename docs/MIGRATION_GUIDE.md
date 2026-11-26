# Migration Guide: Adaptive Concurrency and Backpressure

## Overview
This guide describes how to migrate from static concurrency limits to the new adaptive concurrency and backpressure system.

## Current State (Before Migration)

### Existing Protections
- Gateway Middleware: Quota enforcement per consumer
- Tenant Rate Limiter: Multi-scope token buckets
- Mesh Resilience: Circuit breakers + bulkheads
- Fair Scheduler: Priority-based task scheduling (P0-P3)
- Task Queue: Priority-based processing with aging

### Gaps Addressed
- No dynamic concurrency adjustment
- No bounded queues for request acceptance
- No priority lanes in request pipeline
- No saturation feedback from mesh resilience
- No tenant isolation in task queue

## Migration Phases

### Phase 0: Pre-Migration (Week 0)
- [ ] Review current traffic patterns per route
- [ ] Measure baseline P50/P99 latency per route
- [ ] Measure current error rates per route
- [ ] Document current static limits
- [ ] Identify critical citizen-action routes
- [ ] Set up monitoring dashboards

### Phase 1: Shadow Mode (Week 1)
**Goal**: Deploy with metrics collection only, no enforcement

#### Configuration
```bash
BACKPRESSURE_MODE=shadow
CONCURRENCY_CONTROLLER_ENABLED=true
BOUNDED_QUEUE_ENABLED=true
BACKPRESSURE_MIDDLEWARE_ENABLED=true
```

#### Verification Checklist
- [ ] Metrics flowing: concurrency utilization, queue depth, saturation
- [ ] No 503/429 responses from backpressure
- [ ] `X-Backpressure-Warning` header present in shadow mode
- [ ] No increase in baseline latency
- [ ] No increase in error rate

#### Metrics to Collect
- Concurrency utilization per route
- Queue utilization per priority lane
- Tenant slice utilization
- Saturation events (utilization > 80%, error rate > 5%, P99 > target)
- Emergency brake activations

### Phase 2: Canary (Week 2)
**Goal**: Enable enforcement for 5% of traffic

#### Configuration
```bash
# Canary deployment - 5% of instances
BACKPRESSURE_MODE=enforce
CONCURRENCY_CONTROLLER_ENABLED=true
BOUNDED_QUEUE_ENABLED=true
BACKPRESSURE_MIDDLEWARE_ENABLED=true
```

#### Canary Routes
Start with non-critical routes:
- `/api/reports`
- `/api/analytics`
- `/api/admin` (internal)

#### Monitoring
- [ ] Rejection rate < 0.1%
- [ ] P99 latency < 2000ms
- [ ] No priority inversion incidents
- [ ] Emergency brake not activated unexpectedly
- [ ] Tenant isolation working (noisy neighbor test)

### Phase 3: Gradual Rollout (Weeks 3-4)

| Week | Traffic % | Routes |
|------|-----------|--------|
| 3 | 25% | Add `/api/services`, `/api/status` |
| 3 | 50% | Add `/api/upload`, `/api/submit` |
| 4 | 75% | Add `/api/auth`, `/api/profile` |
| 4 | 100% | All routes |

#### Per-Week Validation
- [ ] Rejection rate < 0.1%
- [ ] P99 latency < 3000ms under load
- [ ] No priority inversion
- [ ] Emergency brake < 5 activations/hour
- [ ] Memory growth < 10MB/hour

### Phase 4: Full Enforcement (Week 5+)
- [ ] All routes on `ENFORCE` mode
- [ ] Operator override procedures documented
- [ ] Alerting rules tuned
- [ ] Runbook procedures validated

## Configuration Migration

### Before: Static Limits
```javascript
// Old: Fixed limits in gateway middleware
const STATIC_LIMITS = {
  '/api/services': { rpm: 100 },
  '/api/auth': { rpm: 20 },
  '/api/upload': { rpm: 10 },
};
```

### After: Adaptive Configuration
```javascript
// New: Adaptive limits in backpressure middleware
concurrency: {
  routeConfigs: {
    '/api/services': { 
      maxConcurrency: 100, 
      targetLatencyP99Ms: 1000,
      minConcurrency: 10 
    },
    '/api/auth': { 
      maxConcurrency: 50, 
      targetLatencyP99Ms: 2000,
      minConcurrency: 5 
    },
    '/api/upload': { 
      maxConcurrency: 20, 
      targetLatencyP99Ms: 10000,
      minConcurrency: 5 
    },
  },
  priorityLanes: {
    CRITICAL: { minConcurrency: 5, maxConcurrency: 50, reservedSlots: 10 },
    HIGH: { minConcurrency: 3, maxConcurrency: 30, reservedSlots: 5 },
    NORMAL: { minConcurrency: 2, maxConcurrency: 20, reservedSlots: 0 },
    LOW: { minConcurrency: 1, maxConcurrency: 10, reservedSlots: 0 },
  }
```

### Tenant Rate Limiter Migration
```javascript
// Before: Single rate limit per tenant
tenantRateLimiter: { mode: 'enforce' }

// After: Multi-scope with tenant isolation
tenantRateLimiter: {
  mode: 'enforce',
  profiles: {
    'public-read': { capacity: 120, refillPerSec: 2 },
    'public-write': { capacity: 20, refillPerSec: 0.35 },
    'authenticated-write': { capacity: 45, refillPerSec: 0.75 },
  },
  tenantOverrides: {
    'premium-tenant': { capacity: 500, refillPerSec: 10 },
  }
```

### Task Queue Migration
```javascript
// Before: Unbounded task acceptance
async function enqueueTask(task) {
  return await firestoreEnqueueTask(task);
}

// After: Bounded queue with backpressure
const adapter = createTaskQueueAdapter({
  capacity: { CRITICAL: 100, HIGH: 200, NORMAL: 500, LOW: 1000 },
  tenantSlice: { enabled: true, maxPerTenant: 50 },
  aging: { enabled: true, promoteAfterMs: 300000 },
});

async function enqueueTask(task) {
  return await adapter.enqueueTask(task);
}

// Start periodic flush to Firestore
adapter.startFlushLoop(firestoreEnqueueTask);
```

## Testing Migration

### Unit Tests to Update
- [ ] Mock `concurrencyController.acquireSlot()` in handler tests
- [ ] Mock `boundedQueue.enqueue()` in queue tests
- [ ] Test priority lane routing
- [ ] Test tenant isolation
- [ ] Test emergency brake scenarios

### Integration Tests to Add
- [ ] Full pipeline: Gateway → Backpressure → Mesh → Handler
- [ ] Tenant rate limiter + concurrency controller interaction
- [ ] Circuit breaker OPEN → concurrency rejection
- [ ] Priority lane isolation under load
- [ ] Aging promotion prevents starvation

### Load Test Scenarios
```javascript
// k6 or artillery script
export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up
    { duration: '5m', target: 500 },   // Sustained load
    { duration: '2m', target: 1000 },  // Spike
    { duration: '5m', target: 500 },   // Recovery
    { duration: '2m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(99)<3000'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  },
};
```

## Rollback Procedures

### Immediate Rollback (< 2 minutes)
```bash
# Set feature flag (no deploy)
BACKPRESSURE_MODE=disabled

# Verify
curl https://api.example.com/api/gateway-health
# Should show backpressure components as "disabled"
```

### Partial Rollback (Selective Routes)
```javascript
// Disable for specific routes
concurrency: {
  routeConfigs: {
    '/api/problematic': { maxConcurrency: 1000, minConcurrency: 100 }, // Effectively disabled
  }
}
```

### Full Code Rollback
```bash
git revert <commit-hash>
# Or
git checkout <previous-tag>
npm run deploy
```

### Verification After Rollback
- [ ] No backpressure headers in responses
- [ ] Latency returns to baseline
- [ ] Error rate returns to baseline
- [ ] No 503/429 from backpressure

## Post-Migration Validation

### Week 1 Post-Launch
- [ ] Daily review of rejection rates
- [ ] Daily review of P99 latency
- [ ] Daily review of emergency brake activations
- [ ] Tenant feedback on priority lanes
- [ ] Adjust AIMD parameters if needed

### Week 2-4 Post-Launch
- [ ] Weekly capacity review
- [ ] AIMD parameter tuning
- [ ] Priority lane reservation tuning
- [ ] Tenant slice sizing review
- [ ] Emergency brake threshold review

### Month 1 Post-Launch
- [ ] Capacity planning review
- [ ] Cost vs reliability analysis
- [ ] Alert threshold tuning
- [ ] Documentation updates

## Troubleshooting Common Issues

### Issue: Too Many 503s After Migration
**Cause**: `maxConcurrency` too low
**Fix**: Increase `maxConcurrency` or `targetLatencyP99Ms`

### Issue: Priority Inversion (LOW starving CRITICAL)
**Cause**: Reserved slots too small or aging too slow
**Fix**: Increase `reservedSlots` or decrease `promoteAfterMs`

### Issue: Tenant Affecting Other Tenants
**Cause**: Tenant slice too large or per-priority cap too high
**Fix**: Decrease `maxPerTenant` or per-priority cap

### Issue: Emergency Brake Activating Too Often
**Cause**: Thresholds too sensitive
**Fix**: Increase `latencyP99ThresholdMs` or `errorRateThreshold`

### Issue: Memory Growth in Queue
**Cause**: Flush interval too long or batch size too small
**Fix**: Decrease `flushIntervalMs` or increase `flushBatchSize`

## Validation Checklist

### Pre-Migration
- [ ] Baseline metrics documented
- [ ] Test environment mirrors production
- [ ] Rollback procedures tested
- [ ] Team trained on runbook procedures

### During Migration
- [ ] Shadow mode metrics collected
- [ ] Canary metrics within thresholds
- [ ] Each rollout phase validated
- [ ] No priority inversion incidents

### Post-Migration
- [ ] All routes on ENFORCE mode
- [ ] Alerting rules active and tuned
- [ ] Runbook procedures validated
- [ ] Team trained on operations
- [ ] Documentation updated

## Rollback Decision Matrix

| Metric | Green (Continue) | Yellow (Pause) | Red (Rollback) |
|--------|------------------|----------------|----------------|
| Rejection Rate | < 0.1% | 0.1-1% | > 1% |
| P99 Latency | < 2s | 2-5s | > 5s |
| Emergency Brake | 0/hr | 1-5/hr | > 5/hr |
| Priority Inversion | 0 | 1-2 | > 2 |
| Error Rate | < 0.5% | 0.5-2% | > 2% |

## Related Documentation
- [Architecture Decision Record](ADAPTIVE_CONCURRENCY_ADR.md)
- [Operator Runbook](ADAPTIVE_CONCURRENCY_RUNBOOK.md)
- [Capacity Planning Guide](CAPACITY_PLANNING.md)
- [Implementation Summary](ADAPTIVE_CONCURRENCY_IMPLEMENTATION_SUMMARY.md)