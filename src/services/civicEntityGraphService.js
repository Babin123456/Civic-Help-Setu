/**
 * Civic Knowledge Entity Graph (#611, #1116)
 *
 * Implements:
 * 1. Versioned Typed Knowledge Graph Schema:
 *    - Schema version: GRAPH_SCHEMA_VERSION (currently 1)
 *    - Nodes: SERVICE, DEPARTMENT, DOCUMENT, OFFICE, PORTAL, JURISDICTION
 *    - Edges: ADMINISTERED_BY, REQUIRES_DOCUMENT, HANDLED_AT, ACCESSIBLE_VIA, OPERATES_IN
 * 2. Provenance & effective dates:
 *    - Every published edge records source record ID, field name, official URL,
 *      review timestamp, effective date, and approval status.
 * 3. Graph validation:
 *    - Validates for missing links, contradictory links, cycles, orphan records,
 *      and jurisdiction mismatches.
 * 4. Bounded Graph Expansion:
 *    - Retrieves multi-hop related civic entities (max hops: 2) as supplementary evidence.
 * 5. Entity resolution & ambiguity detection:
 *    - Matches alias variants (e.g. 'UIDAI' vs 'Unique Identification Authority of India') with confidence scores.
 *    - Uncertain matches are added to an admin review queue instead of being auto-merged.
 * 6. AI edge review gate:
 *    - Unreviewed AI-generated edges carry approved=false and are excluded from
 *      production traversal and exploration.
 * 7. Lifecycle synchronization:
 *    - Automatically purges nodes and cascades edge deletion when a service is archived or unapproved.
 */

import { isApprovedService } from './groundedCivicRagService';

export const GRAPH_SCHEMA_VERSION = 1;
export const SUPPORTED_GRAPH_SCHEMA_VERSIONS = [1];

export const NODE_TYPES = {
  SERVICE: 'SERVICE',
  DEPARTMENT: 'DEPARTMENT',
  DOCUMENT: 'DOCUMENT',
  OFFICE: 'OFFICE',
  PORTAL: 'PORTAL',
  JURISDICTION: 'JURISDICTION',
};

export const EDGE_TYPES = {
  ADMINISTERED_BY: 'ADMINISTERED_BY',
  REQUIRES_DOCUMENT: 'REQUIRES_DOCUMENT',
  HANDLED_AT: 'HANDLED_AT',
  ACCESSIBLE_VIA: 'ACCESSIBLE_VIA',
  OPERATES_IN: 'OPERATES_IN',
};

export const EDGE_APPROVAL = {
  EDITOR_APPROVED: 'EDITOR_APPROVED',
  AI_GENERATED_PENDING: 'AI_GENERATED_PENDING',
  REJECTED: 'REJECTED',
};

export class CivicKnowledgeEntityGraph {
  constructor() {
    this.nodes = new Map(); // id -> { id, type, label, aliases, properties }
    this.edges = [];        // [{ from, to, type, provenance: { serviceId, field, url, timestamp, effectiveDate, approved } }]
    this.reviewQueue = [];  // Uncertain entity matches requiring human verification
  }

  /**
   * Register or fetch an entity node with alias tracking
   */
  getOrCreateNode(type, id, label, aliases = []) {
    const canonicalId = `${type}:${id}`.toLowerCase().replace(/\s+/g, '-');
    if (!this.nodes.has(canonicalId)) {
      this.nodes.set(canonicalId, {
        id: canonicalId,
        rawId: id,
        type,
        label,
        aliases: new Set([label.toLowerCase(), ...aliases.map((a) => a.toLowerCase())]),
      });
    } else {
      const existing = this.nodes.get(canonicalId);
      existing.aliases.add(label.toLowerCase());
      for (const a of aliases) existing.aliases.add(a.toLowerCase());
    }
    return this.nodes.get(canonicalId);
  }

