# Tenant- and Department-Isolated Data Partitioning

## Overview

This document describes the implementation of tenant- and department-isolated data partitioning for the Civic Help Setu platform. The system enforces strict data boundaries between state, district, municipality, and department-owned datasets without duplicating the application stack.

## Architecture

### Tenant Hierarchy

```
STATE (e.g., state:IN-KA)
├── DISTRICT (e.g., district:IN-KA-BLR)
│   ├── MUNICIPALITY (e.g., municipality:IN-KA-BLR-BBMP)
│   │   ├── DEPARTMENT (e.g., department:IN-KA-BLR-BBMP-WATER)
│   │   ├── DEPARTMENT (e.g., department:IN-KA-BLR-BBMP-ROADS)
│   │   └── ...
│   └── ...
└── ...
```

### Tenant ID Format

All tenant IDs follow the format: `type:CODE`

- **State**: `state:IN-XX` (e.g., `state:IN-KA`)
- **District**: `district:IN-XX-XXX` (e.g., `district:IN-KA-BLR`)
- **Municipality**: `municipality:IN-XX-XXX-XXXX` (e.g., `municipality:IN-KA-BLR-BBMP`)
- **Department**: `department:IN-XX-XXX-XXXX-XXXX` (e.g., `department:IN-KA-BLR-BBMP-WATER`)

### Core Components

1. **`tenantContext.js`** - Tenant validation, hierarchy, authorization
2. **`tenantQueries.js`** - Tenant-scoped query builders
3. **`tenantMigration.js`** - Migration tooling with rollback
4. **Firestore Compound Indexes** - Optimized query performance

## Data Flow

### Write Path

```
Client Request
    │
    ▼
Authentication (Clerk/Token)
    │
    ▼
Tenant Context Resolution
    │
    ▼
Authorization Check (assertTenantAccess)
    │
    ▼
Document Partitioning (partitionDocument)
    │
    ▼
Firestore Write with Tenant Fields
```

### Read Path

```
Client Request
    │
    ▼
Authentication
    │
    ▼
Tenant Context Resolution
    │
    ▼
Query Builder (tenantQuery)
    │
    ▼
Tenant Constraints Applied (buildTenantQueryConstraints)
    │
    ▼
Firestore Query Execution
    │
    ▼
Response Departitioning (departitionDocument)
    │
    ▼
Client Response
```

## Security Boundaries

### Fail-Closed Authorization

All authorization checks **fail closed** - any error or missing context results in access denial.

```javascript
// Example: Every mutation validates tenant ownership
async function updateTenantDocument(context, collection, docId, updates) {
  const doc = await getDoc(docRef);
  const docTenantId = doc.data().tenantId;
  
  // Throws TenantAuthorizationError if not authorized
  assertTenantAccess(context, docTenantId);
  
  // Proceed with update...
}
```

### Authorization Layers

1. **Application Layer** (`serverAuthorizationPolicyService.js`)
   - Role-based access (citizen, operator, reviewer, admin)
   - Object-level ownership (IDOR prevention)
   - Jurisdiction/tenant scoping

2. **Tenant Context Layer** (`tenantContext.js`)
   - Tenant hierarchy validation
   - Cross-tenant access control
   - Admin descendant access

3. **Query Layer** (`tenantQueries.js`)
   - Automatic tenant constraint injection
   - Cursor-based pagination with tenant scoping

4. **Mutation Layer** (`tenantQueries.js`)
   - Pre-write tenant validation
   - Tenant field stripping from updates

## Failure Modes & Degraded Dependencies

| Failure Mode | System Behavior | Recovery / Mitigation |
| --- | --- | --- |
| Missing or invalid `tenantId` / actor context | **Fail closed** (`TENANT_CONTEXT_REQUIRED` / `TENANT_ID_INVALID` / `403 TENANT_ACCESS_DENIED`) | Verify Clerk/token claims; check `resolveTenantContext` |
| Cross-tenant read or mutation attempt | Denied and recorded in `tenantMetrics` (`crossTenantDeniedTotal`) | Investigate actor role/jurisdictions via Runbook |
| Transient Firestore failure (`unavailable`, `deadline-exceeded`) | `withTenantRetry` retries with exponential backoff (deterministic auth/permission errors are never retried) | Alert on `queryErrorRate > 0.1%`; check Firestore status |
| Partial migration batch failure | Checkpointed batches record failed doc IDs and generate a `rollbackPlan` | Resume from checkpoint or execute `rollbackMigration` |
| Unpartitioned legacy records during migration | Blocked when `TENANT_STRICT_MODE=true`; fallback allowed only when `TENANT_STRICT_MODE=false` | Complete `tenantMigration` backfill before enabling strict mode |

