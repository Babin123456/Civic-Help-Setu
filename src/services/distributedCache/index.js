/**
 * src/services/distributedCache/index.js
 *
 * Main entry point for the Distributed Cache Coherence and
 * Stampede-Protection Layer.
 *
 * Provides a unified API for:
 * - Cache key design with identity isolation
 * - TTL jitter to prevent thundering herd
 * - Request coalescing (single-flight) for hot keys
 * - Stale-while-revalidate for graceful degradation
 * - Bounded negative caching for missing keys
 * - Distributed invalidation via event outbox
 * - Feature flag integration for safe rollout
 */

import { createFeatureFlagEngine } from '../featureFlagEngine.js';
import { createCacheEngine } from './cacheEngine.js';
import { createCacheStorage as createStorage, createInMemoryCacheStorage, createFirestoreCacheStorage, createAutoCacheStorage } from './storage.js';
import {
  createInvalidationSystem,
  createInvalidationPublisher,
  createInvalidationSubscriber,
  createInvalidationOutbox,
  createMemoryStorageAdapter,
} from './invalidation.js';
import {
  buildCacheKey,
  parseCacheKey,
  buildServiceCatalogueKey,
  buildServiceCatalogueListKey,
  buildPublicReferenceKey,
  buildJurisdictionKey,
  buildOfficeDirectoryKey,
  buildInvalidationPattern,
  keyMatchesPattern,
  extractIdentityContext,
  computeIdentityHash,
} from './cacheKey.js';
import {
  DEFAULT_CONFIG,
  CACHE_ORIGIN,
  CACHE_CONSISTENCY,
  INVALIDATION_EVENT_TYPES,
  CACHE_SCHEMA_VERSION,
  CACHE_NAMESPACES,
  validateCacheConfig,
  validateCacheKey,
  validateCacheNamespace,
} from './types.js';

// Re-export types and constants
export * from './types.js';
export * from './cacheKey.js';
export * from './cacheEngine.js';
export * from './storage.js';
export * from './invalidation.js';

/**
 * Default feature flags for cache rollout control.
 */
export const CACHE_FEATURE_FLAGS = Object.freeze({
  'civic.cache.distributed': {
    defaultEnabled: false,
    rolloutPercentage: 0,
    killSwitch: false,
    exposure: 'server',
    description: 'Enable distributed cache layer for service catalogues and public reference data',
  },
  'civic.cache.invalidation': {
    defaultEnabled: false,
    rolloutPercentage: 0,
    killSwitch: false,
    exposure: 'server',
    description: 'Enable distributed cache invalidation via event outbox',
  },
  'civic.cache.coalescing': {
    defaultEnabled: true,
    rolloutPercentage: 100,
    killSwitch: false,
    exposure: 'server',
    description: 'Enable request coalescing for hot cache keys',
  },
  'civic.cache.stale_while_revalidate': {
    defaultEnabled: true,
    rolloutPercentage: 100,
    killSwitch: false,
    exposure: 'server',
    description: 'Enable stale-while-revalidate for graceful degradation',
  },
  'civic.cache.negative_caching': {
    defaultEnabled: true,
    rolloutPercentage: 100,
    killSwitch: false,
    exposure: 'server',
    description: 'Enable bounded negative caching for cache misses',
  },
  'civic.cache.identity_isolation': {
    defaultEnabled: true,
    rolloutPercentage: 100,
    killSwitch: false,
    exposure: 'server',
    description: 'Enforce identity isolation in cache keys',
  },
});

/**
 * Creates a feature flag engine with cache-specific defaults.
 */
export function createCacheFeatureFlagEngine({
  staticDefaults = CACHE_FEATURE_FLAGS,
  initialFlags = {},
  onAudit = () => {},
} = {}) {
  return createFeatureFlagEngine({ staticDefaults, initialFlags, onAudit });
}

/**
 * Checks if the distributed cache is enabled via feature flags.
 */
export function isCacheEnabled(featureFlagEngine, context = {}) {
  if (!featureFlagEngine) return false;
  return featureFlagEngine.isEnabled('civic.cache.distributed', context);
}

/**
 * Checks if a specific cache feature is enabled.
 */
export function isCacheFeatureEnabled(featureFlagEngine, featureKey, context = {}) {
  if (!featureFlagEngine) return false;
  const fullKey = featureKey.startsWith('civic.cache.') ? featureKey : `civic.cache.${featureKey}`;
  return featureFlagEngine.isEnabled(fullKey, context);
}

/**
 * Creates a fully configured distributed cache system.
 */
