/**
 * src/services/distributedCache/cacheKey.js
 *
 * Cache key design with identity isolation, namespace management,
 * and deterministic key generation for the distributed cache layer.
 */

import { createHash } from 'node:crypto';
import {
  CACHE_NAMESPACES,
  CACHE_KEY_PATTERN,
  validateCacheKey,
  validateCacheNamespace,
} from './types.js';

export { CACHE_NAMESPACES, CACHE_KEY_PATTERN };

/**
 * Extracts identity context from request for cache key isolation.
 * Sensitive/user-specific responses are never shared across identities.
 */
export function extractIdentityContext(req = {}) {
  const headers = req.headers || {};
  const lowerHeaders = {};
  for (const [name, value] of Object.entries(headers)) {
    lowerHeaders[name.toLowerCase()] = Array.isArray(value) ? value[0] : value;
  }

  // User identity (authenticated)
  const userId = req.auth?.userId || req.user?.id || lowerHeaders['x-user-id'];
  // Tenant isolation (multi-tenant deployments)
  const tenantId = lowerHeaders['x-tenant-id'] || req.tenantId;
  // Jurisdiction isolation (regional data)
  const jurisdictionCode = lowerHeaders['x-jurisdiction-code'] || req.jurisdictionCode;
  // Session for anonymous but sticky contexts
  const sessionId = lowerHeaders['x-session-id'] || req.sessionId;

  return {
    userId: userId ? String(userId).trim() : null,
    tenantId: tenantId ? String(tenantId).trim() : null,
    jurisdictionCode: jurisdictionCode ? String(jurisdictionCode).trim() : null,
    sessionId: sessionId ? String(sessionId).trim() : null,
  };
}

/**
 * Computes a deterministic identity hash for cache key scoping.
 * Returns empty string for public (non-identity-isolated) keys.
 */
export function computeIdentityHash(identityContext, enforceIsolation = true) {
  if (!enforceIsolation) return '';

  const parts = [];
  if (identityContext.userId) parts.push(`u:${identityContext.userId}`);
  if (identityContext.tenantId) parts.push(`t:${identityContext.tenantId}`);
  if (identityContext.jurisdictionCode) parts.push(`j:${identityContext.jurisdictionCode}`);
  if (identityContext.sessionId && !identityContext.userId) parts.push(`s:${identityContext.sessionId}`);

  if (parts.length === 0) return '';

  const input = parts.join('|');
  return createHash('sha256').update(input).digest('hex').slice(0, 16);
}

/**
 * Builds a cache key from components with namespace, identity, and resource path.
 *
 * Key format: {namespace}:{resourcePath}[#{identityHash}]
 * - namespace: logical grouping (svc_cat, pub_ref, etc.)
 * - resourcePath: hierarchical resource identifier (e.g., "services/driving-license")
 * - identityHash: optional 16-char hash for identity isolation
 *
 * @param {object} params
 * @param {string} params.namespace - Cache namespace from CACHE_NAMESPACES
 * @param {string} params.resourcePath - Hierarchical resource path
 * @param {object} [params.identityContext] - Identity context from extractIdentityContext
 * @param {boolean} [params.enforceIsolation=true] - Whether to include identity in key
 * @param {object} [params.options] - Additional options
 * @returns {string} Validated cache key
 */
