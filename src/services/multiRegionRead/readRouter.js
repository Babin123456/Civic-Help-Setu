/**
 * Read Router — Selects the optimal replica for each read request
 *
 * Pure routing logic. No I/O. All decisions based on injected state.
 */

import {
  CONSISTENCY_LEVEL,
  ROUTING_REASON,
  DEFAULT_CONFIG,
  createClientContext,
  createRoutingDecision,
  REPLICA_HEALTH,
} from './types.js';
import {
  getAllowedRegionsForRead,
  getRequiredConsistencyForCollection,
  canReadFromRegion,
  validateRegistry,
  isValidRegion,
} from './regionRegistry.js';
import { getHealthyReplicas } from './replicaHealthMonitor.js';
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
 */
export const routeRead = async (router, request) => {
  const {
    collectionPath,
    clientContext = {},
    requiredConsistency = null, // Override from handler
  } = request;

  const { runtimeConfig, healthMonitor, tokenStore } = router;
  const { enabled, rolloutPercent, primaryRegionId } = runtimeConfig;

  // Feature flag check
  if (!enabled) {
    return createPrimaryOnlyDecision(primaryRegionId, ROUTING_REASON.PRIMARY_ONLY, 'feature_disabled');
  }

  // Rollout percentage check (deterministic per request)
  if (rolloutPercent < 100) {
    const hash = hashString(`${collectionPath}:${clientContext.userId || 'anon'}:${clientContext.geoRegion || 'unknown'}`);
    if ((hash % 100) >= rolloutPercent) {
      return createPrimaryOnlyDecision(primaryRegionId, ROUTING_REASON.PRIMARY_ONLY, 'rollout_excluded');
    }
  }

  // Determine required consistency level
  const consistencyLevel = requiredConsistency || clientContext.consistencyHint || getRequiredConsistencyForCollection(collectionPath);

  // If STRONG consistency required, always route to primary
  if (consistencyLevel === CONSISTENCY_LEVEL.STRONG) {
    return createPrimaryOnlyDecision(primaryRegionId, ROUTING_REASON.PRIMARY_ONLY, 'strong_consistency_required');
  }

  // Check if collection can only be read from primary (sensitive data)
  if (!canReadFromRegion(collectionPath, primaryRegionId)) {
    // This shouldn't happen for primary, but safety check
    return createPrimaryOnlyDecision(primaryRegionId, ROUTING_REASON.PRIMARY_ONLY, 'collection_primary_only');
  }

  // Get base allowed regions for this collection (without explicit region constraint)
  const baseAllowedRegions = getAllowedRegionsForRead(collectionPath, { ...clientContext, explicitRegion: undefined });

  // Check if explicit region is specified and healthy
  const { explicitRegion } = clientContext;
  let healthyReplicas;

  if (explicitRegion && isValidRegion(explicitRegion)) {
    const explicitReplicaState = healthMonitor.state.get(explicitRegion);
    const explicitRegionHealthy = explicitReplicaState?.health === REPLICA_HEALTH.HEALTHY || explicitReplicaState?.health === REPLICA_HEALTH.DEGRADED;

    if (explicitRegionHealthy) {
      // Explicit region is healthy - restrict to that region only
      healthyReplicas = getHealthyReplicas(healthMonitor).filter((r) => r.regionId === explicitRegion);
    } else {
      // Explicit region unhealthy or not found - fall back to all healthy replicas in base allowed regions
      healthyReplicas = getHealthyReplicas(healthMonitor).filter((r) =>
        baseAllowedRegions.some((reg) => reg.id === r.regionId)
      );
    }
  } else {
    // No explicit region - use all healthy replicas in allowed regions
    healthyReplicas = getHealthyReplicas(healthMonitor).filter((r) =>
      baseAllowedRegions.some((reg) => reg.id === r.regionId)
    );
  }

  // If no healthy replicas, failover to primary
  if (healthyReplicas.length === 0) {
    return createPrimaryOnlyDecision(primaryRegionId, ROUTING_REASON.FAILOVER_TO_PRIMARY, 'no_healthy_replicas');
  }

  // Check for Read-Your-Writes token
  const { sessionToken, userId } = clientContext;
  if (sessionToken && tokenStore && userId) {
    // Validate token against the BEST healthy replica first
    const bestReplica = healthyReplicas[0];
    const tokenValidation = await validateTokenForUser(tokenStore, sessionToken, {
      regionId: bestReplica.regionId,
      lastReplicatedCommitTs: bestReplica.state.lastReplicatedCommitTs,
      lagMs: bestReplica.state.lagMs,
    }, userId);

    if (tokenValidation.result === 'allowed') {
      // Token validated, replica caught up — route to best replica
      return createRoutingDecision({
        replicaId: bestReplica.regionId,
        regionId: bestReplica.regionId,
        consistencyLevel: CONSISTENCY_LEVEL.BOUNDED_STALE,
        reason: ROUTING_REASON.RYW_TOKEN_VALID,
        replicaLagMs: bestReplica.state.lagMs,
        primaryCommitTs: tokenValidation.primaryCommitTs,
        tokenValidated: true,
        staleRead: bestReplica.state.lagMs > 0,
      });
    }

    if (tokenValidation.result === 'routed_to_primary') {
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
      });
    }

    // Token invalid/expired — ignore and proceed with normal routing
    // (Log for monitoring but don't block)
  }

  // No RYW token or token invalid — normal routing
  // Select best replica based on client preference
  const geoRegion = clientContext.geoRegion;
  let preferredRegionId = explicitRegion || geoRegion;

  // If client has explicit region preference, try to honor it
  if (preferredRegionId) {
    const preferred = healthyReplicas.find((r) => r.regionId === preferredRegionId);
    if (preferred) {
      return createReplicaDecision(preferred, CONSISTENCY_LEVEL.BOUNDED_STALE, ROUTING_REASON.EXPLICIT_REGION);
    }
    // Preferred region not healthy — fall through to best available
  }

  // Default: route to best healthy replica (lowest lag, highest weight)
  const bestReplica = healthyReplicas[0];
  return createReplicaDecision(bestReplica, CONSISTENCY_LEVEL.BOUNDED_STALE, ROUTING_REASON.NEAREST_HEALTHY);
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