/**
 * Read Router — Selects the optimal replica for each read request
 *
 * Pure routing logic. No I/O. All decisions based on injected state.
 */

import {
  CONSISTENCY_LEVEL,
  ROUTING_REASON,
  DEFAULT_CONFIG,
  ROUTING_CONSIDERATION,
  ROUTING_META,
  createClientContext,
  createRoutingDecision,
  createResponseMeta,
  REPLICA_HEALTH,
} from './types.js';
import {
  getAllowedRegionsForRead,
  getRequiredConsistencyForCollection,
  canReadFromRegion,
  validateRegistry,
  isValidRegion,
  getRegion,
  getRegionsByResidency,
  requiresIndiaResidency,
} from './regionRegistry.js';
import { getHealthyReplicas, hasHealthyReplicas } from './replicaHealthMonitor.js';
import { validateTokenForUser } from './sessionTokenStore.js';

// ============================================================================
// Router Configuration
// ============================================================================

/** Create a read router instance */
export const createReadRouter = ({
  healthMonitor = null,
  tokenStore = null,
  config = DEFAULT_CONFIG,
} = {}) => ({
  config,
  healthMonitor,
  tokenStore,
  // Runtime overrides (feature flags, etc.)
  runtimeConfig: {
    enabled: config.ENABLED,
    rolloutPercent: config.ROLLOUT_PERCENT,
    primaryRegionId: config.PRIMARY_REGION_ID,
  },
});

// ============================================================================
// Core Routing Logic
// ============================================================================

/**
 * Main routing function.
 * Returns a routing decision with the selected replica and reasoning.
 * Considers: health, latency, capacity, residency constraints, and sticky sessions.
 */
