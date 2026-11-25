/**
 * api/_lib/versioning/negotiator.js
 *
 * API Version Negotiation Layer.
 * Supports version detection via:
 *  - Accept header: application/vnd.civic.v1+json
 *  - Custom header: Accept-Version: v1
 *  - URL path: /api/v1/...
 *  - Query parameter: ?version=v1
 *
 * Returns negotiated version and deprecation metadata.
 */

import { SUPPORTED_VERSIONS, DEFAULT_VERSION, DEPRECATION_POLICY } from './versionConfig.js';

export const VERSION_SOURCES = Object.freeze({
  ACCEPT_HEADER: 'accept_header',
  CUSTOM_HEADER: 'custom_header',
  URL_PATH: 'url_path',
  QUERY_PARAM: 'query_param',
  DEFAULT: 'default',
});

export const VERSION_HEADER_NAMES = Object.freeze([
  'accept-version',
  'api-version',
  'x-api-version',
]);

/**
 * Extract version from Accept header (RFC 7231 media type versioning)
 * Format: application/vnd.civic.v1+json or application/json; version=v1
 */
export function extractFromAcceptHeader(acceptHeader) {
  if (!acceptHeader || typeof acceptHeader !== 'string') return null;

  // Match application/vnd.civic.v{version}+json
  const vendorMatch = acceptHeader.match(/application\/vnd\.civic\.v(\d+)\+json/i);
  if (vendorMatch) {
    const version = `v${vendorMatch[1]}`;
    if (SUPPORTED_VERSIONS.includes(version)) return { version, source: VERSION_SOURCES.ACCEPT_HEADER };
  }

  // Match application/json; version=v1
  const paramMatch = acceptHeader.match(/version=([^;,\s]+)/i);
  if (paramMatch) {
    const version = normalizeVersion(paramMatch[1]);
    if (SUPPORTED_VERSIONS.includes(version)) return { version, source: VERSION_SOURCES.ACCEPT_HEADER };
  }

  return null;
}

/**
 * Extract version from custom headers
 */
export function extractFromCustomHeaders(headers) {
  if (!headers || typeof headers !== 'object') return null;
  // Normalize header keys to lowercase for case-insensitive matching
  const normalizedHeaders = {};
  for (const [key, value] of Object.entries(headers)) {
    normalizedHeaders[key.toLowerCase()] = value;
  }

  for (const headerName of VERSION_HEADER_NAMES) {
    const value = normalizedHeaders[headerName.toLowerCase()];
    if (value && typeof value === 'string') {
      const version = normalizeVersion(value);
      if (SUPPORTED_VERSIONS.includes(version)) {
        return { version, source: VERSION_SOURCES.CUSTOM_HEADER };
      }
    }
  }
  return null;
}

/**
 * Extract version from URL path (/api/v1/...)
 */
export function extractFromUrlPath(url, basePath = '/api', query = {}) {
  // Check query.path (Vercel catch-all route mapping: api/[...path].js)
  if (query && query.path) {
    const firstSegment = Array.isArray(query.path) ? query.path[0] : String(query.path).split('/')[0];
    const normalized = normalizeVersion(firstSegment);
    if (normalized && SUPPORTED_VERSIONS.includes(normalized)) {
      return { version: normalized, source: VERSION_SOURCES.URL_PATH };
    }
  }

  if (!url || typeof url !== 'string') return null;

  try {
    const parsedUrl = new URL(url, 'http://internal');
    const pathname = parsedUrl.pathname;

    // Match /api/v1/... or /v1/...
    const pathMatch = pathname.match(new RegExp(`^${basePath.replace(/\//g, '\\/')}/(v\\d+)(?:/|$)`));
    if (pathMatch) {
      const version = pathMatch[1];
      if (SUPPORTED_VERSIONS.includes(version)) return { version, source: VERSION_SOURCES.URL_PATH };
    }

    // Also check for /v1/... at root
    const rootMatch = pathname.match(/^\/(v\d+)(?:\/|$)/);
    if (rootMatch) {
      const version = rootMatch[1];
      if (SUPPORTED_VERSIONS.includes(version)) return { version, source: VERSION_SOURCES.URL_PATH };
    }
  } catch {
    // Invalid URL, ignore
  }
  return null;
}

/**
 * Extract version from query parameter
 */
export function extractFromQueryParam(query) {
  if (!query || typeof query !== 'object') return null;

  const versionParam = query.version || query.api_version || query['api-version'];
  if (versionParam) {
    const version = Array.isArray(versionParam) ? versionParam[0] : versionParam;
    const normalized = normalizeVersion(version);
    if (SUPPORTED_VERSIONS.includes(normalized)) {
      return { version: normalized, source: VERSION_SOURCES.QUERY_PARAM };
    }
  }
  return null;
}

