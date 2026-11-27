/**
 * src/services/civicKnowledgeGraphEdgeWorkflow.test.js
 *
 * Unit tests for Cross-Department Service Dependency Edge Workflow (#1429).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  detectCycleWithCandidateEdge,
  proposeDependencyEdge,
  reviewAndPublishEdge,
  buildAccessibleDependencyList,
  listEdgeAuditLog,
} from './civicKnowledgeGraphEdgeWorkflow.js';
import { CivicKnowledgeGraphService } from './civicKnowledgeGraphService.js';
import { GRAPH_EDGE_TYPES, PUBLICATION_STATUSES } from '../data/civicKnowledgeGraphContract.js';

const createMockStorage = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
  };
};

describe('civicKnowledgeGraphEdgeWorkflow (#1429)', () => {
  let storage;
  let graph;

  beforeEach(() => {
    storage = createMockStorage();
    graph = new CivicKnowledgeGraphService({
      nodes: [
        { id: 'svc:a', type: 'service', title: 'Service A', jurisdiction: 'Delhi', publicationStatus: PUBLICATION_STATUSES.PUBLISHED },
        { id: 'svc:b', type: 'service', title: 'Service B', jurisdiction: 'Delhi', publicationStatus: PUBLICATION_STATUSES.PUBLISHED },
        { id: 'doc:c', type: 'document', title: 'Doc C', jurisdiction: 'Delhi', publicationStatus: PUBLICATION_STATUSES.PUBLISHED },
      ],
      edges: [
        {
          id: 'e1',
          from: 'svc:a',
          to: 'svc:b',
          type: GRAPH_EDGE_TYPES.REQUIRES_SERVICE,
          jurisdiction: 'Delhi',
          effectiveFrom: '2026-01-01',
          publicationStatus: PUBLICATION_STATUSES.PUBLISHED,
        },
      ],
    });
  });

  it('detects direct and transitive cycles before publication', () => {
    // svc:a -> svc:b exists; adding svc:b -> svc:a creates a cycle
    const res = detectCycleWithCandidateEdge(graph.edges, 'svc:b', 'svc:a');
    expect(res.hasCycle).toBe(true);
    expect(res.cyclePath).toContain('svc:a');

    // Adding svc:b -> doc:c does NOT create a cycle
    const clean = detectCycleWithCandidateEdge(graph.edges, 'svc:b', 'doc:c');
    expect(clean.hasCycle).toBe(false);
  });

  it('blocks self-review and blocks publishing cyclic edges (409)', () => {
    const cyclicProp = proposeDependencyEdge({
      sourceNodeId: 'svc:b',
      targetNodeId: 'svc:a',
      officialUrl: 'https://gov.in/order',
      proposedBy: 'contrib-1',
      graphInstance: graph,
      customStorage: storage,
    });
    expect(cyclicProp.hasCycle).toBe(true);

    // Self-review blocked
    expect(() =>
      reviewAndPublishEdge({
        proposalId: cyclicProp.proposalId,
        reviewerId: 'contrib-1',
        reviewerRole: 'reviewer',
        decision: 'PUBLISH',
        graphInstance: graph,
        customStorage: storage,
      })
    ).toThrow(/role separation/i);

    // Independent reviewer blocked by cycle check
    const pubBlocked = reviewAndPublishEdge({
      proposalId: cyclicProp.proposalId,
      reviewerId: 'rev-1',
      reviewerRole: 'reviewer',
      decision: 'PUBLISH',
      graphInstance: graph,
      customStorage: storage,
    });
    expect(pubBlocked.ok).toBe(false);
    expect(pubBlocked.status).toBe(409);
    expect(pubBlocked.code).toBe('ERR_CYCLE_DETECTED');
  });

  it('publishes valid non-cyclic edge, updates accessible dependency list, and records audit log', () => {
    const validProp = proposeDependencyEdge({
      sourceNodeId: 'svc:b',
      targetNodeId: 'doc:c',
      edgeType: GRAPH_EDGE_TYPES.REQUIRES_DOCUMENT,
      jurisdiction: 'Delhi',
      effectiveFrom: '2026-02-01',
      officialUrl: 'https://edistrict.delhigovt.nic.in',
      proposedBy: 'contrib-1',
      graphInstance: graph,
      customStorage: storage,
    });

    const pub = reviewAndPublishEdge({
      proposalId: validProp.proposalId,
      reviewerId: 'rev-1',
      reviewerRole: 'reviewer',
      decision: 'PUBLISH',
      graphInstance: graph,
      customStorage: storage,
    });
    expect(pub.ok).toBe(true);
    expect(pub.proposal.status).toBe('PUBLISHED');

    const list = buildAccessibleDependencyList({
      startNodeId: 'svc:a',
      jurisdiction: 'Delhi',
      effectiveAsOf: '2026-06-01',
      graphInstance: graph,
    });
    expect(list.ok).toBe(true);
    expect(list.items.some((i) => i.targetId === 'doc:c')).toBe(true);

    const audit = listEdgeAuditLog(storage);
    expect(audit[0].action).toBe('EDGE_PUBLISHED');
  });

  it('rejects Aadhaar/PAN PII and non-HTTPS officialUrl', () => {
    expect(() =>
      proposeDependencyEdge({
        sourceNodeId: 'svc:a',
        targetNodeId: 'doc:c',
        officialUrl: 'http://insecure.gov.in',
        graphInstance: graph,
        customStorage: storage,
      })
    ).toThrow(/https/i);

    expect(() =>
      proposeDependencyEdge({
        sourceNodeId: 'svc:a',
        targetNodeId: 'doc:c',
        officialUrl: 'https://gov.in',
        statutoryAct: 'Aadhaar 1234 5678 9012',
        graphInstance: graph,
        customStorage: storage,
      })
    ).toThrow(/Aadhaar or PAN/i);
  });
});