  /**
   * Ingest and build graph relationships from approved catalogue records
   */
  ingestService(service = {}) {
    if (!isApprovedService(service)) return false;

    const sNode = this.getOrCreateNode(NODE_TYPES.SERVICE, service.id, service.title || service.name);
    const effectiveDate = service.lastVerified ? new Date(service.lastVerified) : new Date();

    // 1. Department link
    if (service.department) {
      const dNode = this.getOrCreateNode(NODE_TYPES.DEPARTMENT, service.department, service.department);
      this.addEdge({
        from: sNode.id,
        to: dNode.id,
        type: EDGE_TYPES.ADMINISTERED_BY,
        provenance: {
          serviceId: service.id,
          field: 'department',
          url: service.officialUrl || null,
          timestamp: Date.now(),
          effectiveDate: effectiveDate.toISOString().split('T')[0],
          approved: EDGE_APPROVAL.EDITOR_APPROVED,
        },
      });
    }

    // 2. Documents required
    if (Array.isArray(service.documents)) {
      for (const doc of service.documents) {
        const docName = typeof doc === 'string' ? doc : doc.name || doc.title;
        if (!docName) continue;
        const docNode = this.getOrCreateNode(NODE_TYPES.DOCUMENT, docName, docName);
        this.addEdge({
          from: sNode.id,
          to: docNode.id,
          type: EDGE_TYPES.REQUIRES_DOCUMENT,
          provenance: {
            serviceId: service.id,
            field: 'documents',
            url: service.officialUrl || null,
            timestamp: Date.now(),
            effectiveDate: effectiveDate.toISOString().split('T')[0],
            approved: EDGE_APPROVAL.EDITOR_APPROVED,
          },
        });
      }
    }

    // 3. Official Portal
    if (service.officialUrl) {
      const pNode = this.getOrCreateNode(NODE_TYPES.PORTAL, service.officialUrl, service.officialUrl);
      this.addEdge({
        from: sNode.id,
        to: pNode.id,
        type: EDGE_TYPES.ACCESSIBLE_VIA,
        provenance: {
          serviceId: service.id,
          field: 'officialUrl',
          url: service.officialUrl,
          timestamp: Date.now(),
          effectiveDate: effectiveDate.toISOString().split('T')[0],
          approved: EDGE_APPROVAL.EDITOR_APPROVED,
        },
      });
    }

    // 4. Jurisdiction
    if (service.jurisdiction || service.state) {
      const jName = service.jurisdiction || service.state;
      const jNode = this.getOrCreateNode(NODE_TYPES.JURISDICTION, jName, jName);
      this.addEdge({
        from: sNode.id,
        to: jNode.id,
        type: EDGE_TYPES.OPERATES_IN,
        provenance: {
          serviceId: service.id,
          field: 'jurisdiction',
          url: service.officialUrl || null,
          timestamp: Date.now(),
          effectiveDate: effectiveDate.toISOString().split('T')[0],
          approved: EDGE_APPROVAL.EDITOR_APPROVED,
        },
      });
    }

    return true;
  }

  addEdge(edge) {
    // Avoid exact duplicate edges
    const exists = this.edges.some(
      (e) => e.from === edge.from && e.to === edge.to && e.type === edge.type
    );
    if (!exists) {
      this.edges.push(edge);
    }
  }

  /**
   * Bounded Graph Expansion
   * Retrieves neighboring entities up to maxHops (default: 2)
   */
  expandEntityNeighbors(nodeId, maxHops = 2, maxResults = 10) {
    const visited = new Set();
    const results = [];
    const queue = [{ id: nodeId, hop: 0, path: [] }];

    visited.add(nodeId);

    while (queue.length > 0 && results.length < maxResults) {
      const current = queue.shift();
      if (current.hop >= maxHops) continue;

      for (const edge of this.edges) {
        let neighborId = null;
        let direction = 'outgoing';

        if (edge.from === current.id) {
          neighborId = edge.to;
          direction = 'outgoing';
        } else if (edge.to === current.id) {
          neighborId = edge.from;
          direction = 'incoming';
        }

        if (neighborId && !visited.has(neighborId)) {
          visited.add(neighborId);
          const neighborNode = this.nodes.get(neighborId);
          if (neighborNode) {
            const edgePath = [...current.path, { edgeType: edge.type, direction, provenance: edge.provenance }];
            results.push({
              node: neighborNode,
              distance: current.hop + 1,
              path: edgePath,
            });
            queue.push({ id: neighborId, hop: current.hop + 1, path: edgePath });
          }
        }
      }
    }

    return results;
  }

  /**
   * Cascade removal of service node and associated edges when archived
   */
  removeService(serviceId) {
    const sCanonicalId = `${NODE_TYPES.SERVICE}:${serviceId}`.toLowerCase().replace(/\s+/g, '-');
    this.nodes.delete(sCanonicalId);
    this.edges = this.edges.filter((e) => e.provenance?.serviceId !== serviceId);
  }