/**
 * Normalize version string to standard format (v1, v2, etc.)
 */
export function normalizeVersion(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim().toLowerCase();
  // Accept "1", "v1", "V1", "version 1" -> "v1"
  const match = trimmed.match(/^v?(\d+)$/);
  return match ? `v${match[1]}` : null;
}

/**
 * Get deprecation metadata for a version
 */
export function getDeprecationInfo(version) {
  const policy = DEPRECATION_POLICY[version];
  if (!policy) return { deprecated: false, sunsetDate: null, warningDays: 0 };

  const now = Date.now();
  const sunsetMs = new Date(policy.sunsetDate).getTime();
  const isDeprecated = now >= sunsetMs - (policy.warningDays * 24 * 60 * 60 * 1000);
  const isSunset = now >= sunsetMs;

  return {
    deprecated: isDeprecated,
    sunset: isSunset,
    sunsetDate: policy.sunsetDate,
    warningDays: policy.warningDays,
    replacementVersion: policy.replacementVersion,
    migrationGuideUrl: policy.migrationGuideUrl,
  };
}

/**
 * Main version negotiation function.
 * Priority order: URL path > Custom header > Accept header > Query param > Default
 */
export function negotiateVersion({
  headers = {},
  url = '',
  query = {},
  basePath = '/api',
  allowDefault = true,
} = {}) {
  // 1. URL path (highest priority - explicit and cacheable)
  const fromPath = extractFromUrlPath(url, basePath, query);
  if (fromPath) return fromPath;

  // 2. Custom header (explicit client intent)
  const fromHeader = extractFromCustomHeaders(headers);
  if (fromHeader) return fromHeader;

  // 3. Accept header (standard content negotiation)
  const acceptHeader = headers['accept'] || headers['Accept'];
  const fromAccept = extractFromAcceptHeader(acceptHeader);
  if (fromAccept) return fromAccept;

  // 4. Query parameter (fallback for simple clients)
  const fromQuery = extractFromQueryParam(query);
  if (fromQuery) return fromQuery;

  // 5. Default version
  if (allowDefault) {
    return { version: DEFAULT_VERSION, source: VERSION_SOURCES.DEFAULT };
  }

  return null;
}

/**
 * Build version-related response headers
 */
export function buildVersionHeaders(negotiatedVersion, options = {}) {
  const { version, source } = negotiatedVersion;
  const deprecation = getDeprecationInfo(version);
  const headers = {};

  // Standard version header
  headers['API-Version'] = version;
  headers['X-API-Version'] = version;
  headers['X-API-Version-Source'] = source;

  // Deprecation headers (RFC 8594 Sunset header)
  if (deprecation.deprecated && !deprecation.sunset) {
    headers['Deprecation'] = 'true';
    headers['X-API-Deprecated'] = 'true';
    if (deprecation.sunsetDate) {
      // Sunset header: HTTP-date format per RFC 7234
      const sunsetDate = new Date(deprecation.sunsetDate);
      headers['Sunset'] = sunsetDate.toUTCString();
      headers['X-API-Sunset-Date'] = deprecation.sunsetDate;
    }
    if (deprecation.migrationGuideUrl) {
      headers['Link'] = `<${deprecation.migrationGuideUrl}>; rel="migration-guide"; title="Migration Guide for ${version}"`;
    }
  }

  if (deprecation.sunset) {
    headers['Sunset'] = new Date(deprecation.sunsetDate).toUTCString();
    headers['X-API-Sunset'] = 'true';
  }

  // Supported versions for discovery
  if (options.includeSupportedVersions) {
    headers['X-API-Supported-Versions'] = SUPPORTED_VERSIONS.join(', ');
  }

  // Backwards compatibility link (RFC 8288)
  if (deprecation.replacementVersion && deprecation.replacementVersion !== version) {
    const linkHeader = headers['Link'] || '';
    const newLink = `<${options.baseUrl || ''}/api/${deprecation.replacementVersion}>; rel="successor-version"`;
    headers['Link'] = linkHeader ? `${linkHeader}, ${newLink}` : newLink;
  }

  return headers;
}

/**
 * Validate that a version is supported
 */
export function isVersionSupported(version) {
  return SUPPORTED_VERSIONS.includes(version);
}

/**
 * Get all supported versions with metadata
 */
export function getSupportedVersions() {
  return SUPPORTED_VERSIONS.map(version => ({
    version,
    ...getDeprecationInfo(version),
    isDefault: version === DEFAULT_VERSION,
  }));
}