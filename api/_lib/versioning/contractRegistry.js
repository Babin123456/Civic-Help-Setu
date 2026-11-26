/* global process, Buffer */
/**
 * api/_lib/versioning/contractRegistry.js
 *
 * OpenAPI Contract Registry for versioned API contracts.
 * Stores, validates, and serves OpenAPI 3.1 specifications per version.
 * Supports in-memory caching with optional durable storage.
 */

import { SUPPORTED_VERSIONS, DEFAULT_VERSION, OPENAPI_SPEC_URLS } from './versionConfig.js';
import { OPENAPI_SPECS } from './specs/index.js';

const CONTRACT_CACHE_TTL_MS = parseInt(process.env.GATEWAY_VALIDATION_CACHE_TTL_MS || '300000', 10);
const MAX_CONTRACT_SIZE = 1024 * 1024; // 1MB max per contract

/**
 * In-memory contract store with TTL-based caching
 */
export class ContractRegistry {
  constructor(options = {}) {
    this.store = options.store || new Map(); // version -> { spec, etag, loadedAt, size }
    this.cacheTtlMs = options.cacheTtlMs || CONTRACT_CACHE_TTL_MS;
    this.now = options.now || Date.now;
    this.loaders = new Map(); // version -> loader function
    this.loading = new Map(); // version -> Promise (deduplication)
  }

  /**
   * Register a contract loader for a version
   * Loader should return { spec: object, etag?: string } or throw
   */
  registerLoader(version, loader) {
    if (!SUPPORTED_VERSIONS.includes(version)) {
      throw new Error(`Unsupported version: ${version}`);
    }
    if (typeof loader !== 'function') {
      throw new TypeError('Loader must be a function');
    }
    this.loaders.set(version, loader);
  }

  /**
   * Get a contract, loading it if necessary
   */
  async getContract(version) {
    const normalizedVersion = version || DEFAULT_VERSION;
    if (!SUPPORTED_VERSIONS.includes(normalizedVersion)) {
      throw new Error(`Unsupported API version: ${normalizedVersion}`);
    }

    // Check cache first
    const cached = this.store.get(normalizedVersion);
    if (cached && !this.isStale(cached)) {
      return { ...cached, fromCache: true };
    }

    // Deduplicate concurrent loads
    if (this.loading.has(normalizedVersion)) {
      return this.loading.get(normalizedVersion);
    }

    const loadPromise = this.loadContract(normalizedVersion);
    this.loading.set(normalizedVersion, loadPromise);

    try {
      const result = await loadPromise;
      return { ...result, fromCache: false };
    } finally {
      this.loading.delete(normalizedVersion);
    }
  }

  /**
   * Load contract from registered loader or default source
   */
  async loadContract(version) {
    const loader = this.loaders.get(version);

    if (loader) {
      try {
        const result = await loader(version);
        return this.cacheContract(version, result.spec, result.etag);
      } catch (err) {
        console.warn(`Loader for ${version} failed, using fallback:`, err.message);
        // Fall through to fallback
      }
    }

    // Fallback: try to fetch from configured URL
    const specUrl = OPENAPI_SPEC_URLS[version];
    if (specUrl && typeof fetch === 'function') {
      try {
        const response = await fetch(specUrl, {
          headers: { 'Accept': 'application/json' },
          // Short timeout for contract fetching
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const spec = await response.json();
        const etag = response.headers.get('etag') || response.headers.get('ETag');
        return this.cacheContract(version, spec, etag);
      } catch (err) {
        // Log but don't throw - allow fallback to embedded spec
        console.warn(`Failed to fetch OpenAPI spec for ${version} from ${specUrl}:`, err.message);
      }
    }

    // Last resort: return minimal valid spec
    return this.getFallbackContract(version);
  }

  /**
   * Cache a contract with metadata
   */
  cacheContract(version, spec, etag = null) {
    if (!spec || typeof spec !== 'object') {
      throw new Error('Invalid OpenAPI spec: must be an object');
    }

    const jsonStr = JSON.stringify(spec);
    const size = Buffer.byteLength(jsonStr, 'utf8');

    if (size > MAX_CONTRACT_SIZE) {
      throw new Error(`Contract size ${size} exceeds maximum ${MAX_CONTRACT_SIZE}`);
    }

    const entry = {
      spec,
      etag: etag || this.generateEtag(jsonStr),
      loadedAt: this.now(),
      size,
      version,
    };

    this.store.set(version, entry);
    return { ...entry, fromCache: false };
  }

  /**
   * Get a fallback minimal contract (for when all loading fails)
   */
  getFallbackContract(version) {
    const fallbackSpec = {
      openapi: '3.1.0',
      info: {
        title: 'Civic Help Setu API',
        version: version === 'v1' ? '1.0.0' : '2.0.0',
        description: `Fallback contract for ${version} - limited functionality`,
      },
      servers: [{ url: '/api' }],
      paths: {},
      components: {
        schemas: {
          Error: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              code: { type: 'string' },
              message: { type: 'string' },
              correlationId: { type: 'string', format: 'uuid' },
            },
          },
        },
      },
    };

    return this.cacheContract(version, fallbackSpec);
  }

