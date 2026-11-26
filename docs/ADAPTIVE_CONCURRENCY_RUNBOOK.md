# Operator Runbook: Adaptive Concurrency and Backpressure

## Overview
This runbook covers operational procedures for the Adaptive Concurrency and Backpressure system.

## Architecture Overview

```
Request → Gateway Middleware → Backpressure Middleware → Mesh Resilience → Handler
                    ↓                    ↓                      ↓
             Quota Check          Concurrency Check       Circuit Breaker
                    ↓                    ↓                      ↓
             Rate Limit           Priority Lane           Bulkhead/Timeout
                    ↓                    ↓
             Tenant Limit        Bounded Queue
```

## Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| Concurrency Controller | `api/_lib/concurrencyController.js` | AIMD-based dynamic concurrency limits |
| Bounded Queue | `api/_lib/boundedQueue.js` | Priority queues with tenant isolation |
| Backpressure Middleware | `api/_lib/backpressureMiddleware.js` | Pipeline integration |
| Mesh Resilience | `api/_lib/mesh/resilience.js` | Circuit breakers, saturation metrics |
| Task Queue Adapter | `src/tasks/queue/TaskQueueAdapter.js` | Task queue backpressure |

## Monitoring & Alerting

### Key Dashboards

#### Concurrency Dashboard
- **Utilization by Route**: `concurrency_in_flight / concurrency_limit` per route
- **Priority Lane Depth**: In-flight per priority lane
- **Adjustment Frequency**: `adjustment_count` per minute

#### Queue Dashboard
- **Queue Utilization**: `queue_byPriority_*_utilization`
- **Tenant Slice Usage**: `queue_tenantSlices_*_total / maxPerTenant`
- **Dead Letter Size**: `queue_deadLetter_size`

#### Mesh Resilience Dashboard
- **Circuit Breaker State**: `breaker_state` per dependency
- **Saturation Metrics**: `utilization`, `error_rate`, `latency_p99`
- **Bulkhead Rejections**: `MESH_BULKHEAD_REJECTED` count

### Alert Rules

| Alert | Condition | Severity | Action |
|-------|-----------|----------|--------|
| High Rejection Rate | `rejection_rate > 1%` for 5min | Critical | Check downstream health, consider scaling |
| Emergency Brake Active | `emergency_brake_active = true` | Critical | Investigate downstream latency/errors |
| Circuit Breaker OPEN | `breaker_state = OPEN` | Warning | Check dependency health |
| Queue Saturation | `queue_utilization > 90%` | Warning | Check processing capacity |
| Priority Starvation | `priority_inversion_incidents > 0` | Critical | Check aging promotion config |
| Memory Growth | `queue_memory_growth > 50MB/hr` | Warning | Check for queue leak |

## Common Operations

### View Current Concurrency Limits
```bash
curl -H "X-API-Key: admin-key" https://api.example.com/api/gateway-metrics
```

Response includes:
```json
{
  "concurrency": {
    "/api/services": {
      "global": { "maxConcurrent": 100, "inFlight": 45, "utilization": 0.45 },
      "lanes": {
        "CRITICAL": { "maxConcurrent": 50, "inFlight": 2 },
        "HIGH": { "maxConcurrency": 30, "inFlight": 5 },
        "NORMAL": { "maxConcurrent": 20, "inFlight": 15 }
      }
    }
  }
}
```

### View Queue Status
```bash
curl -H "X-API-Key: admin-key" https://api.example.com/api/gateway-metrics
```

Response includes:
```json
{
  "queue": {
    "totalSize": 150,
    "totalCapacity": 1800,
    "utilization": 0.083,
    "byPriority": {
      "CRITICAL": { "size": 2, "capacity": 100, "utilization": 0.02 },
      "NORMAL": { "size": 120, "capacity": 500, "utilization": 0.24 }
    },
    "tenantSlices": {
      "tenant-1": { "total": 50, "byPriority": { "NORMAL": 25, "HIGH": 5 } }
    }
  }
}
```

### Force Concurrency Adjustment (Operator Action)
```bash
# Via admin API (to be implemented)
POST /api/admin/concurrency/adjust
{
  "route": "/api/services",
  "action": "force_adjust"
}
```

Or directly via code:
```javascript
const controller = backpressureMiddleware.concurrencyController;
controller.forceAdjustment('/api/services');
```

