/**
 * api/_lib/versioning/specs/v1Spec.js
 *
 * OpenAPI 3.1 Specification for Civic Help Setu API v1.
 * Marked as deprecated per versionConfig.js sunset policy.
 */

export const v1Spec = {
  openapi: '3.1.0',
  info: {
    title: 'Civic Help Setu Public API (v1)',
    version: '1.0.0',
    description: 'Civic Help Setu v1 Public API. Deprecated: clients should migrate to v2.',
    contact: {
      name: 'Civic Help Setu API Governance',
      url: 'https://docs.civic-help-setu.org/api',
    },
  },
  servers: [
    { url: '/api', description: 'Default API Gateway' },
    { url: '/api/v1', description: 'Version 1 Prefix' },
  ],
  paths: {
    '/services': {
      get: {
        operationId: 'listServicesV1',
        summary: 'List civic services',
        parameters: [
          { name: 'category', in: 'query', required: false, schema: { type: 'string' } },
          { name: 'page', in: 'query', required: false, schema: { type: 'integer', minimum: 1 } },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 50 } },
        ],
        responses: {
          '200': {
            description: 'List of services',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    services: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          service_id: { type: 'string' },
                          name: { type: 'string' },
                          category: { type: 'string' },
                          description: { type: 'string' },
                        },
                      },
                    },
                    page: { type: 'integer' },
                    limit: { type: 'integer' },
                  },
                },
              },
            },
          },
          '422': { $ref: '#/components/schemas/ValidationError' },
          '429': { $ref: '#/components/schemas/RateLimitError' },
        },
      },
      post: {
        operationId: 'createServiceV1',
        summary: 'Submit a new civic service entry',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'category'],
                properties: {
                  name: { type: 'string', minLength: 2 },
                  category: { type: 'string' },
                  description: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Service created' },
          '422': { $ref: '#/components/schemas/ValidationError' },
        },
      },
    },
    '/public-toilets': {
      get: {
        operationId: 'searchPublicToiletsV1',
        summary: 'Search public toilets by location',
        parameters: [
          { name: 'lat', in: 'query', required: false, schema: { type: 'number' } },
          { name: 'lng', in: 'query', required: false, schema: { type: 'number' } },
          { name: 'radius', in: 'query', required: false, schema: { type: 'number' } },
          { name: 'accessible', in: 'query', required: false, schema: { type: 'boolean' } },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 50 } },
        ],
        responses: {
          '200': { description: 'Public toilets matching query' },
          '422': { $ref: '#/components/schemas/ValidationError' },
        },
      },
    },
    '/water-quality-register': {
      get: {
        operationId: 'getWaterQualityV1',
        summary: 'Retrieve water quality data',
        parameters: [
          { name: 'ward', in: 'query', required: false, schema: { type: 'string' } },
          { name: 'parameter', in: 'query', required: false, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Water quality register entries' },
        },
      },
    },
  },
  components: {
    schemas: {
      ValidationError: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          code: { type: 'string' },
          message: { type: 'string' },
          details: { type: 'array', items: { type: 'object' } },
        },
      },
      RateLimitError: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          code: { type: 'string' },
          message: { type: 'string' },
          retryAfterSeconds: { type: 'integer' },
        },
      },
    },
  },
};
