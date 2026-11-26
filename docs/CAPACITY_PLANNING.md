# Capacity Planning Guide: Adaptive Concurrency and Backpressure

## Overview
This guide provides guidelines for sizing concurrency limits, queue capacities, and other parameters based on expected traffic profiles.

## Traffic Profile Classification

### Profile A: Low Traffic (< 100 RPS)
- **Concurrency**: 10-20 per route
- **Queue Capacity**: 100-200 per priority lane
- **Tenant Slice**: 20 per tenant
- **Measurement Window**: 60 seconds

### Profile B: Medium Traffic (100-1000 RPS)
- **Concurrency**: 50-100 per route
- **Queue Capacity**: 500-1000 per priority lane
- **Tenant Slice**: 50 per tenant
- **Measurement Window**: 30 seconds

### Profile C: High Traffic (> 1000 RPS)
- **Concurrency**: 200-500 per route
- **Queue Capacity**: 2000-5000 per priority lane
- **Tenant Slice**: 100 per tenant
- **Measurement Window**: 15 seconds

## Sizing Formulas

### Concurrency Limit
```
maxConcurrency = peak_RPS × target_latency_seconds × safety_factor
```
- `peak_RPS`: Expected peak requests per second
- `target_latency_seconds`: Target P99 latency (e.g., 1 second)
- `safety_factor`: 1.5-2.0 for headroom

**Example**: 100 RPS peak, 1s target latency, 1.5 safety factor → 150 maxConcurrency

### Queue Capacity
```
queue_capacity = maxConcurrency × buffer_factor
```
- `buffer_factor`: 5-10x for burst absorption
- Per-priority allocation:
  - CRITICAL: 5% of total
  - HIGH: 10% of total
  - NORMAL: 40% of total
  - LOW: 45% of total

### Tenant Slice
```
maxPerTenant = queue_capacity / expected_tenant_count × fairness_factor
```
- `fairness_factor`: 0.1-0.2 (10-20% of queue per tenant)
- Per-priority cap: 50% of tenant slice

## Route-Specific Guidelines

### Read-Heavy Routes (`/api/services`, `/api/reports`)
- Higher concurrency (100-200)
- Lower queue capacity (reads are fast)
- Longer measurement window (60s)

### Write-Heavy Routes (`/api/upload`, `/api/submit`)
- Lower concurrency (20-50)
- Higher queue capacity (writes are slower)
- Shorter measurement window (15s)

### Auth Routes (`/api/auth`, `/api/login`)
- Very low concurrency (10-20)
- Strict rate limiting
- Short measurement window (10s)

### Admin Routes (`/api/admin/*`)
- Very low concurrency (5-10)
- High priority lane reservation
- Strict tenant isolation

## AIMD Parameter Tuning

### Increase Step
```
increaseStep = maxConcurrency × 0.05  (5% of max)
```
- Smaller for stable routes (2-3)
- Larger for variable routes (10-20)

### Decrease Factor
```
decreaseFactor = 0.3 - 0.7
```
- 0.5 default (halve on saturation)
- 0.3 for aggressive reduction (unstable deps)
- 0.7 for conservative reduction (stable deps)

### Saturation Threshold
```
saturationThreshold = 0.7 - 0.9
```
- 0.8 default
- Lower for latency-sensitive routes (0.7)
- Higher for throughput-oriented routes (0.9)

### Emergency Brake
| Parameter | Default | Tuning |
|-----------|---------|--------|
| latencyP99ThresholdMs | 5000 | Lower for real-time (2000) |
| errorRateThreshold | 0.5 | Lower for critical paths (0.2) |
| cooldownMs | 60000 | Longer for flapping (120000) |

## Queue Configuration

### Priority Lane Capacities
| Priority | % of Total | Min | Max |
|----------|------------|-----|-----|
| CRITICAL | 5% | 5 | 100 |
| HIGH | 10% | 10 | 200 |
| NORMAL | 40% | 50 | 500 |
| LOW | 45% | 100 | 1000 |

### Aging Promotion
| Parameter | Default | Tuning |
|-----------|---------|--------|
| promoteAfterMs | 300000 (5 min) | 60000-600000 |
| maxPromotions | 2 | 1-3 |

### Tenant Slice
| Parameter | Default | Tuning |
|-----------|---------|--------|
| maxPerTenant | 50 | 20-200 |
| perPriorityCap | 50% | 30-70% |

## Resource Estimation