### Disable Backpressure (Emergency Rollback)
```bash
# Set environment variable (no deploy needed)
BACKPRESSURE_MODE=disabled

# Or via feature flag
BACKPRESSURE_MIDDLEWARE_ENABLED=false
```

### Clear Dead Letter Queue
```javascript
const queue = backpressureMiddleware.boundedQueue;
queue.clearDeadLetterQueue();
```

### Manual Concurrency Override
```javascript
const controller = backpressureMiddleware.concurrencyController;
controller.registerDependencyPolicy('/api/custom', {
  maxConcurrency: 200,
  minConcurrency: 20,
  targetLatencyP99Ms: 500
});
```

## Troubleshooting

### High Rejection Rate
1. Check `gateway-metrics` for rejection breakdown
2. If `concurrencyRejections` high:
   - Check downstream latency via mesh resilience metrics
   - Consider increasing `maxConcurrency` for affected routes
3. If `tenantRateLimitRejections` high:
   - Check for abusive tenant
   - Consider increasing tenant quota
4. If `circuitBreakerRejections` high:
   - Check dependency health via mesh readiness endpoint

### Priority Inversion (Low-priority starving high-priority)
1. Verify `reservedSlots` configured for CRITICAL/HIGH lanes
2. Check aging promotion is working (`queue_promoted` events)
3. Verify `maxPromotions` setting (default 2)
4. Increase `reservedSlots` if needed

### Queue Memory Growth
1. Check `queue_totalSize` trend
2. Verify `flushIntervalMs` and `flushBatchSize` in TaskQueueAdapter
3. Check for dead letter queue growth
4. Restart instance if unbounded growth detected

### Emergency Brake Activated Frequently
1. Check `latencyP99ThresholdMs` (default 5000ms) - may be too low
2. Check `errorRateThreshold` (default 0.5) - may be too sensitive
3. Investigate root cause: downstream latency or errors
4. Adjust thresholds or fix root cause

## Configuration Reference

### Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `BACKPRESSURE_MODE` | `shadow` | `disabled\|shadow\|enforce` |
| `CONCURRENCY_CONTROLLER_ENABLED` | `true` | Enable/disable concurrency control |
| `BOUNDED_QUEUE_ENABLED` | `true` | Enable/disable bounded queue |
| `BACKPRESSURE_MIDDLEWARE_ENABLED` | `true` | Enable/disable backpressure middleware |

### Key Configuration Files
- `api/_lib/backpressureMiddleware.js` - Default configuration
- `api/_lib/concurrencyController.js` - AIMD parameters
- `api/_lib/boundedQueue.js` - Queue capacities and aging

## Capacity Planning

### Default Limits
| Route Pattern | Max Concurrency | Target P99 |
|---------------|-----------------|------------|
| `/api/services` | 100 | 1000ms |
| `/api/auth` | 50 | 2000ms |
| `/api/upload` | 20 | 10000ms |
| `/api/reports` | 30 | 5000ms |
| `/api/admin` | 10 | 2000ms |

### Queue Capacities
| Priority | Capacity | Tenant Slice |
|----------|----------|--------------|
| CRITICAL | 100 | 50 (50% = 25) |
| HIGH | 200 | 50 (50% = 25) |
| NORMAL | 500 | 50 (50% = 25) |
| LOW | 1000 | 50 (50% = 25) |

### Sizing Guidelines
- **Concurrency**: Start with `maxConcurrency = expected_peak_rps * target_latency_seconds`
- **Queue Capacity**: `capacity = max_concurrency * 10` (10x buffer)
- **Tenant Slice**: `maxPerTenant = queue_capacity / expected_tenant_count`

## Escalation Contacts

| Issue | Primary | Secondary |
|-------|---------|-----------|
| High Rejection Rate | Platform Team | SRE Lead |
| Priority Inversion | Platform Team | Architect |
| Memory Leak | Platform Team | SRE Lead |
| Circuit Breaker Storm | SRE Team | Platform Team |

## Related Documentation
- [Architecture Decision Record](ADAPTIVE_CONCURRENCY_ADR.md)
- [Implementation Summary](ADAPTIVE_CONCURRENCY_IMPLEMENTATION_SUMMARY.md)
- [Capacity Planning Guide](CAPACITY_PLANNING.md)
- [Migration Guide](MIGRATION_GUIDE.md)