import { useState } from 'react';
import { ShieldCheck, AlertCircle } from 'lucide-react';

export default function ReviewQueueModal({
  isOpen,
  onClose,
  proposal,
  onSaveDecision,
  allProposals = [],
}) {
  const [decision, setDecision] = useState('approved_for_voting');
  const [canonicalProposalId, setCanonicalProposalId] = useState('');
  const [publicSummary, setPublicSummary] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  if (!isOpen || !proposal) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!publicSummary || publicSummary.trim().length < 15) {
      setErrorMsg('Public summary justifying the decision must be at least 15 characters.');
      return;
    }

    if (decision === 'merged_as_duplicate' && !canonicalProposalId) {
      setErrorMsg('Please select or specify the canonical primary proposal ID.');
      return;
    }

    setSubmitting(true);
    try {
      await onSaveDecision({
        proposalId: proposal.id,
        decision,
        canonicalProposalId: decision === 'merged_as_duplicate' ? canonicalProposalId : null,
        publicSummary: publicSummary.trim(),
        internalNotes: internalNotes.trim(),
      });
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to record decision.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1060,
        padding: '1rem',
        backdropFilter: 'blur(3px)',
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-modal-title"
    >
      <div
        className="modal-content"
        style={{
          background: 'var(--bg-card, #121212)',
          color: 'var(--text-primary, #ffffff)',
          border: '1px solid var(--border-light, rgba(255, 255, 255, 0.15))',
          width: '100%',
          maxWidth: '600px',
          borderRadius: '1rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={18} color="#38bdf8" />
            <h3 id="review-modal-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Official Technical Scrutiny Action
            </h3>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-secondary)' }}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700 }}>
              Evaluating Proposal
            </span>
            <h4 style={{ margin: '0.25rem 0', fontSize: '1rem', fontWeight: 700 }}>
              {proposal.title} ({proposal.id})
            </h4>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Current Status: <strong>{proposal.status}</strong>
            </span>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
              Review Decision *
            </label>
            <select
              value={decision}
              onChange={(e) => setDecision(e.target.value)}
              style={{
                width: '100%',
                padding: '0.6rem',
                borderRadius: '0.5rem',
                background: 'var(--bg-surface, #0e0e11)',
                color: 'var(--text-primary, #ffffff)',
                border: '1px solid var(--border-main, rgba(255, 255, 255, 0.15))',
              }}
            >
              <option value="approved_for_voting">Approved for Citizen Ballot (Eligible)</option>
              <option value="eligible">Eligible (Under Further Engineering Verification)</option>
              <option value="funded">Funded &amp; Allocated (Ward Committee Sanction)</option>
              <option value="technical_revision_needed">Revision Needed by Resident</option>
              <option value="merged_as_duplicate">Consolidate as Duplicate</option>
              <option value="ineligible">Ineligible (Outside Municipal Powers / Private Property)</option>
              <option value="rejected">Not Funded</option>
            </select>
          </div>

          {decision === 'merged_as_duplicate' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
                Canonical Primary Proposal ID *
              </label>
              <select
                value={canonicalProposalId}
                onChange={(e) => setCanonicalProposalId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  borderRadius: '0.5rem',
                  background: 'var(--bg-surface, #0e0e11)',
                  color: 'var(--text-primary, #ffffff)',
                  border: '1px solid var(--border-main, rgba(255, 255, 255, 0.15))',
                }}
              >
                <option value="">-- Select Canonical Proposal --</option>
                {allProposals
                  .filter((p) => p.id !== proposal.id && p.status !== 'consolidated_duplicate')
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id}: {p.title}
                    </option>
                  ))}
              </select>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
              Public Summary Justification * (Visible to residents)
            </label>
            <textarea
              rows={3}
              value={publicSummary}
              onChange={(e) => setPublicSummary(e.target.value)}
              placeholder="e.g. Technical review confirms road width meets IRC norms. Estimate matches schedule of rates. Passed for ballot."
              maxLength={1000}
              required
              style={{
                width: '100%',
                padding: '0.6rem',
                borderRadius: '0.5rem',
                background: 'var(--bg-surface, #0e0e11)',
                color: 'var(--text-primary, #ffffff)',
                border: '1px solid var(--border-main, rgba(255, 255, 255, 0.15))',
                resize: 'vertical',
              }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Minimum 15 characters</span>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
              Internal Engineering Notes (Confidential to committee)
            </label>
            <textarea
              rows={2}
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Administrative scrutiny notes, utility clearances, or department comments..."
              maxLength={1000}
              style={{
                width: '100%',
                padding: '0.6rem',
                borderRadius: '0.5rem',
                background: 'var(--bg-surface, #0e0e11)',
                color: 'var(--text-primary, #ffffff)',
                border: '1px solid var(--border-main, rgba(255, 255, 255, 0.15))',
                resize: 'vertical',
              }}
            />
          </div>

          {errorMsg && (
            <div
              style={{
                padding: '0.6rem',
                borderRadius: '0.375rem',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#f87171',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <AlertCircle size={14} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn btn-primary">
              {submitting ? 'Recording Decision...' : 'Record Decision & Transition State'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
