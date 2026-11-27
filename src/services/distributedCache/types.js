/* global process */
/**
 * src/services/distributedCache/types.js
 *
 * Type definitions and configuration constants for the Distributed Cache
 * Coherence and Stampede-Protection Layer.
 *
 * This layer provides:
 * - Cache key design with identity isolation
 * - Invalidation events via event outbox
 * - TTL jitter to prevent thundering herd
 * - Request coalescing (single-flight) for hot keys
 * - Stale-while-revalidate for graceful degradation
 * - Bounded negative caching for missing keys
 */

export const CACHE_SCHEMA_VERSION = '1.0.0';

export const CACHE_KEY_PATTERN = /^[a-z0-9][a-z0-9._:#/-]{1,127}$/;

export const CACHE_NAMESPACES = Object.freeze({
  SERVICE_CATALOGUE: 'svc_cat',
  PUBLIC_REFERENCE: 'pub_ref',
  JURISDICTIONS: 'jurisdictions',
  SERVICE_CATEGORIES: 'svc_cats',
  OFFICE_DIRECTORY: 'office_dir',
  WELFARE_SCHEMES: 'welfare',
  TRANSIT_CONCESSIONS: 'transit',
  CIVIC_GLOSSARY: 'glossary',
});

export const CACHE_CONSISTENCY = Object.freeze({
  STRONG: 'strong',           // Read-your-writes, primary only
  BOUNDED_STALE: 'bounded_stale', // Allow stale reads within TTL
  EVENTUAL: 'eventual',       // Best effort, highest availability
});

export const CACHE_ORIGIN = Object.freeze({
  ORIGIN: 'origin',           // Fresh from source of truth
  CACHE_HIT: 'cache_hit',     // Served from cache (fresh)
  STALE_HIT: 'stale_hit',     // Served stale while revalidating
  NEGATIVE_HIT: 'negative_hit', // Cached negative result
  COALESCED: 'coalesced',     // Coalesced with in-flight request
});

export const INVALIDATION_EVENT_TYPES = Object.freeze({
  KEY_INVALIDATED: 'cache.key_invalidated',
  NAMESPACE_INVALIDATED: 'cache.namespace_invalidated',
  PATTERN_INVALIDATED: 'cache.pattern_invalidated',
  FULL_FLUSH: 'cache.full_flush',
});

export const DEFAULT_CONFIG = Object.freeze({
  // Feature flag
  ENABLED: process.env.DISTRIBUTED_CACHE_ENABLED !== 'false',
  ROLLOUT_PERCENT: parseInt(process.env.DISTRIBUTED_CACHE_ROLLOUT_PERCENT || '100', 10),

  // Storage
  STORAGE_BACKEND: process.env.DISTRIBUTED_CACHE_STORAGE || 'auto', // 'memory' | 'firestore' | 'auto'

  // TTL Configuration (milliseconds)
  DEFAULT_TTL_MS: parseInt(process.env.DISTRIBUTED_CACHE_DEFAULT_TTL_MS || '300000', 10), // 5 min
  MAX_TTL_MS: parseInt(process.env.DISTRIBUTED_CACHE_MAX_TTL_MS || '3600000', 10), // 1 hour
  MIN_TTL_MS: parseInt(process.env.DISTRIBUTED_CACHE_MIN_TTL_MS || '1000', 10), // 1 sec

  // TTL Jitter: +/- percentage to prevent synchronized expiration
  TTL_JITTER_PCT: parseFloat(process.env.DISTRIBUTED_CACHE_TTL_JITTER_PCT || '0.15'), // 15%

  // Stale-While-Revalidate: additional time to serve stale content while revalidating
  STALE_WHILE_REVALIDATE_MS: parseInt(process.env.DISTRIBUTED_CACHE_SWR_MS || '60000', 10), // 1 min

  // Negative Caching: cache miss results for this long
  NEGATIVE_TTL_MS: parseInt(process.env.DISTRIBUTED_CACHE_NEGATIVE_TTL_MS || '30000', 10), // 30 sec
  MAX_NEGATIVE_TTL_MS: parseInt(process.env.DISTRIBUTED_CACHE_MAX_NEGATIVE_TTL_MS || '120000', 10), // 2 min

  // Request Coalescing: max time to wait for in-flight request
  COALESCE_TIMEOUT_MS: parseInt(process.env.DISTRIBUTED_CACHE_COALESCE_TIMEOUT_MS || '5000', 10), // 5 sec

  // Bounded Memory
  MAX_KEYS: parseInt(process.env.DISTRIBUTED_CACHE_MAX_KEYS || '10000', 10),
  MAX_ENTRY_SIZE_BYTES: parseInt(process.env.DISTRIBUTED_CACHE_MAX_ENTRY_SIZE_BYTES || '1048576', 10), // 1 MB

  // Invalidation
  INVALIDATION_CHANNEL: process.env.DISTRIBUTED_CACHE_INVALIDATION_CHANNEL || 'cache_invalidation',
  INVALIDATION_TTL_MS: parseInt(process.env.DISTRIBUTED_CACHE_INVALIDATION_TTL_MS || '86400000', 10), // 24 hours

  // Identity Isolation: cache keys automatically include identity context
  ENFORCE_IDENTITY_ISOLATION: process.env.DISTRIBUTED_CACHE_ENFORCE_IDENTITY_ISOLATION !== 'false',

  // Metrics
  METRICS_INTERVAL_MS: parseInt(process.env.DISTRIBUTED_CACHE_METRICS_INTERVAL_MS || '60000', 10), // 1 min

  // Firestore collection for distributed storage
  FIRESTORE_COLLECTION: process.env.DISTRIBUTED_CACHE_FIRESTORE_COLLECTION || 'distributed_cache_entries',
  FIRESTORE_INVALIDATION_COLLECTION: process.env.DISTRIBUTED_CACHE_FIRESTORE_INVALIDATION_COLLECTION || 'cache_invalidation_events',
});

/**
 * Validates a cache key format.
 */
export function validateCacheKey(key) {
  const errors = [];
  if (!key || typeof key !== 'string') {
    errors.push('Cache key must be a non-empty string');
    return { valid: false, errors };
  }
  if (key.length > 128) {
    errors.push('Cache key must be 128 characters or less');
  }
  if (!CACHE_KEY_PATTERN.test(key)) {
    errors.push('Cache key must match pattern: lowercase alphanumeric, dots, underscores, colons, hyphens');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Validates a cache namespace.
 */
export function validateCacheNamespace(namespace) {
  const validNamespaces = Object.values(CACHE_NAMESPACES);
  if (!validNamespaces.includes(namespace)) {
    return { valid: false, errors: [`Invalid namespace. Must be one of: ${validNamespaces.join(', ')}`] };
  }
  return { valid: true, errors: [] };
}

/**
 * Validates cache entry metadata.
 */
export function validateCacheEntry(entry) {
  const errors = [];
  if (!entry || typeof entry !== 'object') {
    errors.push('Cache entry must be an object');
    return { valid: false, errors };
  }
  if (entry.value === undefined && entry.negative !== true) {
    errors.push('Cache entry must have either value or negative: true');
  }
  if (entry.expiresAt !== undefined && (!Number.isFinite(entry.expiresAt) || entry.expiresAt <= 0)) {
    errors.push('expiresAt must be a positive finite number');
  }
  if (entry.staleExpiresAt !== undefined && (!Number.isFinite(entry.staleExpiresAt) || entry.staleExpiresAt <= 0)) {
    errors.push('staleExpiresAt must be a positive finite number');
  }
  if (entry.createdAt !== undefined && (!Number.isFinite(entry.createdAt) || entry.createdAt <= 0)) {
    errors.push('createdAt must be a positive finite number');
  }
  if (entry.identityHash !== undefined && typeof entry.identityHash !== 'string') {
    errors.push('identityHash must be a string');
  }
  if (entry.namespace !== undefined) {
    const nsCheck = validateCacheNamespace(entry.namespace);
    if (!nsCheck.valid) errors.push(...nsCheck.errors);
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Validates cache configuration.
 */
export function validateCacheConfig(config) {
  const errors = [];
  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['Config must be an object'] };
  }
  const numericFields = [
    'DEFAULT_TTL_MS', 'MAX_TTL_MS', 'MIN_TTL_MS', 'TTL_JITTER_PCT',
    'STALE_WHILE_REVALIDATE_MS', 'NEGATIVE_TTL_MS', 'MAX_NEGATIVE_TTL_MS',
    'COALESCE_TIMEOUT_MS', 'MAX_KEYS', 'MAX_ENTRY_SIZE_BYTES',
    'INVALIDATION_TTL_MS', 'METRICS_INTERVAL_MS', 'ROLLOUT_PERCENT'
  ];
  for (const field of numericFields) {
    if (config[field] !== undefined) {
      if (!Number.isFinite(config[field]) || config[field] < 0) {
        errors.push(`${field} must be a non-negative finite number`);
      }
    }
  }
  if (config.TTL_JITTER_PCT !== undefined && (config.TTL_JITTER_PCT < 0 || config.TTL_JITTER_PCT > 1)) {
    errors.push('TTL_JITTER_PCT must be between 0 and 1');
  }
  if (config.ROLLOUT_PERCENT !== undefined && (config.ROLLOUT_PERCENT < 0 || config.ROLLOUT_PERCENT > 100)) {
    errors.push('ROLLOUT_PERCENT must be between 0 and 100');
  }
  if (config.STORAGE_BACKEND !== undefined && !['memory', 'firestore', 'auto'].includes(config.STORAGE_BACKEND)) {
    errors.push('STORAGE_BACKEND must be "memory", "firestore", or "auto"');
  }
  if (config.CACHE_CONSISTENCY !== undefined && !Object.values(CACHE_CONSISTENCY).includes(config.CACHE_CONSISTENCY)) {
    errors.push(`CACHE_CONSISTENCY must be one of: ${Object.values(CACHE_CONSISTENCY).join(', ')}`);
  }
  return { valid: errors.length === 0, errors };
}