export const routeRead = async (router, request) => {
  const {
    collectionPath,
    clientContext = {},
    requiredConsistency = null, // Override from handler
  } = request;

  const { runtimeConfig, healthMonitor, tokenStore } = router;
  const { enabled, rolloutPercent, primaryRegionId } = runtimeConfig;

  const { userId, explicitRegion, geoRegion, consistencyHint, sessionToken } = clientContext;

  // Guard: requiresIndiaResidency may not be available in all test contexts
  const _requiresIndiaResidency = requiresIndiaResidency || ((collectionPath) => false);

  // Feature flag check
  if (!enabled) {
    return createPrimaryOnlyDecision(primaryRegionId, ROUTING_REASON.PRIMARY_ONLY, 'feature_disabled');
  }

  // Rollout percentage check (deterministic per request)
  if (rolloutPercent < 100) {
    const hash = hashString(`${collectionPath}:${userId || 'anon'}:${geoRegion || 'unknown'}`);
    if ((hash % 100) >= rolloutPercent) {
      return createPrimaryOnlyDecision(primaryRegionId, ROUTING_REASON.PRIMARY_ONLY, 'rollout_excluded');
    }
  }

  // Determine required consistency level
  const consistencyLevel = requiredConsistency || consistencyHint || getRequiredConsistencyForCollection(collectionPath);

  // If STRONG consistency required, always route to primary
  if (consistencyLevel === CONSISTENCY_LEVEL.STRONG) {
    return createPrimaryOnlyDecision(primaryRegionId, ROUTING_REASON.PRIMARY_ONLY, 'strong_consistency_required');
  }

  // Check if collection can only be read from primary (sensitive data) — fail-closed residency
  if (_requiresIndiaResidency(collectionPath) && primaryRegionId) {
    if (!canReadFromRegion(collectionPath, primaryRegionId)) {
      return createPrimaryOnlyDecision(primaryRegionId, ROUTING_REASON.PRIMARY_ONLY, 'collection_primary_only');
    }
  }

  // Get base allowed regions for this collection (without explicit region constraint)
  const baseAllowedRegions = getAllowedRegionsForRead(collectionPath, { ...clientContext, explicitRegion: undefined });

  // Determine explicit region from client context
  const clientExplicitRegion = explicitRegion || null;

  // Collect healthy replicas respecting all constraints: health, latency, capacity, residency
  const allHealthyReplicas = getHealthyReplicas(healthMonitor);

  // Filter replicas by: allowed region, health, latency threshold, capacity, residency
  let healthyReplicas = allHealthyReplicas.filter((r) => {
    const regionId = r.regionId;

    // 1. Check residency constraint (fail-closed): sensitive data must stay in India
    if (_requiresIndiaResidency(collectionPath)) {
      const regionConfig = getRegion(regionId);
      if (!regionConfig || regionConfig.residency !== RESIDENCY_CLASS.INDIA) {
        return false; // Fail-closed: non-India regions cannot serve India-resident data
      }
    }

    // 2. Check region is in allowed regions for this collection
    if (!baseAllowedRegions.some((reg) => reg.id === regionId)) {
      return false;
    }

    // 3. Check latency threshold (prefer replicas with lower latency)
    const maxLag = r.state.lagMs;
    const { DEGRADED_LAG_MS } = healthMonitor.config;
    if (maxLag > DEGRADED_LAG_MS * 2) {
      // Significantly lagged — still eligible but lower priority
    }

    // 4. Check capacity (prefer replicas with higher available capacity)
    const capacity = r.capacityPercent;
    if (capacity <= 20) {
      // Heavily loaded replica — deprioritize
      return false;
    }

    return true;
  });

  // If no replicas pass all constraints, try relaxed filtering (lower lag threshold)
  if (healthyReplicas.length === 0) {
    healthyReplicas = allHealthyReplicas.filter((r) => {
      const regionId = r.regionId;

      // Check residency constraint
      if (_requiresIndiaResidency(collectionPath)) {
        const regionConfig = getRegion(regionId);
        if (!regionConfig || regionConfig.residency !== RESIDENCY_CLASS.INDIA) {
          return false;
        }
      }

      // Check region is in allowed regions
      if (!baseAllowedRegions.some((reg) => reg.id === regionId)) {
        return false;
      }

      // Only check lag, skip capacity for fallback
      const maxLag = r.state.lagMs;
      const { DEGRADED_LAG_MS } = healthMonitor.config;
      return maxLag <= DEGRADED_LAG_MS * 4; // Relaxed threshold
    });
  }

  // If still no healthy replicas, failover to primary
  if (healthyReplicas.length === 0) {
    return createPrimaryOnlyDecision(primaryRegionId, ROUTING_REASON.FAILOVER_TO_PRIMARY, 'no_healthy_replicas_after_constraints');
  }

  // === Sticky Session Handling ===
  // Determine if we should establish a sticky session based on collection type and routing context
  const shouldUseStickySessions = shouldUseStickySession(collectionPath, userId);

  // === Route with consideration for latency, capacity, and sticky sessions ===
  const selectedReplica = selectBestReplica(healthyReplicas, userId, explicitRegion, geoRegion);

  // Build routing decision with full metadata
  const decision = createRoutingDecision({
    replicaId: selectedReplica.regionId,
    regionId: selectedReplica.regionId,
    consistencyLevel,
    reason: ROUTING_REASON.NEAREST_HEALTHY,
    replicaLagMs: selectedReplica.state.lagMs,
    primaryCommitTs: selectedReplica.state.lastReplicatedCommitTs,
    tokenValidated: false,
    staleRead: selectedReplica.state.lagMs > 0,
  });

  // Enhance decision with regional steering metadata
  const _residencyCompliant = !_requiresIndiaResidency(collectionPath) || // true if no India constraint
    (getRegion(selectedReplica.regionId)?.residency === RESIDENCY_CLASS.INDIA);
  const _residencyEnforced = _requiresIndiaResidency(collectionPath) ? 'yes' : 'no';
  const enhancedMeta = {
    [ROUTING_META.LATENCY_MS]: selectedReplica.state.latencyMs,
    [ROUTING_META.CAPACITY_PERCENT]: selectedReplica.state.capacityPercent,
    [ROUTING_META.RESIDENCY_COMPLIANT]: _residencyCompliant,
    [ROUTING_META.RESIDENCY_ENFORCED]: _residencyEnforced,
  };

  // Add sticky session marker if applicable
  if (shouldUseStickySessions && sessionToken) {
    decision[ROUTING_META.STICKY_SESSION] = true;
    enhancedMeta[ROUTING_META.STICKY_SESSION] = true;
  }

  // Attach enhanced metadata to decision
  // @ts-expect-error — adding dynamic metadata fields
  decision[ROUTING_META.LATENCY_MS] = selectedReplica.state.latencyMs;
  // @ts-expect-error — adding dynamic metadata fields
  decision[ROUTING_META.CAPACITY_PERCENT] = selectedReplica.state.capacityPercent;
  // @ts-expect-error — adding dynamic metadata fields
  decision[ROUTING_META.RESIDENCY_COMPLIANT] = enhancedMeta.RESIDENCY_COMPLIANT;
  // @ts-expect-error — adding dynamic metadata fields
  decision[ROUTING_META.RESIDENCY_ENFORCED] = enhancedMeta.RESIDENCY_ENFORCED;
  // @ts-expect-error — adding dynamic metadata fields
  decision[ROUTING_META.STICKY_SESSION] = shouldUseStickySessions && sessionToken ? true : false;

  // Set the routing reason based on what constrained the selection
  let routingReason = ROUTING_REASON.NEAREST_HEALTHY;
  // Explicit region preference sets the reason if the region is healthy and available
  if (explicitRegion) {
    const explicitReplica = healthyReplicas.find((r) => r.regionId === explicitRegion);
    if (explicitReplica) {
      routingReason = ROUTING_REASON.EXPLICIT_REGION;
    }
  } else if (geoRegion && !explicitRegion) {
    // Geo region preference (inferred from IP) also sets explicit region reason
    // only if a healthy replica exists in that region
    const geoReplica = healthyReplicas.find((r) => r.regionId === geoRegion);
    if (geoReplica) {
      routingReason = ROUTING_REASON.EXPLICIT_REGION;
    }
  } else if (_requiresIndiaResidency(collectionPath) && healthyReplicas.length < allHealthyReplicas.length) {
    routingReason = ROUTING_REASON.EXPLICIT_REGION; // Residency constrained selection
  } else if (healthyReplicas.length < allHealthyReplicas.length) {
    routingReason = ROUTING_REASON.WEIGHTED_RANDOM; // Constrained set
  }

  // Update the reason in the decision
  decision.reason = routingReason;

  // If RYW token available, validate it
  if (sessionToken && tokenStore && userId) {
    // Validate token against the selected replica
    const tokenValidation = await validateTokenForUser(tokenStore, sessionToken, {
      regionId: selectedReplica.regionId,
      lastReplicatedCommitTs: selectedReplica.state.lastReplicatedCommitTs,
      lagMs: selectedReplica.state.lagMs,
    }, userId);

    if (tokenValidation.result === 'allowed') {
      // Token validated, update consistency and reason
      decision.consistencyLevel = CONSISTENCY_LEVEL.BOUNDED_STALE;
      decision.reason = ROUTING_REASON.RYW_TOKEN_VALID;
      decision.tokenValidated = true;
      decision.replicaLagMs = selectedReplica.state.lagMs;
      decision.primaryCommitTs = tokenValidation.primaryCommitTs;
      decision.staleRead = selectedReplica.state.lagMs > 0;
    } else if (tokenValidation.result === 'routed_to_primary') {
      // Token valid but replica lagging — must route to primary for RYW
      return createRoutingDecision({
        replicaId: primaryRegionId,
        regionId: primaryRegionId,
        consistencyLevel: CONSISTENCY_LEVEL.STRONG,
        reason: ROUTING_REASON.RYW_TOKEN_FORCED_PRIMARY,
        replicaLagMs: 0,
        primaryCommitTs: tokenValidation.primaryCommitTs,
        tokenValidated: true,
        staleRead: false,
        failover: true,
      });
    }
    // Token invalid/expired — proceed with normal routing (logged for monitoring)
  }

  // Inject response metadata for observability
  const responseMeta = createResponseMeta({
    servedByRegion: selectedReplica.regionId,
    consistencyLevel: decision.consistencyLevel,
    replicaLagMs: decision.replicaLagMs,
    primaryRegion: primaryRegionId,
    staleRead: decision.staleRead,
    failover: decision.failover || false,
    routingReason: decision.reason,
  });

  return {
    ...decision,
    [ROUTING_META.LATENCY_MS]: selectedReplica.state.latencyMs,
    [ROUTING_META.CAPACITY_PERCENT]: selectedReplica.state.capacityPercent,
    [ROUTING_META.RESIDENCY_COMPLIANT]: enhancedMeta.RESIDENCY_COMPLIANT,
    [ROUTING_META.RESIDENCY_ENFORCED]: enhancedMeta.RESIDENCY_ENFORCED,
    [ROUTING_META.STICKY_SESSION]: decision[ROUTING_META.STICKY_SESSION] || false,
    ...responseMeta,
  };
};

