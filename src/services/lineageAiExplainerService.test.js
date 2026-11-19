import { describe, it, expect, beforeEach } from 'vitest';
import {
  explainLineagePath,
  recordHumanDecisionOnAiSummary,
  EXPLAINER_RULESET_VERSION,
} from './lineageAiExplainerService';
import { initializeProvenanceStorage } from './provenanceStorage';

describe('lineageAiExplainerService', () => {
  beforeEach(() => {
    initializeProvenanceStorage(true);
  });

  it('generates an explainable narrative for verified civic facts without hallucinating edges', () => {
    const res = explainLineagePath('tree-pruning-permission');
    expect(res.status).toBe('verified');
    expect(res.summary).toContain('Delhi Preservation of Trees Act');
    expect(res.publishers).toContain('Department of Forests and Wildlife, GNCTD');
    expect(res.rulesetVersion).toBe(EXPLAINER_RULESET_VERSION);
    expect(res.executionTimestamp).toBeDefined();
    expect(res.isDeterministic).toBe(true);
    expect(res.confidenceScore).toBeGreaterThan(0.9);
    expect(res.traceability.edgesTraversed).toBeGreaterThan(0);
  });

  it('returns unverified state when fact has no provenance edges, without fabricating links', () => {
    const res = explainLineagePath('non-existent-random-fact-id');
    expect(res.status).toBe('unverified_unlinked');
    expect(res.summary).toContain('No verified legal provenance path');
    expect(res.sources).toHaveLength(0);
    expect(res.confidenceScore).toBe(0.0);
  });

  it('records human review decisions (accept/edit/reject) with metadata', () => {
    const decision = recordHumanDecisionOnAiSummary(
      'tree-pruning-permission',
      'accept',
      'officer_sharma',
      'Confirmed statutory timeline matches high court directive.'
    );
    expect(decision.targetEntityId).toBe('tree-pruning-permission');
    expect(decision.decision).toBe('accept');
    expect(decision.reviewedBy).toBe('officer_sharma');
    expect(decision.rulesetVersion).toBe(EXPLAINER_RULESET_VERSION);

    expect(() => {
      recordHumanDecisionOnAiSummary('tree-pruning-permission', 'invalid_decision');
    }).toThrow(/must be 'accept', 'edit', or 'reject'/);
  });

  it('warns when an authoritative source URL is marked unreachable', async () => {
    const { updateKnowledgeSourceStatus } = await import('./provenanceService');
    updateKnowledgeSourceStatus(
      'src_delhi_tree_preservation_act_1994',
      'unreachable',
      'Dead official link'
    );
    const res = explainLineagePath('tree-pruning-permission');
    expect(res.status).toBe('unreachable');
    expect(res.hasUnreachableSource).toBe(true);
    expect(res.summary).toContain('WARNING: Authoritative source URL is currently marked unreachable');
  });
});

