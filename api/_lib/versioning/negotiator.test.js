import { describe, it, expect } from 'vitest';
import {
  extractFromAcceptHeader,
  extractFromCustomHeaders,
  extractFromUrlPath,
  extractFromQueryParam,
  normalizeVersion,
  negotiateVersion,
  buildVersionHeaders,
  isVersionSupported,
  getSupportedVersions,
  VERSION_SOURCES,
} from './negotiator.js';

describe('Version Negotiation', () => {
  describe('extractFromAcceptHeader', () => {
    it('extracts version from vendor media type', () => {
      const result = extractFromAcceptHeader('application/vnd.civic.v2+json');
      expect(result).toEqual({ version: 'v2', source: VERSION_SOURCES.ACCEPT_HEADER });
    });

    it('extracts version from version parameter', () => {
      const result = extractFromAcceptHeader('application/json; version=v1');
      expect(result).toEqual({ version: 'v1', source: VERSION_SOURCES.ACCEPT_HEADER });
    });

    it('returns null for unsupported version', () => {
      const result = extractFromAcceptHeader('application/vnd.civic.v99+json');
      expect(result).toBeNull();
    });

    it('returns null for invalid input', () => {
      expect(extractFromAcceptHeader(null)).toBeNull();
      expect(extractFromAcceptHeader('')).toBeNull();
      expect(extractFromAcceptHeader('text/html')).toBeNull();
    });
  });

  describe('extractFromCustomHeaders', () => {
    it('extracts from accept-version header', () => {
      const headers = { 'accept-version': 'v2' };
      const result = extractFromCustomHeaders(headers);
      expect(result).toEqual({ version: 'v2', source: VERSION_SOURCES.CUSTOM_HEADER });
    });

    it('extracts from api-version header (case insensitive)', () => {
      const headers = { 'API-Version': 'v1' };
      const result = extractFromCustomHeaders(headers);
      expect(result).toEqual({ version: 'v1', source: VERSION_SOURCES.CUSTOM_HEADER });
    });

    it('extracts from x-api-version header', () => {
      const headers = { 'x-api-version': 'v2' };
      const result = extractFromCustomHeaders(headers);
      expect(result).toEqual({ version: 'v2', source: VERSION_SOURCES.CUSTOM_HEADER });
    });

    it('returns null for unsupported version', () => {
      const headers = { 'accept-version': 'v99' };
      expect(extractFromCustomHeaders(headers)).toBeNull();
    });
  });

  describe('extractFromUrlPath', () => {
    it('extracts version from /api/v1/ path', () => {
      const result = extractFromUrlPath('/api/v1/services', '/api');
      expect(result).toEqual({ version: 'v1', source: VERSION_SOURCES.URL_PATH });
    });

    it('extracts version from /api/v2/services/123', () => {
      const result = extractFromUrlPath('/api/v2/services/123', '/api');
      expect(result).toEqual({ version: 'v2', source: VERSION_SOURCES.URL_PATH });
    });

    it('extracts version from root /v1/ path', () => {
      const result = extractFromUrlPath('/v1/services', '/api');
      expect(result).toEqual({ version: 'v1', source: VERSION_SOURCES.URL_PATH });
    });

    it('returns null for unsupported version', () => {
      const result = extractFromUrlPath('/api/v99/services', '/api');
      expect(result).toBeNull();
    });

    it('returns null for paths without version', () => {
      const result = extractFromUrlPath('/api/services', '/api');
      expect(result).toBeNull();
    });
  });

  describe('extractFromQueryParam', () => {
    it('extracts from version query param', () => {
      const result = extractFromQueryParam({ version: 'v2' });
      expect(result).toEqual({ version: 'v2', source: VERSION_SOURCES.QUERY_PARAM });
    });

    it('extracts from api_version query param', () => {
      const result = extractFromQueryParam({ api_version: 'v1' });
      expect(result).toEqual({ version: 'v1', source: VERSION_SOURCES.QUERY_PARAM });
    });

    it('extracts from api-version query param', () => {
      const result = extractFromQueryParam({ 'api-version': 'v2' });
      expect(result).toEqual({ version: 'v2', source: VERSION_SOURCES.QUERY_PARAM });
    });

    it('handles array values', () => {
      const result = extractFromQueryParam({ version: ['v1', 'v2'] });
      expect(result).toEqual({ version: 'v1', source: VERSION_SOURCES.QUERY_PARAM });
    });

    it('returns null for unsupported version', () => {
      const result = extractFromQueryParam({ version: 'v99' });
      expect(result).toBeNull();
    });
  });

  describe('normalizeVersion', () => {
    it('normalizes various formats', () => {
      expect(normalizeVersion('v1')).toBe('v1');
      expect(normalizeVersion('V1')).toBe('v1');
      expect(normalizeVersion('1')).toBe('v1');
      expect(normalizeVersion('  v2  ')).toBe('v2');
    });

    it('returns null for invalid formats', () => {
      expect(normalizeVersion('')).toBeNull();
      expect(normalizeVersion(null)).toBeNull();
      expect(normalizeVersion('abc')).toBeNull();
      expect(normalizeVersion('version 1')).toBeNull();
    });
  });

  describe('negotiateVersion', () => {
    it('prefers URL path over headers', () => {
      const result = negotiateVersion({
        url: '/api/v1/services',
        headers: { 'accept-version': 'v2' },
        query: { version: 'v2' },
      });
      expect(result.version).toBe('v1');
      expect(result.source).toBe(VERSION_SOURCES.URL_PATH);
    });

    it('prefers custom header over accept header', () => {
      const result = negotiateVersion({
        headers: { 'accept-version': 'v2', accept: 'application/vnd.civic.v1+json' },
      });
      expect(result.version).toBe('v2');
      expect(result.source).toBe(VERSION_SOURCES.CUSTOM_HEADER);
    });

    it('uses accept header when no custom header', () => {
      const result = negotiateVersion({
        headers: { accept: 'application/vnd.civic.v1+json' },
      });
      expect(result.version).toBe('v1');
      expect(result.source).toBe(VERSION_SOURCES.ACCEPT_HEADER);
    });

    it('uses query param as fallback', () => {
      const result = negotiateVersion({
        query: { version: 'v2' },
      });
      expect(result.version).toBe('v2');
      expect(result.source).toBe(VERSION_SOURCES.QUERY_PARAM);
    });

    it('uses default when nothing specified', () => {
      const result = negotiateVersion({});
      expect(result.version).toBe('v2'); // DEFAULT_VERSION
      expect(result.source).toBe(VERSION_SOURCES.DEFAULT);
    });

    it('returns null when allowDefault is false and no version found', () => {
      const result = negotiateVersion({ allowDefault: false });
      expect(result).toBeNull();
    });
  });

  describe('buildVersionHeaders', () => {
    it('includes standard version headers', () => {
      const headers = buildVersionHeaders({ version: 'v2', source: 'custom_header' });
      expect(headers['API-Version']).toBe('v2');
      expect(headers['X-API-Version']).toBe('v2');
      expect(headers['X-API-Version-Source']).toBe('custom_header');
    });

    it('includes supported versions when requested', () => {
      const headers = buildVersionHeaders({ version: 'v2', source: 'default' }, { includeSupportedVersions: true });
      expect(headers['X-API-Supported-Versions']).toContain('v1');
      expect(headers['X-API-Supported-Versions']).toContain('v2');
    });
  });

  describe('isVersionSupported', () => {
    it('returns true for supported versions', () => {
      expect(isVersionSupported('v1')).toBe(true);
      expect(isVersionSupported('v2')).toBe(true);
    });

    it('returns false for unsupported versions', () => {
      expect(isVersionSupported('v99')).toBe(false);
      expect(isVersionSupported('v0')).toBe(false);
    });
  });

  describe('getSupportedVersions', () => {
    it('returns all supported versions with metadata', () => {
      const versions = getSupportedVersions();
      expect(versions).toHaveLength(2);
      expect(versions.map(v => v.version)).toEqual(['v1', 'v2']);
      expect(versions[0]).toHaveProperty('deprecated');
      expect(versions[0]).toHaveProperty('isDefault');
    });
  });
});