import React, { useState, useEffect } from 'react';
import { GraphQueryControls } from '../components/knowledgeGraph/GraphQueryControls';
import { GraphResultsViewer } from '../components/knowledgeGraph/GraphResultsViewer';
import DependencyEdgeWorkflowPanel from '../components/knowledgeGraph/DependencyEdgeWorkflowPanel';
import { civicKnowledgeGraph } from '../services/civicKnowledgeGraphService';
import { SYNTHETIC_GRAPH_NODES } from '../data/civicKnowledgeGraphFixtures';

export default function KnowledgeGraphQueryWorkspace() {
  const [query, setQuery] = useState({
    startNodeId: 'service:driving-licence',
    searchTerm: '',
    jurisdiction: '',
    maxDepth: 2,
    publicationStatus: 'published',
    effectiveAsOf: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [error, setError] = useState(null);
  const [cacheNotice, setCacheNotice] = useState(null);

  // Execute query on mount
  useEffect(() => {
    handleExecuteQuery();
  }, []);

  const handleQueryChange = (updates) => {
    setQuery((prev) => ({ ...prev, ...updates }));
  };

  const handleResetQuery = () => {
    const initial = {
      startNodeId: 'service:driving-licence',
      searchTerm: '',
      jurisdiction: '',
      maxDepth: 2,
      publicationStatus: 'published',
      effectiveAsOf: '',
    };
    setQuery(initial);
    setError(null);
    setCacheNotice(null);
  };

  const handleExecuteQuery = () => {
    setIsLoading(true);
    setError(null);
    setCacheNotice(null);

    try {
      const res = civicKnowledgeGraph.queryGraph(query, { role: 'admin' });
      if (!res.ok) {
        setError(res.message || (res.errors && res.errors.join(', ')) || 'Query execution failed');
        setResults(null);
      } else {
        setResults(res);
        if (res.cached) {
          setCacheNotice('Results loaded from in-memory query cache.');
        }
        if (res.nodes && res.nodes.length > 0) {
          setSelectedNode(res.nodes[0]);
        } else {
          setSelectedNode(null);
        }
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred');
      setResults(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvalidateCache = () => {
    const inv = civicKnowledgeGraph.invalidateCache('user_workspace_action');
    setCacheNotice(`Cache successfully invalidated (Version ${inv.version}). Next query will fetch fresh traversals.`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header with Title and Badges */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-800">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center space-x-2">
              <span>Civic Knowledge Graph Query Explorer</span>
              <span className="px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 font-normal">
                #1184 Vertical Slice
              </span>
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Safe, typed graph query interface with bounded traversal depth, provenance tracking, and cycle detection.
            </p>
          </div>
          <div className="mt-4 md:mt-0 flex items-center space-x-3">
            <button
              type="button"
              onClick={handleInvalidateCache}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 rounded shadow-sm"
            >
              Invalidate Cache
            </button>
            <span className="text-xs px-2.5 py-1 bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 rounded-full font-medium">
              Zero-PII Mode Active
            </span>
          </div>
        </div>

        {/* Cache Invalidation or Status Notice */}
        {cacheNotice && (
          <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded p-3 text-xs text-blue-700 dark:text-blue-300 flex items-center justify-between">
            <span>{cacheNotice}</span>
            <button
              type="button"
              onClick={() => setCacheNotice(null)}
              className="text-blue-500 hover:text-blue-700 text-xs font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Error Notification */}
        {error && (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded-lg p-4 text-xs text-red-700 dark:text-red-300">
            <div className="font-semibold mb-1">Query Error</div>
            <div>{error}</div>
          </div>
        )}

        {/* Query Controls */}
        <GraphQueryControls
          query={query}
          onQueryChange={handleQueryChange}
          onExecuteQuery={handleExecuteQuery}
          onResetQuery={handleResetQuery}
          isLoading={isLoading}
          availableNodes={SYNTHETIC_GRAPH_NODES}
        />

        {/* Results Viewer */}
        <GraphResultsViewer
          results={results}
          selectedNode={selectedNode}
          onSelectNode={setSelectedNode}
        />

        {/* Cross-Department Dependency List & Human-Reviewed Edge Publication (#1429) */}
        <DependencyEdgeWorkflowPanel
          startNodeId={query.startNodeId}
          jurisdiction={query.jurisdiction}
          effectiveAsOf={query.effectiveAsOf}
        />

        {/* Non-AI Fallback Statutory Notice */}
        <div className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400 space-y-1">
          <p>
            <strong>Deterministic Non-AI Fallback:</strong> All traversals and edge provenance are resolved via strictly deterministic graph algorithms.
          </p>
          <p>
            <strong>Administrative Notice:</strong> This interface does not file official applications or verify identity documents autonomously. High-impact civic decisions require authorized human review.
          </p>
        </div>
      </div>
    </div>
  );
}
