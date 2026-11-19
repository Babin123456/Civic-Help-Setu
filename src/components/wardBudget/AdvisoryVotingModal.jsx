import { useState } from 'react';
import { ThumbsUp, Shield, CheckCircle, AlertCircle } from 'lucide-react';

export default function AdvisoryVotingModal({
  isOpen,
  onClose,
  proposal,
  onConfirmVote,
  alreadyVoted = false,
  currentUser = {},
}) {
  const [citizenIdInput, setCitizenIdInput] = useState(currentUser.id || 'CIT-RESIDENT-01');
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  if (!isOpen || !proposal) return null;

  const handleVote = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const res = await onConfirmVote(proposal.id, citizenIdInput);
      setReceipt(res);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to record advisory vote.');
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
      aria-labelledby="voting-modal-title"
    >
      <div
        className="modal-content"
        style={{
          background: 'var(--bg-card, #121212)',
          color: 'var(--text-primary, #ffffff)',
          border: '1px solid var(--border-light, rgba(255, 255, 255, 0.15))',
          width: '100%',
          maxWidth: '520px',
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
            <ThumbsUp size={18} color="#38bdf8" />
            <h3 id="voting-modal-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Citizen Advisory Ballot
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-secondary)' }}
            aria-label="Close vote modal"
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '1.5rem' }}>
          {receipt ? (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <CheckCircle size={48} color="#4ade80" style={{ margin: '0 auto 0.75rem auto' }} />
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Advisory Vote Recorded!
              </h4>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Thank you for participating in your ward’s civic budgeting. Your endorsement has been verified with a cryptographic seal.
              </p>
              <div
                style={{
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  background: 'var(--bg-tag, #1c1c22)',
                  border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  marginBottom: '1rem',
                  wordBreak: 'break-all',
                  color: 'var(--text-primary)',
                }}
              >
                <div><strong>Ballot Receipt:</strong> {receipt.voteReceipt}</div>
                <div><strong>Voter Seal Hash:</strong> {receipt.voterHash}</div>
              </div>
              <button type="button" className="btn btn-primary" onClick={onClose} style={{ width: '100%' }}>
                Return to Proposals
              </button>
            </div>
          ) : (
            <form onSubmit={handleVote} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div
                style={{
                  padding: '0.85rem',
                  borderRadius: '0.5rem',
                  background: 'var(--bg-tag, #1c1c22)',
                  border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
                }}
              >
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Proposal Under Ballot
                </span>
                <h4 style={{ margin: '0.25rem 0', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {proposal.title}
                </h4>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {proposal.ward} • {proposal.approximateLocation}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(217, 119, 6, 0.15)',
                  border: '1px solid rgba(217, 119, 6, 0.35)',
                  color: '#fbbf24',
                  fontSize: '0.8rem',
                  lineHeight: 1.4,
                }}
              >
                <Shield size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Statutory Notice:</strong> Citizen voting on this platform is advisory to the Ward Committee under Section 13B of the Municipal Corporation Act. Final resource allocation is subject to statutory technical audit.
                </div>
              </div>

              {alreadyVoted ? (
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '0.5rem',
                    background: 'rgba(34, 197, 94, 0.15)',
                    border: '1px solid rgba(34, 197, 94, 0.35)',
                    color: '#4ade80',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <CheckCircle size={16} />
                  <span>You have already cast your advisory vote for this proposal.</span>
                </div>
              ) : (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
                      Citizen Voter Identifier / EPIC Registration
                    </label>
                    <input
                      type="text"
                      value={citizenIdInput}
                      onChange={(e) => setCitizenIdInput(e.target.value)}
                      placeholder="e.g. EPIC Voter ID / Registered Citizen ID"
                      required
                      style={{
                        width: '100%',
                        padding: '0.6rem',
                        borderRadius: '0.5rem',
                        background: 'var(--bg-surface, #0e0e11)',
                        color: 'var(--text-primary, #ffffff)',
                        border: '1px solid var(--border-main, rgba(255, 255, 255, 0.15))',
                      }}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                      Used strictly to create a salted one-way hash preventing ballot manipulation. Never exposed publicly.
                    </span>
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
                    <button
                      type="submit"
                      disabled={submitting || !citizenIdInput.trim()}
                      className="btn btn-primary"
                    >
                      {submitting ? 'Recording Vote...' : 'Confirm Advisory Vote'}
                    </button>
                  </div>
                </>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
