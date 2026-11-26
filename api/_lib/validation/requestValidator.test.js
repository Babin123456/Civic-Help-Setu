import { describe, it, expect, beforeEach } from 'vitest';
import { validateRequest, validateResponse, clearValidatorCache, getValidatorCacheStats } from './requestValidator.js';
import { ContractRegistry } from '../versioning/contractRegistry.js';

describe('Request Validator', () => {
  let registry;

  beforeEach(() => {
    registry = new ContractRegistry({ cacheTtlMs: 60000 });
    clearValidatorCache();
  });

  function createRequest(overrides = {}) {
    return {
      method: 'GET',
      path: '/services',
      url: '/services',
      headers: {},
      query: {},
      body: undefined,
      pathParams: {},
      params: {},
      ...overrides,
    };
  }

  describe('validateRequest', () => {
    it('validates path parameters', async () => {
      const spec = {
        openapi: '3.1.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/services/{serviceId}': {
            get: {
              operationId: 'getService',
              parameters: [
                { name: 'serviceId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
              ],
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      };
      registry.cacheContract('v1', spec);

      const req = createRequest({
        method: 'GET',
        path: '/services/123e4567-e89b-42d3-a456-426614174000',
        pathParams: { serviceId: '123e4567-e89b-42d3-a456-426614174000' },
      });

      const result = await validateRequest(req, 'v1', { registry });
      expect(result.valid).toBe(true);
    });

    it('rejects invalid path parameter format', async () => {
      const spec = {
        openapi: '3.1.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/services/{serviceId}': {
            get: {
              operationId: 'getService',
              parameters: [
                { name: 'serviceId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
              ],
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      };
      registry.cacheContract('v1', spec);

      const req = createRequest({
        method: 'GET',
        path: '/services/not-a-uuid',
        pathParams: { serviceId: 'not-a-uuid' },
      });

      const result = await validateRequest(req, 'v1', { registry });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === 'path.serviceId' && e.code === 'FORMAT_MISMATCH')).toBe(true);
    });

    it('validates query parameters', async () => {
      const spec = {
        openapi: '3.1.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/services': {
            get: {
              operationId: 'listServices',
              parameters: [
                { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
                { name: 'category', in: 'query', schema: { type: 'string', enum: ['health', 'education'] } },
              ],
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      };
      registry.cacheContract('v1', spec);

      const req = createRequest({
        method: 'GET',
        path: '/services',
        query: { limit: '50', category: 'health' },
      });

      const result = await validateRequest(req, 'v1', { registry });
      expect(result.valid).toBe(true);
    });

    it('rejects query parameter out of range', async () => {
      const spec = {
        openapi: '3.1.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/services': {
            get: {
              operationId: 'listServices',
              parameters: [
                { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
              ],
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      };
      registry.cacheContract('v1', spec);

      const req = createRequest({
        method: 'GET',
        path: '/services',
        query: { limit: '200' },
      });

      const result = await validateRequest(req, 'v1', { registry });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === 'query.limit' && e.code === 'MAXIMUM')).toBe(true);
    });

    it('rejects invalid enum value', async () => {
      const spec = {
        openapi: '3.1.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/services': {
            get: {
              operationId: 'listServices',
              parameters: [
                { name: 'category', in: 'query', schema: { type: 'string', enum: ['health', 'education'] } },
              ],
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      };
      registry.cacheContract('v1', spec);

      const req = createRequest({
        method: 'GET',
        path: '/services',
        query: { category: 'invalid' },
      });

      const result = await validateRequest(req, 'v1', { registry });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === 'query.category' && e.code === 'ENUM_MISMATCH')).toBe(true);
    });

    it('validates request body', async () => {
      const spec = {
        openapi: '3.1.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/services': {
            post: {
              operationId: 'createService',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['name', 'category'],
                      properties: {
                        name: { type: 'string', minLength: 1, maxLength: 200 },
                        category: { type: 'string', enum: ['health', 'education'] },
                      },
                      additionalProperties: false,
                    },
                  },
                },
              },
              responses: { '201': { description: 'Created' } },
            },
          },
        },
      };
      registry.cacheContract('v1', spec);

      const req = createRequest({
        method: 'POST',
        path: '/services',
        body: { name: 'New Service', category: 'health' },
      });

      const result = await validateRequest(req, 'v1', { registry });
      expect(result.valid).toBe(true);
    });

    it('rejects body with missing required field', async () => {
      const spec = {
        openapi: '3.1.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/services': {
            post: {
              operationId: 'createService',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['name'],
                      properties: { name: { type: 'string' } },
                    },
                  },
                },
              },
              responses: { '201': { description: 'Created' } },
            },
          },
        },
      };
      registry.cacheContract('v1', spec);

      const req = createRequest({
        method: 'POST',
        path: '/services',
        body: { category: 'health' }, // Missing name
      });

      const result = await validateRequest(req, 'v1', { registry });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === 'body.name' && e.code === 'REQUIRED_PROPERTY')).toBe(true);
    });

    it('rejects body with additional properties when not allowed', async () => {
      const spec = {
        openapi: '3.1.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/services': {
            post: {
              operationId: 'createService',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: { name: { type: 'string' } },
                      additionalProperties: false,
                    },
                  },
                },
              },
              responses: { '201': { description: 'Created' } },
            },
          },
        },
      };
      registry.cacheContract('v1', spec);

      const req = createRequest({
        method: 'POST',
        path: '/services',
        body: { name: 'Test', extraField: 'not allowed' },
      });

      const result = await validateRequest(req, 'v1', { registry });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === 'body.extraField' && e.code === 'ADDITIONAL_PROPERTY')).toBe(true);
    });

    it('validates array items', async () => {
      const spec = {
        openapi: '3.1.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/services/batch': {
            post: {
              operationId: 'batchCreate',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['services'],
                      properties: {
                        services: {
                          type: 'array',
                          items: { type: 'string', minLength: 1 },
                          maxItems: 10,
                        },
                      },
                    },
                  },
                },
              },
              responses: { '201': { description: 'Created' } },
            },
          },
        },
      };
      registry.cacheContract('v1', spec);

      const req = createRequest({
        method: 'POST',
        path: '/services/batch',
        body: { services: ['Service 1', 'Service 2'] },
      });

      const result = await validateRequest(req, 'v1', { registry });
      expect(result.valid).toBe(true);
    });

    it('rejects array items that fail validation', async () => {
      const spec = {
        openapi: '3.1.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/services/batch': {
            post: {
              operationId: 'batchCreate',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['services'],
                      properties: {
                        services: {
                          type: 'array',
                          items: { type: 'string', minLength: 1 },
                        },
                      },
                    },
                  },
                },
              },
              responses: { '201': { description: 'Created' } },
            },
          },
        },
      };
      registry.cacheContract('v1', spec);

      const req = createRequest({
        method: 'POST',
        path: '/services/batch',
        body: { services: ['Service 1', ''] }, // Empty string fails minLength
      });

      const result = await validateRequest(req, 'v1', { registry });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === 'body.services[1]' && e.code === 'MIN_LENGTH')).toBe(true);
    });

    it('validates headers', async () => {
      const spec = {
        openapi: '3.1.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/services': {
            get: {
              operationId: 'listServices',
              parameters: [
                { name: 'x-client-version', in: 'header', schema: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' } },
              ],
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      };
      registry.cacheContract('v1', spec);

      const req = createRequest({
        method: 'GET',
        path: '/services',
        headers: { 'x-client-version': '1.2.3' },
      });

      const result = await validateRequest(req, 'v1', { registry });
      expect(result.valid).toBe(true);
    });

    it('returns PATH_NOT_FOUND when no operation matches', async () => {
      const spec = {
        openapi: '3.1.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/services': {
            get: { operationId: 'listServices', responses: { '200': { description: 'OK' } } },
          },
        },
      };
      registry.cacheContract('v1', spec);

      const req = createRequest({
        method: 'POST',
        path: '/services', // POST not defined
      });

      const result = await validateRequest(req, 'v1', { registry, strict: true });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'PATH_NOT_FOUND')).toBe(true);
    });

    it('skips body validation for GET when skipBody=true', async () => {
      const spec = {
        openapi: '3.1.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/services': {
            get: {
              operationId: 'listServices',
              requestBody: {
                required: true,
                content: { 'application/json': { schema: { type: 'object', required: ['name'] } } },
              },
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      };
      registry.cacheContract('v1', spec);

      const req = createRequest({
        method: 'GET',
        path: '/services',
        body: { name: 'Should be ignored' },
      });

      const result = await validateRequest(req, 'v1', { registry, skipBody: true });
      expect(result.valid).toBe(true);
    });
  });

  describe('validateResponse', () => {
    it('validates response against contract', () => {
      const spec = {
        openapi: '3.1.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/services': {
            get: {
              operationId: 'listServices',
              responses: {
                '200': {
                  description: 'OK',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        required: ['services'],
                        properties: {
                          services: { type: 'array', items: { type: 'string' } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };
      registry.cacheContract('v1', spec);

      const response = { status: 200, body: { services: ['Service 1', 'Service 2'] } };
      const result = validateResponse(response, 'v1', 'GET', '/services', registry);
      expect(result.valid).toBe(true);
    });

    it('rejects invalid response', () => {
      const spec = {
        openapi: '3.1.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/services': {
            get: {
              operationId: 'listServices',
              responses: {
                '200': {
                  description: 'OK',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        required: ['services'],
                        properties: {
                          services: { type: 'array', items: { type: 'string' } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };
      registry.cacheContract('v1', spec);

      const response = { status: 200, body: { data: ['Service 1'] } }; // Missing 'services'
      const result = validateResponse(response, 'v1', 'GET', '/services', registry);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'REQUIRED_PROPERTY')).toBe(true);
    });
  });

  describe('Cache Management', () => {
    it('clears validator cache', async () => {
      const spec = {
        openapi: '3.1.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/services': {
            get: {
              operationId: 'listServices',
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      };
      registry.cacheContract('v1', spec);

      // Trigger validator creation
      const req = createRequest({ method: 'GET', path: '/services' });
      await validateRequest(req, 'v1', { registry });

      expect(getValidatorCacheStats().size).toBeGreaterThan(0);

      clearValidatorCache();
      expect(getValidatorCacheStats().size).toBe(0);
    });
  });
});