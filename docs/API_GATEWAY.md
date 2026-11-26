# Versioned Public API Gateway

> **Feature**: #1236 - Versioned Public API Gateway with Consumer Quotas and Deprecation  
> **Status**: Implemented  
> **Last Updated**: 2026-11-25

## Overview

The Civic Help Setu API Gateway provides a governed entry point for all public and partner APIs with:

- **Version Negotiation**: Multiple version detection strategies (URL path, headers, query params)
- **Consumer Quotas**: Per-client tiered rate limits with NAT protection
- **Request Validation**: OpenAPI 3.1 contract-based validation
- **Deprecation Management**: RFC 8594 Sunset headers, migration guides
- **Compatibility Reporting**: Version matrices, breaking change analysis, upgrade advisories

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      API Gateway Middleware                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Version     │  │  Consumer    │  │  Request     │          │
│  │  Negotiation │──│  Registry    │──│  Validation  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Deprecation │  │  Quota       │  │  Observability│         │
│  │  Manager     │──│  Enforcement │──│  & Headers   │         │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Mesh Readiness Layer                         │
│  (Service Identity, Trace Context, Resilience, Circuit Breaker) │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Route Handlers                             │
│  (Business Logic, Data Access, External Integrations)          │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Version Negotiation (`api/_lib/versioning/negotiator.js`)

**Detection Priority** (highest to lowest):
1. **URL Path**: `/api/v1/services` or `/v1/services`
2. **Custom Header**: `Accept-Version: v1`, `API-Version: v1`, `X-API-Version: v1`
3. **Accept Header**: `application/vnd.civic.v1+json` or `application/json; version=v1`
4. **Query Parameter**: `?version=v1`, `?api_version=v1`, `?api-version=v1`
5. **Default**: `v2` (configurable via `GATEWAY_DEFAULT_VERSION`)

**Response Headers**:
```
API-Version: v1
X-API-Version: v1
X-API-Version-Source: custom_header
X-API-Supported-Versions: v1, v2
```

### 2. OpenAPI Contract Registry & Publishing (`api/_lib/versioning/contractRegistry.js`)

Stores and serves OpenAPI 3.1 specifications per version.

**Published Endpoints**:
- `GET /api/openapi`: Publishes active default (v2) OpenAPI contract
- `GET /api/openapi?version=v1`: Publishes version 1 OpenAPI contract
- `GET /api/openapi/v1` and `GET /api/openapi/v2`: Path-based contract discovery
- Supports conditional caching with `ETag` and `If-None-Match` (304 Not Modified)

**Features**:
- In-memory caching with TTL (default 5 minutes)
- Bundled static specs in `api/_lib/versioning/specs/`
- Loader registration for dynamic contract loading
- Fallback contracts for resilience
- ETag support for conditional requests
- Preloading for warm starts

**Configuration**:
```bash
GATEWAY_VALIDATION_CACHE_TTL_MS=300000  # 5 minutes
```

### 3. Request Validator (`api/_lib/validation/requestValidator.js`)

Validates requests against versioned OpenAPI contracts.

**Validated Components**:
- Path parameters (with format validation: uuid, date-time, email, uri)
- Query parameters (type, range, enum, pattern)
- Headers (type, pattern)
- Request body (JSON Schema subset: type, required, properties, additionalProperties, arrays)

**Error Response** (422 Validation Failed):
```json
{
  "error": "validation_failed",
  "code": "VALIDATION_FAILED",
  "message": "Some submitted fields need correction.",
  "retryable": false,
  "recoveryAction": "edit_request",
  "details": [
    { "field": "query.limit", "message": "Must be <= 100", "code": "MAXIMUM" },
    { "field": "body.name", "message": "Required property is missing", "code": "REQUIRED_PROPERTY" }
  ]
}
```

### 4. Consumer Registry (`api/_lib/gateway/consumerRegistry.js`)

