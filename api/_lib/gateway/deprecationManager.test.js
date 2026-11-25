import { describe, it, expect } from 'vitest';
import {
  DEPRECATION_STAGES,
  getDeprecationStage,
  getDeprecationDetail,
  buildDeprecationHeaders,
  shouldRejectVersion,
  getSunsetRejection,
  getDeprecationWarning,
  getAllVersionsDeprecationStatus,
  DeprecationManager,
} from './deprecationManager.js';
import { SUPPORTED_VERSIONS } from '../versioning/versionConfig.js';

describe('DeprecationManager', () => {
  // Use a fixed time for consistent tests
  const TEST_TIME = new Date('2026-11-25T12:00:00Z').getTime(); // Before v1 sunset (2027-05-25)

  describe('getDeprecationStage', () => {
    it('returns ACTIVE for v2 (current version)', () => {
      expect(getDeprecationStage('v2', TEST_TIME)).toBe(DEPRECATION_STAGES.ACTIVE);
    });

    it('returns DEPRECATED for v1 (within warning period)', () => {
      // v1 sunset: 2027-05-25, warning: 90 days before = 2027-02-24
      // TEST_TIME 2026-11-25 is before warning period, so should be ACTIVE
      // Let's test with a time in the warning period
      const warningTime = new Date('2027-03-01T12:00:00Z').getTime();
      expect(getDeprecationStage('v1', warningTime)).toBe(DEPRECATION_STAGES.DEPRECATED);
    });

    it('returns SUNSET for v1 after sunset date', () => {
      const sunsetTime = new Date('2027-06-01T12:00:00Z').getTime();
      expect(getDeprecationStage('v1', sunsetTime)).toBe(DEPRECATION_STAGES.SUNSET);
    });

    it('returns ACTIVE for unknown versions', () => {
      expect(getDeprecationStage('v99', TEST_TIME)).toBe(DEPRECATION_STAGES.ACTIVE);
    });
  });

  describe('getDeprecationDetail', () => {
    it('returns full detail for v1 at test time', () => {
      const detail = getDeprecationDetail('v1', TEST_TIME);
      expect(detail.version).toBe('v1');
      expect(detail.stage).toBe(DEPRECATION_STAGES.ACTIVE); // Not yet in warning period
      expect(detail.deprecated).toBe(false);
      expect(detail.sunset).toBe(false);
      expect(detail.sunsetDate).toBe('2027-05-25T00:00:00Z');
      expect(detail.replacementVersion).toBe('v2');
      expect(detail.migrationGuideUrl).toContain('migration/v1-to-v2');
      expect(detail.daysUntilSunset).toBeGreaterThan(0);
    });

    it('returns full detail for v2', () => {
      const detail = getDeprecationDetail('v2', TEST_TIME);
      expect(detail.version).toBe('v2');
      expect(detail.stage).toBe(DEPRECATION_STAGES.ACTIVE);
      expect(detail.deprecated).toBe(false);
      expect(detail.sunset).toBe(false);
      expect(detail.replacementVersion).toBeNull();
    });

    it('shows deprecated=true during warning period', () => {
      const warningTime = new Date('2027-03-01T12:00:00Z').getTime(); // Within 90 days of sunset
      const detail = getDeprecationDetail('v1', warningTime);
      expect(detail.deprecated).toBe(true);
      expect(detail.sunset).toBe(false);
      expect(detail.daysUntilSunset).toBeLessThan(90);
    });

    it('shows sunset=true after sunset date', () => {
      const sunsetTime = new Date('2027-06-01T12:00:00Z').getTime();
      const detail = getDeprecationDetail('v1', sunsetTime);
      expect(detail.deprecated).toBe(true);
      expect(detail.sunset).toBe(true);
      expect(detail.daysUntilSunset).toBe(0);
    });
  });

  describe('buildDeprecationHeaders', () => {
    it('returns empty headers for active version', () => {
      const headers = buildDeprecationHeaders('v2', { baseUrl: 'https://api.example.com', at: TEST_TIME });
      expect(headers['Deprecation']).toBeUndefined();
      expect(headers['Sunset']).toBeUndefined();
      expect(headers['X-API-Deprecated']).toBeUndefined();
    });

    it('includes Deprecation and Sunset headers for deprecated version', () => {
      const warningTime = new Date('2027-03-01T12:00:00Z').getTime();
      const headers = buildDeprecationHeaders('v1', { baseUrl: 'https://api.example.com', at: warningTime });

      expect(headers['Deprecation']).toBe('true');
      expect(headers['X-API-Deprecated']).toBe('true');
      expect(headers['Sunset']).toBeDefined();
      expect(headers['X-API-Sunset-Date']).toBe('2027-05-25T00:00:00Z');
      expect(headers['Link']).toContain('rel="migration-guide"');
      expect(headers['Link']).toContain('rel="successor-version"');
    });

    it('includes Sunset header for sunset version', () => {
      const sunsetTime = new Date('2027-06-01T12:00:00Z').getTime();
      const headers = buildDeprecationHeaders('v1', { baseUrl: 'https://api.example.com', at: sunsetTime });

      expect(headers['Sunset']).toBeDefined();
      expect(headers['X-API-Sunset']).toBe('true');
    });

    it('includes latest version link', () => {
      const headers = buildDeprecationHeaders('v1', { baseUrl: 'https://api.example.com', at: TEST_TIME });
      expect(headers['Link']).toContain('rel="latest-version"');
    });
  });

  describe('shouldRejectVersion', () => {
    it('returns false for active version', () => {
      expect(shouldRejectVersion('v2', TEST_TIME)).toBe(false);
      expect(shouldRejectVersion('v1', TEST_TIME)).toBe(false); // Not yet sunset
    });

    it('returns true for sunset version', () => {
      const sunsetTime = new Date('2027-06-01T12:00:00Z').getTime();
      expect(shouldRejectVersion('v1', sunsetTime)).toBe(true);
    });
  });

  describe('getSunsetRejection', () => {
    it('returns 410 response with migration info', () => {
      const rejection = getSunsetRejection('v1', { baseUrl: 'https://api.example.com' });

      expect(rejection.status).toBe(410);
      expect(rejection.body.error).toBe('version_sunset');
      expect(rejection.body.code).toBe('VERSION_SUNSET');
      expect(rejection.body.recommendedVersion).toBe('v2');
      expect(rejection.body.migrationGuide).toContain('migration/v1-to-v2');
      expect(rejection.headers['Sunset']).toBeDefined();
    });
  });

  describe('getDeprecationWarning', () => {
    it('returns warning body for deprecated version', () => {
      const warningTime = new Date('2027-03-01T12:00:00Z').getTime();
      const warning = getDeprecationWarning('v1', { baseUrl: 'https://api.example.com', at: warningTime });

      expect(warning.body.warning).toBe('api_deprecated');
      expect(warning.body.code).toBe('API_DEPRECATED');
      expect(warning.body.daysUntilSunset).toBeLessThan(90);
      expect(warning.headers['Deprecation']).toBe('true');
    });
  });

  describe('getAllVersionsDeprecationStatus', () => {
    it('returns status for all versions', () => {
      const statuses = getAllVersionsDeprecationStatus(TEST_TIME);
      expect(statuses).toHaveLength(SUPPORTED_VERSIONS.length);
      expect(statuses.map(s => s.version)).toEqual(SUPPORTED_VERSIONS);
    });
  });

  describe('DeprecationManager class', () => {
    it('uses custom policies when set', () => {
      const manager = new DeprecationManager({ now: () => TEST_TIME });
      manager.setPolicy('v1', { sunsetDate: '2026-12-01T00:00:00Z', warningDays: 30, replacementVersion: 'v2' });

      const detail = manager.getDetail('v1');
      expect(detail.sunsetDate).toBe('2026-12-01T00:00:00Z');
      expect(detail.warningDays).toBe(30);
    });

    it('includes custom warning message', () => {
      const manager = new DeprecationManager({ now: () => TEST_TIME });
      manager.setCustomWarning('v1', 'Custom deprecation notice');

      const detail = manager.getDetail('v1');
      expect(detail.customWarning).toBe('Custom deprecation notice');
    });

    it('buildHeaders uses custom policies', () => {
      const manager = new DeprecationManager({ now: () => TEST_TIME });
      manager.setPolicy('v1', { sunsetDate: '2026-12-01T00:00:00Z', warningDays: 30, replacementVersion: 'v2' });

      const headers = manager.buildHeaders('v1', { baseUrl: 'https://api.example.com' });
      expect(headers['Sunset']).toBeDefined();
    });
  });
});