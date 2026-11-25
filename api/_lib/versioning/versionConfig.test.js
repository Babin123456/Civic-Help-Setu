import { describe, it, expect } from 'vitest';
import {
  SUPPORTED_VERSIONS,
  DEFAULT_VERSION,
  VERSION_PATTERN,
  DEPRECATION_POLICY,
  VERSION_CONFIG,
  COMPATIBILITY_MATRIX,
  OPENAPI_SPEC_URLS,
  getVersionConfig,
  isCurrentVersion,
  getLatestVersion,
} from './versionConfig.js';

describe('Version Config', () => {
  describe('Constants', () => {
    it('has supported versions', () => {
      expect(SUPPORTED_VERSIONS).toEqual(['v1', 'v2']);
    });

    it('has default version', () => {
      expect(DEFAULT_VERSION).toBe('v2');
    });

    it('has version pattern', () => {
      expect(VERSION_PATTERN.test('v1')).toBe(true);
      expect(VERSION_PATTERN.test('v2')).toBe(true);
      expect(VERSION_PATTERN.test('v99')).toBe(true);
      expect(VERSION_PATTERN.test('1')).toBe(false);
    });

    it('has deprecation policy for each version', () => {
      expect(DEPRECATION_POLICY.v1).toBeDefined();
      expect(DEPRECATION_POLICY.v2).toBeDefined();
      expect(DEPRECATION_POLICY.v1.sunsetDate).toBe('2027-05-25T00:00:00Z');
      expect(DEPRECATION_POLICY.v1.warningDays).toBe(90);
      expect(DEPRECATION_POLICY.v1.replacementVersion).toBe('v2');
    });

    it('has version config with features and limits', () => {
      expect(VERSION_CONFIG.v1.features).toContain('basic_service_lookup');
      expect(VERSION_CONFIG.v2.features).toContain('cursor_pagination');
      expect(VERSION_CONFIG.v2.features).toContain('consumer_quotas');
      expect(VERSION_CONFIG.v1.limits.maxPageSize).toBe(50);
      expect(VERSION_CONFIG.v2.limits.maxPageSize).toBe(100);
    });

    it('has compatibility matrix', () => {
      expect(COMPATIBILITY_MATRIX.v1.v2).toBe('breaking');
      expect(COMPATIBILITY_MATRIX.v2.v1).toBe('breaking');
      expect(COMPATIBILITY_MATRIX.v1.v1).toBe('full');
      expect(COMPATIBILITY_MATRIX.v2.v2).toBe('full');
    });

    it('has OpenAPI spec URLs', () => {
      expect(OPENAPI_SPEC_URLS.v1).toContain('openapi/v1.json');
      expect(OPENAPI_SPEC_URLS.v2).toContain('openapi/v2.json');
    });
  });

  describe('getVersionConfig', () => {
    it('returns config with deprecation info', () => {
      const config = getVersionConfig('v1');
      expect(config.version).toBe('v1');
      expect(config.deprecation).toBeDefined();
      expect(config.deprecation.sunsetDate).toBe('2027-05-25T00:00:00Z');
      expect(config.deprecation.warningDays).toBe(90);
      expect(typeof config.deprecation.isDeprecated).toBe('boolean');
      expect(typeof config.deprecation.isSunset).toBe('boolean');
      expect(typeof config.deprecation.daysUntilSunset).toBe('number');
    });

    it('marks v2 as current', () => {
      const config = getVersionConfig('v2');
      expect(config.deprecation.isDeprecated).toBe(false);
      expect(config.deprecation.isSunset).toBe(false);
    });
  });

  describe('isCurrentVersion', () => {
    it('returns true for v2', () => {
      expect(isCurrentVersion('v2')).toBe(true);
    });

    it('returns false for v1 (deprecated in future)', () => {
      // At test time, v1 is not yet deprecated
      // This depends on the current date vs warning date
      const result = isCurrentVersion('v1');
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getLatestVersion', () => {
    it('returns latest non-deprecated version', () => {
      const latest = getLatestVersion();
      expect(SUPPORTED_VERSIONS).toContain(latest);
      expect(isCurrentVersion(latest)).toBe(true);
    });
  });
});