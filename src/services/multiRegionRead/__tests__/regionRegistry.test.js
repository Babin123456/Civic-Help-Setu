/**
 * Tests for Region Registry
 */

import { describe, it, expect } from 'vitest';
import {
  getAllRegions,
  getRegion,
  getPrimaryRegion,
  getReplicaRegions,
  getRegionsByResidency,
  getRegionsForCollection,
  getPrimaryRegionForCollection,
  isValidRegion,
  getRegionDisplayName,
  getRegionWeight,
  setRegionWeightOverride,
  clearRegionWeightOverrides,
  getRequiredConsistencyForCollection,
  canReadFromRegion,
  getAllowedRegionsForRead,
  validateRegistry,
  createRuntimeConfig,
} from '../regionRegistry.js';
import { CONSISTENCY_LEVEL, RESIDENCY_CLASS } from '../types.js';

describe('Region Registry', () => {
  describe('Registry Structure', () => {
    it('has primary region asia-south1', () => {
      const primary = getPrimaryRegion();
      expect(primary.id).toBe('asia-south1');
      expect(primary.readOnly).toBe(false);
      expect(primary.residency).toBe(RESIDENCY_CLASS.INDIA);
    });

    it('has replica regions', () => {
      const replicas = getReplicaRegions();
      expect(replicas.length).toBeGreaterThan(0);
      for (const replica of replicas) {
        expect(replica.readOnly).toBe(true);
        expect(replica.residency).toBe(RESIDENCY_CLASS.GLOBAL);
        expect(replica.weight).toBeGreaterThan(0);
      }
    });

    it('includes expected regions', () => {
      const all = getAllRegions();
      const ids = all.map((r) => r.id);
      expect(ids).toContain('asia-south1');
      expect(ids).toContain('us-central1');
      expect(ids).toContain('europe-west1');
      expect(ids).toContain('asia-southeast1');
      expect(ids).toContain('australia-southeast1');
    });
  });

  describe('Region Lookup', () => {
    it('gets region by ID', () => {
      const region = getRegion('us-central1');
      expect(region).not.toBeNull();
      expect(region.id).toBe('us-central1');
      expect(region.displayName).toBe('Iowa, USA');
    });

    it('returns null for unknown region', () => {
      expect(getRegion('unknown-region')).toBeNull();
    });

    it('validates region IDs', () => {
      expect(isValidRegion('asia-south1')).toBe(true);
      expect(isValidRegion('us-central1')).toBe(true);
      expect(isValidRegion('invalid')).toBe(false);
    });

    it('gets display names', () => {
      expect(getRegionDisplayName('us-central1')).toBe('Iowa, USA');
      expect(getRegionDisplayName('unknown')).toBe('unknown');
    });
  });

  describe('Residency Filtering', () => {
    it('filters by residency class', () => {
      const indiaRegions = getRegionsByResidency(RESIDENCY_CLASS.INDIA);
      const globalRegions = getRegionsByResidency(RESIDENCY_CLASS.GLOBAL);

      expect(indiaRegions.length).toBe(1);
      expect(indiaRegions[0].id).toBe('asia-south1');

      expect(globalRegions.length).toBeGreaterThan(0);
      for (const r of globalRegions) {
        expect(r.residency).toBe(RESIDENCY_CLASS.GLOBAL);
      }
    });
  });

  describe('Collection Routing', () => {
    it('routes sensitive collections to India regions only', () => {
      const regions = getRegionsForCollection('users');
      expect(regions.length).toBe(1);
      expect(regions[0].id).toBe('asia-south1');
    });

    it('routes admin collections to India regions only', () => {
      const regions = getRegionsForCollection('roles');
      expect(regions.length).toBe(1);
      expect(regions[0].id).toBe('asia-south1');
    });

    it('routes public collections to all regions', () => {
      const regions = getRegionsForCollection('services');
      expect(regions.length).toBeGreaterThan(1);
    });

    it('routes anonymized submissions to all regions', () => {
      const regions = getRegionsForCollection('errorReports');
      expect(regions.length).toBeGreaterThan(1);
    });

    it('gets primary region for collection', () => {
      const primary = getPrimaryRegionForCollection('services');
      expect(primary.id).toBe('asia-south1');
      expect(primary.readOnly).toBe(false);
    });
  });

  describe('Read Permission Checks', () => {
    it('allows reading public data from any region', () => {
      expect(canReadFromRegion('services', 'us-central1')).toBe(true);
      expect(canReadFromRegion('services', 'europe-west1')).toBe(true);
    });

    it('denies reading sensitive data from non-India regions', () => {
      expect(canReadFromRegion('users', 'us-central1')).toBe(false);
      expect(canReadFromRegion('applications', 'europe-west1')).toBe(false);
    });

    it('allows reading sensitive data from India region', () => {
      expect(canReadFromRegion('users', 'asia-south1')).toBe(true);
    });
  });

  describe('Allowed Regions for Read', () => {
    it('returns primary for sensitive collections', () => {
      const regions = getAllowedRegionsForRead('users', {});
      expect(regions.length).toBe(1);
      expect(regions[0].id).toBe('asia-south1');
    });

    it('respects explicit region header for public data', () => {
      const regions = getAllowedRegionsForRead('services', { explicitRegion: 'us-central1' });
      expect(regions.length).toBe(1);
      expect(regions[0].id).toBe('us-central1');
    });

    it('rejects explicit region for sensitive data', () => {
      const regions = getAllowedRegionsForRead('users', { explicitRegion: 'us-central1' });
      // Falls back to allowed regions (India only)
      expect(regions.length).toBe(1);
      expect(regions[0].id).toBe('asia-south1');
    });

    it('allows admin to read from primary for any collection', () => {
      const regions = getAllowedRegionsForRead('users', { isAdmin: true });
      expect(regions.length).toBe(1);
      expect(regions[0].id).toBe('asia-south1');
    });
  });

  describe('Consistency Requirements', () => {
    it('requires STRONG for sensitive collections', () => {
      expect(getRequiredConsistencyForCollection('users')).toBe(CONSISTENCY_LEVEL.STRONG);
      expect(getRequiredConsistencyForCollection('applications')).toBe(CONSISTENCY_LEVEL.STRONG);
    });

    it('defaults to BOUNDED_STALE for public collections', () => {
      expect(getRequiredConsistencyForCollection('services')).toBe(CONSISTENCY_LEVEL.BOUNDED_STALE);
      expect(getRequiredConsistencyForCollection('notices')).toBe(CONSISTENCY_LEVEL.BOUNDED_STALE);
    });
  });

  describe('Weight Overrides', () => {
    it('returns base weight when no override', () => {
      const overrides = {};
      expect(getRegionWeight('us-central1', overrides)).toBe(100);
    });

    it('returns overridden weight', () => {
      const overrides = {};
      setRegionWeightOverride(overrides, 'us-central1', 50);
      expect(getRegionWeight('us-central1', overrides)).toBe(50);
    });

    it('clamps weight to valid range', () => {
      const overrides = {};
      setRegionWeightOverride(overrides, 'us-central1', -10);
      expect(getRegionWeight('us-central1', overrides)).toBe(0);
      setRegionWeightOverride(overrides, 'us-central1', 2000);
      expect(getRegionWeight('us-central1', overrides)).toBe(1000);
    });

    it('clears all overrides', () => {
      const overrides = {};
      setRegionWeightOverride(overrides, 'us-central1', 50);
      setRegionWeightOverride(overrides, 'europe-west1', 25);
      clearRegionWeightOverrides(overrides);
      expect(getRegionWeight('us-central1', overrides)).toBe(100);
      expect(getRegionWeight('europe-west1', overrides)).toBe(100);
    });
  });

  describe('Registry Validation', () => {
    it('validates current registry', () => {
      const result = validateRegistry();
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });
  });

  describe('Runtime Config', () => {
    it('creates config from env', () => {
      const env = {
        MULTI_REGION_READS_ENABLED: 'true',
        MULTI_REGION_READS_ROLLOUT_PERCENT: '50',
        MULTI_REGION_PRIMARY_REGION: 'asia-south1',
      };
      const config = createRuntimeConfig(env);
      expect(config.enabled).toBe(true);
      expect(config.rolloutPercent).toBe(50);
      expect(config.primaryRegionId).toBe('asia-south1');
    });

    it('defaults when env not set', () => {
      const config = createRuntimeConfig({});
      expect(config.enabled).toBe(true);
      expect(config.rolloutPercent).toBe(100);
      expect(config.primaryRegionId).toBe('asia-south1');
    });

    it('handles disabled flag', () => {
      const config = createRuntimeConfig({ MULTI_REGION_READS_ENABLED: 'false' });
      expect(config.enabled).toBe(false);
    });
  });
});