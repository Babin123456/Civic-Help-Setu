# Distributed Cache Coherence and Stampede-Protection Layer

## Overview

The Distributed Cache Layer provides a production-ready caching solution for service catalogues and public reference data with the following features:

- **Cache Key Design** - Structured keys with namespace, resource path, and identity isolation
- **TTL Jitter** - Prevents thundering herd by adding ±15% randomness to TTL
- **Request Coalescing** - Single-flight pattern prevents stampede on hot keys
- **Stale-While-Revalidate** - Serves stale content while asynchronously revalidating
- **Bounded Negative Caching** - Caches cache misses for 30 seconds (configurable)
- **Distributed Invalidation** - Event-driven invalidation via Firestore-backed outbox
- **Identity Isolation** - Sensitive/user-specific responses never shared across identities
- **Feature Flag Integration** - Safe rollout with kill switches and gradual rollout

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      API Request                                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Cache Middleware                               │
│  - Extracts identity context (userId, tenantId, jurisdiction)  │
│  - Attaches cache helpers to request object                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Cache Engine                                 │
│  1. Check cache (with TTL jitter)                              │
│  2. If fresh → return CACHE_HIT                                │
│  3. If stale → return STALE_HIT + trigger async revalidation  │
│  4. If miss/expired → coalesce + fetch from origin            │
│  5. Store result with computed expirations                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                    ┌──────┴──────┐
                    ▼             ▼
            ┌───────────┐  ┌─────────────┐
            │  Memory   │  │  Firestore  │
            │  Storage  │  │  Storage    │
            │ (dev/test)│  │ (production)│
            └───────────┘  └─────────────┘
                    ▲             ▲
                    │             │
                    ▼             ▼
            ┌─────────────────────────────┐
            │   Invalidation Outbox       │
            │  (Firestore collection)     │
            │  - key_invalidated          │
            │  - namespace_invalidated    │
            │  - pattern_invalidated      │
            │  - full_flush               │
            └─────────────────────────────┘
                    │
                    ▼
            ┌─────────────────────────────┐
            │   Subscriber (per instance) │
            │  - Polls outbox every 5s    │
            │  - Applies invalidations    │
            │  - Skips own events         │
            └─────────────────────────────┘