### Memory per Instance
| Component | Memory per 1000 items |
|-----------|----------------------|
| Concurrency Controller | ~50 KB |
| Bounded Queue | ~100 KB |
| Saturation Metrics | ~20 KB per route |
| Task Queue Adapter | ~50 KB per 1000 tasks |

### CPU Overhead
| Operation | Latency |
|-----------|---------|
| Concurrency acquire/release | < 0.1ms |
| Queue enqueue/dequeue | < 0.05ms |
| Saturation check | < 0.1ms |
| Full pipeline | < 2ms |

### Network
- Additional headers: ~200 bytes/request
- Minimal bandwidth impact

## Scaling Guidelines

### Horizontal Scaling
- Concurrency limits are per-instance
- Use sticky sessions or shared state for distributed deployments
- Consider Redis-backed queue for multi-instance

### Vertical Scaling
- Increase `maxConcurrency` proportionally to CPU cores
- Target 70-80% CPU utilization at peak
- Monitor GC pressure with large queues

### Database Scaling
- Firestore writes: batch size 50, interval 1s
- Connection pool: 10-20 connections
- Monitor write latency

## Traffic Patterns & Sizing Examples

### Example 1: Municipal Services API
- **Traffic**: 500 RPS peak, 80% reads
- **Routes**: `/api/services`, `/api/reports`, `/api/auth`
- **Tenants**: 50 municipalities

**Sizing**:
- `/api/services`: maxConcurrency=200, queue=2000
- `/api/reports`: maxConcurrency=50, queue=500
- `/api/auth`: maxConcurrency=20, queue=100
- Tenant slice: 50 (1% of queue per municipality)

### Example 2: Citizen Complaint Portal
- **Traffic**: 200 RPS peak, 50% writes
- **Routes**: `/api/complaints`, `/api/upload`, `/api/status`
- **Tenants**: 100 wards

**Sizing**:
- `/api/complaints`: maxConcurrency=100, queue=1000
- `/api/upload`: maxConcurrency=30, queue=500
- `/api/status`: maxConcurrency=50, queue=500
- Tenant slice: 20 (0.5% of queue per ward)

### Example 3: Emergency Services
- **Traffic**: 100 RPS peak, but burst to 1000 RPS
- **Routes**: `/api/emergency`, `/api/alerts`
- **Priority**: CRITICAL lane critical

**Sizing**:
- CRITICAL lane: 50% of concurrency reserved
- Emergency brake: latencyP99ThresholdMs=2000
- Aging: promoteAfterMs=60000 (1 min for emergency)

## Monitoring Capacity

### Key Metrics to Track
| Metric | Warning | Critical |
|--------|---------|----------|
| Concurrency utilization | > 70% | > 90% |
| Queue utilization | > 80% | > 95% |
| Tenant slice utilization | > 80% | > 95% |
| Rejection rate | > 0.1% | > 1% |
| Emergency brake activations | > 0/hr | > 5/hr |

### Capacity Alerts
```prometheus
# Concurrency saturation
concurrency_utilization > 0.9

# Queue saturation
queue_byPriority_*_utilization > 0.95

# Tenant isolation breach
queue_tenantSlices_*_total / maxPerTenant > 0.9

# Rejection spike
rate(gateway_rejected_total[5m]) > 0.01
```

## Cost Optimization

### Right-Sizing Checklist
- [ ] Measure actual peak RPS per route
- [ ] Measure actual P99 latency per route
- [ ] Calculate required concurrency using formula
- [ ] Set maxConcurrency = calculated × 1.5
- [ ] Set queue capacity = maxConcurrency × 5
- [ ] Configure tenant slice for expected tenant count
- [ ] Run load test to validate
- [ ] Adjust AIMD parameters based on observed behavior

### Cost vs Reliability Tradeoffs
| Setting | Conservative | Balanced | Aggressive |
|---------|-------------|----------|------------|
| safety_factor | 2.0 | 1.5 | 1.2 |
| buffer_factor | 10 | 5 | 3 |
| decreaseFactor | 0.3 | 0.5 | 0.7 |
| saturationThreshold | 0.7 | 0.8 | 0.9 |
| Cost | Higher | Medium | Lower |
| Reliability | Highest | High | Medium |

## Related Documentation
- [Architecture Decision Record](ADAPTIVE_CONCURRENCY_ADR.md)
- [Operator Runbook](ADAPTIVE_CONCURRENCY_RUNBOOK.md)
- [Migration Guide](MIGRATION_GUIDE.md)
- [API Reference](API_REFERENCE.md)