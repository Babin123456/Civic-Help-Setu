import React from 'react';

export function GraphQueryControls({
  query,
  onQueryChange,
  onExecuteQuery,
  onResetQuery,
  isLoading,
  availableNodes = [],
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-700 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Civic Service Knowledge Graph Query
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Explore safe, typed statutory relationships with bounded depth traversals and provenance.
          </p>
        </div>
        <div className="mt-3 md:mt-0 flex items-center space-x-2">
          <button
            type="button"
            onClick={onResetQuery}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 dark:text-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onExecuteQuery}
            disabled={isLoading}
            className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {isLoading ? 'Traversing Graph...' : 'Execute Traversal'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Start Node Selector */}
        <div>
          <label htmlFor="start-node-select" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Start Node (Focal Civic Entity)
          </label>
          <select
            id="start-node-select"
            value={query.startNodeId || ''}
            onChange={(e) => onQueryChange({ startNodeId: e.target.value || null })}
            className="w-full text-xs rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2"
          >
            <option value="">-- None (Global Scan / Search) --</option>
            {availableNodes.map((n) => (
              <option key={n.id} value={n.id}>
                [{n.type}] {n.label}
              </option>
            ))}
          </select>
        </div>

        {/* Search Term */}
        <div>
          <label htmlFor="search-term-input" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Keyword Filter / Search Term
          </label>
          <input
            id="search-term-input"
            type="text"
            value={query.searchTerm || ''}
            onChange={(e) => onQueryChange({ searchTerm: e.target.value || null })}
            placeholder="e.g. driving, tree, mcd, trade"
            className="w-full text-xs rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2"
          />
        </div>

        {/* Jurisdiction */}
        <div>
          <label htmlFor="jurisdiction-select" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Jurisdiction Boundary
          </label>
          <select
            id="jurisdiction-select"
            value={query.jurisdiction || ''}
            onChange={(e) => onQueryChange({ jurisdiction: e.target.value || null })}
            className="w-full text-xs rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2"
          >
            <option value="">All Jurisdictions</option>
            <option value="National">National (India)</option>
            <option value="Delhi">Delhi (NCT)</option>
          </select>
        </div>

        {/* Max Traversal Depth */}
        <div>
          <label htmlFor="depth-select" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Max Traversal Depth (Bounded)
          </label>
          <select
            id="depth-select"
            value={query.maxDepth || 2}
            onChange={(e) => onQueryChange({ maxDepth: Number(e.target.value) })}
            className="w-full text-xs rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2"
          >
            <option value="1">1 Hop (Direct Neighbors)</option>
            <option value="2">2 Hops (Standard Graph Vicinity)</option>
            <option value="3">3 Hops (Max Bound Limit)</option>
          </select>
        </div>

        {/* Publication Status */}
        <div>
          <label htmlFor="status-select" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Publication Status
          </label>
          <select
            id="status-select"
            value={query.publicationStatus || 'published'}
            onChange={(e) => onQueryChange({ publicationStatus: e.target.value })}
            className="w-full text-xs rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2"
          >
            <option value="published">Published (Official Guidance)</option>
            <option value="draft">Draft (Reviewer Auth Required)</option>
            <option value="archived">Archived (Historical Records)</option>
          </select>
        </div>

        {/* Effective Date Filter */}
        <div>
          <label htmlFor="effective-date-input" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Effective As Of Date
          </label>
          <input
            id="effective-date-input"
            type="date"
            value={query.effectiveAsOf || ''}
            onChange={(e) => onQueryChange({ effectiveAsOf: e.target.value || null })}
            className="w-full text-xs rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2"
          />
        </div>
      </div>
    </div>
  );
}
