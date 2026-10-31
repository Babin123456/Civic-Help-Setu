import { useState, useMemo } from 'react';
import {
  Sparkles,
  ShieldCheck,
  CheckCircle,
  XCircle,
  Edit3,
  AlertTriangle,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Save,
  Trash2,
  Info,
  Clock,
  User,
} from 'lucide-react';
import {
  getEnrichmentQueue,
  reviewFieldProposal,
  finalizeProposalReview,
  rejectEntireProposal,
  getEnrichmentStats,
} from '../../services/catalogueEnrichmentReviewService.js';
import { useToast } from '../../context/ToastContext.jsx';

const CatalogueEnrichmentReviewPanel = () => {
  const { toast } = useToast();
  const [queue, setQueue] = useState(() => getEnrichmentQueue());
  const [activeFilter, setActiveFilter] = useState('pending'); // 'pending' | 'approved' | 'rejected' | 'all'
  const [reviewerName, setReviewerName] = useState('Admin Reviewer');
  const [reviewNotes, setReviewNotes] = useState({});
  const [editingFieldMap, setEditingFieldMap] = useState({}); // `${proposalId}_${fieldKey}`: editedText

  const stats = useMemo(() => getEnrichmentStats(), [queue]);

  const filteredProposals = useMemo(() => {
    if (activeFilter === 'pending') return queue.filter((p) => p.status === 'pending');
    if (activeFilter === 'approved') return queue.filter((p) => p.status === 'approved' || p.status === 'partially_approved');
    if (activeFilter === 'rejected') return queue.filter((p) => p.status === 'rejected');
    return queue;
  }, [queue, activeFilter]);

  const handleFieldDecision = (proposalId, fieldKey, decision, customVal = '') => {
    const res = reviewFieldProposal(proposalId, fieldKey, decision, customVal);
    if (res.success) {
      setQueue([...getEnrichmentQueue()]);
      toast?.info?.(`Field "${fieldKey}" set to ${decision}.`);
    } else {
      toast?.error?.(res.error || 'Failed to update field decision.');
    }
  };

  const handleStartEdit = (proposalId, fieldKey, currentVal) => {
    const key = `${proposalId}_${fieldKey}`;
    setEditingFieldMap({
      ...editingFieldMap,
      [key]: currentVal,
    });
  };

  const handleSaveEdit = (proposalId, fieldKey) => {
    const key = `${proposalId}_${fieldKey}`;
    const editedVal = editingFieldMap[key] || '';
    handleFieldDecision(proposalId, fieldKey, 'edited', editedVal);
    const updatedMap = { ...editingFieldMap };
    delete updatedMap[key];
    setEditingFieldMap(updatedMap);
  };

  const handleFinalize = (proposalId) => {
    const notes = reviewNotes[proposalId] || '';
    const res = finalizeProposalReview(proposalId, reviewerName, notes);
    if (res.success) {
      setQueue([...getEnrichmentQueue()]);
      toast?.success?.(`Proposal review finalized (${res.overallStatus}).`);
    } else {
      toast?.error?.('Could not finalize proposal review.');
    }
  };

  const handleRejectAll = (proposalId) => {
    const notes = reviewNotes[proposalId] || 'Rejected in full by administrator';
    const res = rejectEntireProposal(proposalId, reviewerName, notes);
    if (res.success) {
      setQueue([...getEnrichmentQueue()]);
      toast?.warning?.('Enrichment proposal rejected.');
    } else {
      toast?.error?.('Could not reject proposal.');
    }
  };

  return (
    <section className="glass-panel" style={{ padding: '1.75rem', borderRadius: '1rem', border: '1px solid var(--border-main)' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
          <Sparkles size={24} color="var(--accent-main, #2563eb)" />
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>
            AI Catalogue Enrichment Review Queue
          </h2>
        </div>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Field-by-field verification for AI-generated summaries, steps, and tags prior to publication
        </p>
      </div>

      {/* Safety Notice */}
      <div
        style={{
          padding: '0.9rem 1.25rem',
          borderRadius: '0.75rem',
          backgroundColor: 'rgba(59, 130, 246, 0.06)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '1.5rem',
        }}
      >
        <ShieldCheck size={20} color="#2563eb" style={{ flexShrink: 0 }} />
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
          <strong style={{ color: 'var(--text-primary)' }}>AI Safeguard &amp; Integrity Policy:</strong> AI-generated
          descriptions, citizen tips, and keywords remain strictly isolated from public service pages until an authorized
          maintainer verifies accuracy, corrects omissions, and confirms publication.
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--border-main)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>PENDING REVIEW</span>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f59e0b', marginTop: '0.25rem' }}>
            {stats.pending}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Awaiting maintainer action</span>
        </div>

        <div className="card" style={{ padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--border-main)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>APPROVED / MERGED</span>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#16a34a', marginTop: '0.25rem' }}>
            {stats.approved}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Updated in catalogue</span>
        </div>

        <div className="card" style={{ padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--border-main)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>REJECTED / ARCHIVED</span>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#dc2626', marginTop: '0.25rem' }}>
            {stats.rejected}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Dismissed suggestions</span>
        </div>

        <div className="card" style={{ padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--border-main)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>TOTAL PROPOSALS</span>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
            {stats.total}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Historical audit queue</span>
        </div>
      </div>

      {/* Filter Tabs & Reviewer Identity */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => setActiveFilter('pending')}
            className={`btn ${activeFilter === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
          >
            Pending ({stats.pending})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('approved')}
            className={`btn ${activeFilter === 'approved' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
          >
            Approved ({stats.approved})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('rejected')}
            className={`btn ${activeFilter === 'rejected' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
          >
            Rejected ({stats.rejected})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`btn ${activeFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
          >
            All ({stats.total})
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <User size={16} color="var(--text-tertiary)" />
          <input
            type="text"
            value={reviewerName}
            onChange={(e) => setReviewerName(e.target.value)}
            placeholder="Reviewer ID or Email"
            style={{ padding: '0.4rem 0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border-main)', fontSize: '0.85rem', width: '180px' }}
          />
        </div>
      </div>

      {/* Proposals List */}
      <div style={{ display: 'grid', gap: '1.5rem' }}>
        {filteredProposals.length === 0 ? (
          <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <CheckCircle size={36} color="#16a34a" style={{ marginBottom: '0.5rem', opacity: 0.8 }} />
            <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.1rem' }}>No proposals in this view</h3>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>All AI suggestions have been reviewed and processed.</p>
          </div>
        ) : (
          filteredProposals.map((proposal) => {
            const isPending = proposal.status === 'pending';
            const fieldKeys = Object.keys(proposal.fields);

            return (
              <div
                key={proposal.id}
                className="card"
                style={{
                  borderRadius: '0.85rem',
                  border: isPending ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border-main)',
                  overflow: 'hidden',
                  backgroundColor: 'var(--bg-card, #ffffff)',
                }}
              >
                {/* Proposal Top Bar */}
                <div
                  style={{
                    padding: '1rem 1.25rem',
                    borderBottom: '1px solid var(--border-main)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                    backgroundColor: 'var(--bg-secondary, #f8fafc)',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>{proposal.serviceName}</h3>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '0.35rem',
                          fontWeight: 600,
                          backgroundColor:
                            proposal.status === 'approved'
                              ? '#dcfce7'
                              : proposal.status === 'partially_approved'
                              ? '#dbeafe'
                              : proposal.status === 'rejected'
                              ? '#fee2e2'
                              : '#fef3c7',
                          color:
                            proposal.status === 'approved'
                              ? '#15803d'
                              : proposal.status === 'partially_approved'
                              ? '#1d4ed8'
                              : proposal.status === 'rejected'
                              ? '#b91c1c'
                              : '#b45309',
                        }}
                      >
                        {proposal.status.toUpperCase()}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                      Proposal ID: {proposal.id} • Proposed: {new Date(proposal.proposedAt).toLocaleString()}
                    </span>
                  </div>

                  {proposal.reviewedBy && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'right' }}>
                      Reviewed by: <strong>{proposal.reviewedBy}</strong> ({new Date(proposal.reviewedAt).toLocaleDateString()})
                      {proposal.reviewNotes && <div style={{ fontStyle: 'italic', fontSize: '0.75rem' }}>"{proposal.reviewNotes}"</div>}
                    </div>
                  )}
                </div>

                {/* Field-by-Field Diff Comparison */}
                <div style={{ padding: '1.25rem', display: 'grid', gap: '1.25rem' }}>
                  {fieldKeys.map((fKey) => {
                    const field = proposal.fields[fKey];
                    const editKey = `${proposal.id}_${fKey}`;
                    const isEditing = editingFieldMap[editKey] !== undefined;

                    return (
                      <div
                        key={fKey}
                        style={{
                          borderRadius: '0.6rem',
                          border: '1px solid var(--border-main)',
                          padding: '1rem',
                          backgroundColor: 'var(--bg-primary, #ffffff)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{field.label}</span>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '0.3rem',
                              fontWeight: 600,
                              backgroundColor:
                                field.decision === 'approved'
                                  ? '#dcfce7'
                                  : field.decision === 'edited'
                                  ? '#dbeafe'
                                  : field.decision === 'rejected'
                                  ? '#fee2e2'
                                  : 'var(--bg-secondary, #f1f5f9)',
                              color:
                                field.decision === 'approved'
                                  ? '#15803d'
                                  : field.decision === 'edited'
                                  ? '#1d4ed8'
                                  : field.decision === 'rejected'
                                  ? '#b91c1c'
                                  : 'var(--text-secondary)',
                            }}
                          >
                            Decision: {field.decision.toUpperCase()}
                          </span>
                        </div>

                        {/* Diff Box */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                          {/* Current published */}
                          <div
                            style={{
                              padding: '0.75rem',
                              borderRadius: '0.5rem',
                              backgroundColor: 'var(--bg-secondary, #f8fafc)',
                              border: '1px solid var(--border-main)',
                            }}
                          >
                            <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>
                              CURRENT PUBLISHED VERSION
                            </span>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', minHeight: '40px' }}>
                              {field.current || <em style={{ color: 'var(--text-tertiary)' }}>(Field currently empty)</em>}
                            </div>
                          </div>

                          {/* Proposed / Edited */}
                          <div
                            style={{
                              padding: '0.75rem',
                              borderRadius: '0.5rem',
                              backgroundColor: 'rgba(59, 130, 246, 0.04)',
                              border: '1px solid rgba(59, 130, 246, 0.25)',
                            }}
                          >
                            <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#2563eb', marginBottom: '0.25rem' }}>
                              {isEditing ? 'EDIT PROPOSED TEXT' : 'AI PROPOSED ENRICHMENT'}
                            </span>
                            {isEditing ? (
                              <div>
                                <textarea
                                  rows={3}
                                  value={editingFieldMap[editKey]}
                                  onChange={(e) =>
                                    setEditingFieldMap({
                                      ...editingFieldMap,
                                      [editKey]: e.target.value,
                                    })
                                  }
                                  style={{
                                    width: '100%',
                                    padding: '0.5rem',
                                    borderRadius: '0.4rem',
                                    border: '1px solid #2563eb',
                                    fontSize: '0.85rem',
                                  }}
                                />
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEdit(proposal.id, fKey)}
                                    className="btn btn-primary"
                                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                                  >
                                    <Save size={13} /> Save &amp; Accept
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = { ...editingFieldMap };
                                      delete updated[editKey];
                                      setEditingFieldMap(updated);
                                    }}
                                    className="btn btn-secondary"
                                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', minHeight: '40px' }}>
                                {field.decision === 'edited' ? (
                                  <span>
                                    <strong>Edited by Admin:</strong> {field.editedValue}
                                  </span>
                                ) : (
                                  field.proposed
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Individual Field Actions (enabled if proposal is pending or field editable) */}
                        {isPending && !isEditing && (
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
                            <button
                              type="button"
                              onClick={() => handleFieldDecision(proposal.id, fKey, 'approved')}
                              className="btn btn-secondary"
                              style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', color: '#16a34a', borderColor: '#bbf7d0' }}
                            >
                              <Check size={13} /> Approve Field
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStartEdit(proposal.id, fKey, field.proposed)}
                              className="btn btn-secondary"
                              style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', color: '#2563eb' }}
                            >
                              <Edit3 size={13} /> Edit Field
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFieldDecision(proposal.id, fKey, 'rejected')}
                              className="btn btn-secondary"
                              style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', color: '#dc2626', borderColor: '#fca5a5' }}
                            >
                              <X size={13} /> Reject Field
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Finalize Proposal Review Bar */}
                {isPending && (
                  <div
                    style={{
                      padding: '1rem 1.25rem',
                      borderTop: '1px solid var(--border-main)',
                      backgroundColor: 'var(--bg-secondary, #f8fafc)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: '240px' }}>
                      <input
                        type="text"
                        placeholder="Optional review notes / verification rationale..."
                        value={reviewNotes[proposal.id] || ''}
                        onChange={(e) =>
                          setReviewNotes({
                            ...reviewNotes,
                            [proposal.id]: e.target.value,
                          })
                        }
                        style={{
                          width: '100%',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '0.4rem',
                          border: '1px solid var(--border-main)',
                          fontSize: '0.82rem',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => handleFinalize(proposal.id)}
                        className="btn btn-primary"
                        style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                      >
                        <Check size={15} /> Finalize Review &amp; Apply
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRejectAll(proposal.id)}
                        className="btn btn-secondary"
                        style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', color: '#dc2626', borderColor: '#fca5a5' }}
                      >
                        <Trash2 size={15} /> Reject Entire Proposal
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};

export default CatalogueEnrichmentReviewPanel;