export function createDistributedCacheSystem({
  // Configuration
  config = {},
  // Feature flag engine for rollout control
  featureFlagEngine = null,
  // Context for feature flag evaluation (userId, tenantId, etc.)
  featureFlagContext = {},
  // Firestore database (optional, for distributed storage)
  db = null,
  // Event outbox for invalidation (optional, will create if not provided)
  outbox = null,
  // Instance identifier for invalidation
  sourceInstance = typeof globalThis.process !== 'undefined' && globalThis.process?.pid
    ? `cache_${globalThis.process.pid}_${Date.now()}`
    : `cache_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`,
  instanceId = null,
  // Callbacks
  onMetric = () => {},
  onError = (err) => console.error('[DistributedCache]', err),
  onAudit = () => {},
  // Custom storage (overrides db-based storage)
  storage = null,
  // Custom coalescer (for testing)
  coalescer = null,
  // Time functions (for testing)
  now = Date.now,
  random = Math.random,
} = {}) {
  // Merge config with defaults
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  // Validate config
  const configCheck = validateCacheConfig(mergedConfig);
  if (!configCheck.valid) {
    throw new Error(`Invalid cache config: ${configCheck.errors.join('; ')}`);
  }

  // Create feature flag engine if not provided with defaults reflecting configuration
  const defaultFlags = {
    'civic.cache.distributed': {
      defaultEnabled: mergedConfig.ENABLED,
      rolloutPercentage: mergedConfig.ROLLOUT_PERCENT,
      killSwitch: false,
      exposure: 'server',
      description: 'Distributed cache enablement',
    },
    'civic.cache.invalidation': {
      defaultEnabled: true,
      rolloutPercentage: 100,
      killSwitch: false,
      exposure: 'server',
      description: 'Distributed cache invalidation outbox',
    },
  };
  const ffEngine = featureFlagEngine || createCacheFeatureFlagEngine({ initialFlags: defaultFlags, onAudit });

  // Check if cache is enabled via feature flag
  const cacheEnabled = mergedConfig.ENABLED && isCacheEnabled(ffEngine, featureFlagContext);

  // Create storage
  const cacheStorage = storage || createStorage(mergedConfig, { db, now });

  // Create cache engine
  const cacheEngine = createCacheEngine({
    config: mergedConfig,
    storage: cacheStorage,
    coalescer,
    now,
    random,
    onMetric: (metric) => {
      onMetric({ ...metric, cacheEnabled });
    },
    onError,
  });

  const resolvedSourceInstance = instanceId || sourceInstance;

  // Create invalidation system if outbox provided
  let invalidationSystem = null;
  if (outbox && (mergedConfig.ENABLED || isCacheFeatureEnabled(ffEngine, 'invalidation', featureFlagContext))) {
    invalidationSystem = createInvalidationSystem({
      cacheEngine,
      outbox,
      sourceInstance: resolvedSourceInstance,
      onError,
      onMetric: (metric) => onMetric({ ...metric, subsystem: 'invalidation' }),
    });
  }

  // Feature flag evaluation helpers
  const getFeatureFlags = () => ffEngine.evaluateAll(featureFlagContext, { exposure: 'server' });

  return {
    // Core components
    cacheEngine,
    storage: cacheStorage,
    invalidationSystem,
    featureFlagEngine: ffEngine,
    config: mergedConfig,

    // Feature flag status
    isEnabled: () => cacheEnabled,
    isFeatureEnabled: (feature) => isCacheFeatureEnabled(ffEngine, feature, featureFlagContext),
    getFeatureFlags,

    // Cache key builders
    buildCacheKey,
    parseCacheKey,
    buildServiceCatalogueKey,
    buildServiceCatalogueListKey,
    buildPublicReferenceKey,
    buildJurisdictionKey,
    buildOfficeDirectoryKey,
    buildInvalidationPattern,
    keyMatchesPattern,
    extractIdentityContext,
    computeIdentityHash,
    CACHE_NAMESPACES,

    // Cache operations
    get: async (key, options = {}) => {
      const isEnabled = mergedConfig.ENABLED && isCacheEnabled(ffEngine, featureFlagContext);
      if (!isEnabled) {
        if (options.revalidate) {
          const value = await options.revalidate();
          return { value, origin: CACHE_ORIGIN.ORIGIN, freshness: 'miss', entry: null };
        }
        return { value: null, origin: CACHE_ORIGIN.ORIGIN, freshness: 'miss', entry: null };
      }
      return cacheEngine.get(key, options);
    },
    set: (key, entry, options) => cacheEngine.set(key, entry, options),
    delete: (key) => cacheEngine.delete(key),
    has: (key) => cacheEngine.has(key),
    invalidate: (key) => cacheEngine.invalidate(key),
    invalidatePattern: (pattern) => cacheEngine.invalidatePattern(pattern),
    getMultiple: (keys, options) => cacheEngine.getMultiple(keys, options),
    setMultiple: (entries) => cacheEngine.setMultiple(entries),

    // Invalidation publisher & subscriber
    publisher: invalidationSystem?.publisher,
    subscriber: invalidationSystem?.subscriber,
    invalidationSubscriber: invalidationSystem?.subscriber,
    invalidationPublisher: invalidationSystem?.publisher,

    // Metrics
    getMetrics: () => cacheEngine.getMetrics(),
    resetMetrics: () => cacheEngine.resetMetrics(),

    // Lifecycle
    start: () => invalidationSystem?.start(),
    stop: () => invalidationSystem?.stop(),
    async shutdown() {
      invalidationSystem?.stop();
      await cacheEngine.shutdown();
    },

    // Constants
    CACHE_ORIGIN,
    CACHE_CONSISTENCY,
    INVALIDATION_EVENT_TYPES,
    CACHE_SCHEMA_VERSION,
  };
}

