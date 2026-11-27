import {
  MapPin,
  ThumbsUp,
  MessageSquare,
  AlertTriangle,
  Layers,
} from 'lucide-react';
import { PROPOSAL_CATEGORIES, PROPOSAL_STATUSES } from '../../data/wardBudgetContract.js';

export default function ProposalCard({
  proposal,
  onSelect,
  onVoteClick,
  userVoteStatus = false,
  formatCurrency = (num) => `₹${num?.toLocaleString('en-IN')}`,
}) {
  const categoryInfo = PROPOSAL_CATEGORIES[proposal.category] || {
    label: proposal.category,
    description: '',
  };
  const statusInfo = PROPOSAL_STATUSES[proposal.status] || {
    label: proposal.status,
    badgeClass: 'badge-secondary',
  };

  const isDuplicate = proposal.status === 'consolidated_duplicate';

  return (
    <article
      tabIndex="0"
      className="card proposal-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '1.25rem',
        border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
        borderRadius: '0.75rem',
        background: 'var(--bg-card, #121212)',
        color: 'var(--text-primary)',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
        cursor: 'pointer',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
      onClick={() => onSelect(proposal)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(proposal);
        }
      }}
      aria-label={`Ward Proposal: ${proposal.title}. Category: ${categoryInfo.label}. Status: ${statusInfo.label}`}
    >
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <span
            className="category-pill"
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
            className={`status-pill ${statusInfo.badgeClass}`}
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              padding: '0.2rem 0.6rem',
              borderRadius: '0.375rem',
              background: isDuplicate ? 'rgba(217, 119, 6, 0.15)' : 'var(--bg-tag, #1c1c22)',
              color: isDuplicate ? '#fbbf24' : 'var(--text-secondary, #a1a1aa)',
              border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            {isDuplicate && <Layers size={12} />}
            {statusInfo.label}
          </span>
        </div>

        <h3
          style={{
            fontSize: '1.05rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: '0.25rem 0 0.5rem 0',
            lineHeight: 1.35,
          }}
        >
          {proposal.title}
        </h3>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            color: 'var(--text-tertiary, #71717a)',
            fontSize: '0.8rem',
            marginBottom: '0.75rem',
          }}
        >
          <MapPin size={14} color="#f87171" aria-hidden="true" />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {proposal.approximateLocation}
          </span>
        </div>

        <p
          style={{
            fontSize: '0.875rem',
            color: 'var(--text-secondary, #a1a1aa)',
            margin: '0 0 1rem 0',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: 1.5,
          }}
        >
          {proposal.summary || proposal.description}
        </p>

        {isDuplicate && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.4rem 0.6rem',
              borderRadius: '0.375rem',
              background: 'rgba(217, 119, 6, 0.15)',
              border: '1px solid rgba(217, 119, 6, 0.35)',
              color: '#fbbf24',
              fontSize: '0.75rem',
              marginBottom: '0.75rem',
            }}
          >
            <AlertTriangle size={14} />
            <span>Merged with canonical proposal {proposal.canonicalProposalId}</span>
          </div>
        )}
      </div>

      <div
        style={{
          borderTop: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
          paddingTop: '0.75rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary, #71717a)', display: 'block' }}>
            Estimated Range
          </span>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-main, #38bdf8)' }}>
            {formatCurrency(proposal.costEstimateRange?.min)} - {formatCurrency(proposal.costEstimateRange?.max)}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}
            title={`${proposal.metrics?.commentCount || 0} public comments`}
          >
            <MessageSquare size={14} />
            {proposal.metrics?.commentCount || 0}
          </span>

          <button
            type="button"
            className="btn btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.3rem 0.6rem',
              fontSize: '0.8rem',
              borderRadius: '0.375rem',
            }}
            onClick={(e) => {
              e.stopPropagation();
              onVoteClick(proposal);
            }}
            aria-label={`Cast advisory vote for ${proposal.title}. Current votes: ${proposal.metrics?.voteCount || 0}`}
          >
            <ThumbsUp size={14} color={userVoteStatus ? '#4ade80' : 'currentColor'} />
            <span>{proposal.metrics?.voteCount || 0}</span>
          </button>
        </div>
      </div>
    </article>
  );
}
