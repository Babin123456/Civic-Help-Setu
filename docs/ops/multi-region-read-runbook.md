# Multi-Region Read Layer — Operational Runbook

**Version:** 1.0  
**Last Updated:** 2026-11-24  
**Owner:** Civic Help Setu Platform Team

---

## 1. Architecture Overview

The Regional Traffic Steering Layer extends the Multi-Region Read Layer with health-based,
latency-aware, capacity-aware routing and fail-closed residency enforcement.

### Key Components

| Component | Purpose |
|-----------|---------|
| **RegionRegistry** | Declares approved regions, residency, capacity, and Firestore connections |
| **ReplicaHealthMonitor** | Tracks per-replica lag, errors, latency, capacity, and health |
| **ReadRouter** | Selects optimal replica per request using multi-criteria decision |
| **SessionTokenStore** | Issues/validates RYW tokens (JWS HS256) |
| **FailoverController** | Manages draining, failover, controlled recovery, and failback |
| **ResponseDecorator** | Injects `x-stale-read`, `x-replica-lag-ms`, new steering headers |
| **TrafficSteeringLayer** | Core routing logic with health, latency, capacity, residency, sticky sessions |

### Data Classification

| Category | Collections | Replication |
|----------|-------------|-------------|
| **Public Reference** | `services`, `notices`, `micro_tasks`, `publicToiletSubmissions` | ✅ All regions |
| **Anonymized Submissions** | `errorReports`, `barrierReports` | ✅ All regions |
| **Sensitive Citizen Data** | `users/*`, `applications`, `grievanceTickets`, `privacyExports` | ❌ **Never** — primary only (fail-closed) |
| **Admin/Operator** | `roles`, `reviewOverrides`, `auditLogs` | ❌ Primary only |
| **Stateful / Sticky** | `users`, `applications`, `drafts`, `settings`, `checklists`, `assessments`, `saved` | ✅ With sticky session support |

### Data Classification

| Category | Collections | Replication |
|----------|-------------|-------------|
| **Public Reference** | `services`, `notices`, `micro_tasks`, `publicToiletSubmissions` | ✅ All regions |
| **Anonymized Submissions** | `errorReports`, `barrierReports` | ✅ All regions |
| **Sensitive Citizen Data** | `users/*`, `applications`, `grievanceTickets`, `privacyExports` | ❌ **Never** — primary only |
| **Admin/Operator** | `roles`, `reviewOverrides`, `auditLogs` | ❌ Primary only |

---

## 2. Deployment

### 2.1 Prerequisites

- Firebase project with Firestore
- Primary region: `asia-south1` (Mumbai)
- Replica regions: `us-central1`, `europe-west1`, `asia-southeast1`, `australia-southeast1`
- Each replica: Read-only Firestore database with change stream replication
- Environment variables configured (see below)

### 2.2 Environment Variables

```bash
# Feature flag (gradual rollout)
MULTI_REGION_READS_ENABLED=true
MULTI_REGION_READS_ROLLOUT_PERCENT=10  # Start at 10%

# Primary region (India residency)
MULTI_REGION_PRIMARY_REGION=asia-south1

# RYW token signing secret (rotate periodically)
RYW_TOKEN_SECRET=<base64-encoded-256-bit-secret>

# Optional: Custom replica weights
MULTI_REGION_REPLICA_WEIGHT_us-central1=100
MULTI_REGION_REPLICA_WEIGHT_europe-west1=100
```

### 2.3 Firestore Replica Setup

```bash
# Create read-only replica databases
gcloud firestore databases create --region=us-central1 --type=read-only --source=asia-south1
gcloud firestore databases create --region=europe-west1 --type=read-only --source=asia-south1
gcloud firestore databases create --region=asia-southeast1 --type=read-only --source=asia-south1
gcloud firestore databases create --region=australia-southeast1 --type=read-only --source=asia-south1

# Verify replication
gcloud firestore databases list
```

### 2.4 Deploy Steps

1. **Deploy API handlers** with multi-region integration
2. **Deploy replication pipeline** (Dataflow/Firestore change streams)
3. **Verify heartbeats** publishing from each replica
4. **Enable feature flag** at 10% rollout
4. **Monitor** for 24h at each rollout stage: 10% → 25% → 50% → 100%

---

