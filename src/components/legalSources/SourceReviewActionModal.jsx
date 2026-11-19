import { useState } from 'react';
import {
  X,
  FileCheck,
  AlertTriangle,
  RotateCcw,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';
import {
  incrementVersion,
} from '../../services/legalSourceService.js';

export default function SourceReviewActionModal({
  source,
  actionType = 'review', // 'review' | 'supersede' | 'rollback'
  allSources = [],
  onClose,
  onSubmit,
  canReview = false,
}) {
  const [reviewerNotes, setReviewerNotes] = useState(
    'Statutory citation and gazette provision verified against official gazette.'
  );
  const [nextVersion, setNextVersion] = useState(
    source?.status === 'DRAFT'
      ? source.currentVersion === '0.1.0'
        ? '1.0.0'
        : source.currentVersion
      : incrementVersion(source?.currentVersion || '1.0.0', 'minor')
  );
  const [replacementSourceId, setReplacementSourceId] = useState('');
  const [supersededReason, setSupersededReason] = useState(
    'Statutory provision amended or repealed by later enactment.'
  );
  const [targetVersion, setTargetVersion] = useState(
    source?.versionHistory?.[0]?.version || ''
  );
  const [rollbackReason, setRollbackReason] = useState(
    'Restoring previous verified statutory wording.'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!source) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (actionType === 'review') {
        await onSubmit({
          type: 'review',
          sourceId: source.id,
          reviewerNotes,
          nextVersion,
        });
      } else if (actionType === 'supersede') {
        await onSubmit({
          type: 'supersede',
          sourceId: source.id,
          replacementSourceId: replacementSourceId || null,
          supersededReason,
        });
      } else if (actionType === 'rollback') {
        if (!targetVersion) {
          throw new Error('Please select a historical version to restore.');
        }
        await onSubmit({
          type: 'rollback',
          sourceId: source.id,
          targetVersion,
          rollbackReason,
        });
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getModalTitle = () => {
    switch (actionType) {
      case 'supersede':
        return `Supersede Legal Source: ${source.provision}`;
      case 'rollback':
        return `Rollback Version: ${source.provision}`;
      default:
        return `Review & Publish Legal Source: ${source.provision}`;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-action-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: 'var(--bg-modal, #1e293b)',
          borderRadius: '1rem',
          maxWidth: '600px',
          width: '100%',
          border: '1px solid var(--border-light, #334155)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          color: 'var(--text-main, #f8fafc)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-light, #334155)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {actionType === 'review' && <FileCheck style={{ color: '#22c55e' }} size={20} />}
            {actionType === 'supersede' && <AlertTriangle style={{ color: '#ef4444' }} size={20} />}
            {actionType === 'rollback' && <RotateCcw style={{ color: '#eab308' }} size={20} />}
            <h2
              id="review-action-modal-title"
              style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#ffffff' }}
            >
              {getModalTitle()}
            </h2>
          </div>
          <button
            onClick={onClose}
            type="button"
            aria-label="Close review modal"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem', overflowY: 'auto' }}>
          {/* RBAC Warning if unauthorized */}
          {!canReview && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '0.5rem',
                padding: '0.75rem 1rem',
                marginBottom: '1rem',
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'center',
                color: '#ef4444',
                fontSize: '0.85rem',
              }}
            >
              <ShieldAlert size={18} style={{ flexShrink: 0 }} />
              <div>
                <strong>Privilege Check:</strong> You do not possess the required <code>admin</code> role
                (<code>legalSources.review</code> permission) to execute this statutory publication action.
              </div>
            </div>
          )}

          {error && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                marginBottom: '1rem',
                fontSize: '0.85rem',
              }}
            >
              {error}
            </div>
          )}

          {/* Context Info */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.6)',
              borderRadius: '0.5rem',
              padding: '0.75rem 1rem',
              marginBottom: '1.25rem',
              fontSize: '0.85rem',
              border: '1px solid #334155',
            }}
          >
            <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Source Under Review</div>
            <div style={{ fontWeight: 600, color: '#f8fafc', marginTop: '0.2rem' }}>{source.title}</div>
            <div style={{ color: '#cbd5e1', fontSize: '0.8rem', marginTop: '0.2rem' }}>
              Current Version: <code style={{ color: '#38bdf8' }}>v{source.currentVersion}</code> • Status:{' '}
              <span style={{ fontWeight: 600 }}>{source.status}</span>
            </div>
          </div>

          {/* Action Type 1: REVIEW_PUBLISH */}
          {actionType === 'review' && (
            <>
              <div style={{ marginBottom: '1rem' }}>
                <label
                  htmlFor="next-version-input"
                  style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}
                >
                  Published Version (SemVer)
                </label>
                <input
                  id="next-version-input"
                  type="text"
                  value={nextVersion}
                  onChange={(e) => setNextVersion(e.target.value)}
                  required
                  placeholder="e.g. 1.0.0 or 1.1.0"
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '0.5rem',
                    background: 'var(--bg-input, #0f172a)',
                    border: '1px solid var(--border-light, #334155)',
                    color: 'var(--text-main, #f8fafc)',
                    fontSize: '0.875rem',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label
                  htmlFor="reviewer-notes-input"
                  style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}
                >
                  Official Reviewer Notes / Gazette Certification
                </label>
                <textarea
                  id="reviewer-notes-input"
                  value={reviewerNotes}
                  onChange={(e) => setReviewerNotes(e.target.value)}
                  rows={3}
                  required
                  placeholder="Record verification against Gazette, notification date, and alignment..."
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '0.5rem',
                    background: 'var(--bg-input, #0f172a)',
                    border: '1px solid var(--border-light, #334155)',
                    color: 'var(--text-main, #f8fafc)',
                    fontSize: '0.875rem',
                    resize: 'vertical',
                  }}
                />
              </div>
            </>
          )}

          {/* Action Type 2: SUPERSEDE */}
          {actionType === 'supersede' && (
            <>
              <div style={{ marginBottom: '1rem' }}>
                <label
                  htmlFor="replacement-source-select"
                  style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}
                >
                  Replacement Legal Source (Optional)
                </label>
                <select
                  id="replacement-source-select"
                  value={replacementSourceId}
                  onChange={(e) => setReplacementSourceId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '0.5rem',
                    background: 'var(--bg-input, #0f172a)',
                    border: '1px solid var(--border-light, #334155)',
                    color: 'var(--text-main, #f8fafc)',
                    fontSize: '0.875rem',
                  }}
                >
                  <option value="">-- No direct replacement (Repealed) --</option>
                  {allSources
                    .filter((s) => s.id !== source.id && s.status === 'REVIEWED')
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.provision} - {s.title.slice(0, 50)}…
                      </option>
                    ))}
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label
                  htmlFor="superseded-reason-input"
                  style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}
                >
                  Statutory Reason for Supersession
                </label>
                <textarea
                  id="superseded-reason-input"
                  value={supersededReason}
                  onChange={(e) => setSupersededReason(e.target.value)}
                  rows={3}
                  required
                  placeholder="Detail repealing act, gazette notification number, or legal amendment..."
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '0.5rem',
                    background: 'var(--bg-input, #0f172a)',
                    border: '1px solid var(--border-light, #334155)',
                    color: 'var(--text-main, #f8fafc)',
                    fontSize: '0.875rem',
                    resize: 'vertical',
                  }}
                />
              </div>
            </>
          )}

          {/* Action Type 3: ROLLBACK */}
          {actionType === 'rollback' && (
            <>
              <div style={{ marginBottom: '1rem' }}>
                <label
                  htmlFor="rollback-target-select"
                  style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}
                >
                  Target Historical Revision to Restore
                </label>
                <select
                  id="rollback-target-select"
                  value={targetVersion}
                  onChange={(e) => setTargetVersion(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '0.5rem',
                    background: 'var(--bg-input, #0f172a)',
                    border: '1px solid var(--border-light, #334155)',
                    color: 'var(--text-main, #f8fafc)',
                    fontSize: '0.875rem',
                  }}
                >
                  {(source.versionHistory || []).map((h) => (
                    <option key={h.version} value={h.version}>
                      v{h.version} (Reviewed: {h.reviewedAt ? new Date(h.reviewedAt).toLocaleDateString() : 'N/A'}) -{' '}
                      {h.reviewerNotes?.slice(0, 40) || 'Historical revision'}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label
                  htmlFor="rollback-reason-input"
                  style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}
                >
                  Justification / High Court Precedent for Rollback
                </label>
                <textarea
                  id="rollback-reason-input"
                  value={rollbackReason}
                  onChange={(e) => setRollbackReason(e.target.value)}
                  rows={3}
                  required
                  placeholder="Explain why this statutory revision is being restored..."
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '0.5rem',
                    background: 'var(--bg-input, #0f172a)',
                    border: '1px solid var(--border-light, #334155)',
                    color: 'var(--text-main, #f8fafc)',
                    fontSize: '0.875rem',
                    resize: 'vertical',
                  }}
                />
              </div>
            </>
          )}

          {/* Buttons */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              marginTop: '1.5rem',
            }}
          >
            <button
              onClick={onClose}
              type="button"
              disabled={isSubmitting}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#f8fafc',
                border: 'none',
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canReview || isSubmitting}
              style={{
                padding: '0.5rem 1.25rem',
                borderRadius: '0.5rem',
                background:
                  actionType === 'supersede'
                    ? '#ef4444'
                    : actionType === 'rollback'
                    ? '#eab308'
                    : '#15803d',
                color: actionType === 'rollback' ? '#000000' : '#ffffff',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: !canReview || isSubmitting ? 'not-allowed' : 'pointer',
                opacity: !canReview || isSubmitting ? 0.6 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              {isSubmitting ? 'Processing...' : 'Confirm Statutory Transition'}
              <ArrowRight size={14} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