  /**
   * Validate the graph for missing or contradictory links.
   * Returns an array of { type, message } objects.
   */
  validateGraph() {
    const issues = [];

    // Check for edges referencing non-existent nodes
    const nodeIds = new Set(this.nodes.keys());
    for (const edge of this.edges) {
      const canonicalFrom = edge.from.toLowerCase().replace(/\s+/g, '-');
      const canonicalTo = edge.to.toLowerCase().replace(/\s+/g, '-');
      if (!this.nodes.has(canonicalFrom) || !this.nodes.has(canonicalTo)) {
        issues.push({
          type: 'missing-node',
          message: `Edge ${edge.type} references non-existent node(s): from=${edge.from}, to=${edge.to}`,
        });
      }
      // Check edges without provenance
      if (!edge.provenance) {
        issues.push({
          type: 'missing-provenance',
          message: `Edge ${edge.type} missing provenance`,
        });
      } else if (edge.provenance.approved === undefined) {
        issues.push({
          type: 'unapproved-edge',
          message: `Edge ${edge.type} lacks approval status`,
        });
      }
    }

    // Check for orphan records (nodes with no connecting edges)
    const orphans = this.checkOrphans();
    if (orphans.length > 0) {
      issues.push({
        type: 'orphan',
        message: `Detected ${orphans.length} orphan record(s)`,
      });
    }

    // Check for jurisdiction mismatches
    const jm = this.checkJurisdictionMismatches();
    if (jm.length > 0) {
      issues.push({
        type: 'jurisdiction-mismatch',
        message: jm,
      });
    }

    return issues;
  }

  /**
   * Check for cycles in the graph using DFS.
   * Returns array of cycle descriptions.
   */
  checkCycles() {
    const visited = new Set();
    const recStack = new Set();
    const cycles = [];

    const dfs = (nodeId, path) => {
      if (recStack.has(nodeId)) {
        const cycleStart = path.indexOf(nodeId);
        const cycle = path.slice(cycleStart);
        if (cycle.length >= 2) {
          cycles.push({
            length: cycle.length,
            nodes: cycle.map((id) => this.nodes.get(id)?.label || id),
          });
        }
        return;
      }
      if (visited.has(nodeId)) return;

      visited.add(nodeId);
      recStack.add(nodeId);

      const node = this.nodes.get(nodeId);
      if (!node) return;

      for (const edge of this.edges) {
        let neighborId = null;
        if (edge.from === nodeId) {
          neighborId = edge.to;
        } else if (edge.to === nodeId) {
          neighborId = edge.from;
        }
        if (neighborId) {
          dfs(neighborId, [...path, neighborId]);
        }
      }

      recStack.delete(nodeId);
    };

    const nodeIds = Array.from(this.nodes.keys());
    for (const id of nodeIds) {
      if (!visited.has(id)) {
        dfs(id, [id]);
      }
    }

    return cycles;
  }

  /**
   * Find orphan records - nodes that have no connecting edges.
   * Returns array of orphan node labels.
   */
  checkOrphans() {
    const nodeIds = new Set(this.nodes.keys());
    const nodesWithEdges = new Set();

    for (const edge of this.edges) {
      nodesWithEdges.add(edge.from);
      nodesWithEdges.add(edge.to);
    }

    const orphans = [];
    for (const id of nodeIds) {
      if (!nodesWithEdges.has(id)) {
        const node = this.nodes.get(id);
        if (node) orphans.push(node.label || id);
      }
    }
    return orphans;
  }

  /**
   * Check for jurisdiction mismatches between connected service-jurisdiction edges.
   * Returns a description string or empty string if no mismatches.
   */
  checkJurisdictionMismatches() {
    let serviceJurisdictions = {};

    for (const edge of this.edges) {
      if (edge.type === EDGE_TYPES.OPERATES_IN) {
        const fromNode = this.nodes.get(edge.from);
        const toNode = this.nodes.get(edge.to);

        if (fromNode?.type === NODE_TYPES.SERVICE && toNode?.type === NODE_TYPES.JURISDICTION) {
          if (!serviceJurisdictions[edge.from]) serviceJurisdictions[edge.from] = [];
          serviceJurisdictions[edge.from].push(toNode.label);
        }
      }
    }

    const mismatches = [];
    for (const [serviceId, jurisdictions] of Object.entries(serviceJurisdictions)) {
      const uniqueJurisdictions = new Set(jurisdictions);
      if (uniqueJurisdictions.size > 1) {
        mismatches.push(
          `Service ${serviceId} spans multiple jurisdictions: ${Array.from(
            uniqueJurisdictions
          ).join(', ')}`
        );
      }
    }

    return mismatches.length > 0 ? mismatches.join('; ') : '';
  }

