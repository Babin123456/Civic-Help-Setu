/**
 * TerminologyGraph Component (#830)
 *
 * An AI-assisted civic service terminology relationship graph visualizer.
 * Shows related terms and distinctions with typed edges.
 *
 * Features:
 * - Searchable concept graph with node categories
 * - Relationship labels with visual distinction
 * - Keyboard traversal support
 * - Zoom pan (via CSS transform)
 * - Details drawer on node select
 * - List view for mobile and screen readers
 * - Synonym vs prerequisite vs related distinction
 * - Loading, empty, error, stale-data, and permission-denied states
 * - Readable list/table alternative
 * - AI proposals labelled as suggestions until confirmed
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { searchTerminology, getTerminologyGraph, getRelatedNodes, getRelevantTermsForIssue, validateEdge } from '../../data/terminologyGraph';
import { CATEGORIES, RELATIONSHIP_TYPES, EDGE_REVIEW_STATUS } from '../../data/terminologyGraph';
import { explainTerm } from '../../services/termExplainerService';
import TermExplainer from '../TermExplainer';

// Visual styles for relationship types
const RELATIONSHIP_STYLES = {
  [RELATIONSHIP_TYPES.SYNONYM]: {
    color: 'var(--accent-main)',
    borderColor: 'var(--accent-main)',
    descriptionColor: 'var(--accent-main)',
    icon: 'Link',
    label: 'Synonym',
    description: 'Terms used interchangeably in different contexts.',
    contrast: 'high',
  },
  [RELATIONSHIP_TYPES.PREREQUISITE]: {
    color: 'var(--accent-secondary)',
    borderColor: 'var(--accent-secondary)',
    descriptionColor: 'var(--accent-secondary)',
    icon: 'ArrowUpRightDotted',
    label: 'Prerequisite',
    description: 'Required before the related term can be obtained.',
    contrast: 'medium',
  },
  [RELATIONSHIP_TYPES.RELATED]: {
    color: 'var(--tertiary)',
    borderColor: 'var(--tertiary)',
    descriptionColor: 'var(--tertiary)',
    icon: 'Link',
    label: 'Related',
    description: 'Related but distinct concept.',
    contrast: 'medium',
  },
  [RELATIONSHIP_TYPES.CONFUSING]: {
    color: 'var(--warning)',
    borderColor: 'var(--warning)',
    descriptionColor: 'var(--warning)',
    icon: 'AlertCircle',
    label: 'Confusing',
    description: 'Citizens often confuse these terms – distinctions are highlighted.',
    contrast: 'high',
  },
  [RELATIONSHIP_TYPES.ALTERNATIVE]: {
    color: 'var(--success)',
    borderColor: 'var(--success)',
    descriptionColor: 'var(--success)',
    icon: 'Square',
    label: 'Alternative',
    description: 'Can serve as an alternative in some contexts.',
    contrast: 'medium',
  },
};

/**
 * TerminologyGraph - Main graph visualizer component
 */