export function buildCacheKey({ namespace, resourcePath, identityContext = {}, enforceIsolation = true }) {
  const nsCheck = validateCacheNamespace(namespace);
  if (!nsCheck.valid) {
    throw new Error(`Invalid namespace: ${nsCheck.errors.join('; ')}`);
  }

  if (!resourcePath || typeof resourcePath !== 'string') {
    throw new Error('resourcePath must be a non-empty string');
  }

  // Normalize resource path: lowercase, preserve forward slashes, replace other special chars
  const normalizedPath = resourcePath
    .toLowerCase()
    .replace(/[^a-z0-9._:/-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 100); // Leave room for namespace and identity hash

  const identityHash = computeIdentityHash(identityContext, enforceIsolation);
  const key = identityHash
    ? `${namespace}:${normalizedPath}#${identityHash}`
    : `${namespace}:${normalizedPath}`;

  const keyCheck = validateCacheKey(key);
  if (!keyCheck.valid) {
    throw new Error(`Generated cache key invalid: ${keyCheck.errors.join('; ')}`);
  }

  return key;
}

/**
 * Parses a cache key into its components.
 */
export function parseCacheKey(key) {
  const keyCheck = validateCacheKey(key);
  if (!keyCheck.valid) {
    return { valid: false, errors: keyCheck.errors };
  }

  const hashIndex = key.lastIndexOf('#');
  let identityHash = null;
  let keyWithoutHash = key;

  if (hashIndex > 0) {
    identityHash = key.slice(hashIndex + 1);
    keyWithoutHash = key.slice(0, hashIndex);
  }

  const colonIndex = keyWithoutHash.indexOf(':');
  if (colonIndex <= 0) {
    return { valid: false, errors: ['Key must contain namespace:resourcePath'] };
  }

  const namespace = keyWithoutHash.slice(0, colonIndex);
  const resourcePath = keyWithoutHash.slice(colonIndex + 1);

  const nsCheck = validateCacheNamespace(namespace);
  if (!nsCheck.valid) {
    return { valid: false, errors: nsCheck.errors };
  }

  return {
    valid: true,
    namespace,
    resourcePath,
    identityHash,
    isIdentityIsolated: !!identityHash,
  };
}

/**
 * Builds a cache key for a service catalogue entry.
 */
export function buildServiceCatalogueKey(serviceId, identityContext = {}, enforceIsolation = true) {
  return buildCacheKey({
    namespace: CACHE_NAMESPACES.SERVICE_CATALOGUE,
    resourcePath: `services/${serviceId}`,
    identityContext,
    enforceIsolation,
  });
}

/**
 * Builds a cache key for a service catalogue list/filter query.
 */
export function buildServiceCatalogueListKey(filters = {}, identityContext = {}, enforceIsolation = true) {
  // Deterministic filter serialization for consistent keys
  const filterParts = Object.entries(filters)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${Array.isArray(v) ? v.sort().join(',') : v}`)
    .join('&');

  const resourcePath = filterParts ? `services?${filterParts}` : 'services';

  return buildCacheKey({
    namespace: CACHE_NAMESPACES.SERVICE_CATALOGUE,
    resourcePath,
    identityContext,
    enforceIsolation,
  });
}

/**
 * Builds a cache key for public reference data.
 */
export function buildPublicReferenceKey(referenceType, resourceId, identityContext = {}, enforceIsolation = false) {
  // Public reference data typically doesn't need identity isolation
  return buildCacheKey({
    namespace: CACHE_NAMESPACES.PUBLIC_REFERENCE,
    resourcePath: `${referenceType}/${resourceId}`,
    identityContext,
    enforceIsolation,
  });
}

/**
 * Builds a cache key for jurisdictions.
 */
export function buildJurisdictionKey(scope = 'all', identityContext = {}, enforceIsolation = false) {
  return buildCacheKey({
    namespace: CACHE_NAMESPACES.JURISDICTIONS,
    resourcePath: scope === 'all' ? 'all' : `scope/${scope}`,
    identityContext,
    enforceIsolation,
  });
}

/**
 * Builds a cache key for office directory.
 */
export function buildOfficeDirectoryKey(filters = {}, identityContext = {}, enforceIsolation = true) {
  const filterParts = Object.entries(filters)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${Array.isArray(v) ? v.sort().join(',') : v}`)
    .join('&');

  const resourcePath = filterParts ? `offices?${filterParts}` : 'offices';

  return buildCacheKey({
    namespace: CACHE_NAMESPACES.OFFICE_DIRECTORY,
    resourcePath,
    identityContext,
    enforceIsolation,
  });
}

/**
 * Builds a pattern key for invalidation (supports wildcards).
 * Pattern format: namespace:resourcePath* (trailing * for prefix match)
 */
export function buildInvalidationPattern(namespace, resourcePathPrefix = '') {
  const nsCheck = validateCacheNamespace(namespace);
  if (!nsCheck.valid) throw new Error(`Invalid namespace: ${nsCheck.errors.join('; ')}`);

  const normalizedPrefix = resourcePathPrefix
    .toLowerCase()
    .replace(/[^a-z0-9._:/-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '');

  return `${namespace}:${normalizedPrefix}*`;
}

/**
 * Checks if a key matches an invalidation pattern.
 */
export function keyMatchesPattern(key, pattern) {
  if (!pattern.endsWith('*')) return key === pattern;
  const prefix = pattern.slice(0, -1);
  return key.startsWith(prefix);
}