/**
 * src/components/wardHeatmap/InterventionRecommendationsModal.jsx
 * Explainable municipal intervention recommendations with human-in-the-loop review (#763).
 */
import { useState } from 'react';
import { Sparkles, CheckCircle2, XCircle, Edit3, UserCheck, AlertCircle } from 'lucide-react';

export default function InterventionRecommendationsModal({
  recommendations = [],
  userRole = 'public',
  onReviewRecommendation,
}) {
  const [reviewingRecId, setReviewingRecId] = useState(null);
  const [reviewAction, setReviewAction] = useState('accepted');
  const [reviewNotes, setReviewNotes] = useState('');
  const [editedText, setEditedText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const isAuthorized = ['operator', 'admin'].includes(userRole);

  const startReview = (rec, action) => {
    setReviewingRecId(rec.id);
    setReviewAction(action);
    setEditedText(rec.recommendation);
    setReviewNotes('');
    setErrorMessage('');
  };

  const handleConfirmReview = () => {
    if (!reviewNotes || reviewNotes.trim().length < 5) {
      setErrorMessage('Please provide an operational review note (minimum 5 characters).');
      return;
    }

    try {
      onReviewRecommendation(reviewingRecId, {
        status: reviewAction,
        notes: reviewNotes,
        modifiedIntervention: reviewAction === 'accepted' ? editedText : null,
      });
      setReviewingRecId(null);
      setErrorMessage('');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to submit review.');
    }
  };

  return (
    <section
      aria-labelledby="recommendations-heading"
      className="glass-panel"
      style={{
        borderRadius: '1rem',
        padding: '1.5rem',
        marginBottom: '1.5rem',
        border: '1px solid var(--border-light)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-main)' }}>
            <Sparkles size={20} />
            <h3 id="recommendations-heading" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
              Automated Explainable Intervention Recommendations
            </h3>
          </div>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Heuristic-driven actionable recommendations grounded in recurrence spikes and seasonal patterns. Human-in-the-loop verified.
          </p>
        </div>

        <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
          {isAuthorized ? (
            <span style={{ color: '#16a34a', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <UserCheck size={14} /> Review Authority Enabled ({userRole})
            </span>
          ) : (
            <span>Read-Only Public Citizen View</span>
          )}
        </div>
      </div>

      {recommendations.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          No active intervention recommendations for current filters.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {recommendations.map((rec) => {
            const isPending = rec.status === 'pending';
            const isAccepted = rec.status === 'accepted';
            const isRejected = rec.status === 'rejected';

            return (
              <div
                key={rec.id}
                style={{
                  padding: '1.25rem',
                  borderRadius: '0.75rem',
                  background: 'var(--bg-card)',
                  border: isPending
                    ? '1px solid rgba(245, 158, 11, 0.4)'
                    : isAccepted
                    ? '1px solid rgba(34, 197, 94, 0.4)'
                    : '1px solid var(--border-light)',
                }}
              >
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div>
                    <span
                      style={{
                        fontSize: '0.725rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '0.25rem',
                        marginRight: '0.5rem',
                        background:
                          rec.urgency === 'urgent'
                            ? 'rgba(239, 68, 68, 0.15)'
                            : rec.urgency === 'elevated'
                            ? 'rgba(245, 158, 11, 0.15)'
                            : 'rgba(56, 189, 248, 0.15)',
                        color:
                          rec.urgency === 'urgent'
                            ? '#ef4444'
                            : rec.urgency === 'elevated'
                            ? '#f59e0b'
                            : 'var(--accent-main)',
                      }}
                    >
                      {rec.urgency} Urgency
                    </span>
                    <strong style={{ fontSize: '0.95rem' }}>{rec.title}</strong>
                  </div>

                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      padding: '0.2rem 0.6rem',
                      borderRadius: '99px',
                      background: isAccepted
                        ? 'rgba(34, 197, 94, 0.15)'
                        : isRejected
                        ? 'rgba(239, 68, 68, 0.15)'
                        : 'rgba(245, 158, 11, 0.15)',
                      color: isAccepted ? '#16a34a' : isRejected ? '#ef4444' : '#f59e0b',
                    }}
                  >
                    Status: {rec.status.toUpperCase()}
                  </span>
                </div>

                {/* Ward & Category details */}
                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '0.75rem' }}>
                  Target: <strong>{rec.wardName}</strong> ({rec.wardId}) &bull; Category: {rec.category} &bull; Ruleset: {rec.rulesetVersion}
                </div>

                {/* Recommendation proposal text */}
                <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  {rec.recommendation}
                </p>

                {/* Explainability Card */}
                <div
                  style={{
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    background: 'rgba(56, 189, 248, 0.05)',
                    border: '1px solid rgba(56, 189, 248, 0.2)',
                    fontSize: '0.8rem',
                    marginBottom: '0.75rem',
                  }}
                >
                  <div style={{ fontWeight: 600, color: 'var(--accent-main)', marginBottom: '0.25rem' }}>
                    Why this was recommended:
                  </div>
                  <div style={{ color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>{rec.whyProduced}</div>
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Model inputs:</span>
                    {rec.influencedBy.map((inf) => (
                      <span
                        key={inf}
                        style={{
                          fontSize: '0.7rem',
                          background: 'var(--border-light)',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '0.25rem',
                        }}
                      >
                        {inf}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Audit trail if already reviewed */}
                {rec.reviewedBy && (
                  <div style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontStyle: 'italic' }}>
                    Reviewed by <strong>{rec.reviewedBy}</strong> on {new Date(rec.reviewedAt).toLocaleDateString()}. Notes: "{rec.reviewNotes}"
                  </div>
                )}

                {/* Human-in-the-loop Action Buttons (for authorized staff) */}
                {isAuthorized && isPending && reviewingRecId !== rec.id && (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                    <button
                      type="button"
                      onClick={() => startReview(rec, 'accepted')}
                      className="btn btn-primary"
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <CheckCircle2 size={14} /> Accept Intervention
                    </button>
                    <button
                      type="button"
                      onClick={() => startReview(rec, 'accepted')}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <Edit3 size={14} /> Edit &amp; Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => startReview(rec, 'rejected')}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#ef4444' }}
                    >
                      <XCircle size={14} /> Reject
                    </button>
                  </div>
                )}

                {/* Review Form Drawer */}
                {reviewingRecId === rec.id && (
                  <div
                    style={{
                      marginTop: '0.75rem',
                      padding: '1rem',
                      borderRadius: '0.5rem',
                      background: 'var(--bg-main)',
                      border: '1px solid var(--accent-main)',
                    }}
                  >
                    <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem' }}>
                      {reviewAction === 'accepted' ? 'Confirm Intervention Acceptance' : 'Reject Recommendation'}
                    </h5>

                    {reviewAction === 'accepted' && (
                      <div style={{ marginBottom: '0.75rem' }}>
                        <label htmlFor="edit-intervention-text" style={{ fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>
                          Intervention Scope (optional edit):
                        </label>
                        <textarea
                          id="edit-intervention-text"
                          rows={2}
                          value={editedText}
                          onChange={(e) => setEditedText(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.5rem',
                            borderRadius: '0.4rem',
                            border: '1px solid var(--border-light)',
                            background: 'var(--bg-card)',
                            color: 'var(--text-primary)',
                            fontSize: '0.825rem',
                          }}
                        />
                      </div>
                    )}

                    <div style={{ marginBottom: '0.75rem' }}>
                      <label htmlFor="review-notes-input" style={{ fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>
                        Operational Justification &amp; Notes (Required):
                      </label>
                      <input
                        id="review-notes-input"
                        type="text"
                        placeholder="e.g. Verified with junior engineer, works scheduled for next shift."
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.45rem',
                          borderRadius: '0.4rem',
                          border: '1px solid var(--border-light)',
                          background: 'var(--bg-card)',
                          color: 'var(--text-primary)',
                          fontSize: '0.825rem',
                        }}
                      />
                    </div>

                    {errorMessage && (
                      <div style={{ color: '#ef4444', fontSize: '0.75rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <AlertCircle size={13} /> {errorMessage}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={handleConfirmReview}
                        className="btn btn-primary"
                        style={{ fontSize: '0.775rem', padding: '0.35rem 0.75rem' }}
                      >
                        Submit Review Decision
                      </button>
                      <button
                        type="button"
                        onClick={() => setReviewingRecId(null)}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.775rem', padding: '0.35rem 0.75rem' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
