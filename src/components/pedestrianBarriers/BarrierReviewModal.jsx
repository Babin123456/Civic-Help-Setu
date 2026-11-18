/**
 * src/components/pedestrianBarriers/BarrierReviewModal.jsx
 * Municipal staff verification and resolution queue modal for physical barrier observations (#757).
 */

import { useState } from 'react';
import {
  X,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import {
  BARRIER_TYPES,
} from '../../data/pedestrianBarrierContract.js';

export default function BarrierReviewModal({
  isOpen,
  onClose,
  observations = [],
  onVerify,
  onResolve,
  userRole = 'citizen',
}) {
  const [selectedObs, setSelectedObs] = useState(observations[0] || null);
  const [decisionAction, setDecisionAction] = useState('verify'); // 'verify' | 'reject' | 'resolve'
  const [reasonCode, setReasonCode] = useState('statutory_inspection_passed');
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const isStaff = ['operator', 'reviewer', 'admin'].includes(userRole);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedObs) return;
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      if (decisionAction === 'resolve') {
        await onResolve(selectedObs.id, {
          reasonCode: reasonCode || 'defect_rectified',
          reviewerNotes,
        });
      } else {
        await onVerify(selectedObs.id, {
          action: decisionAction,
          reasonCode,
          reviewerNotes,
        });
      }
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Operation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        padding: '1rem',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-modal-title"
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '740px',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--bg-card)',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          border: '1px solid var(--border-light)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={20} style={{ color: 'var(--primary)' }} aria-hidden="true" />
            <h2 id="review-modal-title" style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Municipal Barrier Verification &amp; Resolution Queue
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-sm btn-ghost"
            style={{ padding: '0.25rem', borderRadius: '50%' }}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {!isStaff ? (
          <div
            style={{
              padding: '1.5rem',
              textAlign: 'center',
              background: 'rgba(239, 68, 68, 0.08)',
              borderRadius: '0.5rem',
              border: '1px solid rgba(239, 68, 68, 0.25)',
            }}
          >
            <AlertTriangle size={32} style={{ color: 'var(--danger, #ef4444)', margin: '0 auto 0.75rem auto' }} />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Staff Authorization Required
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 1rem 0' }}>
              Only authenticated municipal operators, field reviewers, or ward administrators have authority to verify
              or resolve physical defect records.
            </p>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Return to Public View
            </button>
          </div>
        ) : observations.length === 0 ? (
          <div
            style={{
              padding: '2rem',
              textAlign: 'center',
              background: 'var(--bg-secondary, rgba(0,0,0,0.02))',
              borderRadius: '0.5rem',
            }}
          >
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              No pending barrier observations requiring inspection in this queue.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '1.25rem' }}>
            {/* Observation List Selection */}
            <div
              style={{
                borderRight: '1px solid var(--border-light)',
                paddingRight: '1rem',
                maxHeight: '380px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                Pending Submissions ({observations.length})
              </span>
              {observations.map((obs) => {
                const isSelected = selectedObs?.id === obs.id;
                return (
                  <button
                    key={obs.id}
                    type="button"
                    onClick={() => setSelectedObs(obs)}
                    style={{
                      textAlign: 'left',
                      padding: '0.65rem 0.75rem',
                      borderRadius: '0.5rem',
                      background: isSelected ? 'var(--primary-subtle, rgba(59,130,246,0.15))' : 'var(--bg-input, var(--bg-card))',
                      border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                      <strong style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{obs.id}</strong>
                      <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>{obs.status}</span>
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                      {BARRIER_TYPES[obs.barrierType]?.label || obs.barrierType}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Action Form */}
            {selectedObs && (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div>
                  <h4 style={{ margin: '0 0 0.35rem 0', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                    {selectedObs.id}: {BARRIER_TYPES[selectedObs.barrierType]?.label}
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {selectedObs.description}
                  </p>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-tertiary)', marginTop: '0.35rem' }}>
                    Reported by: {selectedObs.reportedBy} | Ward: {selectedObs.ward}
                  </div>
                </div>

                {errorMsg && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--danger, #ef4444)' }}>
                    {errorMsg}
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                    Inspection Action
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${decisionAction === 'verify' ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => {
                        setDecisionAction('verify');
                        setReasonCode('statutory_inspection_passed');
                      }}
                    >
                      Verify Defect
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${decisionAction === 'reject' ? 'btn-danger' : 'btn-ghost'}`}
                      onClick={() => {
                        setDecisionAction('reject');
                        setReasonCode('inaccurate_location');
                      }}
                    >
                      Reject Report
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${decisionAction === 'resolve' ? 'btn-success' : 'btn-ghost'}`}
                      onClick={() => {
                        setDecisionAction('resolve');
                        setReasonCode('defect_rectified');
                      }}
                    >
                      Mark Resolved
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="reason-code-select" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                    Structured Audit Reason Code
                  </label>
                  <select
                    id="reason-code-select"
                    value={reasonCode}
                    onChange={(e) => setReasonCode(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.45rem 0.65rem',
                      borderRadius: '0.5rem',
                      background: 'var(--bg-input, var(--bg-card))',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-primary)',
                      fontSize: '0.84rem',
                    }}
                  >
                    <option value="statutory_inspection_passed">Ground audit verified physical obstacle</option>
                    <option value="defect_rectified">Civil repair completed / obstruction cleared</option>
                    <option value="duplicate_report">Duplicate report of active defect</option>
                    <option value="inaccurate_location">Unable to locate / non-existent hazard</option>
                    <option value="outside_statutory_mandate">Non-municipal jurisdiction</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="reviewer-notes" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                    Internal Reviewer Notes &amp; Action Log
                  </label>
                  <textarea
                    id="reviewer-notes"
                    rows={2}
                    placeholder="Enter inspection remarks or contractor work order number..."
                    value={reviewerNotes}
                    onChange={(e) => setReviewerNotes(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.45rem 0.65rem',
                      borderRadius: '0.5rem',
                      background: 'var(--bg-input, var(--bg-card))',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">
                    Cancel
                  </button>
                  <button type="submit" disabled={isSubmitting} className="btn btn-primary btn-sm">
                    {isSubmitting ? 'Recording Action...' : 'Confirm Audit Decision'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
