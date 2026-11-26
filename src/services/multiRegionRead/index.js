/* global process */
/**
 * Multi-Region Read Layer — Main Entry Point
 *
 * Initializes and wires together all components.
 * Provides a simple API for API handlers to use.
 */

import { DEFAULT_CONFIG } from './types.js';
import { validateRegistry, getRegion } from './regionRegistry.js';
import { createReplicaHealthMonitor, exportMetrics as exportHealthMetrics } from './replicaHealthMonitor.js';
import { createSessionTokenStore, issueToken, validateTokenForUser, revokeToken, revokeAllUserTokens, getTokenInfo, exportMetrics as exportTokenMetrics } from './sessionTokenStore.js';
import { createReadRouter, buildClientContext, routeRead, routeBatchRead } from './readRouter.js';
import { createFailoverController, shutdownController, manualFailover, manualRecovery, disableMultiRegionReads, enableMultiRegionReads, setRolloutPercent, trackDrainingRequest, exportControllerMetrics, getFailoverStatus, advanceAllRecoveries } from './failoverController.js';
import { decorateResponse, createResponseMetadata, parseResponseHeaders } from './responseDecorator.js';

// ============================================================================
// Main Factory
// ============================================================================

/**
 * Create a fully configured multi-region read layer.
 * Returns an object with all components and helper methods.
 */
export const createMultiRegionReadLayer = ({
  // Configuration
  config = DEFAULT_CONFIG,
  // External secrets
  tokenSecret = process.env.RYW_TOKEN_SECRET,
  // Callbacks for side effects
  onAlert = null,
  onConfigChange = null,
  onMetrics = null,
  // Custom storage for tokens (default: in-memory Map)
  tokenStorage = null,
} = {}) => {
  // Validate registry at startup
  const registryValidation = validateRegistry();
  if (!registryValidation.valid) {
    throw new Error(`Region registry invalid: ${registryValidation.errors.join('; ')}`);
  }

  // Create components
  const healthMonitor = createReplicaHealthMonitor({ config });
  const tokenStore = createSessionTokenStore({
    secret: tokenSecret || 'test-secret-do-not-use-in-production',
    config,
    storage: tokenStorage || new Map(),
  });
  const router = createReadRouter({
    healthMonitor,
    tokenStore,
    config,
  });
  const failoverController = createFailoverController({
    healthMonitor,
    router,
    config,
    onAlert,
    onConfigChange,
    onMetrics,
  });

  // Initialize background tasks
  healthMonitor.startCleanup?.();
  tokenStore.startCleanup?.();
  failoverController.initialize?.();

  // Return unified API
  return {
    // Core components (exposed for testing and advanced use)
    healthMonitor,
    tokenStore,
    router,
    failoverController,
    config,

    // Helper methods for API handlers
    routeRead: (request) => routeRead(router, request),
    routeBatchRead: (requests) => routeBatchRead(router, requests),
    buildClientContext: (headers, user) => buildClientContext(headers, user),
    getRegion: (regionId) => getRegion(regionId),

    // Token management
    issueToken: (userId, primaryCommitTs, writeOpId) => issueToken(tokenStore, userId, primaryCommitTs, writeOpId),
    validateToken: (token, replica, userId) => validateTokenForUser(tokenStore, token, replica, userId),
    revokeToken: (tokenId) => revokeToken(tokenStore, tokenId),
    revokeAllUserTokens: (userId) => revokeAllUserTokens(tokenStore, userId),
    getTokenInfo: (token) => getTokenInfo(tokenStore, token),

    // Response decoration
    decorateResponse: (response, decision, options) => decorateResponse(response, decision, options),
    createResponseMetadata: (decision, options) => createResponseMetadata(decision, options),
    parseResponseHeaders,

    // Failover control
    manualFailover: (regionId, reason) => manualFailover(failoverController, regionId, reason),
    manualRecovery: (regionId) => manualRecovery(failoverController, regionId),
    disableMultiRegionReads: (reason) => disableMultiRegionReads(failoverController, reason),
    enableMultiRegionReads: (rolloutPercent) => enableMultiRegionReads(failoverController, rolloutPercent),
    setRolloutPercent: (percent) => setRolloutPercent(failoverController, percent),
    trackDrainingRequest: (regionId, delta) => trackDrainingRequest(failoverController, regionId, delta),
    advanceAllRecoveries: () => advanceAllRecoveries(failoverController),

    // Metrics & status
    exportMetrics: () => ({
      health: exportHealthMetrics(healthMonitor),
      tokens: exportTokenMetrics(tokenStore),
      controller: exportControllerMetrics(failoverController),
    }),
    getFailoverStatus: () => getFailoverStatus(failoverController),

    // Lifecycle
    shutdown: () => {
      healthMonitor.stopCleanup?.();
      tokenStore.stopCleanup?.();
      shutdownController(failoverController);
    },

    // Registry validation result
    registryValidation,
  };
};

