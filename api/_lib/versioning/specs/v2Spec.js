/**
 * api/_lib/versioning/specs/v2Spec.js
 *
 * OpenAPI 3.1 Specification for Civic Help Setu API v2 (Current).
 * Includes cursor pagination, structured Problem Details errors, and camelCase fields.
 */

export const v2Spec = {
  openapi: '3.1.0',
  info: {
    title: 'Civic Help Setu Governed Public API (v2)',
    version: '2.0.0',
    description: 'Civic Help Setu v2 Governed Public API with per-client quotas, request validation, and deprecation headers.',
    contact: {
      name: 'Civic Help Setu API Governance',
      url: 'https://docs.civic-help-setu.org/api',
    },
  },
  servers: [
    { url: '/api', description: 'Default API Gateway' },
    { url: '/api/v2', description: 'Version 2 Prefix' },
  ],
  paths: {
    '/services': {
      get: {
        operationId: 'listServicesV2',
        summary: 'List civic services with cursor pagination',
        parameters: [
          { name: 'categories', in: 'query', required: false, schema: { type: 'string' } },
          { name: 'cursor', in: 'query', required: false, schema: { type: 'string' } },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100 } },
        ],
        responses: {
          '200': {
            description: 'List of services with nextCursor',
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
                          serviceId: { type: 'string' },
                          name: { type: 'string' },
                          categories: { type: 'array', items: { type: 'string' } },
                          description: { type: 'string' },
                        },
                      },
                    },
                    nextCursor: { type: 'string' },
                    limit: { type: 'integer' },
                  },
                },
              },
            },
          },
          '422': { $ref: '#/components/schemas/ProblemDetails' },
          '429': { $ref: '#/components/schemas/ProblemDetails' },
        },
      },
      post: {
        operationId: 'createServiceV2',
        summary: 'Submit a new civic service entry',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'categories'],
                properties: {
                  name: { type: 'string', minLength: 2 },
                  categories: { type: 'array', items: { type: 'string' } },
                  description: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Service created' },
          '422': { $ref: '#/components/schemas/ProblemDetails' },
        },
      },
    },
    '/public-toilets': {
      get: {
        operationId: 'searchPublicToiletsV2',
        summary: 'Search public toilets with cursor pagination',
        parameters: [
          { name: 'lat', in: 'query', required: false, schema: { type: 'number' } },
          { name: 'lng', in: 'query', required: false, schema: { type: 'number' } },
          { name: 'radius', in: 'query', required: false, schema: { type: 'number' } },
          { name: 'accessible', in: 'query', required: false, schema: { type: 'boolean' } },
          { name: 'cursor', in: 'query', required: false, schema: { type: 'string' } },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100 } },
        ],
        responses: {
          '200': { description: 'Public toilets matching query' },
          '422': { $ref: '#/components/schemas/ProblemDetails' },
        },
      },
    },
    '/water-quality-register': {
      get: {
        operationId: 'getWaterQualityV2',
        summary: 'Retrieve water quality data',
        parameters: [
          { name: 'ward', in: 'query', required: false, schema: { type: 'string' } },
          { name: 'parameter', in: 'query', required: false, schema: { type: 'string' } },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100 } },
        ],
        responses: {
          '200': { description: 'Water quality register entries' },
        },
      },
    },
    '/civic-agent-eval': {
      get: {
        operationId: 'getCivicAgentEvalHealthV2',
        summary: 'Retrieve civic agent evaluation harness schema version and observability status',
        responses: {
          '200': { description: 'Evaluation harness schema and observability metadata' },
        },
      },
    },
    '/civic-agent-eval/runs': {
      get: {
        operationId: 'listCivicAgentEvalRunsV2',
        summary: 'List redacted civic agent evaluation runs',
        parameters: [
          { name: 'targetId', in: 'query', required: false, schema: { type: 'string' } },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100 } },
        ],
        responses: {
          '200': { description: 'Redacted evaluation run summaries' },
          '400': { $ref: '#/components/schemas/ProblemDetails' },
        },
      },
      post: {
        operationId: 'createCivicAgentEvalRunV2',
        summary: 'Execute scenario-based evaluation suite (operator-only)',
        responses: {
          '201': { description: 'Completed evaluation run with redacted traces and gate status' },
          '400': { $ref: '#/components/schemas/ProblemDetails' },
          '401': { $ref: '#/components/schemas/ProblemDetails' },
          '403': { $ref: '#/components/schemas/ProblemDetails' },
        },
      },
    },
    '/civic-agent-eval/compare': {
      post: {
        operationId: 'compareCivicAgentEvalRunsV2',
        summary: 'Compare baseline and candidate evaluation runs against release thresholds (operator-only)',
        responses: {
          '200': { description: 'Regression comparison report and gate decision' },
          '400': { $ref: '#/components/schemas/ProblemDetails' },
          '404': { $ref: '#/components/schemas/ProblemDetails' },
        },
      },
    },
  },
  components: {
    schemas: {
      ProblemDetails: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          code: { type: 'string' },
          message: { type: 'string' },
          correlationId: { type: 'string' },
          details: { type: 'array', items: { type: 'object' } },
        },
      },
    },
  },
};
