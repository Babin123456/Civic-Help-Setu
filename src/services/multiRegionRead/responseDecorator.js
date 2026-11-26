/**
 * Response Decorator — Injects multi-region metadata headers into HTTP responses
 *
 * Pure function. No side effects. Adds headers to a response object.
 */

import {
  HTTP_HEADERS,
  DEFAULT_CONFIG,
} from './types.js';
import { getPrimaryRegion } from './regionRegistry.js';

// ============================================================================
// Header Injection
// ============================================================================

/**
 * Decorate a response with multi-region routing metadata.
 * Mutates the response object (Express/Vercel/standard Response).
 */
export const decorateResponse = (response, routingDecision, options = {}) => {
  const {
    primaryRegionId = DEFAULT_CONFIG.PRIMARY_REGION_ID,
    includeDebugHeaders = false,
    requestId = null,
  } = options;

  // Standard headers (always included when multi-region is active)
  setHeader(response, HTTP_HEADERS.SERVED_BY_REGION, routingDecision.regionId);
  setHeader(response, 'x-served-by', routingDecision.regionId);
  setHeader(response, HTTP_HEADERS.CONSISTENCY_LEVEL, routingDecision.consistencyLevel);
  setHeader(response, 'x-consistency', routingDecision.consistencyLevel);
  setHeader(response, HTTP_HEADERS.PRIMARY_REGION, primaryRegionId);

  // Stale read disclosure
  if (routingDecision.staleRead) {
    setHeader(response, HTTP_HEADERS.STALE_READ, 'true');
    setHeader(response, HTTP_HEADERS.REPLICA_LAG_MS, String(routingDecision.replicaLagMs));
  } else {
    setHeader(response, HTTP_HEADERS.STALE_READ, 'false');
    setHeader(response, HTTP_HEADERS.REPLICA_LAG_MS, '0');
  }

  // Failover indicator
  if (routingDecision.failover) {
    setHeader(response, HTTP_HEADERS.FAILOVER, 'true');
  }

  // Routing reason (debug)
  if (includeDebugHeaders) {
    setHeader(response, HTTP_HEADERS.ROUTING_REASON, routingDecision.reason);
    if (requestId) {
      setHeader(response, 'x-request-id', requestId);
    }
    if (routingDecision.tokenValidated) {
      setHeader(response, 'x-ryw-validated', 'true');
    }
  }

  return response;
};

/** Safe header setter for various response types */
const setHeader = (response, name, value) => {
  if (!response) return;

  // Express/Connect style
  if (typeof response.setHeader === 'function') {
    response.setHeader(name, value);
    return;
  }

  // Web Fetch Response (headers is a Headers object)
  if (response.headers && typeof response.headers.set === 'function') {
    response.headers.set(name, value);
    return;
  }

  // Plain object (test mocks)
  if (response.headers && typeof response.headers === 'object') {
    response.headers[name] = value;
    return;
  }

  // Vercel/Next.js style
  if (typeof response.setHeader === 'function') {
    response.setHeader(name, value);
  }
};

/**
 * Create a response metadata object for logging/observability
 * (does not mutate response)
 */
export const createResponseMetadata = (routingDecision, options = {}) => {
  const {
    primaryRegionId = DEFAULT_CONFIG.PRIMARY_REGION_ID,
    requestId = null,
    latencyMs = null,
  } = options;

  const primaryRegion = getPrimaryRegion(primaryRegionId);

  return {
    requestId,
    servedByRegion: routingDecision.regionId,
    servedByRegionName: primaryRegion?.displayName || routingDecision.regionId,
    consistencyLevel: routingDecision.consistencyLevel,
    replicaLagMs: routingDecision.replicaLagMs,
    primaryRegion: primaryRegionId,
    staleRead: routingDecision.staleRead,
    failover: routingDecision.failover,
    routingReason: routingDecision.reason,
    tokenValidated: routingDecision.tokenValidated,
    primaryCommitTs: routingDecision.primaryCommitTs,
    latencyMs,
  };
};

/**
 * Format metadata as structured log entry
 */
export const formatLogEntry = (metadata) => {
  return {
    ...metadata,
    timestamp: new Date().toISOString(),
    event: 'read_routing',
  };
};

// ============================================================================
// Client-Facing Helpers
// ============================================================================

/**
 * Parse multi-region headers from a response (for client SDKs)
 */
export const parseResponseHeaders = (headers) => {
  const get = (name) => {
    // Handle case-insensitive header lookup
    const lowerName = name.toLowerCase();
    for (const [key, value] of Object.entries(headers || {})) {
      if (key.toLowerCase() === lowerName) return value;
    }
    return null;
  };

  return {
    servedByRegion: get(HTTP_HEADERS.SERVED_BY_REGION),
    consistencyLevel: get(HTTP_HEADERS.CONSISTENCY_LEVEL),
    replicaLagMs: parseInt(get(HTTP_HEADERS.REPLICA_LAG_MS) || '0', 10),
    primaryRegion: get(HTTP_HEADERS.PRIMARY_REGION),
    staleRead: get(HTTP_HEADERS.STALE_READ) === 'true',
    failover: get(HTTP_HEADERS.FAILOVER) === 'true',
    routingReason: get(HTTP_HEADERS.ROUTING_REASON),
    rywValidated: get('x-ryw-validated') === 'true',
  };
};

/**
 * Client-side helper: should we retry on primary after stale read?
 * For read-your-writes scenarios where client has a token.
 */
export const shouldRetryOnPrimary = (responseHeaders, hasRywToken) => {
  if (!hasRywToken) return false;
  if (!responseHeaders.staleRead) return false;
  // If we got a stale read but have a RYW token, the token wasn't validated
  // (or we didn't send it). Retry with token on primary.
  return true;
};

// ============================================================================
// Header Constants Re-export (for external consumers)
// ============================================================================

export const RESPONSE_HEADERS = Object.freeze({
  SERVED_BY_REGION: HTTP_HEADERS.SERVED_BY_REGION,
  CONSISTENCY_LEVEL: HTTP_HEADERS.CONSISTENCY_LEVEL,
  REPLICA_LAG_MS: HTTP_HEADERS.REPLICA_LAG_MS,
  PRIMARY_REGION: HTTP_HEADERS.PRIMARY_REGION,
  STALE_READ: HTTP_HEADERS.STALE_READ,
  FAILOVER: HTTP_HEADERS.FAILOVER,
  ROUTING_REASON: HTTP_HEADERS.ROUTING_REASON,
  RYW_TOKEN_ISSUED: HTTP_HEADERS.RYW_TOKEN_ISSUED,
});

export const REQUEST_HEADERS = Object.freeze({
  CLIENT_REGION: HTTP_HEADERS.CLIENT_REGION,
  CONSISTENCY_HINT: HTTP_HEADERS.CONSISTENCY_HINT,
  RYW_TOKEN: HTTP_HEADERS.RYW_TOKEN,
});