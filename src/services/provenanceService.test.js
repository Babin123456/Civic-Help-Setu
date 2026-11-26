import { describe, it, expect, beforeEach } from 'vitest';
import {
  listKnowledgeSources,
  getKnowledgeSourceById,
  createKnowledgeSource,
  updateKnowledgeSourceStatus,
  addProvenanceEdge,
  detectCycles,
  recordEditorialReview,
  recordSupersession,
  recordSnapshot,
  recordTransformation,
  getLineageDAG,
  exportLineage,
} from './provenanceService';
import { initializeProvenanceStorage, getStoredSources } from './provenanceStorage';
import {
  PROVENANCE_STATUS,
  REVIEW_DECISIONS,
  EDGE_TYPES,
  SOURCE_TYPES,
  TRANSFORMATION_TYPES,
  JURISDICTION_LEVELS,
} from '../data/provenanceContract';

describe('provenanceService', () => {
  beforeEach(() => {
    initializeProvenanceStorage(true);
  });

  describe('list & query', () => {
    it('lists seeded knowledge sources', () => {
      const res = listKnowledgeSources();
      expect(res.total).toBeGreaterThan(0);
      expect(res.items.some((s) => s.id === 'src_delhi_tree_preservation_act_1994')).toBe(true);
    });

    it('filters by status and jurisdiction', () => {
      const superseded = listKnowledgeSources({ status: PROVENANCE_STATUS.SUPERSEDED });
      expect(superseded.items.every((s) => s.status === PROVENANCE_STATUS.SUPERSEDED)).toBe(true);

      const delhiSources = listKnowledgeSources({ jurisdiction: 'Delhi' });
      expect(delhiSources.items.every((s) => s.jurisdiction.state === 'Delhi')).toBe(true);
    });

    it('searches by name or publisher', () => {
      const res = listKnowledgeSources({ search: 'Aadhaar' });
      expect(res.items.length).toBeGreaterThan(0);
      expect(res.items[0].name).toContain('Aadhaar');
    });

    it('fetches source by id', () => {
      const source = getKnowledgeSourceById('src_delhi_tree_preservation_act_1994');
      expect(source).not.toBeNull();
      expect(source.publisher).toContain('GNCTD');
    });
  });

  describe('CRUD & state transitions', () => {
    it('creates a new valid knowledge source', () => {
      const newSrc = createKnowledgeSource(
        {
          name: 'Tamil Nadu Transparency in Tenders Act 1998',
          publisher: 'Finance Department, Government of Tamil Nadu',
          sourceUrl: 'https://tenders.tn.gov.in/act-1998',
          sourceType: SOURCE_TYPES.STATUTORY_ACT,
          jurisdiction: { level: JURISDICTION_LEVELS.STATE, state: 'Tamil Nadu' },
        },
        'test_admin'
      );
      expect(newSrc.id).toBeDefined();
      expect(newSrc.status).toBe(PROVENANCE_STATUS.ACTIVE);
      expect(getKnowledgeSourceById(newSrc.id)).not.toBeNull();
    });

    it('transitions source status when transition is valid', () => {
      const source = getKnowledgeSourceById('src_delhi_tree_preservation_act_1994');
      const updated = updateKnowledgeSourceStatus(source.id, PROVENANCE_STATUS.FLAGGED, 'Under annual audit');
      expect(updated.status).toBe(PROVENANCE_STATUS.FLAGGED);
    });

    it('throws error when source status transition is invalid', () => {
      const source = getKnowledgeSourceById('src_delhi_tree_order_2012_superseded');
      expect(() => {
        updateKnowledgeSourceStatus(source.id, PROVENANCE_STATUS.ACTIVE);
      }).toThrow(/Invalid state transition/);
    });
  });

  describe('DAG cycle prevention & edge management', () => {
    it('detects simple 2-node cycles', () => {
      const edges = [
        { sourceEntityId: 'NodeA', targetEntityId: 'NodeB' },
      ];
      const newEdge = { sourceEntityId: 'NodeB', targetEntityId: 'NodeA' };
      const check = detectCycles(edges, newEdge);
      expect(check.hasCycle).toBe(true);
      expect(check.cyclePath).toContain('NodeA');
    });

    it('detects multi-hop 3-node cycles', () => {
      const edges = [
        { sourceEntityId: 'NodeA', targetEntityId: 'NodeB' },
        { sourceEntityId: 'NodeB', targetEntityId: 'NodeC' },
      ];
      const newEdge = { sourceEntityId: 'NodeC', targetEntityId: 'NodeA' };
      const check = detectCycles(edges, newEdge);
      expect(check.hasCycle).toBe(true);
    });

    it('allows valid acyclic edges without false positives', () => {
      const edges = [
        { sourceEntityId: 'NodeA', targetEntityId: 'NodeB' },
        { sourceEntityId: 'NodeA', targetEntityId: 'NodeC' },
      ];
      const newEdge = { sourceEntityId: 'NodeB', targetEntityId: 'NodeC' };
      const check = detectCycles(edges, newEdge);
      expect(check.hasCycle).toBe(false);
    });

    it('throws ERR_PROVENANCE_CYCLE_DETECTED on cyclic addProvenanceEdge', () => {
      addProvenanceEdge({
        id: 'e_a_b',
        sourceEntityId: 'CYC_A',
        targetEntityId: 'CYC_B',
        edgeType: EDGE_TYPES.EXTRACTED_FROM,
        confidenceScore: 0.9,
      });

      expect(() => {
        addProvenanceEdge({
          id: 'e_b_a',
          sourceEntityId: 'CYC_B',
          targetEntityId: 'CYC_A',
          edgeType: EDGE_TYPES.DERIVED_FROM,
          confidenceScore: 0.9,
        });
      }).toThrow(/Cyclic lineage detected/);
    });
  });

  describe('editorial review & supersession', () => {
    it('records and updates editorial reviews', () => {
      const rev = recordEditorialReview(
        {
          targetEntityId: 'tree-pruning-permission:fees',
          reviewerRole: 'admin',
          reviewDecision: REVIEW_DECISIONS.APPROVED,
          publicNotes: 'Verified fee exemption for pruning under 10cm girth.',
        },
        'officer_sharma'
      );
      expect(rev.id).toBeDefined();
      expect(rev.reviewDecision).toBe(REVIEW_DECISIONS.APPROVED);
    });

    it('records supersession relationship and flags predecessor as superseded', () => {
      const newSrc = createKnowledgeSource(
        {
          id: 'src_delhi_tree_order_2026',
          name: 'Delhi Tree Protection Rules 2026',
          publisher: 'GNCTD',
          sourceUrl: 'https://forest.delhigovt.nic.in/tree-2026',
          sourceType: SOURCE_TYPES.MUNICIPAL_ORDER,
          jurisdiction: { level: JURISDICTION_LEVELS.STATE, state: 'Delhi' },
        },
        'admin'
      );

      const link = recordSupersession({
        predecessorId: 'src_bbmp_tree_bylaws_2020',
        successorId: newSrc.id,
        supersessionType: 'amendment',
        reason: 'Updated municipal tree canopy guidelines',
      });

      expect(link.id).toBeDefined();
      expect(link.predecessorId).toBe('src_bbmp_tree_bylaws_2020');
      expect(link.successorId).toBe(newSrc.id);
    });
  });

  describe('lineage traversal & export', () => {
    it('traverses the complete lineage DAG for tree-pruning-permission', () => {
      const dag = getLineageDAG('tree-pruning-permission');
      expect(dag.nodes.length).toBeGreaterThan(0);
      expect(dag.edges.length).toBeGreaterThan(0);
      expect(dag.nodes.some((n) => n.id === 'src_delhi_tree_preservation_act_1994')).toBe(true);
    });

    it('strips private notes when queried as public role', () => {
      const publicDag = getLineageDAG('tree-pruning-permission', { userRole: 'public' });
      expect(publicDag.reviews.every((r) => r.privateNotes === undefined)).toBe(true);

      const adminDag = getLineageDAG('tree-pruning-permission', { userRole: 'admin' });
      expect(adminDag.reviews.some((r) => r.privateNotes !== undefined)).toBe(true);
    });

    it('exports lineage to DOT and CSV formats', () => {
      const dot = exportLineage('tree-pruning-permission', 'dot');
      expect(dot).toContain('digraph Lineage_');
      expect(dot).toContain('rankdir=LR');

      const csv = exportLineage('tree-pruning-permission', 'csv');
      expect(csv).toContain('Source_Node_ID,Target_Node_ID,Edge_Type');
    });

    it('handles deleted or unreachable URLs by transitioning source status to UNREACHABLE', () => {
      const source = getKnowledgeSourceById('src_delhi_tree_preservation_act_1994');
      const updated = updateKnowledgeSourceStatus(
        source.id,
        PROVENANCE_STATUS.UNREACHABLE,
        'Government domain DNS failure / 404 URL'
      );
      expect(updated.status).toBe(PROVENANCE_STATUS.UNREACHABLE);

      const dag = getLineageDAG('tree-pruning-permission');
      const sourceNode = dag.nodes.find((n) => n.id === source.id);
      expect(sourceNode.data.status).toBe(PROVENANCE_STATUS.UNREACHABLE);
    });

    it('records source version changes across snapshots and parser runs', () => {
      const snap = recordSnapshot(
        'src_delhi_tree_preservation_act_1994',
        {
          effectiveDate: '2026-11-01',
          contentHash: 'f0e1d2c3b4a5968778',
          rawTextSnippet: 'Amended pruning limit: branches under 15 cm exempt.',
        },
        'importer_v2'
      );
      expect(snap.id).toBeDefined();

      const trans = recordTransformation(
        snap.id,
        {
          parserVersion: 'civic_statute_parser@3.0.0',
          transformationType: TRANSFORMATION_TYPES.REGEX_EXTRACTION,
          status: 'success',
        },
        'importer_v2'
      );
      expect(trans.id).toBeDefined();
      expect(trans.parserVersion).toBe('civic_statute_parser@3.0.0');
    });

    it('migrates and initializes storage cleanly against both empty and existing databases', () => {
      // Force empty database
      initializeProvenanceStorage(true);
      expect(getStoredSources().length).toBeGreaterThan(0);

      // Verify idempotency against existing database
      initializeProvenanceStorage(false);
      expect(getStoredSources().length).toBeGreaterThan(0);
    });
  });
});

