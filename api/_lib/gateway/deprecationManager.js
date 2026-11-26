/**
 * api/_lib/gateway/deprecationManager.js
 *
 * Deprecation Policy Manager.
 * Handles sunset policies, deprecation headers, and migration guidance.
 * Integrates with version negotiation to inject appropriate headers.
 */

import { DEPRECATION_POLICY, SUPPORTED_VERSIONS } from '../versioning/versionConfig.js';

export const DEPRECATION_STAGES = Object.freeze({
  ACTIVE: 'active',
  DEPRECATED: 'deprecated',
  SUNSET: 'sunset',
  REMOVED: 'removed',
});

/**
 * Calculate deprecation stage for a version at a given time
 */
export function getDeprecationStage(version, at = Date.now()) {
  const policy = DEPRECATION_POLICY[version];
  if (!policy) return DEPRECATION_STAGES.ACTIVE;

  const sunsetMs = new Date(policy.sunsetDate).getTime();
  const warnMs = sunsetMs - (policy.warningDays * 24 * 60 * 60 * 1000);

  if (at >= sunsetMs) return DEPRECATION_STAGES.SUNSET;
  if (at >= warnMs) return DEPRECATION_STAGES.DEPRECATED;
  return DEPRECATION_STAGES.ACTIVE;
}

/**
 * Get detailed deprecation information
 */
export function getDeprecationDetail(version, at = Date.now()) {
  const policy = DEPRECATION_POLICY[version];
  if (!policy) {
    return {
      version,
      stage: DEPRECATION_STAGES.ACTIVE,
      deprecated: false,
      sunset: false,
      daysUntilWarning: null,
      daysUntilSunset: null,
      warningDate: null,
      sunsetDate: null,
      replacementVersion: null,
      migrationGuideUrl: null,
    };
  }

  const sunsetMs = new Date(policy.sunsetDate).getTime();
  const warnMs = sunsetMs - (policy.warningDays * 24 * 60 * 60 * 1000);
  const stage = getDeprecationStage(version, at);

  return {
    version,
    stage,
    deprecated: stage === DEPRECATION_STAGES.DEPRECATED || stage === DEPRECATION_STAGES.SUNSET,
    sunset: stage === DEPRECATION_STAGES.SUNSET,
    daysUntilWarning: warnMs > at ? Math.ceil((warnMs - at) / (24 * 60 * 60 * 1000)) : 0,
    daysUntilSunset: sunsetMs > at ? Math.ceil((sunsetMs - at) / (24 * 60 * 60 * 1000)) : 0,
    warningDate: new Date(warnMs).toISOString(),
    sunsetDate: policy.sunsetDate,
    replacementVersion: policy.replacementVersion,
    migrationGuideUrl: policy.migrationGuideUrl,
  };
}

/**
 * Build deprecation headers for a response
 * Follows RFC 8594 (Sunset header) and de facto Deprecation header standard
 */
export function buildDeprecationHeaders(version, options = {}) {
  const { baseUrl = '', includeLinks = true, at = Date.now() } = options;
  const detail = getDeprecationDetail(version, at);
  const headers = {};

  // Standard Deprecation header (draft standard)
  if (detail.deprecated) {
    headers['Deprecation'] = 'true';
  }

  // Sunset header (RFC 8594) - HTTP-date format
  // Only include when version is deprecated or sunset
  if (detail.deprecated || detail.sunset) {
    if (detail.sunsetDate) {
      const sunsetDate = new Date(detail.sunsetDate);
      headers['Sunset'] = sunsetDate.toUTCString();
    }
  }

  // Custom headers for easier client parsing
  if (detail.deprecated) {
    headers['X-API-Deprecated'] = 'true';
    headers['X-API-Deprecation-Stage'] = detail.stage;
    headers['X-API-Warning-Date'] = detail.warningDate;
    headers['X-API-Sunset-Date'] = detail.sunsetDate;
  }

  if (detail.sunset) {
    headers['X-API-Sunset'] = 'true';
  }

  // Link headers for migration guidance (RFC 8288)
  if (includeLinks) {
    const links = [];

    if (detail.migrationGuideUrl) {
      links.push(`<${detail.migrationGuideUrl}>; rel="migration-guide"; title="Migration Guide for ${version} to ${detail.replacementVersion}"`);
    }

    if (detail.replacementVersion && baseUrl) {
      links.push(`<${baseUrl}/api/${detail.replacementVersion}>; rel="successor-version"; title="API ${detail.replacementVersion}"`);
    }

    // Add link to latest version
    const latestVersion = SUPPORTED_VERSIONS[SUPPORTED_VERSIONS.length - 1];
    if (latestVersion !== version && baseUrl) {
      links.push(`<${baseUrl}/api/${latestVersion}>; rel="latest-version"; title="Latest API Version"`);
    }

    if (links.length > 0) {
      headers['Link'] = links.join(', ');
    }
  }

  return headers;
}

/**
 * Check if a version should be rejected (sunset)
 */
export function shouldRejectVersion(version, at = Date.now()) {
  const stage = getDeprecationStage(version, at);
  return stage === DEPRECATION_STAGES.SUNSET || stage === DEPRECATION_STAGES.REMOVED;
}

/**
 * Get rejection response for sunset version
 * Forces sunset headers regardless of current time
 */
