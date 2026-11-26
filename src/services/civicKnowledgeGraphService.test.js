import { describe, it, expect, beforeEach } from 'vitest';
import {
  GRAPH_QUERY_SCHEMA_VERSION,
  GRAPH_NODE_TYPES,
  GRAPH_EDGE_TYPES,
  PUBLICATION_STATUSES,
  validateGraphQuery,
} from '../data/civicKnowledgeGraphContract.js';
import {
  CivicKnowledgeGraphService,
} from './civicKnowledgeGraphService.js';
import {
  SYNTHETIC_GRAPH_NODES,
  SYNTHETIC_GRAPH_EDGES,
} from '../data/civicKnowledgeGraphFixtures.js';

describe('Civic Knowledge Graph Query Contract & Engine (#1184)', () => {
  let service;

  beforeEach(() => {
    service = new CivicKnowledgeGraphService({
      nodes: SYNTHETIC_GRAPH_NODES,
      edges: SYNTHETIC_GRAPH_EDGES,
    });
  });

  describe('Contract Validation & Boundary Checks', () => {
    it('validates a correct bounded traversal query', () => {
      const q = {
        startNodeId: 'service:driving-licence',
        maxDepth: 2,
        limit: 10,
        publicationStatus: 'published',
      };
      const res = validateGraphQuery(q);
      expect(res.valid).toBe(true);
      expect(res.sanitizedQuery.maxDepth).toBe(2);
      expect(res.sanitizedQuery.schemaVersion).toBe(GRAPH_QUERY_SCHEMA_VERSION);
    });

    it('rejects queries containing sensitive / personal data keys (zero PII)', () => {
      const q = {
        startNodeId: 'service:driving-licence',
        aadhaar: '1234-5678-9012',
        phone: '9876543210',
      };
      const res = validateGraphQuery(q);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('aadhaar'))).toBe(true);
      expect(res.errors.some((e) => e.includes('phone'))).toBe(true);
    });

    it('enforces traversal depth bounds (max 3)', () => {
      const q = {
        startNodeId: 'service:driving-licence',
        maxDepth: 5,
      };
      const res = validateGraphQuery(q);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('maxDepth must be an integer between 1 and 3'))).toBe(true);
    });

    it('prevents expensive unrestricted graph scans', () => {
      const emptyQuery = { maxDepth: 2, limit: 10 };
      const res = validateGraphQuery(emptyQuery);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('Unbounded graph scan prevented'))).toBe(true);
    });
  });

  describe('Graph Query Execution & Traversals', () => {
    it('executes a 2-hop bounded traversal with edge provenance and effective dates', () => {
      const result = service.queryGraph({
        startNodeId: 'service:driving-licence',
        maxDepth: 2,
      });

      expect(result.ok).toBe(true);
      expect(result.nodes.length).toBeGreaterThan(1);
      expect(result.edges.length).toBeGreaterThan(1);

      // Verify start node exists in result
      const ids = result.nodes.map((n) => n.id);
      expect(ids).toContain('service:driving-licence');

      // Verify provenance is attached to edges
      for (const edge of result.edges) {
        expect(edge.provenance).toBeDefined();
        expect(edge.provenance.statutoryAct).toBeDefined();
        expect(edge.provenance.reviewedBy).toBeDefined();
        expect(edge.effectiveFrom).toBeDefined();
      }
    });

    it('generates human-readable explainable traversal steps', () => {
      const result = service.queryGraph({
        startNodeId: 'service:driving-licence',
        maxDepth: 2,
        explain: true,
      });

      expect(result.ok).toBe(true);
      expect(result.explanations.length).toBeGreaterThan(0);
      const firstExp = result.explanations[0];
      expect(firstExp.narrative).toBeDefined();
      expect(firstExp.steps.length).toBeGreaterThan(0);
      expect(firstExp.provenanceChain.length).toBeGreaterThan(0);
    });

    it('filters by jurisdiction correctly', () => {
      const result = service.queryGraph({
        searchTerm: 'tree',
        jurisdiction: 'Delhi',
      });

      expect(result.ok).toBe(true);
      expect(result.nodes.length).toBeGreaterThan(0);
      for (const node of result.nodes) {
        if (node.jurisdiction) {
          expect(node.jurisdiction).toBe('Delhi');
        }
      }
    });

    it('filters by effective dates (effectiveFrom and effectiveTo)', () => {
      // Historical query in 2010 should exclude entities enacted in 2023
      const histResult = service.queryGraph({
        startNodeId: 'service:delhi-tree-pruning',
        effectiveAsOf: '2010-01-01',
      });

      // Delhi tree pruning was effective from 2023-01-15, so it shouldn't be found as effective in 2010
      expect(histResult.ok).toBe(false);
      expect(histResult.error).toBe('node_not_found');
    });

    it('safely detects and flags cycles without entering infinite loops', () => {
      // Traversal detects cycles and prevents infinite loops
      const result = service.queryGraph({
        startNodeId: 'service:delhi-trade-licence',
        maxDepth: 3,
      });

      expect(result.ok).toBe(true);
      expect(Array.isArray(result.cyclesDetected)).toBe(true);
      expect(result.cyclesDetected.length).toBeGreaterThan(0);
      expect(result.cyclesDetected.some((c) => c.key.includes('service:delhi-trade-licence'))).toBe(true);
    });

    it('identifies orphan nodes without connected edges under current filters', () => {
      const result = service.queryGraph({
        searchTerm: 'Synthetic Isolated Civic Scheme',
      });

      expect(result.ok).toBe(true);
      expect(result.orphanNodes.some((o) => o.id === 'service:synthetic-orphan-service')).toBe(true);
    });
  });

  describe('Authorization Boundaries & Cache Invalidation', () => {
    it('blocks guests from querying draft policies', () => {
      const result = service.queryGraph(
        {
          startNodeId: 'service:draft-solar-subsidy',
          publicationStatus: 'draft',
        },
        { role: 'guest' }
      );

      expect(result.ok).toBe(false);
      expect(result.error).toBe('forbidden');
    });

    it('allows reviewers and administrators to query draft policies', () => {
      const result = service.queryGraph(
        {
          startNodeId: 'service:draft-solar-subsidy',
          publicationStatus: 'draft',
        },
        { role: 'reviewer' }
      );

      expect(result.ok).toBe(true);
      expect(result.nodes.some((n) => n.id === 'service:draft-solar-subsidy')).toBe(true);
    });

    it('caches repeated queries and invalidates cache on demand', () => {
      const q = { startNodeId: 'service:driving-licence', maxDepth: 1 };
      const run1 = service.queryGraph(q);
      expect(run1.cached).toBeUndefined();

      const run2 = service.queryGraph(q);
      expect(run2.cached).toBe(true);

      const inv = service.invalidateCache('test');
      expect(inv.invalidated).toBe(true);

      const run3 = service.queryGraph(q);
      expect(run3.cached).toBeUndefined();
    });
  });
});