Manages API consumers with tiered quotas.

**Tier Definitions**:
| Tier | RPM | RPH | RPD | Burst (10s) | Use Case |
|------|-----|-----|-----|-------------|----------|
| anonymous | 10 | 100 | 500 | 5 | Unauthenticated public access |
| free | 60 | 1,000 | 10,000 | 20 | Registered developers |
| partner | 600 | 10,000 | 100,000 | 100 | Official partners |
| premium | 6,000 | 100,000 | 1,000,000 | 500 | High-volume customers |
| internal | 60,000 | 1,000,000 | 10,000,000 | 5,000 | Internal services |

**Authentication Methods**:
- API Key: `X-API-Key` header or `?api_key=` query param
- Bearer Token: `Authorization: Bearer <token>`
- mTLS: `X-Forwarded-Client-Cert` header

**Quota Headers**:
```
X-RateLimit-Consumer: consumer_abc123
X-RateLimit-Tier: partner
X-RateLimit-Remaining-Burst: 95
X-RateLimit-Remaining-Minute: 587
X-RateLimit-Remaining-Hour: 9876
X-RateLimit-Remaining-Day: 98765
Retry-After: 45  (when limit exceeded)
```

### 5. Deprecation Manager (`api/_lib/gateway/deprecationManager.js`)

Implements RFC 8594 Sunset header and deprecation best practices.

**Deprecation Stages**:
1. **Active**: Normal operation
2. **Deprecated**: Warning headers sent, migration guide linked
3. **Sunset**: 410 Gone returned, migration required
4. **Removed**: No longer accessible

**Headers for Deprecated Version**:
```
Deprecation: true
Sunset: Sat, 25 May 2027 00:00:00 GMT
X-API-Deprecated: true
X-API-Deprecation-Stage: deprecated
X-API-Warning-Date: 2027-02-24T00:00:00.000Z
X-API-Sunset-Date: 2027-05-25T00:00:00.000Z
Link: <https://docs.example.com/migration/v1-to-v2>; rel="migration-guide"
Link: <https://api.example.com/api/v2>; rel="successor-version"
Link: <https://api.example.com/api/v2>; rel="latest-version"
```

**Sunset Response** (410 Gone):
```json
{
  "error": "version_sunset",
  "code": "VERSION_SUNSET",
  "message": "API version v1 has been sunset and is no longer available.",
  "deprecatedSince": "2027-02-24T00:00:00.000Z",
  "sunsetDate": "2027-05-25T00:00:00.000Z",
  "migrationGuide": "https://docs.example.com/migration/v1-to-v2",
  "recommendedVersion": "v2",
  "supportedVersions": ["v2"]
}
```

### 6. Compatibility Reporter (`api/_lib/gateway/compatibilityReporter.js`)

Generates compatibility matrices and migration guides.

**Compatibility Levels**:
- `full`: No changes needed
- `backwards_compatible`: Client works without changes
- `forwards_compatible`: Server accepts old client format
- `breaking`: Migration required
- `incompatible`: Cannot work together

**Migration Guide** (v1 → v2):
1. Update base URL to `/api/v2/` or add `Accept-Version: v2` header
2. Adapt to RFC 7807 Problem Details error format
3. Change field names to camelCase (`service_id` → `serviceId`)
4. Migrate to cursor-based pagination
5. Add Bearer token authentication for mutating endpoints

### 7. Gateway Middleware (`api/_lib/gateway/gatewayMiddleware.js`)

Unified middleware combining all gateway features.

**Feature Flags**:
```bash
GATEWAY_ENABLED=true
GATEWAY_FEATURE_VERSIONING=true
GATEWAY_FEATURE_QUOTAS=true
GATEWAY_FEATURE_VALIDATION=true
GATEWAY_FEATURE_DEPRECATION=true
```

**Skip Paths**: `/health`, `/ready`, `/metrics`, `/mesh-readiness`

