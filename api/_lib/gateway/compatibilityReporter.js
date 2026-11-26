/**
 * api/_lib/gateway/compatibilityReporter.js
 *
 * API Compatibility Reporter.
 * Generates compatibility matrices, breaking change reports, and migration guides
 * between API versions. Used for documentation and client upgrade assistance.
 */

import { SUPPORTED_VERSIONS, VERSION_CONFIG, COMPATIBILITY_MATRIX, DEPRECATION_POLICY } from '../versioning/versionConfig.js';
import { getDeprecationDetail, DEPRECATION_STAGES } from './deprecationManager.js';

export const COMPATIBILITY_LEVELS = Object.freeze({
  FULL: 'full',
  BACKWARDS_COMPATIBLE: 'backwards_compatible',
  FORWARDS_COMPATIBLE: 'forwards_compatible',
  BREAKING: 'breaking',
  INCOMPATIBLE: 'incompatible',
});

/**
 * Analyze compatibility between two versions
 */
export function analyzeCompatibility(fromVersion, toVersion) {
  const matrix = COMPATIBILITY_MATRIX[fromVersion] || {};
  const directCompat = matrix[toVersion] || COMPATIBILITY_LEVELS.INCOMPATIBLE;

  const fromConfig = VERSION_CONFIG[fromVersion] || {};
  const toConfig = VERSION_CONFIG[toVersion] || {};

  // Same version = full compatibility, no breaking changes
  if (fromVersion === toVersion) {
    return {
      fromVersion,
      toVersion,
      compatibility: COMPATIBILITY_LEVELS.FULL,
      breakingChanges: [],
      newFeatures: [],
      removedFeatures: [],
      migrationRequired: false,
      migrationGuideUrl: null,
    };
  }

  // breakingChangesFromPrevious describes changes FROM previous TO this version
  // So for v1->v2, we want v2's breakingChangesFromPrevious (changes from v1 to v2)
  // For v2->v1, we want v1's breakingChangesFromPrevious (changes from v0 to v1, not applicable)
  // The matrix already tells us the compatibility level
  const breakingChanges = toConfig.breakingChangesFromPrevious || [];
  const newFeatures = (toConfig.features || []).filter(f => !(fromConfig.features || []).includes(f));
  const removedFeatures = (fromConfig.features || []).filter(f => !(toConfig.features || []).includes(f));

  return {
    fromVersion,
    toVersion,
    compatibility: directCompat,
    breakingChanges,
    newFeatures,
    removedFeatures,
    migrationRequired: directCompat === COMPATIBILITY_LEVELS.BREAKING || directCompat === COMPATIBILITY_LEVELS.INCOMPATIBLE,
    migrationGuideUrl: DEPRECATION_POLICY[fromVersion]?.migrationGuideUrl,
  };
}

/**
 * Generate full compatibility matrix for all versions
 */
export function generateCompatibilityMatrix() {
  const matrix = {};

  for (const fromVersion of SUPPORTED_VERSIONS) {
    matrix[fromVersion] = {};
    for (const toVersion of SUPPORTED_VERSIONS) {
      matrix[fromVersion][toVersion] = analyzeCompatibility(fromVersion, toVersion);
    }
  }

  return matrix;
}

/**
 * Generate migration guide from one version to another
 */
