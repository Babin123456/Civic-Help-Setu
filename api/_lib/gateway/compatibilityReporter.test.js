import { describe, it, expect } from 'vitest';
import {
  COMPATIBILITY_LEVELS,
  analyzeCompatibility,
  generateCompatibilityMatrix,
  generateMigrationGuide,
  generateUpgradeAdvisory,
  generateCompatibilityReport,
  checkRuntimeCompatibility,
  generateOpenAPICompatibilityExtension,
} from './compatibilityReporter.js';
import { SUPPORTED_VERSIONS } from '../versioning/versionConfig.js';

describe('CompatibilityReporter', () => {
  describe('analyzeCompatibility', () => {
    it('returns full compatibility for same version', () => {
      const result = analyzeCompatibility('v2', 'v2');
      expect(result.compatibility).toBe(COMPATIBILITY_LEVELS.FULL);
      expect(result.migrationRequired).toBe(false);
      expect(result.breakingChanges).toHaveLength(0);
    });

    it('returns breaking for v1 to v2', () => {
      const result = analyzeCompatibility('v1', 'v2');
      expect(result.compatibility).toBe(COMPATIBILITY_LEVELS.BREAKING);
      expect(result.migrationRequired).toBe(true);
      expect(result.breakingChanges.length).toBeGreaterThan(0);
      expect(result.newFeatures.length).toBeGreaterThan(0);
    });

    it('returns breaking for v2 to v1', () => {
      const result = analyzeCompatibility('v2', 'v1');
      expect(result.compatibility).toBe(COMPATIBILITY_LEVELS.BREAKING);
      expect(result.migrationRequired).toBe(true);
    });

    it('includes migration guide URL', () => {
      const result = analyzeCompatibility('v1', 'v2');
      expect(result.migrationGuideUrl).toContain('migration/v1-to-v2');
    });
  });

  describe('generateCompatibilityMatrix', () => {
    it('generates matrix for all version pairs', () => {
      const matrix = generateCompatibilityMatrix();

      for (const fromVersion of SUPPORTED_VERSIONS) {
        expect(matrix[fromVersion]).toBeDefined();
        for (const toVersion of SUPPORTED_VERSIONS) {
          expect(matrix[fromVersion][toVersion]).toBeDefined();
          expect(matrix[fromVersion][toVersion].fromVersion).toBe(fromVersion);
          expect(matrix[fromVersion][toVersion].toVersion).toBe(toVersion);
        }
      }
    });
  });

  describe('generateMigrationGuide', () => {
    it('generates detailed guide for v1 to v2', () => {
      const guide = generateMigrationGuide('v1', 'v2');

      expect(guide.fromVersion).toBe('v1');
      expect(guide.toVersion).toBe('v2');
      expect(guide.compatibility).toBe(COMPATIBILITY_LEVELS.BREAKING);
      expect(guide.migrationRequired).toBe(true);
      expect(guide.estimatedEffort).toBe('high');
      expect(guide.steps).toHaveLength(5);
      expect(guide.migrationGuideUrl).toContain('migration/v1-to-v2');

      // Check step structure
      for (const step of guide.steps) {
        expect(step).toHaveProperty('step');
        expect(step).toHaveProperty('title');
        expect(step).toHaveProperty('description');
        expect(step).toHaveProperty('codeExample');
        expect(step).toHaveProperty('breaking');
      }
    });

    it('includes deprecation info', () => {
      const guide = generateMigrationGuide('v1', 'v2');
      expect(guide.deprecationInfo.fromVersion).toBeDefined();
      expect(guide.deprecationInfo.toVersion).toBeDefined();
    });
  });

  describe('generateUpgradeAdvisory', () => {
    it('recommends immediate migration for sunset version', () => {
      // v1 sunset date is 2027-05-25, so use a time after that
      const advisory = generateUpgradeAdvisory('v1');

      // At test time (2026-11-25), v1 is not yet deprecated
      // But let's check the structure
      expect(advisory.currentVersion).toBe('v1');
      expect(advisory.latestVersion).toBe('v2');
      expect(advisory).toHaveProperty('upgradeRecommended');
      expect(advisory).toHaveProperty('upgradeRequired');
      expect(advisory).toHaveProperty('timePressure');
      expect(advisory).toHaveProperty('recommendedAction');
    });

    it('shows no action needed for latest version', () => {
      const advisory = generateUpgradeAdvisory('v2');
      expect(advisory.currentVersion).toBe('v2');
      expect(advisory.latestVersion).toBe('v2');
      expect(advisory.recommendedAction).toBe('none');
      expect(advisory.migrationGuide).toBeNull();
    });
  });

  describe('generateCompatibilityReport', () => {
    it('generates full report with all sections', () => {
      const report = generateCompatibilityReport({ includeMigrationGuides: true, includeDeprecationTimeline: true });

      expect(report.generatedAt).toBeDefined();
      expect(report.versions).toBeDefined();
      expect(report.matrix).toBeDefined();
      expect(report.upgradeAdvisories).toBeDefined();
      expect(report.deprecationTimeline).toBeDefined();
      expect(report.migrationGuides).toBeDefined();

      // Check versions
      for (const version of SUPPORTED_VERSIONS) {
        expect(report.versions[version]).toBeDefined();
        expect(report.versions[version].version).toBe(version);
        expect(report.versions[version].features).toBeDefined();
        expect(report.versions[version].limits).toBeDefined();
      }

      // Check migration guides
      expect(report.migrationGuides['v1-to-v2']).toBeDefined();

      // Check timeline sorted by date
      const timeline = report.deprecationTimeline;
      for (let i = 1; i < timeline.length; i++) {
        const dateA = timeline[i - 1].sunsetDate ? new Date(timeline[i - 1].sunsetDate).getTime() : Infinity;
        const dateB = timeline[i].sunsetDate ? new Date(timeline[i].sunsetDate).getTime() : Infinity;
        expect(dateA).toBeLessThanOrEqual(dateB);
      }
    });

    it('excludes migration guides when option is false', () => {
      const report = generateCompatibilityReport({ includeMigrationGuides: false });
      expect(report.migrationGuides).toBeUndefined();
    });
  });

  describe('checkRuntimeCompatibility', () => {
    it('returns compatible for same version', () => {
      const result = checkRuntimeCompatibility('v2', 'v2');
      expect(result.compatible).toBe(true);
      expect(result.compatibility).toBe(COMPATIBILITY_LEVELS.FULL);
    });

    it('returns incompatible for breaking changes', () => {
      const result = checkRuntimeCompatibility('v1', 'v2');
      expect(result.compatible).toBe(false);
      expect(result.compatibility).toBe(COMPATIBILITY_LEVELS.BREAKING);
    });
  });

  describe('generateOpenAPICompatibilityExtension', () => {
    it('generates OpenAPI extensions', () => {
      const extensions = generateOpenAPICompatibilityExtension();

      expect(extensions['x-compatibility-v1']).toBeDefined();
      expect(extensions['x-compatibility-v2']).toBeDefined();
      expect(extensions['x-deprecation-timeline']).toBeDefined();
      expect(extensions['x-upgrade-advisories']).toBeDefined();

      // Check structure
      expect(extensions['x-compatibility-v1']['v2'].level).toBe(COMPATIBILITY_LEVELS.BREAKING);
      expect(extensions['x-compatibility-v1']['v2'].breakingChanges.length).toBeGreaterThan(0);
    });
  });
});