## Configuration

### Environment Variables

```bash
# Gateway Core
GATEWAY_ENABLED=true
GATEWAY_DEFAULT_VERSION=v2
GATEWAY_SUPPORTED_VERSIONS=v1,v2
GATEWAY_VERSION_HEADER_NAME=Accept-Version

# Consumer Quotas (override tier defaults)
GATEWAY_QUOTA_TIER_FREE_RPM=60
GATEWAY_QUOTA_TIER_PARTNER_RPM=600
GATEWAY_QUOTA_TIER_PREMIUM_RPM=6000
GATEWAY_QUOTA_TIER_INTERNAL_RPM=60000

# Deprecation
GATEWAY_DEPRECATION_WARN_DAYS=90
GATEWAY_SUNSET_HEADER_FORMAT=date

# Validation
GATEWAY_VALIDATION_STRICT=true
GATEWAY_VALIDATION_CACHE_TTL_MS=300000

# Feature Flags
GATEWAY_FEATURE_VERSIONING=true
GATEWAY_FEATURE_QUOTAS=true
GATEWAY_FEATURE_VALIDATION=true
GATEWAY_FEATURE_DEPRECATION=true

# Consumer Registry Secret
GATEWAY_CONSUMER_SECRET=your-secret-key-here
```

### Registering Consumers

```javascript
import { getDefaultConsumerRegistry, CONSUMER_TIERS } from './api/_lib/gateway/consumerRegistry.js';

const registry = getDefaultConsumerRegistry();

await registry.registerConsumer({
  id: 'partner-acme-corp',
  name: 'ACME Corporation',
  tier: CONSUMER_TIERS.PARTNER,
  authMethod: 'api_key',
  credentials: { apiKey: 'sk_live_abc123...' },
  metadata: { contact: 'api@acme.com', contractId: 'CTR-2026-001' },
});
```

### Loading OpenAPI Contracts

```javascript
import { getDefaultRegistry } from './api/_lib/versioning/contractRegistry.js';

const registry = getDefaultRegistry();

// Register a loader (e.g., from filesystem or CMS)
registry.registerLoader('v2', async (version) => {
  const spec = await loadOpenAPISpecFromStorage(version);
  return { spec, etag: computeEtag(spec) };
});

// Or embed directly for testing
import { createRegistryWithEmbeddedContracts } from './api/_lib/versioning/contractRegistry.js';
const testRegistry = createRegistryWithEmbeddedContracts({
  v1: require('./openapi/v1.json'),
  v2: require('./openapi/v2.json'),
});
```

## Client Usage Guide

### Version Selection

```bash
# Via URL path (recommended for caching)
curl https://api.example.com/api/v2/services

# Via header
curl -H "Accept-Version: v2" https://api.example.com/api/services

# Via Accept header (standard)
curl -H "Accept: application/vnd.civic.v2+json" https://api.example.com/api/services

# Via query param (fallback)
curl "https://api.example.com/api/services?version=v2"
```

### Authentication

```bash
# API Key
curl -H "X-API-Key: sk_live_abc123..." https://api.example.com/api/v2/services

# Bearer Token
curl -H "Authorization: Bearer eyJhbGciOi..." https://api.example.com/api/v2/services
```

### Handling Responses

```javascript
// Check version headers
const version = response.headers.get('API-Version');
const deprecated = response.headers.get('Deprecation') === 'true';
const sunset = response.headers.get('Sunset');

// Handle quota
const remaining = response.headers.get('X-RateLimit-Remaining-Minute');
const retryAfter = response.headers.get('Retry-After');

if (response.status === 429) {
  // Wait retryAfter seconds before retrying
  await sleep(retryAfter * 1000);
}

// Handle deprecation
if (deprecated) {
  const migrationGuide = response.headers.get('Link')
    .match(/<([^>]+)>; rel="migration-guide"/)[1];
  console.warn(`API version ${version} is deprecated. Migrate using: ${migrationGuide}`);
}

// Handle validation errors
if (response.status === 422) {
  const { details } = await response.json();
  for (const error of details) {
    console.error(`Field ${error.field}: ${error.message}`);
  }
}
```

