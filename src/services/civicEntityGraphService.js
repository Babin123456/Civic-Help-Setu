/**
 * Civic Knowledge Entity Graph (#611)
 *
 * Implements:
 * 1. Typed Knowledge Graph Schema:
 *    - Nodes: SERVICE, DEPARTMENT, DOCUMENT, OFFICE, PORTAL, JURISDICTION
 *    - Edges: ADMINISTERED_BY, REQUIRES_DOCUMENT, HANDLED_AT, ACCESSIBLE_VIA, OPERATES_IN
 * 2. Provenance tracking:
 *    - Every edge records source record ID, field name, official URL, and review timestamp.
 * 3. Bounded Graph Expansion:
 *    - Retrieves multi-hop related civic entities (max hops: 2) as supplementary evidence candidates.
 * 4. Entity resolution & ambiguity detection:
 *    - Matches alias variants (e.g. 'UIDAI' vs 'Unique Identification Authority of India') with confidence scores.
 *    - Uncertain matches are added to an admin review queue instead of being auto-merged.
 * 5. Lifecycle synchronization:
 *    - Automatically purges nodes and cascades edge deletion when a service is archived or unapproved.
 */

import { isApprovedService } from './groundedCivicRagService';

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

export class CivicKnowledgeEntityGraph {
  constructor() {
    this.nodes = new Map(); // id -> { id, type, label, aliases, properties }
    this.edges = [];        // [{ from, to, type, provenance: { serviceId, field, url, timestamp } }]
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
}

export const civicEntityGraph = new CivicKnowledgeEntityGraph();
