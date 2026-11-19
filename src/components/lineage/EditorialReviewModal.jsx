import { useState, useRef } from 'react';
import { X, ShieldCheck, Check } from 'lucide-react';
import { REVIEW_DECISIONS } from '../../data/provenanceContract';

const EditorialReviewDialog = ({ onClose, targetEntityId, onSaveReview, currentReview = null }) => {
  const [decision, setDecision] = useState(currentReview?.reviewDecision || REVIEW_DECISIONS.APPROVED);
  const [isOverride, setIsOverride] = useState(currentReview?.isOverride || false);
  const [overrideReason, setOverrideReason] = useState(currentReview?.overrideReason || '');
  const [publicNotes, setPublicNotes] = useState(currentReview?.publicNotes || '');
  const [privateNotes, setPrivateNotes] = useState(currentReview?.privateNotes || '');
  const [statutoryDate, setStatutoryDate] = useState(currentReview?.statutoryEffectiveDate || '2026-10-25');
  const [error, setError] = useState(null);

  const modalRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);

    if (isOverride && (!overrideReason || overrideReason.trim().length < 5)) {
      setError('A detailed override justification (at least 5 characters) is required when manual override is enabled.');
      return;
    }

    try {
      onSaveReview({
        targetEntityId,
        reviewDecision: decision,
        isOverride,
        overrideReason: isOverride ? overrideReason.trim() : null,
        publicNotes: publicNotes.trim(),
        privateNotes: privateNotes.trim(),
        statutoryEffectiveDate: statutoryDate,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to record review.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="editorial-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1060,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="card"
        style={{
          width: '100%',
          maxWidth: '600px',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--bg-card)',
          borderRadius: '12px',
          padding: '1.5rem',
          position: 'relative',
          border: '1px solid var(--border-light)',
          outline: 'none',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h2 id="editorial-modal-title" style={{ fontSize: '1.25rem', margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <ShieldCheck size={20} color="var(--accent-main)" />
              Editorial Review & Verification
            </h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: '0.2rem' }}>
              Target Fact: <code>{targetEntityId}</code>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn btn-secondary" style={{ padding: '0.4rem', borderRadius: '50%' }}>
            <X size={18} />
          </button>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              padding: '0.75rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid #ef4444',
              borderRadius: '6px',
              color: '#ef4444',
              fontSize: '0.85rem',
              marginBottom: '1rem',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Review Decision
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
              {[
                { val: REVIEW_DECISIONS.APPROVED, label: 'Approved', color: '#10b981' },
                { val: REVIEW_DECISIONS.AMENDED, label: 'Amended', color: '#6366f1' },
                { val: REVIEW_DECISIONS.FLAGGED, label: 'Flagged', color: '#f59e0b' },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setDecision(opt.val)}
                  style={{
                    padding: '0.65rem 0.5rem',
                    borderRadius: '6px',
                    border: `2px solid ${decision === opt.val ? opt.color : 'var(--border-light)'}`,
                    background: decision === opt.val ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-card)',
                    color: decision === opt.val ? opt.color : 'var(--text-primary)',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.25rem' }}>
            <input
              type="checkbox"
              id="isOverride"
              checked={isOverride}
              onChange={(e) => setIsOverride(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: 'var(--accent-main)' }}
            />
            <label htmlFor="isOverride" style={{ fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
              Manual Human Override (replaces automated parser output)
            </label>
          </div>

          {isOverride && (
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: '#d97706' }}>
                Override Justification (Mandatory for audit trail) *
              </label>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Cite the specific gazette notification, circular amendment, or high court ruling..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  borderRadius: '6px',
                  background: 'var(--bg-card)',
                  border: '1px solid rgba(245, 158, 11, 0.5)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                }}
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Statutory Effective Date
            </label>
            <input
              type="date"
              value={statutoryDate}
              onChange={(e) => setStatutoryDate(e.target.value)}
              style={{
                width: '100%',
                padding: '0.6rem',
                borderRadius: '6px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Public Citation & Verification Notes
            </label>
            <input
              type="text"
              value={publicNotes}
              onChange={(e) => setPublicNotes(e.target.value)}
              placeholder="e.g. Cross-checked with Section 9(3) of Preservation of Trees Act"
              style={{
                width: '100%',
                padding: '0.6rem',
                borderRadius: '6px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Private Reviewer Deliberation Notes (Operators/Admins only)
            </label>
            <textarea
              value={privateNotes}
              onChange={(e) => setPrivateNotes(e.target.value)}
              placeholder="Internal operator notes. Kept confidential and never exposed in public APIs."
              rows={2}
              style={{
                width: '100%',
                padding: '0.6rem',
                borderRadius: '6px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <Check size={16} />
              Save Review Decision
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const EditorialReviewModal = ({ isOpen, onClose, targetEntityId, onSaveReview, currentReview = null }) => {
  if (!isOpen) return null;
  return (
    <EditorialReviewDialog
      onClose={onClose}
      targetEntityId={targetEntityId}
      onSaveReview={onSaveReview}
      currentReview={currentReview}
    />
  );
};

export default EditorialReviewModal;
