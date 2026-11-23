import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useParams, Link } from 'react-router-dom';
import {
  GitFork,
  Download,
  ShieldCheck,
  History,
  Table as TableIcon,
  Network,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { getLineageDAG, exportLineage, recordEditorialReview } from '../services/provenanceService';
import { explainLineagePath } from '../services/lineageAiExplainerService';
import LineageGraphView from '../components/lineage/LineageGraphView';
import LineageTableView from '../components/lineage/LineageTableView';
import LineageNodeDetailModal from '../components/lineage/LineageNodeDetailModal';
import EditorialReviewModal from '../components/lineage/EditorialReviewModal';
import SupersessionModal from '../components/lineage/SupersessionModal';
import CivicReleaseProvenanceLedgerPanel from '../components/admin/CivicReleaseProvenanceLedgerPanel';
import {
  LineageEmptyState,
  LineageOfflineBanner,
  LineageErrorState,
} from '../components/lineage/LineageStates';
import { MOCK_SERVICES } from '../data/services';
import { FACT_FIELDS } from '../data/provenanceContract';

const LineageExplorerWorkspace = () => {
  const { id: paramId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryServiceId = searchParams.get('service') || searchParams.get('target');

  const { user } = useAuth();
  const { isOnline } = useNetwork();

  const userRole = user?.role || 'public';
  const isAdminOrReviewer = ['admin', 'reviewer', 'operator'].includes(userRole);

  // Active target fact / service
  const initialTarget = paramId || queryServiceId || 'tree-pruning-permission';
  const [selectedServiceId, setSelectedServiceId] = useState(initialTarget);
  const [selectedFactField, setSelectedFactField] = useState('all');
  const [viewMode, setViewMode] = useState('graph'); // 'graph' | 'table' | 'ledger'
  const [refreshKey, setRefreshKey] = useState(0);

  // Sync selectedServiceId if route param or search query changes
  useEffect(() => {
    const active = paramId || queryServiceId;
    if (active && active !== selectedServiceId) {
      setSelectedServiceId(active);
    }
  }, [paramId, queryServiceId, selectedServiceId]);

  // Modals state
  const [selectedNode, setSelectedNode] = useState(null);
  const [isNodeModalOpen, setIsNodeModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isSupersessionModalOpen, setIsSupersessionModalOpen] = useState(false);

  // Lineage data derived purely via useMemo
  const target = selectedFactField !== 'all' ? `${selectedServiceId}:${selectedFactField}` : selectedServiceId;

  const { dag, aiExplanation, error } = useMemo(() => {
    // Reference refreshKey to track intentional cache invalidation
    if (refreshKey < 0) return { dag: null, aiExplanation: null, error: null };
    try {
      const graph = getLineageDAG(target, { userRole });
      const summary = explainLineagePath(target, { userRole });
      return { dag: graph, aiExplanation: summary, error: null };
    } catch (err) {
      return {
        dag: { nodes: [], edges: [], reviews: [], supersessions: [] },
        aiExplanation: null,
        error: err.message || 'Failed to resolve lineage path',
      };
    }
  }, [target, userRole, refreshKey]);

  const safeDag = dag || { nodes: [], edges: [], reviews: [], supersessions: [] };

  const handleSelectNode = (node) => {
    setSelectedNode(node);
    setIsNodeModalOpen(true);
  };

  const handleSaveReview = (reviewPayload) => {
    recordEditorialReview(reviewPayload, user?.username || 'admin_reviewer');
    setRefreshKey((k) => k + 1);
  };

  const handleExport = (format) => {
    const content = exportLineage(target, format, { userRole });
    const mimeTypes = {
      json: 'application/json',
      dot: 'text/vnd.graphviz',
      csv: 'text/csv',
    };
    const blob = new Blob([content], { type: mimeTypes[format] || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lineage_${target}_${format}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="section" style={{ padding: '2rem 1rem' }}>
      <div className="container" style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header Breadcrumbs & Status */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-tertiary)', marginBottom: '0.5rem' }}>
            <Link to="/services" style={{ color: 'var(--text-secondary)' }}>Services</Link>
            <span>/</span>
            <span>Knowledge Lineage & Provenance</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0 0 0.4rem 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <GitFork size={28} color="var(--accent-main)" />
                Data Lineage & Provenance Explorer
              </h1>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '750px' }}>
                Trace public civic facts, legal requirements, and fees back to authoritative gazettes, official publishers, parser versions, and review attestations.
              </p>
            </div>

            {/* Actions Bar */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsSupersessionModalOpen(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
                aria-label="View statutory supersessions and historical amendments"
              >
                <History size={15} />
                Supersessions ({safeDag.supersessions?.length || 0})
              </button>

              {isAdminOrReviewer && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setIsReviewModalOpen(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
                  aria-label="Submit editorial review or statutory amendment"
                >
                  <ShieldCheck size={16} />
                  Record Review
                </button>
              )}

              {/* Export dropdown */}
              <div style={{ display: 'inline-flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-light)' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handleExport('json')}
                  style={{ border: 'none', borderRadius: 0, fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
                  title="Export Graph JSON"
                >
                  <Download size={13} style={{ marginRight: '3px' }} /> JSON
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handleExport('csv')}
                  style={{ border: 'none', borderLeft: '1px solid var(--border-light)', borderRadius: 0, fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
                  title="Export Accessible CSV"
                >
                  CSV
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handleExport('dot')}
                  style={{ border: 'none', borderLeft: '1px solid var(--border-light)', borderRadius: 0, fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
                  title="Export Graphviz DOT"
                >
                  DOT
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Offline notice */}
        {!isOnline && <LineageOfflineBanner />}

        {/* Filters & Selector Bar */}
        <div
          className="card"
          style={{
            padding: '1.25rem',
            marginBottom: '1.5rem',
            background: 'var(--glass-bg)',
            borderRadius: '10px',
            border: '1px solid var(--border-light)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1rem',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', flex: '1 1 500px' }}>
            <div style={{ flex: '1 1 240px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>
                Civic Service
              </label>
              <select
                value={selectedServiceId}
                onChange={(e) => {
                  setSelectedServiceId(e.target.value);
                  setSearchParams({ service: e.target.value });
                }}
                className="input"
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', fontSize: '0.875rem' }}
                aria-label="Select Civic Service to trace"
              >
                {MOCK_SERVICES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ flex: '0 1 180px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>
                Fact Dimension
              </label>
              <select
                value={selectedFactField}
                onChange={(e) => setSelectedFactField(e.target.value)}
                className="input"
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', fontSize: '0.875rem' }}
                aria-label="Filter by Fact Dimension"
              >
                <option value="all">All Fact Dimensions</option>
                <option value={FACT_FIELDS.FEES}>Statutory Fees</option>
                <option value={FACT_FIELDS.SLA}>Processing SLA</option>
                <option value={FACT_FIELDS.DOCUMENTS}>Required Documents</option>
                <option value={FACT_FIELDS.ELIGIBILITY}>Eligibility Rules</option>
              </select>
            </div>
          </div>

          {/* View mode toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginRight: '0.25rem' }}>View:</span>
            <button
              type="button"
              className={`btn ${viewMode === 'graph' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode('graph')}
              style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
              aria-pressed={viewMode === 'graph'}
            >
              <Network size={14} />
              Graph View
            </button>
            <button
              type="button"
              className={`btn ${viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode('table')}
              style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
              aria-pressed={viewMode === 'table'}
              aria-label="Accessible Table Alternative View"
            >
              <TableIcon size={14} />
              Accessible Table
            </button>
            <button
              type="button"
              className={`btn ${viewMode === 'ledger' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode('ledger')}
              style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
              aria-pressed={viewMode === 'ledger'}
              aria-label="Tamper-Evident Release Signatures and Ledger View"
            >
              <ShieldCheck size={14} />
              Release Signatures &amp; Ledger
            </button>
          </div>
        </div>

        {/* Explainable AI & Deterministic Path Summary Card */}
        {aiExplanation && (
          <div
            className="card"
            style={{
              padding: '1.25rem',
              marginBottom: '1.5rem',
              background: 'var(--glass-bg)',
              borderLeft: '4px solid var(--accent-main)',
              borderRadius: '8px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={18} color="var(--accent-main)" />
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  Authoritative Statutory Lineage Explanation
                </span>
                <span style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent-main)', fontFamily: 'monospace' }}>
                  {aiExplanation.rulesetVersion}
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                Confidence: <strong>{Math.round(aiExplanation.confidenceScore * 100)}%</strong> | Hops: {aiExplanation.traceability?.totalHops || 0}
              </div>
            </div>
            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', lineHeight: '1.5', color: 'var(--text-primary)' }}>
              {aiExplanation.summary}
            </p>
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-tertiary)', flexWrap: 'wrap' }}>
              <span>Strict Invariant: Non-hallucinated DAG edges only</span>
              <span>Executed: {new Date(aiExplanation.executionTimestamp).toLocaleTimeString()}</span>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        {error && <LineageErrorState error={error} onRetry={() => setRefreshKey((k) => k + 1)} />}

        {!error && safeDag.nodes.length === 0 && (
          <LineageEmptyState
            message={`No statutory provenance records have been linked for "${selectedServiceId}" yet. Explore a grounded statutory service below:`}
            onSelectSample={(sampleId) => {
              setSelectedServiceId(sampleId);
              setSearchParams({ service: sampleId });
            }}
            onReset={() => {
              setSelectedServiceId('tree-pruning-permission');
              setSelectedFactField('all');
              setSearchParams({ service: 'tree-pruning-permission' });
            }}
          />
        )}

        {viewMode === 'ledger' ? (
          <CivicReleaseProvenanceLedgerPanel />
        ) : (
          !error && safeDag.nodes.length > 0 && (
            <div
              className="card"
              style={{
                padding: '1.25rem',
                borderRadius: '10px',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-card)',
              }}
            >
              {viewMode === 'graph' ? (
                <LineageGraphView
                  nodes={safeDag.nodes}
                  edges={safeDag.edges}
                  reviews={safeDag.reviews}
                  onSelectNode={handleSelectNode}
                />
              ) : (
                <LineageTableView
                  nodes={safeDag.nodes}
                  edges={safeDag.edges}
                  onSelectNode={handleSelectNode}
                />
              )}
            </div>
          )
        )}

        {/* Modals */}
        <LineageNodeDetailModal
          node={selectedNode}
          isOpen={isNodeModalOpen}
          onClose={() => setIsNodeModalOpen(false)}
        />

        <EditorialReviewModal
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          targetEntityId={selectedFactField !== 'all' ? `${selectedServiceId}:${selectedFactField}` : selectedServiceId}
          onSaveReview={handleSaveReview}
          currentReview={safeDag.reviews?.[0] || null}
        />

        <SupersessionModal
          isOpen={isSupersessionModalOpen}
          onClose={() => setIsSupersessionModalOpen(false)}
          supersessions={safeDag.supersessions || []}
        />
      </div>
    </div>
  );
};

export default LineageExplorerWorkspace;