export function getSunsetRejection(version, options = {}) {
  const { baseUrl = '' } = options;
  // Use a far-future time to ensure version is in sunset stage
  const farFuture = new Date('2099-12-31T23:59:59Z').getTime();
  const detail = getDeprecationDetail(version, farFuture);
  const replacementVersion = detail.replacementVersion || SUPPORTED_VERSIONS[SUPPORTED_VERSIONS.length - 1];

  return {
    status: 410,
    headers: buildDeprecationHeaders(version, { baseUrl, includeLinks: true, at: farFuture }),
    body: {
      error: 'version_sunset',
      code: 'VERSION_SUNSET',
      message: `API version ${version} has been sunset and is no longer available.`,
      deprecatedSince: detail.warningDate,
      sunsetDate: detail.sunsetDate,
      migrationGuide: detail.migrationGuideUrl,
      recommendedVersion: replacementVersion,
      supportedVersions: SUPPORTED_VERSIONS.filter(v => getDeprecationStage(v, farFuture) !== DEPRECATION_STAGES.REMOVED),
    },
  };
}

/**
 * Get deprecation warning for deprecated but not sunset version
 */
export function getDeprecationWarning(version, options = {}) {
  const { at = Date.now(), baseUrl = '' } = options;
  const detail = getDeprecationDetail(version, at);

  return {
    headers: buildDeprecationHeaders(version, { baseUrl, includeLinks: true, at }),
    body: {
      warning: 'api_deprecated',
      code: 'API_DEPRECATED',
      message: `API version ${version} is deprecated and will be sunset on ${detail.sunsetDate}.`,
      deprecatedSince: detail.warningDate,
      sunsetDate: detail.sunsetDate,
      daysUntilSunset: detail.daysUntilSunset,
      migrationGuide: detail.migrationGuideUrl,
      recommendedVersion: detail.replacementVersion,
    },
  };
}

/**
 * Get all versions with their deprecation status
 */
export function getAllVersionsDeprecationStatus(at = Date.now()) {
  return SUPPORTED_VERSIONS.map(version => getDeprecationDetail(version, at));
}

/**
 * Deprecation policy configuration (can be extended for dynamic policies)
 */
export class DeprecationManager {
  constructor(options = {}) {
    this.policies = { ...DEPRECATION_POLICY };
    this.customWarnings = new Map(); // version -> custom warning message
    this.now = options.now || Date.now;
  }

  /**
   * Set custom deprecation policy for a version
   */
  setPolicy(version, policy) {
    if (!SUPPORTED_VERSIONS.includes(version)) {
      throw new Error(`Unsupported version: ${version}`);
    }
    this.policies[version] = { ...this.policies[version], ...policy };
  }

  /**
   * Set custom warning message for a version
   */
  setCustomWarning(version, message) {
    this.customWarnings.set(version, message);
  }

  /**
   * Get deprecation detail using custom policies
   */
  getDetail(version, at = this.now()) {
    const policy = this.policies[version];
    if (!policy) {
      return getDeprecationDetail(version, at);
    }

    const sunsetMs = new Date(policy.sunsetDate).getTime();
    const warnMs = sunsetMs - (policy.warningDays * 24 * 60 * 60 * 1000);
    const stage = at >= sunsetMs ? DEPRECATION_STAGES.SUNSET : (at >= warnMs ? DEPRECATION_STAGES.DEPRECATED : DEPRECATION_STAGES.ACTIVE);

    return {
      version,
      stage,
      deprecated: stage === DEPRECATION_STAGES.DEPRECATED || stage === DEPRECATION_STAGES.SUNSET,
      sunset: stage === DEPRECATION_STAGES.SUNSET,
      daysUntilWarning: warnMs > at ? Math.ceil((warnMs - at) / (24 * 60 * 60 * 1000)) : 0,
      daysUntilSunset: sunsetMs > at ? Math.ceil((sunsetMs - at) / (24 * 60 * 60 * 1000)) : 0,
      warningDays: policy.warningDays,
      warningDate: new Date(warnMs).toISOString(),
      sunsetDate: policy.sunsetDate,
      replacementVersion: policy.replacementVersion,
      migrationGuideUrl: policy.migrationGuideUrl,
      customWarning: this.customWarnings.get(version),
    };
  }

  /**
   * Build headers using custom policies
   */
  buildHeaders(version, options = {}) {
    const detail = this.getDetail(version);
    const { baseUrl = '', includeLinks = true } = options;
    const headers = {};

    if (detail.deprecated) headers['Deprecation'] = 'true';
    if (detail.deprecated || detail.sunset) {
      if (detail.sunsetDate) headers['Sunset'] = new Date(detail.sunsetDate).toUTCString();
    }
    if (detail.deprecated) {
      headers['X-API-Deprecated'] = 'true';
      headers['X-API-Deprecation-Stage'] = detail.stage;
      headers['X-API-Warning-Date'] = detail.warningDate;
      headers['X-API-Sunset-Date'] = detail.sunsetDate;
    }
    if (detail.sunset) headers['X-API-Sunset'] = 'true';

    if (includeLinks) {
      const links = [];
      if (detail.migrationGuideUrl) {
        links.push(`<${detail.migrationGuideUrl}>; rel="migration-guide"`);
      }
      if (detail.replacementVersion && baseUrl) {
        links.push(`<${baseUrl}/api/${detail.replacementVersion}>; rel="successor-version"`);
      }
      if (links.length > 0) headers['Link'] = links.join(', ');
    }

    return headers;
  }

  /**
   * Check if version should be rejected
   */
  shouldReject(version, at = this.now()) {
    const detail = this.getDetail(version, at);
    return detail.sunset;
  }
}