## 3. Monitoring & Alerting

### 3.1 Key Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| `replica_lag_ms` (p99) | < 500ms | > 2s |
| `replica_lag_ms` (p99.9) | < 2s | > 10s |
| `replica_availability` | 99.95% | < 99.9% |
| `stale_read_rate` | < 5% | > 20% |
| `ryw_validation_routed_to_primary` | < 1% | > 5% |
| `failover_duration` (p99) | < 5s | > 15s |
| `replica_capacity_percent` (p95) | > 30% | < 20% |
| `replica_latency_ms` (p95) | < 200ms | > 500ms |
| `residency_violation_count` | 0 | > 0 |

### 3.2 Dashboards

- **Replication Lag**: Per-replica lag over time
- **Routing Decisions**: Breakdown by reason (nearest_healthy, ryw_token_valid, failover_to_primary, etc.)
- **RYW Token Validation**: Allowed / routed_to_primary / expired / invalid
- **Failover Events**: Timeline of failovers and recoveries

### 3.3 Critical Alerts

| Alert | Condition | Severity | Runbook |
|-------|-----------|----------|---------|
| `ReplicaLagCritical` | `lagMs > 10s` for 5m | P1 | §4.1 |
| `ReplicaUnhealthy` | Health = unhealthy | P1 | §4.2 |
| `AllReplicasDown` | No healthy replicas | P0 | §4.3 |
| `RYWValidationSpike` | > 5% routed_to_primary | P2 | §4.4 |
| `StaleReadSpike` | > 20% stale reads | P2 | §4.5 |
| `CapacityExhausted` | `capacityPercent < 20%` for 5m | P2 | §4.6 |
| `ResidencyRuleViolation` | Non-India region serving India-resident data | P0 | §4.7 |

---

## 4. Incident Response

### 4.1 Replica Lag Critical (> 10s)

**Symptoms:** `ReplicaLagCritical` alert, increased `stale_read_rate`, `ryw_routed_to_primary` spike

**Diagnosis:**
```bash
# Check replica health
curl https://api.civichelp.org/multi-region/health

# Check replication pipeline
gcloud dataflow jobs list --filter="name:firestore-replication"
```

**Actions:**
1. Verify replication pipeline is running
2. Check for Firestore quota limits
3. If pipeline stuck: restart Dataflow job
4. If lag > 30s: trigger manual failover
   ```bash
   curl -X POST https://api.civichelp.org/multi-region/failover \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -d '{"regionId": "us-central1", "reason": "lag_exceeded"}'
   ```

### 4.2 Replica Unhealthy

**Symptoms:** `ReplicaUnhealthy` alert, replica removed from routing

**Diagnosis:**
```bash
# Check replica health details
curl https://api.civichelp.org/multi-region/health | jq '.replicas["us-central1"]'
```

**Actions:**
1. Check error rate: `errorRate5m > 5%`?
2. Check consecutive errors: `consecutiveErrors >= 5`?
3. Check heartbeat staleness: `lastHeartbeatAgeMs > 60s`?
4. If transient: wait for auto-recovery
5. If persistent: manual failover (§4.1)

### 4.3 All Replicas Down

**Symptoms:** `AllReplicasDown` alert, all reads routing to primary

**Diagnosis:**
- Check primary region health
- Check network connectivity to replicas

**Actions:**
1. Verify primary is healthy
2. Check if replicas are in `draining` state (failover in progress)
3. If primary also unhealthy: **P0 INCIDENT** — escalate immediately
4. Disable multi-region reads if primary overloaded:
   ```bash
   curl -X POST https://api.civichelp.org/multi-region/disable \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -d '{"reason": "all_replicas_down"}'
   ```

### 4.4 RYW Validation Spike

**Symptoms:** > 5% of RYW validations result in `routed_to_primary`

**Diagnosis:**
- Check replica lag on affected replicas
- Check token issuance rate

**Actions:**
1. If lag spike: follow §4.1
2. If token clock skew: verify NTP sync on all servers
3. If token replay attack: check auth logs, revoke compromised tokens

### 4.5 Stale Read Spike

**Symptoms:** > 20% of reads have `x-stale-read: true`

**Diagnosis:**
- Check replica lag distribution
- Check if traffic shifted to distant replica

