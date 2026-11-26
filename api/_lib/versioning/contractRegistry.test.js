import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContractRegistry, createRegistryWithEmbeddedContracts } from './contractRegistry.js';
import { DEFAULT_VERSION } from './versionConfig.js';

describe('ContractRegistry', () => {
  let registry;
  let mockLoader;

  beforeEach(() => {
    registry = new ContractRegistry({ cacheTtlMs: 60000 });
    mockLoader = vi.fn();
  });

  describe('registerLoader', () => {
    it('registers a loader for a supported version', () => {
      registry.registerLoader('v1', mockLoader);
      expect(registry.loaders.has('v1')).toBe(true);
    });

    it('throws for unsupported version', () => {
      expect(() => registry.registerLoader('v99', mockLoader)).toThrow('Unsupported version');
    });

    it('throws for non-function loader', () => {
      expect(() => registry.registerLoader('v1', 'not a function')).toThrow('Loader must be a function');
    });
  });

  describe('getContract', () => {
    it('returns cached contract when not stale', async () => {
      const spec = { openapi: '3.1.0', info: { title: 'Test', version: '1.0.0' }, paths: {} };
      registry.cacheContract('v1', spec, 'etag1');

      const result = await registry.getContract('v1');
      expect(result.spec).toEqual(spec);
      expect(result.fromCache).toBe(true);
    });

    it('loads contract via loader when not cached', async () => {
      const spec = { openapi: '3.1.0', info: { title: 'Test', version: '1.0.0' }, paths: {} };
      mockLoader.mockResolvedValue({ spec, etag: 'etag1' });
      registry.registerLoader('v1', mockLoader);

      const result = await registry.getContract('v1');
      expect(result.spec).toEqual(spec);
      expect(result.fromCache).toBe(false);
      expect(mockLoader).toHaveBeenCalledWith('v1');
    });

    it('returns fallback contract when loader fails', async () => {
      mockLoader.mockRejectedValue(new Error('Loader failed'));
      registry.registerLoader('v1', mockLoader);

      const result = await registry.getContract('v1');
      expect(result.spec).toBeDefined();
      expect(result.spec.info.title).toBe('Civic Help Setu API');
      expect(result.fromCache).toBe(false);
    });

    it('deduplicates concurrent loads', async () => {
      let resolve;
      const promise = new Promise(r => { resolve = r; });
      mockLoader.mockReturnValue(promise);
      registry.registerLoader('v1', mockLoader);

      const promise1 = registry.getContract('v1');
      const promise2 = registry.getContract('v1');

      expect(mockLoader).toHaveBeenCalledTimes(1);
      resolve({ spec: { openapi: '3.1.0', info: { title: 'Test', version: '1.0.0' }, paths: {} } });
      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1.spec).toEqual(result2.spec);
    });

    it('throws for unsupported version', async () => {
      await expect(registry.getContract('v99')).rejects.toThrow('Unsupported API version');
    });
  });

  describe('cacheContract', () => {
    it('caches contract with metadata', () => {
      const spec = { openapi: '3.1.0', info: { title: 'Test', version: '1.0.0' }, paths: {} };
      const result = registry.cacheContract('v1', spec, 'custom-etag');

      expect(result.spec).toEqual(spec);
      expect(result.etag).toBe('custom-etag');
      expect(result.loadedAt).toBeDefined();
      expect(result.size).toBeGreaterThan(0);
    });

    it('generates etag when not provided', () => {
      const spec = { openapi: '3.1.0', info: { title: 'Test', version: '1.0.0' }, paths: {} };
      const result = registry.cacheContract('v1', spec);
      expect(result.etag).toMatch(/^"[a-f0-9]+"$/);
    });

    it('throws for invalid spec', () => {
      expect(() => registry.cacheContract('v1', null)).toThrow('Invalid OpenAPI spec');
      expect(() => registry.cacheContract('v1', 'not an object')).toThrow('Invalid OpenAPI spec');
    });

    it('throws for oversized spec', () => {
      const largeSpec = { openapi: '3.1.0', info: { title: 'Test', version: '1.0.0' }, paths: {}, large: 'x'.repeat(2 * 1024 * 1024) };
      expect(() => registry.cacheContract('v1', largeSpec)).toThrow('exceeds maximum');
    });
  });

  describe('invalidate', () => {
    it('invalidates specific version', () => {
      registry.cacheContract('v1', { openapi: '3.1.0', info: { title: 'Test', version: '1.0.0' }, paths: {} });
      registry.invalidate('v1');
      expect(registry.store.has('v1')).toBe(false);
    });

    it('invalidates all versions when no version specified', () => {
      registry.cacheContract('v1', { openapi: '3.1.0', info: { title: 'Test', version: '1.0.0' }, paths: {} });
      registry.cacheContract('v2', { openapi: '3.1.0', info: { title: 'Test', version: '2.0.0' }, paths: {} });
      registry.invalidate();
      expect(registry.store.size).toBe(0);
    });
  });

  describe('getStatus', () => {
    it('returns status for all versions', () => {
      registry.cacheContract('v1', { openapi: '3.1.0', info: { title: 'Test', version: '1.0.0' }, paths: {} });

      const status = registry.getStatus();
      expect(status.versions.v1.cached).toBe(true);
      expect(status.versions.v2.cached).toBe(false);
      expect(status.cacheTtlMs).toBe(60000);
      expect(status.defaultVersion).toBe(DEFAULT_VERSION);
    });
  });
});

describe('createRegistryWithEmbeddedContracts', () => {
  it('creates registry with pre-loaded contracts', async () => {
    const specV1 = { openapi: '3.1.0', info: { title: 'Test', version: '1.0.0' }, paths: {} };
    const specV2 = { openapi: '3.1.0', info: { title: 'Test', version: '2.0.0' }, paths: {} };

    const registry = createRegistryWithEmbeddedContracts({ v1: specV1, v2: specV2 });

    const result1 = await registry.getContract('v1');
    const result2 = await registry.getContract('v2');

    expect(result1.spec).toEqual(specV1);
    expect(result2.spec).toEqual(specV2);
  });
});