## Migration Strategy

### Migration Process

1. **Plan Creation** - Define source/target collections and tenant resolver
2. **Simulation** - Dry-run to validate tenant distribution
3. **Execution** - Batch migration with checkpointing
4. **Validation** - Sample verification of tenant fields
5. **Rollback** - Automatic rollback plan generation

### Rollback Procedure

Every migration automatically generates a rollback plan:

```javascript
const rollbackPlan = {
  migrationId: 'migration-001',
  rollbackId: 'rb-migration-001-1234567890',
  createdDocIds: ['doc1', 'doc2', ...],      // Delete these
  updatedDocs: [{ id: 'doc3', data: {...} }], // Restore these
  deletedDocIds: []                          // Recreate these
};
```

To rollback:
```bash
node -e "
const { rollbackMigration } = require('./src/services/tenantMigration.js');
await rollbackMigration('rb-migration-001-1234567890');
"
```

### Migration Commands

```bash
# Simulate migration (dry run)
node scripts/simulate-migration.js --plan=plan-config.json

# Execute migration
node scripts/execute-migration.js --plan=plan-config.json

# Validate migration
node scripts/validate-migration.js --plan=plan-config.json

# Rollback migration
node scripts/rollback-migration.js --rollback-id=rb-xxx
```

## Deployment Steps

### 1. Deploy Firestore Indexes

```bash
# Deploy compound indexes for tenant-scoped queries
firebase deploy --only firestore:indexes
```

### 2. Deploy Migration Scripts

```bash
# Deploy migration scripts to Cloud Functions or Cloud Run
gcloud functions deploy migrate-tenant-data \
  --source=./scripts/migration \
  --runtime=nodejs20 \
  --trigger=http \
  --allow-unauthenticated
```

### 3. Configure Feature Flags

```bash
# Enable tenant isolation (can be rolled out gradually)
TENANT_ISOLATION_ENABLED=true
TENANT_ISOLATION_ROLLOUT_PERCENT=100
```

### 4. Verify Deployment

```bash
# Run integration tests
npm test -- tests/tenantIsolation.test.js

# Run load tests
npm test -- tests/tenantLoadFailureInjection.test.js

# Smoke test migration
npm run migration:smoke-test
```

## Capacity Assumptions

### Projected Scale

| Entity | Count | Notes |
|--------|-------|-------|
| States/UTs | 36 | Indian states & union territories |
| Districts | ~750 | All districts in India |
| Municipalities | ~4,000 | Urban local bodies |
| Departments | ~20,000 | Department per municipality |
| **Total Tenants** | **~24,786** | |
| Documents per tenant | 1,000 - 100,000 | Varies by collection |
| **Total Documents** | **10M - 1B** | Across all collections |

### Query Performance Targets

| Operation | P50 | P95 | P99 |
|-----------|-----|-----|-----|
| Tenant context creation | <1ms | <5ms | <10ms |
| Tenant access check | <0.1ms | <0.5ms | <1ms |
| Document partitioning | <0.5ms | <1ms | <2ms |
| Cursor encode/decode | <0.1ms | <1ms | <5ms |
| Tenant-scoped query | <50ms | <200ms | <500ms |
| Tenant-scoped mutation | <100ms | <500ms | <1000ms |
| Migration throughput | 100 docs/sec | 500 docs/sec | 1000 docs/sec |

### Firestore Limits

- `'in'` query: **10 values** max (chunk assigned jurisdictions)
- Composite query: **30 constraints** max
- Batch write: **500 operations** max
- Document size: **1 MiB** max
- Cursor size: **< 2 KB** recommended for headers

## Alert Thresholds

### Critical Alerts (Page Immediately)

| Metric | Threshold | Duration |
|--------|-----------|----------|
| Cross-tenant access denials | > 100/min | 5 min |
| Tenant authorization errors | > 50/min | 5 min |
| Migration failure rate | > 5% | 10 min |
| Query latency P99 | > 2s | 5 min |
| Mutation latency P99 | > 5s | 5 min |

### Warning Alerts (Notify On-Call)

| Metric | Threshold | Duration |
|--------|-----------|----------|
| Cross-tenant access denials | > 10/min | 15 min |
| Tenant context creation errors | > 1/min | 5 min |
| Migration progress stall | 0 docs/10min | 10 min |
| Query latency P95 | > 500ms | 15 min |
| Mutation latency P95 | > 1s | 15 min |
| Firestore quota usage | > 80% | 1 hour |

