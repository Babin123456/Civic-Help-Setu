/**
 * src/services/distributedCache/__tests__/types.test.js
 *
 * Unit tests for cache types and validation.
 */

import { describe, it, expect } from 'vitest';
import {
  CACHE_SCHEMA_VERSION,
  CACHE_KEY_PATTERN,
  CACHE_NAMESPACES,
  CACHE_CONSISTENCY,
  CACHE_ORIGIN,
  INVALIDATION_EVENT_TYPES,
  DEFAULT_CONFIG,
  validateCacheKey,
  validateCacheNamespace,
  validateCacheEntry,
  validateCacheConfig,
} from '../types.js';

describe('Cache Types', () => {
  describe('Constants', () => {
    it('has correct schema version', () => {
      expect(CACHE_SCHEMA_VERSION).toBe('1.0.0');
    });

    it('has valid key pattern', () => {
      expect(CACHE_KEY_PATTERN).toBeInstanceOf(RegExp);
      expect(CACHE_KEY_PATTERN.test('svc_cat:services/driving-license')).toBe(true);
      expect(CACHE_KEY_PATTERN.test('pub_ref:jurisdictions/all')).toBe(true);
      expect(CACHE_KEY_PATTERN.test('svc_cat:services/driving-license#abc123')).toBe(true);
      expect(CACHE_KEY_PATTERN.test('Invalid Key')).toBe(false);
      expect(CACHE_KEY_PATTERN.test('')).toBe(false);
    });

    it('has all required namespaces', () => {
      expect(CACHE_NAMESPACES.SERVICE_CATALOGUE).toBe('svc_cat');
      expect(CACHE_NAMESPACES.PUBLIC_REFERENCE).toBe('pub_ref');
      expect(CACHE_NAMESPACES.JURISDICTIONS).toBe('jurisdictions');
      expect(CACHE_NAMESPACES.SERVICE_CATEGORIES).toBe('svc_cats');
      expect(CACHE_NAMESPACES.OFFICE_DIRECTORY).toBe('office_dir');
      expect(CACHE_NAMESPACES.WELFARE_SCHEMES).toBe('welfare');
      expect(CACHE_NAMESPACES.TRANSIT_CONCESSIONS).toBe('transit');
      expect(CACHE_NAMESPACES.CIVIC_GLOSSARY).toBe('glossary');
    });

    it('has all consistency levels', () => {
      expect(CACHE_CONSISTENCY.STRONG).toBe('strong');
      expect(CACHE_CONSISTENCY.BOUNDED_STALE).toBe('bounded_stale');
      expect(CACHE_CONSISTENCY.EVENTUAL).toBe('eventual');
    });

    it('has all cache origins', () => {
      expect(CACHE_ORIGIN.ORIGIN).toBe('origin');
      expect(CACHE_ORIGIN.CACHE_HIT).toBe('cache_hit');
      expect(CACHE_ORIGIN.STALE_HIT).toBe('stale_hit');
      expect(CACHE_ORIGIN.NEGATIVE_HIT).toBe('negative_hit');
      expect(CACHE_ORIGIN.COALESCED).toBe('coalesced');
    });

    it('has all invalidation event types', () => {
      expect(INVALIDATION_EVENT_TYPES.KEY_INVALIDATED).toBe('cache.key_invalidated');
      expect(INVALIDATION_EVENT_TYPES.NAMESPACE_INVALIDATED).toBe('cache.namespace_invalidated');
      expect(INVALIDATION_EVENT_TYPES.PATTERN_INVALIDATED).toBe('cache.pattern_invalidated');
      expect(INVALIDATION_EVENT_TYPES.FULL_FLUSH).toBe('cache.full_flush');
    });
  });

  describe('DEFAULT_CONFIG', () => {
    it('has sensible defaults', () => {
      expect(DEFAULT_CONFIG.ENABLED).toBe(true);
      expect(DEFAULT_CONFIG.ROLLOUT_PERCENT).toBe(100);
      expect(DEFAULT_CONFIG.DEFAULT_TTL_MS).toBe(300000);
      expect(DEFAULT_CONFIG.MAX_TTL_MS).toBe(3600000);
      expect(DEFAULT_CONFIG.MIN_TTL_MS).toBe(1000);
      expect(DEFAULT_CONFIG.TTL_JITTER_PCT).toBe(0.15);
      expect(DEFAULT_CONFIG.STALE_WHILE_REVALIDATE_MS).toBe(60000);
      expect(DEFAULT_CONFIG.NEGATIVE_TTL_MS).toBe(30000);
      expect(DEFAULT_CONFIG.MAX_NEGATIVE_TTL_MS).toBe(120000);
      expect(DEFAULT_CONFIG.COALESCE_TIMEOUT_MS).toBe(5000);
      expect(DEFAULT_CONFIG.MAX_KEYS).toBe(10000);
      expect(DEFAULT_CONFIG.ENFORCE_IDENTITY_ISOLATION).toBe(true);
    });
  });

  describe('validateCacheKey', () => {
    it('accepts valid keys', () => {
      expect(validateCacheKey('svc_cat:services/driving-license').valid).toBe(true);
      expect(validateCacheKey('pub_ref:jurisdictions/all').valid).toBe(true);
      expect(validateCacheKey('svc_cat:services/driving-license#abc123def456').valid).toBe(true);
      expect(validateCacheKey('a'.repeat(128)).valid).toBe(true);
    });

    it('rejects invalid keys', () => {
      expect(validateCacheKey('').valid).toBe(false);
      expect(validateCacheKey(null).valid).toBe(false);
      expect(validateCacheKey(123).valid).toBe(false);
      expect(validateCacheKey('Invalid Key').valid).toBe(false);
      expect(validateCacheKey('a'.repeat(129)).valid).toBe(false);
      // # is now allowed in pattern, so this is technically valid (empty hash)
      expect(validateCacheKey('svc_cat:services/driving-license#').valid).toBe(true);
    });
  });

  describe('validateCacheNamespace', () => {
    it('accepts valid namespaces', () => {
      expect(validateCacheNamespace('svc_cat').valid).toBe(true);
      expect(validateCacheNamespace('pub_ref').valid).toBe(true);
      expect(validateCacheNamespace('jurisdictions').valid).toBe(true);
    });

    it('rejects invalid namespaces', () => {
      expect(validateCacheNamespace('invalid').valid).toBe(false);
      expect(validateCacheNamespace('').valid).toBe(false);
      expect(validateCacheNamespace(null).valid).toBe(false);
    });
  });

  describe('validateCacheEntry', () => {
    it('accepts valid positive entries', () => {
      const entry = { value: { data: 'test' }, expiresAt: Date.now() + 60000, staleExpiresAt: Date.now() + 120000 };
      expect(validateCacheEntry(entry).valid).toBe(true);
    });

    it('accepts valid negative entries', () => {
      const entry = { negative: true, value: null, expiresAt: Date.now() + 30000, staleExpiresAt: Date.now() + 30000 };
      expect(validateCacheEntry(entry).valid).toBe(true);
    });

    it('rejects entries without value or negative flag', () => {
      expect(validateCacheEntry({}).valid).toBe(false);
      expect(validateCacheEntry({ expiresAt: Date.now() + 60000 }).valid).toBe(false);
    });

    it('rejects invalid timestamps', () => {
      expect(validateCacheEntry({ value: 'test', expiresAt: -1 }).valid).toBe(false);
      expect(validateCacheEntry({ value: 'test', expiresAt: 'invalid' }).valid).toBe(false);
      expect(validateCacheEntry({ value: 'test', staleExpiresAt: 0 }).valid).toBe(false);
    });

    it('rejects invalid identityHash', () => {
      expect(validateCacheEntry({ value: 'test', expiresAt: Date.now() + 60000, identityHash: 123 }).valid).toBe(false);
    });

    it('validates namespace if present', () => {
      expect(validateCacheEntry({ value: 'test', expiresAt: Date.now() + 60000, namespace: 'invalid' }).valid).toBe(false);
    });
  });

  describe('validateCacheConfig', () => {
    it('accepts valid config', () => {
      const config = {
        DEFAULT_TTL_MS: 300000,
        TTL_JITTER_PCT: 0.1,
        ROLLOUT_PERCENT: 50,
        STORAGE_BACKEND: 'memory',
      };
      expect(validateCacheConfig(config).valid).toBe(true);
    });

    it('rejects negative numbers', () => {
      expect(validateCacheConfig({ DEFAULT_TTL_MS: -1 }).valid).toBe(false);
      expect(validateCacheConfig({ TTL_JITTER_PCT: -0.1 }).valid).toBe(false);
    });

    it('rejects TTL_JITTER_PCT > 1', () => {
      expect(validateCacheConfig({ TTL_JITTER_PCT: 1.5 }).valid).toBe(false);
    });

    it('rejects ROLLOUT_PERCENT > 100', () => {
      expect(validateCacheConfig({ ROLLOUT_PERCENT: 150 }).valid).toBe(false);
    });

    it('rejects invalid STORAGE_BACKEND', () => {
      expect(validateCacheConfig({ STORAGE_BACKEND: 'redis' }).valid).toBe(false);
    });

    it('rejects invalid CACHE_CONSISTENCY', () => {
      expect(validateCacheConfig({ CACHE_CONSISTENCY: 'invalid' }).valid).toBe(false);
    });
  });
});