/**
 * Creates a simplified cache for service catalogue and public reference data.
 * This is the recommended entry point for most use cases.
 */
export function createServiceCache({
  config = {},
  featureFlagEngine = null,
  featureFlagContext = {},
  db = null,
  outbox = null,
  sourceInstance = null,
  instanceId = null,
  now = Date.now,
  random = Math.random,
  onMetric = () => {},
  onError = (err) => console.error('[ServiceCache]', err),
} = {}) {
  const system = createDistributedCacheSystem({
    config: {
      ...DEFAULT_CONFIG,
      // Service catalogue specific defaults
      DEFAULT_TTL_MS: 300000,        // 5 minutes
      STALE_WHILE_REVALIDATE_MS: 60000, // 1 minute
      NEGATIVE_TTL_MS: 30000,        // 30 seconds
      ...config,
    },
    featureFlagEngine,
    featureFlagContext,
    db,
    outbox,
    sourceInstance,
    instanceId,
    now,
    random,
    onMetric,
    onError,
  });

  return {
    ...system,

    // Service catalogue specific methods
    async getService(serviceId, fetcher, identityContext = {}) {
      const key = system.buildServiceCatalogueKey(serviceId, identityContext, system.config.ENFORCE_IDENTITY_ISOLATION);
      return system.get(key, {
        revalidate: () => fetcher(serviceId),
        consistency: system.config.CACHE_CONSISTENCY,
      });
    },

    async getServiceList(filters = {}, fetcher, identityContext = {}) {
      const key = system.buildServiceCatalogueListKey(filters, identityContext, system.config.ENFORCE_IDENTITY_ISOLATION);
      return system.get(key, {
        revalidate: () => fetcher(filters),
        consistency: system.config.CACHE_CONSISTENCY,
      });
    },

    async getPublicReference(referenceType, resourceId, fetcher, identityContext = {}) {
      const key = system.buildPublicReferenceKey(referenceType, resourceId, identityContext, false);
      return system.get(key, {
        revalidate: () => fetcher(referenceType, resourceId),
        consistency: system.config.CACHE_CONSISTENCY,
      });
    },

    async getJurisdictions(fetcher, scope = 'all', identityContext = {}) {
      const key = system.buildJurisdictionKey(scope, identityContext, false);
      return system.get(key, {
        revalidate: () => fetcher(scope),
        consistency: system.config.CACHE_CONSISTENCY,
      });
    },

    async getOfficeDirectory(filters = {}, fetcher, identityContext = {}) {
      const key = system.buildOfficeDirectoryKey(filters, identityContext, system.config.ENFORCE_IDENTITY_ISOLATION);
      return system.get(key, {
        revalidate: () => fetcher(filters),
        consistency: system.config.CACHE_CONSISTENCY,
      });
    },

    // Invalidation helpers
    async invalidateService(serviceId) {
      const pattern = system.buildInvalidationPattern('svc_cat', `services/${serviceId}`);
      await system.invalidatePattern(pattern);
      return system.publisher?.invalidateService(serviceId);
    },

    async invalidateServiceCatalogue() {
      const pattern = system.buildInvalidationPattern('svc_cat', '');
      await system.invalidatePattern(pattern);
      return system.publisher?.invalidateServiceCatalogue();
    },

    async invalidatePublicReference(referenceType, resourceId) {
      const pattern = system.buildInvalidationPattern('pub_ref', `${referenceType}/${resourceId}`);
      await system.invalidatePattern(pattern);
      return system.publisher?.invalidatePublicReference(referenceType, resourceId);
    },

    async invalidatePublicReferenceType(referenceType) {
      const pattern = system.buildInvalidationPattern('pub_ref', `${referenceType}`);
      await system.invalidatePattern(pattern);
      return system.publisher?.invalidatePublicReferenceType(referenceType);
    },
  };
}

