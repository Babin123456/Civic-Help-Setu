# ADR: Multi-Region Read Architecture with Read-Your-Writes Consistency

**Status:** Proposed  
**Date:** 2026-11-24  
**Author:** Civic Help Setu Team  
**Issue:** #1233

---

## 1. Context

Civic Help Setu serves high-traffic public catalogues (office comparisons, public toilet directories, service guides) and citizen dashboards across India. Current architecture uses a single Firebase Firestore primary region. As traffic grows and latency requirements tighten for users in different geographic regions, we need a region-aware read layer that:

- Routes read requests to the nearest healthy replica
- Provides **read-your-writes consistency** for authenticated citizen sessions
- Exposes **bounded replica lag** metrics and stale-read disclosures
- Fails over safely to the primary when replicas are unhealthy
- **Never replicates sensitive citizen data** (PII, personal vault docs, applications, grievances) outside approved residency boundaries

---

## 2. Decision

We introduce a **Region-Aware Read Layer** (`MultiRegionReadManager`) that sits between API handlers and the data stores. It manages:

| Component | Responsibility |
|-----------|----------------|
| `RegionRegistry` | Declares approved regions, their residency classifications, and replica endpoints |
| `ReplicaHealthMonitor` | Tracks per-replica lag, error rates, and availability |
| `ReadRouter` | Selects the optimal replica for each request based on client region, consistency requirement, and health |
| `SessionTokenStore` | Issues and validates **read-your-writes tokens** bound to write timestamps |
| `StaleReadDisclosure` | Injects `x-stale-read: true` + `x-replica-lag-ms` headers when serving from a lagging replica |
| `FailoverController` | Drains traffic from unhealthy replicas, fails over to primary, and re-enables when healthy |

### Data Classification & Replication Policy

| Data Category | Collections | Replication | Residency |
|---------------|-------------|-------------|-----------|
| **Public Reference** | `services`, `notices`, `barrierInsights`, `service_versions`, `change_events`, `task_categories`, `micro_tasks`, `publicToiletSubmissions` (moderated view) | ✅ Full async replication to all approved regions | Any approved region |
| **Citizen Submissions (anonymized)** | `errorReports`, `serviceSubmissions`, `barrierReports`, `bottleneckFeedback`, `communityAudits` | ✅ Async replication (PII-stripped) | Any approved region |
| **Sensitive Citizen Data** | `users/{uid}/*`, `vaultDocs`, `applications`, `grievanceTickets`, `applicantProfiles`, `privacyExports`, `auditLogs` | ❌ **Never replicated** — reads always route to primary | Primary region only (India) |
| **Admin/Operator Data** | `roles`, `operator_accounts`, `reviewOverrides`, `sourceConflicts` | ❌ Primary only | Primary region only |

---

## 3. Architecture

### 3.1 Request Flow

```
Client Request
     │
     ▼
┌─────────────────────────────────────┐
│ ReadRouter.selectReplica(req)       │
│  1. Parse client region (geo-IP,    │
│     explicit header, or session)    │
│  2. Determine consistency level:    │
│     - STRONG (writes, RYW tokens)   │
│     - BOUNDED_STALE (default reads) │
│     - EVENTUAL (analytics, exports) │
│  3. Check SessionTokenStore for     │
│     read-your-writes token          │
│  4. Query ReplicaHealthMonitor      │
│  5. Return { replica, reason,       │
│     consistencyLevel, tokenRequired }│
└─────────────────────────────────────┘
     │
     ▼ (if tokenRequired & replica !== primary)
┌─────────────────────────────────────┐
│ SessionTokenStore.validate(token,   │
│     replica)                        │
│  - Token carries primary write      │
│    timestamp (primaryCommitTs)      │
│  - Replica must have replicated     │
│    up to primaryCommitTs            │
│  - If not caught up → route to      │
│    primary                          │
└─────────────────────────────────────┘
     │
     ▼
Execute read on selected replica
     │
     ▼
┌─────────────────────────────────────┐
│ Response Decorator                  │
│  - Add x-served-by: <region>        │
│  - Add x-consistency: <level>       │
│  - If replica lag > 0:              │
│     x-stale-read: true              │
│     x-replica-lag-ms: <lag>         │
│     x-primary-region: <primary>     │
└─────────────────────────────────────┘
```

### 3.2 Read-Your-Writes Token Protocol

**Token Format (JWS, HS256, signed by server secret):**
```json
{
  "sub": "user_123",
  "primaryCommitTs": 1732456789123,
  "writeOpId": "w_op_abc123",
  "issuedAt": 1732456789125,
  "exp": 1732460389125,
  "nonce": "rnd_32bytes"
}
```

**Issuance:** After every successful write (POST/PATCH/DELETE) to primary, the handler calls `SessionTokenStore.issueToken(userId, primaryCommitTs, writeOpId)` and returns the token in `x-read-your-writes-token` response header.

**Validation:** On subsequent reads, client sends `x-read-your-writes-token`. `ReadRouter` validates via `SessionTokenStore.validate(token, targetReplica)`. If the target replica's `replicatedUpToTs >= token.primaryCommitTs`, read proceeds on replica; otherwise, routes to primary.

---

## 4. Replica Lag Monitoring & Bounded Staleness

Each replica publishes a **heartbeat document** to a Firestore collection `_replica_heartbeats/{replicaId}` every 10 seconds:

```json
{
  "replicaId": "us-central1-replica-1",
  "region": "us-central1",
  "lastReplicatedCommitTs": 1732456789000,
  "lagMs": 123,
  "healthy": true,
  "errorRate5m": 0.001,
  "updatedAt": "2026-11-24T10:13:09.123Z"
}
```