## Operational Runbooks

### Health Checks

```bash
# Gateway health
curl https://api.example.com/api/gateway-health

# Mesh readiness (includes gateway status)
curl https://api.example.com/api/mesh-readiness
```

**Expected Response**:
```json
{
  "status": "healthy",
  "gatewayEnabled": true,
  "features": {
    "versioning": true,
    "quotas": true,
    "validation": true,
    "deprecation": true
  },
  "supportedVersions": [...],
  "defaultVersion": "v2",
  "timestamp": "2026-11-25T12:00:00.000Z"
}
```

### Monitoring Alerts

| Metric | Warning Threshold | Critical Threshold | Action |
|--------|-------------------|-------------------|--------|
| Gateway latency (p99) | > 50ms | > 100ms | Check middleware performance |
| Quota rejection rate | > 5% | > 20% | Review tier limits, check for abuse |
| Validation error rate | > 1% | > 5% | Check client SDK versions |
| Deprecated version usage | > 10% of traffic | > 50% of traffic | Accelerate migration comms |
| Consumer registry size | > 10,000 | > 50,000 | Clean up inactive consumers |

### Consumer Management

**View Consumer Quotas**:
```bash
curl -H "X-API-Key: admin-key" https://api.example.com/api/consumers/consumer_abc123/quotas
```

**Adjust Consumer Tier**:
```javascript
await registry.updateConsumer('consumer_abc123', { tier: CONSUMER_TIERS.PREMIUM });
```

**Blocklist Abusive Consumer**:
```javascript
await registry.setConsumerStatus('consumer_abc123', 'blocked');
```

### Deprecation Timeline Management

**Check Version Status**:
```bash
curl https://api.example.com/api/versions/status
```

**Extend Deprecation Timeline** (emergency):
```javascript
import { getDefaultRegistry } from './api/_lib/gateway/deprecationManager.js';
const manager = getDefaultRegistry();
manager.setPolicy('v1', { sunsetDate: '2027-11-25T00:00:00Z', warningDays: 180 });
```

## Migration & Rollback Strategy

### Rollout Phases

1. **Phase 1 (Week 1)**: Deploy behind `GATEWAY_FEATURE_VERSIONING=false`, monitor
2. **Phase 2 (Week 2)**: Enable versioning for internal consumers only
3. **Phase 3 (Week 3)**: Enable quotas for partner consumers
4. **Phase 4 (Week 4)**: Enable validation and deprecation headers
5. **Phase 5 (Week 5)**: Full enforcement for all consumers

### Rollback Procedure

**Immediate Rollback** (feature flag):
```bash
# Disable all gateway features
GATEWAY_ENABLED=false

# Or disable individual features
GATEWAY_FEATURE_VERSIONING=false
GATEWAY_FEATURE_QUOTAS=false
GATEWAY_FEATURE_VALIDATION=false
GATEWAY_FEATURE_DEPRECATION=false
```

**Verification Steps**:
1. Confirm all requests route directly to mesh layer
2. Verify no version/quota/validation headers in responses
3. Monitor error rates for 5 minutes
4. Check consumer-facing API functionality

**Rollback Time**: < 2 minutes (configuration change only, no data migration)

### Version Sunset Procedure

1. **T-180 days**: Set `warningDays: 180`, publish migration guide
2. **T-90 days**: Enable deprecation headers, send client notifications
3. **T-30 days**: Increase communication frequency, offer migration support
4. **T-7 days**: Final warnings, confirm no critical consumers remain
5. **T-0**: Version returns 410 Gone, traffic routed to latest version
6. **T+30 days**: Remove version from `SUPPORTED_VERSIONS`, clean up contracts

