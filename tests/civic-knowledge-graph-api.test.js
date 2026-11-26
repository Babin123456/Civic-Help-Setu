import { describe, it, expect, beforeEach } from 'vitest';
import handler from '../api/_lib/handlers/civic-knowledge-graph.js';
import { civicKnowledgeGraph } from '../src/services/civicKnowledgeGraphService.js';

const makeReq = (init = {}) => ({
  method: init.method || 'GET',
  headers: init.headers || {},
  body: init.body,
  query: init.query,
});

const makeRes = () => {
  const statusCalls = [];
  const jsonCalls = [];
  const headers = {};

  return {
    setHeader: (k, v) => {
      headers[k] = v;
    },
    status: (code) => {
      statusCalls.push(code);
      return {
        json: (data) => {
          jsonCalls.push(data);
          return { status: code, body: data, headers };
        },
      };
    },
    statusCalls,
    jsonCalls,
  };
};

describe('api/civic-knowledge-graph Handler (#1184)', () => {
  beforeEach(() => {
    civicKnowledgeGraph.invalidateCache('test_setup');
  });

  describe('GET Endpoints', () => {
    it('returns schema metadata when action=schema', async () => {
      const req = makeReq({ query: { action: 'schema' } });
      const res = makeRes();
      const response = await handler(req, res);
      const data = response.body;

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.nodeTypes).toBeDefined();
      expect(data.edgeTypes).toBeDefined();
      expect(data.maxTraversalDepth).toBe(3);
    });

    it('returns node details when action=node and nodeId is given', async () => {
      const req = makeReq({ query: { action: 'node', nodeId: 'service:driving-licence' } });
      const res = makeRes();
      const response = await handler(req, res);
      const data = response.body;

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.node.label).toContain('Driving Licence');
      expect(Array.isArray(data.incomingEdges)).toBe(true);
      expect(Array.isArray(data.outgoingEdges)).toBe(true);
    });

    it('returns 400 when action=node but nodeId is missing', async () => {
      const req = makeReq({ query: { action: 'node' } });
      const res = makeRes();
      const response = await handler(req, res);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('missing_param');
    });

    it('executes query via GET query parameters with explainability', async () => {
      const req = makeReq({
        query: {
          action: 'query',
          startNodeId: 'service:driving-licence',
          maxDepth: '2',
        },
      });
      const res = makeRes();
      const response = await handler(req, res);
      const data = response.body;

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.nodes.length).toBeGreaterThan(0);
      expect(data.explanations.length).toBeGreaterThan(0);
      expect(data.metadata.traversalDepthEnforced).toBe(2);
    });
  });

  describe('POST Endpoints', () => {
    it('executes query via POST body payload', async () => {
      const req = makeReq({
        method: 'POST',
        body: {
          action: 'query',
          query: {
            startNodeId: 'service:driving-licence',
            maxDepth: 1,
            explain: true,
          },
        },
      });
      const res = makeRes();
      const response = await handler(req, res);
      const data = response.body;

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.nodes.length).toBeGreaterThan(0);
    });

    it('denies cache invalidation to unauthenticated/guest users', async () => {
      const req = makeReq({
        method: 'POST',
        body: { action: 'invalidate_cache' },
      });
      const res = makeRes();
      const response = await handler(req, res);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('forbidden');
    });

    it('allows cache invalidation to administrators', async () => {
      const req = makeReq({
        method: 'POST',
        headers: { authorization: 'Bearer admin-token' },
        body: { action: 'invalidate_cache', reason: 'unit-test' },
      });
      const res = makeRes();
      const response = await handler(req, res);

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.message).toContain('Cache successfully invalidated');
    });

    it('rejects POST payload with sensitive personal fields', async () => {
      const req = makeReq({
        method: 'POST',
        body: {
          action: 'query',
          query: {
            startNodeId: 'service:driving-licence',
            aadhaar: '9999-0000-1111',
          },
        },
      });
      const res = makeRes();
      const response = await handler(req, res);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('validation_error');
    });
  });

  describe('Method and Route Boundaries', () => {
    it('returns 405 Method Not Allowed for unsupported methods (e.g. DELETE)', async () => {
      const req = makeReq({ method: 'DELETE' });
      const res = makeRes();
      const response = await handler(req, res);

      expect(response.status).toBe(405);
      expect(response.body.error).toBe('method_not_allowed');
    });
  });
});