/**
 * Middleware factory for API handlers to use the cache.
 * Attaches cache helpers to the request object.
 */
export function createCacheMiddleware(cacheSystem) {
  return async (req, res, next) => {
    const identityContext = cacheSystem.extractIdentityContext(req);

    req.cache = {
      // Direct cache engine access
      engine: cacheSystem.cacheEngine,

      // Service catalogue helpers
      getService: (serviceId, fetcher) => cacheSystem.getService(serviceId, fetcher, identityContext),
      getServiceList: (filters, fetcher) => cacheSystem.getServiceList(filters, fetcher, identityContext),

      // Public reference helpers
      getPublicReference: (type, id, fetcher) => cacheSystem.getPublicReference(type, id, fetcher, identityContext),
      getJurisdictions: (fetcher, scope) => cacheSystem.getJurisdictions(fetcher, scope, identityContext),
      getOfficeDirectory: (filters, fetcher) => cacheSystem.getOfficeDirectory(filters, fetcher, identityContext),

      // Generic cache operations
      get: (key, options) => cacheSystem.get(key, { ...options, identityContext: { ...identityContext, ...options.identityContext } }),
      set: (key, entry, options) => cacheSystem.set(key, entry, { ...options, identityContext }),
      delete: (key) => cacheSystem.delete(key),
      invalidate: (key) => cacheSystem.invalidate(key),

      // Key builders
      buildKey: (namespace, resourcePath, options) => cacheSystem.buildCacheKey({
        namespace,
        resourcePath,
        identityContext,
        enforceIsolation: cacheSystem.config.ENFORCE_IDENTITY_ISOLATION,
        ...options,
      }),

      // Feature flags
      isEnabled: () => cacheSystem.isEnabled(),
      isFeatureEnabled: (feature) => cacheSystem.isFeatureEnabled(feature),
    };

    next();
  };
}

/**
 * Higher-order function to wrap a data fetcher with cache.
 */
export function withCache(cacheSystem, keyBuilder, fetcher, options = {}) {
  const {
    ttlMs = cacheSystem.config.DEFAULT_TTL_MS,
    staleWhileRevalidateMs = cacheSystem.config.STALE_WHILE_REVALIDATE_MS,
    negativeTtlMs = cacheSystem.config.NEGATIVE_TTL_MS,
    consistency = cacheSystem.config.CACHE_CONSISTENCY,
    identityContext = {},
  } = options;

  return async function cachedFetcher(...args) {
    const key = keyBuilder(...args);
    const mergedIdentityContext = { ...identityContext, ...(args.find(a => a && typeof a === 'object' && a.identityContext)?.identityContext || {}) };

    return cacheSystem.get(key, {
      revalidate: () => fetcher(...args),
      revalidateOptions: { ttlMs, staleWhileRevalidateMs, negativeTtlMs },
      consistency,
      identityContext: mergedIdentityContext,
    });
  };
}

export default {
  createDistributedCacheSystem,
  createServiceCache,
  createCacheMiddleware,
  withCache,
  createCacheFeatureFlagEngine,
  CACHE_FEATURE_FLAGS,
  // Top-level constants for convenience
  CACHE_ORIGIN,
  CACHE_CONSISTENCY,
  INVALIDATION_EVENT_TYPES,
  CACHE_NAMESPACES,
  CACHE_SCHEMA_VERSION,
  DEFAULT_CONFIG,
  createMemoryStorageAdapter,
  // Re-export all submodules
  cacheKey: {
    buildCacheKey,
    parseCacheKey,
    buildServiceCatalogueKey,
    buildServiceCatalogueListKey,
    buildPublicReferenceKey,
    buildJurisdictionKey,
    buildOfficeDirectoryKey,
    buildInvalidationPattern,
    keyMatchesPattern,
    extractIdentityContext,
    computeIdentityHash,
    CACHE_NAMESPACES,
  },
  cacheEngine: { createCacheEngine, createCacheStorage: createStorage },
  storage: { createInMemoryCacheStorage, createFirestoreCacheStorage, createAutoCacheStorage, createCacheStorage: createStorage },
  invalidation: {
    createInvalidationSystem,
    createInvalidationPublisher,
    createInvalidationSubscriber,
    createInvalidationOutbox,
  },
  types: {
    DEFAULT_CONFIG,
    CACHE_ORIGIN,
    CACHE_CONSISTENCY,
    INVALIDATION_EVENT_TYPES,
    CACHE_SCHEMA_VERSION,
    validateCacheConfig,
    validateCacheKey,
    validateCacheNamespace,
  },
};