```

## Cache Key Design

Keys follow the format: `{namespace}:{resourcePath}[#{identityHash}]`

### Namespaces
| Namespace | Prefix | Use Case |
|-----------|--------|----------|
| Service Catalogue | `svc_cat` | Individual services, filtered lists |
| Public Reference | `pub_ref` | Jurisdictions, categories, glossary |
| Jurisdictions | `jurisdictions` | Administrative boundaries |
| Service Categories | `svc_cats` | Category metadata |
| Office Directory | `office_dir` | Office listings with filters |
| Welfare Schemes | `welfare` | Scheme information |
| Transit Concessions | `transit` | Transport concessions |
| Civic Glossary | `glossary` | Term definitions |

### Identity Isolation
- **User-specific data**: Includes `userId` hash (e.g., `svc_cat:services/driving-license#a1b2c3d4`)
- **Tenant-specific data**: Includes `tenantId` hash
- **Jurisdiction-specific data**: Includes `jurisdictionCode` hash
- **Anonymous sessions**: Includes `sessionId` hash (only when no userId)
- **Public reference data**: No identity hash by default (`enforceIsolation: false`)

### Key Builders
```javascript
// Service catalogue entry
buildServiceCatalogueKey('driving-license', { userId: 'user123' })
// → "svc_cat:services/driving-license#a1b2c3d4e5f67890"

// Service list with filters
buildServiceCatalogueListKey({ category: 'transport', state: 'KA' }, { userId: 'user123' })
// → "svc_cat:services?category=transport&state=KA#a1b2c3d4e5f67890"

// Public reference (no isolation)
buildPublicReferenceKey('jurisdictions', 'all')
// → "pub_ref:jurisdictions/all"

// Jurisdictions
buildJurisdictionKey('state')
// → "jurisdictions:scope/state"

// Office directory
buildOfficeDirectoryKey({ district: 'Bangalore' }, { userId: 'user123' })
// → "office_dir:offices?district=bangalore#a1b2c3d4e5f67890"
```

## Configuration

### Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `DISTRIBUTED_CACHE_ENABLED` | `true` | Master enable switch |
| `DISTRIBUTED_CACHE_ROLLOUT_PERCENT` | `100` | Rollout percentage (0-100) |
| `DISTRIBUTED_CACHE_STORAGE` | `auto` | `memory`, `firestore`, or `auto` |
| `DISTRIBUTED_CACHE_DEFAULT_TTL_MS` | `300000` | Default TTL (5 min) |
| `DISTRIBUTED_CACHE_MAX_TTL_MS` | `3600000` | Max TTL (1 hour) |
| `DISTRIBUTED_CACHE_MIN_TTL_MS` | `1000` | Min TTL (1 sec) |
| `DISTRIBUTED_CACHE_TTL_JITTER_PCT` | `0.15` | TTL jitter ±15% |
| `DISTRIBUTED_CACHE_SWR_MS` | `60000` | Stale-while-revalidate window (1 min) |
| `DISTRIBUTED_CACHE_NEGATIVE_TTL_MS` | `30000` | Negative cache TTL (30 sec) |
| `DISTRIBUTED_CACHE_MAX_NEGATIVE_TTL_MS` | `120000` | Max negative TTL (2 min) |
| `DISTRIBUTED_CACHE_COALESCE_TIMEOUT_MS` | `5000` | Coalesce timeout (5 sec) |
| `DISTRIBUTED_CACHE_MAX_KEYS` | `10000` | Max cache entries |
| `DISTRIBUTED_CACHE_MAX_ENTRY_SIZE_BYTES` | `1048576` | Max entry size (1 MB) |
| `DISTRIBUTED_CACHE_ENFORCE_IDENTITY_ISOLATION` | `true` | Enable identity isolation |
| `DISTRIBUTED_CACHE_FIRESTORE_COLLECTION` | `distributed_cache_entries` | Firestore collection |
| `DISTRIBUTED_CACHE_FIRESTORE_INVALIDATION_COLLECTION` | `cache_invalidation_events` | Invalidation outbox collection |

### Feature Flags
| Flag | Default | Rollout | Description |
|------|---------|---------|-------------|
| `civic.cache.distributed` | `false` | 0% | Master distributed cache enable |
| `civic.cache.invalidation` | `false` | 0% | Distributed invalidation |
| `civic.cache.coalescing` | `true` | 100% | Request coalescing |
| `civic.cache.stale_while_revalidate` | `true` | 100% | Stale-while-revalidate |
| `civic.cache.negative_caching` | `true` | 100% | Negative caching |
| `civic.cache.identity_isolation` | `true` | 100% | Identity isolation |

## Usage

### Service Cache (Recommended Entry Point)
```javascript
import { createServiceCache } from 'src/services/distributedCache/index.js';

const cache = createServiceCache({
  config: { DEFAULT_TTL_MS: 300000 },
  // db: firestoreDb, // Optional for distributed storage
  // outbox: eventOutbox, // Optional for distributed invalidation
});

// Get a service with automatic caching
const result = await cache.getService('driving-license', async (id) => {
  return await fetchServiceFromDatabase(id);
}, { userId: 'user123' });

// result.value - the service data
// result.origin - 'origin' | 'cache_hit' | 'stale_hit' | 'negative_hit' | 'coalesced'
// result.freshness - 'fresh' | 'stale' | 'negative' | 'miss' | 'error'
// result.entry - cache entry metadata
```

### Service List with Filters
```javascript
const result = await cache.getServiceList(
  { category: 'transport', state: 'KA' },
  async (filters) => await fetchServices(filters),
  { userId: 'user123' }
);
```

### Public Reference Data
```javascript
const result = await cache.getPublicReference(
  'jurisdictions',
  'all',
  async (type, id) => await fetchReference(type, id)
);
// No identity isolation by default
```

### Invalidation
```javascript
// Invalidate a specific service
await cache.invalidateService('driving-license');

// Invalidate entire service catalogue
await cache.invalidateServiceCatalogue();

// Invalidate public reference type
await cache.invalidatePublicReferenceType('jurisdictions');
```

### Middleware Integration
```javascript
import { createCacheMiddleware } from 'src/services/distributedCache/index.js';

const cache = createServiceCache({ ... });
const middleware = createCacheMiddleware(cache);

app.use(middleware);

// In handlers:
app.get('/api/services/:id', async (req, res) => {
  const result = await req.cache.getService(req.params.id, fetcher);
  res.json({ success: true, data: result.value });
});
```

### withCache Wrapper
```javascript
import { withCache } from 'src/services/distributedCache/index.js';

const cachedFetcher = withCache(
  cache,
  (id) => `custom:${id}`,  // key builder
  async (id) => await fetchData(id)  // fetcher
);

const result = await cachedFetcher('item1');
```

## Invalidation

### Event Types
| Type | Payload | Description |
|------|---------|-------------|
| `cache.key_invalidated` | `{ key }` | Single key invalidation |
| `cache.namespace_invalidated` | `{ namespace }` | Entire namespace |
| `cache.pattern_invalidated` | `{ pattern }` | Prefix pattern (e.g., `svc_cat:services/*`) |
| `cache.full_flush` | `{}` | Complete cache clear |

### Publishing Invalidation
```javascript
// Via publisher (from cache system)
await cache.publisher.invalidateService('driving-license');
await cache.publisher.invalidateServiceCatalogue();
await cache.publisher.invalidatePublicReference('jurisdictions', 'all');
await cache.publisher.invalidatePublicReferenceType('jurisdictions');
await cache.publisher.invalidatePattern('svc_cat:services/transport*');
await cache.publisher.flushAll(); // Use with caution!
```

### Management API
```
GET  /api/cache/status       - Cache health and metrics
GET  /api/cache/metrics      - Prometheus-formatted metrics
POST /api/cache/invalidate   - Invalidate keys/patterns (admin)
POST /api/cache/flush        - Flush entire cache (admin)
POST /api/cache/metrics/reset - Reset metrics (admin)
```

#### Invalidate Request
```json
POST /api/cache/invalidate
{
  "keys": ["svc_cat:services/driving-license#abc123"],
  "patterns": ["svc_cat:services/transport*"],
  "namespaces": ["svc_cat"],
  "serviceIds": ["driving-license"],
  "referenceTypes": ["jurisdictions"]
}
```

#### Flush Request
```json
POST /api/cache/flush
{
  "confirm": "FLUSH_ALL_CACHE"
}
```

## Metrics

### Available Metrics
| Metric | Type | Description |
|--------|------|-------------|
| `cache_hits_total` | Counter | Fresh cache hits |
| `cache_misses_total` | Counter | Cache misses |
| `cache_stale_hits_total` | Counter | Stale-while-revalidate hits |
| `cache_negative_hits_total` | Counter | Negative cache hits |
| `cache_coalesced_hits_total` | Counter | Coalesced request hits |
| `cache_origin_fetches_total` | Counter | Origin fetches |
| `cache_errors_total` | Counter | Cache errors |
| `cache_sets_total` | Counter | Cache sets |
| `cache_deletes_total` | Counter | Cache deletes |
| `cache_invalidations_total` | Counter | Invalidations |
| `cache_hit_rate` | Gauge | Hit rate (0-1) |
| `cache_in_flight_requests` | Gauge | In-flight coalesced requests |

### Prometheus Format
```
GET /api/cache/metrics
```

## Deployment

### Prerequisites
1. Firestore enabled (for distributed storage and invalidation)
2. Feature flags configured
3. Environment variables set

### Rollout Strategy
1. **Phase 1**: Enable `civic.cache.coalescing`, `civic.cache.stale_while_revalidate`, `civic.cache.negative_caching` at 100%
2. **Phase 2**: Enable `civic.cache.distributed` at 10% rollout, monitor metrics
3. **Phase 3**: Enable `civic.cache.invalidation` at 10% rollout
4. **Phase 4**: Gradually increase rollout to 100%
5. **Phase 5**: Enable `civic.cache.identity_isolation` at 100%

### Capacity Planning
- **Memory storage**: ~10,000 entries × 1 MB = ~10 GB max
- **Firestore**: Scales automatically, monitor read/write costs
- **Invalidation outbox**: ~1,000 events/day typical, 24-hour TTL

### Monitoring Alerts
| Alert | Threshold | Severity |
|-------|-----------|----------|
| Cache hit rate < 50% | 5 min avg | Warning |
| Origin fetch rate > 100/sec | 1 min avg | Warning |
| Invalidation lag > 30 sec | 5 min avg | Warning |
| Cache errors > 1% | 5 min avg | Critical |
| In-flight requests > 500 | Current | Warning |

## Failure Modes

### Cache Unavailable
- Falls back to origin fetch
- Logs error, continues serving requests
- Metrics track cache errors

### Invalidation Delay
- Event outbox provides at-least-once delivery
- Subscriber polls every 5s
- Stale-while-revalidate masks brief inconsistency

### Storage Full
- LRU eviction in memory storage
- Firestore has no practical limit
- Metrics track evictions

### Network Partition
- In-memory storage continues serving local requests
- Firestore operations fail gracefully
- Invalidation events queued in outbox

## Rollback Procedure

1. **Immediate**: Set `civic.cache.distributed` kill switch to `true`
2. **Verify**: Origin traffic returns to baseline
3. **Cleanup**: Flush cache via `/api/cache/flush` if needed
4. **Postmortem**: Review metrics and logs

## Security Boundaries

### Identity Isolation
- Cache keys automatically include identity context hash
- User-specific data never shared across users
- Tenant data isolated per tenant
- Jurisdiction data isolated per jurisdiction
- Public reference data shared globally (no isolation)

### Authorization
- Cache management endpoints require admin role
- Feature flags control rollout per user/tenant/jurisdiction
- Kill switches for emergency disable

### Data Classification
| Data Type | Cached | Isolation |
|-----------|--------|-----------|
| Service catalogue | Yes | Per-user |
| Service lists | Yes | Per-user + filters |
| Public reference | Yes | None (global) |
| Jurisdictions | Yes | None (global) |
| Office directory | Yes | Per-user |
| User PII | No | N/A |
| Auth tokens | No | N/A |

## Testing

### Unit Tests
```bash
npm test -- src/services/distributedCache/__tests__/
```

### Load Testing
```bash
# Simulate hot-key burst
for i in {1..1000}; do
  curl -s "http://localhost:3000/api/services/driving-license" &
done
wait

# Expected: 1 origin fetch, 999 coalesced/cache hits
```

### Failure Injection
```bash
# Disable Firestore
DISTRIBUTED_CACHE_STORAGE=memory

# Simulate slow origin
# Add delay in fetcher function
```

## File Structure

```
src/services/distributedCache/
├── index.js              # Main entry point, exports
├── types.js              # Types, constants, validation
├── cacheKey.js           # Key building, parsing, identity
├── storage.js            # Storage adapters (memory, Firestore, auto)
├── cacheEngine.js        # Core engine (TTL jitter, coalescing, SWR, negative)
├── invalidation.js       # Invalidation publisher/subscriber/outbox
└── __tests__/
    ├── types.test.js
    ├── cacheKey.test.js
    ├── storage.test.js
    ├── cacheEngine.test.js
    ├── invalidation.test.js
    └── integration.test.js

api/_lib/
├── cacheMiddleware.js    # API middleware, management handler
└── handlers/
    └── cache-management.js  # Cache management API endpoint
```

## Future Enhancements

1. **Redis Support** - Add Redis storage adapter for lower latency
2. **Cache Warming** - Pre-populate cache on deploy
3. **Adaptive TTL** - Adjust TTL based on access patterns
4. **Compression** - Compress large cache entries
5. **Tiered Cache** - L1 (memory) + L2 (Firestore) hierarchy
6. **Cache Analytics** - Dashboard for cache efficiency per key pattern