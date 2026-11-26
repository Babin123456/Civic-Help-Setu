/**
 * src/services/distributedCache/__tests__/cacheKey.test.js
 *
 * Unit tests for cache key building and parsing.
 */

import { describe, it, expect } from 'vitest';
import {
  buildCacheKey,
  parseCacheKey,
  buildServiceCatalogueKey,
  buildServiceCatalogueListKey,
  buildPublicReferenceKey,
  buildJurisdictionKey,
  buildOfficeDirectoryKey,
  buildInvalidationPattern,
  keyMatchesPattern,
  extractIdentityContext,
  computeIdentityHash,
} from '../cacheKey.js';

describe('Cache Key', () => {
  describe('extractIdentityContext', () => {
    it('extracts user ID from auth', () => {
      const req = { auth: { userId: 'user123' } };
      const ctx = extractIdentityContext(req);
      expect(ctx.userId).toBe('user123');
    });

    it('extracts user ID from headers', () => {
      const req = { headers: { 'x-user-id': 'user456' } };
      const ctx = extractIdentityContext(req);
      expect(ctx.userId).toBe('user456');
    });

    it('extracts tenant ID', () => {
      const req = { headers: { 'x-tenant-id': 'tenant789' } };
      const ctx = extractIdentityContext(req);
      expect(ctx.tenantId).toBe('tenant789');
    });

    it('extracts jurisdiction code', () => {
      const req = { headers: { 'x-jurisdiction-code': 'KA' } };
      const ctx = extractIdentityContext(req);
      expect(ctx.jurisdictionCode).toBe('KA');
    });

    it('extracts session ID', () => {
      const req = { headers: { 'x-session-id': 'session123' } };
      const ctx = extractIdentityContext(req);
      expect(ctx.sessionId).toBe('session123');
    });

    it('returns null for missing values', () => {
      const req = { headers: {} };
      const ctx = extractIdentityContext(req);
      expect(ctx.userId).toBeNull();
      expect(ctx.tenantId).toBeNull();
      expect(ctx.jurisdictionCode).toBeNull();
      expect(ctx.sessionId).toBeNull();
    });

    it('handles case-insensitive headers', () => {
      const req = { headers: { 'X-USER-ID': 'user123', 'X-TENANT-ID': 'tenant456' } };
      const ctx = extractIdentityContext(req);
      expect(ctx.userId).toBe('user123');
      expect(ctx.tenantId).toBe('tenant456');
    });
  });

  describe('computeIdentityHash', () => {
    it('returns empty string when isolation disabled', () => {
      const ctx = { userId: 'user123', tenantId: 'tenant456' };
      expect(computeIdentityHash(ctx, false)).toBe('');
    });

    it('returns empty string for no identity', () => {
      const ctx = { userId: null, tenantId: null, jurisdictionCode: null, sessionId: null };
      expect(computeIdentityHash(ctx, true)).toBe('');
    });

    it('generates hash for user ID', () => {
      const ctx = { userId: 'user123', tenantId: null, jurisdictionCode: null, sessionId: null };
      const hash = computeIdentityHash(ctx, true);
      expect(hash).toHaveLength(16);
      expect(hash).toMatch(/^[a-f0-9]{16}$/);
    });

    it('generates hash for tenant ID', () => {
      const ctx = { userId: null, tenantId: 'tenant456', jurisdictionCode: null, sessionId: null };
      const hash = computeIdentityHash(ctx, true);
      expect(hash).toHaveLength(16);
    });

    it('generates hash for jurisdiction', () => {
      const ctx = { userId: null, tenantId: null, jurisdictionCode: 'KA', sessionId: null };
      const hash = computeIdentityHash(ctx, true);
      expect(hash).toHaveLength(16);
    });

    it('generates hash for session when no user', () => {
      const ctx = { userId: null, tenantId: null, jurisdictionCode: null, sessionId: 'session123' };
      const hash = computeIdentityHash(ctx, true);
      expect(hash).toHaveLength(16);
    });

    it('does not use session when user ID present', () => {
      const ctx = { userId: 'user123', tenantId: null, jurisdictionCode: null, sessionId: 'session123' };
      const hash = computeIdentityHash(ctx, true);
      // Should not include session in hash when userId present
      const ctx2 = { userId: 'user123', tenantId: null, jurisdictionCode: null, sessionId: 'different' };
      const hash2 = computeIdentityHash(ctx2, true);
      expect(hash).toBe(hash2);
    });

    it('is deterministic', () => {
      const ctx = { userId: 'user123', tenantId: 'tenant456', jurisdictionCode: 'KA', sessionId: null };
      const hash1 = computeIdentityHash(ctx, true);
      const hash2 = computeIdentityHash(ctx, true);
      expect(hash1).toBe(hash2);
    });
  });

  describe('buildCacheKey', () => {
    it('builds basic key', () => {
      const key = buildCacheKey({ namespace: 'svc_cat', resourcePath: 'services/driving-license' });
      expect(key).toBe('svc_cat:services/driving-license');
    });

    it('includes identity hash when isolation enabled', () => {
      const key = buildCacheKey({
        namespace: 'svc_cat',
        resourcePath: 'services/driving-license',
        identityContext: { userId: 'user123' },
        enforceIsolation: true,
      });
      expect(key).toMatch(/^svc_cat:services\/driving-license#[a-f0-9]{16}$/);
    });

    it('excludes identity hash when isolation disabled', () => {
      const key = buildCacheKey({
        namespace: 'svc_cat',
        resourcePath: 'services/driving-license',
        identityContext: { userId: 'user123' },
        enforceIsolation: false,
      });
      expect(key).toBe('svc_cat:services/driving-license');
    });

    it('normalizes resource path', () => {
      const key = buildCacheKey({ namespace: 'svc_cat', resourcePath: 'Services/Driving License!' });
      expect(key).toBe('svc_cat:services/driving_license');
    });

    it('truncates long resource paths', () => {
      const longPath = 'a'.repeat(150);
      const key = buildCacheKey({ namespace: 'svc_cat', resourcePath: longPath });
      // namespace: + 100 chars max for resourcePath
      expect(key.length).toBeLessThanOrEqual(128);
    });

    it('throws on invalid namespace', () => {
      expect(() => buildCacheKey({ namespace: 'invalid', resourcePath: 'test' })).toThrow('Invalid namespace');
    });

    it('throws on missing resourcePath', () => {
      expect(() => buildCacheKey({ namespace: 'svc_cat', resourcePath: '' })).toThrow('resourcePath must be a non-empty string');
    });
  });

  describe('parseCacheKey', () => {
    it('parses basic key', () => {
      const parsed = parseCacheKey('svc_cat:services/driving-license');
      expect(parsed.valid).toBe(true);
      expect(parsed.namespace).toBe('svc_cat');
      expect(parsed.resourcePath).toBe('services/driving-license');
      expect(parsed.identityHash).toBeNull();
      expect(parsed.isIdentityIsolated).toBe(false);
    });

    it('parses key with identity hash', () => {
      const parsed = parseCacheKey('svc_cat:services/driving-license#abc123def4567890');
      expect(parsed.valid).toBe(true);
      expect(parsed.namespace).toBe('svc_cat');
      expect(parsed.resourcePath).toBe('services/driving-license');
      expect(parsed.identityHash).toBe('abc123def4567890');
      expect(parsed.isIdentityIsolated).toBe(true);
    });

    it('rejects invalid keys', () => {
      expect(parseCacheKey('').valid).toBe(false);
      expect(parseCacheKey('invalid').valid).toBe(false);
      expect(parseCacheKey('no_colon').valid).toBe(false);
    });
  });

  describe('buildServiceCatalogueKey', () => {
    it('builds service key', () => {
      const key = buildServiceCatalogueKey('driving-license');
      expect(key).toBe('svc_cat:services/driving-license');
    });

    it('includes identity when isolation enabled', () => {
      const key = buildServiceCatalogueKey('driving-license', { userId: 'user123' }, true);
      expect(key).toMatch(/^svc_cat:services\/driving-license#[a-f0-9]{16}$/);
    });
  });

  describe('buildServiceCatalogueListKey', () => {
    it('builds list key without filters', () => {
      const key = buildServiceCatalogueListKey({});
      expect(key).toBe('svc_cat:services');
    });

    it('builds list key with filters', () => {
      const key = buildServiceCatalogueListKey({ category: 'transport', state: 'KA' });
      expect(key).toContain('category_transport');
      expect(key).toContain('state_ka');
    });

    it('sorts filter keys for consistency', () => {
      const key1 = buildServiceCatalogueListKey({ b: '1', a: '2' });
      const key2 = buildServiceCatalogueListKey({ a: '2', b: '1' });
      expect(key1).toBe(key2);
    });

    it('handles array values', () => {
      const key = buildServiceCatalogueListKey({ categories: ['transport', 'health'] });
      // Array is sorted, joined with comma, then normalized (comma -> underscore)
      expect(key).toContain('categories_health_transport');
    });
  });

  describe('buildPublicReferenceKey', () => {
    it('builds public reference key', () => {
      const key = buildPublicReferenceKey('jurisdictions', 'all');
      expect(key).toBe('pub_ref:jurisdictions/all');
    });

    it('defaults to no identity isolation', () => {
      const key = buildPublicReferenceKey('jurisdictions', 'all', { userId: 'user123' });
      expect(key).toBe('pub_ref:jurisdictions/all');
    });
  });

  describe('buildJurisdictionKey', () => {
    it('builds all jurisdictions key', () => {
      const key = buildJurisdictionKey('all');
      expect(key).toBe('jurisdictions:all');
    });

    it('builds scoped key', () => {
      const key = buildJurisdictionKey('state');
      expect(key).toBe('jurisdictions:scope/state');
    });
  });

  describe('buildOfficeDirectoryKey', () => {
    it('builds office directory key', () => {
      const key = buildOfficeDirectoryKey({ district: 'Bangalore Urban' });
      expect(key).toContain('district_bangalore_urban');
    });
  });

  describe('buildInvalidationPattern', () => {
    it('builds pattern for namespace', () => {
      const pattern = buildInvalidationPattern('svc_cat', 'services');
      expect(pattern).toBe('svc_cat:services*');
    });

    it('normalizes prefix', () => {
      const pattern = buildInvalidationPattern('svc_cat', 'Services/Driving');
      expect(pattern).toBe('svc_cat:services/driving*');
    });
  });

  describe('keyMatchesPattern', () => {
    it('matches exact key when no wildcard', () => {
      expect(keyMatchesPattern('svc_cat:services/driving-license', 'svc_cat:services/driving-license')).toBe(true);
      expect(keyMatchesPattern('svc_cat:services/driving-license', 'svc_cat:services/other')).toBe(false);
    });

    it('matches prefix with wildcard', () => {
      expect(keyMatchesPattern('svc_cat:services/driving-license', 'svc_cat:services*')).toBe(true);
      expect(keyMatchesPattern('svc_cat:services/other', 'svc_cat:services*')).toBe(true);
      expect(keyMatchesPattern('pub_ref:jurisdictions/all', 'svc_cat:services*')).toBe(false);
    });
  });
});