import React from 'react';

export function GraphResultsViewer({
  results,
  selectedNode,
  onSelectNode,
}) {
  if (!results) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-8 text-center border border-dashed border-gray-300 dark:border-gray-700">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No query executed yet. Select a start node or search term above to traverse the knowledge graph.
        </p>
      </div>
    );
  }

  const {
    nodes = [],
    edges = [],
    traversalPaths = [],
    explanations = [],
    cyclesDetected = [],
    orphanNodes = [],
    pagination = {},
    metadata = {},
  } = results;

  return (
    <div className="space-y-6">
      {/* Overview Stat Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded p-3 text-center">
          <div className="text-xl font-bold text-blue-700 dark:text-blue-300">{nodes.length}</div>
          <div className="text-xs text-blue-600 dark:text-blue-400">Nodes Discovered</div>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded p-3 text-center">
          <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{edges.length}</div>
          <div className="text-xs text-emerald-600 dark:text-emerald-400">Edges Traversed</div>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded p-3 text-center">
          <div className="text-xl font-bold text-purple-700 dark:text-purple-300">{traversalPaths.length}</div>
          <div className="text-xs text-purple-600 dark:text-purple-400">Explainable Paths</div>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded p-3 text-center">
          <div className="text-xl font-bold text-amber-700 dark:text-amber-300">{cyclesDetected.length}</div>
          <div className="text-xs text-amber-600 dark:text-amber-400">Cycles Flagged</div>
        </div>
      </div>

      {/* Cycle Detection Warning Banner */}
      {cyclesDetected.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-start">
            <span className="text-amber-500 font-bold mr-2 text-sm">⚠</span>
            <div>
              <h4 className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                Circular Dependencies Detected in Traversal Path
              </h4>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                The traversal graph contained circular relationships which were safely bounded to prevent infinite recursion:
              </p>
              <ul className="list-disc list-inside mt-2 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                {cyclesDetected.map((c, i) => (
                  <li key={i}>
                    {c.description} (<code>{c.key}</code>)
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Orphan Nodes Banner */}
      {orphanNodes.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Orphan Nodes in Current Subgraph:
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {orphanNodes.map((orphan) => (
              <span
                key={orphan.id}
                className="px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
              >
                [{orphan.type}] {orphan.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Main Two-Column View: Traversal Explanations & Node List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Explainable Traversals & Provenance */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center justify-between">
            <span>Explainable Traversal Paths & Provenance</span>
            <span className="text-xs font-normal text-gray-500">Max Depth: {metadata.traversalDepthEnforced || 2}</span>
          </h3>

          {explanations.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 p-4 rounded border text-xs text-gray-500">
              No multi-hop traversal paths found under current filters.
            </div>
          ) : (
            explanations.map((exp, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                    Depth {exp.depth} Hop
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                    {exp.targetType}
                  </span>
                </div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                  {exp.targetLabel}
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">{exp.narrative}</p>

                {/* Steps with Provenance */}
                <div className="space-y-2 bg-gray-50 dark:bg-gray-900/50 p-2.5 rounded text-xs">
                  <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">Provenance Chain:</div>
                  {exp.steps.map((st, sIdx) => (
                    <div key={sIdx} className="font-mono text-[11px] text-gray-600 dark:text-gray-400">
                      • {st}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right: Graph Entities & Node Detail */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Discovered Graph Nodes ({nodes.length})
          </h3>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 max-h-96 overflow-y-auto">
            {nodes.map((node) => (
              <button
                key={node.id}
                type="button"
                onClick={() => onSelectNode(node)}
                className={`w-full text-left p-3 text-xs transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                  selectedNode?.id === node.id ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                    {node.type}
                  </span>
                  <span className="text-[10px] text-gray-400">{node.jurisdiction}</span>
                </div>
                <div className="font-medium text-gray-900 dark:text-white truncate">{node.label}</div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">ID: {node.id}</div>
              </button>
            ))}
          </div>

          {/* Selected Node Details Drawer */}
          {selectedNode && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-800 p-4 shadow-sm text-xs space-y-2">
              <div className="font-semibold text-gray-900 dark:text-white">Node Inspector</div>
              <div><span className="font-medium text-gray-500">ID:</span> {selectedNode.id}</div>
              <div><span className="font-medium text-gray-500">Type:</span> {selectedNode.type}</div>
              <div><span className="font-medium text-gray-500">Jurisdiction:</span> {selectedNode.jurisdiction}</div>
              <div><span className="font-medium text-gray-500">Effective:</span> {selectedNode.effectiveFrom} to {selectedNode.effectiveTo || 'Present'}</div>
              {selectedNode.properties && (
                <div className="mt-2 bg-gray-50 dark:bg-gray-900 p-2 rounded">
                  <div className="font-medium text-gray-600 dark:text-gray-400 mb-1">Properties:</div>
                  <pre className="text-[10px] overflow-x-auto text-gray-700 dark:text-gray-300">
                    {JSON.stringify(selectedNode.properties, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
