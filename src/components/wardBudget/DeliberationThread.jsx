import { useState } from 'react';
import { MessageSquare, Send, AlertCircle, ShieldCheck, User } from 'lucide-react';
import { checkForForbiddenPII } from '../../data/wardBudgetContract.js';

export default function DeliberationThread({
  proposalId,
  comments = [],
  onAddComment,
}) {
  const [newCommentText, setNewCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmed = newCommentText.trim();
    if (!trimmed || trimmed.length < 5) {
      setErrorMsg('Comment must be at least 5 characters long.');
      return;
    }
    if (trimmed.length > 800) {
      setErrorMsg('Comment cannot exceed 800 characters.');
      return;
    }

    const piiWarning = checkForForbiddenPII(trimmed);
    if (piiWarning) {
      setErrorMsg(`Private info detected (${piiWarning}). Please do not post phone numbers, Aadhaar, or emails in public deliberation.`);
      return;
    }

    setSubmitting(true);
    try {
      onAddComment({
        proposalId,
        content: trimmed,
      });
      setNewCommentText('');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to post comment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section aria-labelledby="deliberation-heading" style={{ marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <MessageSquare size={18} color="var(--accent-main, #38bdf8)" />
        <h4 id="deliberation-heading" style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Public Neighborhood Deliberation ({comments.length})
        </h4>
      </div>

      <div
        className="comment-list"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          maxHeight: '380px',
          overflowY: 'auto',
          paddingRight: '0.5rem',
          marginBottom: '1rem',
        }}
      >
        {comments.length === 0 ? (
          <div
            style={{
              padding: '1.5rem',
              textAlign: 'center',
              background: 'var(--bg-tag, #1c1c22)',
              borderRadius: '0.5rem',
              color: 'var(--text-secondary, #a1a1aa)',
              fontSize: '0.875rem',
              border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
            }}
          >
            No comments yet. Be the first neighbor or committee member to share constructive feedback!
          </div>
        ) : (
          comments.map((comment) => {
            const isOfficial = comment.author?.role === 'reviewer' || comment.author?.role === 'admin';
            return (
              <div
                key={comment.id}
                style={{
                  padding: '0.85rem',
                  borderRadius: '0.5rem',
                  background: isOfficial ? 'rgba(56, 189, 248, 0.12)' : 'var(--bg-tag, #1c1c22)',
                  border: isOfficial ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
                  marginLeft: comment.parentCommentId ? '1.5rem' : '0',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    {isOfficial ? <ShieldCheck size={14} color="#38bdf8" /> : <User size={14} color="#a1a1aa" />}
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: isOfficial ? 'var(--accent-main, #38bdf8)' : 'var(--text-primary)' }}>
                      {comment.author?.displayName || 'Resident'}
                    </span>
                    {isOfficial && (
                      <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8' }}>
                        Official Scrutiny
                      </span>
                    )}
                  </div>
                  <time style={{ fontSize: '0.75rem', color: 'var(--text-tertiary, #71717a)' }}>
                    {new Date(comment.createdAt).toLocaleDateString()}
                  </time>
                </div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary, #d4d4d8)', lineHeight: 1.5 }}>
                  {comment.content}
                </p>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label htmlFor="new-comment-input" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          Add Your Observation or Query:
        </label>
        <textarea
          id="new-comment-input"
          rows={3}
          value={newCommentText}
          onChange={(e) => setNewCommentText(e.target.value)}
          placeholder="Share your perspective on public utility, safety concerns, or ground realities (do NOT include personal phone or Aadhaar numbers)..."
          maxLength={800}
          style={{
            padding: '0.6rem',
            borderRadius: '0.5rem',
            border: '1px solid var(--border-light, rgba(255, 255, 255, 0.15))',
            fontSize: '0.85rem',
            resize: 'vertical',
            width: '100%',
            background: 'var(--bg-tag, #1c1c22)',
            color: 'var(--text-primary, #ffffff)',
          }}
        />

        {errorMsg && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              color: '#f87171',
              fontSize: '0.8rem',
              padding: '0.4rem 0.6rem',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '0.375rem',
            }}
          >
            <AlertCircle size={14} />
            <span>{errorMsg}</span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
            {newCommentText.length}/800 characters
          </span>
          <button
            type="submit"
            disabled={submitting || newCommentText.trim().length < 5}
            className="btn btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.85rem',
              padding: '0.4rem 0.8rem',
            }}
          >
            <Send size={14} />
            <span>{submitting ? 'Posting...' : 'Post Comment'}</span>
          </button>
        </div>
      </form>
    </section>
  );
}
