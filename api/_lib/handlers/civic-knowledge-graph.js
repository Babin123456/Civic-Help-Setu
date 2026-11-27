/**
 * api/_lib/handlers/civic-knowledge-graph.js
 *
 * Serverless API handler for Civic Service Knowledge Graph Query API with Explainable Traversals (#1184).
 *
 * Implements:
 * - Rate limiting via createRateLimiter
 * - Input validation & threat boundary defense (zero PII, zero credentials)
 * - Safe query parameter parsing and dispatching to civicKnowledgeGraph
 * - Cache invalidation endpoint for administrators/maintainers
 * - Structured RFC-compliant JSON responses with safe error codes
 * - Zero execution of arbitrary code or uncontrolled queries
 */

import { createRateLimiter, clientKey } from '../abuseGuard.js';
import { civicKnowledgeGraph } from '../../../src/services/civicKnowledgeGraphService.js';
import {
  GRAPH_QUERY_SCHEMA_VERSION,
  GRAPH_NODE_TYPES,
  GRAPH_EDGE_TYPES,
  PUBLICATION_STATUSES,
} from '../../../src/data/civicKnowledgeGraphContract.js';
import {
  proposeDependencyEdge,
  reviewAndPublishEdge,
  listEdgeAuditLog,
} from '../../../src/services/civicKnowledgeGraphEdgeWorkflow.js';

const addressLimiter = createRateLimiter({ limit: 45, windowMs: 60 * 1000 });

const json = (status, body, extraHeaders = {}) => ({
  status,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  },
  body,
});

const tooMany = (retryAfter) =>
  json(429, { error: 'rate_limited', retryAfterSeconds: retryAfter }, { 'Retry-After': String(retryAfter) });

function readBearerRole(headers) {
  const auth = headers?.authorization || headers?.Authorization;
  if (!auth || !auth.startsWith('Bearer ')) return { userId: null, role: 'guest' };
  const token = auth.slice('Bearer '.length).trim();

  // Test / synthetic tokens for role simulation
  if (token === 'admin-token' || token.startsWith('admin-')) {
    return { userId: 'admin-user', role: 'admin' };
  }
  if (token === 'reviewer-token' || token.startsWith('reviewer-')) {
    return { userId: 'reviewer-user', role: 'reviewer' };
  }
  return { userId: 'authenticated-user', role: 'user' };
}

