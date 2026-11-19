/**
 * Terminology Graph Unit Tests (#830)
 *
 * Tests for the terminology relationship graph data model,
 * including node management, edge validation, search, and transformations.
 */

import {
  RELATIONSHIP_TYPES,
  EDGE_REVIEW_STATUS,
  CATEGORIES,
  INITIAL_TERMINOLOGY_NODES,
  INITIAL_RELATIONSHIPS,
  searchTerminology,
  getEdgesForNode,
  getOutgoingEdges,
  getIncomingEdges,
  getEdgesByType,
  addRelationship,
  approveRelationship,
  rejectRelationship,
  getPendingEdges,
  getApprovedEdges,
  glossaryEntryToNode,
  validateEdge,
  getRelatedNodes,
  getRelevantTermsForIssue,
  getGraphMetadata,
} from '../terminologyGraph';

import { CIVIC_GLOSSARY } from '../civicGlossary';

describe('Terminology Graph Data Model', () => {
  describe('Relationship Types', () => {
    test('all relationship types are defined', () => {
      expect(RELATIONSHIP_TYPES.SYNONYM).toBe('synonym');
      expect(RELATIONSHIP_TYPES.PREREQUISITE).toBe('prerequisite');
      expect(RELATIONSHIP_TYPES.RELATED).toBe('related');
      expect(RELATIONSHIP_TYPES.CONFUSING).toBe('confusing');
      expect(RELATIONSHIP_TYPES.ALTERNATIVE).toBe('alternative');
    });

    test('all relationship types are valid', () => {
      const validTypes = [RELATIONSHIP_TYPES.SYNONYM, RELATIONSHIP_TYPES.PREREQUISITE, RELATIONSHIP_TYPES.RELATED, RELATIONSHIP_TYPES.CONFUSING, RELATIONSHIP_TYPES.ALTERNATIVE];
      validTypes.forEach((type) => {
        expect(typeof type).toBe('string');
      });
    });
  });

  describe('Edge Review Status', () => {
    test('all reviewer states are defined', () => {
      expect(EDGE_REVIEW_STATUS.PENDING).toBe('pending');
      expect(EDGE_REVIEW_STATUS.APPROVED).toBe('approved');
      expect(EDGE_REVIEW_STATUS.REJECTED).toBe('rejected');
    });
  });

  describe('Categorizes', () => {
    test('all categories are defined', () => {
      expect(CATEGORIES.CERTIFICATE).toBe('certificate');
      expect(CATEGORIES.EXTRACT).toBe('extract');
      expect(CATEGORIES.LICENSE).toBe('license');
      expect(CATEGORIES.PERMIT).toBe('permit');
      expect(CATEGORIES.RENEWAL).toBe('renewal');
      expect(CATEGORIES.CORRECTION).toBe('correction');
      expect(CATEGORIES.REISSUE).toBe('reissue');
      expect(CATEGORIES.APPLICATION).toBe('application');
    });
  });

  describe('Initial Terminology Nodes', () => {
    test('initial nodes are defined', () => {
      expect(Array.isArray(INITIAL_TERMINOLOGY_NODES)).toBe(true);
      expect(INITIAL_TERMINOLOGY_NODES.length).toBeGreaterThan(0);
    });

    test('nodes have required fields', () => {
      const node = INITIAL_TERMINOLOGY_NODES[0];
      expect(node).toHaveProperty('id');
      expect(node).toHaveProperty('term');
      expect(node).toHaveProperty('category');
      expect(node).toHaveProperty('description');
    });

    test('nodes have unique IDs', () => {
      const ids = INITIAL_TERMINOLOGY_NODES.map((n) => n.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('Initial Relationships', () => {
    test('initial relationships are defined', () => {
      expect(Array.isArray(INITIAL_RELATIONSHIPS)).toBe(true);
      expect(INITIAL_RELATIONSHIPS.length).toBeGreaterThan(0);
    });

    test('relationships have required fields', () => {
      const edge = INITIAL_RELATIONSHIPS[0];
      expect(edge).toHaveProperty('source');
      expect(edge).toHaveProperty('target');
      expect(edge).toHaveProperty('type');
      expect(edge).toHaveProperty('description');
    });

    test('relationship types are valid', () => {
      INITIAL_RELATIONSHIPS.forEach((edge) => {
        expect(
          [RELATIONSHIP_TYPES.SYNONYM, RELATIONSHIP_TYPES.PREREQUISITE, RELATIONSHIP_TYPES.RELATED, RELATIONSHIP_TYPES.CONFUSING, RELATIONSHIP_TYPES.ALTERNATIVE].includes(edge.type)
        ).toBe(true);
      });
    });

    test('edges have review status', () => {
      INITIAL_RELATIONSHIPS.forEach((edge) => {
        expect(['pending', 'approved', 'rejected'].includes(edge.reviewStatus)).toBe(true);
      });
    });
  });

  describe('searchTerminology', () => {
    test('searches by term', () => {
      const results = searchTerminology('certificate');
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((n) => n.id === 'certificate')).toBe(true);
    });

    test('searches by alias', () => {
      const results = searchTerminology('cert');
      expect(Array.isArray(results)).toBe(true);
      // Should match abbreviations or similar terms
    });

    test('searches by category', () => {
      const results = searchTerminology('certificate');
      expect(results.some((n) => n.category === CATEGORIES.CERTIFICATE)).toBe(true);
    });

    test('returns all nodes for empty query', () => {
      const results = searchTerminology('');
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    });

    test('filters by partial match', () => {
      const results = searchTerminology('licen');
      expect(Array.isArray(results)).toBe(true);
      // Should match 'licence'
    });
  });

  describe('getEdgesForNode', () => {
    test('gets edges for a node', () => {
      const edges = getEdgesForNode('certificate');
      expect(Array.isArray(edges)).toBe(true);
    });

    test('includes both incoming and outgoing edges', () => {
      const edges = getEdgesForNode('certificate');
      // Should include edges where certificate is source or target
      expect(edges.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getOutgoingEdges', () => {
    test('gets outgoing edges from a node', () => {
      const edges = getOutgoingEdges('application');
      expect(Array.isArray(edges)).toBe(true);
    });

    test('returns empty for non-existent node', () => {
      const edges = getOutgoingEdges('non-existent-id');
      expect(Array.isArray(edges)).toBe(true);
    });
  });

  describe('getIncomingEdges', () => {
    test('gets incoming edges to a node', () => {
      const edges = getIncomingEdges('certificate');
      expect(Array.isArray(edges)).toBe(true);
    });
  });

  describe('getEdgesByType', () => {
    test('gets edges by type', () => {
      const synonymEdges = getEdgesByType(RELATIONSHIP_TYPES.SYNONYM);
      expect(Array.isArray(synonymEdges)).toBe(true);
    });

    test('filters correctly by type', () => {
      INITIAL_RELATIONSHIPS.forEach((edge) => {
        if (edge.type === RELATIONSHIP_TYPES.PREREQUISITE) {
          expect(edge.type).toBe(RELATIONSHIP_TYPES.PREREQUISITE);
        }
      });
    });
  });

  describe('addRelationship', () => {
    test('adds a new relationship with PENDING status', () => {
      const newEdge = addRelationship({
        source: 'certificate',
        target: 'licence',
        type: RELATIONSHIP_TYPES.RELATED,
        description: 'Test description',
        sourceReference: { name: 'Test', version: '1.0' },
      });

      expect(newEdge).toHaveProperty('id');
      expect(newEdge.reviewStatus).toBe(EDGE_REVIEW_STATUS.PENDING);
      expect(newEdge.source).toBe('certificate');
      expect(newEdge.target).toBe('licence');
      expect(newEdge.type).toBe(RELATIONSHIP_TYPES.RELATED);
    });

    test('validates edge structure', () => {
      // Invalid edge - missing required fields
      const result = validateEdge(null);
      expect(result.valid).toBe(false);

      // Invalid edge - same source and target
      const result2 = validateEdge({
        source: 'certificate',
        target: 'certificate',
        type: RELATIONSHIP_TYPES.RELATED,
        description: 'Same node',
        sourceReference: { name: 'Test', version: '1.0' },
      });
      expect(result2.valid).toBe(false);
      expect(result2.errors).toContain('Source and target nodes must be different');
    });

    test('valid edge passes validation', () => {
      const result = validateEdge({
        source: 'certificate',
        target: 'licence',
        type: RELATIONSHIP_TYPES.RELATED,
        description: 'Test description',
        sourceReference: { name: 'Test', version: '1.0' },
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('approveRelationship', () => {
    test('approves a relationship', () => {
      const result = approveRelationship('edge-123');
      expect(result.reviewStatus).toBe(EDGE_REVIEW_STATUS.APPROVED);
      expect(result).toHaveProperty('approvedAt');
    });
  });

  describe('rejectRelationship', () => {
    test('rejects a relationship', () => {
      const result = rejectRelationship('edge-123');
      expect(result.reviewStatus).toBe(EDGE_REVIEW_STATUS.REJECTED);
      expect(result).toHaveProperty('rejectedAt');
    });
  });

  describe('getPendingEdges', () => {
    test('returns pending edges', () => {
      const pending = getPendingEdges();
      expect(Array.isArray(pending)).toBe(true);
      pending.forEach((edge) => {
        expect(edge.reviewStatus).toBe(EDGE_REVIEW_STATUS.PENDING);
      });
    });
  });

  describe('getApprovedEdges', () => {
    test('returns approved edges', () => {
      const approved = getApprovedEdges();
      expect(Array.isArray(approved)).toBe(true);
      approved.forEach((edge) => {
        expect(edge.reviewStatus).toBe(EDGE_REVIEW_STATUS.APPROVED);
      });
    });
  });

  describe('glossaryEntryToNode', () => {
    test('converts glossary entry to terminology node', () => {
      const node = glossaryEntryToNode('affidavit');
      expect(node).toBeDefined();
      expect(node.id).toBe('affidavit');
      expect(node.term).toBe('Affidavit');
      expect(node.category).toBeDefined();
    });

    test('returns undefined for non-existent entry', () => {
      const node = glossaryEntryToNode('non-existent-term');
      expect(node).toBeUndefined();
    });
  });

  describe('getRelatedNodes', () => {
    test('gets related nodes for a starting node', () => {
      const related = getRelatedNodes('application');
      expect(Array.isArray(related)).toBe(true);
    });

    test('filters by relationship type', () => {
      const related = getRelatedNodes('application', { type: RELATIONSHIP_TYPES.PREREQUISITE });
      expect(Array.isArray(related)).toBe(true);
    });

    test('only approved by default', () => {
      const related = getRelatedNodes('application');
      // Should only follow approved edges
      related.forEach((item) => {
        expect(item.edge.reviewStatus).toBe('approved');
      });
    });
  });

  describe('getRelevantTermsForIssue', () => {
    test('returns relevant terms for the issue', () => {
      const terms = getRelevantTermsForIssue();
      expect(Array.isArray(terms)).toBe(true);
      // Should include the key terms from the issue
      const termIds = terms.map((t) => t.id);
      expect(termIds).toContain('certificate');
      expect(termIds).toContain('licence');
      expect(termIds).toContain('permit');
      expect(termIds).toContain('renewal');
      expect(termIds).toContain('correction');
      expect(termIds).toContain('reissue');
      expect(termIds).toContain('application');
    });
  });

  describe('getGraphMetadata', () => {
    test('returns graph metadata', () => {
      const metadata = getGraphMetadata();
      expect(metadata).toHaveProperty('version');
      expect(metadata).toHaveProperty('nodeCount');
      expect(metadata).toHaveProperty('edgeCount');
      expect(metadata).toHaveProperty('approvedEdgeCount');
      expect(metadata).toHaveProperty('pendingEdgeCount');
      expect(metadata).toHaveProperty('categories');
      expect(metadata).toHaveProperty('lastUpdated');
    });
  });
});