// ============================================================================
// Express/Vercel Middleware Helper
// ============================================================================

/**
 * Create middleware that attaches multi-region routing to requests.
 * Usage:
 *   const multiRegion = createMultiRegionReadLayer({...});
 *   app.use(multiRegion.middleware());
 *   app.get('/api/data', multiRegion.readHandler('collectionName'), handler);
 */
export const createMultiRegionMiddleware = (multiRegion) => {
  return (req, res, next) => {
    // Attach multi-region instance to request
    req.multiRegion = multiRegion;

    // Build client context from headers
    const user = req.auth?.userId ? { id: req.auth.userId, role: req.auth.role } : null;
    req.multiRegionClientContext = multiRegion.buildClientContext(req.headers, user);

    // Helper to route and execute a read
    req.multiRegionRead = async (collectionPath, readFn, options = {}) => {
      const { requiredConsistency } = options;

      // Route the read
      const routingDecision = await multiRegion.routeRead({
        collectionPath,
        clientContext: req.multiRegionClientContext,
        requiredConsistency,
      });

      // Execute read on selected replica
      // readFn receives { regionId, replicaId, routingDecision }
      const result = await readFn({
        regionId: routingDecision.regionId,
        replicaId: routingDecision.replicaId,
        routingDecision,
      });

      // Decorate response with metadata
      multiRegion.decorateResponse(res, routingDecision, {
        requestId: req.id || req.headers['x-request-id'],
        includeDebugHeaders: process.env.NODE_ENV !== 'production',
      });

      return { result, routingDecision };
    };

    next();
  };
};

// ============================================================================
// Higher-Order Handler Wrapper
// ============================================================================

/**
 * Wrap an API handler with multi-region read routing.
 * The handler receives { regionId, replicaId, routingDecision } as third argument.
 */
export const withMultiRegionRead = (multiRegion, collectionPath, options = {}) => {
  return async (req, res) => {
    const { requiredConsistency } = options;

    const routingDecision = await multiRegion.routeRead({
      collectionPath,
      clientContext: req.multiRegionClientContext || multiRegion.buildClientContext(req.headers),
      requiredConsistency,
    });

    // Attach routing info to request for handler
    req.multiRegionRouting = routingDecision;
    req.multiRegionRegion = routingDecision.regionId;

    // Decorate response
    multiRegion.decorateResponse(res, routingDecision, {
      requestId: req.id || req.headers['x-request-id'],
    });

    // Call original handler — it should use req.multiRegionRegion for reads
    // The actual data fetching happens inside the handler using the region
  };
};

// ============================================================================
// Re-exports
// ============================================================================

export * from './types.js';
export * from './regionRegistry.js';
export * from './replicaHealthMonitor.js';
export * from './sessionTokenStore.js';
export * from './readRouter.js';
export * from './failoverController.js';
export * from './responseDecorator.js';