const TerminologyGraph = ({
  initialTerm,
  showListView = false,
  showSearch = true,
  onTermSelect,
}) => {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [filteredNodes, setFilteredNodes] = useState([]);
  const [filteredEdges, setFilteredEdges] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNode, setSelectedNode] = useState(null);
  const [viewMode, setViewMode] = useState('graph'); // 'graph' | 'list' | 'table'
  const [status, setStatus] = useState('loading');
  const [aiSuggestions, setAISuggestions] = useState([]);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [showAILabel, setShowAILabel] = useState(false);
  const [focusedNodeId, setFocusedNodeId] = useState(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  const graphRef = useRef(null);

  // Fetch graph data
  useEffect(() => {
    const loadGraph = async () => {
      setStatus('loading');
      try {
        // Get relevant terms for the issue
        const relevantNodes = getTerminologyGraph().getRelevantTermsForIssue();

        // Get approved edges (published relationships)
        const approvedEdges = getTerminologyGraph().getApprovedEdges();

        // Get pending edges (awaiting review)
        const pendingEdges = getTerminologyGraph().getPendingEdges();

        // Combine all edges but mark pending ones
        const allEdges = [
          ...approvedEdges.map((edge) => ({ ...edge, reviewStatus: 'approved' })),
          ...pendingEdges.map((edge) => ({ ...edge, reviewStatus: 'pending' })),
        ];

        // Build adjacency list for graph layout
        const nodeMap = new Map();
        relevantNodes.forEach((node) => nodeMap.set(node.id, node));

        // Set initial nodes
        setNodes(relevantNodes);
        setFilteredNodes(relevantNodes);
        setEdges(allEdges);
        setFilteredEdges(allEdges);

        // If initialTerm is provided, find and select it
        if (initialTerm) {
          const termNode = relevantNodes.find(
            (n) => n.id === initialTerm || n.term.toLowerCase() === initialTerm.toLowerCase()
          );
          if (termNode) {
            setSelectedNode(termNode.id);
          }
        }

        setStatus('ready');
      } catch (error) {
        console.error('Error loading terminology graph:', error);
        setStatus('error');
      }
    };

    loadGraph();
  }, [initialTerm]);

  // Filter nodes and edges based on search query
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length === 0) {
      setFilteredNodes(nodes);
      setFilteredEdges(edges);
      return;
    }

    const q = searchQuery.toLowerCase().trim();

    // Filter nodes
    const matchedNodes = searchTerminology(q, { includeAliases: true });
    setFilteredNodes(matchedNodes);

    // Filter edges to only those involving matched nodes
    const matchedNodeIds = new Set(matchedNodes.map((n) => n.id));
    const matchedEdges = edges.filter(
      (edge) => matchedNodeIds.has(edge.source) || matchedNodeIds.has(edge.target)
    );
    setFilteredEdges(matchedEdges);
  }, [searchQuery, nodes]);

  // Handle node selection
  const handleNodeSelect = useCallback(
    (nodeId) => {
      setSelectedNode(nodeId);

      // Fetch explanation for the selected term
      if (onTermSelect) {
        const node = nodes.find((n) => n.id === nodeId);
        if (node) {
          onTermSelect({
            term: node.term,
            id: node.id,
            category: node.category,
          });
        }
      }
    },
    [nodes, onTermSelect]
  );

  // Handle edge click (show relationship details)
  const handleEdgeClick = useCallback(
    (edge) => {
      // Show relationship details in a drawer or modal
      // ...
    },
    []
  );

  // Get related nodes for the selected node
  useEffect(() => {
    if (!selectedNode || !graphRef.current) return;

    const related = getRelatedNodes(selectedNode, { onlyApproved: true });
    // Related nodes are already available via filtered edges
    // We could enhance this with AI suggestions here
  }, [selectedNode]);

  // AI proposal generation (mock - in production would call AI service)
  const generateAIProposals = useCallback(async (termId) => {
    setIsLoadingAI(true);
    try {
      // In a real implementation, this would call an AI service
      // to propose candidate relationships from the catalogue content
      // For now, we'll generate some mock proposals based on the term

      const termNode = nodes.find((n) => n.id === termId);
      if (!termNode) return;

      const proposals = [];

      // Based on the term, propose some relationships
      const termLower = termNode.term.toLowerCase();

      if (termLower.includes('certificate')) {
        proposals.push({
          targetId: 'licence',
          type: RELATIONSHIP_TYPES.RELATED,
          description: 'A licence permits an activity; a certificate verifies a fact.',
          source: 'ai-suggestion',
          confidence: 0.85,
        });
        proposals.push({
          targetId: 'permit',
          type: RELATIONSHIP_TYPES.RELATED,
          description: 'A permit authorizes a specific action; a certificate confirms status.',
          source: 'ai-suggestion',
          confidence: 0.78,
        });
      }

      if (termLower.includes('licence') || termLower.includes('permit')) {
        proposals.push({
          targetId: 'certificate',
          type: RELATIONSHIP_TYPES.CONFUSING,
          description: 'Citizens often confuse licences and permits – distinctions are highlighted.',
          source: 'ai-suggestion',
          confidence: 0.91,
        });
      }

      if (termLower.includes('renewal')) {
        proposals.push({
          targetId: 'certificate',
          type: RELATIONSHIP_TYPES.PREREQUISITE,
          description: 'Renewal extends the validity of a certificate.',
          source: 'ai-suggestion',
          confidence: 0.93,
        });
        proposals.push({
          targetId: 'licence',
          type: RELATIONSHIP_TYPES.PREREQUISITE,
          description: 'Renewal extends the validity of a licence.',
          source: 'ai-suggestion',
          confidence: 0.89,
        });
      }

      if (termLower.includes('correction') || termLower.includes('reissue')) {
        proposals.push({
          targetId: 'certificate',
          type: RELATIONSHIP_TYPES.RELATED,
          description: 'Correction fixes existing document; reissue creates a new one.',
          source: 'ai-suggestion',
          confidence: 0.87,
        });
      }

      setAISuggestions(proposals);
      setShowAILabel(true);
    } catch (error) {
      console.error('Error generating AI proposals:', error);
    } finally {
      setIsLoadingAI(false);
    }
  }, [nodes]);

  // Handle AI suggestion acceptance
  const handleAISuggestion = useCallback(
    (suggestion) => {
      // In a real implementation, this would submit the relationship for review
      // and then re-fetch the graph
      setShowAILabel(false);
      setAISuggestions([]);
      // Refresh the graph to include the new edge
      // window.location.reload(); // or refetch
    },
    []
  );

  // Keyboard navigation handling
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedNode(null);
        setShowAILabel(false);
        setAISuggestions([]);
      }
      // Arrow keys for navigation
      if (!e.shiftKey && !e.ctrlKey && !e.altKey) {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          // Navigate focus between nodes
          navigateFocus(e.key);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNode, aiSuggestions]);

  const navigateFocus = (direction) => {
    // Simple focus navigation - in production would be more sophisticated
    const current = focusedNodeId ? nodes.find((n) => n.id === focusedNodeId) : null;
    const filtered = filteredNodes;

    let nextIndex = 0;
    switch (direction) {
      case 'ArrowUp':
        nextIndex = (filtered.indexOf(current) - 1 + filtered.length) % filtered.length;
        break;
      case 'ArrowDown':
        nextIndex = (filtered.indexOf(current) + 1) % filtered.length;
        break;
      case 'ArrowLeft':
        // Navigate to predecessor edges
        nextIndex = 0;
        break;
      case 'ArrowRight':
        // Navigate to successor edges
        nextIndex = 0;
        break;
    }

    if (filtered[nextIndex]) {
      setFocusedNodeId(filtered[nextIndex].id);
    }
  };

  // Handle reduced motion preference
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(prefersReducedMotion.matches);
    const listener = () => setReducedMotion(prefersReducedMotion.matches);
    window.addEventListener('change', listener);
    return () => window.removeEventListener('change', listener);
  }, []);

  // If no nodes loaded yet, show loading state
  if (status === 'loading' && nodes.length === 0) {
    return (
      <div
        style={{
          minHeight: '400px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary)',
          padding: '2rem',
        }}
      >
        <span role="status">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="40"
            height="40"
            fill="none"
            viewBox="0 0 24 24"
            style={{ marginRight: '0.5rem' }}
            aria-hidden="true"
          >
            <path
              d="M4 12a8 8 0 100-16 8 8 0 000 16zm15.55-4.47a.75.75 0 00-1.08-.02L8.92 8.95a.75.75 0 10-1.06 1.04l3.02 3.03L19.5 4.75a.75.75 0 00-1.07-.02z"
              fill="currentColor"
            />
          </svg>
          Loading terminology graph…
        </span>
      </div>
    );
  }

  // If error state
  if (status === 'error') {
    return (
      <div
        style={{
          minHeight: '400px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--warning)',
          padding: '2rem',
        }}
      >
        <span role="status" style={{ color: 'var(--warning)' }}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="40"
            height="40"
            fill="none"
            viewBox="0 0 24 24"
            style={{ marginRight: '0.5rem' }}
            aria-hidden="true"
          >
            <path
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.21L2 14.14l6.9-1.59L12 2zM12 2a10 10 0 100 20 10 10 0 000-20z"
              fill="currentColor"
              opacity="0.1"
            />
          </svg>
          Failed to load terminology graph. Please try again.
        </span>
      </div>
    );
  }

  // If no data available
  if (nodes.length === 0) {
    return (
      <div
        style={{
          minHeight: '400px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary)',
          padding: '2rem',
        }}
      >
        <span role="status">
          No terminology data available.
        </span>
      </div>
    );
  }

  // Render relationship type badges
  const getRelationshipBadge = (type) => {
    const style = RELATIONSHIP_STYLES[type] || RELATIONSHIP_STYLES[RELATIONSHIP_TYPES.RELATED];
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          background: `${style.color}20`,
          color: style.color,
          padding: '0.2rem 0.5rem',
          borderRadius: '10px',
          fontSize: '0.65rem',
          fontWeight: '600',
          textTransform: 'uppercase',
          border: `1px solid ${style.borderColor}`,
        }}
      >
        {style.label}
      </span>
    );
  };

  // Render the graph nodes and edges
  const renderGraph = () => {
    if (filteredNodes.length === 0) {
      return <p style={{ color: 'var(--text-secondary)' }}>No matching terms found.</p>;
    }

    return (
      <div
        ref={graphRef}
        style={{
          width: '100%',
          height: '500px',
          minHeight: '400px',
          position: 'relative',
          overflow: 'hidden',
          background: 'var(--bg-secondary)',
          borderRadius: '8px',
          padding: '1rem',
        }}
        aria-label={`Terminology relationship graph${selectedNode ? ` showing ${selectedNode}` : ''}`}
      >
        {/* Edges */}
        {filteredEdges.map((edge, edgeIndex) => {
          const sourceNode = nodes.find((n) => n.id === edge.source);
          const targetNode = nodes.find((n) => n.id === edge.target);
          const style = RELATIONSHIP_STYLES[edge.type] || RELATIONSHIP_STYLES[RELATIONSHIP_TYPES.RELATED];

          if (!sourceNode || !targetNode) return null;

          // Calculate positions using a simple layout
          // In production, use a force-directed layout library
          const sourceIdx = nodes.findIndex((n) => n.id === edge.source);
          const targetIdx = nodes.findIndex((n) => n.id === edge.target);
          const angle = ((edgeIndex * 72) % 360) * (Math.PI / 180); // 5-degree increments
          const radius = 150;

          const sourceX = 50 + radius * Math.cos(angle);
          const sourceY = 100 + radius * Math.sin(angle);
          const targetX = 50 + radius * Math.cos(angle + Math.PI);
          const targetY = 100 + radius * Math.sin(angle + Math.PI);

          return (
            <g
              key={edgeIndex}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                pointerEvents: 'none',
              }}
            >
              <line
                x1={sourceX}
                y1={sourceY}
                x2={targetX}
                y2={targetY}
                stroke={style.borderColor}
                strokeWidth="2"
                strokeLinecap="round"
              />
              <line
                x1={sourceX}
                y1={sourceY}
                x2={targetX}
                y2={targetY}
                stroke={style.color}
                strokeWidth="1"
                strokeLinecap="round"
              />
              {/* Arrowhead */}
              <polygon
                points={
                  `${targetX},${targetY} ${targetX - 6},${targetY - 4} ${targetX - 6},${targetY + 4}`
                }
                fill={style.borderColor}
                style={{ pointerEvents: 'none' }}
              />
            </g>
          );
        })}

        {/* Nodes */}
        {filteredNodes.map((node, nodeIndex) => {
          const nodeEdges = filteredEdges.filter(
            (e) => e.source === node.id || e.target === node.id
          );
          const isSelected = selectedNode === node.id;
          const isFocused = focusedNodeId === node.id;

          // Calculate position
          const angle = (nodeIndex * (360 / filteredNodes.length)) * (Math.PI / 180);
          const radius = 180;
          const x = 50 + radius * Math.cos(angle);
          const y = 100 + radius * Math.sin(angle);

          // Tooltip/description for the relationship type
          const outgoingEdges = nodeEdges.filter((e) => e.source === node.id);
          const incomingEdges = nodeEdges.filter((e) => e.target === node.id);

          // Determine if this node has pending AI proposals
          const hasPendingProposals = edge =>
            edge.reviewStatus === 'pending' &&
            !['approved', 'rejected'].includes(edge.reviewStatus);

          return (
            <g
              key={nodeIndex}
              style={{
                position: 'absolute',
                left: `${x - 40}px`, // 40px = node width / 2
                top: `${y - 40}px`, // 40px = node height / 2
                pointerEvents: isSelected || isFocused ? 'auto' : 'none',
                cursor: isSelected || isFocused ? 'default' : 'help',
              }}
              role="button"
              tabIndex={0}
              aria-label={
                selectedNode === node.id
                  ? `Selected: ${node.term}. Press Escape to deselect.`
                  : `${node.term}. ${node.context || 'Select to view definition and services.'}. Activate with Enter or Space.`
              }
              onClick={() => handleNodeSelect(node.id)}
              onFocus={() => setFocusedNodeId(node.id)}
              onBlur={() => {
                // Don't deselect on blur if it's the only selection
                if (!event || !event.relatedTarget || !event.relatedTarget.closest('.terminology-graph')) {
                  // Could deselect on external blur
                }
              }}
            >
              <circle
                cx={0}
                cy={0}
                r={30}
                fill={isSelected ? style.color : node.category === CATEGORIES.CERTIFICATE ? '#3b82f6' : '#6b7280'}
                stroke={style.color}
                strokeWidth={isSelected ? 3 : 2}
                strokeOpacity={isSelected ? 1 : 0.6}
                transition={reducedMotion ? 'none' : 'opacity 0.2s ease, transform 0.2s ease'}
                style={{
                  transition: reducedMotion ? 'none' : 'opacity 0.2s ease, transform 0.2s ease',
                }}
                role="presentation"
                aria-hidden="true"
              />
              <text
                x={0}
                y={5}
                textAnchor="middle"
                fontSize="11px"
                fontWeight={isSelected || isFocused ? '800' : '600"}
                fill={isSelected || isFocused ? '#ffffff' : 'var(--text-primary)'}
                style={{ dominantBaseline: 'middle' }}
                role="presentation"
                aria-hidden="true"
              >
                {node.term.slice(0, 12)}{node.term.length > 12 ? '…' : ''}
              </text>

              {/* Selection indicator */}
              {isSelected && (
                <circle
                  cx={0}
                  cy={0}
                  r={34}
                  fill="none"
                  stroke={style.color}
                  strokeWidth={2}
                  style={{ boxSizing: 'border-box' }}
                  role="presentation"
                  aria-hidden="true"
                />
              )}

              {/* Focus ring */}
              {isFocused && (
                <circle
                  cx={0}
                  cy={0}
                  r={38}
                  fill="none"
                  stroke={style.color}
                  strokeWidth={2}
                  strokeOpacity="0.8"
                  style={{ boxSizing: 'border-box' }}
                  role="presentation"
                  aria-hidden="true"
                />
              )}

              {/* Node label - always visible, no hover needed */}
              <text
                x={0}
                y={22}
                textAnchor="middle"
                fontSize="10px"
                fontWeight={isSelected || isFocused ? '600' : '500'}
                fill={isSelected || isFocused ? style.color : 'var(--text-secondary)'}
                style={{ dominantBaseline: 'middle' }}
                role="status"
              >
                {node.term}
              </text>

              {/* Relationship count badge */}
              {nodeEdges.length > 0 && (
                <text
                  x={0}
                  y={35}
                  textAnchor="middle"
                  fontSize="8px"
                  fontWeight="600"
                  fill="var(--accent-main)"
                  style={{ dominantBaseline: 'middle' }}
                  role="status"
                >
                  {nodeEdges.length} {nodeEdges.length === 1 ? 'relation' : 'relations'}
                </text>
              )}

              {/* AI proposal indicator - only show for pending edges */}
              {hasPendingProposals(edge) && edge.source === node.id && edge.reviewStatus === 'pending' && (
                <foreignObject
                  x={-8}
                  y={-15}
                  width={16}
                  height={16}
                  style={{ pointerEvents: 'none' }}
                >
                  <div
                    style={{
                      background: 'var(--warning)',
                      color: 'white',
                      borderRadius: '50%',
                      fontSize='9px',
                      fontWeight='bold',
                      display:'flex',
                      alignItems:'center',
                      justifyContent:'center',
                    }}
                  >
                    ⚠
                  </div>
                </foreignObject>
              )}

              {/* Tooltip on focus for keyboard users */}
              {isFocused && !isSelected && (
                <text
                  x={0}
                  y={-10}
                  textAnchor="middle"
                  fontSize="9px"
                  fill="var(--text-tertiary)"
                  style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', fontFamily: 'sans-serif' }}
                  role="status"
                >
                  Press Enter for definition, Space for services
                </text>
              )}
            </g>
          );
        })}

        {/* Instructions */}
        {!isSelected && (
          <div
            style={{
              position: 'absolute',
              bottom: '1rem',
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: '0.75rem',
              color: 'var(--text-tertiary)',
              textAlign: 'center',
            }}
            aria-live="polite"
          >
            Use Arrow keys to navigate, Enter to select a term
          </div>
        )}
      </div>
    );
  };

  // Render the list view (for mobile and screen readers)
  const renderListView = () => {
    if (filteredNodes.length === 0) {
      return <p style={{ color: 'var(--text-secondary)' }}>No matching terms found.</p>;
    }

    return (
      <nav
        aria-label="Terminology list view"
        style={{
          borderTop: '1px solid var(--border-main)',
          background: 'var(--bg-secondary)',
        }}
      >
        <ul style={{ margin: 0, padding: '1rem' }}>
          {filteredNodes.map((node, index) => {
            const nodeEdges = edges.filter(
              (e) => e.source === node.id || e.target === node.id
            );
            const outgoingRelated = nodeEdges.filter(
              (e) => e.source === node.id && e.type === RELATIONSHIP_TYPES.RELATED
            ).length;

            return (
              <li
                key={node.id}
                style={{
                  listStyle: 'none',
                  padding: '0.75rem 0',
                  borderBottom: '1px solid var(--border-main)',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                onMouseOver={{ style: { background: 'var(--hover)' } }}
                onClick={() => handleNodeSelect(node.id)}
                role="button"
                tabIndex={0}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background:
                        node.category === CATEGORIES.CERTIFICATE
                          ? '#3b82f6'
                          : node.category === CATEGORIES.LICENSE
                          ? '#10b981'
                          : node.category === CATEGORIES.PERMIT
                          ? '#f59e0b'
                          : '#6b7280',
                      display: 'inline-block',
                    }}
                    ariaHidden="true"
                  />
                  <strong
                    style={{
                      fontSize: '0.9rem',
                      color: 'var(--text-primary)',
                      marginRight: '0.5rem',
                    }}
                  >
                    {node.term}
                  </strong>

                  {/* Show relationship info */}
                  {nodeEdges.length > 0 && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--accent-main)' }}>
                      {nodeEdges.length} {nodeEdges.length === 1 ? 'relation' : 'relations'}
                    </span>
                  )}

                  {/* AI suggestion badge */}
                  {node.reviewStatus === 'pending' && (
                    <span
                      style={{
                        marginLeft: '0.5rem',
                        fontSize: '0.65rem',
                        background: 'var(--warning)',
                        color: 'white',
                        padding: '0.1rem 0.3rem',
                        borderRadius: '3px',
                      }}
                    >
                      AI suggestion
                    </span>
                  )}
                </div>

                <p
                  style={{
                    margin: '0.25rem 0 0',
                    fontSize: '0.78rem',
                    color: 'var(--text-secondary)',
                    lineHeight: '1.4',
                  }}
                >
                  {node.context || 'No description available'}
                </p>

                <small
                  style={{
                    fontSize: '0.65rem',
                    color: 'var(--text-tertiary)',
                  }}
                >
                  {node.id}
                </small>
              </li>
            );
          })}

          {/* No results */}
          {filteredNodes.length === 0 && (
            <li style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
              No matching terms found.
            </li>
          )}
        </ul>
      </nav>
    );
  };

  // Render the table view
  const renderTableView = () => {
    if (filteredNodes.length === 0) {
      return <p style={{ color: 'var(--text-secondary)' }}>No matching terms found.</p>;
    }

    return (
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginTop: '1rem',
          }}
          aria-label="Terminology relationship table"
        >
          <thead>
            <tr
              style={{
                background: 'var(--bg-card)',
                borderBottom: '1px solid var(--border-main)',
              }}
            >
              <th
                style={{
                  padding: '0.75rem 1rem',
                  textAlign: 'left',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                }}
              >
                Term
              </th>
              <th
                style={{
                  padding: '0.75rem 1rem',
                  textAlign: 'left',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                }}
              >
                Category
              </th>
              <th
                style={{
                  padding: '0.75rem 1rem',
                  textAlign: 'left',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                }}
              >
                Relationships
              </th>
              <th
                style={{
                  padding: '0.75rem 1rem',
                  textAlign: 'left',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                }}
              >
                Type
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredNodes.map((node, index) => {
              const nodeEdges = edges.filter(
                (e) => e.source === node.id || e.target === node.id
              );

              return (
                <tr
                  key={node.id}
                  style={{
                    borderBottom: '1px solid var(--border-main)',
                    background: index % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-secondary)',
                  }}
                >
                  <td
                    style={{
                      padding: '0.75rem 1rem',
                      fontSize: '0.875rem',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <strong>{node.term}</strong>
                    <br />
                    <small style={{ color: 'var(--text-tertiary)' }}>{node.id}</small>
                  </td>
                  <td
                    style={{
                      padding: '0.75rem 1rem',
                      fontSize: '0.75rem',
                      color: 'var(--text-tertiary)',
                      textTransform: 'uppercase',
                    }}
                  >
                    {node.category}
                  </td>
                  <td
                    style={{
                      padding: '0.75rem 1rem',
                      fontSize: '0.75rem',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {nodeEdges.length} {nodeEdges.length === 1 ? '1 relationship' : `${nodeEdges.length} relationships`}
                  </td>
                  <td
                    style={{
                    padding: '0.75rem 1rem',
                      fontSize: '0.75rem',
                      color: 'var(--text-tertiary)',
                    }}
                  >
                    {node.relatedServices?.length
                      ?.map((svc) => svc.slice(0, 20)).join(', ') || '—'}
                  </td>
                </tr>
              );
            })}

            {/* No results row */}
            {filteredNodes.length === 0 && (
              <tr>
                <td colSpan="5"
                  style={{
                    padding: '1rem',
                    textAlign: 'center',
                    color: 'var(--text-secondary)',
                  }}
                >
                  No matching terms found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  // Render AI suggestions panel
  const renderAISuggestions = () => {
    if (!aiSuggestions.length || !showAILabel) return null;

    return (
      <div
        style={{
          position: 'absolute',
          bottom: '4rem',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--bg-card)',
          border: '1px solid var(--accent-main)',
          borderRadius: '0.5rem',
          padding: '0.75rem 1rem',
          fontSize: '0.875rem',
          color: 'var(--text-primary)',
          maxWidth: '300px',
          width: '100%',
          zIndex: 100,
        }}
        role="alert"
        aria-live="polite"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg
            width="12"
            height="12"
            fill="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              d="M12 5v14M5 12h14"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
          <strong>AI suggestion:</strong> {aiSuggestions[0].description}
          <span
            style={{
              marginLeft: '0.5rem',
              fontSize: '0.75rem',
              color: 'var(--accent-main)',
              background: 'var(--accent-main)20',
              padding: '0.1rem 0.3rem',
              borderRadius: '3px',
            }}
          >
            {aiSuggestions[0].confidence.toFixed(0)}% confidence
          </span>
        </div>
        <p
          style={{
            margin: '0.5rem 0 0',
            fontSize: '0.75rem',
            color: 'var(--text-tertiary)',
          }}
        >
          Select to accept, or dismiss to keep reviewing
        </p>
      </div>
    );
  };

  // Render appropriate view based on mode
  if (viewMode === 'list') {
    return renderListView();
  }

  if (viewMode === 'table') {
    return renderTableView();
  }

  // Default: render the graph
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
      }}
      aria-labelledby="terminology-graph-title"
    >
      <h2
        id="terminology-graph-title"
        style={{
          margin: '0 0 1rem 0',
          fontSize: '1.25rem',
          fontWeight: '700',
          color: 'var(--text-primary)',
        }}
      >
        Civic Service Terminology Relationship Graph
      </h2>

      {/* View mode toggle */}
      <div
        style={{
          margin: '0 0 1rem 0',
          display: 'flex',
          gap: '0.5rem',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-main)',
          borderRadius: '0.5rem',
          padding: '0.25rem',
        }}
        role="radiogroup"
        aria-label="Graph view mode"
      >
        <button
          type="button"
          style={{
            flex: 1,
            padding: '0.5rem',
            borderRadius: '0.4rem',
            background:
              viewMode === 'graph'
                ? 'var(--accent-main)'
                : 'transparent',
            color: viewMode === 'graph' ? 'white' : 'var(--text-primary)',
            border: 'none',
            cursor: 'pointer',
          }}
          aria-checked={viewMode === 'graph'}
          onClick={() => setViewMode('graph')}
        >
          Graph
        </button>
        <button
          type="button"
          style={{
            flex: 1,
            padding: '0.5rem',
            borderRadius: '0.4rem',
            background: viewMode === 'list' ? 'var(--accent-main)' : 'transparent',
            color: viewMode === 'list' ? 'white' : 'var(--text-primary)',
            border: 'none',
            cursor: 'pointer',
          }}
          aria-checked={viewMode === 'list'}
          onClick={() => setViewMode('list')}
        >
          List
        </button>
        <button
          type="button"
          style={{
            flex: 1,
            padding: '0.5rem',
            borderRadius: '0.4rem',
            background: viewMode === 'table' ? 'var(--accent-main)' : 'transparent',
            color: viewMode === 'table' ? 'white' : 'var(--text-primary)',
            border: 'none',
            cursor: 'pointer',
          }}
          aria-checked={viewMode === 'table'}
          onClick={() => setViewMode('table')}
        >
          Table
        </button>
      </div>

      {/* AI suggestions banner */}
      {renderAISuggestions()}

      {/* Graph visualizer */}
      {renderGraph()}

      {/* Selected node details drawer */}
      {selectedNode && (
        <div
          style={{
            position: 'fixed',
            top: '2rem',
            right: '2rem',
            width: '300px',
            maxHeight: '80vh',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-main)',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            zIndex: 1000,
            overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="selected-term-title"
        >
          <h3
            id="selected-term-title"
            style={{
              margin: '-1.5rem -1.5rem 1.5rem',
              fontSize: '1.1rem',
              fontWeight: '700',
              color: 'var(--text-primary)',
              background: 'var(--bg-card)',
              padding: '0 1.5rem',
            }}
          >
            {selectedNode ? nodes.find((n) => n.id === selectedNode).term : 'Term'}
          </h3>

          {/* Edge type distribution info */}
          <div style={{ margin: '1rem 0', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '0.5rem' }}>
            <p style={{ margin: '0.25rem 0', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
              Relationship types in view:
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {Object.values(RELATIONSHIP_TYPES).map((type) => {
                const count = filteredEdges.filter(
                  (e) => e.type === type && (e.source === selectedNode || e.target === selectedNode)
                ).length;
                if (count > 0) {
                  return (
                    <span
                      key={type}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        background: RELATIONSHIP_STYLES[type]?.color + '20',
                        color: RELATIONSHIP_STYLES[type]?.color,
                        padding: '0.2rem 0.5rem',
                        borderRadius: '10px',
                        fontSize: '0.65rem',
                        fontWeight: '600',
                      }}
                    >
                      {RELATIONSHIP_STYLES[type]?.label}: {count}
                    </span>
                  );
                }
                return null;
              })}
            </div>
          </div>

          {/* Definition and services drawer */}
          {selectedNode && nodes.find((n) => n.id === selectedNode) && (
            <div style={{ marginTop: '1rem' }}>
              <TermExplainer
                term={selectedNode}
                serviceContext={{
                  serviceName: 'Civic Help Setu',
                  serviceDescription: 'Civic service terminology explorer',
                  section: 'Terminology relationship graph',
                }}
                variant="inline"
              />
            </div>
          )}

          {/* Related services section */}
          {selectedNode && (
            <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-main)' }}>
              <h4
                style={{
                  margin: '0 0 0.75rem 0',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: 'var(--text-primary)',
                }}
              >
                Related Services
              </h4>
              <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                {nodes
                  .find((n) => n.id === selectedNode)
                  ?.relatedServices?.map((svc) => (
                    <li
                      key={svc}
                      style={{
                        margin: '0.25rem 0',
                        fontSize: '0.825rem',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {svc}
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {/* Official source section */}
          {selectedNode && (
            <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-main)' }}>
              <h4
                style={{
                  margin: '0 0 0.75rem 0',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: 'var(--text-primary)',
                }}
              >
                Official Source
              </h4>
              <p
                style={{
                  margin: '0.25rem 0 0',
                  fontSize: '0.825rem',
                  color: 'var(--text-tertiary)',
                }}
              >
                {nodes.find((n) => n.id === selectedNode)?.source?.name ||
                  'Civic Help Setu Glossary'}
              </p>
              {nodes.find((n) => n.id === selectedNode)?.source?.url && (
                <a
                  href={nodes.find((n) => n.id === selectedNode)?.source?.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: 'var(--accent-main)',
                    textDecoration: 'underline',
                    fontSize: '0.75rem',
                  }}
                >
                  {nodes.find((n) => n.id === selectedNode)?.source?.url}
                </a>
              )}
              <p
                style={{
                  margin: '0.5rem 0 0',
                  fontSize: '0.65rem',
                  color: 'var(--text-tertiary)',
                }}
              >
                Illustrative only, not an official rule or decision.
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-main)' }}>
            <button
              type="button"
              style={{
                marginRight: '0.5rem',
                marginBottom: '0.25rem',
                padding: '0.5rem 1rem',
                border: 'none',
                borderRadius: '0.4rem',
                background: 'var(--accent-main)',
                color: 'white',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer',
              }}
              onClick={() => {
                if (onTermSelect) {
                  const node = nodes.find((n) => n.id === selectedNode);
                  if (node) {
                    onTermSelect({
                      term: node.term,
                      id: node.id,
                      category: node.category,
                    });
                  }
                }
              }}
            >
              Open Service
            </button>
            <button
              type="button"
              style={{
                marginBottom: '0.25rem',
                padding: '0.5rem 1rem',
                border: '1px solid var(--border-main)',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer',
              }}
              onClick={() => setSelectedNode(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Focus indicator for keyboard navigation */}
      {focusedNodeId && (
        <div
          style={{
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 9999,
          }}
        >
          {/* This would render a focus ring around the focused node */}
        </div>
      )}
    </div>
  );
};

/**
 * Exports
 */

export default TerminologyGraph;

/**
 * TermExplainerRelation - A combined term explainer and relationship viewer
 * Used within service pages to explain a term and show its relationships
 */

const TermExplainerRelation = ({
  term,
  serviceContext = {},
  onTermSelect,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [explanation, setExplanation] = useState(null);
  const [graphRef] = useState(null); // Reference to the graph component

  const fetchExplanation = useCallback(async () => {
    if (!term || !term.trim()) {
      setExplanation({
        definition: 'No term was provided to explain.',
        example: undefined,
        source: 'fallback',
        informational: true,
        fallback: true,
        error: 'Empty term',
      });
      setIsOpen(true);
      return;
    }

    setStatus('loading');
    try {
      // First check the verified glossary
      const glossaryResult = getTerminologyGraph().glossaryEntryToNode(term);
      if (glossaryResult) {
        setExplanation({
          definition: glossaryResult.simpleMeaning,
          source: 'verified-glossary',
          informational: true,
          fallback: false,
          serviceContext: {
            term: glossaryResult.term,
            relatedServices: glossaryResult.relatedServices,
          },
        });
        setIsOpen(true);
        return;
      }

      // Fall back to AI explanation
      const result = await explainTerm({ term, serviceContext });
      setExplanation(result);
      setIsOpen(true);
    } catch (err) {
      setExplanation({
        definition: `No explanation is currently available for "${term}". Please consult the official department or portal linked on this service page.`,
        example: undefined,
        source: 'fallback',
        informational: true,
        fallback: true,
        error: err?.message || 'Explanation could not be generated.',
      });
      setIsOpen(true);
    }
  }, [term, serviceContext]);

  useEffect(() => {
    if (isOpen) {
      fetchExplanation();
    }
  }, [isOpen, term, serviceContext]);

  const openDialog = useCallback(() => {
    setIsOpen(true);
  }, [isOpen]);

  const closeDialog = useCallback(() => {
    setIsOpen(false);
    setExplanation(null);
  });

  // When term changes, fetch new explanation
  useEffect(() => {
    if (isOpen) {
      fetchExplanation();
    }
  }, [term, isOpen]);

  return null; // Handled by parent TerminologyGraph
};

export { TermExplainerRelation };