/**
 * src/services/civicKnowledgeGraphService.js
 *
 * Core Query Engine & Explainable Traversal Service (#1184).
 *
 * Capabilities:
 * 1. Safe, typed traversal across services, departments, offices, documents, portals, jurisdictions.
 * 2. Bounded traversal depth (default 2, max 3) to prevent expensive graph scans.
 * 3. Enforces jurisdiction filters and publication status filters (published, draft, archived).
 * 4. Filters by effective dates (effectiveFrom <= asOf <= effectiveTo).
 * 5. Returns full edge provenance (statutoryAct, officialUrl, reviewedBy, timestamp) and effective dates.
 * 6. Detects cycles in traversal paths and flags circular dependencies safely.
 * 7. Identifies orphan nodes (nodes with 0 connected edges under current filters).
 * 8. In-memory LRU query cache with versioned cache invalidation.
 * 9. Explainable output generation: human-readable step-by-step traversal narrative and provenance rationale.
 * 10. Role-based authorization boundary checks (e.g., drafts require reviewer/admin roles).
 */

import {
  GRAPH_QUERY_SCHEMA_VERSION,
  GRAPH_NODE_TYPES,
  GRAPH_EDGE_TYPES,
  PUBLICATION_STATUSES,
  validateGraphQuery,
} from '../data/civicKnowledgeGraphContract.js';

import {
  SYNTHETIC_GRAPH_NODES,
  SYNTHETIC_GRAPH_EDGES,
} from '../data/civicKnowledgeGraphFixtures.js';

export class CivicKnowledgeGraphService {
  constructor(options = {}) {
    this.nodes = new Map();
    this.edges = [];
    this.cache = new Map();
    this.cacheTtlMs = options.cacheTtlMs || 5 * 60 * 1000; // 5 min TTL
    this.cacheVersion = 1;

    // Load initial nodes and edges
    this.initGraph(options.nodes || SYNTHETIC_GRAPH_NODES, options.edges || SYNTHETIC_GRAPH_EDGES);
  }

  /**
   * Initialize or replace the in-memory graph dataset
   */
  initGraph(nodes = [], edges = []) {
    this.nodes.clear();
    for (const node of nodes) {
      this.nodes.set(node.id, { ...node });
    }
    this.edges = edges.map((e) => ({ ...e }));
    this.invalidateCache('init');
  }

  /**
   * Invalidate query cache
   */
  invalidateCache(reason = 'manual') {
    this.cache.clear();
    this.cacheVersion += 1;
    return { invalidated: true, reason, version: this.cacheVersion };
  }

  /**
   * Helper: check if a node or edge is active as of a given ISO date
   */
  isEffectiveAsOf(item, asOfDateStr) {
    if (!asOfDateStr) return true;
    const asOf = Date.parse(asOfDateStr);
    if (isNaN(asOf)) return true;

    if (item.effectiveFrom) {
      const from = Date.parse(item.effectiveFrom);
      if (!isNaN(from) && asOf < from) return false;
    }

    if (item.effectiveTo) {
      const to = Date.parse(item.effectiveTo);
      if (!isNaN(to) && asOf > to) return false;
    }

    return true;
  }