  /**
   * Check if cached entry is stale
   */
  isStale(entry) {
    return this.now() - entry.loadedAt > this.cacheTtlMs;
  }

  /**
   * Generate ETag from content
   */
  generateEtag(content) {
    // Simple hash-based ETag (always positive)
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      hash = ((hash << 5) - hash) + content.charCodeAt(i);
      hash |= 0;
    }
    // Ensure positive hash for hex representation
    hash = hash < 0 ? -hash : hash;
    return `"${hash.toString(16)}"`;
  }

  /**
   * Invalidate cache for a version (or all)
   */
  invalidate(version = null) {
    if (version) {
      this.store.delete(version);
    } else {
      this.store.clear();
    }
  }

  /**
   * Get registry status for monitoring
   */
  getStatus() {
    const versions = {};
    for (const version of SUPPORTED_VERSIONS) {
      const entry = this.store.get(version);
      versions[version] = entry ? {
        cached: true,
        etag: entry.etag,
        loadedAt: new Date(entry.loadedAt).toISOString(),
        ageMs: this.now() - entry.loadedAt,
        size: entry.size,
        stale: this.isStale(entry),
      } : { cached: false };
    }
    return {
      versions,
      cacheTtlMs: this.cacheTtlMs,
      defaultVersion: DEFAULT_VERSION,
    };
  }

  /**
   * Preload all contracts (for warmup)
   */
  async preloadAll() {
    await Promise.all(SUPPORTED_VERSIONS.map(v => this.getContract(v).catch(err => {
      console.warn(`Failed to preload contract for ${v}:`, err.message);
    })));
  }
}

/**
 * Create a registry with embedded contracts (for testing/offline)
 */
export function createRegistryWithEmbeddedContracts(embeddedContracts = {}) {
  const registry = new ContractRegistry();

  for (const [version, spec] of Object.entries(embeddedContracts)) {
    if (SUPPORTED_VERSIONS.includes(version)) {
      registry.registerLoader(version, async () => ({ spec }));
    }
  }

  return registry;
}

/**
 * Default registry instance (lazy initialization)
 * Registers fallback loaders that return minimal valid contracts to avoid external fetches.
 */
let defaultRegistry = null;

export function getDefaultRegistry() {
  if (!defaultRegistry) {
    defaultRegistry = new ContractRegistry();
    // Register default loaders using bundled OpenAPI specs
    for (const version of SUPPORTED_VERSIONS) {
      defaultRegistry.registerLoader(version, async () => {
        const spec = OPENAPI_SPECS[version] || defaultRegistry.getFallbackContract(version).spec;
        return { spec };
      });
    }
  }
  return defaultRegistry;
}

export function setDefaultRegistry(registry) {
  defaultRegistry = registry;
}