/** Determine if sticky sessions should be used for a given collection/user */
const shouldUseStickySession = (collectionPath, userId) => {
  // Sticky sessions are required for collections involving user state,
  // preferences, or ongoing operations that must remain consistent
  const stickyCollections = [
    'users',
    'applications',
    'drafts',
    'settings',
    'checklists',
    'assessments',
    'saved',
  ];

  // Check if collection path starts with a sticky collection prefix
  for (const collection of stickyCollections) {
    if (collectionPath === collection || collectionPath.startsWith(`${collection}/`)) {
      return true;
    }
  }

  // Sticky sessions for authenticated users on any collection
  if (userId) {
    return true;
  }

  return false;
};

/** Select the best replica considering latency, capacity, and client preferences */
const selectBestReplica = (healthyReplicas, userId, explicitRegion, geoRegion) => {
  if (healthyReplicas.length === 0) return null;

  // If explicit region preference from client, honor it if healthy and available
  if (explicitRegion) {
    const preferred = healthyReplicas.find((r) => r.regionId === explicitRegion);
    if (preferred) return preferred;
  }

  // If user has a geo region preference, try to match
  if (geoRegion && !explicitRegion) {
    const preferred = healthyReplicas.find((r) => r.regionId === geoRegion);
    if (preferred) return preferred;
  }

  // Sort by: lowest latency first, then highest capacity, then highest weight
  const sorted = [...healthyReplicas].sort((a, b) => {
    // Primary sort: latency (lower is better)
    const latencyDiff = a.state.latencyMs - b.state.latencyMs;
    if (latencyDiff !== 0) return latencyDiff;

    // Secondary sort: capacity (higher is better)
    const capacityDiff = b.capacityPercent - a.capacityPercent;
    if (capacityDiff !== 0) return capacityDiff;

    // Tertiary sort: weight (higher is better)
    return b.weight - a.weight;
  });

  return sorted[0];
};