**Actions:**
1. Verify replica weights in `RegionRegistry`
2. Check geo-routing logic
3. Temporarily increase `rolloutPercent` to 0 if primary overloaded

### 4.6 Capacity Exhausted

**Symptoms:** `CapacityExhausted` alert, replica `capacityPercent < 20%` sustained for 5 minutes, increased error rates, timeouts

**Diagnosis:**
1. Check replica metrics: `capacityPercent`, `errorRate5m`, `consecutiveErrors`
2. Verify no resource leaks or sudden traffic spikes
3. Check Firestore quota limits and read/write throughput
4. Verify replication lag is not contributing to perceived slowness

**Actions:**
1. Deprioritize exhausted replica: router automatically reduces weight via capacity-aware routing
2. Scale replica resources (Firestore capacity, compute resources)
3. If persistent: consider adding additional replica region
4. Monitor `replica_capacity_percent` trend over 30 minutes
5. If capacity does not recover: open P2 ticket for infrastructure review

### 4.7 Residency Rule Violation

**Symptoms:** `ResidencyRuleViolation` alert, non-India region serving India-resident citizen data, potential data governance breach

**Diagnosis:**
1. Check routing decisions: `x-residency-enforced` and `x-residency-compliant` headers
2. Verify collection path requires India residency: `requiresIndiaResidency(collectionPath)`
3. Check if region residency matches: `getRegion(regionId).residency === RESIDENCY_CLASS.INDIA`
4. Review recent failover events that may have shifted routing

**Actions:**
1. **Immediate**: Trigger manual failover to primary or healthy India-resident replica
   ```bash
   curl -X POST https://api.civichelp.org/multi-region/failover \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -d '{"regionId": "us-central1", "reason": "residency_violation"}'
   ```
2. Route all sensitive reads to primary until root cause resolved
3. Investigate why non-India region was selected: routing logic bug, config drift, or replica health misreporting
4. Apply fix and re-deploy if code/config change required
5. Review audit logs for data access during violation window
6. File P0 security incident if citizen data was potentially exposed
7. Post-incident: update residency enforcement tests and monitoring thresholds

---

## 5. Operational Procedures

### 5.1 Add New Replica Region

1. Provision Firestore read-only replica
2. Add to `RegionRegistry` in `src/services/multiRegionRead/regionRegistry.js`
3. Deploy replication pipeline for new region
4. Verify heartbeat publishing:
   ```bash
   curl https://api.civichelp.org/multi-region/health | jq '.replicas["new-region"]'
   ```
5. Wait for lag < 1s for 10 minutes
6. Enable in router with weight 0, ramp up over 1 hour:
   ```bash
   MULTI_REGION_REPLICA_WEIGHT_new-region=10  # 10%
   # Wait 20 min
   MULTI_REGION_REPLICA_WEIGHT_new-region=50  # 50%
   # Wait 20 min
   MULTI_REGION_REPLICA_WEIGHT_new-region=100 # 100%
   ```

### 5.2 Remove Replica Region

1. Set weight to 0:
   ```bash
   MULTI_REGION_REPLICA_WEIGHT_old-region=0
   ```
2. Wait for drain (max 30s)
3. Verify no traffic to replica
4. Remove from `RegionRegistry`
5. Deprovision Firestore replica
5. Remove replication pipeline

### 5.3 Emergency Disable Multi-Region Reads

```bash
# Via API (requires admin token)
curl -X POST https://api.civichelp.org/multi-region/disable \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"reason": "emergency_maintenance"}'

# Or via env var (requires redeploy)
MULTI_REGION_READS_ENABLED=false
```

### 5.4 Rollback Procedure

**If issues detected during rollout:**
1. Set `MULTI_REGION_READS_ROLLOUT_PERCENT=0` (instant)
2. All reads route to primary immediately
3. No data migration needed (read-only layer)
4. RYW tokens auto-expire (1h TTL)
5. Investigate and fix before re-enabling

### 5.5 Traffic Steering Layer Operations

#### 5.5.1 Monitor Steering Decisions

Track the new routing metadata headers in production:
- `x-latency-ms`: Observed latency at served replica
- `x-capacity-percent`: Available capacity percentage
- `x-residency-compliant`: Residency rule compliance status
- `x-residency-enforced`: Whether fail-closed residency was applied
- `x-sticky-session`: Whether sticky session was established

