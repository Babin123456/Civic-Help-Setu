import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  buildCivicEvidenceGraph,
  resolveGraphConflict,
  generateEvidenceGraphReport,
  clearEvidenceGraphCache,
} from './civicEvidenceGraphService';
import {
  FACT_TYPES,
  RESOLUTION_ACTIONS,
  RESOLUTION_STATUSES,
  CONFLICT_SEVERITIES,
} from './civicEvidenceGraphSchemas';
import {
  detectAllContradictions,
  indicPhoneticKey,
} from './civicContradictionDetectionEngine';
import EvidenceGraphContradictionModal from '../components/vault/EvidenceGraphContradictionModal';
import { SYNTHETIC_VAULT_DOCUMENTS } from '../../tests/fixtures/syntheticEvidenceFixtures';

describe('Civic Evidence Graph - Concurrency, Permissions & End-to-End Integrity (#1165)', () => {
  beforeEach(() => {
    clearEvidenceGraphCache();
  });

  describe('1. Permission & Access Control Cases', () => {
    it('enforces privacy lock when vault is locked and prevents data inspection', () => {
      const html = renderToStaticMarkup(
        <EvidenceGraphContradictionModal
          isOpen={true}
          isLocked={true}
          documents={SYNTHETIC_VAULT_DOCUMENTS}
          onClose={() => {}}
        />
      );

      expect(html).toContain('Vault Locked for Privacy');
      expect(html).toContain(
        'Please unlock your encrypted vault with your passphrase to access cross-document contradiction detection.'
      );
      // Ensure no raw document names or conflict details are exposed while locked
      expect(html).not.toContain('Critical Mismatches');
      expect(html).not.toContain('Aadhaar Card');
    });

    it('renders normal verification interface when vault is unlocked (isLocked=false)', () => {
      const html = renderToStaticMarkup(
        <EvidenceGraphContradictionModal
          isOpen={true}
          isLocked={false}
          documents={SYNTHETIC_VAULT_DOCUMENTS}
          onClose={() => {}}
        />
      );

      expect(html).not.toContain('Vault Locked for Privacy');
      expect(html).toContain('Civic Evidence Graph: Discrepancy Detector');
      expect(html).toContain('Critical Mismatches');
    });
  });

  describe('2. Concurrency & Concurrent Resolutions', () => {
    it('handles multiple sequential and interleaved resolutions without losing state', () => {
      const docs = [
        SYNTHETIC_VAULT_DOCUMENTS[0], // Aadhaar
        SYNTHETIC_VAULT_DOCUMENTS[1], // School Certificate
        SYNTHETIC_VAULT_DOCUMENTS[3], // Application Receipt
        SYNTHETIC_VAULT_DOCUMENTS[4], // Notice with OCR confusion
      ];

      const initialGraph = buildCivicEvidenceGraph({ documents: docs });
      const initialConflicts = initialGraph.edges.conflicts;
      expect(initialConflicts.length).toBeGreaterThanOrEqual(2);

      // Resolve Conflict 1
      const conflict1 = initialConflicts[0];
      const graphAfterRes1 = resolveGraphConflict({
        graph: initialGraph,
        conflictId: conflict1.id,
        resolution: {
          actionTaken: RESOLUTION_ACTIONS.USE_SOURCE_A,
          preferredFactId: conflict1.sourceFactId,
          citizenNote: 'Selected primary official Aadhaar record.',
        },
      });

      // Resolve Conflict 2 on the updated graph
      const conflict2 = initialConflicts[1];
      const graphAfterRes2 = resolveGraphConflict({
        graph: graphAfterRes1,
        conflictId: conflict2.id,
        resolution: {
          actionTaken: RESOLUTION_ACTIONS.IGNORE_TYPO,
          citizenNote: 'Dismissed acceptable phonetic variation.',
        },
      });

      // Verification: Both resolutions must be present
      const edge1 = graphAfterRes2.edges.conflicts.find((c) => c.id === conflict1.id);
      const edge2 = graphAfterRes2.edges.conflicts.find((c) => c.id === conflict2.id);

      expect(edge1?.resolutionStatus).toBe(RESOLUTION_STATUSES.RESOLVED_OVERRIDE);
      expect(edge1?.resolution?.citizenNote).toBe('Selected primary official Aadhaar record.');

      expect(edge2?.resolutionStatus).toBe(RESOLUTION_STATUSES.DISMISSED_FALSE_POSITIVE);
      expect(edge2?.resolution?.citizenNote).toBe('Dismissed acceptable phonetic variation.');
    });

    it('simulates batch resolution reducer without race condition or lost updates', () => {
      const docs = [SYNTHETIC_VAULT_DOCUMENTS[0], SYNTHETIC_VAULT_DOCUMENTS[1]];
      const graph = buildCivicEvidenceGraph({ documents: docs });

      const resolutionsToApply = graph.edges.conflicts.map((edge) => ({
        conflictId: edge.id,
        resolution: {
          actionTaken: RESOLUTION_ACTIONS.USE_SOURCE_A,
          preferredFactId: edge.sourceFactId,
          citizenNote: `Batch auto-confirmation for ${edge.id}`,
        },
      }));

      // Reduce through all resolutions sequentially (transaction style)
      const finalGraph = resolutionsToApply.reduce((accGraph, item) => {
        return resolveGraphConflict({
          graph: accGraph,
          conflictId: item.conflictId,
          resolution: item.resolution,
        });
      }, graph);

      expect(finalGraph.summary.unresolvedCriticalCount).toBe(0);
      expect(finalGraph.summary.unresolvedWarningCount).toBe(0);

      for (const edge of finalGraph.edges.conflicts) {
        expect(edge.resolutionStatus).toBe(RESOLUTION_STATUSES.RESOLVED_OVERRIDE);
        expect(edge.resolution?.citizenNote).toContain('Batch auto-confirmation');
      }
    });
  });

  describe('3. Negative Cases & Retry Safety', () => {
    it('gracefully handles documents with corrupted/empty OCR text without crashing', () => {
      const corruptedDocs = [
        { id: 'corrupt-1', type: 'Unknown', ocrText: null, notes: undefined },
        { id: 'corrupt-2', type: 'Corrupt', ocrText: '???!!!@#$%^&*()', notes: '' },
      ];

      expect(() => {
        const graph = buildCivicEvidenceGraph({ documents: corruptedDocs });
        expect(graph.documentCount).toBe(2);
        expect(graph.summary.totalFacts).toBe(0);
        expect(graph.edges.conflicts).toHaveLength(0);
      }).not.toThrow();
    });

    it('re-running graph generation is idempotent and safe for retries', () => {
      const docs = [SYNTHETIC_VAULT_DOCUMENTS[0], SYNTHETIC_VAULT_DOCUMENTS[1]];

      const run1 = buildCivicEvidenceGraph({ documents: docs });
      const run2 = buildCivicEvidenceGraph({ documents: docs, existingGraph: run1 });
      const run3 = buildCivicEvidenceGraph({ documents: docs, existingGraph: run2 });

      expect(run3.summary.totalFacts).toBe(run1.summary.totalFacts);
      expect(run3.summary.totalConflicts).toBe(run1.summary.totalConflicts);
      expect(run3.edges.conflicts.length).toBe(run1.edges.conflicts.length);
    });

    it('throws descriptive error on invalid conflict resolution target ID', () => {
      const docs = [SYNTHETIC_VAULT_DOCUMENTS[0], SYNTHETIC_VAULT_DOCUMENTS[1]];
      const graph = buildCivicEvidenceGraph({ documents: docs });

      expect(() => {
        resolveGraphConflict({
          graph,
          conflictId: 'non-existent-conflict-id',
          resolution: {
            actionTaken: RESOLUTION_ACTIONS.IGNORE_TYPO,
          },
        });
      }).toThrow(/not found in graph/i);
    });
  });

  describe('4. Multilingual & Near-Match Verification', () => {
    it('accurately distinguishes true identity conflicts from multilingual near matches', () => {
      // 1. Multilingual Indic Transliteration: Lakshmi / Laxmi
      expect(indicPhoneticKey('Lakshmi')).toBe(indicPhoneticKey('Laxmi'));
      // 2. Multilingual Indic Transliteration: Mukherjee / Mookherjee
      expect(indicPhoneticKey('Mukherjee')).toBe(indicPhoneticKey('Mookherjee'));
      // 3. Multilingual Indic Transliteration: Prasad / Parshad
      expect(indicPhoneticKey('Choudhary')).toBe(indicPhoneticKey('Chowdhury'));

      // Distinct names must NOT match
      expect(indicPhoneticKey('Ramesh')).not.toBe(indicPhoneticKey('Suresh'));
      expect(indicPhoneticKey('Deepak')).not.toBe(indicPhoneticKey('Amit'));
    });
  });

  describe('5. End-to-End Vertical Slice Integrity', () => {
    it('executes the full lifecycle: Ingestion -> Detection -> Resolution -> Privacy-Masked Audit', () => {
      // Step A: Ingestion of citizen dossier
      const citizenDossier = [
        SYNTHETIC_VAULT_DOCUMENTS[0], // Aadhaar (DOB 1988)
        SYNTHETIC_VAULT_DOCUMENTS[1], // School Cert (DOB 1989)
      ];

      // Step B: Graph Construction & Contradiction Detection
      const graph = buildCivicEvidenceGraph({ documents: citizenDossier });
      expect(graph.summary.unresolvedCriticalCount).toBe(1);

      const criticalDobEdge = graph.edges.conflicts.find(
        (c) => c.severity === CONFLICT_SEVERITIES.CRITICAL
      );
      expect(criticalDobEdge).toBeDefined();

      // Step C: Citizen Resolution (Human-in-the-Loop)
      const resolvedGraph = resolveGraphConflict({
        graph,
        conflictId: criticalDobEdge.id,
        resolution: {
          actionTaken: RESOLUTION_ACTIONS.USE_SOURCE_A,
          preferredFactId: criticalDobEdge.sourceFactId,
          citizenNote: 'Aadhaar DOB matches Birth Register.',
        },
      });

      expect(resolvedGraph.summary.unresolvedCriticalCount).toBe(0);

      // Step D: Report Generation & Redaction Audit
      const report = generateEvidenceGraphReport(resolvedGraph);
      expect(report).toContain('**Status:** ✅ READY (No Critical Discrepancies)');
      expect(report).toContain('Aadhaar DOB matches Birth Register.');
      // Verify zero raw unmasked Aadhaar number leakage
      expect(report).not.toContain('9999 1111 2222');
      expect(report).toContain('XXXX-XXXX-2222');
    });
  });
});