export function generateMigrationGuide(fromVersion, toVersion) {
  const compat = analyzeCompatibility(fromVersion, toVersion);
  const fromDeprecation = getDeprecationDetail(fromVersion);
  const toDeprecation = getDeprecationDetail(toVersion);

  const steps = [];

  // Version-specific migration steps
  if (fromVersion === 'v1' && toVersion === 'v2') {
    steps.push(
      {
        step: 1,
        title: 'Update Base URL and Version Header',
        description: 'Change API base path from /api/v1/ to /api/v2/ or add Accept-Version: v2 header',
        codeExample: '// Before\nGET /api/v1/services\n\n// After\nGET /api/v2/services\n// Or\nGET /api/services\nAccept-Version: v2',
        breaking: true,
      },
      {
        step: 2,
        title: 'Adapt to New Error Format (RFC 7807)',
        description: 'Error responses now follow Problem Details standard with typed error codes',
        codeExample: '// Before\n{ "error": "Not found", "details": {...} }\n\n// After\n{ "errorVersion": 1, "ok": false, "code": "NOT_FOUND", "message": "The requested item was not found.", "correlationId": "uuid" }',
        breaking: true,
      },
      {
        step: 3,
        title: 'Update Field Names to camelCase',
        description: 'All response fields now use camelCase (serviceId, not service_id)',
        codeExample: '// Before\n{ "service_id": "123", "category": "healthcare" }\n\n// After\n{ "serviceId": "123", "categories": ["healthcare"] }',
        breaking: true,
      },
      {
        step: 4,
        title: 'Migrate to Cursor-Based Pagination',
        description: 'Replace page/limit pagination with cursor-based pagination for better performance',
        codeExample: '// Before\nGET /api/v1/services?page=2&limit=20\n\n// After\nGET /api/v2/services?limit=20&cursor=eyJpZCI6MjB9\n\n// Response includes nextCursor for next page',
        breaking: true,
      },
      {
        step: 5,
        title: 'Add Authentication for Mutating Endpoints',
        description: 'All POST/PUT/PATCH/DELETE endpoints now require Authorization: Bearer header',
        codeExample: '// Before\nPOST /api/v1/feedback\n{ "message": "..." }\n\n// After\nPOST /api/v2/feedback\nAuthorization: Bearer <token>\n{ "message": "..." }',
        breaking: true,
      }
    );
  }

  return {
    fromVersion,
    toVersion,
    compatibility: compat.compatibility,
    migrationRequired: compat.migrationRequired,
    estimatedEffort: compat.breakingChanges.length > 3 ? 'high' : compat.breakingChanges.length > 0 ? 'medium' : 'low',
    deprecationInfo: {
      fromVersion: fromDeprecation,
      toVersion: toDeprecation,
    },
    breakingChanges: compat.breakingChanges,
    newFeatures: compat.newFeatures,
    removedFeatures: compat.removedFeatures,
    steps,
    migrationGuideUrl: compat.migrationGuideUrl,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Generate client upgrade advisory
 */
export function generateUpgradeAdvisory(currentVersion) {
  const currentDetail = getDeprecationDetail(currentVersion);
  const latestVersion = SUPPORTED_VERSIONS[SUPPORTED_VERSIONS.length - 1];

  const advisory = {
    currentVersion,
    currentStage: currentDetail.stage,
    latestVersion,
    upgradeRecommended: false,
    upgradeRequired: false,
    timePressure: 'none',
    recommendedAction: 'none',
    targetVersion: latestVersion,
    migrationGuide: null,
    compatibility: null,
  };

  if (currentDetail.stage === DEPRECATION_STAGES.SUNSET) {
    advisory.upgradeRequired = true;
    advisory.timePressure = 'immediate';
    advisory.recommendedAction = 'migrate_immediately';
    advisory.migrationGuide = generateMigrationGuide(currentVersion, latestVersion);
    advisory.compatibility = analyzeCompatibility(currentVersion, latestVersion);
  } else if (currentDetail.stage === DEPRECATION_STAGES.DEPRECATED) {
    advisory.upgradeRecommended = true;
    if (currentDetail.daysUntilSunset <= 30) {
      advisory.timePressure = 'urgent';
      advisory.recommendedAction = 'plan_migration_urgent';
    } else if (currentDetail.daysUntilSunset <= 90) {
      advisory.timePressure = 'soon';
      advisory.recommendedAction = 'plan_migration';
    } else {
      advisory.timePressure = 'moderate';
      advisory.recommendedAction = 'evaluate_migration';
    }
    advisory.migrationGuide = generateMigrationGuide(currentVersion, latestVersion);
    advisory.compatibility = analyzeCompatibility(currentVersion, latestVersion);
  } else if (currentVersion !== latestVersion) {
    advisory.upgradeRecommended = true;
    advisory.timePressure = 'low';
    advisory.recommendedAction = 'consider_upgrade';
    advisory.migrationGuide = generateMigrationGuide(currentVersion, latestVersion);
    advisory.compatibility = analyzeCompatibility(currentVersion, latestVersion);
  }

  return advisory;
}

/**
 * Generate compatibility report for documentation
 */
export function generateCompatibilityReport(options = {}) {
  const { includeMigrationGuides = true, includeDeprecationTimeline = true } = options;

  const report = {
    generatedAt: new Date().toISOString(),
    versions: {},
    matrix: generateCompatibilityMatrix(),
    upgradeAdvisories: {},
    deprecationTimeline: [],
  };

  for (const version of SUPPORTED_VERSIONS) {
    const config = VERSION_CONFIG[version];
    const deprecation = getDeprecationDetail(version);

    report.versions[version] = {
      version,
      status: config.status,
      releaseDate: config.releaseDate,
      features: config.features,
      limits: config.limits,
      deprecation,
    };

    report.upgradeAdvisories[version] = generateUpgradeAdvisory(version);

    if (includeDeprecationTimeline) {
      report.deprecationTimeline.push({
        version,
        stage: deprecation.stage,
        warningDate: deprecation.warningDate,
        sunsetDate: deprecation.sunsetDate,
        daysUntilSunset: deprecation.daysUntilSunset,
      });
    }
  }

  // Sort timeline by date
  report.deprecationTimeline.sort((a, b) => {
    const dateA = a.sunsetDate ? new Date(a.sunsetDate).getTime() : Infinity;
    const dateB = b.sunsetDate ? new Date(b.sunsetDate).getTime() : Infinity;
    return dateA - dateB;
  });

  if (includeMigrationGuides) {
    report.migrationGuides = {};
    for (let i = 0; i < SUPPORTED_VERSIONS.length - 1; i++) {
      const from = SUPPORTED_VERSIONS[i];
      const to = SUPPORTED_VERSIONS[i + 1];
      report.migrationGuides[`${from}-to-${to}`] = generateMigrationGuide(from, to);
    }
  }

  return report;
}

/**
 * Check if a client version is compatible with server version
 * Used for runtime compatibility checks
 * Returns compatible: false for BREAKING and INCOMPATIBLE (client needs migration)
 */
export function checkRuntimeCompatibility(clientVersion, serverVersion) {
  const compat = analyzeCompatibility(clientVersion, serverVersion);

  return {
    compatible: compat.compatibility === COMPATIBILITY_LEVELS.FULL || compat.compatibility === COMPATIBILITY_LEVELS.BACKWARDS_COMPATIBLE || compat.compatibility === COMPATIBILITY_LEVELS.FORWARDS_COMPATIBLE,
    compatibility: compat.compatibility,
    warnings: [],
    errors: [],
  };
}

/**
 * Generate OpenAPI extension for compatibility info
 * Can be embedded in OpenAPI specs
 */
export function generateOpenAPICompatibilityExtension() {
  const matrix = generateCompatibilityMatrix();
  const extensions = {};

  for (const fromVersion of SUPPORTED_VERSIONS) {
    extensions[`x-compatibility-${fromVersion}`] = {};
    for (const toVersion of SUPPORTED_VERSIONS) {
      const compat = matrix[fromVersion][toVersion];
      extensions[`x-compatibility-${fromVersion}`][toVersion] = {
        level: compat.compatibility,
        breakingChanges: compat.breakingChanges,
        migrationGuide: compat.migrationGuideUrl,
      };
    }
  }

  extensions['x-deprecation-timeline'] = SUPPORTED_VERSIONS.map(v => ({
    version: v,
    ...getDeprecationDetail(v),
  }));

  extensions['x-upgrade-advisories'] = {};
  for (const version of SUPPORTED_VERSIONS) {
    extensions['x-upgrade-advisories'][version] = generateUpgradeAdvisory(version);
  }

  return extensions;
}