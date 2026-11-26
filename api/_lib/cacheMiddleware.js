/* global process */
/**
 * api/_lib/cacheMiddleware.js
 *
 * Express/Vercel middleware for the Distributed Cache Layer.
 * Integrates with the existing API dispatcher and provides:
 * - Cache attachment to request object
 * - Automatic cache headers on responses
 * - Cache management endpoints
 * - Feature flag gating
 */

import { createCacheMiddleware as createCoreCacheMiddleware } from '../../src/services/distributedCache/index.js';
import { createDistributedCacheSystem } from '../../src/services/distributedCache/index.js';
import { getFirestoreAdmin } from './firebaseAdmin.js';
import { createEventOutbox, createFirestoreOutboxStorageAdapter } from './eventOutbox.js';

// Singleton cache system instance
let cacheSystemInstance = null;
let initializationPromise = null;

/**
 * Get or create the cache system instance.
 */
export const getCacheSystem = async ({
  config = {},
  featureFlagEngine = null,
  featureFlagContext = {},
  db = null,
  outbox = null,
  onMetric = () => {},
  onError = (err) => console.error('[CacheMiddleware]', err),
  forceNew = false,
} = {}) => {
  if (cacheSystemInstance && !forceNew) return cacheSystemInstance;
  if (initializationPromise && !forceNew) return initializationPromise;

  initializationPromise = (async () => {
    // Resolve Firestore if not provided
    let firestoreDb = db;
    if (!firestoreDb) {
      try {
        firestoreDb = await getFirestoreAdmin();
      } catch {
        console.warn('[CacheMiddleware] Firestore not available, using in-memory storage');
      }
    }

    // Resolve event outbox if not provided
    let eventOutbox = outbox;
    if (!eventOutbox && firestoreDb) {
      const storageAdapter = createFirestoreOutboxStorageAdapter({
        db: firestoreDb,
        collectionName: 'cache_invalidation_outbox',
      });
      eventOutbox = createEventOutbox({ storage: storageAdapter });
    }

    // Create the cache system
    cacheSystemInstance = createDistributedCacheSystem({
      config,
      featureFlagEngine,
      featureFlagContext,
      db: firestoreDb,
      outbox: eventOutbox,
      onMetric,
      onError,
    });

    // Start invalidation subscriber if available
    cacheSystemInstance.start?.();

    return cacheSystemInstance;
  })();

  return initializationPromise;
};

/**
 * Reset the cache system singleton (for testing).
 */
export const resetCacheSystem = () => {
  if (cacheSystemInstance) {
    cacheSystemInstance.stop?.();
    cacheSystemInstance.shutdown?.();
  }
  cacheSystemInstance = null;
  initializationPromise = null;
};

/**
 * Create middleware that attaches cache helpers to the request.
 */
export const createCacheMiddleware = (cacheSystem) => {
  const coreMiddleware = createCoreCacheMiddleware(cacheSystem);
  return coreMiddleware;
};

/**
 * Cache management API handler for administrative operations.
 * Provides endpoints for:
 * - GET /api/cache/status - Cache health and metrics
 * - POST /api/cache/invalidate - Invalidate keys/patterns
 * - POST /api/cache/flush - Flush entire cache (admin only)
 * - GET /api/cache/metrics - Prometheus-formatted metrics
 */
