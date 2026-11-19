import { useEffect, useRef } from 'react';
import {
  X,
  MapPin,
  ThumbsUp,
  FileText,
  ShieldCheck,
  ExternalLink,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { PROPOSAL_CATEGORIES, PROPOSAL_STATUSES } from '../../data/wardBudgetContract.js';
import DeliberationThread from './DeliberationThread.jsx';

export default function ProposalDetailModal({
  proposal,
  isOpen,
  onClose,
  comments = [],
  decisions = [],
  updates = [],
  onAddComment,
  onVoteClick,
  userVoteStatus = false,
  currentUser = {},
  onOpenReview,
  formatCurrency = (num) => `₹${num?.toLocaleString('en-IN')}`,
}) {
  const modalRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !proposal) return null;

  const categoryInfo = PROPOSAL_CATEGORIES[proposal.category] || { label: proposal.category };
  const statusInfo = PROPOSAL_STATUSES[proposal.status] || { label: proposal.status };
  const isOfficial = currentUser.role === 'reviewer' || currentUser.role === 'admin';

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        padding: '1rem',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-proposal-title"
    >
      <div
        ref={modalRef}
        className="modal-content"
        style={{
          background: 'var(--bg-card, #121212)',
          color: 'var(--text-primary, #ffffff)',
          border: '1px solid var(--border-light, rgba(255, 255, 255, 0.15))',
          width: '100%',
          maxWidth: '750px',
          maxHeight: '90vh',
          borderRadius: '1rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '1rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '0.2rem 0.6rem',
                  borderRadius: '9999px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: 'var(--accent-main, #38bdf8)',
                }}
              >
                {categoryInfo.label}
              </span>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '0.2rem 0.6rem',
                  borderRadius: '4px',
                  background: 'var(--bg-tag, #1c1c22)',
                  color: 'var(--text-secondary, #a1a1aa)',
                  border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
                }}
              >
                {statusInfo.label}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary, #71717a)' }}>
                ID: {proposal.id}
              </span>
            </div>
            <h2
              id="modal-proposal-title"
              style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, lineHeight: 1.3, color: 'var(--text-primary)' }}
            >
              {proposal.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close proposal details"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.4rem',
              borderRadius: '0.375rem',
              color: 'var(--text-secondary, #a1a1aa)',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          {/* Duplicate Notice */}
          {proposal.canonicalProposalId && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                background: 'rgba(217, 119, 6, 0.15)',
                border: '1px solid rgba(217, 119, 6, 0.35)',
                color: '#fbbf24',
                marginBottom: '1rem',
                fontSize: '0.85rem',
              }}
            >
              <Layers size={18} />
              <div>
                <strong>Consolidated as duplicate:</strong> Merged into primary proposal{' '}
                <code>{proposal.canonicalProposalId}</code> to aggregate community support and prevent fragmented work orders.
              </div>
            </div>
          )}

          {/* Location & Metadata */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              padding: '1rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-tag, #1c1c22)',
              border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
              marginBottom: '1.25rem',
            }}
          >
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'block', marginBottom: '0.2rem' }}>
                Ward Jurisdiction
              </span>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {proposal.ward}
              </span>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'block', marginBottom: '0.2rem' }}>
                Approximate Location
              </span>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-primary)' }}>
                <MapPin size={14} color="#f87171" />
                {proposal.approximateLocation}
              </span>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'block', marginBottom: '0.2rem' }}>
                Estimated Cost Range
              </span>
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--accent-main, #38bdf8)' }}>
                {formatCurrency(proposal.costEstimateRange?.min)} - {formatCurrency(proposal.costEstimateRange?.max)}
              </span>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'block', marginBottom: '0.2rem' }}>
                Submitted By
              </span>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {proposal.submittedBy?.displayName || 'Ward Resident'}
              </span>
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: '1.25rem' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
              Public Utility &amp; Scope of Works
            </h4>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              {proposal.description}
            </p>
            {proposal.costEstimateRange?.basis && (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: '0.4rem', fontStyle: 'italic' }}>
                Cost Basis: {proposal.costEstimateRange.basis}
              </p>
            )}
          </div>

          {/* Supporting Evidence Documents */}
          {proposal.supportingEvidence && proposal.supportingEvidence.length > 0 && (
            <div style={{ marginBottom: '1.25rem' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
                Supporting Evidence &amp; Survey Notes
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {proposal.supportingEvidence.map((ev) => (
                  <li
                    key={ev.id || ev.label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.6rem 0.85rem',
                      borderRadius: '0.375rem',
                      background: 'var(--bg-tag, #1c1c22)',
                      border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
                      fontSize: '0.85rem',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <FileText size={16} color="var(--accent-main, #38bdf8)" />
                      <span>{ev.label}</span>
                    </div>
                    {ev.sourceUrl && (
                      <a
                        href={ev.sourceUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', color: 'var(--accent-main, #38bdf8)', fontSize: '0.8rem' }}
                      >
                        View Document <ExternalLink size={12} />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Official Decisions History */}
          {decisions.length > 0 && (
            <div
              style={{
                marginBottom: '1.25rem',
                padding: '1rem',
                borderRadius: '0.5rem',
                background: 'rgba(34, 197, 94, 0.12)',
                border: '1px solid rgba(34, 197, 94, 0.35)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                <ShieldCheck size={16} color="#4ade80" />
                <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: '#4ade80' }}>
                  Official Technical Review Decision
                </h4>
              </div>
              {decisions.map((d) => (
                <div key={d.id} style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                  <p style={{ margin: '0 0 0.25rem 0', lineHeight: 1.5 }}>{d.publicSummary}</p>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Reviewed on {new Date(d.decisionDate).toLocaleDateString()} by {d.reviewerRole}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Implementation Updates if Funded */}
          {updates.length > 0 && (
            <div
              style={{
                marginBottom: '1.25rem',
                padding: '1rem',
                borderRadius: '0.5rem',
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                <CheckCircle2 size={16} color="#38bdf8" />
                <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: '#38bdf8' }}>
                  Ground Implementation Tracking
                </h4>
              </div>
              {updates.map((u) => (
                <div key={u.id} style={{ marginBottom: '0.5rem', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                    <span>{u.milestoneTitle}</span>
                    <span>{u.progressPercent}% Complete</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.15)', borderRadius: '3px', margin: '0.25rem 0' }}>
                    <div style={{ width: `${u.progressPercent}%`, height: '100%', background: '#38bdf8', borderRadius: '3px' }} />
                  </div>
                  <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)' }}>{u.publicNotes}</p>
                </div>
              ))}
            </div>
          )}

          {/* Deliberation Thread */}
          <DeliberationThread
            proposalId={proposal.id}
            comments={comments}
            onAddComment={onAddComment}
          />
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
            background: 'var(--bg-tag, #1c1c22)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.85rem',
              }}
              onClick={() => onVoteClick(proposal)}
            >
              <ThumbsUp size={16} color={userVoteStatus ? '#86efac' : 'currentColor'} />
              <span>{userVoteStatus ? 'Advisory Vote Recorded' : 'Cast Advisory Vote'}</span>
            </button>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              ({proposal.metrics?.voteCount || 0} residents supporting)
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {isOfficial && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.85rem' }}
                onClick={() => onOpenReview(proposal)}
              >
                Official Scrutiny Action
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
