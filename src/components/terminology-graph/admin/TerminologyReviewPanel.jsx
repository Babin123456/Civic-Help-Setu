/**
 * TerminologyReviewPanel Component (#830)
 *
 * Admin panel for reviewing proposed terminology relationships.
 * Shows pending AI suggestions and allows approved/rejection.
 */

import { useState, useEffect, useCallback } from 'react';
import { getTerminologyGraph, RELATIONSHIP_TYPES, EDGE_REVIEW_STATUS } from '../../data/terminologyGraph';
import { RELATIONSHIP_STYLES } from '../TerminologyGraph';

const TerminologyReviewPanel = ({
  onRefresh,
  onEdgeApproved,
  onEdgeRejected,
}) => {
  const [pendingEdges, setPendingEdges] = useState([]);
  const [allEdges, setAllEdges] = useState([]);
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingEdge, setEditingEdge] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'ready' | 'error'

  // Load review data
  useEffect(() => {
    const loadReviewData = async () => {
      setStatus('loading');
      try {
        const graph = getTerminologyGraph();

        // Get pending edges (awaiting review)
        const pending = graph.getPendingEdges();

        // Get all approved edges
        const approved = graph.getApprovedEdges();

        setPendingEdges(pending);
        setAllEdges([...approved, ...pending.map((e) => ({ ...e, reviewStatus: e.reviewStatus }))]);

        setStatus('ready');
      } catch (error) {
        console.error('Error loading review data:', error);
        setStatus('error');
      }
    };

    loadReviewData();
  }, [onRefresh]);

  // Filter pending edges based on type and search
  const filteredPendingEdges = useMemo(() => {
    let filtered = pendingEdges;

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter((edge) => edge.type === filterType);
    }

    // Filter by search query
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (edge) =>
          edge.source.toLowerCase().includes(q) ||
          edge.target.toLowerCase().includes(q) ||
          edge.description.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [pendingEdges, filterType, searchQuery]);

  // Handle approve action
  const handleApprove = useCallback(
    async (edgeId) => {
      setStatus('loading');
      try {
        // In a real implementation, this would call the API
        // For now, mock the approval
        // await api.approveEdge(edgeId);

        // Remove from pending list
        setPendingEdges((pending) => pending.filter((e) => e.id !== edgeId));

        // Call callback if provided
        if (onEdgeApproved) {
          onEdgeApproved(edgeId);
        }

        setStatus('ready');
      } catch (error) {
        console.error('Error approving edge:', error);
        setStatus('error');
      }
    },
    [onEdgeApproved]
  );

  // Handle reject action
  const handleReject = useCallback(
    async (edgeId) => {
      setStatus('loading');
      try {
        // In a real implementation, this would call the API
        // await api.rejectEdge(edgeId);

        // Remove from pending list
        setPendingEdges((pending) => pending.filter((e) => e.id !== edgeId));

        // Call callback if provided
        if (onEdgeRejected) {
          onEdgeRejected(edgeId);
        }

        setStatus('ready');
      } catch (error) {
        console.error('Error rejecting edge:', error);
        setStatus('error');
      }
    },
    [onEdgeRejected]
  );

  // Handle edge type filter change
  const handleTypeFilterChange = useCallback(
    (e) => {
      const type = e.target.value;
      setFilterType(type);
      setPage(1); // Reset to first page
    },
    []
  );

  // Handle status filter change
  const handleStatusFilterChange = useCallback(
    (e) => {
      const status = e.target.value;
      setFilterStatus(status);
      setPage(1); // Reset to first page
    },
    []
  );

  // Handle search query change
  const handleSearchChange = useCallback(
    (e) => {
      setSearchQuery(e.target.value);
      setPage(1); // Reset to first page
    },
    []
  );

  // Pagination calculations
  const totalPages = Math.ceil(filteredPendingEdges.length / pageSize);
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const pageEdges = filteredPendingEdges.slice(startIndex, endIndex);

  // Render edge row
  const renderEdgeRow = (edge, index) => {
    const style = RELATIONSHIP_STYLES[edge.type] || RELATIONSHIP_STYLES[RELATIONSHIP_TYPES.RELATED];
    const isPending = edge.reviewStatus === EDGE_REVIEW_STATUS.PENDING;

    return (
      <div
        key={edge.id}
        style={{
          padding: '0.75rem 1rem',
          borderBottom: '1px solid var(--border-main)',
          background: isPending ? 'var(--bg-secondary)' : 'var(--bg-card)',
          transition: 'background 0.2s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
          {/* Source node */}
          <span
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background:
                edge.source.includes('certificate')
                  ? '#3b82f6'
                  : edge.source.includes('licence')
                  ? '#10b981'
                  : edge.source.includes('permit')
                  ? '#f59e0b'
                  : edge.source.includes('extract')
                  ? '#a855f6'
                  : edge.source.includes('renewal')
                  ? '#f97316'
                  : edge.source.includes('correction')
                  ? '#ef4444'
                  : edge.source.includes('reissue')
                  ? '#14b8a6'
                  : '#6b7280',
              display: 'inline-block',
              flexShrink: '0',
              marginRight: '0.5rem',
            }}
            ariaHidden="true"
          />

          {/* Edge details */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <strong
                style={{
                  fontSize: '0.875rem',
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '200px',
                }}
              >
                {edge.source}
              </strong>
              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: '600',
                  color: style?.color || 'var(--accent-main)',
                  background: style?.color + '20',
                  padding: '0.1rem 0.3rem',
                  borderRadius: '3px',
                }}
              >
                {style?.label || 'Related'}
              </span>
            </div>

            <p
              style={{
                margin: '0.25rem 0 0',
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '250px',
              }}
            >
              → {edge.target}
            </p>

            {/* Description preview */}
            {edge.description && (
              <p
                style={{
                  margin: '0.25rem 0 0',
                  fontSize: '0.7rem',
                  color: 'var(--text-tertiary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '250px',
                }}
              >
                {edge.description.slice(0, 100)}{edge.description.length > 100 ? '…' : ''}
              </p>
            )}

            {/* Source reference */}
            {edge.sourceReference && (
              <p
                style={{
                  margin: '0.25rem 0 0',
                  fontSize: '0.65rem',
                  color: 'var(--text-tertiary)',
                }}
              >
                From: {edge.sourceReference.name}
              </p>
            )}

            {/* Review status badge */}
            <span
              style={{
                marginTop: '0.25rem',
                fontSize: '0.6rem',
                fontWeight: '600',
                textTransform: 'uppercase',
                padding: '0.1rem 0.4rem',
                borderRadius: '3px',
                background:
                  edge.reviewStatus === EDGE_REVIEW_STATUS.APPROVED
                    ? 'var(--success)20'
                    : edge.reviewStatus === EDGE_REVIEW_STATUS.REJECTED
                    ? 'var(--error)20'
                    : 'var(--warning)20',
                  color:
                    edge.reviewStatus === EDGE_REVIEW_STATUS.APPROVED
                      ? 'var(--success)'
                    : edge.reviewStatus === EDGE_REVIEW_STATUS.REJECTED
                    ? 'var(--error)'
                    : 'var(--warning)',
              }}
            >
              {edge.reviewStatus === EDGE_REVIEW_STATUS.PENDING
                ? 'Pending review'
                : edge.reviewStatus === EDGE_REVIEW_STATUS.APPROVED
                ? 'Approved'
                : 'Rejected'}
            </span>
          </div>

          {/* Action buttons */}
          <div style={{ marginLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {!isPending && (
              <button
                type="button"
                style={{
                  padding: '0.3rem 0.5rem',
                  border: '1px solid var(--accent-main)',
                  background: 'var(--accent-main)',
                  color: 'white',
                  borderRadius: '0.25rem',
                  fontSize: '0.65rem',
                  cursor: 'pointer',
                  '&:hover': { background: '#2563eb' },
                }}
                onClick={() => handleApprove(edge.id)}
                title="Approve this relationship"
                disabled={!edge}
              >
                ✓ Approve
              </button>
            )}

            {isPending && (
              <span
                style={{
                  padding: '0.3rem 0.5rem',
                  border: '1px solid var(--border-main)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-tertiary)',
                  borderRadius: '0.25rem',
                  fontSize: '0.65rem',
                  cursor: 'not-allowed',
                }}
              >
                ⏳ Pending
              </span>
            )}

            <button
              type="button"
              style={{
                padding: '0.3rem 0.5rem',
                border: '1px solid var(--error)',
                background: 'var(--error)10',
                color: 'var(--error)',
                borderRadius: '0.25rem',
                fontSize: '0.65rem',
                cursor: 'pointer',
                '&:hover': { background: 'var(--error)20' },
                marginTop: '0.1rem',
              }}
              onClick={() => handleReject(edge.id)}
              title="Reject this relationship"
              disabled={!edge}
            >
              ✗ Reject
            </button>
          </div>
        </div>
      </div>
    );
  };

  // No results
  if (status === 'error') {
    return (
      <div
        style={{
          padding: '2rem',
          color: 'var(--error)',
          textAlign: 'center',
        }}
      >
        <p>Error loading review panel. Please try again.</p>
      </div>
    );
  }

  if (pendingEdges.length === 0 && filterStatus === 'pending') {
    return (
      <div
        style={{
          padding: '2rem',
          color: 'var(--text-tertiary)',
          textAlign: 'center',
        }}
      >
        <p>No pending terminology relationships require review.</p>
        <p style={{ margin: '0.5rem 0 0', color: 'var(--text-secondary)' }}>
          All edges are approved or rejected.
        </p>
      </div>
    );
  }

  if (filteredPendingEdges.length === 0 && filterStatus === 'pending') {
    return (
      <div
        style={{
          padding: '2rem',
          color: 'var(--text-tertiary)',
          textAlign: 'center',
        }}
      >
        <p>No pending relationships match the current filter.</p>
        <p style={{ margin: '0.5rem 0 0', color: 'var(--text-secondary)' }}>
          Try adjusting the filters above.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        height: 'calc(100vh - 200px)',
        overflow: 'auto',
      }}
      aria-labelledby="terminology-review-panel-title"
    >
      <header
        style={{
          padding: '1rem 1.5rem',
          borderBottom: '1px solid var(--border-main)',
          background: 'var(--bg-card)',
        }}
        id="terminology-review-panel-title"
      >
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)' }}>
          Terminology Relationship Review Queue
        </h2>

        {/* Filter controls */}
        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
          <select
            value={filterType}
            onChange={handleTypeFilterChange}
            style={{
              flex: 1,
              padding: '0.5rem',
              border: '1px solid var(--border-main)',
              borderRadius: '0.375rem',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
            }}
            aria-label="Filter by relationship type"
          >
            <option value="all">All types</option>
            <option value={RELATIONSHIP_TYPES.SYNONYM}>Synonym</option>
            <option value={RELATIONSHIP_TYPES.PREREQUISITE}>Prerequisite</option>
            <option value={RELATIONSHIP_TYPES.RELATED}>Related</option>
            <option value={RELATIONSHIP_TYPES.CONFUSING}>Confusing</option>
            <option value={RELATIONSHIP_TYPES.ALTERNATIVE}>Alternative</option>
          </select>

          <select
            value={filterStatus}
            onChange={handleStatusFilterChange}
            style={{
              marginLeft: '0.5rem',
              padding: '0.5rem',
              border: '1px solid var(--border-main)',
              borderRadius: '0.375rem',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
            }}
            aria-label="Filter by review status"
          >
            <option value="pending">Pending review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {/* Search */}
        <div style={{ marginTop: '0.75rem', marginLeft: '1rem' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search edges..."
            style={{
              padding: '0.5rem',
              border: '1px solid var(--border-main)',
              borderRadius: '0.375rem',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
              width: '200px',
            }}
            aria-label="Search edges"
          />
        </div>
      </header>

      <main
        style={{
          padding: '1rem 1.5rem',
          maxHeight: '600px',
          overflow: 'auto',
        }}
      >
        {/* Summary stats */}
        <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-card)', borderRadius: '0.5rem' }}>
          <p style={{ margin: '0.25rem 0', fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
            {pendingEdges.length} pending relationships{filteredPendingEdges.length > 0 ? ` matching filters` : ''}
          </p>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {filteredPendingEdges.length} showing on current page
          </p>
        </div>

        {/* Edges list */}
        {filteredPendingEdges.length > 0 ? (
          <div style={{ overflow: 'auto' }}>
            {pageEdges.map((edge, index) => renderEdgeRow(edge, index))}
          </div>
        ) : (
          <p style={{ padding: '1rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>
            No edges match the current filters.
          </p>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            style={{
              marginTop: '1rem',
              display: 'flex',
              justifyContent: 'center',
              gap: '0.25rem',
            }}
          >
            <button
              type="button"
              disabled={page <= 1}
              style={{
                padding: '0.5rem 0.75rem',
                border: '1px solid var(--border-main)',
                background: page <= 1 ? 'var(--bg-secondary)' : 'var(--accent-main)',
                color: page <= 1 ? 'var(--text-tertiary)' : 'white',
                borderRadius: '0.375rem',
                fontSize: '0.75rem',
                cursor: page <= 1 ? 'not-available' : 'pointer',
              }}
              onClick={() => setPage(1)}
            >
              First
            </button>
            <button
              type="button"
              disabled={page <= 1}
              style={{
                padding: '0.5rem 0.75rem',
                border: '1px solid var(--border-main)',
                background: page <= 1 ? 'var(--bg-secondary)' : 'var(--accent-main)',
                color: page <= 1 ? 'var(--text-tertiary)' : 'white',
                borderRadius: '0.375rem',
                fontSize: '0.75rem',
                cursor: page <= 1 ? 'not-available' : 'pointer',
              }}
              onClick={() => setPage(Math.max(1, page - 1))
            }
            >
              Prev
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              style={{
                padding: '0.5rem 0.75rem',
                border: '1px solid var(--border-main)',
                background: page >= totalPages ? 'var(--bg-secondary)' : 'var(--accent-main)',
                color: page >= totalPages ? 'var(--text-tertiary)' : 'white',
                borderRadius: '0.375rem',
                fontSize: '0.75rem',
                cursor: page >= totalPages ? 'not-available' : 'pointer',
              }}
              onClick={() => setPage(Math.min(totalPages, page + 1))
            }
            >
              Next
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              style={{
                padding: '0.5rem 0.75rem',
                border: '1px solid var(--border-main)',
                background: page >= totalPages ? 'var(--bg-secondary)' : 'var(--accent-main)',
                color: page >= totalPages ? 'var(--text-tertiary)' : 'white',
                borderRadius: '0.375rem',
                fontSize: '0.75rem',
                cursor: page >= totalPages ? 'not-available' : 'pointer',
              }}
              onClick={() => setPage(totalPages)}
            >
              Last
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

/**
 * Memoization helper
 */
import { useMemo } from 'react';

export default TerminologyReviewPanel;