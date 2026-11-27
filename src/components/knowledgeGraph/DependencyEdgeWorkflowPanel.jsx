import { useState, useMemo } from 'react';
import {
  GitBranch,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  List,
} from 'lucide-react';
import {
  GRAPH_EDGE_TYPES,
} from '../../data/civicKnowledgeGraphContract';
import {
  proposeDependencyEdge,
  reviewAndPublishEdge,
  listEdgeProposals,
  buildAccessibleDependencyList,
} from '../../services/civicKnowledgeGraphEdgeWorkflow';

export default function DependencyEdgeWorkflowPanel({
  startNodeId = 'service:driving-licence',
  jurisdiction = '',
  effectiveAsOf = '',
}) {
  const [targetNodeId, setTargetNodeId] = useState('doc:form-1a-medical');
  const [edgeType, setEdgeType] = useState(GRAPH_EDGE_TYPES.REQUIRES_DOCUMENT);
  const [officialUrl, setOfficialUrl] = useState('https://parivahan.gov.in');
  const [proposals, setProposals] = useState(() => {
    try {
      return listEdgeProposals();
    } catch {
      return [];
    }
  });
  const [errorMsg, setErrorMsg] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  const accessibleList = useMemo(
    () => buildAccessibleDependencyList({ startNodeId, jurisdiction, effectiveAsOf }),
    [startNodeId, jurisdiction, effectiveAsOf]
  );

  const handlePropose = (e) => {
    e.preventDefault();
    setErrorMsg('');
    setStatusMsg('');
    try {
      const prop = proposeDependencyEdge({
        sourceNodeId: startNodeId,
        targetNodeId: targetNodeId.trim(),
        edgeType,
        jurisdiction: jurisdiction || 'All India',
        officialUrl,
      });
      setProposals(listEdgeProposals());
      setStatusMsg(
        prop.hasCycle
          ? `Proposal staged with CYCLE WARNING (${prop.cyclePath.join(' -> ')}). Publication will be blocked.`
          : `Proposed edge ${prop.proposalId} staged for human review.`
      );
    } catch (err) {
      setErrorMsg(err.message || 'Failed to propose edge.');
    }
  };

  const handleReview = (proposalId, decision) => {
    setErrorMsg('');
    setStatusMsg('');
    try {
      const res = reviewAndPublishEdge({
        proposalId,
        reviewerId: 'reviewer_workspace',
        reviewerRole: 'reviewer',
        decision,
        rejectionReason: decision === 'REJECT' ? 'Insufficient statutory citation' : '',
      });
      if (!res.ok) {
        setErrorMsg(res.error);
      } else {
        setProposals(listEdgeProposals());
        setStatusMsg(`Edge proposal ${proposalId} ${decision === 'PUBLISH' ? 'published' : 'rejected'}.`);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Review failed.');
    }
  };

  return (
    <section
      aria-label="Cross-Department Dependency List and Edge Publication"
      style={{
        marginTop: '1.5rem',
        padding: '1.25rem',
        borderRadius: '0.75rem',
        border: '1px solid var(--border-main, #e2e8f0)',
        background: 'var(--bg-card, #fff)',
      }}
    >
      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
        <List size={18} aria-hidden="true" />
        Accessible Dependency List &amp; Human-Reviewed Edge Publication
      </h2>

      {/* Accessible List View */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 600, margin: '0 0 0.4rem 0' }}>
          Prerequisites, Authorities &amp; Documents ({accessibleList.items.length})
        </h3>
        {accessibleList.items.length === 0 ? (
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
            No published dependency edges match the current jurisdiction/effective-date filter.
          </p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {accessibleList.items.map((item) => (
              <li key={item.edgeId}>
                <strong>{item.relation}</strong> &rarr; {item.targetTitle} ({item.jurisdiction})
                {item.effectiveFrom && ` • Effective: ${item.effectiveFrom}`}
              </li>
            ))}
          </ul>
        )}
      </div>

      {errorMsg && (
        <div role="alert" style={{ padding: '0.6rem 0.85rem', borderRadius: '0.4rem', background: '#fef2f2', color: '#b91c1c', fontSize: '0.82rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <AlertTriangle size={15} aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      {statusMsg && (
        <div role="status" style={{ padding: '0.6rem 0.85rem', borderRadius: '0.4rem', background: '#eff6ff', color: '#1d4ed8', fontSize: '0.82rem', marginBottom: '0.75rem' }}>
          {statusMsg}
        </div>
      )}

      {/* Propose Edge Form */}
      <form onSubmit={handlePropose} style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1rem' }}>
        <div style={{ flex: '1 1 180px' }}>
          <label htmlFor="kg-target" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.2rem' }}>
            Target Node ID
          </label>
          <input
            id="kg-target"
            type="text"
            value={targetNodeId}
            onChange={(e) => setTargetNodeId(e.target.value)}
            style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: '0.35rem', border: '1px solid var(--border-main, #cbd5e1)', fontSize: '0.82rem' }}
          />
        </div>
        <div style={{ flex: '1 1 180px' }}>
          <label htmlFor="kg-edgetype" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.2rem' }}>
            Dependency Type
          </label>
          <select
            id="kg-edgetype"
            value={edgeType}
            onChange={(e) => setEdgeType(e.target.value)}
            style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: '0.35rem', border: '1px solid var(--border-main, #cbd5e1)', fontSize: '0.82rem' }}
          >
            {Object.values(GRAPH_EDGE_TYPES).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: '1 1 200px' }}>
          <label htmlFor="kg-url" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.2rem' }}>
            Official Source URL (https://)
          </label>
          <input
            id="kg-url"
            type="url"
            value={officialUrl}
            onChange={(e) => setOfficialUrl(e.target.value)}
            style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: '0.35rem', border: '1px solid var(--border-main, #cbd5e1)', fontSize: '0.82rem' }}
          />
        </div>
        <button
          type="submit"
          style={{ padding: '0.45rem 0.9rem', borderRadius: '0.4rem', border: 'none', background: 'var(--primary, #2563eb)', color: '#fff', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
        >
          <GitBranch size={14} aria-hidden="true" /> Propose Edge
        </button>
      </form>

      {/* Edge Proposals Queue */}
      {proposals.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {proposals.slice(0, 5).map((p) => (
            <div key={p.proposalId} style={{ padding: '0.6rem 0.8rem', borderRadius: '0.4rem', border: '1px solid var(--border-light, #e2e8f0)', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <strong>{p.sourceNodeId}</strong> &rarr; <strong>{p.targetNodeId}</strong> ({p.edgeType}) &bull; <span>{p.status}</span>
                {p.hasCycle && <span style={{ marginLeft: '0.4rem', color: '#b91c1c', fontWeight: 700 }}>CYCLE DETECTED</span>}
              </div>
              {p.status === 'DRAFT_PENDING_REVIEW' && (
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button type="button" onClick={() => handleReview(p.proposalId, 'PUBLISH')} style={{ padding: '0.2rem 0.5rem', borderRadius: '0.3rem', border: 'none', background: '#16a34a', color: '#fff', fontSize: '0.74rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                    <CheckCircle2 size={12} aria-hidden="true" /> Publish
                  </button>
                  <button type="button" onClick={() => handleReview(p.proposalId, 'REJECT')} style={{ padding: '0.2rem 0.5rem', borderRadius: '0.3rem', border: 'none', background: '#dc2626', color: '#fff', fontSize: '0.74rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                    <XCircle size={12} aria-hidden="true" /> Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