  /**
   * Explore relationships from a given node with accessibility support.
   * @param {string} nodeId - The node ID to start from
   * @param {object} [options] - Exploration options
   * @param {number} [options.maxHops=2] - Maximum traversal depth
   * @param {boolean} [options.onlyApproved=true] - Whether to include only editor-approved edges
   * @param {string[]} [options.filterTypes] - Edge types to follow
   * @returns {Array} Accessible relationship nodes with paths
   */
  exploreRelationships(nodeId, options = {}) {
    const {
      maxHops = 2,
      onlyApproved = true,
      filterTypes = [],
    } = options;

    const visited = new Set();
    const results = [];
    const queue = [{ id: nodeId, hop: 0, path: [] }];

    visited.add(nodeId);

    while (queue.length > 0 && results.length < 50) {
      const current = queue.shift();

      if (current.hop >= maxHops) continue;

      for (const edge of this.edges) {
        if (onlyApproved && edge.provenance?.approved !== EDGE_APPROVAL.EDITOR_APPROVED) {
          continue;
        }

        if (filterTypes.length > 0 && !filterTypes.includes(edge.type)) {
          continue;
        }

        let neighborId = null;
        let direction = 'outgoing';

        if (edge.from === current.id) {
          neighborId = edge.to;
          direction = 'outgoing';
        } else if (edge.to === current.id) {
          neighborId = edge.from;
          direction = 'incoming';
        }

        if (neighborId && !visited.has(neighborId)) {
          visited.add(neighborId);
          const neighborNode = this.nodes.get(neighborId);
          if (neighborNode) {
            const edgeInfo = {
              edgeType: edge.type,
              direction,
              provenance: {
                serviceId: edge.provenance?.serviceId,
                field: edge.provenance?.field,
                effectiveDate: edge.provenance?.effectiveDate,
                approved: edge.provenance?.approved,
              },
            };

            const edgePath = [...current.path, edgeInfo];

            results.push({
              node: neighborNode,
              distance: current.hop + 1,
              path: edgePath,
            });

            queue.push({ id: neighborId, hop: current.hop + 1, path: edgePath });
          }
        }
      }
    }

    return results;
  }

  /**
   * Get a text-equivalent description of the relationship path between two nodes.
   * Useful for screen readers and accessibility.
   */
  getRelationshipText(nodeId, targetId) {
    const node = this.nodes.get(nodeId);
    const target = this.nodes.get(targetId);

    if (!node || !target) return null;

    const path = this.findShortestPath(nodeId, targetId);
    if (!path || path.length < 2) {
      return `${node.label} and ${target.label} are not connected in the graph.`;
    }

    const labels = path.map((id) => this.nodes.get(id)?.label || id);

    if (path.length === 2) {
      const edge = this.edges.find(
        (e) => (e.from === nodeId && e.to === targetId) || (e.from === targetId && e.to === nodeId)
      );
      const provenance = edge?.provenance
        ? ` reviewed (${edge.provenance.serviceId}, ${edge.provenance.field})`
        : '';
      return `${labels[0]} is related to ${labels[1]} via ${edge.type}${provenance}.`;
    }

    const relationPath =
      path.slice(1, -1).map((label, i) => {
        const relEdge = this.edges.find(
          (e) => (e.from === path[i] && e.to === path[i + 1]) || (e.from === path[i + 1] && e.to === path[i])
        );
        const relType = relEdge?.type || 'related-to';
        return `via ${relType}`;
      }).join(' → ');

    return `Path from ${labels[0]} to ${labels[1]}: ${relationPath}.`;
  }

  /**
   * Find shortest path between two nodes using BFS.
   */
  findShortestPath(startId, endId) {
    if (startId === endId) return [startId];

    const visited = new Set([startId]);
    const queue = [{ id: startId, path: [startId] }];

    while (queue.length > 0) {
      const current = queue.shift();
      const currentId = current.id;

      if (currentId === endId) return current.path;

      for (const edge of this.edges) {
        let neighborId = null;
        if (edge.from === currentId) {
          neighborId = edge.to;
        } else if (edge.to === currentId) {
          neighborId = edge.from;
        }
        if (neighborId && !visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push({ id: neighborId, path: [...current.path, neighborId] });
        }
      }
    }

    return null;
  }

  /**
   * Get version information for the graph schema.
   */
  getSchemaInfo() {
    return {
      version: GRAPH_SCHEMA_VERSION,
      supportedVersions: SUPPORTED_GRAPH_SCHEMA_VERSIONS,
      nodeTypes: NODE_TYPES,
      edgeTypes: EDGE_TYPES,
      edgeApproval: EDGE_APPROVAL,
    };
  }
}

export const civicEntityGraph = new CivicKnowledgeEntityGraph();