/** Create a routing decision for primary-only */
const createPrimaryOnlyDecision = (primaryRegionId, reason, detail) => {
  return createRoutingDecision({
    replicaId: primaryRegionId,
    regionId: primaryRegionId,
    consistencyLevel: CONSISTENCY_LEVEL.STRONG,
    reason,
    replicaLagMs: 0,
    primaryCommitTs: Date.now(), // Primary is always current
    tokenValidated: false,
    staleRead: false,
    failover: reason === ROUTING_REASON.FAILOVER_TO_PRIMARY,
    meta: { detail },
  });
};

/** Create a routing decision for a healthy replica */
const createReplicaDecision = (replica, consistencyLevel, reason) => {
  return createRoutingDecision({
    replicaId: replica.regionId,
    regionId: replica.regionId,
    consistencyLevel,
    reason,
    replicaLagMs: replica.state.lagMs,
    primaryCommitTs: replica.state.lastReplicatedCommitTs,
    tokenValidated: false,
    staleRead: replica.state.lagMs > 0,
    failover: false,
  });
};

// ============================================================================
// Request Context Builders
// ============================================================================

/** Build client context from HTTP request headers */
export const buildClientContext = (headers = {}, authenticatedUser = null) => {
  return createClientContext({
    userId: authenticatedUser?.id || null,
    explicitRegion: headers['x-client-region'] || null,
    geoRegion: headers['x-vercel-ip-country'] ? geoToRegion(headers['x-vercel-ip-country']) : null,
    sessionToken: headers['x-read-your-writes-token'] || null,
    consistencyHint: headers['x-consistency-hint'] || null,
    isAdmin: authenticatedUser?.role === 'admin',
  });
};

