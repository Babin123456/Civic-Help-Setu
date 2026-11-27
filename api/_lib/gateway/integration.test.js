/**
 * api/_lib/gateway/integration.test.js
 *
 * End-to-end integration tests for the Governed Public API Gateway (#1236).
 * Tests version negotiation, OpenAPI contract publishing, quota isolation,
 * request validation, deprecation headers, and internal service protection.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createApiDispatcher } from '../../[...path].js';
import { createGatewayMiddleware } from './gatewayMiddleware.js';
import { ConsumerRegistry, CONSUMER_TIERS, AUTH_METHODS } from './consumerRegistry.js';
import { ContractRegistry } from '../versioning/contractRegistry.js';
import { DeprecationManager } from './deprecationManager.js';
import { v1Spec } from '../versioning/specs/v1Spec.js';
import { v2Spec } from '../versioning/specs/v2Spec.js';

function createMockReq(overrides = {}) {
  const headers = {};
  for (const [k, v] of Object.entries(overrides.headers || {})) {
    headers[k.toLowerCase()] = v;
  }
  return {
    method: 'GET',
    url: '/api/services',
    path: '/api/services',
    headers,
    query: {},
    body: undefined,
    ...overrides,
  };
}

function createMockRes() {
  const headers = {};
  const res = {
    statusCode: 200,
    headers,
    body: null,
    writableEnded: false,
    setHeader(name, value) {
      headers[name.toLowerCase()] = value;
    },
    getHeader(name) {
      return headers[name.toLowerCase()];
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      this.writableEnded = true;
      return this;
    },
    send(body) {
      this.body = body;
      this.writableEnded = true;
      return this;
    },
    end() {
      this.writableEnded = true;
      return this;
    },
  };
  return res;
}

describe('Versioned API Gateway End-to-End Integration (#1236)', () => {
  let contractRegistry;
  let consumerRegistry;
  let deprecationManager;
  let gatewayMiddleware;
  let dispatcher;

  beforeEach(async () => {
    contractRegistry = new ContractRegistry();
    contractRegistry.registerLoader('v1', async () => ({ spec: v1Spec }));
    contractRegistry.registerLoader('v2', async () => ({ spec: v2Spec }));

    consumerRegistry = new ConsumerRegistry({ secret: 'integration-test-secret' });
    deprecationManager = new DeprecationManager({
      now: () => new Date('2026-11-25T12:00:00Z').getTime(),
    });

    gatewayMiddleware = createGatewayMiddleware({
      contractRegistry,
      consumerRegistry,
      deprecationManager,
      features: {
        versioning: true,
        quotas: true,
        validation: true,
        deprecation: true,
      },
      baseUrl: 'https://api.civic-help-setu.org',
    });

    // Create dispatcher with test route handlers
    dispatcher = createApiDispatcher({
      gatewayMiddleware,
      extraHandlers: {
        'services': async (req, res) => {
          return res.status(200).json({
            ok: true,
            version: req.apiVersion,
            items: [{ id: 'srv-1', name: 'Water Tanker Relief' }],
          });
        },
      },
    });
  });

  describe('1. Version Negotiation Strategies', () => {
    it('negotiates version via URL path prefix (/api/v1/services)', async () => {
      const req = createMockReq({
        url: '/api/v1/services',
        path: '/api/v1/services',
        query: { path: ['v1', 'services'] },
      });
      const res = createMockRes();

      await dispatcher(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.version).toBe('v1');
      expect(res.headers['api-version']).toBe('v1');
      expect(res.headers['x-api-version-source']).toBe('url_path');
    });

    it('negotiates version via custom header Accept-Version', async () => {
      const req = createMockReq({
        url: '/api/services',
        path: '/api/services',
        headers: { 'accept-version': 'v1' },
      });
      const res = createMockRes();

      await dispatcher(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.version).toBe('v1');
      expect(res.headers['api-version']).toBe('v1');
      expect(res.headers['x-api-version-source']).toBe('custom_header');
    });

    it('negotiates version via Accept media type header', async () => {
      const req = createMockReq({
        url: '/api/services',
        path: '/api/services',
        headers: { 'accept': 'application/vnd.civic.v1+json' },
      });
      const res = createMockRes();

      await dispatcher(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.version).toBe('v1');
      expect(res.headers['x-api-version-source']).toBe('accept_header');
    });

    it('negotiates version via query parameter (?version=v1)', async () => {
      const req = createMockReq({
        url: '/api/services?version=v1',
        path: '/api/services',
        query: { version: 'v1' },
      });
      const res = createMockRes();

      await dispatcher(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.version).toBe('v1');
      expect(res.headers['x-api-version-source']).toBe('query_param');
    });

    it('defaults seamlessly to v2 when no version is specified (Backward Compatibility)', async () => {
      const req = createMockReq({
        url: '/api/services',
        path: '/api/services',
      });
      const res = createMockRes();

      await dispatcher(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.version).toBe('v2');
      expect(res.headers['api-version']).toBe('v2');
      expect(res.headers['x-api-version-source']).toBe('default');
    });
  });

  describe('2. Published OpenAPI Contracts per Version', () => {
    it('publishes default v2 contract via GET /api/openapi', async () => {
      const req = createMockReq({
        url: '/api/openapi',
        path: '/api/openapi',
        query: { path: ['openapi'] },
      });
      const res = createMockRes();

      await dispatcher(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('application/json');
      expect(res.headers['etag']).toBeDefined();
      expect(res.body.openapi).toBe('3.1.0');
      expect(res.body.info.version).toBe('2.0.0');
      expect(res.body.paths['/services']).toBeDefined();
    });

    it('publishes v1 contract via query parameter GET /api/openapi?version=v1', async () => {
      const req = createMockReq({
        url: '/api/openapi?version=v1',
        path: '/api/openapi',
        query: { path: ['openapi'], version: 'v1' },
      });
      const res = createMockRes();

      await dispatcher(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.info.version).toBe('1.0.0');
      expect(res.body.info.title).toContain('(v1)');
    });

    it('publishes v1 contract via path GET /api/openapi/v1', async () => {
      const req = createMockReq({
        url: '/api/openapi/v1',
        path: '/api/openapi/v1',
        query: { path: ['openapi', 'v1'] },
      });
      const res = createMockRes();

      await dispatcher(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.info.version).toBe('1.0.0');
    });

    it('supports conditional requests with ETag / 304 Not Modified', async () => {
      // First request to get ETag
      const req1 = createMockReq({ url: '/api/openapi', path: '/api/openapi', query: { path: ['openapi'] } });
      const res1 = createMockRes();
      await dispatcher(req1, res1);
      const etag = res1.headers['etag'];

      // Second request with If-None-Match
      const req2 = createMockReq({
        url: '/api/openapi',
        path: '/api/openapi',
        query: { path: ['openapi'] },
        headers: { 'if-none-match': etag },
      });
      const res2 = createMockRes();
      await dispatcher(req2, res2);

      expect(res2.statusCode).toBe(304);
    });

    it('rejects invalid or unsupported version request for OpenAPI contracts', async () => {
      const req = createMockReq({
        url: '/api/openapi?version=v999',
        path: '/api/openapi',
        query: { path: ['openapi'], version: 'v999' },
      });
      const res = createMockRes();

      await dispatcher(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('UNSUPPORTED_VERSION');
      expect(res.body.supportedVersions).toContain('v1');
      expect(res.body.supportedVersions).toContain('v2');
    });
  });

  describe('3. Consumer Quotas & Quota Isolation', () => {
    it('enforces consumer quotas and returns standard rate limit headers', async () => {
      await consumerRegistry.registerConsumer({
        id: 'consumer-free-1',
        name: 'Free Tier Client',
        tier: CONSUMER_TIERS.FREE,
        authMethod: AUTH_METHODS.API_KEY,
        credentials: { apiKey: 'free-api-key-1' },
      });

      const req = createMockReq({
        headers: { 'x-api-key': 'free-api-key-1' },
      });
      const res = createMockRes();

      await dispatcher(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.headers['x-ratelimit-consumer']).toBe('consumer-free-1');
      expect(res.headers['x-ratelimit-tier']).toBe('free');
      expect(res.headers['x-ratelimit-remaining-minute']).toBeDefined();
    });

    it('demonstrates strict Quota Isolation between consumers', async () => {
      // Register Consumer A with low quota
      await consumerRegistry.registerConsumer({
        id: 'consumer-tenant-a',
        name: 'Tenant A',
        tier: CONSUMER_TIERS.FREE,
        authMethod: AUTH_METHODS.API_KEY,
        credentials: { apiKey: 'key-tenant-a' },
        quotas: { rpm: 2, burst: 2 },
      });

      // Register Consumer B with generous partner quota
      await consumerRegistry.registerConsumer({
        id: 'consumer-tenant-b',
        name: 'Tenant B Partner',
        tier: CONSUMER_TIERS.PARTNER,
        authMethod: AUTH_METHODS.API_KEY,
        credentials: { apiKey: 'key-tenant-b' },
        quotas: { rpm: 600, burst: 100 },
      });

      // Consumer A makes 2 requests (allowed)
      const reqA1 = createMockReq({ headers: { 'x-api-key': 'key-tenant-a' } });
      const resA1 = createMockRes();
      await dispatcher(reqA1, resA1);
      expect(resA1.statusCode).toBe(200);

      const reqA2 = createMockReq({ headers: { 'x-api-key': 'key-tenant-a' } });
      const resA2 = createMockRes();
      await dispatcher(reqA2, resA2);
      expect(resA2.statusCode).toBe(200);

      // Consumer A makes 3rd request -> Throttled (429)
      const reqA3 = createMockReq({ headers: { 'x-api-key': 'key-tenant-a' } });
      const resA3 = createMockRes();
      await dispatcher(reqA3, resA3);
      expect(resA3.statusCode).toBe(429);
      expect(resA3.body.code).toBe('RATE_LIMITED');
      expect(resA3.headers['retry-after']).toBeDefined();

      // Consumer B makes request -> MUST SUCCEED (200 OK) - Quota is isolated!
      const reqB1 = createMockReq({ headers: { 'x-api-key': 'key-tenant-b' } });
      const resB1 = createMockRes();
      await dispatcher(reqB1, resB1);
      expect(resB1.statusCode).toBe(200);
      expect(resB1.headers['x-ratelimit-consumer']).toBe('consumer-tenant-b');
      expect(resB1.headers['x-ratelimit-tier']).toBe('partner');
    });
  });

  describe('4. Internal Service Boundary Protection', () => {
    it('blocks direct public/anonymous access to internal services with 403 Forbidden', async () => {
      const req = createMockReq({
        url: '/api/tenant-administration',
        path: '/api/tenant-administration',
        query: { path: ['tenant-administration'] },
      });
      const res = createMockRes();

      await dispatcher(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
      expect(res.body.message).toContain('internal services');
    });

    it('blocks partner tier from accessing internal services', async () => {
      await consumerRegistry.registerConsumer({
        id: 'partner-1',
        name: 'Partner Client',
        tier: CONSUMER_TIERS.PARTNER,
        authMethod: AUTH_METHODS.API_KEY,
        credentials: { apiKey: 'partner-key' },
      });

      const req = createMockReq({
        url: '/api/civic-data-clean-room',
        path: '/api/civic-data-clean-room',
        query: { path: ['civic-data-clean-room'] },
        headers: { 'x-api-key': 'partner-key' },
      });
      const res = createMockRes();

      await dispatcher(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('allows internal tier consumers to access internal services', async () => {
      await consumerRegistry.registerConsumer({
        id: 'internal-operator',
        name: 'Internal Mesh Service',
        tier: CONSUMER_TIERS.INTERNAL,
        authMethod: AUTH_METHODS.API_KEY,
        credentials: { apiKey: 'internal-secret-token' },
      });

      const req = createMockReq({
        url: '/api/tenant-administration',
        path: '/api/tenant-administration',
        query: { path: ['tenant-administration'] },
        headers: { 'x-api-key': 'internal-secret-token' },
      });
      const res = createMockRes();

      await dispatcher(req, res);

      // Successfully bypassed gateway internal check and reached handler or mesh layer
      expect(res.statusCode).not.toBe(403);
    });
  });

  describe('5. Deprecation & Sunset Policies (RFC 8594)', () => {
    it('injects RFC 8594 Sunset and RFC 8288 Link headers for deprecated version', async () => {
      // In deprecation window
      const depManager = new DeprecationManager({
        now: () => new Date('2027-03-01T00:00:00Z').getTime(), // Within 90-day warning before sunset
      });
      depManager.setPolicy('v1', {
        sunsetDate: '2027-05-25T00:00:00Z',
        warningDays: 90,
        replacementVersion: 'v2',
        migrationGuideUrl: 'https://docs.civic-help-setu.org/migration/v1-to-v2',
      });

      const depMiddleware = createGatewayMiddleware({
        contractRegistry,
        consumerRegistry,
        deprecationManager: depManager,
        features: { versioning: true, quotas: false, validation: false, deprecation: true },
        baseUrl: 'https://api.civic-help-setu.org',
      });

      const depDispatcher = createApiDispatcher({
        gatewayMiddleware: depMiddleware,
        extraHandlers: {
          'services': async (req, res) => res.status(200).json({ ok: true }),
        },
      });

      const req = createMockReq({ headers: { 'accept-version': 'v1' } });
      const res = createMockRes();

      await depDispatcher(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.headers['deprecation']).toBe('true');
      expect(res.headers['sunset']).toBeDefined();
      expect(res.headers['link']).toContain('rel="migration-guide"');
      expect(res.headers['link']).toContain('rel="successor-version"');
    });

    it('rejects requests for sunset versions with HTTP 410 Gone', async () => {
      // Past sunset date
      const sunsetManager = new DeprecationManager({
        now: () => new Date('2027-06-01T00:00:00Z').getTime(), // After sunset
      });
      sunsetManager.setPolicy('v1', {
        sunsetDate: '2027-05-25T00:00:00Z',
        warningDays: 90,
        replacementVersion: 'v2',
        migrationGuideUrl: 'https://docs.civic-help-setu.org/migration/v1-to-v2',
      });

      const sunsetMiddleware = createGatewayMiddleware({
        contractRegistry,
        consumerRegistry,
        deprecationManager: sunsetManager,
        features: { versioning: true, quotas: false, validation: false, deprecation: true },
        baseUrl: 'https://api.civic-help-setu.org',
      });

      const sunsetDispatcher = createApiDispatcher({
        gatewayMiddleware: sunsetMiddleware,
      });

      const req = createMockReq({ headers: { 'accept-version': 'v1' } });
      const res = createMockRes();

      await sunsetDispatcher(req, res);

      expect(res.statusCode).toBe(410);
      expect(res.body.error).toBe('version_sunset');
      expect(res.body.code).toBe('VERSION_SUNSET');
      expect(res.body.recommendedVersion).toBe('v2');
      expect(res.body.migrationGuide).toBeDefined();
    });
  });

  describe('6. Request Validation per Version Contract', () => {
    it('returns 422 Validation Failed when query parameter violates contract schema', async () => {
      // In v1, limit maximum is 50
      const req = createMockReq({
        url: '/api/v1/services?limit=100',
        path: '/api/v1/services',
        query: { path: ['v1', 'services'], limit: '100' },
      });
      const res = createMockRes();

      await dispatcher(req, res);

      expect(res.statusCode).toBe(422);
      expect(res.body.code).toBe('VALIDATION_FAILED');
      expect(res.body.details).toBeDefined();
      expect(res.body.details.some(d => d.field.includes('limit'))).toBe(true);
    });

    it('allows valid request parameters complying with contract schema', async () => {
      const req = createMockReq({
        url: '/api/v1/services?limit=25',
        path: '/api/v1/services',
        query: { path: ['v1', 'services'], limit: '25' },
      });
      const res = createMockRes();

      await dispatcher(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });

  describe('7. Gateway Observability & Metrics', () => {
    it('serves gateway health check via /api/gateway-health', async () => {
      const req = createMockReq({
        url: '/api/gateway-health',
        path: '/api/gateway-health',
        query: { path: ['gateway-health'] },
      });
      const res = createMockRes();

      await dispatcher(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.gatewayEnabled).toBe(true);
      expect(res.body.supportedVersions.map(v => v.version || v)).toEqual(['v1', 'v2']);
    });

    it('serves gateway metrics via /api/gateway-metrics', async () => {
      const req = createMockReq({
        url: '/api/gateway-metrics',
        path: '/api/gateway-metrics',
        query: { path: ['gateway-metrics'] },
      });
      const res = createMockRes();

      await dispatcher(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.metrics).toBeDefined();
      expect(res.body.metrics.totalRequests).toBeGreaterThanOrEqual(1);
    });
  });
});
