import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GraphQueryControls } from './GraphQueryControls.jsx';
import { GraphResultsViewer } from './GraphResultsViewer.jsx';
import { SYNTHETIC_GRAPH_NODES } from '../../data/civicKnowledgeGraphFixtures.js';

describe('Knowledge Graph UI Components (#1184)', () => {
  describe('GraphQueryControls component', () => {
    it('renders control elements with accessibility and bounded depth selector', () => {
      const query = {
        startNodeId: 'service:driving-licence',
        searchTerm: 'tree',
        jurisdiction: 'Delhi',
        maxDepth: 2,
        publicationStatus: 'published',
        effectiveAsOf: '2026-01-01',
      };

      const html = renderToStaticMarkup(
        <GraphQueryControls
          query={query}
          onQueryChange={() => {}}
          onExecuteQuery={() => {}}
          onResetQuery={() => {}}
          isLoading={false}
          availableNodes={SYNTHETIC_GRAPH_NODES}
        />
      );

      expect(html).toContain('Civic Service Knowledge Graph Query');
      expect(html).toContain('Start Node (Focal Civic Entity)');
      expect(html).toContain('Execute Traversal');
      expect(html).toContain('Max Traversal Depth (Bounded)');
      expect(html).toContain('Permanent Driving Licence Issuance');
    });

    it('displays loading state button text when query is in flight', () => {
      const html = renderToStaticMarkup(
        <GraphQueryControls
          query={{}}
          onQueryChange={() => {}}
          onExecuteQuery={() => {}}
          onResetQuery={() => {}}
          isLoading={true}
          availableNodes={[]}
        />
      );

      expect(html).toContain('Traversing Graph...');
    });
  });

  describe('GraphResultsViewer component', () => {
    it('renders placeholder when no results are passed', () => {
      const html = renderToStaticMarkup(
        <GraphResultsViewer results={null} selectedNode={null} onSelectNode={() => {}} />
      );

      expect(html).toContain('No query executed yet');
    });

    it('renders stats, traversal explanations, and discovered nodes', () => {
      const mockResults = {
        nodes: [
          { id: 'node-1', label: 'Driving Licence Service', type: 'SERVICE', jurisdiction: 'National' },
          { id: 'node-2', label: 'MoRTH Department', type: 'DEPARTMENT', jurisdiction: 'National' },
        ],
        edges: [
          {
            id: 'e1',
            from: 'node-1',
            to: 'node-2',
            type: 'ADMINISTERED_BY',
            effectiveFrom: '2020-01-01',
            provenance: { statutoryAct: 'MV Act 1988', reviewedBy: 'Auditor' },
          },
        ],
        traversalPaths: [
          { sourceId: 'node-1', targetId: 'node-2', targetType: 'DEPARTMENT', targetLabel: 'MoRTH Department', depth: 1 },
        ],
        explanations: [
          {
            targetId: 'node-2',
            targetLabel: 'MoRTH Department',
            targetType: 'DEPARTMENT',
            depth: 1,
            narrative: 'Connected to MoRTH Department at depth 1.',
            steps: ['Step 1: [outgoing] ADMINISTERED_BY connecting to node-2'],
            provenanceChain: [{ statutoryAct: 'MV Act 1988' }],
          },
        ],
        cyclesDetected: [
          { key: 'node-1->node-2->node-1', description: 'Cycle detected: node-1 is referenced again' },
        ],
        orphanNodes: [{ id: 'node-orphan', label: 'Isolated Node', type: 'SERVICE' }],
        metadata: { traversalDepthEnforced: 2 },
      };

      const html = renderToStaticMarkup(
        <GraphResultsViewer
          results={mockResults}
          selectedNode={mockResults.nodes[0]}
          onSelectNode={() => {}}
        />
      );

      expect(html).toContain('Nodes Discovered');
      expect(html).toContain('Circular Dependencies Detected');
      expect(html).toContain('Orphan Nodes in Current Subgraph');
      expect(html).toContain('Explainable Traversal Paths &amp; Provenance');
      expect(html).toContain('MoRTH Department');
      expect(html).toContain('Step 1: [outgoing] ADMINISTERED_BY');
      expect(html).toContain('Node Inspector');
    });
  });
});