export async function createCacheManagementHandler({
  cacheSystem: providedCacheSystem = null,
  requireAdmin = true,
  adminRoles = ['admin', 'reviewer', 'official'],
  onAudit = () => {},
} = {}) {
  const isAdmin = (req) => {
    if (req.auth?.role && adminRoles.includes(req.auth.role)) return true;
    const token = req.headers?.['x-cache-admin-token'];
    const adminToken = process.env.CACHE_ADMIN_TOKEN;
    return Boolean(adminToken && token && token === adminToken);
  };

  return async function cacheManagementHandler(req, res) {
    // Lazy-initialize cache system if not provided
    let cacheSystem = providedCacheSystem;
    if (!cacheSystem) {
      cacheSystem = await getCacheSystem();
    }

    const method = String(req.method || 'GET').toUpperCase();
    const path = (req.url || '').split('?')[0].replace(/^\/api\/cache\/?/, '');

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Cache-Admin-Token');

    if (method === 'OPTIONS') {
      return res.status(204).end();
    }

    // Health/Status endpoint - no auth required
    if (method === 'GET' && (path === 'status' || path === 'health' || path === '')) {
      const metrics = cacheSystem.getMetrics();
      const featureFlags = cacheSystem.getFeatureFlags();
      const config = cacheSystem.config;

      return res.status(200).json({
        success: true,
        data: {
          enabled: cacheSystem.isEnabled(),
          status: 'operational',
          schemaVersion: cacheSystem.CACHE_SCHEMA_VERSION,
          config: {
            defaultTtlMs: config.DEFAULT_TTL_MS,
            maxTtlMs: config.MAX_TTL_MS,
            staleWhileRevalidateMs: config.STALE_WHILE_REVALIDATE_MS,
            negativeTtlMs: config.NEGATIVE_TTL_MS,
            coalesceTimeoutMs: config.COALESCE_TIMEOUT_MS,
            maxKeys: config.MAX_KEYS,
            storageBackend: config.STORAGE_BACKEND,
            enforceIdentityIsolation: config.ENFORCE_IDENTITY_ISOLATION,
          },
          features: Object.fromEntries(
            Object.entries(featureFlags)
              .filter(([k]) => k.startsWith('civic.cache.'))
              .map(([k, v]) => [k, { enabled: v.enabled, reason: v.reason }])
          ),
          metrics,
          invalidation: {
            subscriberRunning: !!cacheSystem.invalidationSystem,
            publisherAvailable: !!cacheSystem.publisher,
          },
        },
      });
    }

    // Metrics endpoint - no auth required
    if (method === 'GET' && path === 'metrics') {
      const metrics = cacheSystem.getMetrics();
      const lines = [
        `# HELP cache_hits_total Total number of cache hits`,
        `# TYPE cache_hits_total counter`,
        `cache_hits_total ${metrics.hits}`,
        `# HELP cache_misses_total Total number of cache misses`,
        `# TYPE cache_misses_total counter`,
        `cache_misses_total ${metrics.misses}`,
        `# HELP cache_stale_hits_total Total number of stale-while-revalidate hits`,
        `# TYPE cache_stale_hits_total counter`,
        `cache_stale_hits_total ${metrics.staleHits}`,
        `# HELP cache_negative_hits_total Total number of negative cache hits`,
        `# TYPE cache_negative_hits_total counter`,
        `cache_negative_hits_total ${metrics.negativeHits}`,
        `# HELP cache_coalesced_hits_total Total number of coalesced request hits`,
        `# TYPE cache_coalesced_hits_total counter`,
        `cache_coalesced_hits_total ${metrics.coalescedHits}`,
        `# HELP cache_origin_fetches_total Total number of origin fetches`,
        `# TYPE cache_origin_fetches_total counter`,
        `cache_origin_fetches_total ${metrics.originFetches}`,
        `# HELP cache_errors_total Total number of cache errors`,
        `# TYPE cache_errors_total counter`,
        `cache_errors_total ${metrics.errors}`,
        `# HELP cache_sets_total Total number of cache sets`,
        `# TYPE cache_sets_total counter`,
        `cache_sets_total ${metrics.sets}`,
        `# HELP cache_deletes_total Total number of cache deletes`,
        `# TYPE cache_deletes_total counter`,
        `cache_deletes_total ${metrics.deletes}`,
        `# HELP cache_invalidations_total Total number of cache invalidations`,
        `# TYPE cache_invalidations_total counter`,
        `cache_invalidations_total ${metrics.invalidations}`,
        `# HELP cache_hit_rate Cache hit rate (0-1)`,
        `# TYPE cache_hit_rate gauge`,
        `cache_hit_rate ${metrics.hitRate}`,
        `# HELP cache_in_flight_requests Number of in-flight coalesced requests`,
        `# TYPE cache_in_flight_requests gauge`,
        `cache_in_flight_requests ${metrics.inFlightRequests}`,
      ];
      res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      return res.status(200).send(lines.join('\n') + '\n');
    }

    // Admin-only endpoints
    if (requireAdmin && !isAdmin(req)) {
      return res.status(403).json({
        success: false,
        error: 'Admin authorization required',
        code: 'CACHE_ADMIN_REQUIRED',
      });
    }

    // Invalidate specific keys or patterns
    if (method === 'POST' && path === 'invalidate') {
      const { keys = [], patterns = [], namespaces = [], serviceIds = [], referenceTypes = [] } = req.body || {};

      const results = [];

      // Invalidate specific keys
      for (const key of keys) {
        try {
          await cacheSystem.invalidate(key);
          results.push({ type: 'key', target: key, success: true });
        } catch (err) {
          results.push({ type: 'key', target: key, success: false, error: err.message });
        }
      }

      // Invalidate patterns
      for (const pattern of patterns) {
        try {
          await cacheSystem.invalidatePattern(pattern);
          results.push({ type: 'pattern', target: pattern, success: true });
        } catch (err) {
          results.push({ type: 'pattern', target: pattern, success: false, error: err.message });
        }
      }

      // Invalidate namespaces
      for (const namespace of namespaces) {
        try {
          const pattern = cacheSystem.buildInvalidationPattern(namespace, '');
          await cacheSystem.invalidatePattern(pattern);
          results.push({ type: 'namespace', target: namespace, success: true });
        } catch (err) {
          results.push({ type: 'namespace', target: namespace, success: false, error: err.message });
        }
      }

      // Invalidate service catalogue entries
      for (const serviceId of serviceIds) {
        try {
          await cacheSystem.publisher?.invalidateService(serviceId);
          results.push({ type: 'service', target: serviceId, success: true });
        } catch (err) {
          results.push({ type: 'service', target: serviceId, success: false, error: err.message });
        }
      }

      // Invalidate public reference types
      for (const referenceType of referenceTypes) {
        try {
          await cacheSystem.publisher?.invalidatePublicReferenceType(referenceType);
          results.push({ type: 'reference_type', target: referenceType, success: true });
        } catch (err) {
          results.push({ type: 'reference_type', target: referenceType, success: false, error: err.message });
        }
      }

      onAudit({
        action: 'cache_invalidate',
        actorId: req.auth?.userId || 'admin-token',
        results,
        timestamp: new Date().toISOString(),
      });

      return res.status(200).json({
        success: true,
        data: { results },
      });
    }

    // Flush entire cache (dangerous!)
    if (method === 'POST' && path === 'flush') {
      const { confirm } = req.body || {};
      if (confirm !== 'FLUSH_ALL_CACHE') {
        return res.status(400).json({
          success: false,
          error: 'Confirmation required: send { "confirm": "FLUSH_ALL_CACHE" }',
          code: 'CACHE_FLUSH_CONFIRMATION_REQUIRED',
        });
      }

      try {
        await cacheSystem.publisher?.flushAll();
        await cacheSystem.cacheEngine.storage.clear();

        onAudit({
          action: 'cache_full_flush',
          actorId: req.auth?.userId || 'admin-token',
          timestamp: new Date().toISOString(),
        });

        return res.status(200).json({
          success: true,
          data: { message: 'Cache flush initiated across all instances' },
        });
      } catch (err) {
        return res.status(500).json({
          success: false,
          error: err.message,
          code: 'CACHE_FLUSH_FAILED',
        });
      }
    }

    // Reset metrics
    if (method === 'POST' && path === 'metrics/reset') {
      cacheSystem.resetMetrics();
      return res.status(200).json({
        success: true,
        data: { message: 'Metrics reset' },
      });
    }

    return res.status(404).json({
      success: false,
      error: 'Cache management endpoint not found',
      code: 'CACHE_ENDPOINT_NOT_FOUND',
    });
  };
}