**SLOs:**
| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Replica lag (p99) | < 500ms | > 2s |
| Replica lag (p99.9) | < 2s | > 10s |
| Replica availability | 99.95% | < 99.9% |
| Failover time (p99) | < 5s | > 15s |

**Stale-read disclosure:** When `lagMs > 0`, responses include:
- `x-stale-read: true`
- `x-replica-lag-ms: <lag>`
- `x-primary-region: <primary-region>`
- `x-replica-region: <serving-region>`

---

## 5. Failover Behavior

### 5.1 Replica Unhealthy Conditions
A replica is marked unhealthy when any condition persists for 30s:
- `lagMs > 10s` (configurable `MAX_LAG_MS`)
- `errorRate5m > 5%`
- Heartbeat missing for > 60s
- Explicit `healthy: false` in heartbeat

### 5.2 Failover Actions
1. `ReplicaHealthMonitor` emits `replica_unhealthy` event
2. `FailoverController` drains: stops routing new requests to replica
3. In-flight requests on replica complete (max 30s drain)
4. `ReadRouter` excludes replica from selection
5. Primary absorbs traffic (auto-scales via Vercel/Cloud Run)
6. When replica recovers (`healthy: true` + `lagMs < 1s` for 60s), `FailoverController` re-enables gradually (10% → 50% → 100% over 5m)

### 5.3 Primary Failure
- Primary is **never** failed over to a replica for writes
- Reads fail over to healthiest replica with `x-consistency: EVENTUAL` + `x-failover: true`
- Alerts fire immediately; manual intervention required for write recovery

---

## 6. Security Boundaries

| Boundary | Enforcement |
|----------|-------------|
| **No sensitive data replication** | Replication pipeline filters collections by allowlist; `users/{uid}/*` explicitly denied |
| **Residency compliance** | `RegionRegistry` tags each region with `residency: "india" \| "global"`; sensitive reads only route to `residency: "india"` regions |
| **Token binding** | RYW tokens scoped to `userId`; cannot be replayed across users |
| **Audit trail** | All routing decisions, failovers, and stale reads logged to `auditLogs` with `action: "read_routing"` |

---

## 7. Operational Runbooks

### 7.1 Enable Multi-Region Reads (Feature Flag)
```bash
# Gradual rollout via config
MULTI_REGION_READS_ENABLED=true
MULTI_REGION_READS_ROLLOUT_PERCENT=10  # Start at 10%
```

### 7.2 Add New Replica Region
1. Provision Firestore read-only replica in target region (Google Cloud: `gcloud firestore databases create --region=<region> --type=read-only`)
2. Add to `RegionRegistry` with `approved: true`, `residency: "global"` (or "india")
3. Deploy replication pipeline (Dataflow/Firestore change streams)
4. Verify heartbeat publishing and lag < 1s for 10m
5. Enable in `ReadRouter` with weight 0, ramp up over 1h

### 7.3 Emergency Disable Replica
```bash
# Set replica weight to 0 immediately
MULTI_REGION_REPLICA_WEIGHT_<replicaId>=0
```

### 7.4 Rollback Strategy
- Feature flag `MULTI_REGION_READS_ENABLED=false` → all reads route to primary instantly
- No data migration needed (reads only)
- Tokens invalidated on rollback (short TTL)

---

## 8. Metrics & Observability

| Metric | Name | Labels |
|--------|------|--------|
| Request count | `read_requests_total` | `region`, `replica`, `consistency`, `outcome` |
| Replica lag | `replica_lag_ms` | `replica`, `region` |
| Stale read rate | `stale_reads_total` | `replica`, `region` |
| RYW token validation | `ryw_validations_total` | `result: allowed\|routed_to_primary\|expired\|invalid` |
| Failover events | `failover_events_total` | `replica`, `reason`, `direction` |

---

## 9. Implementation Plan

| Phase | Scope | Files |
|-------|-------|-------|
| 1 | Core types, RegionRegistry, ReplicaHealthMonitor | `src/services/multiRegionRead/types.js`, `src/services/multiRegionRead/regionRegistry.js`, `src/services/multiRegionRead/replicaHealthMonitor.js` |
| 2 | SessionTokenStore (RYW tokens) | `src/services/multiRegionRead/sessionTokenStore.js` |
| 3 | ReadRouter with consistency levels | `src/services/multiRegionRead/readRouter.js` |
| 4 | Response decorator (stale-read headers) | `src/services/multiRegionRead/responseDecorator.js` |
| 5 | FailoverController | `src/services/multiRegionRead/failoverController.js` |
| 6 | Integration into API handlers (public-toilets, office-comparison, civic-data-api) | `api/_lib/handlers/*.js` |
| 7 | Unit + integration tests (lag simulation, failover, RYW) | `src/services/multiRegionRead/*.test.js` |
| 8 | Load/failure-injection tests (synthetic data) | `tests/multiRegionRead/*.test.js` |
| 9 | Documentation, runbooks, dashboards | `docs/architecture/adr-multi-region-read-layer.md`, `docs/ops/multi-region-read-runbook.md` |

---

## 10. Acceptance Criteria

- [ ] Integration tests prove **read-your-writes consistency** during replica lag (token forces primary read until replica catches up)
- [ ] Integration tests prove **failover behavior**: replica marked unhealthy → traffic drains → primary absorbs → replica recovers → gradual re-enable
- [ ] Dashboards expose **replication lag per replica**, **routing decisions**, **stale-read rate**, **RYW validation outcomes**
- [ ] **No sensitive citizen data** replicated: verified by dataflow pipeline tests and Firestore rules audit
- [ ] SLOs measurable: lag p99 < 500ms, failover p99 < 5s, availability 99.95%
- [ ] Feature flag gated: `MULTI_REGION_READS_ENABLED` with gradual rollout
- [ ] Rollback tested: disabling flag routes all reads to primary within 1 request