### Dashboard Panels

1. **Tenant Access Heatmap** - Cross-tenant access attempts by source/target tenant
2. **Authorization Latency** - P50/P95/P99 for each auth layer
3. **Migration Progress** - Documents processed, success/fail rates
4. **Query Performance** - Latency by collection and tenant type
5. **Error Budget** - SLO compliance over rolling windows

## Rollback Instructions

### Application Rollback

```bash
# Revert to previous deployment
gcloud run services update civic-help-setu-api \
  --image=gcr.io/PROJECT/civic-help-setu-api:PREVIOUS_VERSION \
  --region=asia-south1

# Or for Cloud Functions
gcloud functions deploy civic-help-setu-api \
  --source=./previous-deployment \
  --runtime=nodejs20
```

### Firestore Index Rollback

```bash
# Remove problematic indexes
firebase firestore:indexes delete INDEX_ID

# Or deploy previous index configuration
git checkout HEAD~1 -- firebase/firestore.indexes.json
firebase deploy --only firestore:indexes
```

### Data Rollback (Migration)

```bash
# 1. Identify rollback ID from migration logs
# 2. Execute rollback
node scripts/rollback-migration.js --rollback-id=rb-migration-001-1234567890

# 3. Verify rollback
node scripts/validate-migration.js --plan=plan-config.json --check-rollback
```

### Emergency Tenant Isolation Disable

```bash
# Feature flag to disable tenant isolation (emergency only)
TENANT_ISOLATION_ENABLED=false

# Requires redeploy or config update
# WARNING: This disables ALL tenant boundary enforcement
```

## Operational Runbooks

### Runbook: Cross-Tenant Access Spike

**Symptoms**: Alert on "Cross-tenant access denials > 100/min"

**Diagnosis**:
1. Check dashboard for top source/target tenant pairs
2. Review application logs for tenant context resolution failures
3. Check for misconfigured jurisdiction assignments in Clerk

**Resolution**:
1. If misconfiguration: Fix jurisdiction assignments in Clerk dashboard
2. If bug: Deploy fix with updated tenant resolver
3. If attack: Block offending IP/client at WAF level

### Runbook: Migration Stalled

**Symptoms**: Migration progress shows 0 documents processed for 10+ minutes

**Diagnosis**:
1. Check Cloud Function logs for errors
2. Verify Firestore quota not exhausted
3. Check for deadlock in batch commits

**Resolution**:
1. If quota: Request quota increase or pause migration
2. If deadlock: Reduce batch size, resume from checkpoint
3. If error: Fix root cause, resume from checkpoint

### Runbook: Query Latency Degradation

**Symptoms**: P99 query latency > 2s for tenant-scoped queries

**Diagnosis**:
1. Check Firestore index usage in console
2. Verify compound indexes are deployed and serving
3. Check for missing indexes causing collection scans

**Resolution**:
1. Deploy missing indexes
2. Optimize query constraints (reduce 'in' values)
3. Consider read replicas for high-read tenants

### Runbook: Tenant Context Resolution Failure

**Symptoms**: High rate of "Invalid tenant context" errors

**Diagnosis**:
1. Check authentication token format
2. Verify Clerk publicMetadata includes jurisdictionIds
3. Check for clock skew in token validation

**Resolution**:
1. Fix token parsing in middleware
2. Update Clerk metadata for affected users
3. Add fallback for legacy token formats

## Testing

### Unit Tests

```bash
npm test -- src/services/tenantContext.test.js
npm test -- src/services/tenantQueries.test.js
npm test -- src/services/tenantMigration.test.js
```

### Integration Tests

```bash
npm test -- tests/tenantIsolation.test.js
```

### Load & Failure Injection Tests

```bash
npm test -- tests/tenantLoadFailureInjection.test.js
```

### Cross-Tenant Access Tests (All Layers)

The integration test suite covers:
- Authorization layer (serverAuthorizationPolicyService)
- Tenant context layer (tenantContext)
- Query layer (tenantQueries)
- Mutation layer (tenantQueries)
- Migration layer (tenantMigration)

Run full suite:
```bash
npm test
```