**Healthy signs**: Diversified routing across regions, latency within thresholds, capacity > 30%, residency compliance 100% for sensitive data.

**Warning signs**: Concentration of traffic in single region, latency spikes, capacity < 20%, residency violations.

#### 5.5.2 Controlled Failback

To initiate controlled failback for a recovered replica:

```bash
# Check current failover status
curl https://api.civichelp.org/multi-region/failover-status

# Initiate controlled failback
curl -X POST https://api.civichelp.org/multi-region/controlled-failback \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"regionId": "us-central1"}'
```

**Failback process**:
1. Replica transitions to RECOVERING state if currently HEALTHY
2. Weight ramped from 10% → 100% over recovery ramp steps (5 min total)
3. Full weight applied when observation window (60s) passes
4. Router uses normal weights; replica back in rotation

#### 5.5.3 Emergency Sticky Session Reset

If sticky sessions are causing issues (pinning to degraded replica):

```bash
# Force expiry of sticky session markers
# This is handled automatically by session TTL (1 hour max)
# Or manually by clearing user session cache

# Route specific user to fresh replica
curl -X POST https://api.civichelp.org/multi-region/reset-sticky \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"userId": "user-12345"}'
```

#### 5.5.4 Add New Replica with Capacity Tracking

1. Provision Firestore read-only replica
2. Add to `RegionRegistry` in `src/services/multiRegionRead/regionRegistry.js` with `capacityPercent: 100`
3. Deploy replication pipeline for new region
4. Verify heartbeat publishing with latency and capacity metrics:
   ```bash
   curl https://api.civichelp.org/multi-region/health | jq '.replicas["new-region"]'
   ```
5. Wait for lag < 1s and capacity > 50% for 10 minutes
6. Enable in router; weight will ramp via normal recovery process
7. Monitor for 24h at each rollout stage

#### 5.5.5 Remove Replica Region

1. Set weight to 0 via runtime config or `MULTI_REGION_REPLICA_WEIGHT_old-region=0`
2. Wait for drain (max 30s, tracked by drain timeout)
3. Verify no traffic to replica (`x-served-by-region` no longer includes region)
4. Remove from `RegionRegistry`
5. Deprovision Firestore replica
6. Remove replication pipeline

---

---

## 6. Capacity Planning

### 6.1 Replica Sizing

| Region | Expected QPS | Firestore Tier |
|--------|--------------|----------------|
| asia-south1 (primary) | 500 | Standard |
| us-central1 | 200 | Standard |
| europe-west1 | 150 | Standard |
| asia-southeast1 | 100 | Standard |
| australia-southeast1 | 50 | Standard |

### 6.2 Scaling Triggers

- Replica CPU > 70% for 10m → scale up
- Replica lag > 2s sustained → investigate replication pipeline
- Primary QPS > 80% capacity → consider new India region (asia-south2)

---

## 7. Security Checklist

- [ ] RYW token secret rotated every 90 days
- [ ] Sensitive collections never replicated (verified by pipeline tests)
- [ ] India residency enforced for citizen data
- [ ] Audit logs capture all routing decisions
- [ ] Token revocation on password change/logout
- [ ] Rate limiting on token validation endpoint

---

## 8. Testing Checklist (Pre-Deploy)

- [ ] Unit tests pass: `npm test -- multiRegionRead`
- [ ] Integration tests pass: `npm test -- multiRegionReadIntegration`
- [ ] Failure injection tests pass: `npm test -- multiRegionReadFailureInjection`
- [ ] Load tests pass: `npm test -- multiRegionReadLoad`
- [ ] **Steering layer tests pass**: `npm test -- multiRegionReadSteering`
- [ ] Firestore rules test: `npm run rules:test`
- [ ] Synthetic data validation: no real PII in test fixtures
- [ ] Concurrency tests: simultaneous routing decisions under load
- [ ] Failover/fallback round-trip tests: complete recovery cycle verification

---

## 9. Contacts

| Role | Contact | Escalation |
|------|---------|------------|
| Platform On-Call | #platform-oncall | P0: immediate |
| SRE Lead | @sre-lead | P1: 15 min |
| Security Team | #security-incidents | P0: immediate |

---

## 10. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-24 | Platform Team | Initial version |