/**
 * Helper to add cache metadata to response for debugging.
 */
export function attachCacheMetadata(res, cacheResult, key) {
  if (cacheResult && res.setHeader) {
    res.setHeader('X-Cache-Origin', cacheResult.origin || 'unknown');
    res.setHeader('X-Cache-Freshness', cacheResult.freshness || 'unknown');
    if (key) {
      res.setHeader('X-Cache-Key', key.length > 100 ? key.slice(0, 100) + '…' : key);
    }
  }
}

/**
 * Wrapper for API handlers that want to use cache with automatic metadata headers.
 */
export function withCacheHandler(cacheSystem, keyBuilder, fetcher, options = {}) {
  return async function cachedHandler(req, res) {
    const key = keyBuilder(req);
    const identityContext = cacheSystem.extractIdentityContext(req);

    const result = await cacheSystem.get(key, {
      revalidate: () => fetcher(req),
      revalidateOptions: options,
      consistency: options.consistency || cacheSystem.config.CACHE_CONSISTENCY,
      identityContext,
    });

    attachCacheMetadata(res, result, key);

    if (result.value === null && result.freshness === 'negative') {
      return res.status(404).json({
        success: false,
        error: 'Not found',
        code: 'NOT_FOUND',
      });
    }

    return res.status(200).json({
      success: true,
      data: result.value,
      _cacheMeta: {
        origin: result.origin,
        freshness: result.freshness,
        key,
      },
    });
  };
}