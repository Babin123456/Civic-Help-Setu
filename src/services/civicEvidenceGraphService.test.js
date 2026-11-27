import { describe, it, expect, beforeEach } from 'vitest';
import {
  extractFactsFromDocument,
  buildCivicEvidenceGraph,
  resolveGraphConflict,
  generateEvidenceGraphReport,
  saveEvidenceGraphToCache,
  getEvidenceGraphFromCache,
  clearEvidenceGraphCache,
  EVIDENCE_GRAPH_DISCLAIMER,
} from './civicEvidenceGraphService';
import {
  RESOLUTION_STATUSES,
  RESOLUTION_ACTIONS,
  FACT_TYPES,
} from './civicEvidenceGraphSchemas';
import { SYNTHETIC_VAULT_DOCUMENTS } from '../../tests/fixtures/syntheticEvidenceFixtures';

describe('civicEvidenceGraphService', () => {
  beforeEach(() => {
    clearEvidenceGraphCache();
  });

  describe('extractFactsFromDocument', () => {
    it('extracts identifier, expiry, and OCR fields from a vault document', () => {
      const doc = SYNTHETIC_VAULT_DOCUMENTS[0]; // Aadhaar
      const facts = extractFactsFromDocument(doc);

      expect(facts.length).toBeGreaterThanOrEqual(2);

      const numFact = facts.find((f) => f.factType === FACT_TYPES.DOCUMENT_IDENTIFIER);
      expect(numFact).toBeDefined();
      expect(numFact?.provenance.documentId).toBe(doc.id);
      expect(numFact?.provenance.ocrConfidence).toBe(0.98);

      const nameFact = facts.find((f) => f.factType === FACT_TYPES.FULL_NAME);
      expect(nameFact).toBeDefined();
      expect(nameFact?.rawValue).toBe('Lakshmi Devi');
    });

    it('returns empty array for invalid document', () => {
      expect(extractFactsFromDocument(null)).toEqual([]);
      expect(extractFactsFromDocument({})).toEqual([]);
    });
  });

  describe('buildCivicEvidenceGraph', () => {
    it('builds a valid graph with document nodes, fact nodes, and conflict edges', () => {
      // Ingest Aadhaar and School Certificate
      const docs = [SYNTHETIC_VAULT_DOCUMENTS[0], SYNTHETIC_VAULT_DOCUMENTS[1]];
      const graph = buildCivicEvidenceGraph({ documents: docs });

      expect(graph.schemaVersion).toBe('1.0.0');
      expect(graph.documentCount).toBe(2);
      expect(graph.nodes.documents[docs[0].id]).toBeDefined();
      expect(graph.nodes.documents[docs[1].id]).toBeDefined();

      // Should detect DOB mismatch (15/08/1988 vs 15/08/1989)
      expect(graph.summary.unresolvedCriticalCount).toBeGreaterThanOrEqual(1);
      // Should detect Name near-match (Lakshmi Devi vs Laxmi Devi)
      expect(graph.summary.nearMatchCount).toBeGreaterThanOrEqual(1);

      const dobConflict = graph.edges.conflicts.find(
        (c) => c.factType === FACT_TYPES.DATE_OF_BIRTH
      );
      expect(dobConflict).toBeDefined();
      expect(dobConflict?.resolutionStatus).toBe(RESOLUTION_STATUSES.UNRESOLVED);
    });
  });

  describe('resolveGraphConflict (Non-Destructive)', () => {
    it('resolves a conflict edge with citizen override without modifying source documents', () => {
      const docs = [SYNTHETIC_VAULT_DOCUMENTS[0], SYNTHETIC_VAULT_DOCUMENTS[1]];
      // Deep freeze or copy docs to ensure immutability
      const originalDocCopy = JSON.parse(JSON.stringify(docs));

      const graph = buildCivicEvidenceGraph({ documents: docs });
      const dobConflict = graph.edges.conflicts.find(
        (c) => c.factType === FACT_TYPES.DATE_OF_BIRTH
      );

      const initialCritical = graph.summary.unresolvedCriticalCount;

      const resolvedGraph = resolveGraphConflict({
        graph,
        conflictId: dobConflict.id,
        resolution: {
          actionTaken: RESOLUTION_ACTIONS.USE_SOURCE_A,
          preferredFactId: dobConflict.sourceFactId,
          citizenNote: 'Aadhaar DOB is verified by municipal birth records.',
        },
      });

      // Verification: Source documents are completely unchanged
      expect(docs).toEqual(originalDocCopy);

      // Edge status updated
      const updatedEdge = resolvedGraph.edges.conflicts.find((c) => c.id === dobConflict.id);
      expect(updatedEdge?.resolutionStatus).toBe(RESOLUTION_STATUSES.RESOLVED_OVERRIDE);
      expect(updatedEdge?.resolution?.actionTaken).toBe(RESOLUTION_ACTIONS.USE_SOURCE_A);
      expect(updatedEdge?.resolution?.citizenNote).toContain('municipal birth records');

      // Unresolved critical count decremented
      expect(resolvedGraph.summary.unresolvedCriticalCount).toBe(initialCritical - 1);
    });

    it('rejects invalid resolution payloads', () => {
      const docs = [SYNTHETIC_VAULT_DOCUMENTS[0], SYNTHETIC_VAULT_DOCUMENTS[1]];
      const graph = buildCivicEvidenceGraph({ documents: docs });
      const dobConflict = graph.edges.conflicts[0];

      expect(() => {
        resolveGraphConflict({
          graph,
          conflictId: dobConflict.id,
          resolution: {
            actionTaken: 'INVALID_ACTION',
          },
        });
      }).toThrow(/Resolution rejected/);
    });
  });

  describe('Incremental graph updates and resolution preservation', () => {
    it('preserves existing citizen resolutions when new documents are added', () => {
      const docsStep1 = [SYNTHETIC_VAULT_DOCUMENTS[0], SYNTHETIC_VAULT_DOCUMENTS[1]];
      const graph1 = buildCivicEvidenceGraph({ documents: docsStep1 });
      const dobConflict1 = graph1.edges.conflicts.find(
        (c) => c.factType === FACT_TYPES.DATE_OF_BIRTH
      );

      const resolvedGraph1 = resolveGraphConflict({
        graph: graph1,
        conflictId: dobConflict1.id,
        resolution: {
          actionTaken: RESOLUTION_ACTIONS.USE_SOURCE_A,
          preferredFactId: dobConflict1.sourceFactId,
          citizenNote: 'Confirmed Aadhaar as primary.',
        },
      });

      // Now add a 3rd document (PAN Card)
      const docsStep2 = [
        SYNTHETIC_VAULT_DOCUMENTS[0],
        SYNTHETIC_VAULT_DOCUMENTS[1],
        SYNTHETIC_VAULT_DOCUMENTS[2],
      ];
      const graph2 = buildCivicEvidenceGraph({
        documents: docsStep2,
        existingGraph: resolvedGraph1,
      });

      // The previous DOB conflict between doc 1 and 2 should remain resolved!
      const dobConflict2 = graph2.edges.conflicts.find(
        (c) =>
          c.factType === FACT_TYPES.DATE_OF_BIRTH &&
          (c.sourceFactId === dobConflict1.sourceFactId ||
            c.targetFactId === dobConflict1.sourceFactId) &&
          (c.sourceFactId === dobConflict1.targetFactId ||
            c.targetFactId === dobConflict1.targetFactId)
      );

      expect(dobConflict2?.resolutionStatus).toBe(RESOLUTION_STATUSES.RESOLVED_OVERRIDE);
      expect(dobConflict2?.resolution?.citizenNote).toBe('Confirmed Aadhaar as primary.');
    });
  });

  describe('Report Generation & PII Redaction', () => {
    it('generates an audit report masking sensitive identifiers', () => {
      const docs = [SYNTHETIC_VAULT_DOCUMENTS[0], SYNTHETIC_VAULT_DOCUMENTS[1]];
      const graph = buildCivicEvidenceGraph({ documents: docs });

      const report = generateEvidenceGraphReport(graph);

      expect(report).toContain('Civic Evidence Graph Discrepancy Audit Report');
      expect(report).toContain(EVIDENCE_GRAPH_DISCLAIMER);
      // Ensure Aadhaar number (9999 1111 2222) is masked
      expect(report).not.toContain('9999 1111 2222');
      expect(report).toContain('XXXX-XXXX-2222');
    });
  });

  describe('Cache storage management', () => {
    it('persists and retrieves valid graph from cache', () => {
      const docs = [SYNTHETIC_VAULT_DOCUMENTS[0]];
      const graph = buildCivicEvidenceGraph({ documents: docs });

      saveEvidenceGraphToCache(graph);
      const loaded = getEvidenceGraphFromCache();

      expect(loaded).not.toBeNull();
      expect(loaded?.schemaVersion).toBe('1.0.0');
      expect(loaded?.documentCount).toBe(1);

      clearEvidenceGraphCache();
      expect(getEvidenceGraphFromCache()).toBeNull();
    });
  });
});