## Configuration Reference

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TENANT_ISOLATION_ENABLED` | `true` | Enable/disable tenant isolation |
| `TENANT_ISOLATION_ROLLOUT_PERCENT` | `100` | Gradual rollout percentage |
| `TENANT_DEFAULT_TYPE` | `municipality` | Default tenant type for auto-resolution |
| `TENANT_MAX_ASSIGNED_JURISDICTIONS` | `100` | Max assigned jurisdictions per actor |
| `MIGRATION_BATCH_SIZE` | `500` | Documents per migration batch |
| `MIGRATION_CHECKPOINT_INTERVAL` | `100` | Documents between checkpoints |

### Feature Flags

```javascript
// Feature flag configuration
const tenantIsolationConfig = {
  enabled: process.env.TENANT_ISOLATION_ENABLED !== 'false',
  rolloutPercent: parseInt(process.env.TENANT_ISOLATION_ROLLOUT_PERCENT || '100', 10),
  strictMode: true, // Fail closed on any error
  allowCrossTenantRead: false, // Admin-only cross-tenant reads
  auditAllAccess: true, // Log all authorization decisions
};
```

## API Reference

### Tenant Context

```javascript
import { createTenantContext, checkTenantAccess, assertTenantAccess } from './services/tenantContext.js';

const context = createTenantContext({
  tenantId: 'municipality:IN-KA-BLR-BBMP',
  actorId: 'user-123',
  assignedJurisdictions: ['municipality:IN-KA-BLR-BBMP'],
  role: 'operator',
});

const access = checkTenantAccess(context, 'municipality:IN-KA-BLR-BBMP');
// { allowed: true, reason: 'SAME_TENANT', code: 'AUTHORIZED' }

assertTenantAccess(context, 'municipality:IN-KA-MYS-MCC'); // Throws if denied
```

### Tenant Queries

```javascript
import { tenantQuery, queryPendingTasks } from './services/tenantQueries.js';

const builder = tenantQuery(context, 'facilities')
  .where('status', '==', 'active')
  .orderBy('-createdAt')
  .pageSize(25);

const result = await builder.execute();
// { items: [...], nextCursor: '...', totalCount: 100, hasMore: true }
```

### Migration

```javascript
import { createMigrationPlan, executeMigration, simulateMigration } from './services/tenantMigration.js';

const plan = createMigrationPlan({
  id: 'migrate-001',
  name: 'Partition Facilities',
  sourceCollection: 'facilities',
  targetCollection: 'facilities_partitioned',
  tenantResolver: (doc) => `municipality:${doc.jurisdictionId}`,
  batchSize: 500,
});

const simulation = await simulateMigration(plan);
// { sampled: 100, tenantDistribution: {...}, errors: [] }

const progress = await executeMigration(plan, {
  onProgress: (p) => console.log(`${p.processedDocuments}/${p.totalDocuments}`),
});
```

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| `TENANT_MISMATCH` on valid access | Actor missing jurisdiction assignment | Add jurisdiction to Clerk publicMetadata |
| `INVALID_TENANT_ID` on create | Malformed tenant ID in resolver | Validate resolver output format |
| Query returns no results | Missing compound index | Deploy tenant compound indexes |
| Migration fails with permission denied | Service account lacks Firestore write | Grant `datastore.documents.create` |
| Cursor decode fails | Cursor from different query shape | Ensure consistent orderBy fields |

### Debug Commands

```bash
# Check tenant context for user
node -e "
const { createTenantContext } = require('./src/services/tenantContext.js');
const ctx = createTenantContext({ tenantId: 'municipality:IN-KA-BLR-BBMP', role: 'operator' });
console.log(JSON.stringify(ctx, null, 2));
"

# Verify Firestore indexes
firebase firestore:indexes list

# Test tenant resolver
node -e "
const { createJurisdictionTenantResolver } = require('./src/services/tenantMigration.js');
const resolver = createJurisdictionTenantResolver();
console.log(resolver({ jurisdictionId: 'IN-KA-BLR-BBMP' }));
"
```

## Future Enhancements

1. **Tenant Registry Service** - Centralized tenant metadata management
2. **Dynamic Tenant Provisioning** - Auto-create tenant configs on first write
3. **Cross-Tenant Analytics** - Privacy-preserving aggregate queries
4. **Tenant-Level Quotas** - Configurable per-tenant rate limits
5. **Geospatial Tenant Resolution** - PostGIS-based boundary detection
6. **Audit Log Streaming** - Real-time authorization decision streaming

## References

- [Firestore Index Limits](https://firebase.google.com/docs/firestore/query-data/indexing)
- [Clerk Organization Metadata](https://clerk.com/docs/organizations/metadata)
- [Multi-Tenancy Patterns](https://cloud.google.com/architecture/multi-tenancy)
- [Authorization Best Practices](https://owasp.org/www-project-authorization-cheat-sheet)