## Testing

### Unit Tests
```bash
npm test -- api/_lib/versioning/negotiator.test.js
npm test -- api/_lib/versioning/contractRegistry.test.js
npm test -- api/_lib/gateway/consumerRegistry.test.js
npm test -- api/_lib/gateway/deprecationManager.test.js
npm test -- api/_lib/gateway/compatibilityReporter.test.js
npm test -- api/_lib/validation/requestValidator.test.js
npm test -- api/_lib/gateway/gatewayMiddleware.test.js
```

### Integration & Concurrency Tests
```bash
# Test full gateway pipeline (end-to-end integration)
npm test -- api/_lib/gateway/integration.test.js

# Test concurrency, retries, degraded dependencies & NAT protection
npm test -- api/_lib/gateway/resilienceAndChaos.test.js
```

### Load Testing
```bash
# Synthetic load test with quota verification
npm run test:load -- --scenario gateway-quota
```

### Failure Injection
```bash
# Test validation failures, quota exhaustion, deprecation responses
npm run test:chaos -- --target gateway
```

## Security Considerations

1. **Credential Storage**: API keys hashed with HMAC-SHA256, never stored in plaintext
2. **PII Protection**: No personal data in logs, headers, or error responses
3. **Rate Limiting**: Multi-window (burst/minute/hour/day) prevents abuse
4. **NAT Protection**: Per-user limits protect users behind shared IPs
5. **Input Validation**: Strict OpenAPI schema validation prevents injection
6. **Error Sanitization**: Standardized error contract removes internal details
7. **CORS Policy**: Restricted origins, no wildcard with credentials

## Performance

| Operation | Target Latency | Measurement |
|-----------|---------------|-------------|
| Version negotiation | < 1ms | In-memory lookup |
| Consumer identification | < 2ms | Hash map + HMAC |
| Quota check | < 2ms | In-memory counters |
| Request validation | < 10ms | Compiled validators |
| Deprecation headers | < 1ms | Pre-computed policies |

**Memory Usage**:
- Contract registry: ~50KB per version
- Consumer registry: ~1KB per consumer
- Quota counters: ~200 bytes per active consumer/window
- Validator cache: ~10KB per unique endpoint

## Troubleshooting

### Common Issues

**Version not detected**:
- Check `Accept-Version` header spelling
- Verify URL path format: `/api/v1/` not `/api/v1`
- Ensure version is in `SUPPORTED_VERSIONS`

**Quota exceeded unexpectedly**:
- Check consumer tier and limits
- Verify `X-Forwarded-For` header from Vercel
- Check for NAT sharing (multiple users same IP)

**Validation failing on valid requests**:
- Verify OpenAPI contract matches implementation
- Check for extraProperties: false rejecting valid fields
- Ensure content-type is `application/json`

**Deprecation headers missing**:
- Confirm `GATEWAY_FEATURE_DEPRECATION=true`
- Check version is actually deprecated per policy
- Verify `DeprecationManager` has correct time source

### Debug Endpoints

```bash
# Gateway configuration
curl https://api.example.com/api/gateway-health

# Consumer registry stats
curl -H "X-API-Key: admin-key" https://api.example.com/api/admin/consumers/stats

# Contract registry status
curl -H "X-API-Key: admin-key" https://api.example.com/api/admin/contracts/status

# Deprecation status
curl https://api.example.com/api/versions/status
```

## Related Documentation

- [API Error Contract](API_ERROR_CONTRACT.md) - Standardized error responses
- [Abuse Controls](ABUSE_CONTROLS.md) - Rate limiting and abuse detection
- [Security Checks](SECURITY_CHECKS.md) - CI security pipeline
- [Mesh Readiness](docs/MESH_READINESS.md) - Service mesh infrastructure
- [Implementation Plan](API_GATEWAY_IMPLEMENTATION_PLAN.md) - Original implementation plan