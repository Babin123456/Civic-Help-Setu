import { useState, useCallback } from 'react';
import {
  GitPullRequest,
  CheckCircle2,
  XCircle,
  RotateCcw,
  AlertTriangle,
  WifiOff,
  ExternalLink,
  FileDiff,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import {
  PROVENANCE_LABELS,
  listLocalProposals,
  submitLocalProposal,
  reviewLocalProposal,
  rollbackLocalProposal,
} from '../services/civicContributionPipelineService';

const STATUS_BADGE = {
  PENDING_REVIEW: { bg: '#fef9c3', color: '#854d0e' },
  PUBLISHED: { bg: '#dcfce7', color: '#166534' },
  REJECTED: { bg: '#fee2e2', color: '#991b1b' },
  ROLLED_BACK: { bg: '#f1f5f9', color: '#475569' },
};

export default function CivicContributionPipelineWorkspace() {
  const { user } = useAuth();
  const { isOnline } = useNetwork();
  const currentUserId = user?.id || 'contributor_local';

  const [proposals, setProposals] = useState(() => {
    try {
      return listLocalProposals();
    } catch {
      return [];
    }
  });
  const [targetEntityId, setTargetEntityId] = useState('delhi-south-collectorate');
  const [currentHours, setCurrentHours] = useState('09:30 AM - 05:30 PM');
  const [proposedHours, setProposedHours] = useState('09:30 AM - 06:00 PM');
  const [sourceUrl, setSourceUrl] = useState('https://edistrict.delhigovt.nic.in');
  const [rationale, setRationale] = useState('');
  const [rejectionReasons, setRejectionReasons] = useState({});
  const [errorMsg, setErrorMsg] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [isLoading] = useState(false);

  const refresh = useCallback(() => {
    try {
      setProposals(listLocalProposals());
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load proposals.');
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const created = submitLocalProposal({
        targetEntityId: targetEntityId.trim(),
        contributorId: currentUserId,
        beforeFields: { officeHours: currentHours },
        proposedFields: { officeHours: proposedHours.trim() },
        sourceUrl,
        rationale: rationale.trim() || 'Updated office closing hours per circular',
        provenanceKind: 'community_suggestion',
      });
      setRationale('');
      refresh();
      setAnnouncement(`Submitted proposal ${created.proposalId} for human review.`);
    } catch (err) {
      setErrorMsg(err.message || 'Proposal submission failed.');
    }
  };

  const handleReview = (proposalId, decision) => {
    setErrorMsg('');
    try {
      const publisherId = user?.id && user.id !== proposals.find((p) => p.proposalId === proposalId)?.contributorId
        ? user.id
        : 'publisher_reviewer_1';
      reviewLocalProposal({
        proposalId,
        publisherId,
        decision,
        rejectionReason: rejectionReasons[proposalId] || '',
      });
      refresh();
      setAnnouncement(`Proposal ${proposalId} ${decision === 'PUBLISH' ? 'published' : 'rejected'}.`);
    } catch (err) {
      setErrorMsg(err.message || 'Review action failed.');
    }
  };

  const handleRollback = (proposalId) => {
    setErrorMsg('');
    try {
      rollbackLocalProposal({
        proposalId,
        publisherId: user?.id || 'publisher_reviewer_1',
        reason: 'Rolled back after post-publish verification check',
      });
      refresh();
      setAnnouncement(`Proposal ${proposalId} rolled back.`);
    } catch (err) {
      setErrorMsg(err.message || 'Rollback failed.');
    }
  };

  return (
    <div className="section" style={{ padding: '1.5rem 1rem', maxWidth: '1150px', margin: '0 auto' }}>
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>

      <header style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-main, #e2e8f0)', paddingBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <GitPullRequest size={28} color="var(--primary, #2563eb)" aria-hidden="true" />
          Human-Reviewed Civic Data Contribution Pipeline
        </h1>
        <p style={{ margin: '0.35rem 0 0', color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          Submit field-level civic data proposals with official HTTPS sources. Separate reviewers/publishers approve, reject with reasons, or roll back changes with immutable audit history.
        </p>
      </header>

      {!isOnline && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderRadius: '0.5rem', background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.4)', marginBottom: '1rem', fontSize: '0.88rem' }}>
          <WifiOff size={16} aria-hidden="true" />
          <span>Offline mode: proposals are staged locally until reconnection.</span>
        </div>
      )}

      {errorMsg && (
        <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderRadius: '0.5rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', color: '#b91c1c', marginBottom: '1rem', fontSize: '0.88rem' }}>
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {/* Left: Contributor Proposal Form */}
        <section aria-label="Submit Contribution Proposal" style={{ padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid var(--border-main, #e2e8f0)', background: 'var(--bg-card, #fff)' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <FileDiff size={18} aria-hidden="true" />
            Propose Field-Level Edit
          </h2>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <div>
              <label htmlFor="prop-entity" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                Target Civic Record ID
              </label>
              <input
                id="prop-entity"
                type="text"
                value={targetEntityId}
                onChange={(e) => setTargetEntityId(e.target.value)}
                style={{ width: '100%', padding: '0.45rem 0.7rem', borderRadius: '0.4rem', border: '1px solid var(--border-main, #cbd5e1)' }}
              />
            </div>

            <div>
              <label htmlFor="prop-before" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                Current Value (Office Hours)
              </label>
              <input
                id="prop-before"
                type="text"
                value={currentHours}
                onChange={(e) => setCurrentHours(e.target.value)}
                style={{ width: '100%', padding: '0.45rem 0.7rem', borderRadius: '0.4rem', border: '1px solid var(--border-main, #cbd5e1)' }}
              />
            </div>

            <div>
              <label htmlFor="prop-after" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                Proposed Value (Office Hours)
              </label>
              <input
                id="prop-after"
                type="text"
                value={proposedHours}
                onChange={(e) => setProposedHours(e.target.value)}
                style={{ width: '100%', padding: '0.45rem 0.7rem', borderRadius: '0.4rem', border: '1px solid var(--border-main, #cbd5e1)' }}
              />
            </div>

            <div>
              <label htmlFor="prop-source" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                Official Source Attachment (https:// required)
              </label>
              <input
                id="prop-source"
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                style={{ width: '100%', padding: '0.45rem 0.7rem', borderRadius: '0.4rem', border: '1px solid var(--border-main, #cbd5e1)' }}
              />
            </div>

            <div>
              <label htmlFor="prop-rationale" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                Change Rationale (no PII)
              </label>
              <input
                id="prop-rationale"
                type="text"
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                placeholder="e.g. Updated per District Gazette circular"
                style={{ width: '100%', padding: '0.45rem 0.7rem', borderRadius: '0.4rem', border: '1px solid var(--border-main, #cbd5e1)' }}
              />
            </div>

            <button type="submit" style={{ padding: '0.55rem 1rem', borderRadius: '0.5rem', border: 'none', background: 'var(--primary, #2563eb)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
              Submit for Human Review
            </button>
          </form>
        </section>

        {/* Right: Review & Publish Queue */}
        <section aria-label="Proposal Review Queue" style={{ padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid var(--border-main, #e2e8f0)', background: 'var(--bg-card, #fff)' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem 0' }}>
            Review &amp; Publish Queue ({proposals.length})
          </h2>

          {isLoading ? (
            <p role="status">Loading proposals...</p>
          ) : proposals.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <p style={{ margin: 0, fontWeight: 600 }}>No Pending Contribution Proposals</p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
                Proposals submitted on the left will appear here with field-level diffs for independent publisher review.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {proposals.map((p) => {
                const st = STATUS_BADGE[p.status] || STATUS_BADGE.PENDING_REVIEW;
                return (
                  <div key={p.proposalId} style={{ padding: '0.85rem', borderRadius: '0.5rem', border: '1px solid var(--border-light, #e2e8f0)', fontSize: '0.82rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <strong>{p.targetEntityId}</strong>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.45rem', borderRadius: '999px', background: '#f3e8ff', color: '#6b21a8', fontWeight: 600 }}>
                          {PROVENANCE_LABELS[p.provenanceKind] || p.provenanceKind}
                        </span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '999px', background: st.bg, color: st.color }}>
                          {p.status}
                        </span>
                      </div>
                    </div>

                    <div style={{ marginTop: '0.45rem', padding: '0.45rem', borderRadius: '0.35rem', background: 'rgba(0,0,0,0.02)', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {p.fieldDiffs.map((d) => (
                        <div key={d.field}>
                          <strong>{d.field}:</strong> <span style={{ color: '#b91c1c' }}>- {String(d.before)}</span> &rarr; <span style={{ color: '#15803d' }}>+ {String(d.after)}</span>
                        </div>
                      ))}
                    </div>

                    <div style={{ marginTop: '0.35rem', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                      Source:{' '}
                      <a href={p.sourceAttachment.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary, #2563eb)' }}>
                        {p.sourceAttachment.sourceUrl} <ExternalLink size={11} style={{ display: 'inline' }} />
                      </a>
                    </div>

                    {p.rejectionReason && (
                      <div style={{ marginTop: '0.3rem', color: '#991b1b', fontSize: '0.76rem' }}>
                        <strong>Rejection Reason:</strong> {p.rejectionReason}
                      </div>
                    )}

                    {p.status === 'PENDING_REVIEW' && (
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                        <input
                          type="text"
                          aria-label={`Rejection reason for ${p.proposalId}`}
                          placeholder="Rejection reason (required if rejecting)"
                          value={rejectionReasons[p.proposalId] || ''}
                          onChange={(e) => setRejectionReasons((prev) => ({ ...prev, [p.proposalId]: e.target.value }))}
                          style={{ flex: '1 1 160px', padding: '0.25rem 0.5rem', borderRadius: '0.3rem', border: '1px solid var(--border-main, #cbd5e1)', fontSize: '0.75rem' }}
                        />
                        <button
                          type="button"
                          onClick={() => handleReview(p.proposalId, 'PUBLISH')}
                          style={{ padding: '0.25rem 0.6rem', borderRadius: '0.3rem', border: 'none', background: '#16a34a', color: '#fff', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                        >
                          <CheckCircle2 size={12} aria-hidden="true" /> Approve &amp; Publish
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReview(p.proposalId, 'REJECT')}
                          style={{ padding: '0.25rem 0.6rem', borderRadius: '0.3rem', border: 'none', background: '#dc2626', color: '#fff', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                        >
                          <XCircle size={12} aria-hidden="true" /> Reject
                        </button>
                      </div>
                    )}

                    {p.status === 'PUBLISHED' && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => handleRollback(p.proposalId)}
                          style={{ padding: '0.25rem 0.6rem', borderRadius: '0.3rem', border: '1px solid #475569', background: 'transparent', color: '#475569', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                          <RotateCcw size={12} aria-hidden="true" /> Rollback Published Edit
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

