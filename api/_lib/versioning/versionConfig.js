/**
 * api/_lib/versioning/versionConfig.js
 *
 * Central version configuration for the Civic Help Setu API Gateway.
 * All version metadata, deprecation policies, and supported versions defined here.
 */

// Supported API versions in order of release (oldest first)
export const SUPPORTED_VERSIONS = Object.freeze(['v1', 'v2']);

// Default version when none specified
export const DEFAULT_VERSION = 'v2';

// Version pattern for validation
export const VERSION_PATTERN = /^v\d+$/;

// Deprecation policy per version
// - sunsetDate: ISO 8601 date when version will be permanently removed
// - warningDays: days before sunset to start sending deprecation headers
// - replacementVersion: version clients should migrate to
// - migrationGuideUrl: URL to migration documentation
export const DEPRECATION_POLICY = Object.freeze({
  v1: {
    sunsetDate: '2027-05-25T00:00:00Z', // 6 months from now
    warningDays: 90, // Start warning 90 days before sunset
    replacementVersion: 'v2',
    migrationGuideUrl: 'https://docs.civic-help-setu.org/api/migration/v1-to-v2',
  },
  v2: {
    sunsetDate: '2028-11-25T00:00:00Z', // 2 years from now
    warningDays: 180,
    replacementVersion: null,
    migrationGuideUrl: null,
  },
});

// Version-specific configuration
export const VERSION_CONFIG = Object.freeze({
  v1: {
    releaseDate: '2025-11-25T00:00:00Z',
    status: 'deprecated',
    description: 'Initial public API release',
    breakingChangesFromPrevious: [],
    features: [
      'basic_service_lookup',
      'grievance_filing',
      'feedback_submission',
      'public_toilet_search',
      'water_quality_reports',
    ],
    limits: {
      maxPageSize: 50,
      maxBatchSize: 10,
      rateLimitRpm: 60,
    },
  },
  v2: {
    releaseDate: '2026-11-25T00:00:00Z',
    status: 'current',
    description: 'Versioned gateway with consumer quotas, validation, and deprecation headers',
    breakingChangesFromPrevious: [
      'Renamed "service_id" to "serviceId" in all responses',
      'Changed error response format to RFC 7807 Problem Details',
      'Removed deprecated "category" field from service objects, use "categories" array',
      'Pagination now uses cursor-based "nextCursor" instead of "page"',
      'Authentication now requires "Authorization: Bearer" header for all mutating endpoints',
    ],
    features: [
      'basic_service_lookup',
      'grievance_filing',
      'feedback_submission',
      'public_toilet_search',
      'water_quality_reports',
      'cursor_pagination',
      'structured_errors',
      'version_negotiation',
      'consumer_quotas',
      'request_validation',
      'deprecation_headers',
      'compatibility_reporting',
    ],
    limits: {
      maxPageSize: 100,
      maxBatchSize: 50,
      rateLimitRpm: 600, // Base limit, actual limit depends on consumer tier
    },
  },
});

// Compatibility matrix: which versions are compatible with each other
// Used for compatibility reporting and client upgrade guidance
export const COMPATIBILITY_MATRIX = Object.freeze({
  v1: {
    v1: 'full',
    v2: 'breaking', // v1 clients need migration for v2
  },
  v2: {
    v1: 'breaking', // v2 clients cannot use v1
    v2: 'full',
  },
});

// OpenAPI spec URLs per version (for contract publishing)
export const OPENAPI_SPEC_URLS = Object.freeze({
  v1: 'https://api.civic-help-setu.org/openapi/v1.json',
  v2: 'https://api.civic-help-setu.org/openapi/v2.json',
});

// Helper to get version config with deprecation info
export function getVersionConfig(version) {
  const base = VERSION_CONFIG[version] || {};
  const deprecation = DEPRECATION_POLICY[version] || {};
  const now = Date.now();
  const sunsetMs = deprecation.sunsetDate ? new Date(deprecation.sunsetDate).getTime() : null;
  const warnMs = sunsetMs ? sunsetMs - (deprecation.warningDays * 24 * 60 * 60 * 1000) : null;

  return {
    ...base,
    version,
    deprecation: {
      ...deprecation,
      isDeprecated: warnMs && now >= warnMs,
      isSunset: sunsetMs && now >= sunsetMs,
      daysUntilSunset: sunsetMs ? Math.max(0, Math.ceil((sunsetMs - now) / (24 * 60 * 60 * 1000))) : null,
      daysUntilWarning: warnMs ? Math.max(0, Math.ceil((warnMs - now) / (24 * 60 * 60 * 1000))) : null,
    },
  };
}

// Helper to check if a version is current (not deprecated)
export function isCurrentVersion(version) {
  const config = getVersionConfig(version);
  return config.deprecation && !config.deprecation.isDeprecated;
}

// Helper to get the latest non-deprecated version
export function getLatestVersion() {
  for (let i = SUPPORTED_VERSIONS.length - 1; i >= 0; i--) {
    if (isCurrentVersion(SUPPORTED_VERSIONS[i])) {
      return SUPPORTED_VERSIONS[i];
    }
  }
  return DEFAULT_VERSION;
}