  /**
   * Helper: check role authorization for viewing non-published entities
   */
  checkAuthorization(publicationStatus, actorRole) {
    if (publicationStatus === PUBLICATION_STATUSES.PUBLISHED) {
      return { allowed: true };
    }
    const privilegedRoles = ['admin', 'reviewer', 'auditor', 'maintainer'];
    if (privilegedRoles.includes(actorRole)) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: `Actor role "${actorRole || 'guest'}" is not authorized to query ${publicationStatus} entities. Requires one of: ${privilegedRoles.join(', ')}`,
    };
  }

  /**
   * Execute a Knowledge Graph Query with explainable traversals
   */
  queryGraph(rawQuery = {}, context = {}) {
    const actorRole = context.role || 'guest';

    // 1. Validate query at trust boundary
    const validation = validateGraphQuery(rawQuery);
    if (!validation.valid) {
      return {
        ok: false,
        schemaVersion: GRAPH_QUERY_SCHEMA_VERSION,
        error: 'validation_error',
        errors: validation.errors,
      };
    }

    const query = validation.sanitizedQuery;

    // 2. Check authorization for requested publication status
    const authCheck = this.checkAuthorization(query.publicationStatus, actorRole);
    if (!authCheck.allowed) {
      return {
        ok: false,
        schemaVersion: GRAPH_QUERY_SCHEMA_VERSION,
        error: 'forbidden',
        message: authCheck.reason,
      };
    }

    // 3. Cache lookup
    const cacheKey = JSON.stringify({ query, role: actorRole, v: this.cacheVersion });
    const cached = this.cache.get(cacheKey);
    const now = Date.now();
    if (cached && now - cached.timestamp < this.cacheTtlMs) {
      return { ...cached.data, cached: true };
    }

    // 4. Filter graph elements by publicationStatus, effective date, and jurisdiction
    const eligibleNodes = new Map();
    for (const [id, node] of this.nodes) {
      if (node.publicationStatus !== query.publicationStatus) continue;
      if (!this.isEffectiveAsOf(node, query.effectiveAsOf)) continue;
      if (query.jurisdiction && node.jurisdiction && node.jurisdiction.toLowerCase() !== query.jurisdiction.toLowerCase()) {
        continue;
      }
      eligibleNodes.set(id, node);
    }

    const eligibleEdges = this.edges.filter((edge) => {
      if (edge.publicationStatus !== query.publicationStatus) return false;
      if (!this.isEffectiveAsOf(edge, query.effectiveAsOf)) return false;
      if (!this.nodes.has(edge.from) || !this.nodes.has(edge.to)) return false;
      if (query.edgeTypes && !query.edgeTypes.includes(edge.type)) return false;
      return true;
    });

    // 5. Traversal or search execution
    let matchedNodes = [];
    let matchedEdges = [];
    let traversalPaths = [];
    let cyclesDetected = [];

    if (query.startNodeId) {
      const startNode = eligibleNodes.get(query.startNodeId);
      if (!startNode) {
        return {
          ok: false,
          schemaVersion: GRAPH_QUERY_SCHEMA_VERSION,
          error: 'node_not_found',
          message: `Start node "${query.startNodeId}" was not found or is filtered out under current constraints`,
        };
      }

      // Breadth-First Bounded Traversal
      const visited = new Set();
      const nodeMapResult = new Map();
      const edgeSetResult = new Map();

      nodeMapResult.set(startNode.id, startNode);
      visited.add(startNode.id);

      // queue item: { nodeId, depth, path: [nodeId], edgePath: [edge] }
      const queue = [{ nodeId: startNode.id, depth: 0, path: [startNode.id], edgePath: [] }];

      while (queue.length > 0) {
        const current = queue.shift();

        if (current.depth >= query.maxDepth) continue;

        // Find connected edges
        for (const edge of eligibleEdges) {
          let neighborId = null;
          let direction = 'outgoing';

          if (edge.from === current.nodeId) {
            neighborId = edge.to;
            direction = 'outgoing';
          } else if (edge.to === current.nodeId) {
            neighborId = edge.from;
            direction = 'incoming';
          }

          if (!neighborId) continue;

          // Check if neighbor is eligible
          const neighborNode = eligibleNodes.get(neighborId);
          if (!neighborNode) continue;

          // Filter by targetTypes if specified (applies to traversed nodes)
          const matchesTargetType = !query.targetTypes || query.targetTypes.includes(neighborNode.type);

          // Cycle detection check
          if (current.path.includes(neighborId)) {
            const cyclePath = [...current.path, neighborId];
            const cycleKey = cyclePath.join('->');
            if (!cyclesDetected.some((c) => c.key === cycleKey)) {
              cyclesDetected.push({
                key: cycleKey,
                cycle: cyclePath,
                edgeType: edge.type,
                description: `Cycle detected: node ${neighborId} is referenced again along traversal path`,
              });
            }
            continue; // Do not re-enqueue cycle to avoid infinite loops
          }

          const newEdgePath = [
            ...current.edgePath,
            {
              edgeId: edge.id,
              edgeType: edge.type,
              direction,
              from: edge.from,
              to: edge.to,
              provenance: edge.provenance,
              effectiveFrom: edge.effectiveFrom,
              effectiveTo: edge.effectiveTo,
            },
          ];

          const newPath = [...current.path, neighborId];

          if (matchesTargetType) {
            nodeMapResult.set(neighborId, neighborNode);
            edgeSetResult.set(edge.id, edge);

            traversalPaths.push({
              sourceId: startNode.id,
              targetId: neighborId,
              targetType: neighborNode.type,
              targetLabel: neighborNode.label,
              depth: current.depth + 1,
              steps: newEdgePath,
            });
          }

          visited.add(neighborId);
          queue.push({
            nodeId: neighborId,
            depth: current.depth + 1,
            path: newPath,
            edgePath: newEdgePath,
          });
        }
      }

      matchedNodes = Array.from(nodeMapResult.values());
      matchedEdges = Array.from(edgeSetResult.values());
    } else {
      // Filter-based search across eligible nodes
      let candidates = Array.from(eligibleNodes.values());

      if (query.targetTypes) {
        candidates = candidates.filter((n) => query.targetTypes.includes(n.type));
      }

      if (query.searchTerm) {
        const term = query.searchTerm.toLowerCase();
        candidates = candidates.filter(
          (n) =>
            n.label.toLowerCase().includes(term) ||
            n.id.toLowerCase().includes(term) ||
            (n.properties?.description && n.properties.description.toLowerCase().includes(term))
        );
      }

      matchedNodes = candidates;

      // Collect edges between matching nodes
      const candidateIds = new Set(candidates.map((n) => n.id));
      matchedEdges = eligibleEdges.filter((e) => candidateIds.has(e.from) || candidateIds.has(e.to));
    }

    // 6. Identify orphan nodes in graph
    const connectedNodeIds = new Set();
    for (const e of eligibleEdges) {
      connectedNodeIds.add(e.from);
      connectedNodeIds.add(e.to);
    }
    const orphanNodes = matchedNodes.filter((n) => !connectedNodeIds.has(n.id));

    // 7. Pagination
    const totalNodes = matchedNodes.length;
    const paginatedNodes = matchedNodes.slice(query.offset, query.offset + query.limit);
    const paginatedEdges = matchedEdges.slice(0, query.limit * 2);

    // 8. Generate Explainability Metadata
    const explanations = [];
    if (query.explain) {
      for (const path of traversalPaths) {
        const stepDescriptions = path.steps.map((s, idx) => {
          const prov = s.provenance
            ? ` (Authority: ${s.provenance.statutoryAct || 'Official Circular'}; Verified by: ${s.provenance.reviewedBy || 'Admin'})`
            : '';
          return `Step ${idx + 1}: [${s.direction}] ${s.edgeType} connecting to ${s.to === path.targetId ? s.to : s.from}${prov}`;
        });

        explanations.push({
          targetId: path.targetId,
          targetLabel: path.targetLabel,
          targetType: path.targetType,
          depth: path.depth,
          narrative: `Connected to ${path.targetLabel} (${path.targetType}) at depth ${path.depth} via ${path.steps.length} relationship(s).`,
          steps: stepDescriptions,
          provenanceChain: path.steps.map((s) => s.provenance),
        });
      }
    }

    const responsePayload = {
      ok: true,
      schemaVersion: GRAPH_QUERY_SCHEMA_VERSION,
      query: {
        ...query,
        actorRole,
      },
      pagination: {
        total: totalNodes,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + query.limit < totalNodes,
      },
      nodes: paginatedNodes,
      edges: paginatedEdges,
      traversalPaths: traversalPaths.slice(0, query.limit),
      explanations: explanations.slice(0, query.limit),
      cyclesDetected,
      orphanNodes: orphanNodes.map((o) => ({ id: o.id, label: o.label, type: o.type })),
      metadata: {
        totalEligibleNodesInGraph: eligibleNodes.size,
        totalEligibleEdgesInGraph: eligibleEdges.length,
        traversalDepthEnforced: query.maxDepth,
        timestamp: new Date().toISOString(),
      },
      disclaimer: 'Graph traversals and explanations are deterministic statutory models. High-impact civic decisions require authorized human review.',
    };

    // Save in cache
    this.cache.set(cacheKey, { timestamp: now, data: responsePayload });

    return responsePayload;
  }

  /**
   * Inspect a specific node with direct connections and provenance
   */
  getNodeDetails(nodeId, context = {}) {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return { ok: false, error: 'node_not_found', message: `Node "${nodeId}" not found` };
    }

    const outgoing = this.edges.filter((e) => e.from === nodeId);
    const incoming = this.edges.filter((e) => e.to === nodeId);

    return {
      ok: true,
      schemaVersion: GRAPH_QUERY_SCHEMA_VERSION,
      node,
      incomingEdges: incoming,
      outgoingEdges: outgoing,
      degree: incoming.length + outgoing.length,
      isOrphan: incoming.length + outgoing.length === 0,
    };
  }
}

export const civicKnowledgeGraph = new CivicKnowledgeGraphService();