export default async function handler(req, res) {
  const method = req.method || 'GET';
  const ip = clientKey(req) || 'unknown';

  // Apply rate limiter
  const rateResult = addressLimiter.take(ip);
  if (!rateResult.allowed) {
    const resp = tooMany(rateResult.retryAfterSeconds);
    if (res && typeof res.status === 'function') {
      res.setHeader('Retry-After', String(rateResult.retryAfterSeconds));
      return res.status(resp.status).json(resp.body);
    }
    return resp;
  }

  const { role, userId } = readBearerRole(req.headers);

  // Method routing
  if (method === 'GET') {
    const queryParams = req.query || {};
    const action = queryParams.action || 'query';

    if (action === 'schema') {
      const payload = {
        ok: true,
        schemaVersion: GRAPH_QUERY_SCHEMA_VERSION,
        nodeTypes: Object.values(GRAPH_NODE_TYPES),
        edgeTypes: Object.values(GRAPH_EDGE_TYPES),
        publicationStatuses: Object.values(PUBLICATION_STATUSES),
        maxTraversalDepth: 3,
        defaultLimit: 20,
      };
      if (res && typeof res.status === 'function') return res.status(200).json(payload);
      return json(200, payload);
    }

    if (action === 'edge_audit_log') {
      if (role !== 'admin' && role !== 'reviewer' && role !== 'maintainer') {
        const payload = { error: 'forbidden', message: 'Admin or reviewer role required for edge audit log.' };
        if (res && typeof res.status === 'function') return res.status(403).json(payload);
        return json(403, payload);
      }
      const payload = { ok: true, items: listEdgeAuditLog() };
      if (res && typeof res.status === 'function') return res.status(200).json(payload);
      return json(200, payload);
    }

    if (action === 'node') {
      const nodeId = queryParams.nodeId;
      if (!nodeId) {
        const payload = { error: 'missing_param', message: 'nodeId parameter is required' };
        if (res && typeof res.status === 'function') return res.status(400).json(payload);
        return json(400, payload);
      }
      const nodeDetails = civicKnowledgeGraph.getNodeDetails(nodeId, { role, userId });
      const status = nodeDetails.ok ? 200 : 404;
      if (res && typeof res.status === 'function') return res.status(status).json(nodeDetails);
      return json(status, nodeDetails);
    }

    if (action === 'query') {
      const targetTypes = queryParams.targetTypes
        ? (Array.isArray(queryParams.targetTypes) ? queryParams.targetTypes : queryParams.targetTypes.split(','))
        : undefined;

      const edgeTypes = queryParams.edgeTypes
        ? (Array.isArray(queryParams.edgeTypes) ? queryParams.edgeTypes : queryParams.edgeTypes.split(','))
        : undefined;

      const queryPayload = {
        startNodeId: queryParams.startNodeId,
        targetTypes,
        edgeTypes,
        jurisdiction: queryParams.jurisdiction,
        publicationStatus: queryParams.publicationStatus,
        effectiveAsOf: queryParams.effectiveAsOf,
        searchTerm: queryParams.searchTerm,
        maxDepth: queryParams.maxDepth ? Number(queryParams.maxDepth) : undefined,
        limit: queryParams.limit ? Number(queryParams.limit) : undefined,
        offset: queryParams.offset ? Number(queryParams.offset) : undefined,
        explain: queryParams.explain !== 'false',
      };

      const result = civicKnowledgeGraph.queryGraph(queryPayload, { role, userId });
      let statusCode = 200;
      if (!result.ok) {
        if (result.error === 'validation_error') statusCode = 400;
        else if (result.error === 'forbidden') statusCode = 403;
        else if (result.error === 'node_not_found') statusCode = 404;
        else statusCode = 500;
      }

      if (res && typeof res.status === 'function') return res.status(statusCode).json(result);
      return json(statusCode, result);
    }

    const payload = { error: 'unknown_action', message: `Unknown GET action: ${action}` };
    if (res && typeof res.status === 'function') return res.status(400).json(payload);
    return json(400, payload);
  }

  if (method === 'POST') {
    const body = req.body || {};
    const action = body.action || (req.query && req.query.action) || 'query';

    if (action === 'invalidate_cache') {
      // Authorization boundary: must have privileged role
      if (role !== 'admin' && role !== 'maintainer') {
        const payload = {
          error: 'forbidden',
          message: 'Cache invalidation requires administrator or maintainer role.',
        };
        if (res && typeof res.status === 'function') return res.status(403).json(payload);
        return json(403, payload);
      }

      const invResult = civicKnowledgeGraph.invalidateCache(body.reason || 'admin_post');
      const payload = { ok: true, message: 'Cache successfully invalidated', details: invResult };
      if (res && typeof res.status === 'function') return res.status(200).json(payload);
      return json(200, payload);
    }

    if (action === 'propose_edge') {
      if (!userId) {
        const payload = { error: 'unauthorized', message: 'Authentication required to propose graph edges.' };
        if (res && typeof res.status === 'function') return res.status(401).json(payload);
        return json(401, payload);
      }
      try {
        const proposal = proposeDependencyEdge({
          sourceNodeId: body.sourceNodeId,
          targetNodeId: body.targetNodeId,
          edgeType: body.edgeType,
          jurisdiction: body.jurisdiction,
          effectiveFrom: body.effectiveFrom,
          effectiveTo: body.effectiveTo,
          officialUrl: body.officialUrl,
          statutoryAct: body.statutoryAct,
          provenanceKind: body.provenanceKind || 'community_suggestion',
          proposedBy: userId,
        });
        const payload = { ok: true, proposal };
        if (res && typeof res.status === 'function') return res.status(201).json(payload);
        return json(201, payload);
      } catch (err) {
        const payload = { error: 'validation_error', message: err.message };
        if (res && typeof res.status === 'function') return res.status(400).json(payload);
        return json(400, payload);
      }
    }

    if (action === 'review_edge') {
      if (!userId) {
        const payload = { error: 'unauthorized', message: 'Authentication required.' };
        if (res && typeof res.status === 'function') return res.status(401).json(payload);
        return json(401, payload);
      }
      if (role !== 'admin' && role !== 'reviewer') {
        const payload = { error: 'forbidden', message: 'Reviewer or admin role required.' };
        if (res && typeof res.status === 'function') return res.status(403).json(payload);
        return json(403, payload);
      }
      try {
        const result = reviewAndPublishEdge({
          proposalId: body.proposalId,
          reviewerId: userId,
          reviewerRole: role,
          decision: body.decision,
          rejectionReason: body.rejectionReason || '',
        });
        const status = result.status || 200;
        if (res && typeof res.status === 'function') return res.status(status).json(result);
        return json(status, result);
      } catch (err) {
        const status = err.message.includes('Role separation') ? 403 : 400;
        const payload = { error: status === 403 ? 'forbidden' : 'validation_error', message: err.message };
        if (res && typeof res.status === 'function') return res.status(status).json(payload);
        return json(status, payload);
      }
    }

    if (action === 'query') {
      const result = civicKnowledgeGraph.queryGraph(body.query || body, { role, userId });
      let statusCode = 200;
      if (!result.ok) {
        if (result.error === 'validation_error') statusCode = 400;
        else if (result.error === 'forbidden') statusCode = 403;
        else if (result.error === 'node_not_found') statusCode = 404;
        else statusCode = 500;
      }
      if (res && typeof res.status === 'function') return res.status(statusCode).json(result);
      return json(statusCode, result);
    }

    const payload = { error: 'unknown_action', message: `Unknown POST action: ${action}` };
    if (res && typeof res.status === 'function') return res.status(400).json(payload);
    return json(400, payload);
  }

  const payload = { error: 'method_not_allowed', message: `Method ${method} is not supported` };
  if (res && typeof res.status === 'function') return res.status(405).json(payload);
  return json(405, payload, { Allow: 'GET, POST' });
}