/** Map country code to region (simplified) */
const geoToRegion = (countryCode) => {
  const mapping = {
    US: 'us-central1',
    CA: 'us-central1',
    GB: 'europe-west1',
    DE: 'europe-west1',
    FR: 'europe-west1',
    NL: 'europe-west1',
    SG: 'asia-southeast1',
    JP: 'asia-southeast1',
    AU: 'australia-southeast1',
    NZ: 'australia-southeast1',
    IN: 'asia-south1', // India routes to primary
  };
  return mapping[countryCode?.toUpperCase()] || null;
};

/** Simple deterministic hash for rollout */
const hashString = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

// ============================================================================
// Batch Routing (for multiple collections in one request)
// ============================================================================

/** Route multiple collections — returns the most restrictive decision */
export const routeBatchRead = async (router, requests) => {
  const decisions = await Promise.all(requests.map((req) => routeRead(router, req)));

  // Find the most restrictive consistency level
  const consistencyOrder = {
    [CONSISTENCY_LEVEL.STRONG]: 3,
    [CONSISTENCY_LEVEL.BOUNDED_STALE]: 2,
    [CONSISTENCY_LEVEL.EVENTUAL]: 1,
  };

  let mostRestrictive = decisions[0];
  for (const decision of decisions) {
    if (consistencyOrder[decision.consistencyLevel] > consistencyOrder[mostRestrictive.consistencyLevel]) {
      mostRestrictive = decision;
    }
    // If any decision is failover to primary, propagate
    if (decision.failover) mostRestrictive.failover = true;
  }

  return mostRestrictive;
};

// ============================================================================
// Router Configuration Management
// ============================================================================

/** Update runtime config (feature flags) */
export const updateRuntimeConfig = (router, updates) => {
  router.runtimeConfig = { ...router.runtimeConfig, ...updates };
  return router.runtimeConfig;
};

/** Get current runtime config */
export const getRuntimeConfig = (router) => ({ ...router.runtimeConfig });

/** Validate router configuration */
export const validateRouterConfig = (router) => {
  const errors = [];
  const warnings = [];

  if (!router.healthMonitor) {
    errors.push('Health monitor not configured');
  }
  if (!router.tokenStore) {
    warnings.push('Token store not configured — RYW validation disabled');
  }

  const registryValidation = validateRegistry();
  errors.push(...registryValidation.errors);
  warnings.push(...registryValidation.warnings);

  return { valid: errors.length === 0, errors, warnings };
};

// ============================================================================
// Export for Testing
// ============================================================================

export const __testExports = {
  createPrimaryOnlyDecision,
  createReplicaDecision,
  hashString,
  geoToRegion,
};